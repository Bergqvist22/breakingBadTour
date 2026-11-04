import { createTripApi, type ApiResponse } from "../tripApi.js";
import { createMemoryTripStore } from "../store/memoryTripStore.js";

/**
 * A fake clock that starts at a fixed instant and moves forward one minute
 * every time it is read, so every mutation gets a distinct, predictable time.
 */
export function createTickingClock(start = "2026-01-01T12:00:00.000Z") {
  let next = new Date(start).getTime();
  return () => {
    const now = new Date(next);
    next += 60_000;
    return now;
  };
}

// Tests read response bodies loosely; the assertions pin down their shape.
type TestResponse = { status: number; body: any };

export interface TestApiOptions {
  clock?: () => Date;
}

/**
 * The Trip API wired to in-memory fakes, called the same way the web app calls
 * it over HTTP: a method, a path and an optional JSON body.
 */
export function createTestApi(options: TestApiOptions = {}) {
  const api = createTripApi({
    store: createMemoryTripStore(),
    clock: options.clock ?? createTickingClock(),
  });

  const send = async (method: string, path: string, body?: unknown): Promise<TestResponse> => {
    const response: ApiResponse = await api.handle({ method, path, body });
    return response;
  };

  return {
    get: (path: string) => send("GET", path),
    post: (path: string, body?: unknown) => send("POST", path, body),
    send,
  };
}
