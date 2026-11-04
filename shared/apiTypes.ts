/** JSON shapes exchanged between the web app and the Trip API. */

export interface TripDto {
  id: string;
  name: string;
  /** ISO 8601 timestamp of the last change. */
  updatedAt: string;
  /** Goes up on every change to the Trip; compare it to tell whether anything changed. */
  revision: number;
}

export interface TripListDto {
  /** Most recently changed first. */
  trips: TripDto[];
}

export interface ErrorDto {
  error: string;
}
