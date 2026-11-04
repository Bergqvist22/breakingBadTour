import { useEffect, useState, type FormEvent } from "react";
import type { TripDto } from "../shared/apiTypes";
import { tripApiClient } from "./tripApiClient";

const lastChangedFormat = new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" });

/** The start page: every Trip, most recently changed first, and a form to cook up a new one. */
export function StartPage() {
  const [trips, setTrips] = useState<TripDto[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  async function refresh() {
    try {
      const list = await tripApiClient.listTrips();
      setTrips(list.trips);
      setLoadError(null);
    } catch (error) {
      setLoadError((error as Error).message);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) {
      setCreateError("Give your Trip a name.");
      return;
    }
    setCreating(true);
    try {
      await tripApiClient.createTrip(name);
      setName("");
      setCreateError(null);
      await refresh();
    } catch (error) {
      setCreateError((error as Error).message);
    } finally {
      setCreating(false);
    }
  }

  return (
    <main className="start-page">
      <h1>Breaking Bad Tour</h1>

      <form className="new-trip" onSubmit={onCreate}>
        <label htmlFor="new-trip-name">Cook up a new Trip</label>
        <div className="new-trip-row">
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
                <span className="trip-name">{trip.name}</span>
                <span className="trip-changed">Changed {lastChangedFormat.format(new Date(trip.updatedAt))}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
