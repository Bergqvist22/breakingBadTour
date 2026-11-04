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
    async getTrip(id) {
      const trip = trips.get(id);
      return trip && { ...trip };
    },
    async updateTrip(id, changes) {
      const trip = trips.get(id);
      if (!trip) return undefined;
      const updated: TripRecord = { ...trip, ...changes, revision: trip.revision + 1 };
      trips.set(id, updated);
      return { ...updated };
    },
    async deleteTrip(id) {
      return trips.delete(id);
    },
  };
}
