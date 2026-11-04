import { neon } from "@neondatabase/serverless";
import { schemaStatements } from "./schema.js";
import type { TripRecord, TripStore } from "./tripStore.js";

interface TripRow {
  id: string;
  name: string;
  created_at: string | Date;
  updated_at: string | Date;
  revision: number;
}

function toRecord(row: TripRow): TripRecord {
  return {
    id: row.id,
    name: row.name,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    revision: Number(row.revision),
  };
}

/** A Trip store backed by Neon Postgres over HTTP (works in serverless functions). */
export function createPostgresTripStore(databaseUrl: string): TripStore {
  const sql = neon(databaseUrl);

  return {
    async insertTrip(trip) {
      await sql`
        INSERT INTO trips (id, name, created_at, updated_at, revision)
        VALUES (${trip.id}, ${trip.name}, ${trip.createdAt.toISOString()}, ${trip.updatedAt.toISOString()}, ${trip.revision})
      `;
    },

    async listTrips() {
      const rows = (await sql`SELECT id, name, created_at, updated_at, revision FROM trips`) as TripRow[];
      return rows.map(toRecord);
    },

    async getTrip(id) {
      const rows = (await sql`
        SELECT id, name, created_at, updated_at, revision FROM trips WHERE id = ${id}
      `) as TripRow[];
      return rows[0] && toRecord(rows[0]);
    },

    async updateTrip(id, changes) {
      const rows = (await sql`
        UPDATE trips
        SET name = COALESCE(${changes.name ?? null}, name),
            updated_at = ${changes.updatedAt.toISOString()},
            revision = revision + 1
        WHERE id = ${id}
        RETURNING id, name, created_at, updated_at, revision
      `) as TripRow[];
      return rows[0] && toRecord(rows[0]);
    },

    async deleteTrip(id) {
      const rows = await sql`DELETE FROM trips WHERE id = ${id} RETURNING id`;
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
