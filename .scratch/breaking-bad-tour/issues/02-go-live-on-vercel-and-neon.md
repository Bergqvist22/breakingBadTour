# 02 — Go live on Vercel + Neon

**What to build:** The app is live on a public Vercel URL, and Trips created there are saved in Neon Postgres, so every group member sees the same Trips. The user has to do the account steps; the agent provides a step-by-step guide, pushes the code (with the user's go-ahead), creates the tables, and verifies the deployment. See ADR-0001.

**Blocked by:** 01 — Walking skeleton: create and list Trips

**Status:** resolved

- [x] The user has created a Vercel project from the `Bergqvist22/breakingBadTour` GitHub repo
- [x] The user has added Neon Postgres to the project from Vercel's storage marketplace, so the database connection is available to the server functions
- [x] The database tables exist in Neon
- [x] The latest code is pushed and deployed, with the user's go-ahead before any push
- [x] On the live URL, a Trip created in one browser shows up in another browser, and is still there after a redeploy
- [x] The database connection never reaches the browser
- [x] Local development can optionally use the Neon database (for example via pulled environment variables) as well as the in-memory store

## Comments

**Resolved (verification):**

- The user created the Vercel project `breakingbadtour67` (https://breakingbadtour67.vercel.app) from the GitHub repo.
- Neon Postgres was added through Vercel storage; `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `POSTGRES_URL` etc. are set for all environments.
- `npm run db:migrate` was run against Neon, so the tables exist.
- The code was pushed to `main` with the user's go-ahead and deployed.
- A Trip "Test" created in the browser on the live URL was read back via the live API and directly from Neon, and was still there after a redeploy.
- The built JS bundle contains no connection string.
- Local Neon: `npx vercel env pull .env.local`, then `npm run dev:neon` (dev server against Neon) and `npm run db:migrate` (loads `.env.local` if present). Plain `npm run dev` stays on the in-memory store even when `.env.local` exists. Checked locally: `dev` listed no Trips, `dev:neon` listed the "Test" Trip from Neon.
- Local connects to Neon failed with `ETIMEDOUT` because Node's happy-eyeballs per-attempt timeout (250 ms) is shorter than the ~0.44 s connect on the user's network (no working IPv6). `scripts/localNetwork.ts` raises it to 2 s for the dev server and local scripts only; a read-only `SELECT 1` failed at 250 ms and succeeded at 2000 ms. The Vercel function does not import it.
