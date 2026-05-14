// CLIENT-SAFE entry. Anything imported from this module ends up in the host
// app's BROWSER bundle. Do not re-export server-only code (routers, mongoose
// models, anything that touches `node:*`, `axios`, `express`) here — even if
// the import looks tree-shakeable, ESM re-exports drag the source module
// through the bundler and Vite/Rollup will fail with errors like:
//
//   "createHash" is not exported by "__vite-browser-external"
//
// Server-only exports live in `./server` (see package.json `exports`).
//
// If you need to extend this entry, add only types and code that is safe to
// run in a browser context.

export { submit, getList } from "./agents.service";
export type { AgentJobView } from "./agents.service";
export type { AgentJobStatus } from "./agent-job.model";
