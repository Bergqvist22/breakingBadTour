import { databaseUrlFrom } from "../server/config.js";
import { migratePostgres } from "../server/store/postgresTripStore.js";

const url = databaseUrlFrom(process.env);
if (!url) {
  console.error("Set DATABASE_URL to the Postgres connection string, e.g. DATABASE_URL=postgres://... npm run db:migrate");
  process.exit(1);
}

await migratePostgres(url);
console.log("Database tables are up to date.");
