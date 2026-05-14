import { createLogger } from "~/lib/logger";
import { ConfigurableModel } from "../models/configurables.model";
import { defaultConfigurablesData } from "../constants/configurables.default";

const logger = createLogger("ConfigurablesSeed");

/**
 * Seed configurables from qb_configurables_data.json in the root folder
 */
export async function seedConfigurables(): Promise<void> {
  try {
    // Check if a singleton already exists
    const existing = await ConfigurableModel.findOne({ _singleton: true });
    if (existing) {
      return;
    }

    logger.info("Seeding configurables...");

    try {
      const configurableData = defaultConfigurablesData;
      logger.info(`Loaded configurables data from default data`);

      // Create the singleton document (ID will be auto-generated)
      await ConfigurableModel.create({
        _singleton: true,
        configurable_data: configurableData,
      });

      logger.info("✅ Configurables seeded successfully");
    } catch (err) {
      logger.error(`Error parsing default data:`, err);
    }
  } catch (error) {
    logger.error("❌ Failed to seed configurables:", error);
  }
}
