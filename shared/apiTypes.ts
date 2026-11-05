/** JSON shapes exchanged between the web app and the Trip API. */

/** A Trip as the start page lists it. */
export interface TripSummaryDto {
  id: string;
  name: string;
  /** ISO 8601 timestamp of the last change. */
  updatedAt: string;
  /** Goes up on every change to the Trip or its Stops; compare it to tell whether anything changed. */
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
  /** In the order they were added (oldest first). */
  stops: StopDto[];
  /** The Stop the Route begins at; null when the Trip has no Stops. */
  startStopId: string | null;
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
