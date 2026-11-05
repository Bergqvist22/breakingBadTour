import { describe, expect, it } from "vitest";
import { createTestApi } from "./testing/testApi.js";

describe("Trip API: creating and listing Trips", () => {
  it("creates a Trip and lists it", async () => {
    const api = createTestApi();

    const created = await api.post("/api/trips", { name: "Albuquerque weekend" });

    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ name: "Albuquerque weekend" });

    const listed = await api.get("/api/trips");
    expect(listed.status).toBe(200);
    expect(listed.body).toEqual({
      trips: [
        {
          id: created.body.id,
          name: "Albuquerque weekend",
          updatedAt: created.body.updatedAt,
          revision: created.body.revision,
        },
      ],
    });
  });

  it("lists no Trips before any are created", async () => {
    const api = createTestApi();

    const listed = await api.get("/api/trips");

    expect(listed.body).toEqual({ trips: [] });
  });

  it.each([
    ["an empty name", { name: "" }],
    ["a blank name", { name: "   " }],
    ["no name", {}],
    ["a non-text name", { name: 42 }],
    ["no body", undefined],
  ])("rejects a Trip with %s and creates nothing", async (_label, body) => {
    const api = createTestApi();

    const created = await api.post("/api/trips", body);

    expect(created.status).toBe(400);
    expect(created.body).toEqual({ error: expect.any(String) });
    expect((await api.get("/api/trips")).body).toEqual({ trips: [] });
  });

  it("trims surrounding whitespace from the name", async () => {
    const api = createTestApi();

    const created = await api.post("/api/trips", { name: "  Desert run  " });

    expect(created.body.name).toBe("Desert run");
  });

  it("records when the Trip was last changed", async () => {
    const api = createTestApi({ clock: () => new Date("2026-03-14T09:30:00.000Z") });

    const created = await api.post("/api/trips", { name: "Pi day" });

    expect(created.body.updatedAt).toBe("2026-03-14T09:30:00.000Z");
  });

  it("lists the most recently changed Trip first", async () => {
    const api = createTestApi();

    await api.post("/api/trips", { name: "First" });
    await api.post("/api/trips", { name: "Second" });
    await api.post("/api/trips", { name: "Third" });

    const listed = await api.get("/api/trips");
    expect(listed.body.trips.map((trip: { name: string }) => trip.name)).toEqual(["Third", "Second", "First"]);
  });

  it("gives every Trip its own id", async () => {
    const api = createTestApi();

    const a = await api.post("/api/trips", { name: "Same name" });
    const b = await api.post("/api/trips", { name: "Same name" });

    expect(a.body.id).not.toBe(b.body.id);
    expect((await api.get("/api/trips")).body.trips).toHaveLength(2);
  });
});

describe("Trip API: unknown requests", () => {
  it("answers 404 for an unknown path", async () => {
    const api = createTestApi();

    expect((await api.get("/api/nope")).status).toBe(404);
  });

  it("answers 405 for an unsupported method on Trips", async () => {
    const api = createTestApi();

    expect((await api.send("PUT", "/api/trips")).status).toBe(405);
  });

  it("answers 405 for an unsupported method on a Trip", async () => {
    const api = createTestApi();
    const created = await api.post("/api/trips", { name: "Somewhere" });

    expect((await api.post(`/api/trips/${created.body.id}`)).status).toBe(405);
  });
});

