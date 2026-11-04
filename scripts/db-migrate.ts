import "./localNetwork.js";
import { databaseUrlFrom } from "../server/config.js";
import { migratePostgres } from "../server/store/postgresTripStore.js";

// `npm run db:migrate` loads `.env.local` (from `npx vercel env pull .env.local`) if it exists;
// a DATABASE_URL set in the shell takes precedence.
const url = databaseUrlFrom(process.env);
if (!url) {
  console.error(
    "No database configured. Run `npx vercel env pull .env.local` first, or set DATABASE_URL, e.g. DATABASE_URL=postgres://... npm run db:migrate",
  );
  process.exit(1);
}

await migratePostgres(url);
console.log("Database tables are up to date.");
