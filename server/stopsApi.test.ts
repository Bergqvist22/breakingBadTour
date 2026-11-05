import { describe, expect, it } from "vitest";
import { createFakeGeocoder, type FakePlace } from "./testing/fakeGeocoder.js";
import { createTestApi } from "./testing/testApi.js";

const waltsHouse: FakePlace = {
  label: "3828, Piermont Drive Northeast, Albuquerque, Bernalillo County, New Mexico, 87191, United States",
  address: "3828 Piermont Drive Northeast, Albuquerque, New Mexico 87191",
  lat: 35.1261262,
  lng: -106.5365521,
};

const albuquerqueNm: FakePlace = {
  label: "Albuquerque, Bernalillo County, New Mexico, United States",
  address: "Albuquerque, Bernalillo County, New Mexico, United States",
  lat: 35.0841034,
  lng: -106.650985,
};

const albuquerqueSpain: FakePlace = {
  label: "Alburquerque, Badajoz, Extremadura, España",
  address: "Alburquerque, Badajoz, Extremadura, España",
  lat: 39.2125,
  lng: -6.9931,
};

describe("Trip API: searching for a location", () => {
  it("returns the matches for an address", async () => {
    const geocoder = createFakeGeocoder({ places: { Albuquerque: [albuquerqueNm, albuquerqueSpain] } });
    const api = createTestApi({ geocoder });

    const found = await api.post("/api/locations/search", { query: "Albuquerque" });

    expect(found.status).toBe(200);
    expect(found.body).toEqual({ matches: [albuquerqueNm, albuquerqueSpain] });
  });

  it("returns at most 5 matches", async () => {
    const many = Array.from({ length: 7 }, (_, i) => ({ ...albuquerqueNm, label: `Albuquerque ${i + 1}` }));
    const api = createTestApi({ geocoder: createFakeGeocoder({ places: { Albuquerque: many } }) });

    const found = await api.post("/api/locations/search", { query: "Albuquerque" });

    expect(found.body.matches.map((match: FakePlace) => match.label)).toEqual([
      "Albuquerque 1",
      "Albuquerque 2",
      "Albuquerque 3",
      "Albuquerque 4",
      "Albuquerque 5",
    ]);
  });

  it("returns no matches when nothing is found", async () => {
    const api = createTestApi({ geocoder: createFakeGeocoder() });

    const found = await api.post("/api/locations/search", { query: "Nowhere at all" });

    expect(found.status).toBe(200);
    expect(found.body).toEqual({ matches: [] });
  });

  it.each([
    ["an empty query", { query: "" }],
    ["a blank query", { query: "   " }],
    ["no query", {}],
    ["no body", undefined],
  ])("rejects %s without asking the geocoder", async (_label, body) => {
    const geocoder = createFakeGeocoder();
    const api = createTestApi({ geocoder });

    const found = await api.post("/api/locations/search", body);

    expect(found.status).toBe(400);
    expect(found.body).toEqual({ error: expect.any(String) });
    expect(geocoder.lookups).toEqual([]);
  });

  it("searches for the query without surrounding whitespace", async () => {
    const api = createTestApi({ geocoder: createFakeGeocoder({ places: { Albuquerque: [albuquerqueNm] } }) });

    const found = await api.post("/api/locations/search", { query: "  Albuquerque " });

    expect(found.body).toEqual({ matches: [albuquerqueNm] });
  });

  it("uses typed coordinates as typed and looks up the street address there", async () => {
    const geocoder = createFakeGeocoder({
      streetAddresses: { "35.1258,-106.5361": "3829 Espejo Street Northeast, Albuquerque, New Mexico 87111" },
    });
    const api = createTestApi({ geocoder });

    const found = await api.post("/api/locations/search", { query: "35.1258, -106.5361" });

    expect(found.status).toBe(200);
    expect(found.body).toEqual({
      matches: [
        {
          label: "3829 Espejo Street Northeast, Albuquerque, New Mexico 87111",
          address: "3829 Espejo Street Northeast, Albuquerque, New Mexico 87111",
          lat: 35.1258,
          lng: -106.5361,
        },
      ],
    });
    expect(geocoder.lookups).toEqual(["reverse:35.1258,-106.5361"]);
  });

  it("gives typed coordinates with no street address no address", async () => {
    const api = createTestApi({ geocoder: createFakeGeocoder() });

    const found = await api.post("/api/locations/search", { query: "34.4,-107.2" });

    expect(found.body).toEqual({ matches: [{ label: "34.4, -107.2", address: null, lat: 34.4, lng: -107.2 }] });
  });

  it.each(["35.1258 -106.5361", " -33.8688 , 151.2093 ", "35,-106"])("recognises %j as coordinates", async (query) => {
    const geocoder = createFakeGeocoder();
    const api = createTestApi({ geocoder });

    const found = await api.post("/api/locations/search", { query });

    expect(found.body.matches).toHaveLength(1);
    expect(geocoder.lookups).toEqual([expect.stringMatching(/^reverse:/)]);
  });

  it.each(["95, 10", "10, 181"])("rejects coordinates out of range (%j)", async (query) => {
    const geocoder = createFakeGeocoder();
    const api = createTestApi({ geocoder });

    const found = await api.post("/api/locations/search", { query });

    expect(found.status).toBe(400);
    expect(found.body).toEqual({ error: expect.any(String) });
    expect(geocoder.lookups).toEqual([]);
  });

  it.each(["Albuquerque", "35.1258, -106.5361"])("answers 502 with a clear message when the lookup service fails (%j)", async (query) => {
    const geocoder = createFakeGeocoder({ places: { Albuquerque: [albuquerqueNm] } });
    geocoder.failWith(true);
    const api = createTestApi({ geocoder });

    const found = await api.post("/api/locations/search", { query });

    expect(found.status).toBe(502);
    expect(found.body).toEqual({ error: expect.stringMatching(/lookup/i) });
  });
});

