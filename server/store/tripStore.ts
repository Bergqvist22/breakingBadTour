/** A Trip as it is persisted. */
export interface TripRecord {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Persistence for Trips. Implementations only store and fetch; the rules
 * (validation, ordering, timestamps) live in the Trip service.
 */
export interface TripStore {
  insertTrip(trip: TripRecord): Promise<void>;
  /** All Trips, in no particular order. */
  listTrips(): Promise<TripRecord[]>;
}
