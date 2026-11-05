import { describe, expect, it } from "vitest";
import { createFakeRoutingProvider, type FakeRoutingProvider, type FakeTravel } from "./testing/fakeRoutingProvider.js";
import { createTestApi, type TestApiOptions } from "./testing/testApi.js";

// The fake routing provider's toy map: one degree is one kilometre and takes
// one minute, in a straight line. Stops on the equator at longitude `km` are
// `km` kilometres east of the origin.
const at = (km: number, kmNorth = 0) => ({ lat: kmNorth, lng: km, address: null });

interface TripBody {
  stops: { id: string; name: string }[];
  route: { stopIds: string[] } | null;
}

/** The Stop names of a Trip as listed (Route order). */
const names = (trip: TripBody) => trip.stops.map((stop) => stop.name);

/** The id of the Trip's Stop with this name. */
const idOf = (trip: TripBody, name: string) => {
  const stop = trip.stops.find((candidate) => candidate.name === name);
  if (!stop) throw new Error(`No Stop named ${name} in ${names(trip).join(", ")}`);
  return stop.id;
};

async function tripWithApi(options: TestApiOptions & { routing?: FakeRoutingProvider } = {}) {
  const routing = options.routing ?? createFakeRoutingProvider();
  const api = createTestApi({ ...options, routing });
  const trip = await api.post("/api/trips", { name: "Albuquerque weekend" });
  const tripPath = `/api/trips/${trip.body.id}`;
  const addStop = (name: string, location: object) => api.post(`${tripPath}/stops`, { name, location });
  return { api, routing, tripPath, addStop };
}

describe("Trip API: the Route", () => {
  it("drives from the Start to the other Stop of a two-Stop Trip, with its Leg and totals", async () => {
    const { addStop } = await tripWithApi();
    await addStop("Walt's house", at(0));

    const added = await addStop("Car wash", at(3));

    const walts = idOf(added.body, "Walt's house");
    const carWash = idOf(added.body, "Car wash");
    expect(added.status).toBe(201);
    expect(added.body.route).toEqual({
      stopIds: [walts, carWash],
      legs: [{ fromStopId: walts, toStopId: carWash, distanceMeters: 3000, durationSeconds: 180 }],
      distanceMeters: 3000,
      durationSeconds: 180,
      line: [
        [0, 0],
        [0, 3],
      ],
    });
  });
});

describe("Trip API: the optimised order", () => {
  it("lists the Stops in the order that drives the least time from the Start, with Legs and totals that add up", async () => {
    // Driving to the nearest Stop first (1 km east) would make the Route 1 + 3 + 7 = 11 km.
    const { addStop } = await tripWithApi();
    await addStop("Start", at(0));
    await addStop("1 km east", at(1));
    await addStop("2 km west", at(-2));

    const added = await addStop("5 km east", at(5));

    expect(names(added.body)).toEqual(["Start", "2 km west", "1 km east", "5 km east"]);
    expect(added.body.route.stopIds).toEqual(added.body.stops.map((stop: { id: string }) => stop.id));
    const id = (name: string) => idOf(added.body, name);
    expect(added.body.route.legs).toEqual([
      { fromStopId: id("Start"), toStopId: id("2 km west"), distanceMeters: 2000, durationSeconds: 120 },
      { fromStopId: id("2 km west"), toStopId: id("1 km east"), distanceMeters: 3000, durationSeconds: 180 },
      { fromStopId: id("1 km east"), toStopId: id("5 km east"), distanceMeters: 4000, durationSeconds: 240 },
    ]);
    expect(added.body.route).toMatchObject({ distanceMeters: 9000, durationSeconds: 540 });
  });

  it("always begins at the Start, even in the middle, and reorders when another Stop is made the Start", async () => {
    const { api, tripPath, addStop } = await tripWithApi();
    await addStop("West end", at(0));
    await addStop("Middle", at(4));
    const added = await addStop("East end", at(10));

    const made = await api.send("PUT", `${tripPath}/start`, { stopId: idOf(added.body, "Middle") });

    expect(names(added.body)).toEqual(["West end", "Middle", "East end"]);
    // From the middle, the nearer end first: 4 + 10 km beats 6 + 10 km.
    expect(names(made.body)).toEqual(["Middle", "West end", "East end"]);
    expect(made.body.route).toMatchObject({ distanceMeters: 14_000, durationSeconds: 840 });
    expect((await api.get(tripPath)).body).toEqual(made.body);
  });

  it("reorders when a Stop moves to a new location", async () => {
    const { api, tripPath, addStop } = await tripWithApi();
    await addStop("Start", at(0));
    await addStop("Jesse's", at(2));
    const added = await addStop("Car wash", at(5));

    const moved = await api.patch(`${tripPath}/stops/${idOf(added.body, "Jesse's")}`, { location: at(8) });

    expect(names(added.body)).toEqual(["Start", "Jesse's", "Car wash"]);
    expect(names(moved.body)).toEqual(["Start", "Car wash", "Jesse's"]);
    expect(moved.body.route).toMatchObject({ distanceMeters: 8000, durationSeconds: 480 });
  });

  it("reorders when a Stop is removed", async () => {
    const { api, tripPath, addStop } = await tripWithApi();
    await addStop("Start", at(0));
    await addStop("2 km west", at(-2));
    await addStop("1 km east", at(1));
    const added = await addStop("4 km east", at(4));

    const removed = await api.delete(`${tripPath}/stops/${idOf(added.body, "4 km east")}`);

    // West first while the far east end is on the Route (2 + 3 + 3 km), east first without it (1 + 3 km).
    expect(names(added.body)).toEqual(["Start", "2 km west", "1 km east", "4 km east"]);
    expect(names(removed.body)).toEqual(["Start", "1 km east", "2 km west"]);
    expect(removed.body.route).toMatchObject({ distanceMeters: 4000, durationSeconds: 240 });
  });
});

