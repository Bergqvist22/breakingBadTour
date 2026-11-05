import { createHash } from "node:crypto";
import type { SavedRoute, StopRecord } from "../store/tripStore.js";
import { planOrder } from "./routePlanner.js";
import type { RoutingProvider } from "./routingProvider.js";

/** What a Route is calculated from. */
export interface RouteInputs {
  /** At least two. */
  stops: StopRecord[];
  startStopId: string;
  roundTrip: boolean;
}

/**
 * A fingerprint of the Route's inputs: the Stops, where they are, the Start and Round trip.
 * A saved Route whose basis differs from the Trip's current one is out of date.
 */
export function routeBasis({ stops, startStopId, roundTrip }: RouteInputs): string {
  const hash = createHash("sha256");
  hash.update(JSON.stringify({ startStopId, roundTrip, stops: stops.map((stop) => [stop.id, stop.lat, stop.lng]) }));
  return hash.digest("base64url");
}

/**
 * Works out the optimised Route through the Stops from the Start, along roads, returning
 * to the Start for a Round trip. Throws RoutingError if the routing service fails or refuses.
 */
export async function calculateRoute(routing: RoutingProvider, inputs: RouteInputs): Promise<SavedRoute> {
  const { stops, startStopId, roundTrip } = inputs;
  const points = stops.map(({ lat, lng }) => ({ lat, lng }));
  const start = stops.findIndex((stop) => stop.id === startStopId);
  // With one Stop besides the Start there is only one order, so no need to ask for travel times.
  const order =
    stops.length === 2 ? [start, 1 - start] : planOrder((await routing.matrix(points)).durationsSeconds, start, roundTrip);
  const ordered = order.map((i) => stops[i]);
  if (roundTrip) ordered.push(stops[start]);

  const road = await routing.route(ordered.map(({ lat, lng }) => ({ lat, lng })));
  const legs = road.legs.map((leg, i) => ({
    fromStopId: ordered[i].id,
    toStopId: ordered[i + 1].id,
    distanceMeters: leg.distanceMeters,
    durationSeconds: leg.durationSeconds,
  }));
  return {
    stopIds: order.map((i) => stops[i].id),
    legs,
    distanceMeters: legs.reduce((sum, leg) => sum + leg.distanceMeters, 0),
    durationSeconds: legs.reduce((sum, leg) => sum + leg.durationSeconds, 0),
    line: road.line,
    basis: routeBasis(inputs),
  };
}
