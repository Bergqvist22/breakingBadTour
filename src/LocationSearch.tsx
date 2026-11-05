import { useId, useState, type FormEvent } from "react";
import type { LocationDto } from "../shared/apiTypes";
import { tripApiClient } from "./tripApiClient";

type SearchState =
  | { state: "idle" }
  | { state: "searching" }
  | { state: "found"; matches: LocationDto[] }
  | { state: "error"; message: string };

/**
 * Search an address or type "lat, lng", then pick one of up to 5 matches.
 * Searches only on submit, never as you type (Nominatim's usage policy).
 */
export function LocationSearch({
  label,
  onPick,
  autoFocus = false,
}: {
  label: string;
  onPick: (location: LocationDto) => void;
  autoFocus?: boolean;
}) {
  const inputId = useId();
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState<SearchState>({ state: "idle" });

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    // Search forms can sit inside other forms' areas; never let the submit bubble further.
    event.stopPropagation();
    if (!query.trim()) {
      setSearch({ state: "error", message: "Type an address, or coordinates like 35.1258, -106.5361." });
      return;
    }
    setSearch({ state: "searching" });
    try {
      const { matches } = await tripApiClient.searchLocations(query);
      setSearch({ state: "found", matches });
    } catch (error) {
      setSearch({ state: "error", message: (error as Error).message });
    }
  }

  return (
    <div className="location-search">
      <form onSubmit={onSubmit}>
        <label htmlFor={inputId}>{label}</label>
        <div className="input-row">
          <input
            id={inputId}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Address, or 35.1258, -106.5361"
            autoComplete="off"
            autoFocus={autoFocus}
          />
          <button type="submit" disabled={search.state === "searching"}>
            {search.state === "searching" ? "Searching…" : "Search"}
          </button>
        </div>
      </form>

      {search.state === "error" && <p className="error">{search.message}</p>}
      {search.state === "found" && search.matches.length === 0 && (
        <p className="notice">Nothing found for “{query.trim()}”. Try different wording, add the city, or type coordinates.</p>
      )}
      {search.state === "found" && search.matches.length > 0 && (
        <ul className="matches" aria-label="Matches">
          {search.matches.map((match, index) => (
            <li key={`${match.lat},${match.lng},${index}`}>
              <button type="button" className="match" onClick={() => onPick(match)}>
                <span>{match.label}</span>
                <span className="coords">{formatCoordinates(match)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** "35.1258, -106.5361": the form Google Maps accepts when pasted. */
export function formatCoordinates({ lat, lng }: { lat: number; lng: number }) {
  return `${lat}, ${lng}`;
}
