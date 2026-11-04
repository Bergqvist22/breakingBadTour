import { useEffect, useRef } from "react";

/** How often open pages ask the Trip API for changes (ADR-0001). */
export const POLL_INTERVAL_MS = 3000;

/**
 * Calls `poll` every `intervalMs` while the component is mounted. A slow call
 * never overlaps the next one, and polling pauses while the tab is hidden
 * (with an immediate catch-up poll when it becomes visible again).
 */
export function usePolling(poll: () => Promise<void>, intervalMs = POLL_INTERVAL_MS) {
  const pollRef = useRef(poll);
  pollRef.current = poll;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    let inFlight = false;

    const schedule = () => {
      clearTimeout(timer);
      if (!stopped && document.visibilityState === "visible") timer = setTimeout(tick, intervalMs);
    };

    const tick = async () => {
      if (inFlight) return;
      inFlight = true;
      try {
        await pollRef.current();
      } catch {
        // The page shows its own errors; just keep polling.
      } finally {
        inFlight = false;
      }
      schedule();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void tick();
      else clearTimeout(timer);
    };

    schedule();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [intervalMs]);
}
