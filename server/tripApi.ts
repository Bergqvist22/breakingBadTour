import type {
  LocationSearchDto,
  RouteDto,
  StopDto,
  TripDto,
  TripListDto,
  TripRevisionDto,
  TripSummaryDto,
} from "../shared/apiTypes.js";
import type { SavedRoute, StopRecord, TripStore, TripSummaryRecord } from "./store/tripStore.js";
import { createTripService, NotFoundError, ValidationError, type TripView } from "./tripService.js";
import { GeocoderError, type Geocoder } from "./geocoder/geocoder.js";
import type { RoutingProvider } from "./routing/routingProvider.js";

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
  routing: RoutingProvider;
  clock?: () => Date;
  newId?: () => string;
}

export interface TripApi {
  handle(request: ApiRequest): Promise<ApiResponse>;
}

function toSummaryDto(trip: TripSummaryRecord): TripSummaryDto {
  return {
    id: trip.id,
    name: trip.name,
    updatedAt: trip.updatedAt.toISOString(),
    revision: trip.revision,
    stopCount: trip.stopCount,
    route: trip.routeTotals,
  };
}

function toStopDto(stop: StopRecord): StopDto {
  return { id: stop.id, name: stop.name, address: stop.address, lat: stop.lat, lng: stop.lng };
}

function toRouteDto({ stopIds, legs, distanceMeters, durationSeconds, line }: SavedRoute): RouteDto {
  return { stopIds, legs, distanceMeters, durationSeconds, line };
}

function toDto(trip: TripView): TripDto {
  return {
    id: trip.id,
    name: trip.name,
    updatedAt: trip.updatedAt.toISOString(),
    revision: trip.revision,
    stopCount: trip.stops.length,
    stops: trip.stops.map(toStopDto),
    startStopId: trip.startStopId,
    roundTrip: trip.roundTrip,
    route: trip.route && toRouteDto(trip.route),
    routeError: trip.routeError,
  };
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
 *   PATCH  /api/trips/:id                   rename and/or turn Round trip on or off { name?, roundTrip? }
 *   DELETE /api/trips/:id                   delete, with its Stops
 *   GET    /api/trips/:id/revision          { revision } only: poll this, fetch the Trip when it moves
 *   POST   /api/locations/search            { query } → up to 5 matches; "lat, lng" is used as typed
 *   POST   /api/trips/:id/stops             add { name, location: a search match }
 *   PATCH  /api/trips/:id/stops/:stopId     rename and/or move { name?, location? }
 *   DELETE /api/trips/:id/stops/:stopId     remove
 *   PUT    /api/trips/:id/start             make a Stop the Start { stopId }
 *
 * Every mutating call except DELETE of a Trip returns the updated Trip.
 */
export function createTripApi({ store, geocoder, routing, clock = () => new Date(), newId }: TripApiDeps): TripApi {
  const service = createTripService({ store, geocoder, routing, clock, newId });

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
        const changes = { name: bodyField(request.body, "name"), roundTrip: bodyField(request.body, "roundTrip") };
        return { status: 200, body: toDto(await service.changeTrip(id, changes)) };
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

    const revisionMatch = /^\/api\/trips\/([^/]+)\/revision$/.exec(path);
    if (revisionMatch) {
      if (request.method !== "GET") return methodNotAllowed;
      const body: TripRevisionDto = { revision: await service.getRevision(decodeURIComponent(revisionMatch[1])) };
      return { status: 200, body };
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
