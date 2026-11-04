import { loadEnv, type Plugin } from "vite";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { createTripApiFromEnv } from "./server/config.js";
import { createNodeApiMiddleware } from "./server/http/adapters.js";
import type { TripApi } from "./server/tripApi.js";

/**
 * Serves the Trip API from the Vite dev/preview server, so `npm run dev` runs the
 * whole app with one command. Uses Postgres if DATABASE_URL is set (e.g. in
 * `.env.local`), otherwise an in-memory store that resets on restart.
 */
function tripApiPlugin(): Plugin {
  let api: TripApi | undefined;
  let env: Record<string, string> = {};
  const middleware = createNodeApiMiddleware(() => (api ??= createTripApiFromEnv(env)));

  return {
    name: "trip-api",
    configResolved(config) {
      env = { ...loadEnv(config.mode, config.root, ""), ...(process.env as Record<string, string>) };
    },
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}

export default defineConfig({
  plugins: [react(), tripApiPlugin()],
  test: {
    include: ["server/**/*.test.ts", "src/**/*.test.{ts,tsx}"],
  },
});
