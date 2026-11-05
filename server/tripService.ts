import { randomUUID } from "node:crypto";
import type {
  SavedRoute,
  StopLocation,
  StopRecord,
  TripChanges,
  TripRecord,
  TripStore,
  TripSummaryRecord,
} from "./store/tripStore.js";
import type { Geocoder } from "./geocoder/geocoder.js";
import { RoutingError, type RoutingProvider } from "./routing/routingProvider.js";
import { calculateRoute, routeBasis } from "./routing/calculateRoute.js";

/** A rule was broken by the caller's input (maps to HTTP 400). */
export class ValidationError extends Error {}

/** The thing the caller asked for doesn't exist (maps to HTTP 404). */
export class NotFoundError extends Error {}

/** A place to pick from when adding or moving a Stop. */
export interface LocationMatch {
  /** What to show in the pick list. */
  label: string;
  /** The address the Stop keeps, or null when the spot has no street address. */
  address: string | null;
  lat: number;
  lng: number;
}

/** A Trip with its Stops (in Route order) and its Start. */
export interface TripView extends TripRecord {
  /** In Route order; Stops the saved Route doesn't include yet come last, oldest first. */
  stops: StopRecord[];
  /** The Start: the picked Stop if it is still there, otherwise the oldest Stop; null without Stops. */
  startStopId: string | null;
}

export interface TripServiceDeps {
  store: TripStore;
  geocoder: Geocoder;
  routing: RoutingProvider;
  clock: () => Date;
  newId?: () => string;
}

export interface TripService {
  createTrip(name: unknown): Promise<TripView>;
  /** All Trips, most recently changed first. */
  listTrips(): Promise<TripSummaryRecord[]>;
  /** The Trip with this id; throws NotFoundError if there is none. */
  getTrip(id: string): Promise<TripView>;
  /** Just the Trip's revision, for cheap polling; throws NotFoundError if there is no such Trip. */
  getRevision(id: string): Promise<number>;
  /**
   * Gives the Trip a new (non-empty) name and/or turns Round trip on or off (whichever is given);
   * throws NotFoundError if there is no such Trip.
   */
  changeTrip(id: string, changes: { name?: unknown; roundTrip?: unknown }): Promise<TripView>;
  /** Deletes the Trip and its Stops; throws NotFoundError if there is no such Trip. */
  deleteTrip(id: string): Promise<void>;
  /** Up to 5 places matching an address, or the typed coordinates with their street address. */
  searchLocations(query: unknown): Promise<LocationMatch[]>;
  /** Adds a named Stop at a picked location (a LocationMatch) and returns the updated Trip. */
  addStop(tripId: string, name: unknown, location: unknown): Promise<TripView>;
  /**
   * Renames a Stop and/or moves it to a new picked location (whichever is given)
   * and returns the updated Trip.
   */
  changeStop(tripId: string, stopId: string, changes: { name?: unknown; location?: unknown }): Promise<TripView>;
  /** Removes a Stop and returns the updated Trip. If it was the Start, the oldest remaining Stop takes over. */
  removeStop(tripId: string, stopId: string): Promise<TripView>;
  /** Makes one of the Trip's Stops its Start and returns the updated Trip. */
  makeStart(tripId: string, stopId: unknown): Promise<TripView>;
}

/** "35.1258, -106.5361" or "35.1258 -106.5361": latitude then longitude. */
const COORDINATES = /^\s*([-+]?\d+(?:\.\d+)?)\s*(?:,|\s)\s*([-+]?\d+(?:\.\d+)?)\s*$/;

const outOfRange = () => new ValidationError("Coordinates are latitude (-90 to 90), then longitude (-180 to 180).");

/** The coordinates in the text, if it is just a "lat, lng" pair; throws if they are out of range. */
function parseCoordinates(text: string): { lat: number; lng: number } | undefined {
  const match = COORDINATES.exec(text);
  if (!match) return undefined;
  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) throw outOfRange();
  return { lat, lng };
}

