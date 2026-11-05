import { neon } from "@neondatabase/serverless";
import { schemaStatements } from "./schema.js";
import type { StopRecord, TripRecord, TripStore } from "./tripStore.js";

interface TripRow {
  id: string;
  name: string;
  created_at: string | Date;
  updated_at: string | Date;
  revision: number;
  start_stop_id: string | null;
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
  };
}

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
        INSERT INTO trips (id, name, created_at, updated_at, revision, start_stop_id)
        VALUES (${trip.id}, ${trip.name}, ${trip.createdAt.toISOString()}, ${trip.updatedAt.toISOString()},
                ${trip.revision}, ${trip.startStopId})
      `;
    },

    async listTrips() {
      const rows = (await sql`
        SELECT id, name, created_at, updated_at, revision, start_stop_id FROM trips
      `) as TripRow[];
      return rows.map(toRecord);
    },

    async getTrip(id) {
      const rows = (await sql`
        SELECT id, name, created_at, updated_at, revision, start_stop_id FROM trips WHERE id = ${id}
      `) as TripRow[];
      return rows[0] && toRecord(rows[0]);
    },

    async updateTrip(id, changes) {
      const setsStart = changes.startStopId !== undefined;
      const rows = (await sql`
        UPDATE trips
        SET name = COALESCE(${changes.name ?? null}::text, name),
            start_stop_id = CASE WHEN ${setsStart}::boolean THEN ${changes.startStopId ?? null}::text ELSE start_stop_id END,
            updated_at = ${changes.updatedAt.toISOString()},
            revision = revision + 1
        WHERE id = ${id}
        RETURNING id, name, created_at, updated_at, revision, start_stop_id
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