const espejo = { lat: 35.1258, lng: -106.5361, address: "3829 Espejo Street Northeast, Albuquerque, New Mexico 87111" };
const desert = { lat: 34.4, lng: -107.2, address: null };
const carWash = { lat: 35.1084, lng: -106.5803, address: "9516 Lomas Boulevard Northeast, Albuquerque, New Mexico 87112" };

async function tripWithApi(options: Parameters<typeof createTestApi>[0] = {}) {
  const api = createTestApi(options);
  const trip = await api.post("/api/trips", { name: "Albuquerque weekend" });
  const tripPath = `/api/trips/${trip.body.id}`;
  const stopsPath = `${tripPath}/stops`;
  const addStop = (name: string, location: object) => api.post(stopsPath, { name, location });
  return { api, tripId: trip.body.id as string, tripPath, stopsPath, addStop, created: trip.body };
}

describe("Trip API: adding Stops", () => {
  it("starts a new Trip with no Stops and no Start", async () => {
    const { created } = await tripWithApi();

    expect(created).toMatchObject({ stops: [], startStopId: null });
  });

  it("adds a Stop picked from an address search and returns the updated Trip", async () => {
    const geocoder = createFakeGeocoder({ places: { "3828 Piermont Dr NE": [waltsHouse] } });
    const { api, tripPath, stopsPath } = await tripWithApi({ geocoder });
    const [picked] = (await api.post("/api/locations/search", { query: "3828 Piermont Dr NE" })).body.matches;

    const added = await api.post(stopsPath, { name: "Walt's house", location: picked });

    expect(added.status).toBe(201);
    expect(added.body.stops).toEqual([
      {
        id: expect.any(String),
        name: "Walt's house",
        address: "3828 Piermont Drive Northeast, Albuquerque, New Mexico 87191",
        lat: 35.1261262,
        lng: -106.5365521,
      },
    ]);
    expect((await api.get(tripPath)).body).toEqual(added.body);
  });

  it("adds a Stop at typed coordinates, as typed, with the street address found there", async () => {
    const geocoder = createFakeGeocoder({ streetAddresses: { "35.1258,-106.5361": espejo.address } });
    const { api, stopsPath } = await tripWithApi({ geocoder });
    const [picked] = (await api.post("/api/locations/search", { query: "35.1258, -106.5361" })).body.matches;

    const added = await api.post(stopsPath, { name: "Behind Walt's", location: picked });

    expect(added.body.stops).toEqual([
      { id: expect.any(String), name: "Behind Walt's", address: espejo.address, lat: 35.1258, lng: -106.5361 },
    ]);
  });

  it("adds a Stop at coordinates with no street address with only its coordinates", async () => {
    const { api, stopsPath } = await tripWithApi();
    const [picked] = (await api.post("/api/locations/search", { query: "34.4, -107.2" })).body.matches;

    const added = await api.post(stopsPath, { name: "The cook site", location: picked });

    expect(added.body.stops).toEqual([{ id: expect.any(String), name: "The cook site", address: null, lat: 34.4, lng: -107.2 }]);
  });

  it("trims the name", async () => {
    const { addStop } = await tripWithApi();

    const added = await addStop("  Walt's house ", espejo);

    expect(added.body.stops[0].name).toBe("Walt's house");
  });

  it.each([
    ["an empty name", { name: "", location: espejo }],
    ["a blank name", { name: "  ", location: espejo }],
    ["no name", { location: espejo }],
    ["a non-text name", { name: 7, location: espejo }],
    ["no location", { name: "Nowhere" }],
    ["a location without coordinates", { name: "Nowhere", location: { address: "Somewhere" } }],
    ["text coordinates", { name: "Nowhere", location: { lat: "35.1", lng: "-106.5" } }],
    ["coordinates out of range", { name: "Nowhere", location: { lat: 91, lng: 0 } }],
    ["no body", undefined],
  ])("rejects a Stop with %s and adds nothing", async (_label, body) => {
    const { api, tripPath, stopsPath, created } = await tripWithApi();

    const added = await api.post(stopsPath, body);

    expect(added.status).toBe(400);
    expect(added.body).toEqual({ error: expect.any(String) });
    expect((await api.get(tripPath)).body).toEqual(created);
  });

  it("answers 404 when adding a Stop to a Trip that doesn't exist", async () => {
    const api = createTestApi();

    const added = await api.post("/api/trips/no-such-trip/stops", { name: "Ghost", location: espejo });

    expect(added.status).toBe(404);
    expect(added.body).toEqual({ error: expect.any(String) });
  });

  it("lists Stops in the order they were added", async () => {
    const { addStop } = await tripWithApi();

    await addStop("First", espejo);
    await addStop("Second", desert);
    const added = await addStop("Third", carWash);

    expect(added.body.stops.map((stop: { name: string }) => stop.name)).toEqual(["First", "Second", "Third"]);
  });

  it("makes the first Stop added the Start, and keeps it there as more are added", async () => {
    const { addStop } = await tripWithApi();

    const first = await addStop("Walt's house", espejo);
    const second = await addStop("The cook site", desert);

    expect(first.body.startStopId).toBe(first.body.stops[0].id);
    expect(second.body.startStopId).toBe(first.body.stops[0].id);
  });

  it("changes the Trip's revision and last-changed time when a Stop is added", async () => {
    const { api, addStop, created } = await tripWithApi();

    const added = await addStop("Walt's house", espejo);

    expect(added.body.revision).not.toBe(created.revision);
    expect(added.body.updatedAt).not.toBe(created.updatedAt);
    expect((await api.get("/api/trips")).body.trips[0].revision).toBe(added.body.revision);
  });
});

