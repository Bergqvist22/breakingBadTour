import { GeocoderError, type GeocodeMatch, type Geocoder } from "./geocoder.js";

/**
 * Nominatim's usage policy asks for an identifying User-Agent, at most one
 * request per second, and no search-as-you-type (the web app only searches on submit).
 * https://operations.osmfoundation.org/policies/nominatim/
 */
export const DEFAULT_USER_AGENT = "breaking-bad-tour/0.1 (+https://github.com/bergqvist22/breakingBadTour)";

export interface NominatimOptions {
  userAgent?: string;
  baseUrl?: string;
  /** Minimum gap between requests from this process. */
  minIntervalMs?: number;
  timeoutMs?: number;
}

/** The parts of Nominatim's `address` object we read. */
interface NominatimAddress {
  house_number?: string;
  road?: string;
  city?: string;
  town?: string;
  village?: string;
  hamlet?: string;
  state?: string;
  postcode?: string;
}

interface NominatimPlace {
  lat: string;
  lon: string;
  display_name: string;
  address?: NominatimAddress;
}

/**
 * "3828 Piermont Drive Northeast, Albuquerque, New Mexico 87191", or null unless the
 * spot has both a house number and a road. Reverse lookups otherwise fall back to a
 * road, a county or a state, which the spec says never to show as an address.
 */
export function streetAddressOf(address: NominatimAddress | undefined): string | null {
  if (!address?.house_number || !address.road) return null;
  const locality = address.city ?? address.town ?? address.village ?? address.hamlet;
  const region = [address.state, address.postcode].filter(Boolean).join(" ");
  return [`${address.house_number} ${address.road}`, locality, region].filter(Boolean).join(", ");
}

/** A Geocoder over the public OpenStreetMap Nominatim service. */
export function createNominatimGeocoder({
  userAgent = DEFAULT_USER_AGENT,
  baseUrl = "https://nominatim.openstreetmap.org",
  minIntervalMs = 1100,
  timeoutMs = 10_000,
}: NominatimOptions = {}): Geocoder {
  // Requests from this process go one at a time, spaced out to respect the rate limit.
  let queue: Promise<unknown> = Promise.resolve();
  let lastRequestAt = 0;

  function throttled<T>(task: () => Promise<T>): Promise<T> {
    const run = queue.then(async () => {
      const wait = lastRequestAt + minIntervalMs - Date.now();
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      lastRequestAt = Date.now();
      return task();
    });
    queue = run.catch(() => undefined);
    return run;
  }

  async function get(path: string, params: Record<string, string>): Promise<unknown> {
    const url = `${baseUrl}${path}?${new URLSearchParams({ format: "jsonv2", addressdetails: "1", ...params })}`;
    return throttled(async () => {
      let response: Response;
      try {
        response = await fetch(url, {
          headers: { "User-Agent": userAgent, "Accept-Language": "en", Accept: "application/json" },
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (error) {
        throw new GeocoderError(`Nominatim couldn't be reached: ${(error as Error).message}`);
      }
      if (!response.ok) throw new GeocoderError(`Nominatim answered HTTP ${response.status} for ${path}.`);
      try {
        return await response.json();
      } catch {
        throw new GeocoderError(`Nominatim sent a response that isn't JSON for ${path}.`);
      }
    });
  }

  return {
    async search(query) {
      const body = await get("/search", { q: query, limit: "5" });
      if (!Array.isArray(body)) throw new GeocoderError("Nominatim search didn't return a list.");
      return (body as NominatimPlace[]).map(
        (place): GeocodeMatch => ({
          label: place.display_name,
          address: streetAddressOf(place.address) ?? place.display_name,
          lat: Number(place.lat),
          lng: Number(place.lon),
        }),
      );
    },

    async streetAddressAt(lat, lng) {
      const body = (await get("/reverse", { lat: String(lat), lon: String(lng), zoom: "18" })) as
        | (NominatimPlace & { error?: undefined })
        | { error: string };
      // Nominatim answers HTTP 200 with {"error":"Unable to geocode"} for spots with nothing there (e.g. the ocean).
      if (!body || typeof body !== "object" || "error" in body) return null;
      return streetAddressOf(body.address);
    },
  };
}
