# Configurables Module — RULES & Reference
> This repository is must always use this module, everything thats related to app configurables such as app name, app color, background colors, colors, texts, images, must always this modules. This repository is a template that will help owner to update the app easily via its app config.

> **MUST READ** before touching `app/modules/configurables/`, adding schema fields, or modifying the postMessage protocol. Per-type samples in §5.

## 1. Mandate
This repository is a configurable app template. **Every owner-facing customization — app name, brand colors, background and surface colors, text/copy, logos, images, feature flags — MUST flow through this module.** Hardcoding such values anywhere in the app is forbidden; the whole point of the template is that owners customize a running app entirely via its config, without code changes. If a value can differ between two deployed instances of this template, it belongs in the schema.

Mechanics: singleton app-instance config persisted in Mongo (`tbl_app_configurables`), served at `GET /api/configurables`, hydrated via `<ConfigurablesProvider>` (mounted in `root.tsx`), consumed via `useConfigurables()`. Live-edited from the portal middle-editor over `window.postMessage`.

## 2. PostMessage Protocol
| Key | Direction | Payload |
|---|---|---|
| `QB_MIDDLE_EDITOR_READY` | iframe → parent | none |
| `QB_MIDDLE_EDITOR_UPDATE` | parent → iframe | `{ payload: configData, isPreviewed: true }` |
| `QB_MIDDLE_EDITOR_CONFIG_SYNC` | iframe → parent | `{ payload: configData }` — reserved, not yet emitted |
| `qb-route-change` | iframe → parent | `{ type, pathname }` — portal observability |

Send target is `"*"`; receive does not validate origin — always check `event.data?.type` first. Lifecycle: provider mounts → fetches config → emits `READY` → listens for `UPDATE` → replaces config wholesale.

## 3. HARD RULES
- **R1** `FieldSchemaType` (`configurables.schema.ts` lines 1–25, between `CANNOT BE CHANGED` markers) is frozen — no new union members, no renamed properties. It mirrors the portal repo; drift breaks the form silently.
- **R2** The four message keys above are frozen strings. Renaming silently disables sync.
- **R3** `GET /api/configurables` stays unauthenticated, returns `{ configurable_data, configurable_schema }`, responds 200 even when no document exists (empty data + in-code schema).
- **R4** Exactly one document with `_singleton: true`. Always query with that filter.
- **R5** Schema and defaults stay in sync — every `formSchema` field needs a matching key in `defaultConfigurablesData` and in `TDefaultConfigurableData`.
- **R6** `<ConfigurablesProvider>` wraps the entire tree (in `root.tsx`). Don't move below `<Outlet />` or conditionally mount.
- **R7** `seedConfigurables()` must stay idempotent (early-return on existing singleton).
- **R8** Every owner-facing value (names, colors, texts, images, logos, feature flags) flows through `useConfigurables()`. Hardcoded branding/copy in components violates this template's purpose — add a schema field instead.

## 4. Tunneler-Direct Fetch
Portal now fetches config directly via `Portal → {tunnelerUrl}/api/configurables → this app → Mongo` — no Postgres mirror. Endpoint is critical-path; CORS must allow the portal origin; response shape is a public API per R3; drop the singleton in dev when changing field shapes so the seeder re-runs.

## 5. Field Type Reference (THE SAMPLES)
Use these as the canonical source when adding fields. Each block shows the **schema fragment** then the **default value**.

### `string`
```ts
{ fieldName: "appName", type: "string", required: true, label: "App Name", minLength: 1, maxLength: 100 }
appName: "FILL_APP_NAME_HERE"     // optional fields: use "" + "// fill it here"
```
### `number`
```ts
{ fieldName: "maxItemsPerPage", type: "number", required: false, label: "Items Per Page", min: 1, max: 100 }
maxItemsPerPage: 12               // fill it here — number, never a string
```
### `boolean`
```ts
{ fieldName: "enableNotifications", type: "boolean", required: false, label: "Enable Notifications" }
enableNotifications: true         // fill it here — strict boolean, no 0/1
```
### `object` (`fields` required)
```ts
{ fieldName: "brandColor", type: "object", required: true, label: "Brand Color", fields: [
  { fieldName: "primary",   type: "color", required: true, label: "Primary"   },
  { fieldName: "secondary", type: "color", required: true, label: "Secondary" },
  { fieldName: "accent",    type: "color", required: true, label: "Accent"    },
]}
brandColor: { primary: "FILL_PRIMARY_COLOR_HERE", secondary: "FILL_SECONDARY_COLOR_HERE", accent: "FILL_ACCENT_COLOR_HERE" }
```
### `array` (`item` required; `item.fieldName` ignored)
```ts
// primitives
{ fieldName: "featuredCategories", type: "array", label: "Featured Categories", item: { type: "string", required: true } }
featuredCategories: []            // fill it here
// objects
{ fieldName: "team", type: "array", label: "Team Members", item: { type: "object", fields: [
  { fieldName: "name", type: "string", required: true, label: "Name" },
  { fieldName: "role", type: "string", required: true, label: "Role" },
]}}
team: []                          // fill it here
```
### `color` (hex/rgb string, not `{r,g,b}`)
```ts
{ fieldName: "footerBackground", type: "color", required: false, label: "Footer Background" }
footerBackground: "#111827"       // fill it here, or "FILL_FOOTER_BG_COLOR_HERE"
```
### `url` (format-validated only, no liveness check)
```ts
{ fieldName: "logoUrl", type: "url", required: true, label: "Logo URL" }
logoUrl: "FILL_LOGO_URL_HERE"
```
### `enum` (`options` required, else portal renders free text)
```ts
{ fieldName: "defaultLanguage", type: "enum", required: true, label: "Default Language", options: ["en","id","ja"] }
defaultLanguage: "en"             // must be one of options
```
### `datetime` (ISO-8601 string, not a `Date`)
```ts
{ fieldName: "launchDate", type: "datetime", required: false, label: "Launch Date" }
launchDate: "2025-01-01T00:00:00.000Z"
```
### `file` (resolved URL string after upload)
```ts
{ fieldName: "heroImage", type: "file", required: false, label: "Hero Image" }
heroImage: ""                     // fill it here once uploaded
```
### `files` (array of resolved URL strings)
```ts
{ fieldName: "galleryImages", type: "files", required: false, label: "Gallery Images" }
galleryImages: []                 // fill it here
```

## 6. Adding & Consuming
**Add a field** — (1) append to `formSchema`, (2) mirror in `defaultConfigurablesData` + `TDefaultConfigurableData`, (3) drop the singleton in dev so the seeder re-runs (it's idempotent and won't update an existing doc), (4) verify via `curl /api/configurables` and the portal preview.

**Consume:** `const { config, loading, error } = useConfigurables()` — always optional-chain + fallback (config may be partial right after mount). UPDATE replaces config wholesale → consumers re-render. No write API inside the iframe; the portal owns writes.
