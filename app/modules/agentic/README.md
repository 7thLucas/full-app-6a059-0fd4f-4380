# @qb/agentic

Scaffold module that adds an async agent-call surface to a host app. Submit
hits `/api/agents/call`, the call runs in background on the agentic service,
and the result lands in this scaffold's database via a callback webhook. The
host app reads results from the database (via `getList()` or the model
directly) — submission and read are intentionally decoupled.

## ⚠️ Critical: client/server boundary

**Read this before importing anything from `@qb/agentic`.** Mixing up the two
entry points will silently break the host app's browser bundle and the page
will appear stuck on `Loading...` (the client JS fails to evaluate, so React
never hydrates and provider effects never run).

This package ships **two entry points**, and they are not interchangeable:

| Import                       | Use from                                        | Contains                                  |
|------------------------------|-------------------------------------------------|-------------------------------------------|
| `from "@qb/agentic"`         | client + server (any file, including hooks/components) | `submit`, `getList`, types only           |
| `from "@qb/agentic/server"`  | **server only** (Express, loaders, actions, `*.server.ts`) | `agentsRouter`, `AgentJobModel`, server types |

Why this matters: the server entry transitively pulls in `node:crypto`,
`axios`, `express`, and `mongoose`. None of those are browser-safe. Even a
bare ESM re-export — e.g. `export { default as agentsRouter } from
"./agents.routes"` in the root index — drags the whole router module through
the client bundler. Vite/Rollup then fails with:

```
"createHash" is not exported by "__vite-browser-external",
imported by "app/modules/agentic/agents.routes.ts"
```

In dev that error happens at module-evaluation time in the browser, so
nothing visible breaks server-side. The client just never finishes booting.

**Rules of thumb:**

- A React hook or component imports from `@qb/agentic` (root), never
  `/server`.
- A Remix `loader`, `action`, or anything in a `*.server.ts(x)` file imports
  from `@qb/agentic/server` when it needs the model or router.
- If you find yourself adding a new export, ask: *can this run in a
  browser?* If no, it goes in `./server.ts`. The root `index.ts` has a
  comment header reiterating this — keep it there.
- The host app does **not** need to import `agentsRouter` to register routes.
  `app/api/routes.ts` auto-discovers any `*.routes.ts` under `app/modules/*/`
  and mounts the default export. The router export exists only for hosts
  that wire Express manually.

If you regress this boundary, the symptom is *not* a server error — it's the
host app hanging on its initial render with no obvious cause. Check the
browser console first; the Vite error is loud there.

## Setup

| Variable             | Description                                                      |
|----------------------|------------------------------------------------------------------|
| `QB_SCAFFOLDER_KEY`  | Shared secret for the `Authentication` header to the agentic service |
| `VITE_KEYSPACE`      | Keyspace ID sent as `x-id-keyspace` (identifies this product to the agentic service) |

That's it. No `MONGODB_URI` here — the host app's existing Mongoose connection
is shared automatically when the module's routes are auto-registered. No
service URL either — it's hardcoded to a single global deployment.

The scaffold's routes are auto-discovered by the host app under `/api/agents/*`.

**Trust-proxy note.** The scaffold derives the callback URL from the inbound
request and prefers `X-Forwarded-Proto` over `req.protocol`. If your host app
sits behind a TLS-terminating proxy, ensure the proxy sets that header (most
do — Rancher/Ingress, Cloudflare, etc.). No host-app code change is required
for this case.

## Architecture

```
   browser ──POST /api/agents/call──▶ scaffold ──POST /api/call──▶ agentic service
                                          │                              │
                                          │       (agent runs in bg)     │
                                          │                              │
   browser ──GET  /api/agents/list ───▶ scaffold ◀──POST /api/agents/callback/:id
                                          │
                                       Mongo
```

- **Submit is non-blocking.** `POST /api/agents/call` writes a `PENDING`
  `AgentJob` row, dispatches to the agentic service with a `callback_url`
  and a per-call `callback_token`, and returns `{ jobId, status: "PENDING" }`
  immediately.
