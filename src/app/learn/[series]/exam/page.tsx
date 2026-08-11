/**
 * /learn/[series]/exam — cert prep exam page (server component).
 *
 * Gating (ADR-104 + Decision 9):
 *  - Guest → GuestCTA (zero question text in HTML).
 *  - Authed, any check best < 80 or missing → ExamLocked with per-check
 *    progress (rows link to the check pages).
 *  - Authed, all 9 checks ≥ 80 → ExamWidget (timed, auto-submit, ≥72% pass).
 */
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ExamWidget from "@/components/Progress/ExamWidget";
import ExamLocked from "@/components/Progress/ExamLocked";
import GuestCTA from "@/components/Progress/GuestCTA";
import { learnSeries } from "@/data/learn";
import { getCertExam, getKnowledgeChecks } from "@/lib/quiz";
import { getSeriesBySlug } from "@/lib/learn";
import { buildMetadata } from "@/lib/seo";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { CheckProgress } from "@/shared/contracts";

interface Props {
  params: Promise<{ series: string }>;
}

export const dynamic = "force-dynamic";

export async function generateStaticParams() {
  return learnSeries
    .filter((s) => getCertExam(s.slug) !== null)
    .map((s) => ({ series: s.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { series } = await params;
  const exam = getCertExam(series);
  const s = getSeriesBySlug(series);
  if (!exam || !s) return {};
  return buildMetadata({
    title: `${exam.title} — Adroit Learn`,
    description: exam.description ?? `Certification prep exam for ${s.name}.`,
    path: `/learn/${series}/exam`,
  });
}

const CHECK_PASS_PCT = 80;

export default async function ExamPage({ params }: Props) {
  const { series } = await params;
  const s = getSeriesBySlug(series);
  if (!s) notFound();

  const exam = getCertExam(series);
  if (!exam) notFound();

  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isAuthed = Boolean(user);

  // Guest → CTA placeholder.
  if (!isAuthed) {
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
            <div className="flex items-center gap-2 font-mono text-[11.5px] font-bold text-navy uppercase tracking-[0.08em] mb-[14px]">
              <span className="w-[3px] h-3 rounded-sm bg-navy" />
              Cert Prep Exam
            </div>
            <h1 className="text-[clamp(1.75rem,4vw,2.25rem)] font-extrabold text-navy tracking-[-0.02em] leading-tight mb-3">
              Certification Prep Exam
            </h1>
            <p className="text-[15px] text-gray-500 max-w-[600px] leading-relaxed mb-7">
              60 questions · 105 minutes · pass ≥ 72%
            </p>
            <GuestCTA tier="exam" ariaLabel="Cert prep exam locked" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Authed — derive per-check best scores from quiz_run rows.
  const checkMetas = getKnowledgeChecks(series);
  const quizNames = checkMetas.map((c) => `${series}:check:${c.n}`);
  const { data } = await supabase
    .from("quiz_run")
    .select("quiz_name, score")
    .eq("user_id", user!.id)
    .in("quiz_name", quizNames);

  const bestByQuiz = new Map<string, number>();
  for (const row of (data ?? []) as { quiz_name: string; score: number }[]) {
    const cur = bestByQuiz.get(row.quiz_name) ?? -1;
    bestByQuiz.set(row.quiz_name, Math.max(cur, row.score));
  }

  const checks: CheckProgress[] = checkMetas.map((c) => {
    const bestScore = bestByQuiz.get(`${series}:check:${c.n}`) ?? 0;
    return { n: c.n, bestScore, attempts: 0, passed: bestScore >= CHECK_PASS_PCT };
  });
  const allPassed = checks.every((c) => c.passed);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main id="main" className="flex-1">
        {allPassed ? (
          <ExamWidget
            quizName={exam.quizName}
            questions={exam.questions}
            seriesSlug={series}
            seriesName={s.name}
          />
        ) : (
          <div className="pt-6">
            <Link
              href={`/learn/${series}`}
              className="max-w-[720px] mx-auto px-6 inline-flex items-center gap-1.5 text-gray-500 text-xs font-medium no-underline mb-2 hover:text-navy transition-colors duration-150"
            >
              &larr; Back to {s.name}
            </Link>
            <ExamLocked series={series} checks={checks} seriesName={s.name} />
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
