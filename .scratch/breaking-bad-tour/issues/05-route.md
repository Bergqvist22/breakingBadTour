# 05 — Route

**What to build:** A Trip's Stops are automatically ordered into the Route that minimises total driving time by car from the Start, with a Round trip toggle that makes the Route return to the Start. The Trip page shows a map with the Route drawn along roads and numbered markers in Route order; the Stop list is in Route order with each Leg's distance and time between Stops, plus the total ("87 km (54 mi) · 1 h 32 min"). The start page shows each Trip's Stop count and totals. The Route is calculated whenever the Stops, their locations, the Start or Round trip change, and is saved so everyone sees the same order. A newly added Stop shows at the bottom marked "finding its place…" until the new Route arrives. If the routing service fails or refuses (for example a very large Trip), the Stop change is still saved, the last good Route stays, and a clear message is shown. See ADR-0002 and `GLOSSARY.md` (Route, Leg, Round trip).

**Blocked by:** 04 — Stops

**Status:** ready-for-agent

- [ ] A Route planner orders Stops to minimise total driving time from a fixed Start, with and without Round trip; exact for small Trips (about 10 Stops or fewer), and a fast heuristic that gets very close to optimal for larger ones; deterministic for the same input
- [ ] A routing provider interface over the public OSRM service (car) provides the travel-time and distance matrix and the road geometry with per-Leg distance and time; tests use a fake
- [ ] The Route is recalculated and saved after every change that affects it, never as a result of polling, and each recalculation uses the Stops current at the time it runs
- [ ] The Trip page shows a Leaflet map fitted to all Stops, the Route line along roads, and numbered markers matching the list
- [ ] The Stop list is in Route order and shows every Leg (including the Round trip's last Leg back to the Start) and the totals in "km (mi)" and "h min" format
- [ ] The Round trip toggle updates the order, Legs and totals
- [ ] A Trip with 0 or 1 Stops shows no Route or totals
- [ ] The start page shows each Trip's Stop count, total distance and total driving time
- [ ] A new Stop shows "finding its place…" at the bottom until the updated Route arrives
- [ ] When routing fails, the change is saved, the previous Route is kept, and the error is shown; the next successful recalculation clears it; there is no Stop limit
- [ ] The UI calls it an "optimised Route", never "shortest"
- [ ] Trip API tests with a fake routing provider cover known-optimal orders on small inputs, Round trip on and off, a sensible order for 20 Stops, the Start never moving, Legs and totals adding up, 0 and 1 Stop Trips, reordering after a location change, and failure and recovery