- **The callback is the source of truth.** When the agentic service finishes,
  it POSTs to `/api/agents/callback/:id`. That handler validates the token
  and persists DONE/ERROR + payload to Mongo. The first callback wins;
  retries for an already-settled row are acknowledged but ignored.
- **Reads come from the database.** `getList()` is the primary read path.
  Refresh it from your UI on user action, interval, or route revisit. For
  server-side loaders / dashboards, import `AgentJobModel` directly.

## Routes

| Method | Path                          | Purpose                                                       |
|--------|-------------------------------|---------------------------------------------------------------|
| POST   | `/api/agents/call`            | Enqueue a prompt. Returns `{ jobId, status: "PENDING" }`.     |
| POST   | `/api/agents/callback/:id`    | **Webhook** for the agentic service. Don't call from app code. |
| GET    | `/api/agents/list`            | List recent jobs, most recent first.                          |

## Client API

```ts
// Client-safe — use from React hooks, components, or server code.
import { submit, getList } from "@qb/agentic";

// Fire and return immediately. The result lands in the DB later.
await submit("Hello!");

// Render the list. Refresh on user action / interval / route revisit.
const { items } = await getList({ limit: 20 });
```

**There is intentionally no hook that "awaits" the agent reply.** Agent runs
are async and the UI must be designed around that, not around a
synchronous-looking `await call(...)`.

For server-side access (loaders, actions, `*.server.ts`, Express handlers):

```ts
import { AgentJobModel } from "@qb/agentic/server";
const recent = await AgentJobModel.find().sort({ createdAt: -1 }).limit(20).lean();
```

> Importing `AgentJobModel` from `@qb/agentic` (root) was supported in
> 1.0.x and removed in 1.1.0 to stop mongoose leaking into the client bundle.
> Update imports to `@qb/agentic/server`.

## Extension points

The callback handler (`POST /api/agents/callback/:id` in `agents.routes.ts`)
is the natural place to hook side effects on agent completion:

- **Notifications** — after the `updateOne(...)` call, dispatch to your
  notification system (WebPush, in-app inbox, email).
- **Downstream workflows** — enqueue a follow-up job, update aggregate state,
  fan out to other modules.
- **Audit / analytics** — write an event to your event store; the full
  request+response is on the row.

### Per-user views

The `AgentJob` model has no built-in ownership field — the host app sees one
shared bag of jobs. If you need per-user / per-tenant separation (e.g. a "my
submissions" page), extend the schema with a `userId` (or whatever your app's
owning principal is), set it from request context in the `submit` handler,
and add it to the `getList` filter.

## Idempotency & duplicate submits

Two layers of dedupe protect against rapid duplicate submissions:

1. **Consumer side.** Before creating a row, the `submit` handler checks for
   an in-flight `PENDING` row with the same prompt and returns that jobId if
   present. Two fast clicks on the same prompt collapse to one row.
2. **Agentic service side.** The dispatch carries
   `idempotency-key = sha256(VITE_KEYSPACE + prompt).slice(0, 32)`, so the
   agentic service also dedupes if our consumer-side check raced.

For belt-and-suspenders UX, disable the submit button briefly after
`submit()` resolves.

## Failure modes

- **Agentic service unreachable at submit** — the row is updated to `ERROR`
  with the dispatch error. Visible on the next `getList()` refresh.
- **Callback never arrives** — the row stays `PENDING` indefinitely. Detect
  via `createdAt` age in your UI; the row remains in Mongo for inspection.
- **Callback delivery exhausts retries** — the agentic service marks its own
  job `callback_delivered=False` (visible in its logs as `CALLBACK_FAILED`).
  The consumer-side row stays `PENDING`; same handling as above.
- **Duplicate / stale callback retry** — the handler is idempotent: a second
  callback for an already-settled row returns 200 with `idempotent: true`
  and does not mutate state.
