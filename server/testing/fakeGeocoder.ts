import { GeocoderError, type GeocodeMatch, type Geocoder } from "../geocoder/geocoder.js";

export type FakePlace = GeocodeMatch;

export interface FakeGeocoderOptions {
  /** Search results by exact query text. Any other query finds nothing. */
  places?: Record<string, FakePlace[]>;
  /** Street addresses by "lat,lng" (as JavaScript prints the numbers). Any other spot has none. */
  streetAddresses?: Record<string, string>;
}

/** A Geocoder with fixed answers, plus a switch to make every lookup fail. */
export function createFakeGeocoder({ places = {}, streetAddresses = {} }: FakeGeocoderOptions = {}) {
  let failing = false;
  const lookups: string[] = [];

  const geocoder: Geocoder & { failWith(on: boolean): void; lookups: string[] } = {
    async search(query) {
      lookups.push(`search:${query}`);
      if (failing) throw new GeocoderError("The fake geocoder is down.");
      return (places[query] ?? []).map((place) => ({ ...place }));
    },
    async streetAddressAt(lat, lng) {
      lookups.push(`reverse:${lat},${lng}`);
      if (failing) throw new GeocoderError("The fake geocoder is down.");
      return streetAddresses[`${lat},${lng}`] ?? null;
    },
    failWith(on) {
      failing = on;
    },
    lookups,
  };
  return geocoder;
}
