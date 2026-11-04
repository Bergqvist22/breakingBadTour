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
});
