# Spec: Breaking Bad Tour trip planner

Status: ready-for-agent

## Problem Statement

A group of friends plans road trips together, often to many locations (around 20). Working out the fastest order to drive between Stops by hand is slow, and every time someone adds or removes a location the whole plan has to be redone. They also want one shared place where everyone in the group can see the same Trips, the same order, the total driving distance and time, and the address and coordinates of each Stop to paste into Google Maps. And they want it to look and feel like Breaking Bad.

## Solution

A small, shared, Breaking Bad–themed web app. The start page lists all Trips. Opening a Trip shows a map with its Route, and a list of its Stops in the order they'll be driven. Anyone can add a Stop by searching an address or typing coordinates, naming it, and picking the right match. The app reorders the Stops to minimise total driving time from the Start (optionally returning to it as a Round trip), draws the Route along real roads, and shows the total and every Leg in km (mi) and time. Everyone with the link sees and edits the same Trips; open pages pick up other people's changes within a few seconds. The app ships with a ready-made "Breaking Bad Tour" Trip of filming locations in Albuquerque, decorated with the show's logo and the group's photos.

## User Stories

### Start page

1. As a group member, I want a start page listing every Trip, so that I can find the one we're planning.
2. As a group member, I want each Trip in the list to show its name, number of Stops, total distance (km and mi), total driving time and when it was last changed, so that I can tell Trips apart at a glance.
3. As a group member, I want Trips sorted with the most recently changed first, so that the active plan is at the top.
4. As a group member, I want to click a Trip in the list to open it, so that I can see its map and Stops.
5. As a group member, I want to create a new Trip by typing a name, so that we can start planning a new road trip.
6. As a group member, I want a new Trip to open right after I create it, so that I can start adding Stops immediately.
7. As a group member, I want the start page to pick up Trips that others create, rename or delete within a few seconds, so that I'm never looking at a stale list.
8. As a group member, I want the start page to have no pictures, so that it stays clean and fast.

### Trips

9. As a group member, I want to rename a Trip, so that its name stays accurate as plans change.
10. As a group member, I want deleting a Trip to ask "Tread lightly" for confirmation, so that a misclick doesn't wipe out a plan the group spent an hour on.
11. As a group member, I want to turn Round trip on or off for a Trip, so that the Route either returns to the Start or ends wherever is fastest.
12. As a group member, I want the Route to update immediately when I toggle Round trip, so that I see the effect on order, distance and time.

### Adding Stops

13. As a group member, I want to add a Stop by typing an address, so that I can plan with places I know by name.
14. As a group member, I want to add a Stop by typing coordinates such as "35.1258, -106.5361", so that I can add places with no street address, like a spot in the desert.
15. As a group member, I want to see up to 5 matching places when I search an address, so that I pick Albuquerque, New Mexico and not Albuquerque, Spain.
16. As a group member, I want a clear message when an address search finds nothing, so that I know to try different wording.
17. As a group member, I want to be required to give every Stop a name, so that the list reads like "Walt's house" rather than raw addresses.
18. As a group member, I want coordinates I type to have their street address looked up automatically, so that every Stop shows an address when one exists.
19. As a group member, I want a Stop whose coordinates have no street address to show only its coordinates, so that I'm not shown a misleading county or area name.
20. As a group member, I want a newly added Stop to appear at the bottom marked "finding its place…" and then move into its correct position, so that I understand the app is working out the new order.
21. As a group member, I want the first Stop I add to a Trip to become its Start, so that I don't have to choose one up front.
22. As a group member, I want to add as many Stops as I like, so that a big road trip of 20 or more Stops is possible.

### Viewing a Trip

