import { notFound } from "next/navigation";
import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import LessonCard from "@/components/Learn/LessonCard";
import LessonProgress from "@/components/Learn/LessonProgress";
import EmptyState from "@/components/Learn/EmptyState";
import SortToggle from "@/components/BlogListing/SortToggle";
import { learnSeries } from "@/data/learn";
import {
  getLessonsForSeries,
  getSeriesBySlug,
  getSeriesProgress,
  seriesShortLabel,
} from "@/lib/learn";
import { sortPosts } from "@/lib/sort";
import { buildMetadata, siteConfig } from "@/lib/seo";
import MarkComplete from "@/components/Progress/MarkComplete";
import SeriesProgress from "@/components/Progress/SeriesProgress";
import { getQuizForSeries } from "@/lib/quiz";

interface Props {
  params: Promise<{ series: string }>;
  searchParams: Promise<{ sort?: string }>;
}

export async function generateStaticParams() {
  return learnSeries.map((s) => ({ series: s.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { series } = await params;
  const s = getSeriesBySlug(series);
  if (!s) return {};
  return buildMetadata({
    title: `${s.name} — Adroit Learn`,
    description: s.description,
    path: `/learn/${series}`,
  });
}

export default async function SeriesPage({ params, searchParams }: Props) {
  const { series } = await params;
  const { sort } = await searchParams;
  const s = getSeriesBySlug(series);
  if (!s) notFound();

  // Defensive newest-first (ADR-002) — never trust generated order blindly.
  const baseLessons = getLessonsForSeries(series);
  const lessons = sortPosts(baseLessons, sort === "oldest" ? "oldest" : "newest");
  const { published, total } = getSeriesProgress(s);
  const upcoming = Math.max(0, total - published);
  const hasQuiz = getQuizForSeries(series) !== null;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "LearningPath",
    name: s.name,
    description: s.description,
    url: `${siteConfig.url}/learn/${series}`,
    hasPart: {
      "@type": "ItemList",
      itemListElement: lessons.map((l, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: `Lesson ${l.lesson}: ${l.title}`,
        url: `${siteConfig.url}/learn/${series}/${l.slug}`,
      })),
    },
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        {/* Series header strip */}
        <div className="max-w-[1120px] mx-auto px-6 pt-9">
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
            <h1 className="relative text-[clamp(1.5rem,3vw,2rem)] font-extrabold text-white tracking-[-0.02em] mb-2 leading-tight">
              {s.name}
            </h1>
            <p className="relative text-white/80 text-sm max-w-[560px] leading-relaxed mb-5">
              {s.description}
            </p>
            {hasQuiz && (
              <Link
                href={`/learn/${series}/quiz`}
                className="relative inline-flex items-center gap-2 px-5 py-2 rounded-full bg-white text-navy text-sm font-bold no-underline shadow-md hover:bg-gray-100 transition-colors duration-150"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 11l3 3L22 4" />
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
                Take the quiz
              </Link>
            )}
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
                    lessonSlugs={lessons.map((l) => l.slug)}
                    showPercent
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Syllabus — newest first */}
        <div className="max-w-[1120px] mx-auto px-6 py-8 pb-24">
          {lessons.length > 0 ? (
            <>
              <div className="flex items-center justify-between px-2 mb-1.5">
                <h2 className="font-mono text-[13px] font-bold text-gray-400 uppercase tracking-[0.08em]">
                  {sort === "oldest" ? "Oldest First" : "Newest First"}
                </h2>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[11.5px] text-gray-400 font-medium">
                    {published} published · {upcoming} upcoming
                  </span>
                  <Suspense fallback={null}>
                    <SortToggle compact />
                  </Suspense>
                </div>
              </div>
              <div className="border-t border-gray-200 mt-3">
                {lessons.map((lesson, i) => (
                  <div key={lesson.slug} className="relative">
                    <LessonCard
                      lesson={lesson}
                      totalLessons={total}
                      isNewest={sort !== "oldest" && i === 0}
                    />
                    {/* Per-lesson completion tracking */}
                    <div className="flex items-center justify-between px-3 py-2">
                      <span className="font-mono text-[10px] font-bold text-gray-400 uppercase tracking-[0.07em]">
                        Mark complete
                      </span>
                      <MarkComplete lessonSlug={lesson.slug} label={`lesson ${lesson.slug}`} />
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState />
          )}
        </div>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </main>

      <Footer />
    </div>
  );
}