describe("Trip API: big Trips", () => {
  /** Adds a Stop per point, named by its position, and returns the last response. */
  async function addAll(addStop: (name: string, location: object) => Promise<{ body: any }>, points: [number, number][]) {
    let added;
    for (const [north, east] of points) added = await addStop(`${east},${north}`, at(east, north));
    return added!;
  }

  it("orders 20 Stops along a road sensibly: the nearer end first, then all the way to the far end", async () => {
    const { addStop } = await tripWithApi();
    await addStop("0,0", at(0));
    // 5 km of road to the west and 14 km to the east, added in a jumbled order.
    const kms = [7, -3, 12, 1, -5, 9, 14, 2, -1, 6, 11, -4, 3, 13, 8, -2, 5, 10, 4];

    const added = await addAll(
      addStop,
      kms.map((km) => [0, km]),
    );

    expect(names(added.body)).toEqual(
      [0, -1, -2, -3, -4, -5, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14].map((km) => `${km},0`),
    );
    expect(added.body.route).toMatchObject({ distanceMeters: 24_000, durationSeconds: 1440 });
  });

  // 20 points scattered over 40 × 40 km. The best possible Routes, worked out by trying
  // every order (Held–Karp, outside the app), are 134.059 km one way and 151.529 km as a Round trip.
  const scattered: [number, number][] = [
    [0, 0], [4.9, 6.1], [-9.6, -8], [-4.7, -17], [-8.8, -4.5], [9.5, -3.5], [13.7, -4], [18.1, -14.3], [6.5, 14.7],
    [2.2, -16.7], [-3.2, 5.6], [-19.3, -0.7], [10.1, 8], [11.3, -3.7], [-8, -1.3], [17.1, -19.6], [3.8, -8.5],
    [3.8, -9.3], [-7.4, 14.5], [-0.3, 17.3],
  ];

  it("gets within 1% of the best possible Route for 20 scattered Stops, with and without Round trip", async () => {
    const { api, tripPath, addStop } = await tripWithApi();
    const added = await addAll(addStop, scattered);

    const roundTrip = await api.patch(tripPath, { roundTrip: true });

    expect(added.body.stops[0].name).toBe("0,0");
    expect(added.body.route.distanceMeters).toBeLessThanOrEqual(134_059 * 1.01);
    expect(roundTrip.body.stops[0].name).toBe("0,0");
    expect(roundTrip.body.route.distanceMeters).toBeLessThanOrEqual(151_529 * 1.01);
  });

  it("gives the same Route for the same Stops every time", async () => {
    const first = await tripWithApi();
    const second = await tripWithApi();

    const one = await addAll(first.addStop, scattered);
    const other = await addAll(second.addStop, scattered);

    expect(names(other.body)).toEqual(names(one.body));
  });

  it("orders a 60-Stop Trip sensibly too: there is no Stop limit", async () => {
    const { addStop } = await tripWithApi();
    await addStop("0,0", at(0));
    // 20 km of road to the west and 39 km to the east: odd kilometres east first, then the west, then the rest.
    const east = Array.from({ length: 39 }, (_, i) => i + 1);
    const west = Array.from({ length: 20 }, (_, i) => -20 + i);
    const jumbled = [...east.filter((km) => km % 2), ...west, ...east.filter((km) => !(km % 2))];

    const added = await addAll(
      addStop,
      jumbled.map((km) => [0, km]),
    );

    expect(added.body.stops).toHaveLength(60);
    // The nearer end first: 20 km west, then 20 + 39 km east.
    expect(added.body.route).toMatchObject({ distanceMeters: 79_000, durationSeconds: 79 * 60 });
    expect(added.body.stops.at(-1).name).toBe("39,0");
  });
});

