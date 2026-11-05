import { neon } from "@neondatabase/serverless";
import { schemaStatements } from "./schema.js";
import type { SavedRoute, StopRecord, TripRecord, TripStore, TripSummaryRecord } from "./tripStore.js";

/** The parts of a saved Route kept in the `route` JSONB column; the totals have columns of their own. */
type RouteJson = Omit<SavedRoute, "distanceMeters" | "durationSeconds">;

interface TripRow {
  id: string;
  name: string;
  created_at: string | Date;
  updated_at: string | Date;
  revision: number;
  start_stop_id: string | null;
  round_trip: boolean;
  route: RouteJson | null;
  route_distance_m: number | string | null;
  route_duration_s: number | string | null;
  route_error: string | null;
}

interface TripSummaryRow {
  id: string;
  name: string;
  updated_at: string | Date;
  revision: number;
  stop_count: number | string;
  route_distance_m: number | string | null;
  route_duration_s: number | string | null;
}

interface StopRow {
  id: string;
  trip_id: string;
  name: string;
  lat: number | string;
  lng: number | string;
  address: string | null;
  created_at: string | Date;
}

function toRecord(row: TripRow): TripRecord {
  return {
    id: row.id,
    name: row.name,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    revision: Number(row.revision),
    startStopId: row.start_stop_id,
    roundTrip: row.round_trip,
    route: row.route && {
      ...row.route,
      distanceMeters: Number(row.route_distance_m),
      durationSeconds: Number(row.route_duration_s),
    },
    routeError: row.route_error,
  };
}

function toSummaryRecord(row: TripSummaryRow): TripSummaryRecord {
  return {
    id: row.id,
    name: row.name,
    updatedAt: new Date(row.updated_at),
    revision: Number(row.revision),
    stopCount: Number(row.stop_count),
    routeTotals:
      row.route_distance_m === null || row.route_duration_s === null
        ? null
        : { distanceMeters: Number(row.route_distance_m), durationSeconds: Number(row.route_duration_s) },
  };
}

/** The `route` column's value for a saved Route (as JSON text), or null. */
function routeJson(route: SavedRoute | null | undefined): string | null {
  if (!route) return null;
  const { distanceMeters: _distance, durationSeconds: _duration, ...json } = route;
  return JSON.stringify(json satisfies RouteJson);
}

const TRIP_COLUMNS = `id, name, created_at, updated_at, revision, start_stop_id, round_trip,
  route, route_distance_m, route_duration_s, route_error`;

function toStopRecord(row: StopRow): StopRecord {
  return {
    id: row.id,
    tripId: row.trip_id,
    name: row.name,
    lat: Number(row.lat),
    lng: Number(row.lng),
    address: row.address,
    createdAt: new Date(row.created_at),
  };
}

