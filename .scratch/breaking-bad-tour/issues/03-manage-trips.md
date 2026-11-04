# 03 — Manage Trips

**What to build:** A group member clicks a Trip on the start page to open its Trip page (empty for now apart from its name), renames it, or deletes it after a "Tread lightly" confirmation. The start page picks up Trips that others create, rename or delete within about 3 seconds, without reloading. See ADR-0001 (polling).

**Blocked by:** 01 — Walking skeleton: create and list Trips

**Status:** resolved

- [x] Clicking a Trip on the start page opens that Trip's page, which has its own URL that can be shared and reloaded
- [x] A newly created Trip opens straight away
- [x] A Trip can be renamed from its page; an empty name is rejected
- [x] Deleting a Trip asks for confirmation ("Tread lightly"); cancelling keeps it; confirming deletes it and returns to the start page
- [x] Every Trip carries a revision or last-changed value that changes on every mutation
- [x] The start page polls every 3 seconds and only re-renders when something changed
- [x] Opening a Trip that no longer exists shows a friendly "not found" with a way back
- [x] Trip API tests cover get, rename, delete, a missing Trip, and revision changes
