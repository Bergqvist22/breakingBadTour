/** A place a location search found. */
export interface GeocodeMatch {
  /** Full description to pick from, e.g. "Albuquerque, Bernalillo County, New Mexico, United States". */
  label: string;
  /** The address to keep on a Stop: a street address when there is one, otherwise the place's description. */
  address: string;
  lat: number;
  lng: number;
}

/**
 * Turns text into places and coordinates into street addresses.
 * The real one talks to OpenStreetMap Nominatim; tests use a fake.
 */
export interface Geocoder {
  /** Places matching free text, best first. May return more than the API shows. */
  search(query: string): Promise<GeocodeMatch[]>;
  /** The street address at this spot, or null when there is none (never a county or area name). */
  streetAddressAt(lat: number, lng: number): Promise<string | null>;
}

/** The lookup service couldn't be reached or refused the request (maps to HTTP 502). */
export class GeocoderError extends Error {}