/** A Trip store backed by Neon Postgres over HTTP (works in serverless functions). */
export function createPostgresTripStore(databaseUrl: string): TripStore {
  const sql = neon(databaseUrl);

  return {
    async insertTrip(trip) {
      await sql`
        INSERT INTO trips (id, name, created_at, updated_at, revision, start_stop_id, round_trip,
                           route, route_distance_m, route_duration_s, route_error)
        VALUES (${trip.id}, ${trip.name}, ${trip.createdAt.toISOString()}, ${trip.updatedAt.toISOString()},
                ${trip.revision}, ${trip.startStopId}, ${trip.roundTrip}, ${routeJson(trip.route)}::jsonb,
                ${trip.route?.distanceMeters ?? null}, ${trip.route?.durationSeconds ?? null}, ${trip.routeError})
      `;
    },

    async listTrips() {
      const rows = (await sql`
        SELECT id, name, updated_at, revision, route_distance_m, route_duration_s,
               (SELECT count(*) FROM stops WHERE stops.trip_id = trips.id) AS stop_count
        FROM trips
      `) as TripSummaryRow[];
      return rows.map(toSummaryRecord);
    },

    async getTrip(id) {
      const rows = (await sql.query(`SELECT ${TRIP_COLUMNS} FROM trips WHERE id = $1`, [id])) as TripRow[];
      return rows[0] && toRecord(rows[0]);
    },

    async getRevision(id) {
      const rows = (await sql`SELECT revision FROM trips WHERE id = ${id}`) as { revision: number }[];
      return rows[0] && Number(rows[0].revision);
    },

    async updateTrip(id, changes, ifRevision) {
      const setsStart = changes.startStopId !== undefined;
      const setsRoute = changes.route !== undefined;
      const setsRouteError = changes.routeError !== undefined;
      const rows = (await sql`
        UPDATE trips
        SET name = COALESCE(${changes.name ?? null}::text, name),
            start_stop_id = CASE WHEN ${setsStart}::boolean THEN ${changes.startStopId ?? null}::text ELSE start_stop_id END,
            round_trip = COALESCE(${changes.roundTrip ?? null}::boolean, round_trip),
            route = CASE WHEN ${setsRoute}::boolean THEN ${routeJson(changes.route)}::jsonb ELSE route END,
            route_distance_m = CASE WHEN ${setsRoute}::boolean
              THEN ${changes.route?.distanceMeters ?? null}::double precision ELSE route_distance_m END,
            route_duration_s = CASE WHEN ${setsRoute}::boolean
              THEN ${changes.route?.durationSeconds ?? null}::double precision ELSE route_duration_s END,
            route_error = CASE WHEN ${setsRouteError}::boolean THEN ${changes.routeError ?? null}::text ELSE route_error END,
            updated_at = ${changes.updatedAt.toISOString()},
            revision = revision + 1
        WHERE id = ${id} AND (${ifRevision ?? null}::integer IS NULL OR revision = ${ifRevision ?? null}::integer)
        RETURNING id, name, created_at, updated_at, revision, start_stop_id, round_trip,
                  route, route_distance_m, route_duration_s, route_error
      `) as TripRow[];
      return rows[0] && toRecord(rows[0]);
    },

    async deleteTrip(id) {
      // The stops table's foreign key cascades, so the Trip's Stops go with it.
      const rows = await sql`DELETE FROM trips WHERE id = ${id} RETURNING id`;
      return rows.length > 0;
    },

    async insertStop(stop) {
      await sql`
        INSERT INTO stops (id, trip_id, name, lat, lng, address, created_at)
        VALUES (${stop.id}, ${stop.tripId}, ${stop.name}, ${stop.lat}, ${stop.lng}, ${stop.address},
                ${stop.createdAt.toISOString()})
      `;
    },

    async listStops(tripId) {
      const rows = (await sql`
        SELECT id, trip_id, name, lat, lng, address, created_at FROM stops
        WHERE trip_id = ${tripId}
        ORDER BY created_at, id
      `) as StopRow[];
      return rows.map(toStopRecord);
    },

    async updateStop(tripId, stopId, { name, location }) {
      const moves = location !== undefined;
      const rows = (await sql`
        UPDATE stops
        SET name = COALESCE(${name ?? null}::text, name),
            lat = CASE WHEN ${moves}::boolean THEN ${location?.lat ?? null}::double precision ELSE lat END,
            lng = CASE WHEN ${moves}::boolean THEN ${location?.lng ?? null}::double precision ELSE lng END,
            address = CASE WHEN ${moves}::boolean THEN ${location?.address ?? null}::text ELSE address END
        WHERE id = ${stopId} AND trip_id = ${tripId}
        RETURNING id, trip_id, name, lat, lng, address, created_at
      `) as StopRow[];
      return rows[0] && toStopRecord(rows[0]);
    },

    async deleteStop(tripId, stopId) {
      const rows = await sql`DELETE FROM stops WHERE id = ${stopId} AND trip_id = ${tripId} RETURNING id`;
      return rows.length > 0;
    },
  };
}

/** Creates or updates the tables the Postgres Trip store needs. */
export async function migratePostgres(databaseUrl: string): Promise<void> {
  const sql = neon(databaseUrl);
  for (const statement of schemaStatements) {
    await sql.query(statement);
  }
}
