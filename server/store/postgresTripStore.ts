import { neon } from "@neondatabase/serverless";
import { schemaStatements } from "./schema.js";
import type { TripRecord, TripStore } from "./tripStore.js";

interface TripRow {
  id: string;
  name: string;
  created_at: string | Date;
  updated_at: string | Date;
}

function toRecord(row: TripRow): TripRecord {
  return {
    id: row.id,
    name: row.name,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/** A Trip store backed by Neon Postgres over HTTP (works in serverless functions). */
export function createPostgresTripStore(databaseUrl: string): TripStore {
  const sql = neon(databaseUrl);

  return {
    async insertTrip(trip) {
      await sql`
        INSERT INTO trips (id, name, created_at, updated_at)
        VALUES (${trip.id}, ${trip.name}, ${trip.createdAt.toISOString()}, ${trip.updatedAt.toISOString()})
      `;
    },

    async listTrips() {
      const rows = (await sql`SELECT id, name, created_at, updated_at FROM trips`) as TripRow[];
      return rows.map(toRecord);
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
