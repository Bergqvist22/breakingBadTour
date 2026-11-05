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
  /** Whether the Route returns to the Start. */
  roundTrip: boolean;
  /** The last successfully calculated Route, or null if there is none. */
  route: SavedRoute | null;
  /**
   * Why the Route couldn't be brought up to date after the last change that needed it
   * (the saved Route is then the last good one), or null if it is up to date.
   */
  routeError: string | null;
}

/** The drive between two consecutive Stops of a Route. */
export interface SavedLeg {
  fromStopId: string;
  toStopId: string;
  distanceMeters: number;
  durationSeconds: number;
}

/** A Route as it was calculated and saved, so every viewer sees the same one. */
export interface SavedRoute {
  /** The Stops in driving order, beginning at the Start. A Round trip's last Leg goes back to the first. */
  stopIds: string[];
  legs: SavedLeg[];
  distanceMeters: number;
  durationSeconds: number;
  /** The line along the roads, as [lat, lng] pairs. */
  line: [number, number][];
  /** What the Route was calculated from (see `routeBasis`), to tell when it is out of date. */
  basis: string;
}

/** A Trip as the start page lists it. */
export interface TripSummaryRecord {
  id: string;
  name: string;
  updatedAt: Date;
  revision: number;
  stopCount: number;
  /** The saved Route's totals, or null if there is none. */
  routeTotals: { distanceMeters: number; durationSeconds: number } | null;
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
  /** A summary of every Trip, in no particular order. */
  listTrips(): Promise<TripSummaryRecord[]>;
  /** The Trip with this id, or undefined if there is none. */
  getTrip(id: string): Promise<TripRecord | undefined>;
  /** Just the Trip's revision (cheap, for polling), or undefined if there is no such Trip. */
  getRevision(id: string): Promise<number | undefined>;
  /**
   * Applies the changes, adds one to the revision and returns the updated Trip,
   * or undefined if there is none. With `ifRevision`, only does so if the Trip's
   * revision is still that one (otherwise returns undefined and changes nothing).
   */
  updateTrip(id: string, changes: TripChanges, ifRevision?: number): Promise<TripRecord | undefined>;
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
  roundTrip?: boolean;
  route?: SavedRoute | null;
  routeError?: string | null;
  updatedAt: Date;
}

/** Fields a Stop update may set. */
export interface StopChanges {
  name?: string;
  location?: StopLocation;
}
