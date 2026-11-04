import type { ErrorDto, TripDto, TripListDto } from "../shared/apiTypes";

/** Browser-side client for the Trip API. The browser only ever talks to `/api`, never the database. */

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = (await response.json().catch(() => null)) as T | ErrorDto | null;
  if (!response.ok) {
    const message = json && typeof json === "object" && "error" in json ? json.error : `Request failed (${response.status}).`;
    throw new Error(message);
  }
  return json as T;
}

export const tripApiClient = {
  listTrips: () => request<TripListDto>("GET", "/api/trips"),
  createTrip: (name: string) => request<TripDto>("POST", "/api/trips", { name }),
};
