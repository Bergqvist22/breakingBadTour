import type { LocationSearchDto, StopDto, TripDto, TripListDto, TripSummaryDto } from "../shared/apiTypes.js";
import type { StopRecord, TripRecord, TripStore } from "./store/tripStore.js";
import { createTripService, NotFoundError, ValidationError, type TripView } from "./tripService.js";
import { GeocoderError, type Geocoder } from "./geocoder/geocoder.js";

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
  geocoder: Geocoder;
  clock?: () => Date;
  newId?: () => string;
}

export interface TripApi {
  handle(request: ApiRequest): Promise<ApiResponse>;
}

function toSummaryDto(trip: TripRecord): TripSummaryDto {
  return { id: trip.id, name: trip.name, updatedAt: trip.updatedAt.toISOString(), revision: trip.revision };
}

function toStopDto(stop: StopRecord): StopDto {
  return { id: stop.id, name: stop.name, address: stop.address, lat: stop.lat, lng: stop.lng };
}

function toDto(trip: TripView): TripDto {
  return { ...toSummaryDto(trip), stops: trip.stops.map(toStopDto), startStopId: trip.startStopId };
}

const methodNotAllowed: ApiResponse = { status: 405, body: { error: "Method not allowed." } };

function bodyField(body: unknown, field: string): unknown {
  return typeof body === "object" && body !== null ? (body as Record<string, unknown>)[field] : undefined;
}

/**
 * The Trip API: the single seam the web app (and the tests) talk to.
 * Pure request → response; no HTTP server or network involved.
 *
 *   GET    /api/trips                       list (summaries)
 *   POST   /api/trips                       create { name }
 *   GET    /api/trips/:id                   the Trip with its Stops and Start
 *   PATCH  /api/trips/:id                   rename { name }
 *   DELETE /api/trips/:id                   delete, with its Stops
 *   POST   /api/locations/search            { query } → up to 5 matches; "lat, lng" is used as typed
 *   POST   /api/trips/:id/stops             add { name, location: a search match }
 *   PATCH  /api/trips/:id/stops/:stopId     rename and/or move { name?, location? }
 *   DELETE /api/trips/:id/stops/:stopId     remove
 *   PUT    /api/trips/:id/start             make a Stop the Start { stopId }
 *
 * Every mutating call except DELETE of a Trip returns the updated Trip.
 */
export function createTripApi({ store, geocoder, clock = () => new Date(), newId }: TripApiDeps): TripApi {
  const service = createTripService({ store, geocoder, clock, newId });

  async function route(request: ApiRequest): Promise<ApiResponse> {
    const path = request.path.replace(/\/+$/, "");

    if (path === "/api/trips") {
      if (request.method === "GET") {
        const trips = await service.listTrips();
        const body: TripListDto = { trips: trips.map(toSummaryDto) };
        return { status: 200, body };
      }
      if (request.method === "POST") {
        const trip = await service.createTrip(bodyField(request.body, "name"));
        return { status: 201, body: toDto(trip) };
      }
      return methodNotAllowed;
    }

    if (path === "/api/locations/search") {
      if (request.method !== "POST") return methodNotAllowed;
      const body: LocationSearchDto = { matches: await service.searchLocations(bodyField(request.body, "query")) };
      return { status: 200, body };
    }

    const tripMatch = /^\/api\/trips\/([^/]+)$/.exec(path);
    if (tripMatch) {
      const id = decodeURIComponent(tripMatch[1]);
      if (request.method === "GET") {
        return { status: 200, body: toDto(await service.getTrip(id)) };
      }
      if (request.method === "PATCH") {
        return { status: 200, body: toDto(await service.renameTrip(id, bodyField(request.body, "name"))) };
      }
      if (request.method === "DELETE") {
        await service.deleteTrip(id);
        return { status: 204, body: null };
      }
      return methodNotAllowed;
    }

    const stopsMatch = /^\/api\/trips\/([^/]+)\/stops$/.exec(path);
    if (stopsMatch) {
      const tripId = decodeURIComponent(stopsMatch[1]);
      if (request.method === "POST") {
        const trip = await service.addStop(tripId, bodyField(request.body, "name"), bodyField(request.body, "location"));
        return { status: 201, body: toDto(trip) };
      }
      return methodNotAllowed;
    }

    const startMatch = /^\/api\/trips\/([^/]+)\/start$/.exec(path);
    if (startMatch) {
      const tripId = decodeURIComponent(startMatch[1]);
      if (request.method === "PUT") {
        return { status: 200, body: toDto(await service.makeStart(tripId, bodyField(request.body, "stopId"))) };
      }
      return methodNotAllowed;
    }

    const stopMatch = /^\/api\/trips\/([^/]+)\/stops\/([^/]+)$/.exec(path);
    if (stopMatch) {
      const tripId = decodeURIComponent(stopMatch[1]);
      const stopId = decodeURIComponent(stopMatch[2]);
      if (request.method === "PATCH") {
        const changes = { name: bodyField(request.body, "name"), location: bodyField(request.body, "location") };
        return { status: 200, body: toDto(await service.changeStop(tripId, stopId, changes)) };
      }
      if (request.method === "DELETE") {
        return { status: 200, body: toDto(await service.removeStop(tripId, stopId)) };
      }
      return methodNotAllowed;
    }

    return { status: 404, body: { error: "Not found." } };
  }

  return {
    async handle(request) {
      try {
        return await route(request);
      } catch (error) {
        if (error instanceof ValidationError) return { status: 400, body: { error: error.message } };
        if (error instanceof NotFoundError) return { status: 404, body: { error: error.message } };
        if (error instanceof GeocoderError) {
          console.error(error);
          return { status: 502, body: { error: "Address lookup isn't working right now. Try again in a moment." } };
        }
        throw error;
      }
    },
  };
}
