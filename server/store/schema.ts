/**
 * Statements that create (or bring up to date) the Postgres tables.
 * Every statement is idempotent, so the migration can be re-run safely.
 * Later changes should append statements (e.g. `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`).
 */
export const schemaStatements: string[] = [
  `CREATE TABLE IF NOT EXISTS trips (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL CHECK (length(trim(name)) > 0),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS trips_updated_at_idx ON trips (updated_at DESC)`,
  // Ticket 03: a revision that goes up on every change, for polling.
  `ALTER TABLE trips ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 1`,
  // Ticket 04: Stops, and the Stop picked as a Trip's Start. No foreign key on
  // start_stop_id: a removed Start is simply ignored and the oldest Stop takes over.
  `ALTER TABLE trips ADD COLUMN IF NOT EXISTS start_stop_id TEXT`,
  `CREATE TABLE IF NOT EXISTS stops (
    id         TEXT PRIMARY KEY,
    trip_id    TEXT NOT NULL REFERENCES trips (id) ON DELETE CASCADE,
    name       TEXT NOT NULL CHECK (length(trim(name)) > 0),
    lat        DOUBLE PRECISION NOT NULL CHECK (lat BETWEEN -90 AND 90),
    lng        DOUBLE PRECISION NOT NULL CHECK (lng BETWEEN -180 AND 180),
    address    TEXT,
    created_at TIMESTAMPTZ NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS stops_trip_id_created_at_idx ON stops (trip_id, created_at)`,
  // Ticket 05: Round trip and the saved Route. The Route's order, Legs, line and basis
  // live in one JSONB value; its totals get their own columns so listing Trips never
  // reads the (large) line.
  `ALTER TABLE trips ADD COLUMN IF NOT EXISTS round_trip BOOLEAN NOT NULL DEFAULT false`,
  `ALTER TABLE trips ADD COLUMN IF NOT EXISTS route JSONB`,
  `ALTER TABLE trips ADD COLUMN IF NOT EXISTS route_distance_m DOUBLE PRECISION`,
  `ALTER TABLE trips ADD COLUMN IF NOT EXISTS route_duration_s DOUBLE PRECISION`,
  `ALTER TABLE trips ADD COLUMN IF NOT EXISTS route_error TEXT`,
];