23. As a group member, I want to see the Route drawn on a map along real roads, so that I can see where we'll actually drive.
24. As a group member, I want each Stop shown on the map as a numbered element-tile marker in Route order, so that I can match the map to the list.
25. As a group member, I want the Stop list always ordered the way we'll drive it, so that I can read the trip top to bottom.
26. As a group member, I want each Stop to show its name, address (when it has one) and coordinates, so that I can paste either into Google Maps.
27. As a group member, I want an easy way to copy a Stop's address or coordinates, so that pasting into Google Maps is quick.
28. As a group member, I want each Leg between consecutive Stops to show its distance and driving time, so that I can plan breaks.
29. As a group member, I want the Round trip's final Leg back to the Start shown too, so that the totals visibly add up.
30. As a group member, I want the total distance in km with miles in brackets, plus total driving time, so that everyone in the group can read it in the unit they think in.
31. As a group member, I want a Trip with fewer than two Stops to show the Stops without a Route or totals, so that an empty or one-Stop Trip still makes sense.
32. As a group member, I want the map to fit all the Stops in view when the Trip opens, so that I see the whole trip at once.
33. As a group member, I want the Route described as "optimised", so that I understand it's very close to the fastest order, not guaranteed perfect.

### Changing Stops

34. As a group member, I want to remove a Stop with one click, so that cutting a location is quick.
35. As a group member, I want the Route, order, Legs and totals to update after a Stop is removed, so that the plan stays correct.
36. As a group member, I want to rename a Stop, so that "Jesse's place" can become "Jesse's house".
37. As a group member, I want to change a Stop's location by searching a new address or typing new coordinates, so that I can fix a wrong location without losing the Stop's name.
38. As a group member, I want to make any Stop the Start, so that the trip can begin somewhere other than the first place we added.
39. As a group member, I want the oldest remaining Stop to become the Start when the Start is removed, so that the Trip always has a Start.
40. As a group member, I want the Stop order to always be automatic, so that I never have to think about ordering.

### Sharing

41. As a group member, I want every Trip to be visible and editable by anyone with the link, without logging in, so that the whole group can plan together with no setup.
42. As a group member, I want an open Trip page to pick up other people's changes within about 3 seconds, so that I see Jesse's new Stop without reloading.
43. As a group member, I want everyone to see the same Stop order, so that we don't argue over different plans on different phones.
44. As a group member, I want my changes saved Stop by Stop, so that two people adding Stops at the same time both keep their Stop.

### Errors

45. As a group member, I want my Stop to be saved even if the routing service fails, so that I don't lose my work.
46. As a group member, I want the last working Route kept on screen with a clear message when the routing service refuses a Trip (for example a very large one), so that the app degrades instead of breaking.
47. As a group member, I want the Route to be recalculated once the routing service is reachable again and the Trip next changes, so that a temporary outage doesn't leave the Trip stuck.
48. As a group member, I want a clear message when address lookup fails, so that I know to retry.

### Phones

49. As a group member on my phone, I want the map at the top and the Stop list and totals scrolling underneath, so that I can follow the Route from the passenger seat.
50. As a group member on my phone, I want buttons big enough to tap, so that I can add and remove Stops on the road.
51. As a group member on a desktop, I want the map and Stop list side by side, so that I use the wider screen.

### Theme

52. As a group member, I want the whole app in a New Mexico palette (chemistry green, hazmat yellow, desert sand, crystal blue), so that it feels like Breaking Bad.
53. As a group member, I want a dark map with a crystal-blue Route line, so that the Route stands out.
54. As a group member, I want show-flavoured wording such as "Cook up a new Trip", "Say my name" on the Stop name field and "Tread lightly" on delete, so that the app is fun to use.
55. As a group member, I want the app's own title styled as periodic-table element tiles, so that every page carries the theme without needing pictures.

### The ready-made Breaking Bad Tour

56. As a group member, I want the app to come with a ready-made "Breaking Bad Tour" Trip, so that there's something to explore on day one.
57. As a group member, I want it pre-filled with filming locations (Walter White's house as Start, Jesse's house, A1A Car Wash, Los Pollos Hermanos, Saul Goodman's office, Crossroads Motel, Dog House Drive-In, Hank & Marie's house) with checked addresses and coordinates, so that it's usable as a real tour.
58. As a group member, I want it set as a Round trip, so that the tour ends back at Walt's house.
59. As a group member, I want the Breaking Bad logo as a header on that Trip's page, so that it feels special.
60. As a group member, I want the group's photos (hazmat suits, RV cartoon, Heisenberg stencil) shown on that Trip's page with clean, cut-out backgrounds, so that they look good on the dark theme.
61. As a group member, I want to add, remove and edit Stops on the Breaking Bad Tour like any other Trip, so that we can make it our own.
62. As a group member, I want Trips created later to have no pictures, so that the photos stay unique to the Breaking Bad Tour.

