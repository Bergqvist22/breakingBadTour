# 04 — Stops

**What to build:** On a Trip page, a group member adds Stops and manages them. To add a Stop, they type an address and pick from up to 5 matches, or type coordinates such as "35.1258, -106.5361", then give it a required name ("Say my name"). Coordinates get their street address looked up; if there's no street address at that spot, only the coordinates are shown. Each Stop shows its name, address (when it has one) and coordinates, with buttons to copy either for Google Maps. Stops can be renamed, moved to a new location, removed with one click, and made the Start. The first Stop added is the Start; if the Start is removed, the oldest remaining Stop takes over. The open Trip page picks up others' changes every 3 seconds. There's no map or ordering yet: Stops are listed in the order they were added. Address lookup goes through the server via a geocoder interface over OpenStreetMap Nominatim, with a fake for tests. See the spec and `GLOSSARY.md` (Stop, Start).

**Blocked by:** 03 — Manage Trips

**Status:** ready-for-agent

- [ ] Searching an address shows up to 5 matches to pick from, or a clear "nothing found" message
- [ ] Typed coordinates are recognised and used as typed, with the street address looked up when one exists and left empty otherwise (never a county or area name)
- [ ] A Stop can't be added without a name
- [ ] Each Stop shows its name, address when present, and coordinates, with copy buttons
- [ ] A Stop can be renamed (empty rejected) and moved by searching a new address or typing new coordinates
- [ ] A Stop can be removed with one click
- [ ] The first Stop added becomes the Start; any Stop can be made the Start; removing the Start hands it to the oldest remaining Stop
- [ ] Address lookups go through the server with an identifying User-Agent, search on submit only (no autocomplete), and show a clear message when the lookup service fails
- [ ] The Trip page polls every 3 seconds and only re-renders when something changed
- [ ] Trip API tests with a fake geocoder cover adding by address and by coordinates, no street address, the required name, rename, change location, remove, and all Start rules
