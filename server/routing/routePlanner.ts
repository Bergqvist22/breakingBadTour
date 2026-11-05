/**
 * The Route planner (ADR-0002): orders Stops to minimise total driving time.
 * Pure: it only sees a travel-time matrix, never Stops or the network.
 */

/**
 * The order to visit every point in, beginning at `start`, that makes the total
 * driving time as short as possible. `durations[i][j]` is the time from i to j
 * and need not equal the time from j to i. With `roundTrip`, the drive from the
 * last point back to `start` counts too; without it, the Route ends wherever is fastest.
 *
 * Exact up to EXACT_LIMIT points; above that, a heuristic that gets very close.
 * Deterministic: the same input always gives the same order.
 */
export function planOrder(durations: number[][], start: number, roundTrip: boolean): number[] {
  if (durations.length <= EXACT_LIMIT) return exactOrder(durations, start, roundTrip);
  return heuristicOrder(durations, start, roundTrip);
}

/** Up to this many points the planner tries every order (Held–Karp stays instant). */
const EXACT_LIMIT = 10;

/** Time differences smaller than this (in the matrix's unit, seconds) are rounding noise. */
const EPSILON = 1e-6;

/** Marks the end of a Route without Round trip: it can end anywhere, so driving "to" it takes no time. */
const END = -1;

/**
 * A Route as the heuristic works on it: the start, the other points, then a fixed
 * sentinel (the start again for a Round trip, END otherwise), so that both kinds
 * are priced the same way.
 */
type Path = number[];

const toPath = (order: number[], roundTrip: boolean): Path => [...order, roundTrip ? order[0] : END];
const toOrder = (path: Path) => path.slice(0, -1);

function pathTime(path: Path, durations: number[][]): number {
  let time = 0;
  for (let k = 1; k < path.length; k++) if (path[k] !== END) time += durations[path[k - 1]][path[k]];
  return time;
}

/**
 * Builds a Route by nearest neighbour, polishes it by local search, then keeps
 * shaking it up (swapping two stretches of the Route) and polishing again,
 * holding on to the best Route found. The shake-ups come from a fixed-seed
 * generator and a fixed number of rounds, so the result is deterministic.
 */
function heuristicOrder(durations: number[][], start: number, roundTrip: boolean): number[] {
  let best = improve(toPath(nearestNeighbourOrder(durations, start), roundTrip), durations);
  let bestTime = pathTime(best, durations);
  const random = seededRandom(durations.length);
  const rounds = Math.max(20, Math.floor(3000 / durations.length));
  for (let round = 0; round < rounds; round++) {
    const candidate = improve(shakeUp(best, random), durations);
    const time = pathTime(candidate, durations);
    if (time < bestTime - EPSILON) {
      best = candidate;
      bestTime = time;
    }
  }
  return toOrder(best);
}

/** From the start, always drive to the nearest point not visited yet. */
function nearestNeighbourOrder(durations: number[][], start: number): number[] {
  const order = [start];
  const left = new Set(durations.map((_, i) => i).filter((i) => i !== start));
  while (left.size > 0) {
    const here = order[order.length - 1];
    let nearest = -1;
    for (const i of left) if (nearest === -1 || durations[here][i] < durations[here][nearest]) nearest = i;
    order.push(nearest);
    left.delete(nearest);
  }
  return order;
}

/** A small deterministic pseudo-random generator (a linear congruential one), giving numbers in [0, 1). */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 2 ** 32;
  };
}

/** Swaps two neighbouring stretches of the Route (A B C D becomes A C B D), keeping the start and sentinel. */
function shakeUp(path: Path, random: () => number): Path {
  const movable = path.length - 2;
  if (movable < 3) return path;
  const cuts = new Set<number>();
  while (cuts.size < 3) cuts.add(1 + Math.floor(random() * movable));
  const [p, q, r] = [...cuts].sort((a, b) => a - b);
  return [...path.slice(0, p), ...path.slice(q, r), ...path.slice(p, q), ...path.slice(r)];
}

/**
 * Local search: keeps taking any run of consecutive points (never the start or the
 * sentinel) and moving it elsewhere in the Route, forwards or reversed, while that
 * saves time. This covers both 2-opt moves (reversing a run in place) and or-opt
 * moves (moving a run). Each move is priced in constant time from running totals.
 */
