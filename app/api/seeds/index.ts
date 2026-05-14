import path from "node:path";
import { pathToFileURL } from "node:url";
import { readdir } from "node:fs/promises";
import { createLogger } from "~/lib/logger";

const logger = createLogger("Seed");

type SeedFunction = () => Promise<void> | void;
type SeedModule = Record<string, unknown> & {
  default?: unknown;
};

interface DiscoveredSeed {
  exportName: string;
  filePath: string;
  run: SeedFunction;
}

const seedFilePattern = /\.seed\.(ts|tsx|js|mjs|cjs)$/;

async function discoverSeedFiles(): Promise<string[]> {
  const modulesPath = path.join(process.cwd(), "app", "modules");
  const moduleEntries = await readdir(modulesPath, { withFileTypes: true }).catch((error) => {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }

    throw error;
  });

  const seedFilesSet = new Set<string>();

  for (const entry of moduleEntries) {
    if (!entry.isDirectory()) continue;

    const modulePath = path.join(modulesPath, entry.name);
    const scanPaths = [modulePath, path.join(modulePath, "src", "seeds")];

    for (const scanPath of scanPaths) {
      const files = await readdir(scanPath, { withFileTypes: true }).catch(() => []);
      for (const file of files) {
        if (file.isFile() && seedFilePattern.test(file.name)) {
          seedFilesSet.add(path.join(scanPath, file.name));
        }
      }
    }
  }

  return [...seedFilesSet].sort();
}

function getSeedFunctions(filePath: string, seedModule: SeedModule): DiscoveredSeed[] {
  const seedFunctions = new Map<string, SeedFunction>();

  if (typeof seedModule.default === "function") {
    seedFunctions.set("default", seedModule.default as SeedFunction);
  }

  for (const [exportName, exportedValue] of Object.entries(seedModule)) {
    if (exportName === "default") continue;
    if (!/^seed[A-Z]/.test(exportName)) continue;
    if (typeof exportedValue !== "function") continue;

    seedFunctions.set(exportName, exportedValue as SeedFunction);
  }

  return [...seedFunctions.entries()].map(([exportName, run]) => ({
    exportName,
    filePath,
    run,
  }));
}

async function discoverSeeds(): Promise<DiscoveredSeed[]> {
  const seedFiles = await discoverSeedFiles();
  const discoveredSeeds: DiscoveredSeed[] = [];

  for (const filePath of seedFiles) {
    const seedModule = await import(pathToFileURL(filePath).href) as SeedModule;
    discoveredSeeds.push(...getSeedFunctions(filePath, seedModule));
  }

  return discoveredSeeds;
}

/**
 * Run all seed functions
 * This is the main entry point for module seed discovery.
 *
 * Any app/modules/<module>/*.seed.ts file can export seed functions as:
 * - default
 * - named functions matching seedSomething
 */
export async function runSeeds(): Promise<void> {
  logger.info("Starting seed operations...");

  try {
    const seeds = await discoverSeeds();

    for (const seed of seeds) {
      logger.info(`Running seed ${seed.exportName} from ${path.relative(process.cwd(), seed.filePath)}`);
      await seed.run();
    }

    logger.info("✅ All seed operations completed successfully");
  } catch (error) {
    logger.error("❌ Seed operations failed:", error);
    logger.warn("⚠️ Server will continue despite seeding failure");
  }
}
