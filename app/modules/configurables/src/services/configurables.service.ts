/**
 * Configurables Service
 * Singleton app configuration persisted in database.
 */

import { ConfigurableModel } from "../models/configurables.model";
import { configurableSchemas } from "../schemas/configurables.schema";

export class ConfigurablesService {
  /**
   * Get the full singleton configurables document (schema + data).
   * Used by the template's own provider via GET /api/configurables.
   */
  static async getConfig() {
    const config = await ConfigurableModel.findOne({ _singleton: true }).exec();

    if (!config) {
      return {
        configurable_data: {},
        configurable_schema: configurableSchemas.formSchema,
      };
    }

    return {
      configurable_data: config.configurable_data,
      configurable_schema: configurableSchemas.formSchema,
    };
  }

  /**
   * Get only the schema (FieldSchemaType[]).
   * Portal proxy fetches this via GET /api/configurables/schema.
   */
  static getSchema() {
    return configurableSchemas.formSchema;
  }

  /**
   * Get only the configurable_data object.
   * Portal proxy fetches this via GET /api/configurables/data.
   */
  static async getData() {
    const config = await ConfigurableModel.findOne({ _singleton: true }).exec();
    return config?.configurable_data ?? {};
  }

  /**
   * Update the singleton configurables document
   */
  static async updateConfig(data: {
    configurable_data?: any;
    configurable_schema?: any[];
  }) {
    return await ConfigurableModel.findOneAndUpdate(
      { _singleton: true },
      { $set: data },
      { upsert: true, new: true },
    ).exec();
  }
}
