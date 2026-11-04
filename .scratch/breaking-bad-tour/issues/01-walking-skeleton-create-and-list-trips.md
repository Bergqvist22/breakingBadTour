# 01 — Walking skeleton: create and list Trips

**What to build:** The smallest end-to-end version of the app. A group member opens the start page, cooks up a new Trip by typing a name, and sees it in the list of all Trips, most recently changed first. This sets up the app scaffold (Vite + React + TypeScript, Vercel server functions for the Trip API), the Trip store interface with both an in-memory implementation and a Neon Postgres implementation, and the Trip API test harness. Locally, the app runs on the in-memory store when no database connection is configured. See the spec (`.scratch/breaking-bad-tour/spec.md`) and ADR-0001.

**Blocked by:** None — can start immediately

**Status:** ready-for-agent

- [ ] The app runs locally with one command and serves the start page plus the Trip API
- [ ] The Trip API can create a Trip (non-empty name required) and list Trips with their name and last-changed time, most recently changed first
- [ ] The start page shows the Trip list and a "Cook up a new Trip" form; a new Trip appears in the list right after it's created
- [ ] The Trip store has an in-memory implementation and a Postgres implementation behind the same interface, plus a way to create the Postgres tables
- [ ] The app uses the in-memory store when no database connection is configured
- [ ] Trip API tests run against the in-memory store and cover create, the empty-name rejection, and list ordering
- [ ] A short README explains how to run the app and the tests locally
