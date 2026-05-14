import type { Request, Response } from "express";
import { ConfigurablesService } from "../services/configurables.service";

/**
 * GET /api/configurables
 *
 * Returns the full config + schema for this app instance.
 * Response shape: { data: { data: FieldSchemaType[] } }
 *
 * The portal proxy (action/middle-editor-config?kind=schema) hits this
 * endpoint and unwraps payload.data.data to get the schema array.
 *
 * The template's own provider also calls this endpoint — it reads
 * the full response and extracts configurable_data + configurable_schema.
 */
export async function getConfigurables(_req: Request, res: Response) {
  try {
    const config = await ConfigurablesService.getConfig();
    return res.json({
      // Flat fields for the template's own ConfigurablesProvider
      configurable_data: config.configurable_data,
      configurable_schema: config.configurable_schema,
      // Nested shape for the portal proxy (kind=schema): payload.data.data
      data: { data: config.configurable_schema },
    });
  } catch (error) {
    console.error("Failed to fetch configurables:", error);
    return res.status(500).json({ message: "Failed to fetch configurables from database" });
  }
}

/**
 * GET /api/configurables/data
 *
 * Returns only the configurable_data object.
 * Response shape: { data: { data: Record<string, any> } }
 *
 * The portal proxy (action/middle-editor-config?kind=data) hits this
 * endpoint and unwraps payload.data.data to get the config object.
 */
export async function getConfigurablesData(_req: Request, res: Response) {
  try {
    const data = await ConfigurablesService.getData();
    return res.json({ data: { data } });
  } catch (error) {
    console.error("Failed to fetch configurables data:", error);
    return res.status(500).json({ message: "Failed to fetch configurables data from database" });
  }
}
