import type { StopRecord, TripRecord, TripStore } from "./tripStore.js";

/** A Trip store that lives in process memory. Used by tests and by local dev without a database. */
export function createMemoryTripStore(): TripStore {
  const trips = new Map<string, TripRecord>();
  /** In insertion order, which is oldest first. */
  const stops = new Map<string, StopRecord>();

  const tripStop = (tripId: string, stopId: string) => {
    const stop = stops.get(stopId);
    return stop?.tripId === tripId ? stop : undefined;
  };

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
      for (const stop of stops.values()) if (stop.tripId === id) stops.delete(stop.id);
      return trips.delete(id);
    },

    async insertStop(stop) {
      if (!trips.has(stop.tripId)) throw new Error(`No Trip ${stop.tripId} to add a Stop to.`);
      stops.set(stop.id, { ...stop });
    },
    async listStops(tripId) {
      return [...stops.values()].filter((stop) => stop.tripId === tripId).map((stop) => ({ ...stop }));
    },
    async updateStop(tripId, stopId, { name, location }) {
      const stop = tripStop(tripId, stopId);
      if (!stop) return undefined;
      const updated: StopRecord = { ...stop, ...(name !== undefined && { name }), ...location };
      stops.set(stopId, updated);
      return { ...updated };
    },
    async deleteStop(tripId, stopId) {
      return tripStop(tripId, stopId) ? stops.delete(stopId) : false;
    },
  };
}