## Implementation Decisions

- **Stack**: Vite + React + TypeScript single-page app, Leaflet for the map with a dark OpenStreetMap-based tile style (with the required attribution), hosted on Vercel. Small Vercel server functions form the Trip API; the database is Neon Postgres added through Vercel's storage marketplace. The browser never talks to the database or holds its credentials (ADR-0001).
- **Shared, no login** (ADR-0001): every Trip is visible and editable by anyone with the link. No accounts, no ownership.
- **Polling** (ADR-0001): the start page and an open Trip page poll the Trip API every 3 seconds. Each Trip carries a revision (or last-changed timestamp) so the client only re-renders when something changed. Polling never triggers a Route recalculation.
- **Modules**:
  - **Trip API**: the HTTP surface the web app uses. List Trips (summary: name, Stop count, totals, last changed); get a Trip (Stops in Route order, Legs, totals, Route line, Round trip, Start, whether it has pictures, last Route error); create, rename and delete a Trip; toggle Round trip; add a Stop; rename a Stop; change a Stop's location; remove a Stop; make a Stop the Start; search for locations. Every mutating call returns the updated Trip.
  - **Trip service**: owns the rules. Applies a change, then recalculates and saves the Route whenever the set of Stops, their locations, the Start or Round trip changes. Enforces Start handover (the first Stop added is the Start; removing the Start hands it to the oldest remaining Stop by creation time) and requires a non-empty Stop name.
  - **Route planner**: a pure module. Given a travel-time matrix, the Start and Round trip, it returns a visiting order that minimises total driving time (ADR-0002). Exact for small Trips (about 10 Stops or fewer); for larger Trips a fast heuristic (such as a nearest-neighbour construction refined with 2-opt and or-opt moves) that gets very close to optimal. Deterministic for the same input. With Round trip off the Route ends at whichever Stop is fastest.
  - **Routing provider**: interface over the free public OSRM service (car profile). Two capabilities: a travel-time and distance matrix between all Stops, and the road geometry plus per-Leg distance and time for a given ordered list of Stops. Swappable for a fake in tests.
  - **Geocoder**: interface over OpenStreetMap Nominatim. Forward search returns up to 5 matches. Reverse lookup returns a street address only when one exists at that spot, otherwise none (never a county or area name). Coordinates typed as "lat, lng" are recognised and used as typed. Requests go through the server functions with an identifying User-Agent and respect Nominatim's usage policy (searches on submit, not autocomplete as you type). Swappable for a fake in tests.
  - **Trip store**: persistence interface with a Neon Postgres implementation and an in-memory implementation for tests.
- **Schema** (shape, not DDL):
  - Trip: id, name, round trip flag, Start Stop id, has-pictures flag, revision or last-changed timestamp, and the saved Route: Stop order, Legs (from, to, distance, time), total distance, total time, Route line geometry, last Route error (nullable).
  - Stop: id, Trip id, name (required), latitude, longitude, address (nullable), created at.
  - Deleting a Trip deletes its Stops.