/**
 * A made-up road network between places at longitudes 0, 1, 2, ... on the equator,
 * given as minutes from each place to each other place (one way). Every minute is a kilometre.
 */
function oneWayNetwork(minutes: Record<string, Record<string, number>>, places: string[]): FakeTravel {
  const placeAt = (point: { lng: number }) => places[point.lng];
  return (from, to) => {
    const time = from.lng === to.lng ? 0 : minutes[placeAt(from)][placeAt(to)];
    return { distanceMeters: time * 1000, durationSeconds: time * 60 };
  };
}

describe("Trip API: Round trip", () => {
  // Driving S → A → B → C takes 3 minutes but getting back from C takes 9;
  // as a Round trip, S → B → C → A → S takes 5 + 1 + 2 + 1 = 9 minutes, the least.
  const places = ["S", "A", "B", "C"];
  const minutes = {
    S: { A: 1, B: 5, C: 5 },
    A: { S: 1, B: 1, C: 5 },
    B: { S: 5, A: 5, C: 1 },
    C: { S: 9, A: 2, B: 5 },
  };

  async function tripThroughNetwork() {
    const setup = await tripWithApi({ routing: createFakeRoutingProvider({ travel: oneWayNetwork(minutes, places) }) });
    let added;
    for (const [i, place] of places.entries()) added = await setup.addStop(place, at(i));
    return { ...setup, added: added! };
  }

  it("starts a new Trip with Round trip off", async () => {
    const { api } = await tripWithApi();

    const created = await api.post("/api/trips", { name: "One way" });

    expect(created.body.roundTrip).toBe(false);
  });

  it("returns to the Start when Round trip is turned on, with the Leg back, and stops returning when it is turned off", async () => {
    const { api, tripPath, added } = await tripThroughNetwork();
    const id = (name: string) => idOf(added.body, name);

    const on = await api.patch(tripPath, { roundTrip: true });
    const off = await api.patch(tripPath, { roundTrip: false });

    expect(names(added.body)).toEqual(["S", "A", "B", "C"]);
    expect(added.body.route).toMatchObject({ distanceMeters: 3000, durationSeconds: 180 });

    expect(on.status).toBe(200);
    expect(on.body.roundTrip).toBe(true);
    expect(names(on.body)).toEqual(["S", "B", "C", "A"]);
    expect(on.body.route.legs).toEqual([
      { fromStopId: id("S"), toStopId: id("B"), distanceMeters: 5000, durationSeconds: 300 },
      { fromStopId: id("B"), toStopId: id("C"), distanceMeters: 1000, durationSeconds: 60 },
      { fromStopId: id("C"), toStopId: id("A"), distanceMeters: 2000, durationSeconds: 120 },
      { fromStopId: id("A"), toStopId: id("S"), distanceMeters: 1000, durationSeconds: 60 },
    ]);
    expect(on.body.route).toMatchObject({ distanceMeters: 9000, durationSeconds: 540 });
    expect(on.body.route.line.at(-1)).toEqual(on.body.route.line[0]);
    expect(on.body.revision).toBeGreaterThan(added.body.revision);

    expect(off.body.roundTrip).toBe(false);
    expect(off.body.route).toEqual(added.body.route);
    expect((await api.get(tripPath)).body).toEqual(off.body);
  });

  it("drives back to the Start in a two-Stop Round trip", async () => {
    const { api, tripPath, addStop } = await tripWithApi();
    await addStop("Walt's house", at(0));
    await addStop("Car wash", at(3));

    const on = await api.patch(tripPath, { roundTrip: true });

    expect(on.body.route.legs).toHaveLength(2);
    expect(on.body.route).toMatchObject({ distanceMeters: 6000, durationSeconds: 360 });
  });

  it.each([
    ["text", { roundTrip: "yes" }],
    ["null", { roundTrip: null }],
  ])("rejects a Round trip setting that is %s and keeps the Trip as it was", async (_label, body) => {
    const { api, tripPath, added } = await tripThroughNetwork();

    const changed = await api.patch(tripPath, body);

    expect(changed.status).toBe(400);
    expect(changed.body).toEqual({ error: expect.any(String) });
    expect((await api.get(tripPath)).body).toEqual(added.body);
  });
});

