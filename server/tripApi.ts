import type { TripDto, TripListDto } from "../shared/apiTypes.js";
import type { TripStore, TripRecord } from "./store/tripStore.js";
import { createTripService, ValidationError } from "./tripService.js";

/** An API call, independent of HTTP: the web adapters translate to and from this. */
export interface ApiRequest {
  method: string;
  /** Path including the `/api` prefix, e.g. `/api/trips`. */
  path: string;
  /** Parsed JSON body, if any. */
  body?: unknown;
}

export interface ApiResponse {
  status: number;
  body: unknown;
}

export interface TripApiDeps {
  store: TripStore;
  clock?: () => Date;
  newId?: () => string;
}

export interface TripApi {
  handle(request: ApiRequest): Promise<ApiResponse>;
}

function toDto(trip: TripRecord): TripDto {
  return { id: trip.id, name: trip.name, updatedAt: trip.updatedAt.toISOString() };
}

function bodyField(body: unknown, field: string): unknown {
  return typeof body === "object" && body !== null ? (body as Record<string, unknown>)[field] : undefined;
}

/**
 * The Trip API: the single seam the web app (and the tests) talk to.
 * Pure request → response; no HTTP server or network involved.
 */
export function createTripApi({ store, clock = () => new Date(), newId }: TripApiDeps): TripApi {
  const service = createTripService({ store, clock, newId });

  async function route(request: ApiRequest): Promise<ApiResponse> {
    const path = request.path.replace(/\/+$/, "");

    if (path === "/api/trips") {
      if (request.method === "GET") {
        const trips = await service.listTrips();
        const body: TripListDto = { trips: trips.map(toDto) };
        return { status: 200, body };
      }
      if (request.method === "POST") {
        const trip = await service.createTrip(bodyField(request.body, "name"));
        return { status: 201, body: toDto(trip) };
      }
      return { status: 405, body: { error: "Method not allowed." } };
    }

    return { status: 404, body: { error: "Not found." } };
  }

  return {
    async handle(request) {
      try {
        return await route(request);
      } catch (error) {
        if (error instanceof ValidationError) return { status: 400, body: { error: error.message } };
        throw error;
      }
    },
  };
}
