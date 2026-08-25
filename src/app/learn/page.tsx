import Header from "@/components/Header";
import Footer from "@/components/Footer";
import LearnHub from "@/components/Learn/LearnHub";
import { getAllSeries, toLearnCardSeries } from "@/lib/learn";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { siteConfig } from "@/lib/seo";
import type { CardGateState } from "@/shared/contracts-account";
import { accessSeam, getAccessUserId } from "@/lib/access";

/**
 * /learn hub — group/subgroup filters, Continue Learning (signed-in), and one
 * PathCard per learning path. Guests see non-clickable cards with a sign-in
 * CTA (name + description stay server-rendered for SEO); signed-in users get
 * clickable cards with real per-series progress on the card body.
 *
 * Guest hardening (t_3dbf4826): the client receives a slimmed LearnCardSeries
 * projection — only what the PathCard/filters render. Per-lesson metadata
 * (title/excerpt/date/author/readTime/tags) is mapped away server-side and
 * never ships in the guest bundle. Signed-in cards additionally carry lesson
 * slugs for SeriesProgress.
 */
export default async function LearnLandingPage() {
  let series = getAllSeries();

  // Auth state (guest vs signed-in) resolved server-side from the HttpOnly
  // cookie — the same source as every other gated surface.
  let gate: CardGateState = "guest-locked";
  try {
    const supabase = await getSupabaseServerClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) gate = "signed-in";
  } catch {
    // default to guest on session errors
  }

  // Access seam (ADR-201): DB-backed status. Live courses visible to all;
  // pending/archived additionally to admins. A content series with no `courses`
  // row (or non-live) is hidden from members. canAccess flows to the cards so
  // locked cards render a lock (vs click-through).
  try {
    const userId = await getAccessUserId();
    const catalog = await accessSeam.getCatalogForUser(userId);
    const visibleSlugs = new Set(
      catalog.entries.filter((e) => e.visible).map((e) => e.course.series_slug),
    );
    series = series.filter((s) => visibleSlugs.has(s.slug));
  } catch {
    // DB unreachable → keep content-derived series (degraded but non-breaking);
    // the per-course pages still enforce the seam.
  }

  // Slim the payload at the server boundary: guests get card-render fields only.
  const cardSeries = series.map((s) =>
    toLearnCardSeries(s, { includeLessonSlugs: gate === "signed-in" }),
  );

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Adroit Learn — Learning Paths",
    description:
      "Structured, sequence-aware learning paths on Salesforce architecture, OmniStudio certification, and agentic AI implementation.",
    itemListElement: series.map((s, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: s.name,
      url: `${siteConfig.url}/learn/${s.slug}`,
    })),
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main id="main" className="flex-1">
        {/* Learn hero — typographic display, not a stock photo */}
        <section className="relative overflow-hidden">
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(55% 110% at 85% -15%, rgba(200,16,46,0.06) 0%, transparent 60%), radial-gradient(45% 90% at 10% -20%, rgba(11,29,58,0.07) 0%, transparent 55%)",
            }}
          />
          <div className="max-w-[1120px] mx-auto px-6 pt-14 pb-24 relative hero-fade-in">
            <div className="inline-flex items-center gap-2 font-mono text-[11px] font-semibold text-[var(--accent)] uppercase tracking-[0.08em] mb-[18px]">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
              Adroit Academy
            </div>
            <h1 className="text-[clamp(2.5rem,5vw,3.25rem)] font-extrabold tracking-[-0.03em] leading-[1.05] text-[var(--ink-primary)] mb-4 bg-gradient-to-r from-[var(--ink-primary)] to-[var(--surface-inverse-hover)] dark:to-[#94A3B8] bg-clip-text text-transparent">
              Learn
            </h1>
            <p className="text-[17px] text-[var(--ink-muted)] max-w-[560px] leading-relaxed">
              Structured, sequence-aware learning paths on Salesforce
              architecture, certification prep, and agentic AI implementation —
              published daily, read in order.
            </p>

            {/* Filters + continue-learning + card grid (client orchestrator) */}
            <div className="mt-8">
              <LearnHub series={cardSeries} gate={gate} />
            </div>
          </div>
        </section>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </main>

      <Footer />
    </div>
  );
}