describe("Trip API: changing Stops", () => {
  it("renames a Stop and returns the updated Trip", async () => {
    const { api, tripPath, addStop } = await tripWithApi();
    const added = await addStop("Jesse's place", espejo);
    const stop = added.body.stops[0];

    const renamed = await api.patch(`${tripPath}/stops/${stop.id}`, { name: " Jesse's house " });

    expect(renamed.status).toBe(200);
    expect(renamed.body.stops).toEqual([{ ...stop, name: "Jesse's house" }]);
    expect(renamed.body.revision).not.toBe(added.body.revision);
    expect((await api.get(tripPath)).body).toEqual(renamed.body);
  });

  it.each([
    ["an empty name", { name: "" }],
    ["a blank name", { name: "   " }],
    ["nothing to change", {}],
    ["no body", undefined],
  ])("rejects changing a Stop with %s and keeps it as it was", async (_label, body) => {
    const { api, tripPath, addStop } = await tripWithApi();
    const added = await addStop("Jesse's place", espejo);

    const changed = await api.patch(`${tripPath}/stops/${added.body.stops[0].id}`, body);

    expect(changed.status).toBe(400);
    expect(changed.body).toEqual({ error: expect.any(String) });
    expect((await api.get(tripPath)).body).toEqual(added.body);
  });

  it("answers 404 when changing a Stop that doesn't exist, or belongs to another Trip", async () => {
    const { api, tripPath } = await tripWithApi();
    const otherTrip = await api.post("/api/trips", { name: "Elsewhere" });
    const otherAdded = await api.post(`/api/trips/${otherTrip.body.id}/stops`, { name: "Elsewhere", location: espejo });

    const missing = await api.patch(`${tripPath}/stops/no-such-stop`, { name: "Ghost" });
    const foreign = await api.patch(`${tripPath}/stops/${otherAdded.body.stops[0].id}`, { name: "Ghost" });
    const noTrip = await api.patch("/api/trips/no-such-trip/stops/no-such-stop", { name: "Ghost" });

    expect([missing.status, foreign.status, noTrip.status]).toEqual([404, 404, 404]);
    expect(missing.body).toEqual({ error: expect.any(String) });
    expect((await api.get(`/api/trips/${otherTrip.body.id}`)).body.stops[0].name).toBe("Elsewhere");
  });

  it("moves a Stop to an address picked from a search, keeping its name", async () => {
    const geocoder = createFakeGeocoder({ places: { "A1A Car Wash": [{ label: "A1A Car Wash, Albuquerque", ...carWash }] } });
    const { api, tripPath, addStop } = await tripWithApi({ geocoder });
    const added = await addStop("The car wash", espejo);
    const stop = added.body.stops[0];
    const [picked] = (await api.post("/api/locations/search", { query: "A1A Car Wash" })).body.matches;

    const moved = await api.patch(`${tripPath}/stops/${stop.id}`, { location: picked });

    expect(moved.status).toBe(200);
    expect(moved.body.stops).toEqual([{ id: stop.id, name: "The car wash", ...carWash }]);
    expect(moved.body.revision).not.toBe(added.body.revision);
    expect((await api.get(tripPath)).body).toEqual(moved.body);
  });

  it("moves a Stop to typed coordinates with no street address, dropping its old address", async () => {
    const { api, tripPath, addStop } = await tripWithApi();
    const added = await addStop("The cook site", espejo);
    const [picked] = (await api.post("/api/locations/search", { query: "34.4, -107.2" })).body.matches;

    const moved = await api.patch(`${tripPath}/stops/${added.body.stops[0].id}`, { location: picked });

    expect(moved.body.stops).toEqual([{ id: added.body.stops[0].id, name: "The cook site", ...desert }]);
  });

  it("renames and moves a Stop in one go", async () => {
    const { api, tripPath, addStop } = await tripWithApi();
    const added = await addStop("Jesse's place", espejo);

    const changed = await api.patch(`${tripPath}/stops/${added.body.stops[0].id}`, { name: "Jesse's house", location: carWash });

    expect(changed.body.stops).toEqual([{ id: added.body.stops[0].id, name: "Jesse's house", ...carWash }]);
  });

  it.each([
    ["a location without coordinates", { location: { address: "Somewhere" } }],
    ["coordinates out of range", { location: { lat: 0, lng: -181 } }],
    ["a valid location but an empty name", { name: "", location: carWash }],
  ])("rejects moving a Stop to %s and keeps it where it was", async (_label, body) => {
    const { api, tripPath, addStop } = await tripWithApi();
    const added = await addStop("Jesse's place", espejo);

    const moved = await api.patch(`${tripPath}/stops/${added.body.stops[0].id}`, body);

    expect(moved.status).toBe(400);
    expect((await api.get(tripPath)).body).toEqual(added.body);
  });
});

