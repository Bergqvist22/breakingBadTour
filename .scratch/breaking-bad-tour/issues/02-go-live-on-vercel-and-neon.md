# 02 — Go live on Vercel + Neon

**What to build:** The app is live on a public Vercel URL, and Trips created there are saved in Neon Postgres, so every group member sees the same Trips. The user has to do the account steps; the agent provides a step-by-step guide, pushes the code (with the user's go-ahead), creates the tables, and verifies the deployment. See ADR-0001.

**Blocked by:** 01 — Walking skeleton: create and list Trips

**Status:** ready-for-human

- [ ] The user has created a Vercel project from the `Bergqvist22/breakingBadTour` GitHub repo
- [ ] The user has added Neon Postgres to the project from Vercel's storage marketplace, so the database connection is available to the server functions
- [ ] The database tables exist in Neon
- [ ] The latest code is pushed and deployed, with the user's go-ahead before any push
- [ ] On the live URL, a Trip created in one browser shows up in another browser, and is still there after a redeploy
- [ ] The database connection never reaches the browser
- [ ] Local development can optionally use the Neon database (for example via pulled environment variables) as well as the in-memory store
