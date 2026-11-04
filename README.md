# Breaking Bad Tour

A shared, Breaking Bad–themed road-trip planner. See `.scratch/breaking-bad-tour/spec.md` for the spec, `GLOSSARY.md` for the domain words and `docs/adr/` for decisions.

## Run locally

```sh
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173). One command serves both the web app and the Trip API (`/api/*`).

With no database configured, the app uses an in-memory Trip store that resets when the dev server restarts. To use Postgres instead, put the connection string in `.env.local`:

```sh
DATABASE_URL=postgres://...
```

and create the tables once:

```sh
DATABASE_URL=postgres://... npm run db:migrate
```

## Tests and checks

```sh
npm test           # Trip API tests (Vitest, in-memory store, no network)
npm run test:watch # the same, re-running on change
npm run typecheck
npm run build
```

## Layout

- `src/` — the React web app. It only ever talks to `/api`.
- `shared/` — JSON types shared by the web app and the Trip API.
- `server/tripApi.ts` — the Trip API: a plain `handle({ method, path, body })` function, the single test seam.
- `server/tripService.ts` — the rules (validation, ordering, timestamps).
- `server/store/` — the Trip store interface, its in-memory and Neon Postgres implementations, and the schema.
- `server/http/adapters.ts` — thin HTTP adapters for Vercel and the Vite dev server.
- `server/testing/` — test helpers that wire the Trip API to in-memory fakes.
- `api/index.ts` — the Vercel server function; `vercel.json` routes every `/api/*` request to it.
