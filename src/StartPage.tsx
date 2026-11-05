import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { TripSummaryDto } from "../shared/apiTypes";
import { followLink, navigate, tripUrl } from "./router";
import { tripApiClient } from "./tripApiClient";
import { usePolling } from "./usePolling";

const lastChangedFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

/** Changes whenever a Trip is added, removed, reordered or changed (its revision moves). */
const listSignature = (trips: TripSummaryDto[]) => trips.map((trip) => `${trip.id}@${trip.revision}`).join(",");

/**
 * The start page: every Trip, most recently changed first, and a form to cook up a new one.
 * Polls every 3 seconds and only re-renders when the list actually changed.
 */
export function StartPage() {
  const [trips, setTrips] = useState<TripSummaryDto[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const shownSignature = useRef<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const list = await tripApiClient.listTrips();
      const signature = listSignature(list.trips);
      if (signature !== shownSignature.current) {
        shownSignature.current = signature;
        setTrips(list.trips);
      }
      setLoadError(null);
    } catch (error) {
      setLoadError((error as Error).message);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  usePolling(refresh);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setCreateError("Give your Trip a name.");
      return;
    }
    setCreating(true);
    try {
      const trip = await tripApiClient.createTrip(name);
      navigate(tripUrl(trip.id));
    } catch (error) {
      setCreateError((error as Error).message);
      setCreating(false);
    }
  }

  return (
    <main className="page">
      <h1>Breaking Bad Tour</h1>

      <form className="new-trip" onSubmit={onCreate}>
        <label htmlFor="new-trip-name">Cook up a new Trip</label>
        <div className="input-row">
          <input
            id="new-trip-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Trip name"
            autoComplete="off"
          />
          <button type="submit" disabled={creating}>
            Cook it up
          </button>
        </div>
        {createError && <p className="error">{createError}</p>}
      </form>

      <section>
        <h2>Trips</h2>
        {loadError && <p className="error">Couldn't load Trips: {loadError}</p>}
        {trips === null && !loadError && <p>Loading…</p>}
        {trips?.length === 0 && <p>No Trips yet. Cook one up above.</p>}
        {trips && trips.length > 0 && (
          <ul className="trip-list">
            {trips.map((trip) => (
              <li key={trip.id}>
                <a href={tripUrl(trip.id)} onClick={followLink}>
                  <span className="trip-name">{trip.name}</span>
                  <span className="trip-changed">Changed {lastChangedFormat.format(new Date(trip.updatedAt))}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
