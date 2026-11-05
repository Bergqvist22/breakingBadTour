import net from "node:net";

/**
 * Local-only network tweak, imported by the dev server (vite.config.ts) and local
 * scripts, never by the Vercel function.
 *
 * Node tries IPv6 and IPv4 addresses in turn ("happy eyeballs") and gives each
 * attempt only 250 ms by default. On a network without working IPv6 and with a
 * slower connect to Neon (~0.4 s), every attempt times out and fetch fails with
 * ETIMEDOUT. Giving each attempt 2 s fixes that. Same effect as
 * NODE_OPTIONS=--network-family-autoselection-attempt-timeout=2000.
 */
const LOCAL_CONNECT_ATTEMPT_TIMEOUT_MS = 2000;

if (net.getDefaultAutoSelectFamilyAttemptTimeout() < LOCAL_CONNECT_ATTEMPT_TIMEOUT_MS) {
  net.setDefaultAutoSelectFamilyAttemptTimeout(LOCAL_CONNECT_ATTEMPT_TIMEOUT_MS);
}
