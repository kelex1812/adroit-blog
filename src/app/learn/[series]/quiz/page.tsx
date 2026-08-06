import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import QuizWidget from "@/components/Progress/QuizWidget";
import { learnSeries } from "@/data/learn";
import { getSeriesBySlug, seriesShortLabel } from "@/lib/learn";
import { getQuizForSeries } from "@/lib/quiz";
import { buildMetadata, siteConfig } from "@/lib/seo";

interface Props {
  params: Promise<{ series: string }>;
}

export async function generateStaticParams() {
  return learnSeries
    .filter((s) => getQuizForSeries(s.slug) !== null)
    .map((s) => ({ series: s.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { series } = await params;
  const quiz = getQuizForSeries(series);
  const s = getSeriesBySlug(series);
  if (!quiz || !s) return {};
  return buildMetadata({
    title: `${quiz.title} — Adroit Learn`,
    description: quiz.description ?? `Practice quiz for ${s.name}.`,
    path: `/learn/${series}/quiz`,
  });
}

/**
 * /learn/[series]/quiz — practice quiz for a learning path.
 * Loads questions from content/<series>/questions.json and renders the
 * interactive QuizWidget (localStorage-only attempts per ADR-004).
 */
export default async function SeriesQuizPage({ params }: Props) {
  const { series } = await params;
  const s = getSeriesBySlug(series);
  if (!s) notFound();

  const quiz = getQuizForSeries(series);
  if (!quiz) notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    url: `${siteConfig.url}/learn/${series}/quiz`,
    mainEntity: quiz.questions.map((q) => ({
      "@type": "Question",
      name: q.question,
      acceptedAnswer: {
        "@type": "Answer",
        text:
          q.options[q.correct_answer_index] +
          (q.explanation ? ` — ${q.explanation}` : ""),
      },
    })),
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main id="main" className="flex-1">
        <div className="max-w-[720px] mx-auto px-6 pt-10 pb-24">
          <Link
            href={`/learn/${series}`}
            className="inline-flex items-center gap-1.5 text-gray-500 text-xs font-medium no-underline mb-5 hover:text-navy transition-colors duration-150"
          >
            &larr; Back to {s.name}
          </Link>

          {/* Series crumb */}
          <div className="flex items-center gap-2 font-mono text-[11.5px] font-semibold text-gray-500 mb-[18px]">
            <span className="bg-red text-white px-2 py-0.5 rounded-[5px] font-bold">
              Quiz
            </span>
            <span>
              {seriesShortLabel(series)} &middot;{" "}
              <Link
                href={`/learn/${series}`}
                className="text-gray-500 no-underline hover:text-navy transition-colors duration-150"
              >
                {s.name}
              </Link>
            </span>
          </div>

          <h1 className="text-[clamp(1.75rem,4vw,2.25rem)] font-extrabold text-navy tracking-[-0.02em] leading-tight mb-3">
            {quiz.title}
          </h1>
          {quiz.description && (
            <p className="text-[15px] text-gray-500 max-w-[560px] leading-relaxed mb-8">
              {quiz.description}
            </p>
          )}

          <QuizWidget quizName={quiz.quizName} questions={quiz.questions} />
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