describe("Trip API: removing Stops", () => {
  it("removes a Stop and returns the updated Trip", async () => {
    const { api, tripPath, addStop } = await tripWithApi();
    await addStop("Walt's house", espejo);
    const added = await addStop("The cook site", desert);
    const [walts, cookSite] = added.body.stops;

    const removed = await api.delete(`${tripPath}/stops/${cookSite.id}`);

    expect(removed.status).toBe(200);
    expect(removed.body.stops).toEqual([walts]);
    expect(removed.body.revision).not.toBe(added.body.revision);
    expect((await api.get(tripPath)).body).toEqual(removed.body);
  });

  it("leaves a Trip with no Stops and no Start when its last Stop is removed", async () => {
    const { api, tripPath, addStop } = await tripWithApi();
    const added = await addStop("Walt's house", espejo);

    const removed = await api.delete(`${tripPath}/stops/${added.body.stops[0].id}`);

    expect(removed.body).toMatchObject({ stops: [], startStopId: null });
  });

  it("answers 404 when removing a Stop that doesn't exist, or belongs to another Trip", async () => {
    const { api, tripPath } = await tripWithApi();
    const otherTrip = await api.post("/api/trips", { name: "Elsewhere" });
    const otherAdded = await api.post(`/api/trips/${otherTrip.body.id}/stops`, { name: "Elsewhere", location: espejo });

    const missing = await api.delete(`${tripPath}/stops/no-such-stop`);
    const foreign = await api.delete(`${tripPath}/stops/${otherAdded.body.stops[0].id}`);
    const noTrip = await api.delete("/api/trips/no-such-trip/stops/no-such-stop");

    expect([missing.status, foreign.status, noTrip.status]).toEqual([404, 404, 404]);
    expect(missing.body).toEqual({ error: expect.any(String) });
    expect((await api.get(`/api/trips/${otherTrip.body.id}`)).body.stops).toHaveLength(1);
  });

  it("removes a Trip's Stops along with the Trip", async () => {
    const { api, tripPath, addStop } = await tripWithApi();
    const added = await addStop("Walt's house", espejo);

    await api.delete(tripPath);

    expect((await api.patch(`${tripPath}/stops/${added.body.stops[0].id}`, { name: "Back?" })).status).toBe(404);
  });
});

