import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import type { TripDto } from "../shared/apiTypes";
import { AppTitleLink } from "./AppTitle";
import { followLink, navigate } from "./router";
import { RouteMap } from "./RouteMap";
import { shownRoute, StopsSection } from "./StopsSection";
import { ApiError, tripApiClient } from "./tripApiClient";
import { usePolling } from "./usePolling";

type Load = { state: "loading" } | { state: "loaded"; trip: TripDto } | { state: "notFound" } | { state: "error"; message: string };

/**
 * One Trip's page: its name (rename), a map of its Route, its Stops, and deleting (after
 * a "Tread lightly" confirmation). Polls the Trip's revision every 3 seconds and only
 * fetches and re-renders the Trip when it moved.
 */
export function TripPage({ tripId }: { tripId: string }) {
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const shownRevision = useRef<number | null>(null);

  const show = useCallback((trip: TripDto) => {
    // A slow poll can answer after a newer change; never step back to an older revision.
    if (shownRevision.current !== null && trip.revision <= shownRevision.current) return;
    shownRevision.current = trip.revision;
    setLoad({ state: "loaded", trip });
  }, []);

  const gone = useCallback(() => setLoad({ state: "notFound" }), []);

  const refresh = useCallback(async () => {
    try {
      show(await tripApiClient.getTrip(tripId));
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return gone();
      // While polling, keep showing what we have and try again next time.
      setLoad((current) => (current.state === "loaded" ? current : { state: "error", message: (error as Error).message }));
    }
  }, [tripId, show, gone]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  usePolling(async () => {
    if (load.state === "notFound") return;
    if (load.state === "loaded") {
      try {
        // Cheap check first: the whole Trip carries its Route line, so only fetch it when something changed.
        const { revision } = await tripApiClient.getTripRevision(tripId);
        if (shownRevision.current !== null && revision <= shownRevision.current) return;
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return gone();
        return;
      }
    }
    await refresh();
  });

  if (load.state === "loading")
    return (
      <TripShell>
        <p className="loading">Loading the Trip…</p>
      </TripShell>
    );
  if (load.state === "notFound") return <TripNotFound />;
  if (load.state === "error") {
    return (
      <TripShell>
        <p className="error">Couldn't load this Trip: {load.message}</p>
      </TripShell>
    );
  }

  return <TripDetails trip={load.trip} onTripChanged={show} onGone={gone} />;
}

function TripShell({ children }: { children: ReactNode }) {
  return (
    <main className="page trip-page">
      <header className="site-header">
        <AppTitleLink />
        <BackLink />
      </header>
      {children}
    </main>
  );
}

function BackLink() {
  return (
    <a className="back-link" href="/" onClick={followLink}>
      ← All Trips
    </a>
  );
}

/** Shown when the Trip in the URL doesn't exist (never did, or someone deleted it). */
export function TripNotFound() {
  return (
    <main className="page not-found">
      <header className="site-header">
        <AppTitleLink />
      </header>
      <h1>No Trip here</h1>
      <p>This Trip has gone off the grid. Someone may have deleted it, or the link is wrong.</p>
      <p>
        <a href="/" onClick={followLink}>
          Back to all Trips
        </a>
      </p>
    </main>
  );
}

function TripDetails({
  trip,
  onTripChanged,
  onGone,
}: {
  trip: TripDto;
  onTripChanged: (trip: TripDto) => void;
  onGone: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(trip.name);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function startRename() {
    setNewName(trip.name);
    setRenameError(null);
    setRenaming(true);
  }

  async function onRename(event: FormEvent) {
    event.preventDefault();
    if (!newName.trim()) {
      setRenameError("A Trip needs a name.");
      return;
    }
    setBusy(true);
    try {
      onTripChanged(await tripApiClient.renameTrip(trip.id, newName));
      setRenaming(false);
      setRenameError(null);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) return onGone();
      setRenameError((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    setBusy(true);
    try {
      await tripApiClient.deleteTrip(trip.id);
      navigate("/");
    } catch (error) {
      // Someone else deleted it first: the outcome is the same.
      if (error instanceof ApiError && error.status === 404) return navigate("/");
      setDeleteError((error as Error).message);
      setBusy(false);
    }
  }

  return (
    <TripShell>
      {renaming ? (
        <form className="rename-trip" onSubmit={onRename}>
          <label htmlFor="trip-name">Trip name</label>
          <div className="input-row">
            <input
              id="trip-name"
              value={newName}
              onChange={(event) => setNewName(event.target.value)}
              autoComplete="off"
              autoFocus
            />
            <button type="submit" disabled={busy}>
              Save
            </button>
            <button type="button" className="secondary" onClick={() => setRenaming(false)} disabled={busy}>
              Cancel
            </button>
          </div>
          {renameError && <p className="error">{renameError}</p>}
        </form>
      ) : (
        <div className="trip-header">
          <h1>{trip.name}</h1>
          <button type="button" className="secondary" onClick={startRename}>
            Rename
          </button>
        </div>
      )}

      <div className="trip-layout">
        <div className="trip-map">
          <RouteMap stops={trip.stops} startStopId={trip.startStopId} route={shownRoute(trip)} />
        </div>

        <div className="trip-side">
          <StopsSection trip={trip} onTripChanged={onTripChanged} onGone={onGone} />

          <section className="danger-zone">
            {confirmingDelete ? (
              <div className="confirm-delete" role="alertdialog" aria-labelledby="tread-lightly">
                <p id="tread-lightly">
                  <strong>Tread lightly.</strong> Delete “{trip.name}” and all its Stops for good? There's no undo.
                </p>
                <div className="input-row">
                  <button type="button" className="danger" onClick={onDelete} disabled={busy}>
                    Yes, delete it
                  </button>
                  <button type="button" className="secondary" onClick={() => setConfirmingDelete(false)} disabled={busy} autoFocus>
                    Cancel
                  </button>
                </div>
                {deleteError && <p className="error">{deleteError}</p>}
              </div>
            ) : (
              <button type="button" className="danger" onClick={() => setConfirmingDelete(true)}>
                Delete Trip
              </button>
            )}
          </section>
        </div>
      </div>
    </TripShell>
  );
}
