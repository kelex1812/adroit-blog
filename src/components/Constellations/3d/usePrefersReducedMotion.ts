/**
 * usePrefersReducedMotion — G2: bind the 3D scenes to the user's motion
 * preference (a11y regression vs the shipped 2D layer).
 *
 * Reads `matchMedia('(prefers-reduced-motion: reduce)')` and returns a live
 * boolean. SSR-safe (returns false on the server), and re-evaluates when the
 * user toggles the OS setting while the page is open. Passed into
 * SeriesConstellation3D + ProfileGalaxy3D to disable ignition, parallax,
 * drift, film-grain, and camera breathing (staticMode).
 */
"use client";

import { useEffect, useState } from "react";

const QUERY = "(prefers-reduced-motion: reduce)";

/** True when the user prefers reduced motion. SSR → false. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia(QUERY);
    const update = () => setReduced(mql.matches);
    update();
    // Modern browsers: addEventListener; older Safari: addListener.
    mql.addEventListener?.("change", update);
    mql.addListener?.(update);
    return () => {
      mql.removeEventListener?.("change", update);
      mql.removeListener?.(update);
    };
  }, []);

  return reduced;
}
