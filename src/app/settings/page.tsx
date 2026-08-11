/**
 * /settings — account settings page (server component).
 *
 * Session gate: same pattern as /profile — SSR client reads the
 * HttpOnly cookie; guests redirect to /login?next=/settings.
 *
 * Honest-stub rule: every control that has no backend renders static
 * with a visible COMING SOON badge. No save bar, no toggle input, no
 * fake dialog trigger — nothing appears functional before its API
 * exists.
 */
import { redirect } from "next/navigation";
import type { Metadata } from "next";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import StubBadge from "@/components/StubBadge";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { buildMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = buildMetadata({
  title: "Settings — Adroit Blog",
  path: "/settings",
  description: "Account and reading preferences for Adroit Academy.",
});

const kicker = "inline-flex items-center gap-2 font-mono text-[11px] font-semibold text-red uppercase tracking-[0.08em] mb-3";

export default async function SettingsPage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/settings");

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main id="main" className="flex-1">
        <div className="max-w-[560px] mx-auto px-6 py-14">
          <div className="inline-flex items-center gap-2 font-mono text-[11px] font-semibold text-red uppercase tracking-[0.08em] mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-red" />
            Adroit Academy — Settings
          </div>
          <h1 className="text-3xl font-extrabold text-navy tracking-[-0.02em] mb-2">Settings</h1>
          <p className="text-[14px] text-gray-500 mb-7">
            Account and reading preferences for Adroit Academy.
          </p>

          {/* Section 1 — Reading progress (real data exists, but clearing needs a new API) */}
          <section
            aria-labelledby="sec-reading"
            className="bg-white rounded-[20px] border border-gray-200 shadow-card p-6 mb-6"
          >
            <h2 id="sec-reading" className={kicker}>
              <span className="w-1.5 h-1.5 rounded-full bg-red" />
              Reading progress
            </h2>
            <div className="flex items-center justify-between gap-4 py-3">
              <div>
                <div className="text-[14px] font-semibold text-gray-800">Clear reading history</div>
                <div className="text-xs text-gray-400">
                  Wipes read/unread and quiz stats from your account.
                </div>
              </div>
              <StubBadge />
            </div>
          </section>

          {/* Section 2 — Email updates (needs a subscribe table; no backend today) */}
          <section
            aria-labelledby="sec-email"
            className="bg-white rounded-[20px] border border-gray-200 shadow-card p-6"
          >
            <h2 id="sec-email" className={kicker}>
              <span className="w-1.5 h-1.5 rounded-full bg-red" />
              Email updates
            </h2>
            <div className="flex items-center justify-between gap-4 py-3">
              <div>
                <div className="text-[14px] font-semibold text-gray-800">Email me new posts</div>
                <div className="text-xs text-gray-400">When the Adroit blog publishes.</div>
              </div>
              <span className="flex items-center gap-2">
                <StubBadge />
                {/* Static non-functional switch — aria-hidden, no interaction */}
                <span
                  aria-hidden="true"
                  className="relative inline-flex h-5 w-9 shrink-0 items-center rounded-full bg-gray-200"
                >
                  <span className="inline-block h-4 w-4 translate-x-0.5 rounded-full bg-white shadow-sm" />
                </span>
              </span>
            </div>
          </section>
        </div>
      </main>
      <Footer />
    </div>
  );
}
