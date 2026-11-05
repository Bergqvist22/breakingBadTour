/** A spot to drive to or from. */
export interface RoutePoint {
  lat: number;
  lng: number;
}

/**
 * Driving times and distances between every pair of points, by car.
 * `durationsSeconds[i][j]` is the time from point i to point j, which need not
 * equal the time from j to i (one-way streets, turns).
 */
export interface TravelMatrix {
  durationsSeconds: number[][];
  distancesMeters: number[][];
}

/** The drive between two consecutive points of a road route. */
export interface RoadLeg {
  distanceMeters: number;
  durationSeconds: number;
}

/** The drive along roads through points in a given order. */
export interface RoadRoute {
  /** One per consecutive pair of points: N points give N - 1 legs. */
  legs: RoadLeg[];
  /** The line along the roads, as [lat, lng] pairs. */
  line: [number, number][];
}

/**
 * Car routing over a road network. The real one talks to the public OSRM
 * service; tests use a fake. Both capabilities need at least two points.
 */
export interface RoutingProvider {
  /** Times and distances between every pair of points. Throws RoutingError if any pair has no road between them. */
  matrix(points: RoutePoint[]): Promise<TravelMatrix>;
  /** The road route visiting the points in this order. */
  route(points: RoutePoint[]): Promise<RoadRoute>;
}

/**
 * The routing service failed or refused (unreachable, overloaded, too many
 * points, no road between the points). The message is fit to show a user.
 */
export class RoutingError extends Error {}
