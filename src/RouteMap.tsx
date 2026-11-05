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
/** The Route line's colour: crystal blue (matches --crystal in styles.css). */
const CRYSTAL_BLUE = "#5fd4ff";

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
      iconSize: [34, 34],
      iconAnchor: [17, 17],
      tooltipAnchor: [0, -17],
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
      {route && (
        <>
          {/* A soft glow under the line, so the crystal blue reads on the dark map. */}
          <Polyline positions={route.line} pathOptions={{ color: CRYSTAL_BLUE, weight: 14, opacity: 0.22, interactive: false }} />
          <Polyline positions={route.line} pathOptions={{ color: CRYSTAL_BLUE, weight: 5, opacity: 0.95, interactive: false }} />
        </>
      )}
      {stops.map((stop, i) => (
        <Marker key={stop.id} position={[stop.lat, stop.lng]} icon={numberedIcon(i + 1, stop.id === startStopId)}>
          <Tooltip direction="top">{stop.name}</Tooltip>
        </Marker>
      ))}
      <FitToStops stops={stops} />
      <FollowContainerSize />
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

/** Redraws the map when its box changes size (e.g. the phone/desktop layout switch), so no tiles go missing. */
function FollowContainerSize() {
  const map = useMap();

  useEffect(() => {
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(map.getContainer());
    return () => observer.disconnect();
  }, [map]);

  return null;
}