/** How many matches a location search offers to pick from. */
const MAX_MATCHES = 5;

/** How many times saving a change starts over because the Trip changed meanwhile (see `save`). */
const MAX_SAVE_ATTEMPTS = 5;

function requiredName(name: unknown, message: string): string {
  const trimmed = typeof name === "string" ? name.trim() : "";
  if (!trimmed) throw new ValidationError(message);
  return trimmed;
}

const tripName = (name: unknown) => requiredName(name, "A Trip needs a name.");
const stopName = (name: unknown) => requiredName(name, "A Stop needs a name.");

/** A location sent by the client: coordinates in range and an optional address. */
function stopLocation(value: unknown): StopLocation {
  if (typeof value !== "object" || value === null) throw new ValidationError("Pick a location for the Stop.");
  const { lat, lng, address } = value as Record<string, unknown>;
  if (typeof lat !== "number" || typeof lng !== "number" || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new ValidationError("A location needs a latitude and a longitude.");
  }
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) throw outOfRange();
  if (address !== undefined && address !== null && typeof address !== "string") {
    throw new ValidationError("An address must be text.");
  }
  return { lat, lng, address: address?.trim() || null };
}

const tripNotFound = () => new NotFoundError("No Trip with that id.");
const stopNotFound = () => new NotFoundError("This Trip has no Stop with that id.");

/** The picked Start if it is still one of the Stops, otherwise the oldest Stop. */
function startOf(trip: TripRecord, stops: StopRecord[]): string | null {
  const picked = stops.find((stop) => stop.id === trip.startStopId);
  return (picked ?? stops[0])?.id ?? null;
}

/** The Stops in the saved Route's order; any it doesn't include come last, oldest first. */
function inRouteOrder(stops: StopRecord[], route: SavedRoute | null): StopRecord[] {
  if (!route) return stops;
  const position = new Map(route.stopIds.map((id, i) => [id, i]));
  const last = route.stopIds.length;
  return [...stops].sort((a, b) => (position.get(a.id) ?? last) - (position.get(b.id) ?? last));
}