describe("Trip API: managing a Trip", () => {
  it("gets a Trip by its id", async () => {
    const api = createTestApi();
    const created = await api.post("/api/trips", { name: "Albuquerque weekend" });

    const fetched = await api.get(`/api/trips/${created.body.id}`);

    expect(fetched.status).toBe(200);
    expect(fetched.body).toEqual(created.body);
  });

  it("answers 404 with a message for a Trip that doesn't exist", async () => {
    const api = createTestApi();

    const fetched = await api.get("/api/trips/no-such-trip");

    expect(fetched.status).toBe(404);
    expect(fetched.body).toEqual({ error: expect.any(String) });
  });

  it("renames a Trip and returns the updated Trip", async () => {
    const api = createTestApi();
    const created = await api.post("/api/trips", { name: "Albuquerque weekend" });

    const renamed = await api.patch(`/api/trips/${created.body.id}`, { name: "  Albuquerque long weekend " });

    expect(renamed.status).toBe(200);
    expect(renamed.body).toMatchObject({ id: created.body.id, name: "Albuquerque long weekend" });
    expect((await api.get(`/api/trips/${created.body.id}`)).body.name).toBe("Albuquerque long weekend");
  });

  it.each([
    ["an empty name", { name: "" }],
    ["a blank name", { name: "   " }],
    ["no name", {}],
    ["no body", undefined],
  ])("rejects renaming a Trip to %s and keeps the old name", async (_label, body) => {
    const api = createTestApi();
    const created = await api.post("/api/trips", { name: "Keep me" });

    const renamed = await api.patch(`/api/trips/${created.body.id}`, body);

    expect(renamed.status).toBe(400);
    expect(renamed.body).toEqual({ error: expect.any(String) });
    expect((await api.get(`/api/trips/${created.body.id}`)).body).toEqual(created.body);
  });

  it("answers 404 when renaming a Trip that doesn't exist", async () => {
    const api = createTestApi();

    const renamed = await api.patch("/api/trips/no-such-trip", { name: "Ghost" });

    expect(renamed.status).toBe(404);
    expect((await api.get("/api/trips")).body).toEqual({ trips: [] });
  });

  it("moves a renamed Trip to the top of the list", async () => {
    const api = createTestApi();
    const first = await api.post("/api/trips", { name: "First" });
    await api.post("/api/trips", { name: "Second" });

    await api.patch(`/api/trips/${first.body.id}`, { name: "First, renamed" });

    const listed = await api.get("/api/trips");
    expect(listed.body.trips.map((trip: { name: string }) => trip.name)).toEqual(["First, renamed", "Second"]);
  });

  it("deletes a Trip so it is gone from the list and can't be fetched", async () => {
    const api = createTestApi();
    const doomed = await api.post("/api/trips", { name: "Doomed" });
    const kept = await api.post("/api/trips", { name: "Kept" });

    const deleted = await api.delete(`/api/trips/${doomed.body.id}`);

    expect(deleted.status).toBe(204);
    expect((await api.get(`/api/trips/${doomed.body.id}`)).status).toBe(404);
    expect((await api.get("/api/trips")).body).toEqual({
      trips: [{ id: kept.body.id, name: "Kept", updatedAt: kept.body.updatedAt, revision: kept.body.revision }],
    });
  });

  it("answers 404 when deleting a Trip that doesn't exist", async () => {
    const api = createTestApi();
    const doomed = await api.post("/api/trips", { name: "Doomed" });
    await api.delete(`/api/trips/${doomed.body.id}`);

    const deletedAgain = await api.delete(`/api/trips/${doomed.body.id}`);

    expect(deletedAgain.status).toBe(404);
    expect(deletedAgain.body).toEqual({ error: expect.any(String) });
  });
});

describe("Trip API: revisions for polling", () => {
  it("gives a new Trip a revision, the same in the list and on its own", async () => {
    const api = createTestApi();

    const created = await api.post("/api/trips", { name: "Fresh" });

    expect(created.body.revision).toEqual(expect.any(Number));
    expect((await api.get(`/api/trips/${created.body.id}`)).body.revision).toBe(created.body.revision);
    expect((await api.get("/api/trips")).body.trips[0].revision).toBe(created.body.revision);
  });

  it("changes the revision on every rename, even within the same instant", async () => {
    const api = createTestApi({ clock: () => new Date("2026-03-14T09:30:00.000Z") });
    const created = await api.post("/api/trips", { name: "Same" });

    const first = await api.patch(`/api/trips/${created.body.id}`, { name: "Same" });
    const second = await api.patch(`/api/trips/${created.body.id}`, { name: "Same" });

    const revisions = [created.body.revision, first.body.revision, second.body.revision];
    expect(new Set(revisions).size).toBe(3);
    expect((await api.get(`/api/trips/${created.body.id}`)).body.revision).toBe(second.body.revision);
  });

  it("keeps the revision when a rename is rejected", async () => {
    const api = createTestApi();
    const created = await api.post("/api/trips", { name: "Steady" });

    await api.patch(`/api/trips/${created.body.id}`, { name: " " });

    expect((await api.get(`/api/trips/${created.body.id}`)).body.revision).toBe(created.body.revision);
  });
});
