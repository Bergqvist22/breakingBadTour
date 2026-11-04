# Routes minimise driving time, near-optimally, with no Stop cap

The Route orders Stops to minimise total driving time by car (not distance), using road travel times between every pair of Stops and a fast heuristic that gets close to optimal, because the group expects about 20 Stops, where guaranteed-shortest ordering is too slow for an interactive app. There is deliberately no Stop limit; if the free routing service rejects a very large Trip (around 100 Stops), the app keeps the last good Route and shows a clear error instead of enforcing a cap.

## Consequences

The UI calls it an "optimised Route", never "the shortest". Users cannot reorder Stops manually; their only controls are the Start and the Round trip toggle.
