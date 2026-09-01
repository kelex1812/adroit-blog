"use client";

import { useEffect } from "react";
import { initAnalytics } from "@/lib/analytics";

/**
 * GA4 initializer (backlog B-06 / D5). Mounted once in the root layout to load
 * gtag.js after hydration. Env-gated inside initAnalytics — a no-op until
 * NEXT_PUBLIC_GA_MEASUREMENT_ID is configured, so this renders nothing and
 * ships zero bytes of GA code to visitors until analytics is switched on.
 */
export default function AnalyticsInit() {
  useEffect(() => {
    initAnalytics();
  }, []);

  return null;
}