describe("Trip API: when the Route is recalculated", () => {
  it("never recalculates when the Trip is polled or something is only renamed, and keeps the Route", async () => {
    const { api, routing, tripPath, addStop } = await tripWithApi();
    await addStop("Start", at(0));
    await addStop("Jesse's", at(2));
    const added = await addStop("Car wash", at(5));
    const callsSoFar = [...routing.calls];

    await api.get(tripPath);
    await api.get("/api/trips");
    await api.patch(tripPath, { name: "Albuquerque long weekend" });
    const renamed = await api.patch(`${tripPath}/stops/${idOf(added.body, "Jesse's")}`, { name: "Jesse's house" });

    expect(routing.calls).toEqual(callsSoFar);
    expect(renamed.body.route).toEqual(added.body.route);
    expect(names(renamed.body)).toEqual(["Start", "Jesse's house", "Car wash"]);
  });
});

describe("Trip API: Trips on the start page", () => {
  it("lists each Trip with its number of Stops and its Route's total distance and driving time", async () => {
    const { api, addStop } = await tripWithApi();
    const oneStop = await api.post("/api/trips", { name: "One Stop" });
    await api.post(`/api/trips/${oneStop.body.id}/stops`, { name: "Walt's house", location: at(0) });
    await api.post("/api/trips", { name: "Empty" });
    await addStop("Start", at(0));
    await addStop("Jesse's", at(1));
    await addStop("Car wash", at(3));

    const listed = await api.get("/api/trips");

    expect(listed.body.trips).toEqual([
      expect.objectContaining({ name: "Albuquerque weekend", stopCount: 3, route: { distanceMeters: 3000, durationSeconds: 180 } }),
      expect.objectContaining({ name: "Empty", stopCount: 0, route: null }),
      expect.objectContaining({ name: "One Stop", stopCount: 1, route: null }),
    ]);
  });
});

/** Lets every pending step run until each change is either done or waiting on the routing service. */
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("Trip API: changes that overlap", () => {
  it("puts a Stop added while another Stop's Route is still being worked out on the Route too", async () => {
    const { api, routing, tripPath, addStop } = await tripWithApi();
    await addStop("Start", at(0));
    const release = routing.holdNextCall();
    const addingJesse = addStop("Jesse's", at(1));
    await settle();

    // Added and routed while the Route for Jesse's (without the car wash) is still on its way.
    await addStop("Car wash", at(3));
    release();
    const jesse = await addingJesse;

    const final = (await api.get(tripPath)).body;
    expect(names(final)).toEqual(["Start", "Jesse's", "Car wash"]);
    expect(final.route.stopIds).toHaveLength(3);
    expect(final.route).toMatchObject({ distanceMeters: 3000, durationSeconds: 180 });
    expect(jesse.body).toEqual(final);
  });
});

