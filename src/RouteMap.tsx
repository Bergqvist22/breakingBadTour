import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useMemo } from "react";
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from "react-leaflet";
import type { RouteDto, StopDto } from "../shared/apiTypes";

/** Where the map looks before a Trip has any Stops: Albuquerque. */
const ALBUQUERQUE: [number, number] = [35.0844, -106.6504];

/**
 * Standard OpenStreetMap tiles (no API key; fine for light use with attribution under
 * the OSMF tile policy), darkened by a CSS filter on the tile layer only (see styles.css).
 * CARTO's dark tiles now need an API key and only show "API KEY REQUIRED" without one.
 */
const TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

/** Numbered marker icons, made once per number (a new icon on every render would rebuild the marker). */
const icons = new Map<string, L.DivIcon>();
function numberedIcon(n: number, isStart: boolean): L.DivIcon {
  const key = `${n}:${isStart}`;
  let icon = icons.get(key);
  if (!icon) {
    icon = L.divIcon({
      className: "stop-marker",
      html: `<span class="stop-marker-tile${isStart ? " is-start" : ""}">${n}</span>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
      tooltipAnchor: [0, -16],
    });
    icons.set(key, icon);
  }
  return icon;
}

/**
 * The Trip on a dark map: its Route along the roads and a numbered marker per
 * Stop, numbered in the same order as the Stop list.
 */
export function RouteMap({ stops, startStopId, route }: { stops: StopDto[]; startStopId: string | null; route: RouteDto | null }) {
  return (
    <MapContainer className="route-map" center={ALBUQUERQUE} zoom={11} scrollWheelZoom>
      <TileLayer url={TILES} maxZoom={19} attribution={ATTRIBUTION} />
      {route && <Polyline positions={route.line} pathOptions={{ color: "#5ad1ff", weight: 5, opacity: 0.9 }} />}
      {stops.map((stop, i) => (
        <Marker key={stop.id} position={[stop.lat, stop.lng]} icon={numberedIcon(i + 1, stop.id === startStopId)}>
          <Tooltip direction="top">{stop.name}</Tooltip>
        </Marker>
      ))}
      <FitToStops stops={stops} />
    </MapContainer>
  );
}

/**
 * Fits the map to all the Stops when the page opens and whenever a Stop is added,
 * removed or moved, but not on every poll or rename, so someone who panned the map
 * isn't yanked back.
 */
function FitToStops({ stops }: { stops: StopDto[] }) {
  const map = useMap();
  const positions = useMemo(() => stops.map((stop): [number, number] => [stop.lat, stop.lng]), [stops]);
  const key = positions
    .map(([lat, lng]) => `${lat},${lng}`)
    .sort()
    .join(";");

  useEffect(() => {
    if (positions.length === 0) return;
    if (positions.length === 1) map.setView(positions[0], 14);
    else map.fitBounds(L.latLngBounds(positions), { padding: [32, 32], maxZoom: 15 });
    // Keyed on the set of positions only; `positions` itself is a new array every render.
  }, [map, key]);

  return null;
}
