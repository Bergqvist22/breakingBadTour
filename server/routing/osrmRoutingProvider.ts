import { DEFAULT_USER_AGENT } from "../geocoder/nominatimGeocoder.js";
import { RoutingError, type RoutePoint, type RoutingProvider } from "./routingProvider.js";

/**
 * The public OSRM demo server asks for an identifying User-Agent, at most one
 * request per second and light use only, and serves car routing ("driving").
 * https://github.com/Project-OSRM/osrm-backend/wiki/Demo-server
 */
export interface OsrmOptions {
  userAgent?: string;
  baseUrl?: string;
  /** Minimum gap between requests from this process. */
  minIntervalMs?: number;
  timeoutMs?: number;
}

interface OsrmError {
  code: string;
  message?: string;
}

interface OsrmTable {
  code: "Ok";
  durations: (number | null)[][];
  distances: (number | null)[][];
}

interface OsrmRoute {
  code: "Ok";
  routes: { legs: { duration: number; distance: number }[]; geometry: { coordinates: [number, number][] } }[];
}

/** What to tell people when OSRM answers with an error code. */
function errorMessage(status: number, body: Partial<OsrmError> | undefined): string {
  switch (body?.code) {
    case "TooBig":
      return "The routing service refuses Trips this big (it handles up to 100 Stops).";
    case "NoRoute":
    case "NoSegment":
      return "Some Stops can't be reached by road from the others.";
  }
  if (status === 429) return "The routing service is busy right now. The Route will update on the next change.";
  return `The routing service isn't working right now (${body?.code ?? `HTTP ${status}`}).`;
}

/** Coordinates to five decimals (about a metre) keep the saved line small. */
const round5 = (value: number) => Math.round(value * 1e5) / 1e5;

/** A routing provider over the public OSRM service, by car. */
export function createOsrmRoutingProvider({
  userAgent = DEFAULT_USER_AGENT,
  baseUrl = "https://router.project-osrm.org",
  minIntervalMs = 1000,
  timeoutMs = 15_000,
}: OsrmOptions = {}): RoutingProvider {
  // Requests from this process go one at a time, spaced out to respect the rate limit.
  let queue: Promise<unknown> = Promise.resolve();
  let lastRequestAt = 0;

  function throttled<T>(task: () => Promise<T>): Promise<T> {
    const run = queue.then(async () => {
      const wait = lastRequestAt + minIntervalMs - Date.now();
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      lastRequestAt = Date.now();
      return task();
    });
    queue = run.catch(() => undefined);
    return run;
  }

  async function get<T>(service: "table" | "route", points: RoutePoint[], params: Record<string, string>): Promise<T> {
    // OSRM wants longitude first.
    const coordinates = points.map(({ lat, lng }) => `${lng},${lat}`).join(";");
    const url = `${baseUrl}/${service}/v1/driving/${coordinates}?${new URLSearchParams(params)}`;
    return throttled(async () => {
      let response: Response;
      try {
        response = await fetch(url, {
          headers: { "User-Agent": userAgent, Accept: "application/json" },
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        const timedOut = (error as Error).name === "TimeoutError";
        throw new RoutingError(
          timedOut ? "The routing service didn't answer in time." : "The routing service couldn't be reached.",
          { cause: error },
        );
      }
      // OSRM explains its errors in a JSON body, even on HTTP 400.
      const body = (await response.json().catch(() => undefined)) as (Partial<OsrmError> & T) | undefined;
      if (!response.ok || body?.code !== "Ok") throw new RoutingError(errorMessage(response.status, body));
      return body;
    });
  }

  return {
    async matrix(points) {
      const table = await get<OsrmTable>("table", points, { annotations: "duration,distance" });
      // Unreachable pairs come back as null rather than as an error.
      const unreachable = (rows: (number | null)[][]) => rows.some((row) => row.some((value) => value === null));
      if (unreachable(table.durations) || unreachable(table.distances)) {
        throw new RoutingError("Some Stops can't be reached by road from the others.");
      }
      return { durationsSeconds: table.durations as number[][], distancesMeters: table.distances as number[][] };
    },

    async route(points) {
      const body = await get<OsrmRoute>("route", points, { overview: "full", geometries: "geojson", steps: "false" });
      const [route] = body.routes;
      return {
        legs: route.legs.map((leg) => ({ distanceMeters: leg.distance, durationSeconds: leg.duration })),
        // GeoJSON is [lng, lat]; the Route line is [lat, lng].
        line: route.geometry.coordinates.map(([lng, lat]): [number, number] => [round5(lat), round5(lng)]),
      };
    },
  };
}
