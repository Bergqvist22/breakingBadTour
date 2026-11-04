import { randomUUID } from "node:crypto";
import type { TripRecord, TripStore } from "./store/tripStore.js";

/** A rule was broken by the caller's input (maps to HTTP 400). */
export class ValidationError extends Error {}

export interface TripServiceDeps {
  store: TripStore;
  clock: () => Date;
  newId?: () => string;
}

export interface TripService {
  createTrip(name: unknown): Promise<TripRecord>;
  /** All Trips, most recently changed first. */
  listTrips(): Promise<TripRecord[]>;
}

export function createTripService({ store, clock, newId = randomUUID }: TripServiceDeps): TripService {
  return {
    async createTrip(name) {
      const trimmed = typeof name === "string" ? name.trim() : "";
      if (!trimmed) throw new ValidationError("A Trip needs a name.");

      const now = clock();
      const trip: TripRecord = { id: newId(), name: trimmed, createdAt: now, updatedAt: now };
      await store.insertTrip(trip);
      return trip;
    },

    async listTrips() {
      const trips = await store.listTrips();
      return trips.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    },
  };
}
