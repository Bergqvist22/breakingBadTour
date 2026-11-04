# Shared Trips with no login, synced by polling

All Trips are one shared set: anyone with the link can view, create, edit and delete any Trip, with no accounts or password. The app is for a small group of friends, and the group chose zero friction over keeping strangers out. Open pages poll for changes every 3 seconds rather than using live push updates; this keeps the backend to plain Vercel functions over Neon Postgres, with no realtime service to run.

## Considered Options

- **Local browser storage**: rejected because several people need to see the same Trips.
- **Shared group password**: rejected by choice, not difficulty. Add it if strangers ever start editing Trips.
- **Supabase or Firebase talking to the database from the browser, with realtime updates**: rejected in favour of one Vercel account, with the database credentials kept on the server.

## Consequences

The Route order is computed once when Stops change and saved with the Trip, so every viewer sees the same order and polling never triggers a recalculation. Destructive actions such as deleting a Trip ask for confirmation, because there is no undo or ownership.
