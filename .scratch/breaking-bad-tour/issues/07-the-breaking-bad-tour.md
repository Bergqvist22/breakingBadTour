# 07 — The Breaking Bad Tour

**What to build:** The app comes with a ready-made "Breaking Bad Tour" Trip, a Round trip through Breaking Bad filming locations in Albuquerque: Walter White's house (the Start), Jesse's house, A1A Car Wash, Los Pollos Hermanos (Twisters), Saul Goodman's office, Crossroads Motel, Dog House Drive-In, and Hank & Marie's house. Its Trip page has the Breaking Bad logo as a header and shows the group's photos (hazmat suits, RV cartoon, Heisenberg stencil). Other Trips, and every Trip created later, have no pictures, and the start page never shows pictures. Group members can edit this Trip like any other.

**Blocked by:** 02 — Go live on Vercel + Neon; 05 — Route; 06 — Breaking Bad theme + phone layout

**Status:** ready-for-agent

- [ ] The address and coordinates of each of the 8 locations are researched from reliable sources and cross-checked against each other, not guessed; any doubtful location is flagged to the user
- [ ] A seeding step creates the Trip with those Stops, Walter White's house as Start, Round trip on and pictures on, and calculates its Route; running it again does not create a duplicate
- [ ] Only Trips with pictures on show the logo header and photos; new Trips never have pictures and there is no UI to turn them on
- [ ] Processed copies of the four repo images have their backgrounds removed (including the checkerboard baked into two of them) and look clean on the dark theme; the original files are left untouched
- [ ] The photos look good on phone and desktop and don't cover the map or the Stop list controls
- [ ] Trip API tests cover the seed creating the Trip once with pictures, and new Trips having none
- [ ] The seed has been run against the live Neon database
