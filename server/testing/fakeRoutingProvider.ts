import { RoutingError, type RoadLeg, type RoutePoint, type RoutingProvider } from "../routing/routingProvider.js";

/** The drive from one point to another, in the fake's made-up road network. */
export type FakeTravel = (from: RoutePoint, to: RoutePoint) => RoadLeg;

/**
 * A toy flat map: one degree is one kilometre, in a straight line, at 60 km/h,
 * so one degree takes 60 seconds. The same either way.
 */
export const straightLines: FakeTravel = (from, to) => {
  const km = Math.hypot(to.lat - from.lat, to.lng - from.lng);
  return { distanceMeters: km * 1000, durationSeconds: km * 60 };
};

export interface FakeRoutingOptions {
  /** How long and how far each drive is. Defaults to straight lines on a toy flat map. */
  travel?: FakeTravel;
  /** Refuse requests with more points than this, like the public OSRM server does past 100. */
  maxPoints?: number;
}

/**
 * A routing provider with a made-up road network: travel times and distances
 * come from `travel`, and the line along the roads just joins the points.
 * It can be made to fail, and a call can be held back to test overlapping changes.
 */
export function createFakeRoutingProvider({ travel = straightLines, maxPoints = Infinity }: FakeRoutingOptions = {}) {
  let failure: string | null = null;
  let hold: Promise<void> | null = null;
  const calls: string[] = [];

  async function call(kind: string, points: RoutePoint[]) {
    calls.push(`${kind}:${points.length}`);
    if (hold) {
      const held = hold;
      hold = null;
      await held;
    }
    if (failure) throw new RoutingError(failure);
    if (points.length < 2) throw new Error(`The fake routing provider got ${points.length} point(s); it needs at least two.`);
    if (points.length > maxPoints) throw new RoutingError(`The fake routing service refuses more than ${maxPoints} Stops.`);
  }

  const provider: RoutingProvider & {
    /** Every call so far, as "matrix:<points>" or "route:<points>". */
    calls: string[];
    /** Makes every call fail with this message, or with null, work again. */
    failWith(message: string | null): void;
    /** Holds the next call back until the returned function is called. */
    holdNextCall(): () => void;
  } = {
    async matrix(points) {
      await call("matrix", points);
      const legs = points.map((from) => points.map((to) => travel(from, to)));
      return {
        durationsSeconds: legs.map((row) => row.map((leg) => leg.durationSeconds)),
        distancesMeters: legs.map((row) => row.map((leg) => leg.distanceMeters)),
      };
    },
    async route(points) {
      await call("route", points);
      return {
        legs: points.slice(1).map((to, i) => travel(points[i], to)),
        line: points.map((point): [number, number] => [point.lat, point.lng]),
      };
    },
    calls,
    failWith(message) {
      failure = message;
    },
    holdNextCall() {
      let release!: () => void;
      hold = new Promise((resolve) => (release = resolve));
      return release;
    },
  };
  return provider;
}

export type FakeRoutingProvider = ReturnType<typeof createFakeRoutingProvider>;
