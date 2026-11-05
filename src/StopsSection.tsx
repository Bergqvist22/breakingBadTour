import { useEffect, useId, useState, type FormEvent } from "react";
import type { LocationDto, StopDto, TripDto } from "../shared/apiTypes";
import { formatCoordinates, LocationSearch } from "./LocationSearch";
import { ApiError, tripApiClient } from "./tripApiClient";

/** What every Stop change hands back: the updated Trip, or a 404 meaning the Trip is gone. */
interface TripActions {
  onTripChanged: (trip: TripDto) => void;
  onGone: () => void;
}

/** Runs a Trip API call, passing the updated Trip up; returns an error message, or null on success. */
async function runChange(
  tripId: string,
  call: () => Promise<TripDto>,
  { onTripChanged, onGone }: TripActions,
): Promise<string | null> {
  try {
    onTripChanged(await call());
    return null;
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 404)) return (error as Error).message;
    // Either the Trip or the Stop is gone; find out which and catch up.
    try {
      onTripChanged(await tripApiClient.getTrip(tripId));
      return "Someone else just removed that Stop.";
    } catch (refetchError) {
      if (refetchError instanceof ApiError && refetchError.status === 404) onGone();
      return null;
    }
  }
}

/** The Trip's Stops in the order they were added, and a form to add another. */
export function StopsSection({ trip, ...actions }: { trip: TripDto } & TripActions) {
  return (
    <section className="stops">
      <h2>Stops</h2>
      {trip.stops.length === 0 ? (
        <p>No Stops yet. Add the first one below; it becomes the Start.</p>
      ) : (
        <ol className="stop-list">
          {trip.stops.map((stop) => (
            <StopItem key={stop.id} tripId={trip.id} stop={stop} isStart={stop.id === trip.startStopId} {...actions} />
          ))}
        </ol>
      )}
      <AddStop tripId={trip.id} {...actions} />
    </section>
  );
}

function AddStop({ tripId, ...actions }: { tripId: string } & TripActions) {
  const nameId = useId();
  const [picked, setPicked] = useState<LocationDto | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Remount the search after adding, so it starts empty.
  const [searchKey, setSearchKey] = useState(0);

  async function onAdd(event: FormEvent) {
    event.preventDefault();
    if (!picked) return;
    if (!name.trim()) {
      setError("Say my name: every Stop needs a name.");
      return;
    }
    setBusy(true);
    const failure = await runChange(tripId, () => tripApiClient.addStop(tripId, name, picked), actions);
    setBusy(false);
    setError(failure);
    if (!failure) {
      setPicked(null);
      setName("");
      setSearchKey((key) => key + 1);
    }
  }

  return (
    <div className="add-stop">
      <h3>Add a Stop</h3>
      {picked ? (
        <form onSubmit={onAdd}>
          <p className="picked">
            <span>{picked.address ?? "No street address here"}</span>
            <span className="coords">{formatCoordinates(picked)}</span>
            <button type="button" className="secondary small" onClick={() => setPicked(null)} disabled={busy}>
              Pick another
            </button>
          </p>
          <label htmlFor={nameId}>Say my name</label>
          <div className="input-row">
            <input
              id={nameId}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Walt's house"
              autoComplete="off"
              autoFocus
            />
            <button type="submit" disabled={busy}>
              Add Stop
            </button>
          </div>
          {error && <p className="error">{error}</p>}
        </form>
      ) : (
        <LocationSearch key={searchKey} label="Where to?" onPick={setPicked} />
      )}
    </div>
  );
}

type Editing = "none" | "rename" | "move";

function StopItem({
  tripId,
  stop,
  isStart,
  ...actions
}: { tripId: string; stop: StopDto; isStart: boolean } & TripActions) {
  const nameId = useId();
  const [editing, setEditing] = useState<Editing>("none");
  const [newName, setNewName] = useState(stop.name);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function change(call: () => Promise<TripDto>) {
    setBusy(true);
    const failure = await runChange(tripId, call, actions);
    setBusy(false);
    setError(failure);
    if (!failure) setEditing("none");
  }

  function startEditing(mode: Editing) {
    setNewName(stop.name);
    setError(null);
    setEditing(mode);
  }

  async function onRename(event: FormEvent) {
    event.preventDefault();
    if (!newName.trim()) {
      setError("Say my name: a Stop needs a name.");
      return;
    }
    await change(() => tripApiClient.renameStop(tripId, stop.id, newName));
  }

  return (
    <li className={isStart ? "stop is-start" : "stop"}>
      <div className="stop-heading">
        <span className="stop-name">{stop.name}</span>
        {isStart && <span className="badge">Start</span>}
      </div>
      {stop.address && (
        <div className="stop-detail">
          <span>{stop.address}</span>
          <CopyButton text={stop.address} label="Copy address" />
        </div>
      )}
      <div className="stop-detail">
        <span className="coords">{formatCoordinates(stop)}</span>
        <CopyButton text={formatCoordinates(stop)} label="Copy coordinates" />
      </div>

      {editing === "rename" && (
        <form className="stop-edit" onSubmit={onRename}>
          <label htmlFor={nameId}>Say my name</label>
          <div className="input-row">
            <input id={nameId} value={newName} onChange={(event) => setNewName(event.target.value)} autoComplete="off" autoFocus />
            <button type="submit" disabled={busy}>
              Save
            </button>
            <button type="button" className="secondary" onClick={() => setEditing("none")} disabled={busy}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {editing === "move" && (
        <div className="stop-edit">
          <LocationSearch
            label={`Move “${stop.name}” to`}
            autoFocus
            onPick={(location) => void change(() => tripApiClient.moveStop(tripId, stop.id, location))}
          />
          <button type="button" className="secondary small" onClick={() => setEditing("none")} disabled={busy}>
            Cancel
          </button>
        </div>
      )}

      {editing === "none" && (
        <div className="stop-actions">
          <button type="button" className="secondary small" onClick={() => startEditing("rename")}>
            Rename
          </button>
          <button type="button" className="secondary small" onClick={() => startEditing("move")}>
            Move
          </button>
          {!isStart && (
            <button
              type="button"
              className="secondary small"
              onClick={() => void change(() => tripApiClient.makeStart(tripId, stop.id))}
              disabled={busy}
            >
              Make Start
            </button>
          )}
          <button
            type="button"
            className="danger small"
            onClick={() => void change(() => tripApiClient.removeStop(tripId, stop.id))}
            disabled={busy}
          >
            Remove
          </button>
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </li>
  );
}

/** Copies text for pasting into Google Maps, with brief "Copied" feedback. */
function CopyButton({ text, label }: { text: string; label: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");

  useEffect(() => {
    if (status === "idle") return;
    const timer = setTimeout(() => setStatus("idle"), 1500);
    return () => clearTimeout(timer);
  }, [status]);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
  }

  return (
    <button type="button" className="secondary small copy" onClick={onCopy} aria-label={`${label}: ${text}`}>
      {status === "copied" ? "Copied" : status === "failed" ? "Couldn't copy" : label}
    </button>
  );
}
