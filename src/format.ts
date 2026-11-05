/** Display formats for distances and driving times (the spec's "87 km (54 mi)" and "1 h 32 min"). */

const METERS_PER_MILE = 1609.344;

/** Whole numbers from 10 up, one decimal below (so short Legs don't all read "0 km"). */
function amount(value: number): string {
  return value >= 9.95 ? String(Math.round(value)) : String(Math.round(value * 10) / 10);
}

/** "87 km (54 mi)", or "4.2 km (2.6 mi)" for short distances. */
export function formatDistance(meters: number): string {
  return `${amount(meters / 1000)} km (${amount(meters / METERS_PER_MILE)} mi)`;
}

/** "1 h 32 min", "2 h", or "14 min" under an hour. */
export function formatDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes === 0) return seconds > 0 ? "< 1 min" : "0 min";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

/** "87 km (54 mi) · 1 h 32 min" */
export function formatDrive({ distanceMeters, durationSeconds }: { distanceMeters: number; durationSeconds: number }) {
  return `${formatDistance(distanceMeters)} · ${formatDuration(durationSeconds)}`;
}
