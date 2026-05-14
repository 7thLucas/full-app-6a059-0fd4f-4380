// ─────────────────────────────────────────────────────────────────────────────
// Client-safe exports only.
//
// Server-only modules (model, service, seed, controller, routes) must NOT be
// re-exported here because they depend on Typegoose / Mongoose which crashes
// in the browser.  Import those directly from their own files on the server:
//
//   import { ConfigurableModel } from "~/modules/configurables/configurables.model";
//   import { ConfigurablesService } from "~/modules/configurables/configurables.service";
//   import { seedConfigurables } from "~/modules/configurables/configurables.seed";
//   import { getConfigurables } from "~/modules/configurables/configurables.controller";
//   import configurablesRoutes from "~/modules/configurables/configurables.routes";
// ─────────────────────────────────────────────────────────────────────────────

export * from "./src/hooks/use-configurables";
export * from "./src/components/configurables-css-bridge";
export * from "./src/constants/configurables.default";
export * from "./src/schemas/configurables.schema";
