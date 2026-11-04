import { randomUUID } from "node:crypto";
import type { TripRecord, TripStore } from "./store/tripStore.js";

/** A rule was broken by the caller's input (maps to HTTP 400). */
export class ValidationError extends Error {}

/** The thing the caller asked for doesn't exist (maps to HTTP 404). */
export class NotFoundError extends Error {}

export interface TripServiceDeps {
  store: TripStore;
  clock: () => Date;
  newId?: () => string;
}

export interface TripService {
  createTrip(name: unknown): Promise<TripRecord>;
  /** All Trips, most recently changed first. */
  listTrips(): Promise<TripRecord[]>;
  /** The Trip with this id; throws NotFoundError if there is none. */
  getTrip(id: string): Promise<TripRecord>;
  /** Gives the Trip a new (non-empty) name; throws NotFoundError if there is no such Trip. */
  renameTrip(id: string, name: unknown): Promise<TripRecord>;
  /** Deletes the Trip; throws NotFoundError if there is no such Trip. */
  deleteTrip(id: string): Promise<void>;
}

function tripName(name: unknown): string {
  const trimmed = typeof name === "string" ? name.trim() : "";
  if (!trimmed) throw new ValidationError("A Trip needs a name.");
  return trimmed;
}

const tripNotFound = () => new NotFoundError("No Trip with that id.");

export function createTripService({ store, clock, newId = randomUUID }: TripServiceDeps): TripService {
  return {
    async createTrip(name) {
      const validName = tripName(name);
      const now = clock();
      const trip: TripRecord = { id: newId(), name: validName, createdAt: now, updatedAt: now, revision: 1 };
      await store.insertTrip(trip);
      return trip;
    },

    async listTrips() {
      const trips = await store.listTrips();
      return trips.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    },

    async getTrip(id) {
      const trip = await store.getTrip(id);
      if (!trip) throw tripNotFound();
      return trip;
    },

    async renameTrip(id, name) {
      const validName = tripName(name);
      const trip = await store.updateTrip(id, { name: validName, updatedAt: clock() });
      if (!trip) throw tripNotFound();
      return trip;
    },

    async deleteTrip(id) {
      if (!(await store.deleteTrip(id))) throw tripNotFound();
    },
  };
}
