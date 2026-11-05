import { randomUUID } from "node:crypto";
import type { StopLocation, StopRecord, TripRecord, TripStore } from "./store/tripStore.js";
import type { Geocoder } from "./geocoder/geocoder.js";

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

/** A Trip with its Stops (oldest first) and its Start. */
export interface TripView extends TripRecord {
  stops: StopRecord[];
  /** The Start: the picked Stop if it is still there, otherwise the oldest Stop; null without Stops. */
  startStopId: string | null;
}

export interface TripServiceDeps {
  store: TripStore;
  geocoder: Geocoder;
  clock: () => Date;
  newId?: () => string;
}

export interface TripService {
  createTrip(name: unknown): Promise<TripView>;
  /** All Trips, most recently changed first. */
  listTrips(): Promise<TripRecord[]>;
  /** The Trip with this id; throws NotFoundError if there is none. */
  getTrip(id: string): Promise<TripView>;
  /** Gives the Trip a new (non-empty) name; throws NotFoundError if there is no such Trip. */
  renameTrip(id: string, name: unknown): Promise<TripView>;
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

function requiredName(name: unknown, message: string): string {
  const trimmed = typeof name === "string" ? name.trim() : "";
  if (!trimmed) throw new ValidationError(message);
  return trimmed;
}

const tripName = (name: unknown) => requiredName(name, "A Trip needs a name.");
const stopName = (name: unknown) => requiredName(name, "Say my name: a Stop needs a name.");

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

export function createTripService({ store, geocoder, clock, newId = randomUUID }: TripServiceDeps): TripService {
  async function view(trip: TripRecord): Promise<TripView> {
    const stops = await store.listStops(trip.id);
    return { ...trip, stops, startStopId: startOf(trip, stops) };
  }

  async function existingTrip(id: string): Promise<TripRecord> {
    const trip = await store.getTrip(id);
    if (!trip) throw tripNotFound();
    return trip;
  }

  /** Records that the Trip changed (its revision moves) and returns the updated Trip. */
  async function touch(tripId: string, changes: Omit<Parameters<TripStore["updateTrip"]>[1], "updatedAt"> = {}) {
    const trip = await store.updateTrip(tripId, { ...changes, updatedAt: clock() });
    if (!trip) throw tripNotFound();
    return view(trip);
  }

  return {
    async createTrip(name) {
      const validName = tripName(name);
      const now = clock();
      const trip: TripRecord = { id: newId(), name: validName, createdAt: now, updatedAt: now, revision: 1, startStopId: null };
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

    async renameTrip(id, name) {
      return touch(id, { name: tripName(name) });
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
      return touch(tripId);
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
      return touch(tripId);
    },
  
    async removeStop(tripId, stopId) {
      const trip = await existingTrip(tripId);
      if (!(await store.deleteStop(tripId, stopId))) throw stopNotFound();
      // Forgetting a removed Start lets the oldest remaining Stop take over (see startOf).
      return touch(tripId, trip.startStopId === stopId ? { startStopId: null } : {});
    },

    async makeStart(tripId, stopId) {
      if (typeof stopId !== "string" || !stopId) throw new ValidationError("Say which Stop should be the Start.");
      await existingTrip(tripId);
      const stops = await store.listStops(tripId);
      if (!stops.some((stop) => stop.id === stopId)) throw stopNotFound();
      return touch(tripId, { startStopId: stopId });
    },
  };
}
