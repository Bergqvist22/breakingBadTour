import { createTripApi, type TripApi } from "./tripApi.js";
import { createMemoryTripStore } from "./store/memoryTripStore.js";
import { createPostgresTripStore } from "./store/postgresTripStore.js";
import type { TripStore } from "./store/tripStore.js";
import { createNominatimGeocoder } from "./geocoder/nominatimGeocoder.js";

type Env = Record<string, string | undefined>;

/** The database connection string, if one is configured (Neon on Vercel sets DATABASE_URL). */
export function databaseUrlFrom(env: Env): string | undefined {
  return env.DATABASE_URL || env.POSTGRES_URL || undefined;
}

/** The Vite mode (`npm run dev:neon`) in which the dev server reads the database URL from `.env` files. */
export const NEON_DEV_MODE = "neon";

/**
 * The environment the dev server's Trip API sees. Variables from `.env` files
 * (e.g. `.env.local` from `vercel env pull`) only count in the neon mode, so plain
 * `npm run dev` stays on the in-memory store. Variables set in the shell always count.
 */
export function devServerEnv({ mode, fileEnv, processEnv }: { mode: string; fileEnv: Env; processEnv: Env }): Env {
  return mode === NEON_DEV_MODE ? { ...fileEnv, ...processEnv } : { ...processEnv };
}

/** Postgres when a database is configured, otherwise an in-memory store. */
export function createStoreFromEnv(env: Env): TripStore {
  const url = databaseUrlFrom(env);
  return url ? createPostgresTripStore(url) : createMemoryTripStore();
}

/** The Trip API wired to real dependencies chosen from the environment. */
export function createTripApiFromEnv(env: Env = process.env): TripApi {
  return createTripApi({
    store: createStoreFromEnv(env),
    geocoder: createNominatimGeocoder({ userAgent: env.NOMINATIM_USER_AGENT || undefined }),
  });
}