- **Route is computed once and saved** so every viewer sees the same order. Each Route recalculation reads the current Stops at the time it runs, so concurrent edits converge on a Route that includes every Stop.
- **Route failures** (ADR-0002): if the routing provider fails or refuses (for example around 100 Stops on the public OSRM server), the Stop change is still saved, the previously saved Route stays as it was, and the error is recorded on the Trip and shown in the UI. The next successful recalculation clears it. No app-imposed Stop limit.
- **Display formats**: distance as "87 km (54 mi)", time as "1 h 32 min" (or "14 min" under an hour), for both totals and Legs.
- **Pictures**: a Trip has a has-pictures flag. Only the seeded Breaking Bad Tour has it set; new Trips never do, and there is no UI to set it. When set, the Trip page shows the Breaking Bad logo as its header and the hazmat, RV and Heisenberg photos as decoration. The start page never shows pictures. The repo's original images stay untouched; the app uses processed copies with the backgrounds removed (two of the originals have a checkerboard baked into the pixels).
- **Seed data**: a seeding step creates the "Breaking Bad Tour" Trip (Round trip on, pictures on) with the 8 filming-location Stops listed in story 57, Walter White's house as Start, and its Route calculated. Addresses and coordinates are researched and checked against each other during implementation, not guessed. The seed doesn't duplicate the Trip if run again.
- **Stop list behaviour**: Stops are always listed in saved Route order. While a mutation's Route recalculation is in flight, the new Stop shows at the bottom marked "finding its place…".
- **Theme** applies app-wide: palette, dark map, crystal-blue Route line, numbered element-tile markers, element-tile app title, show-flavoured wording, English UI.
- **Responsive layout**: side-by-side on wide screens; map on top and the list underneath on narrow screens, with touch-sized controls.

## Testing Decisions

- **One test seam: the Trip API.** Tests call the API the same way the web app does, with the Trip store, routing provider and geocoder swapped for in-memory or fake implementations. No network and no real database.
- **What makes a good test**: it checks behaviour visible through the API (what a request returns and what a later request sees), never internal structure. The Route planner, Trip service and store are exercised through the API, not tested on their own, so they can be refactored freely.
- **The fake routing provider** returns controlled travel-time and distance matrices and Leg data, so tests can assert exact Route orders, totals and Legs, and simulate failures and refusals.
- **The fake geocoder** returns fixed matches, empty results, and "no street address" for given coordinates.
- **Behaviours to cover**: create, list, rename and delete a Trip; list ordering and summaries; adding a Stop by address and by coordinates; name required; Start defaults to the first Stop; making another Stop the Start; Start handover when the Start is removed; Round trip on and off changing the order and totals; the optimal order on small inputs where the answer is known; a sensible order on a 20-Stop input; Legs and totals adding up; Trips with 0 or 1 Stops; changing a Stop's location reorders; routing failure keeps the last Route, saves the Stop and reports the error; recovery on the next successful recalculation; reverse lookup with no street address; revision changes on every mutation; the seeded Breaking Bad Tour exists once with pictures, and new Trips have none.
- **Not automated**: the React UI, the map and the theme are verified by running the app and clicking through, on desktop and phone widths.
- **Prior art**: none. The repo is empty; these are the first tests.

## Out of Scope

- Logins, accounts, a shared password, or per-person ownership.
- Manually reordering Stops or locking an order.
- Live push updates (WebSockets or realtime services); polling only.
- Guaranteed-optimal ordering for large Trips.
- Travel modes other than car (walking, cycling, transit) and route preferences such as avoiding tolls.
- Undo, trash or restoring deleted Trips and Stops.
- Adding, changing or uploading pictures from the UI, or pictures on any Trip besides the Breaking Bad Tour.
- Export or import of Trips, and offline use.
- Automated browser or end-to-end UI tests.
- Languages other than English.

## Further Notes

- Glossary: `GLOSSARY.md` (Trip, Stop, Start, Round trip, Route, Leg). Decisions: `docs/adr/0001-shared-trips-no-login-polling.md` and `docs/adr/0002-fastest-near-optimal-route-no-stop-cap.md`.
- The public OSRM and Nominatim services are free and fair-use with no uptime guarantee. That suits a small group, but heavy use would need a self-hosted or paid provider, which the provider interfaces make a contained swap.
- The images in the repo (the show's logo, promo photo and fan art) are third-party material shown on a public site. The user accepted this for a fun group app.
- Setup the user has to do: create the Vercel project from the GitHub repo and add Neon Postgres from Vercel's storage marketplace.
