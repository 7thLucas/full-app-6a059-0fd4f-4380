// CORE: entrypoint + server wiring. Keep stack (Express+Remix) stable; extend via middleware/routes.
import "dotenv/config";
import { createRequestHandler } from "@remix-run/express";
import type { ServerBuild } from "@remix-run/node";
import express from "express";
import { connectMongoDB } from "./app/lib/db.server";
import { createServer } from "node:http";
import apiRoutes from "./app/api";
import { runSeeds } from "~/api/seeds";
import mongoose from "mongoose";

const PORT = Number.parseInt(process.env.PORT || "3000");
const HOST = process.env.HOST || "0.0.0.0"; // Default to 0.0.0.0 for tunnel connectivity
const BUILD_PATH = "./build/server/index.js";
const DEVELOPMENT = process.env.NODE_ENV !== "production";

async function startServer() {
  // Connect to MongoDB
  try {
    await connectMongoDB();
    console.log("MongoDB connected");

    // Run all seeds
    await runSeeds();

  } catch (error) {
    console.error("Failed to connect to MongoDB:", error);
    process.exit(1);
  }

  const app = express();

  const httpServer = createServer(app);

  // Request logging middleware (first, to catch all requests)
  app.use((req, res, next) => {
    console.log(`[Server] ${req.method} ${req.path} - ${new Date().toISOString()}`);
    next();
  });

  // Body parser middleware - ONLY for API routes, not for Remix routes
  // Remix will handle body parsing for its own routes
  app.use("/api", express.json());
  app.use("/api", express.urlencoded({ extended: true }));

  // API Routes (before Remix handler)
  app.use("/api", (req, res, next) => {
    console.log(`[API Route] ${req.method} ${req.path}`);
    next();
  }, apiRoutes);

  // Remix handler
  if (DEVELOPMENT) {
    console.log("Starting development server with Vite");
    const vite = await import("vite");
    const viteDevServer = await vite.createServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        hmr: {
          server: httpServer,
          clientPort: 443,
        },
        watch: {
          usePolling: true,
          interval: 100,
        },
      },
    });
    app.use(viteDevServer.middlewares);
    app.all("*", async (req, res, next) => {
      // Skip logging for static assets and dev tools
      if (!req.path.startsWith("/.well-known") && !req.path.includes("favicon")) {
        console.log(`[Remix Handler] ${req.method} ${req.path}`);
      }
      try {
        return await createRequestHandler({
          build: await viteDevServer.ssrLoadModule("virtual:remix/server-build") as unknown as ServerBuild,
          getLoadContext: () => ({}),
        })(req, res, next);
      } catch (error) {
        if (error instanceof Error) {
          viteDevServer.ssrFixStacktrace(error);
        }
        next(error);
      }
    });
  } else {
    console.log("Starting production server");
    app.use(express.static("build/client"));
    const build = await import(BUILD_PATH);
    app.all(
      "*",
      createRequestHandler({
        build: build as unknown as ServerBuild,
      })
    );
  }

  httpServer.listen(PORT, HOST, () => {
    console.log(`Server is running on http://${HOST}:${PORT}`);
  });

  // Graceful shutdown
  process.on("SIGTERM", async () => {
    console.log("SIGTERM received, shutting down gracefully");
    await mongoose.connection.close();
    process.exit(0);
  });

  process.on("SIGINT", async () => {
    console.log("SIGINT received, shutting down gracefully");
    await mongoose.connection.close();
    process.exit(0);
  });
}

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
