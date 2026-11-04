/** A Trip as it is persisted. */
export interface TripRecord {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  /** Starts at 1 and goes up by one on every change, so pollers can tell when anything changed. */
  revision: number;
}

/**
 * Persistence for Trips. Implementations only store and fetch; the rules
 * (validation, ordering, timestamps) live in the Trip service. The one thing
 * a store does on its own is bump the revision on every update, atomically,
 * so concurrent changes can never share a revision.
 */
export interface TripStore {
  insertTrip(trip: TripRecord): Promise<void>;
  /** All Trips, in no particular order. */
  listTrips(): Promise<TripRecord[]>;
  /** The Trip with this id, or undefined if there is none. */
  getTrip(id: string): Promise<TripRecord | undefined>;
  /**
   * Applies the changes, adds one to the revision and returns the updated Trip,
   * or undefined if there is none.
   */
  updateTrip(id: string, changes: TripChanges): Promise<TripRecord | undefined>;
  /** Removes the Trip; returns false if there was none. */
  deleteTrip(id: string): Promise<boolean>;
}

/**
 * Fields a Trip update may set. `updatedAt` is required: every change is a change.
 * Later changes to a Trip's Stops should call `updateTrip` with just `updatedAt`
 * so the Trip's revision moves too.
 */
export interface TripChanges {
  name?: string;
  updatedAt: Date;
}
