import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import devtoolsJson from "vite-plugin-devtools-json";
import { fileURLToPath, URL } from "node:url";

declare module "@remix-run/node" {
  interface Future {
    v3_singleFetch: true;
  }
}

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@qb\/(.+)$/,
        replacement: fileURLToPath(new URL("./app/modules/$1", import.meta.url)),
      },
    ],
  },
  ssr: {
    noExternal: [
      // "@radix-ui",
      // "react-icons",
      // "framer-motion",
      // "@apollo/client",
      // "posthog-js",
      // "posthog-js/react",
    ],
  },
  server: {
    allowedHosts: true,
    watch: {
      usePolling: true,
      interval: 100,
    },
    hmr: {
      clientPort: 443,
    },
  },
  plugins: [
    devtoolsJson(),
    remix({
      ignoredRouteFiles: ["**/*.css"],
      future: {
        v3_fetcherPersist: true,
        v3_relativeSplatPath: true,
        v3_throwAbortReason: true,
        v3_singleFetch: true,
        v3_lazyRouteDiscovery: true,
        v3_routeConfig: true,
      },
    }),
    tsconfigPaths(),
  ],
});
