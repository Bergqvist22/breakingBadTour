# Breaking Bad Tour

A small trip planner: you enter locations, and it finds the shortest order to visit them and shows that path on a map, with total distance and travel time.

## Language

**Trip**:
A named collection of Stops that the user plans and revisits.
_Avoid_: Tour, journey, plan

**Stop**:
One location in a Trip, entered as an address or as coordinates. It always has a user-given name and coordinates, and has a street address when one exists at that spot.
_Avoid_: Place, destination, waypoint, address

**Route**:
The ordered path by car along roads through all of a Trip's Stops, with its total driving distance and estimated driving time. It always begins at the Start; the other Stops are ordered to make the total driving time as short as possible.
_Avoid_: Path, way, itinerary

**Leg**:
The drive between two consecutive Stops on a Route, with its own distance and driving time.
_Avoid_: Segment, hop, step

**Start**:
The Stop a Trip's Route always begins at. It is never reordered. It is the first Stop added unless the user picks another, and if it is removed the oldest remaining Stop takes over.
_Avoid_: Origin, home, first stop

**Round trip**:
A Trip whose Route ends by returning to the Start. Without it, the Route ends at whichever Stop makes it shortest.
_Avoid_: Loop, return trip
