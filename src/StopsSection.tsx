import { useEffect, useId, useState, type FormEvent } from "react";
import type { LegDto, LocationDto, StopDto, TripDto } from "../shared/apiTypes";
import { formatDrive } from "./format";
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

/** The Route to show: none with fewer than two Stops. */
export const shownRoute = (trip: TripDto) => (trip.stops.length >= 2 ? trip.route : null);

/**
 * The Trip's Stops in Route order (numbered like the map's markers), each with the Leg
 * to the next one, the Route's totals and the Round trip switch, and a form to add a Stop.
 */
export function StopsSection({ trip, ...actions }: { trip: TripDto } & TripActions) {
  // The name of a Stop being added: listed last, "finding its place…", until the updated Route arrives.
  const [adding, setAdding] = useState<string | null>(null);
  const route = shownRoute(trip);
  const onRoute = new Set(route?.stopIds);
  const legs = new Map(route?.legs.map((leg) => [`${leg.fromStopId}>${leg.toStopId}`, leg]));
  const legBetween = (from: StopDto, to: string | undefined) => (to ? legs.get(`${from.id}>${to}`) : undefined);

  return (
    <section className="stops">
      <h2>Stops</h2>
      <RouteSummary trip={trip} {...actions} />
      {trip.stops.length === 0 && !adding ? (
        <p>No Stops yet. Add the first one below; it becomes the Start.</p>
      ) : (
        <ol className="stop-list">
          {trip.stops.map((stop, i) => {
            const last = i === trip.stops.length - 1;
            // A Round trip's last Leg goes back to the Start.
            const legToNext = last
              ? trip.roundTrip
                ? legBetween(stop, route?.stopIds[0])
                : undefined
              : legBetween(stop, trip.stops[i + 1].id);
            // Not on the saved Route: still being placed by someone's change, or routing failed.
            const notPlaced = trip.stops.length >= 2 && stop.id !== trip.startStopId && !onRoute.has(stop.id);
            return (
              <StopItem
                key={stop.id}
                tripId={trip.id}
                stop={stop}
                number={i + 1}
                isStart={stop.id === trip.startStopId}
                placement={notPlaced ? (trip.routeError ? "not on the Route yet" : "finding its place…") : null}
                legToNext={legToNext}
                backToStart={last}
                {...actions}
              />
            );
          })}
          {adding && (
            <li className="stop is-adding">
              <div className="stop-heading">
                <span className="stop-number" aria-hidden="true">
                  {trip.stops.length + 1}
                </span>
                <span className="stop-name">{adding}</span>
                <span className="placement">finding its place…</span>
              </div>
            </li>
          )}
        </ol>
      )}
      <AddStop tripId={trip.id} onAdding={setAdding} {...actions} />
    </section>
  );
}

/** The optimised Route's totals, the Round trip switch, and why the Route couldn't be updated, if it couldn't. */
function RouteSummary({ trip, ...actions }: { trip: TripDto } & TripActions) {
  // The Round trip setting asked for, shown straight away while the new Route is worked out.
  const [switching, setSwitching] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const route = shownRoute(trip);

  async function onToggle(roundTrip: boolean) {
    setSwitching(roundTrip);
    setError(await runChange(trip.id, () => tripApiClient.setRoundTrip(trip.id, roundTrip), actions));
    setSwitching(null);
  }

  return (
    <div className="route-summary">
      {route && (
        <p className="totals">
          <span>Optimised Route</span> <strong>{formatDrive(route)}</strong>
        </p>
      )}
      <label className="round-trip">
        <input
          type="checkbox"
          checked={switching ?? trip.roundTrip}
          disabled={switching !== null}
          onChange={(event) => void onToggle(event.target.checked)}
        />
        Round trip: end back at the Start
      </label>
      {switching !== null && <span className="placement"> working out the Route…</span>}
      {trip.routeError && (
        <p className="error" role="status">
          Couldn't update the optimised Route: {trip.routeError}{" "}
          {route ? "Showing the last good Route until the next change works out." : "It will be worked out on the next change."}
        </p>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}

function AddStop({ tripId, onAdding, ...actions }: { tripId: string; onAdding: (name: string | null) => void } & TripActions) {
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
      setError("Every Stop needs a name.");
      return;
    }
    setBusy(true);
    onAdding(name.trim());
    const failure = await runChange(tripId, () => tripApiClient.addStop(tripId, name, picked), actions);
    onAdding(null);
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
          <label htmlFor={nameId}>Name of stop</label>
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
  number,
  isStart,
  placement,
  legToNext,
  backToStart,
  ...actions
}: {
  tripId: string;
  stop: StopDto;
  /** Its place in the list, as on its map marker. */
  number: number;
  isStart: boolean;
  /** Why the Stop isn't in its place on the Route, if it isn't. */
  placement: string | null;
  /** The drive on to the next Stop (or back to the Start), if the Route has it. */
  legToNext: LegDto | undefined;
  /** Whether `legToNext` is the Round trip's way back to the Start. */
  backToStart: boolean;
} & TripActions) {
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
      setError("A Stop needs a name.");
      return;
    }
    await change(() => tripApiClient.renameStop(tripId, stop.id, newName));
  }

  return (
    <li className={isStart ? "stop is-start" : "stop"}>
      <div className="stop-heading">
        <span className="stop-number" aria-hidden="true">
          {number}
        </span>
        <span className="stop-name">{stop.name}</span>
        {isStart && <span className="badge">Start</span>}
        {placement && <span className="placement">{placement}</span>}
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
          <label htmlFor={nameId}>Name of stop</label>
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
      {legToNext && (
        <p className="leg">
          {backToStart ? "↩ Back to the Start: " : "↓ "}
          {formatDrive(legToNext)}
        </p>
      )}
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
