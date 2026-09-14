"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Subscribe to a CSS media query.
 *
 * Presentation-only helper used to choose between a desktop and
 * mobile layout when CSS alone cannot express the difference
 * (e.g. an anchored dropdown vs a bottom sheet).
 */
export function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const mediaQuery = window.matchMedia(query);

      mediaQuery.addEventListener("change", onStoreChange);

      return () => {
        mediaQuery.removeEventListener("change", onStoreChange);
      };
    },
    [query],
  );

  const getSnapshot = useCallback(() => {
    return window.matchMedia(query).matches;
  }, [query]);

  const getServerSnapshot = useCallback(() => false, []);

  return useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
}
