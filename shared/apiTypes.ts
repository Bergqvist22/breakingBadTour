/** JSON shapes exchanged between the web app and the Trip API. */

/** A Trip as the start page lists it. */
export interface TripSummaryDto {
  id: string;
  name: string;
  /** ISO 8601 timestamp of the last change. */
  updatedAt: string;
  /** Goes up on every change to the Trip or its Stops; compare it to tell whether anything changed. */
  revision: number;
  stopCount: number;
  /** The optimised Route's totals; null with fewer than two Stops. */
  route: RouteTotalsDto | null;
}

/** Total driving distance and time of a Route. */
export interface RouteTotalsDto {
  distanceMeters: number;
  durationSeconds: number;
}

/** Just a Trip's revision: what an open Trip page polls, fetching the whole Trip only when it moved. */
export interface TripRevisionDto {
  revision: number;
}

export interface TripListDto {
  /** Most recently changed first. */
  trips: TripSummaryDto[];
}

/** One location in a Trip. */
export interface StopDto {
  id: string;
  name: string;
  /** The street address, or null when the spot has none. */
  address: string | null;
  lat: number;
  lng: number;
}

/** A whole Trip, as its page shows it. Every mutating call returns this. */
export interface TripDto extends TripSummaryDto {
  /** In Route order. Stops the Route doesn't include yet (being placed, or routing failed) come last. */
  stops: StopDto[];
  /** The Stop the Route begins at; null when the Trip has no Stops. */
  startStopId: string | null;
  /** Whether the Route returns to the Start. */
  roundTrip: boolean;
  /**
   * The optimised Route through the Stops; null with fewer than two Stops. When `routeError`
   * is set, this is the last good Route, which may not include every Stop.
   */
  route: RouteDto | null;
  /** Why the Route couldn't be updated after the last change, or null when it is up to date. */
  routeError: string | null;
}

/** The drive between two consecutive Stops. */
export interface LegDto {
  fromStopId: string;
  toStopId: string;
  distanceMeters: number;
  durationSeconds: number;
}

/** The order the Stops are driven in, with every Leg, the totals and the line along the roads. */
export interface RouteDto extends RouteTotalsDto {
  /** Driving order, beginning at the Start. A Round trip's last Leg goes back to the first. */
  stopIds: string[];
  /** One per consecutive pair of `stopIds`, plus the way back to the Start for a Round trip. */
  legs: LegDto[];
  /** [lat, lng] pairs along the roads. */
  line: [number, number][];
}

/** A place to pick when adding or moving a Stop; send it back as the Stop's `location`. */
export interface LocationDto {
  /** What to show in the pick list. */
  label: string;
  /** The address the Stop will keep, or null when the spot has no street address. */
  address: string | null;
  lat: number;
  lng: number;
}

export interface LocationSearchDto {
  /** Up to 5, best first; empty when nothing was found. */
  matches: LocationDto[];
}

export interface ErrorDto {
  error: string;
}
