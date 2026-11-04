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
];
