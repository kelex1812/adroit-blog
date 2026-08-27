import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import LessonProgress from "@/components/Learn/LessonProgress";
import EmptyState from "@/components/Learn/EmptyState";
import SeriesSyllabus from "@/components/Learn/SeriesSyllabus";
import { learnSeries } from "@/data/learn";
import {
  getLessonsForSeries,
  getSeriesBySlug,
  getSeriesProgress,
  seriesShortLabel,
} from "@/lib/learn";
import { buildMetadata, siteConfig } from "@/lib/seo";
import SeriesProgress from "@/components/Progress/SeriesProgress";
import QuizStats from "@/components/Progress/QuizStats";
import CertReadiness from "@/components/Progress/CertReadiness";
import CheckCardList from "@/components/Progress/CheckCardList";
import ExamCard from "@/components/Progress/ExamCard";
import { getKnowledgeChecks } from "@/lib/quiz";
import { accessSeam, getAccessUserId, getCourseRowBySlug } from "@/lib/access";
import { StatusBadge } from "@/components/Catalog/StatusBadge";
import { AccessModelChip } from "@/components/Catalog/AccessModelChip";

interface Props {
  params: Promise<{ series: string }>;
}

/**
 * This page resolves the signed-in user's access decision from the request's
 * HttpOnly session cookie + Supabase (ADR-201). Those inputs only exist at
 * request time, so the page MUST render dynamically — a static prerender
 * would bake a guest/no-access snapshot into HTML and serve it to everyone.
 * force-dynamic also prevents the build from executing the Supabase access
 * seam at build time (env absent in CI).
 */
export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  return learnSeries.map((s) => ({ series: s.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { series } = await params;
  const s = getSeriesBySlug(series);
  if (!s) return {};
  return buildMetadata({
    title: `${s.name} | Adroit Learn`,
    description: s.description,
    path: `/learn/${series}`,
  });
}

export default async function SeriesPage({ params }: Props) {
  const { series } = await params;
  const s = getSeriesBySlug(series);
  if (!s) notFound();

  // Access seam gate (ADR-201): DB-backed status. not-launched (no courses row,
  // or non-live + non-admin) → 404. The syllabus stays readable on a live course
  // even when the member isn't entitled (US-004) — content-tier links gate via
  // the lesson page seam.
  const userId = await getAccessUserId();
  const decision = await accessSeam.decideCourseAccess(userId, series);
  if (decision.kind === "not-launched") notFound();
  const courseRow = await getCourseRowBySlug(series);

  // Lesson-number ordering (ADR-105) — the syllabus client re-sorts on
  // toggle; the server always passes the canonical asc order.
  const baseLessons = getLessonsForSeries(series);
  const { published, total } = getSeriesProgress(s);
  const upcoming = Math.max(0, total - published);

  // Tier presence (ADR-101): omni-studio-cert ships checks + exam; non-tier
  // series (sfarch, agentic) keep the legacy quiz behaviour.
  const checksMeta = getKnowledgeChecks(series);
  const hasTiers = checksMeta.length > 0;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LearningPath",
    name: s.name,
    description: s.description,
    url: `${siteConfig.url}/learn/${series}`,
    hasPart: {
      "@type": "ItemList",
      itemListElement: baseLessons.map((l, i) => ({
        "@type": "ListItem",
        position: i + 1,
        // lesson.title already carries the "Lesson N:" prefix (t_fa2f15c7)
        name: l.title,
        url: `${siteConfig.url}/learn/${series}/${l.slug}`,
      })),
    },
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main id="main" className="flex-1">
        {/* Series header strip */}
        <div className="max-w-[1120px] mx-auto px-6 pt-14">
          <Link
            href="/learn"
            className="inline-flex items-center gap-1.5 text-gray-500 text-xs font-medium no-underline mb-6 hover:text-navy transition-colors duration-150"
          >
            &larr; Back to Learn
          </Link>

          <div
            className={`rounded-2xl overflow-hidden relative bg-gradient-to-br ${s.gradient} p-8 pb-7 shadow-lg shadow-navy/10`}
          >
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(circle at 85% 15%, rgba(255,255,255,0.22) 0%, transparent 45%)",
              }}
            />
            <span className="relative inline-flex items-center gap-1.5 font-mono text-[11px] font-bold text-white uppercase tracking-[0.07em] bg-white/20 backdrop-blur-sm px-[11px] py-1 rounded-full mb-3.5">
              {seriesShortLabel(s.slug)}
            </span>
            {/* DB-backed status + access model (platform source of truth) */}
            {courseRow && (
              <span className="relative mb-3.5 ml-1.5 inline-flex items-center gap-2">
                <StatusBadge status={courseRow.status} />
                <AccessModelChip model={courseRow.access_model} />
              </span>
            )}
            <h1 className="relative text-[clamp(1.5rem,3vw,2rem)] font-extrabold text-white tracking-[-0.02em] mb-2 leading-tight">
              {s.name}
            </h1>
            <p className="relative text-white/80 text-sm max-w-[560px] leading-relaxed mb-5">
              {s.description}
            </p>
            {total > 0 && (
              <div className="relative max-w-[420px]">
                <LessonProgress
                  published={published}
                  total={total}
                  onGradient
                />
                {/* Real user completion progress */}
                <div className="mt-3">
                  <SeriesProgress
                    lessonSlugs={baseLessons.map((l) => l.slug)}
                    showPercent
                  />
                </div>
                {/* Tier-aware readiness rollup (tier series) or legacy quiz stats */}
                {hasTiers ? (
                  <CertReadiness series={series} onGradient />
                ) : (
                  <div className="mt-2.5">
                    <QuizStats seriesSlug={series} onGradient />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Syllabus — lesson-number order (ADR-105), client sort + hide-completed */}
        <div className="max-w-[1120px] mx-auto px-6 py-8 pb-4">
          {baseLessons.length > 0 ? (
            <Suspense fallback={null}>
              <SeriesSyllabus
                lessons={baseLessons}
                totalLessons={total}
                published={published}
                upcoming={upcoming}
              />
            </Suspense>
          ) : (
            <EmptyState />
          )}
        </div>

        {/* Tier sections — checks + exam card (only for tiered courses) */}
        {hasTiers && (
          <>
            <CheckCardList series={series} checksMeta={checksMeta} />
            <ExamCard series={series} totalChecks={checksMeta.length} />
          </>
        )}

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </main>

      <Footer />
    </div>
  );
}