describe("Trip API: when routing fails", () => {
  const outage = "The routing service couldn't be reached.";

  async function tripWithRoute() {
    const setup = await tripWithApi();
    await setup.addStop("Start", at(0));
    const routed = await setup.addStop("Car wash", at(3));
    return { ...setup, routed };
  }

  it("has no error while routing works", async () => {
    const { routed } = await tripWithRoute();

    expect(routed.body.routeError).toBeNull();
  });

  it("still saves the new Stop, keeps the last good Route and reports the error", async () => {
    const { api, routing, tripPath, addStop, routed } = await tripWithRoute();
    routing.failWith(outage);

    const added = await addStop("Jesse's", at(1));

    expect(added.status).toBe(201);
    // The new Stop isn't on the Route yet, so it is listed last.
    expect(names(added.body)).toEqual(["Start", "Car wash", "Jesse's"]);
    expect(added.body.route).toEqual(routed.body.route);
    expect(added.body.routeError).toBe(outage);
    expect(added.body.revision).toBeGreaterThan(routed.body.revision);
    expect((await api.get(tripPath)).body).toEqual(added.body);
  });

  it("keeps the last good Route when a move, a new Start or Round trip can't be routed", async () => {
    const { api, routing, tripPath, routed } = await tripWithRoute();
    routing.failWith(outage);
    const carWash = idOf(routed.body, "Car wash");

    const moved = await api.patch(`${tripPath}/stops/${carWash}`, { location: at(5) });
    const madeStart = await api.send("PUT", `${tripPath}/start`, { stopId: carWash });
    const roundTrip = await api.patch(tripPath, { roundTrip: true });

    for (const changed of [moved, madeStart, roundTrip]) {
      expect(changed.status).toBe(200);
      expect(changed.body.route).toEqual(routed.body.route);
      expect(changed.body.routeError).toBe(outage);
    }
    expect(moved.body.stops.find((stop: { name: string }) => stop.name === "Car wash")).toMatchObject({ lng: 5 });
    expect(madeStart.body.startStopId).toBe(carWash);
    expect(roundTrip.body.roundTrip).toBe(true);
  });

  it("recalculates on the next change once the routing service works again, and clears the error", async () => {
    const { routing, addStop } = await tripWithRoute();
    routing.failWith(outage);
    await addStop("Jesse's", at(1));
    routing.failWith(null);

    const added = await addStop("Hank's", at(2));

    expect(names(added.body)).toEqual(["Start", "Jesse's", "Hank's", "Car wash"]);
    expect(added.body.route).toMatchObject({ distanceMeters: 3000, durationSeconds: 180 });
    expect(added.body.routeError).toBeNull();
  });

  it("reports the error when the first Route can't be worked out", async () => {
    const { routing, addStop } = await tripWithApi();
    await addStop("Start", at(0));
    routing.failWith(outage);

    const added = await addStop("Car wash", at(3));

    expect(added.status).toBe(201);
    expect(names(added.body)).toEqual(["Start", "Car wash"]);
    expect(added.body.route).toBeNull();
    expect(added.body.routeError).toBe(outage);
  });

  it("clears the error when the Trip is down to one Stop", async () => {
    const { api, routing, tripPath, addStop } = await tripWithRoute();
    routing.failWith(outage);
    const added = await addStop("Jesse's", at(1));

    await api.delete(`${tripPath}/stops/${idOf(added.body, "Jesse's")}`);
    const removed = await api.delete(`${tripPath}/stops/${idOf(added.body, "Car wash")}`);

    expect(removed.body).toMatchObject({ route: null, routeError: null });
  });

  it("still adds a Stop when the routing service refuses a Trip that big: there is no Stop limit", async () => {
    const { routing, addStop } = await tripWithApi({ routing: createFakeRoutingProvider({ maxPoints: 3 }) });
    await addStop("Start", at(0));
    await addStop("Jesse's", at(1));
    const routed = await addStop("Car wash", at(3));

    const added = await addStop("Hank's", at(2));

    expect(routing.calls.at(-1)).toBe("matrix:4");
    expect(added.status).toBe(201);
    expect(added.body.stops).toHaveLength(4);
    expect(added.body.route).toEqual(routed.body.route);
    expect(added.body.routeError).toBe("The fake routing service refuses more than 3 Stops.");
  });
});

describe("Trip API: Trips too small for a Route", () => {
  it("has no Route for a Trip with no Stops or one Stop, and asks the routing service nothing", async () => {
    const { api, routing, tripPath, addStop } = await tripWithApi();

    const empty = await api.get(tripPath);
    const oneStop = await addStop("Walt's house", at(0));

    expect(empty.body.route).toBeNull();
    expect(oneStop.body.route).toBeNull();
    expect(routing.calls).toEqual([]);
  });

  it("drops the Route when a Trip is down to one Stop", async () => {
    const { api, tripPath, addStop } = await tripWithApi();
    await addStop("Walt's house", at(0));
    const added = await addStop("Car wash", at(3));

    const removed = await api.delete(`${tripPath}/stops/${idOf(added.body, "Car wash")}`);

    expect(removed.body.route).toBeNull();
    expect((await api.get(tripPath)).body.route).toBeNull();
  });
});
