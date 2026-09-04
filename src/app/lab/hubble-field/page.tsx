import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HubbleFieldLabClient } from "./HubbleFieldLabClient";

/**
 * Hubble Field lab — Phase 1 visual observatory.
 * The mockup IS this page. Production ProfileGalaxy3D is untouched.
 *
 * Gated: development by default. Production returns 404 unless
 * ALLOW_HUBBLE_LAB=1 is set (staging review only). noindex + /lab/ robots.
 *
 * dynamic(ssr:false) lives in HubbleFieldLabClient — App Router forbids
 * that option on Server Components.
 */
export const metadata: Metadata = {
  title: "Hubble Field Lab — Adroit",
  description: "Internal WebGL observatory for the constellation visual reboot.",
  robots: { index: false, follow: false },
};

function labAllowed(): boolean {
  if (process.env.NODE_ENV === "development") return true;
  return process.env.ALLOW_HUBBLE_LAB === "1";
}

export default function HubbleFieldLabPage() {
  if (!labAllowed()) notFound();
  return <HubbleFieldLabClient />;
}