export function createTripService({ store, geocoder, routing, clock, newId = randomUUID }: TripServiceDeps): TripService {
  async function view(trip: TripRecord): Promise<TripView> {
    const stops = await store.listStops(trip.id);
    return { ...trip, stops: inRouteOrder(stops, trip.route), startStopId: startOf(trip, stops) };
  }

  async function existingTrip(id: string): Promise<TripRecord> {
    const trip = await store.getTrip(id);
    if (!trip) throw tripNotFound();
    return trip;
  }

  /**
   * The Route changes that bring a Trip with these Stops up to date; none if its Route
   * already fits them. If the routing service fails or refuses, the last good Route
   * stays and the error is recorded instead, to be cleared by the next successful one.
   */
  async function routeUpdate(trip: TripRecord, stops: StopRecord[]): Promise<Pick<TripChanges, "route" | "routeError">> {
    if (stops.length < 2) return trip.route || trip.routeError ? { route: null, routeError: null } : {};
    const inputs = { stops, startStopId: startOf(trip, stops)!, roundTrip: trip.roundTrip };
    if (trip.route?.basis === routeBasis(inputs)) return trip.routeError ? { routeError: null } : {};
    try {
      return { route: await calculateRoute(routing, inputs), routeError: null };
    } catch (error) {
      if (!(error instanceof RoutingError)) throw error;
      console.error(`Couldn't update the Route of Trip ${trip.id}:`, error.message);
      return { routeError: error.message };
    }
  }

  /**
   * Saves a change to the Trip (its revision moves), recalculating the Route first if the
   * Stops, their locations, the Start or Round trip no longer match it. The Route is worked
   * out from the Stops as they are now, so earlier changes are included.
   *
   * If someone else saved the Trip while this Route was being worked out, their change
   * may be missing from it, so it is only saved if the revision is still the one it
   * started from; otherwise it starts over (the last attempt saves regardless). This
   * way overlapping changes always end with a Route that includes every Stop.
   */
  async function save(tripId: string, changes: Omit<TripChanges, "updatedAt" | "route" | "routeError"> = {}): Promise<TripView> {
    for (let attempt = 1; ; attempt++) {
      const current = await existingTrip(tripId);
      const stops = await store.listStops(tripId);
      const route = await routeUpdate({ ...current, ...changes }, stops);
      const lastAttempt = attempt === MAX_SAVE_ATTEMPTS;
      const updated = await store.updateTrip(
        tripId,
        { ...changes, ...route, updatedAt: clock() },
        lastAttempt ? undefined : current.revision,
      );
      if (updated) return view(updated);
      if (lastAttempt) throw tripNotFound();
    }
  }

  return {
    async createTrip(name) {
      const validName = tripName(name);
      const now = clock();
      const trip: TripRecord = {
        id: newId(),
        name: validName,
        createdAt: now,
        updatedAt: now,
        revision: 1,
        startStopId: null,
        roundTrip: false,
        route: null,
        routeError: null,
      };
      await store.insertTrip(trip);
      return view(trip);
    },

    async listTrips() {
      const trips = await store.listTrips();
      return trips.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    },

    async getTrip(id) {
      return view(await existingTrip(id));
    },

    async getRevision(id) {
      const revision = await store.getRevision(id);
      if (revision === undefined) throw tripNotFound();
      return revision;
    },

    async changeTrip(id, { name, roundTrip }) {
      if (name === undefined && roundTrip === undefined) {
        throw new ValidationError("Give the Trip a new name, or turn Round trip on or off.");
      }
      if (roundTrip !== undefined && typeof roundTrip !== "boolean") {
        throw new ValidationError("Round trip is either on (true) or off (false).");
      }
      return save(id, { ...(name !== undefined && { name: tripName(name) }), ...(roundTrip !== undefined && { roundTrip }) });
    },

    async deleteTrip(id) {
      if (!(await store.deleteTrip(id))) throw tripNotFound();
    },

    async searchLocations(query) {
      const text = typeof query === "string" ? query.trim() : "";
      if (!text) throw new ValidationError("Type an address or coordinates to search for.");
      const coordinates = parseCoordinates(text);
      if (coordinates) {
        const address = await geocoder.streetAddressAt(coordinates.lat, coordinates.lng);
        return [{ label: address ?? `${coordinates.lat}, ${coordinates.lng}`, address, ...coordinates }];
      }
      const matches = await geocoder.search(text);
      return matches.slice(0, MAX_MATCHES);
    },

    async addStop(tripId, name, location) {
      const stop: StopRecord = {
        id: newId(),
        tripId,
        name: stopName(name),
        ...stopLocation(location),
        createdAt: clock(),
      };
      await existingTrip(tripId);
      await store.insertStop(stop);
      return save(tripId);
    },
  
    async changeStop(tripId, stopId, { name, location }) {
      if (name === undefined && location === undefined) {
        throw new ValidationError("Give the Stop a new name or a new location.");
      }
      const changes = {
        ...(name !== undefined && { name: stopName(name) }),
        ...(location !== undefined && { location: stopLocation(location) }),
      };
      if (!(await store.updateStop(tripId, stopId, changes))) {
        await existingTrip(tripId);
        throw stopNotFound();
      }
      return save(tripId);
    },
  
    async removeStop(tripId, stopId) {
      const trip = await existingTrip(tripId);
      if (!(await store.deleteStop(tripId, stopId))) throw stopNotFound();
      // Forgetting a removed Start lets the oldest remaining Stop take over (see startOf).
      return save(tripId, trip.startStopId === stopId ? { startStopId: null } : {});
    },

    async makeStart(tripId, stopId) {
      if (typeof stopId !== "string" || !stopId) throw new ValidationError("Say which Stop should be the Start.");
      await existingTrip(tripId);
      const stops = await store.listStops(tripId);
      if (!stops.some((stop) => stop.id === stopId)) throw stopNotFound();
      return save(tripId, { startStopId: stopId });
    },
  };
}
