import { useSyncExternalStore, type MouseEvent } from "react";

/**
 * A tiny History-API router: the app has two kinds of page, so a routing
 * library would be overkill. Every page has a real URL that can be shared
 * and reloaded (the dev server and `vercel.json` serve index.html for them).
 */

export type Route = { page: "start" } | { page: "trip"; tripId: string } | { page: "unknown" };

export const tripUrl = (tripId: string) => `/trips/${encodeURIComponent(tripId)}`;

export function parseRoute(pathname: string): Route {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (path === "/") return { page: "start" };
  const tripMatch = /^\/trips\/([^/]+)$/.exec(path);
  if (tripMatch) return { page: "trip", tripId: decodeURIComponent(tripMatch[1]) };
  return { page: "unknown" };
}

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("popstate", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("popstate", listener);
  };
}

export function navigate(url: string, { replace = false } = {}) {
  if (replace) window.history.replaceState(null, "", url);
  else window.history.pushState(null, "", url);
  window.scrollTo(0, 0);
  listeners.forEach((listener) => listener());
}

/** The current page, re-rendering on navigation and on the browser's back/forward buttons. */
export function useRoute(): Route {
  const pathname = useSyncExternalStore(subscribe, () => window.location.pathname);
  return parseRoute(pathname);
}

/** Click handler for in-app links: navigates without a reload, but leaves ctrl/cmd-click and friends alone. */
export function followLink(event: MouseEvent<HTMLAnchorElement>) {
  if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  navigate(event.currentTarget.getAttribute("href") ?? "/");
}
