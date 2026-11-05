# Breaking Bad Tour

A shared, Breaking Bad–themed road-trip planner. See `.scratch/breaking-bad-tour/spec.md` for the spec, `GLOSSARY.md` for the domain words and `docs/adr/` for decisions.

## Run locally

```sh
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173). One command serves both the web app and the Trip API (`/api/*`).

`npm run dev` uses an in-memory Trip store that resets when the dev server restarts, even if `.env.local` exists. To use the Neon database instead, see below.

Address search and street-address lookup go through the server to OpenStreetMap Nominatim, which needs internet access from the dev server. Requests carry an identifying User-Agent (override it with `NOMINATIM_USER_AGENT`), are spaced at least a second apart, and are only made when someone presses Search, never while typing (Nominatim's usage policy).

Routes come from the public OSRM demo server (car), also through the server: one travel-time matrix request and one route request per recalculation, spaced at least a second apart, with an identifying User-Agent (override it with `OSRM_USER_AGENT`; point `OSRM_URL` at a self-hosted OSRM to swap servers). The Route is only recalculated after a change that affects it (Stops, their locations, the Start, Round trip), never by polling. The public server refuses more than 100 Stops; the app then keeps the last good Route and shows the error.

The map uses the standard OpenStreetMap tiles, darkened with a CSS filter (`.route-map .leaflet-tile-pane` in `src/styles.css`). They need no API key and are fine for light use with attribution under the OSMF tile policy. CARTO's dark tiles now need an API key (without one they only show "API KEY REQUIRED").

## Going live / using Neon locally

The live app is the Vercel project `breakingbadtour67` (https://breakingbadtour67.vercel.app), deployed from `main` on GitHub. Its Neon Postgres database was added through Vercel's storage marketplace, which sets `DATABASE_URL` (and related variables) for every environment. The connection string is only read by the server function and never reaches the browser.

To work against Neon locally (the real, shared data, so be careful):

```sh
npx vercel link                    # once, if .vercel/ is missing; pick breakingbadtour67
npx vercel env pull .env.local     # writes DATABASE_URL etc. to .env.local (gitignored, never commit it)
npm run dev:neon                   # dev server using Neon instead of the in-memory store
```

Create or update the tables:

```sh
npm run db:migrate
```

`db:migrate` reads `.env.local` if it exists; a `DATABASE_URL` set in the shell takes precedence, so `DATABASE_URL=postgres://... npm run db:migrate` targets any other database. The migration is idempotent. Re-run it after pulling changes that touch `server/store/schema.ts`, before (or right after) those changes deploy.

The local dev server and scripts give each network connection attempt 2 s instead of Node's default 250 ms (`scripts/localNetwork.ts`), because on networks without working IPv6 the connect to Neon otherwise fails with `ETIMEDOUT`. The Vercel function is unaffected.

## Tests and checks

```sh
npm test           # Trip API tests (Vitest, in-memory store, no network)
npm run test:watch # the same, re-running on change
npm run typecheck
npm run build
```

## Layout

- `src/` — the React web app. It only ever talks to `/api`. Pages: `/` (start page) and `/trips/:id` (a Trip with its map, Route and Stops), routed by the small `src/router.ts`; `src/usePolling.ts` polls every 3 seconds and both pages only re-render when a revision moved (the Trip page polls `/api/trips/:id/revision` and only fetches the whole Trip, with its Route line, when it moved). `src/RouteMap.tsx` is the Leaflet map, `src/format.ts` the "87 km (54 mi)" and "1 h 32 min" formats. The Breaking Bad theme lives in `src/styles.css` (palette as CSS variables on `:root`; phone layout first, map and list side by side from 60rem) and `src/AppTitle.tsx` (the element-tile title, built in code). Fonts come from Google Fonts (linked in `index.html`), and the favicon is an inline SVG there.
- `shared/` — JSON types shared by the web app and the Trip API.
- `server/tripApi.ts` — the Trip API: a plain `handle({ method, path, body })` function, the single test seam.
- `server/tripService.ts` — the rules (validation, ordering, timestamps, the Start, recognising typed coordinates, and recalculating and saving the Route after changes that affect it).
- `server/routing/` — the Route planner (`routePlanner.ts`, pure: exact up to 10 Stops, a heuristic above), `calculateRoute.ts` (matrix → order → road route with Legs), and the routing provider interface with its OSRM implementation (tests use `server/testing/fakeRoutingProvider.ts`).
- `server/store/` — the Trip store interface (Trips and their Stops), its in-memory and Neon Postgres implementations, and the schema.
- `server/geocoder/` — the Geocoder interface and its OpenStreetMap Nominatim implementation (tests use `server/testing/fakeGeocoder.ts`).
- `server/http/adapters.ts` — thin HTTP adapters for Vercel and the Vite dev server.
- `server/testing/` — test helpers that wire the Trip API to in-memory fakes.
- `api/index.ts` — the Vercel server function; `vercel.json` routes every `/api/*` request to it.
- `scripts/` — local-only scripts: `db-migrate.ts` and the `localNetwork.ts` connect-timeout tweak.
