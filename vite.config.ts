import "./scripts/localNetwork.js";
import { loadEnv, type Plugin } from "vite";
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { createTripApiFromEnv, devServerEnv } from "./server/config.js";
import { createNodeApiMiddleware } from "./server/http/adapters.js";
import type { TripApi } from "./server/tripApi.js";

/**
 * Serves the Trip API from the Vite dev/preview server, so `npm run dev` runs the
 * whole app with one command. Uses an in-memory store that resets on restart,
 * unless a database is configured: `npm run dev:neon` reads DATABASE_URL from
 * `.env.local` (pulled with `npx vercel env pull .env.local`), and a DATABASE_URL
 * set in the shell is always used.
 */
function tripApiPlugin(): Plugin {
  let api: TripApi | undefined;
  let env: Record<string, string | undefined> = {};
  const middleware = createNodeApiMiddleware(() => (api ??= createTripApiFromEnv(env)));

  return {
    name: "trip-api",
    configResolved(config) {
      env = devServerEnv({ mode: config.mode, fileEnv: loadEnv(config.mode, config.root, ""), processEnv: process.env });
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
