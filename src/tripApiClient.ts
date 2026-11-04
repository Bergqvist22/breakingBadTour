import type { ErrorDto, TripDto, TripListDto } from "../shared/apiTypes";

/** Browser-side client for the Trip API. The browser only ever talks to `/api`, never the database. */

/** A Trip API call failed; `status` is the HTTP status (0 if the server couldn't be reached). */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Couldn't reach the server.", 0);
  }
  const json = (await response.json().catch(() => null)) as T | ErrorDto | null;
  if (!response.ok) {
    const message = json && typeof json === "object" && "error" in json ? json.error : `Request failed (${response.status}).`;
    throw new ApiError(message, response.status);
  }
  return json as T;
}

const tripPath = (id: string) => `/api/trips/${encodeURIComponent(id)}`;

export const tripApiClient = {
  listTrips: () => request<TripListDto>("GET", "/api/trips"),
  createTrip: (name: string) => request<TripDto>("POST", "/api/trips", { name }),
  getTrip: (id: string) => request<TripDto>("GET", tripPath(id)),
  renameTrip: (id: string, name: string) => request<TripDto>("PATCH", tripPath(id), { name }),
  deleteTrip: (id: string) => request<void>("DELETE", tripPath(id)),
};
