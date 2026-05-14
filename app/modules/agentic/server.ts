// SERVER-ONLY entry. Imports `node:crypto`, `axios`, `express`, and
// `mongoose` (transitively). Never import this from a file that runs in the
// browser — including any module reachable from a Remix route component, a
// React hook, or a `~/lib/*.client.ts` helper.
//
// Safe import sites:
//   - `server.ts` (the host app's Express entrypoint)
//   - Remix `*.server.ts(x)` files
//   - Remix `loader` / `action` functions
//   - Other server-only modules (api routes, seeds, jobs)
//
// The host app does not need to import `agentsRouter` directly — the router
// is auto-discovered by `app/api/routes.ts` via filesystem scan of
// `*.routes.ts` files. It is re-exported here purely for hosts that wire
// routers manually.

export { default as agentsRouter } from "./agents.routes";
export { AgentJobModel } from "./agent-job.model";
export type { AgentJob, AgentJobStatus } from "./agent-job.model";
