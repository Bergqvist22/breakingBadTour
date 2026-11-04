import { createTripApi, type TripApi } from "./tripApi.js";
import { createMemoryTripStore } from "./store/memoryTripStore.js";
import { createPostgresTripStore } from "./store/postgresTripStore.js";
import type { TripStore } from "./store/tripStore.js";

type Env = Record<string, string | undefined>;

/** The database connection string, if one is configured (Neon on Vercel sets DATABASE_URL). */
export function databaseUrlFrom(env: Env): string | undefined {
  return env.DATABASE_URL || env.POSTGRES_URL || undefined;
}

/** Postgres when a database is configured, otherwise an in-memory store. */
export function createStoreFromEnv(env: Env): TripStore {
  const url = databaseUrlFrom(env);
  return url ? createPostgresTripStore(url) : createMemoryTripStore();
}

/** The Trip API wired to real dependencies chosen from the environment. */
export function createTripApiFromEnv(env: Env = process.env): TripApi {
  return createTripApi({ store: createStoreFromEnv(env) });
}
