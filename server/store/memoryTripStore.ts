import type { TripRecord, TripStore } from "./tripStore.js";

/** A Trip store that lives in process memory. Used by tests and by local dev without a database. */
export function createMemoryTripStore(): TripStore {
  const trips = new Map<string, TripRecord>();

  return {
    async insertTrip(trip) {
      trips.set(trip.id, { ...trip });
    },
    async listTrips() {
      return [...trips.values()].map((trip) => ({ ...trip }));
    },
  };
}
