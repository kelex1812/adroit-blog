import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import LessonCard from "@/components/Learn/LessonCard";
import LessonProgress from "@/components/Learn/LessonProgress";
import EmptyState from "@/components/Learn/EmptyState";
import { learnSeries } from "@/data/learn";
import {
  getLessonsForSeries,
  getSeriesBySlug,
  getSeriesProgress,
  seriesShortLabel,
} from "@/lib/learn";
import { buildMetadata, siteConfig } from "@/lib/seo";

interface Props {
  params: Promise<{ series: string }>;
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

export default async function SeriesPage({ params }: Props) {
  const { series } = await params;
  const s = getSeriesBySlug(series);
  if (!s) notFound();

  // Defensive newest-first (ADR-002) — never trust generated order blindly.
  const lessons = getLessonsForSeries(series);
  const { published, total } = getSeriesProgress(s);
  const upcoming = Math.max(0, total - published);

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
            className={`rounded-2xl overflow-hidden relative bg-gradient-to-br ${s.gradient} p-8 pb-7`}
          >
            <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold text-white uppercase tracking-[0.07em] bg-white/20 backdrop-blur-sm px-[11px] py-1 rounded-full mb-3.5">
              {seriesShortLabel(s.slug)}
            </span>
            <h1 className="text-[clamp(1.5rem,3vw,2rem)] font-extrabold text-white tracking-[-0.02em] mb-2 leading-tight">
              {s.name}
            </h1>
            <p className="text-white/80 text-sm max-w-[560px] leading-relaxed mb-5">
              {s.description}
            </p>
            {total > 0 && (
              <div className="max-w-[420px]">
                <LessonProgress
                  published={published}
                  total={total}
                  onGradient
                />
              </div>
            )}
          </div>
        </div>

        {/* Syllabus — newest first */}
        <div className="max-w-[1120px] mx-auto px-6 py-8 pb-24">
          {lessons.length > 0 ? (
            <>
              <div className="flex items-baseline justify-between px-2 mb-1.5">
                <h2 className="font-mono text-[13px] font-bold text-gray-400 uppercase tracking-[0.08em]">
                  Newest First
                </h2>
                <span className="font-mono text-[11.5px] text-gray-400 font-medium">
                  {published} published · {upcoming} upcoming
                </span>
              </div>
              <div className="border-t border-gray-200 mt-3">
                {lessons.map((lesson, i) => (
                  <LessonCard
                    key={lesson.slug}
                    lesson={lesson}
                    totalLessons={total}
                    isNewest={i === 0}
                  />
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
