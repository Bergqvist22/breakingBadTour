import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import type { TripDto } from "../shared/apiTypes";
import { followLink, navigate } from "./router";
import { ApiError, tripApiClient } from "./tripApiClient";

type Load = { state: "loading" } | { state: "loaded"; trip: TripDto } | { state: "notFound" } | { state: "error"; message: string };

/** One Trip's page: its name, renaming, and deleting (after a "Tread lightly" confirmation). */
export function TripPage({ tripId }: { tripId: string }) {
  const [load, setLoad] = useState<Load>({ state: "loading" });

  useEffect(() => {
    let current = true;
    tripApiClient.getTrip(tripId).then(
      (trip) => current && setLoad({ state: "loaded", trip }),
      (error) => {
        if (!current) return;
        if (error instanceof ApiError && error.status === 404) setLoad({ state: "notFound" });
        else setLoad({ state: "error", message: (error as Error).message });
      },
    );
    return () => {
      current = false;
    };
  }, [tripId]);

  if (load.state === "loading") return <TripShell>Loading…</TripShell>;
  if (load.state === "notFound") return <TripNotFound />;
  if (load.state === "error") {
    return (
      <TripShell>
        <p className="error">Couldn't load this Trip: {load.message}</p>
      </TripShell>
    );
  }

  return (
    <TripDetails
      trip={load.trip}
      onRenamed={(trip) => setLoad({ state: "loaded", trip })}
      onGone={() => setLoad({ state: "notFound" })}
    />
  );
}

function TripShell({ children }: { children: ReactNode }) {
  return (
    <main className="page">
      <BackLink />
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
      <h1>No Trip here</h1>
      <p>This Trip doesn't exist. Someone may have deleted it, or the link is wrong.</p>
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
  onRenamed,
  onGone,
}: {
  trip: TripDto;
  onRenamed: (trip: TripDto) => void;
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
      onRenamed(await tripApiClient.renameTrip(trip.id, newName));
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

      <section className="danger-zone">
        {confirmingDelete ? (
          <div className="confirm-delete" role="alertdialog" aria-labelledby="tread-lightly">
            <p id="tread-lightly">
              <strong>Tread lightly.</strong> Delete “{trip.name}” and all its Stops for good? There's no undo.
            </p>
            <div className="input-row">
              <button type="button" className="danger" onClick={onDelete} disabled={busy}>
                Delete it
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
    </TripShell>
  );
}
