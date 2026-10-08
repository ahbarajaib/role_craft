import { useSyncExternalStore } from "react";

/**
 * Returns true when the viewport width is below the given breakpoint (default 768px).
 * Safe for SSR — returns false on the server.
 */
export function useIsMobile(breakpoint = 768): boolean {
  return useSyncExternalStore(
    (callback) => {
      const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
      mq.addEventListener("change", callback);
      return () => mq.removeEventListener("change", callback);
    },
    () => window.matchMedia(`(max-width: ${breakpoint - 1}px)`).matches,
    () => false
  );
}