function improve(start: Path, durations: number[][]): Path {
  const cost = (from: number, to: number) => (to === END ? 0 : durations[from][to]);
  let path = start;
  const last = path.length - 2; // the last point that may move
  // forward[k]: time along path[0] → … → path[k]; backward[k]: time along path[k] → … → path[0].
  const forward = new Float64Array(path.length);
  const backward = new Float64Array(path.length);
  const updateTotals = () => {
    for (let k = 1; k <= last; k++) {
      forward[k] = forward[k - 1] + durations[path[k - 1]][path[k]];
      backward[k] = backward[k - 1] + durations[path[k]][path[k - 1]];
    }
  };

  /** The best way to move the run path[i..j] that saves time, as the new path, or undefined if none does. */
  function betterMove(i: number, j: number): Path | undefined {
    const first = path[i];
    const end = path[j];
    const before = path[i - 1];
    const after = path[j + 1];
    const inside = forward[j] - forward[i];
    const insideReversed = backward[j] - backward[i];
    const taken = cost(before, first) + inside + cost(end, after);
    const closed = cost(before, after);

    // Reverse the run where it is.
    if (j > i && cost(before, end) + insideReversed + cost(first, after) < taken - EPSILON) {
      return [...path.slice(0, i), ...path.slice(i, j + 1).reverse(), ...path.slice(j + 1)];
    }
    // Move the run between path[k] and path[k + 1], forwards or reversed.
    for (let k = 0; k <= last; k++) {
      if (k >= i - 1 && k <= j) continue;
      const a = path[k];
      const b = path[k + 1];
      const opened = closed - cost(a, b) - taken;
      const forwards = opened + cost(a, first) + inside + cost(end, b);
      const reversed = opened + cost(a, end) + insideReversed + cost(first, b);
      if (forwards < -EPSILON || reversed < -EPSILON) {
        const run = path.slice(i, j + 1);
        if (reversed < forwards) run.reverse();
        const rest = [...path.slice(0, i), ...path.slice(j + 1)];
        const place = k < i ? k + 1 : k - run.length + 1;
        return [...rest.slice(0, place), ...run, ...rest.slice(place)];
      }
    }
    return undefined;
  }

  for (let improved = true; improved; ) {
    improved = false;
    updateTotals();
    for (let i = 1; i <= last; i++) {
      for (let j = i; j <= last; j++) {
        const moved = betterMove(i, j);
        if (moved) {
          // Carry on from here with the improved Route rather than starting the scan over.
          path = moved;
          updateTotals();
          improved = true;
        }
      }
    }
  }
  return path;
}


/**
 * The best order, found by dynamic programming over subsets (Held–Karp):
 * O(2^n · n²), instant for about 10 points.
 */
function exactOrder(durations: number[][], start: number, roundTrip: boolean): number[] {
  const others = durations.map((_, i) => i).filter((i) => i !== start);
  const m = others.length;
  if (m === 0) return [start];

  const subsets = 1 << m;
  // best[set * m + j]: least time to leave the start, visit exactly `set`, and end at others[j] (in `set`).
  const best = new Float64Array(subsets * m).fill(Infinity);
  const previous = new Int32Array(subsets * m).fill(-1);
  for (let j = 0; j < m; j++) best[(1 << j) * m + j] = durations[start][others[j]];

  for (let set = 1; set < subsets; set++) {
    for (let j = 0; j < m; j++) {
      const time = best[set * m + j];
      if (!(set & (1 << j)) || time === Infinity) continue;
      for (let k = 0; k < m; k++) {
        if (set & (1 << k)) continue;
        const next = set | (1 << k);
        const candidate = time + durations[others[j]][others[k]];
        if (candidate < best[next * m + k]) {
          best[next * m + k] = candidate;
          previous[next * m + k] = j;
        }
      }
    }
  }

  const all = subsets - 1;
  let end = 0;
  let bestTotal = Infinity;
  for (let j = 0; j < m; j++) {
    const total = best[all * m + j] + (roundTrip ? durations[others[j]][start] : 0);
    if (total < bestTotal) {
      bestTotal = total;
      end = j;
    }
  }

  const reversed: number[] = [];
  for (let set = all, j = end; j !== -1; ) {
    reversed.push(others[j]);
    const before = previous[set * m + j];
    set &= ~(1 << j);
    j = before;
  }
  return [start, ...reversed.reverse()];
}
