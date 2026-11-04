import type { IncomingMessage, ServerResponse } from "node:http";
import type { ApiResponse, TripApi } from "../tripApi.js";

/** Thin HTTP adapters around the Trip API. All behaviour lives in `TripApi.handle`. */

type ParsedBody = { ok: true; value: unknown } | { ok: false };

function parseJsonBody(text: string): ParsedBody {
  if (!text.trim()) return { ok: true, value: undefined };
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false };
  }
}

const invalidJson: ApiResponse = { status: 400, body: { error: "The request body is not valid JSON." } };
const internalError: ApiResponse = { status: 500, body: { error: "Something went wrong on the server." } };

async function dispatch(api: TripApi, method: string, path: string, bodyText: string): Promise<ApiResponse> {
  const parsed = parseJsonBody(bodyText);
  if (!parsed.ok) return invalidJson;
  try {
    return await api.handle({ method, path, body: parsed.value });
  } catch (error) {
    console.error(error);
    return internalError;
  }
}

/**
 * Web-standard Request → Response (Vercel functions). `vercel.json` rewrites
 * `/api/<route>` to `/api?route=<route>`, so the original path is rebuilt from that.
 */
export async function handleWebRequest(api: TripApi, request: Request): Promise<Response> {
  const url = new URL(request.url);
  const route = url.searchParams.get("route");
  const path = route !== null ? `/api/${route}` : url.pathname;
  const bodyText = request.method === "GET" || request.method === "HEAD" ? "" : await request.text();

  const response = await dispatch(api, request.method, path, bodyText);
  return Response.json(response.body, { status: response.status });
}

async function readNodeBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks).toString("utf8");
}

/** Connect-style middleware serving `/api/*` from Node's http server (Vite dev and preview). */
export function createNodeApiMiddleware(getApi: () => TripApi) {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname !== "/api" && !url.pathname.startsWith("/api/")) return next();

    const response = await dispatch(getApi(), req.method ?? "GET", url.pathname, await readNodeBody(req));
    res.statusCode = response.status;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(response.body));
  };
}