describe("Trip API: the Start", () => {
  async function tripWithThreeStops() {
    const setup = await tripWithApi();
    await setup.addStop("Walt's house", espejo);
    await setup.addStop("The cook site", desert);
    const added = await setup.addStop("The car wash", carWash);
    const [walts, cookSite, carWashStop] = added.body.stops;
    return { ...setup, added, walts, cookSite, carWashStop };
  }

  it("makes any Stop the Start and returns the updated Trip", async () => {
    const { api, tripPath, added, carWashStop } = await tripWithThreeStops();

    const made = await api.send("PUT", `${tripPath}/start`, { stopId: carWashStop.id });

    expect(made.status).toBe(200);
    expect(made.body.startStopId).toBe(carWashStop.id);
    expect(made.body.stops).toEqual(added.body.stops);
    expect(made.body.revision).not.toBe(added.body.revision);
    expect((await api.get(tripPath)).body).toEqual(made.body);
  });

  it("hands the Start to the oldest remaining Stop when the Start is removed", async () => {
    const { api, tripPath, walts, cookSite } = await tripWithThreeStops();

    const removed = await api.delete(`${tripPath}/stops/${walts.id}`);

    expect(removed.body.startStopId).toBe(cookSite.id);
  });

  it("hands a picked Start to the oldest remaining Stop when it is removed", async () => {
    const { api, tripPath, walts, carWashStop } = await tripWithThreeStops();
    await api.send("PUT", `${tripPath}/start`, { stopId: carWashStop.id });

    const removed = await api.delete(`${tripPath}/stops/${carWashStop.id}`);

    expect(removed.body.startStopId).toBe(walts.id);
  });

  it("keeps a picked Start when another Stop is removed or added", async () => {
    const { api, tripPath, addStop, walts, cookSite } = await tripWithThreeStops();
    await api.send("PUT", `${tripPath}/start`, { stopId: cookSite.id });

    const removed = await api.delete(`${tripPath}/stops/${walts.id}`);
    const added = await addStop("Los Pollos Hermanos", espejo);

    expect(removed.body.startStopId).toBe(cookSite.id);
    expect(added.body.startStopId).toBe(cookSite.id);
  });

  it("keeps the Start when a Stop is renamed or moved", async () => {
    const { api, tripPath, cookSite } = await tripWithThreeStops();
    await api.send("PUT", `${tripPath}/start`, { stopId: cookSite.id });

    const changed = await api.patch(`${tripPath}/stops/${cookSite.id}`, { name: "Cook site", location: carWash });

    expect(changed.body.startStopId).toBe(cookSite.id);
  });

  it.each([
    ["no Stop", {}, 400],
    ["no body", undefined, 400],
    ["a Stop that doesn't exist", { stopId: "no-such-stop" }, 404],
  ])("rejects making %s the Start and keeps the Start", async (_label, body, status) => {
    const { api, tripPath, added } = await tripWithThreeStops();

    const made = await api.send("PUT", `${tripPath}/start`, body);

    expect(made.status).toBe(status);
    expect(made.body).toEqual({ error: expect.any(String) });
    expect((await api.get(tripPath)).body).toEqual(added.body);
  });

  it("rejects making another Trip's Stop the Start", async () => {
    const { api, tripPath, added } = await tripWithThreeStops();
    const otherTrip = await api.post("/api/trips", { name: "Elsewhere" });
    const otherAdded = await api.post(`/api/trips/${otherTrip.body.id}/stops`, { name: "Elsewhere", location: espejo });

    const made = await api.send("PUT", `${tripPath}/start`, { stopId: otherAdded.body.stops[0].id });

    expect(made.status).toBe(404);
    expect((await api.get(tripPath)).body).toEqual(added.body);
  });

  it("answers 404 when making a Start on a Trip that doesn't exist", async () => {
    const api = createTestApi();

    expect((await api.send("PUT", "/api/trips/no-such-trip/start", { stopId: "x" })).status).toBe(404);
  });
});
