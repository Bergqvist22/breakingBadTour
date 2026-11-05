/** A Trip as it is persisted. */
export interface TripRecord {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
  /** Starts at 1 and goes up by one on every change, so pollers can tell when anything changed. */
  revision: number;
  /**
   * The Stop picked as the Start, or null if none was picked. May name a Stop that has
   * since been removed; the Trip service then falls back to the oldest Stop.
   */
  startStopId: string | null;
}

/** A Stop as it is persisted. */
export interface StopRecord {
  id: string;
  tripId: string;
  name: string;
  lat: number;
  lng: number;
  /** The street address (or picked place's address), or null when the spot has none. */
  address: string | null;
  createdAt: Date;
}

export interface StopLocation {
  lat: number;
  lng: number;
  address: string | null;
}

/**
 * Persistence for Trips and their Stops. Implementations only store and fetch;
 * the rules (validation, ordering, timestamps, the Start) live in the Trip
 * service. The one thing a store does on its own is bump the revision on every
 * Trip update, atomically, so concurrent changes can never share a revision.
 * Deleting a Trip deletes its Stops.
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
  /** Removes the Trip and its Stops; returns false if there was none. */
  deleteTrip(id: string): Promise<boolean>;

  insertStop(stop: StopRecord): Promise<void>;
  /** The Trip's Stops, oldest first. */
  listStops(tripId: string): Promise<StopRecord[]>;
  /** Applies the changes to the Trip's Stop and returns it, or undefined if the Trip has no such Stop. */
  updateStop(tripId: string, stopId: string, changes: StopChanges): Promise<StopRecord | undefined>;
  /** Removes the Trip's Stop; returns false if the Trip has no such Stop. */
  deleteStop(tripId: string, stopId: string): Promise<boolean>;
}

/**
 * Fields a Trip update may set. `updatedAt` is required: every change is a change.
 * Changes to a Trip's Stops call `updateTrip` with at least `updatedAt` so the
 * Trip's revision moves too.
 */
export interface TripChanges {
  name?: string;
  /** Set (or with null, clear) the picked Start. Left out, the Start is unchanged. */
  startStopId?: string | null;
  updatedAt: Date;
}

/** Fields a Stop update may set. */
export interface StopChanges {
  name?: string;
  location?: StopLocation;
}
