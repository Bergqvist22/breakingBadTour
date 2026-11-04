import { createTripApiFromEnv } from "../server/config.js";
import { handleWebRequest } from "../server/http/adapters.js";

// Vercel server function serving every `/api/*` route (see the rewrite in vercel.json).
const api = createTripApiFromEnv();

const handle = (request: Request) => handleWebRequest(api, request);

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
