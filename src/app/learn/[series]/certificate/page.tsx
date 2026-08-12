/**
 * /learn/[series]/certificate — certificate of completion page (server).
 *
 * ADR-104 gating + ADR-106 on-demand derivation:
 *  - Guest → GuestCTA placeholder (zero question/cert text in HTML).
 *  - Authed → derive eligibility from lesson_completion + server-graded
 *    quiz_attempt rows (NO certificates table; security t_7469e31d F2 — the
 *    pass decision never reads the client-writable quiz_run history).
 *    Eligible → printable Certificate; not eligible → checklist state
 *    showing exactly what's missing.
 *
 * Rule (course-progression pattern): all {totalLessons} lessons completed AND
 * exam score >= 72%. The slug set counted against "all lessons" is the
 * generator's planned lesson set (content/learn/<series>/questions/<slug>.json),
 * so unpublished lessons with sidecar JSONs still count toward completion.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import Certificate from "@/components/Progress/Certificate";
import GuestCTA from "@/components/Progress/GuestCTA";
import { learnSeries } from "@/data/learn";
import {
  getCertExam,
  getKnowledgeCheck,
  getKnowledgeChecks,
  scoreQuizAttemptRows,
} from "@/lib/quiz";
import { getSeriesBySlug } from "@/lib/learn";
import { buildMetadata } from "@/lib/seo";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import {
  buildCertificateEligibility,
  certificateCompletionDate,
  certificateCourseName,
  certificateRecipientName,
  formatCertDate,
  getSeriesLessonSlugs,
} from "@/lib/certificate";

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
  const s = getSeriesBySlug(series);
  if (!s || getCertExam(series) === null) return {};
  return buildMetadata({
    title: `Certificate of Completion | ${s.name} | Adroit Learn`,
    description: `Printable certificate of completion for the ${s.name} course: all lessons completed and the cert prep exam passed at 72% or higher.`,
    path: `/learn/${series}/certificate`,
  });
}

export default async function CertificatePage({ params }: Props) {
  const { series } = await params;
  const s = getSeriesBySlug(series);
  if (!s) notFound();
  // Certificate is a tier-course feature — no exam file means no certificate.
  if (getCertExam(series) === null) notFound();

  // The "all 46 lessons" rule counts against the course's PLANNED lesson set
  // (the generator's 46 sidecar files), not the published-lesson count
  // (`s.totalLessons` is only 8 today — build-learn.js tracks published MDX).
  const lessonSlugs = getSeriesLessonSlugs(series);
  const totalLessons = lessonSlugs.length;

  const supabase = await getSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  const isAuthed = Boolean(user);

  const pageHead = (
    <>
      <Link
        href={`/learn/${series}`}
        className="inline-flex items-center gap-1.5 text-gray-500 text-xs font-medium no-underline mb-5 hover:text-navy transition-colors duration-150"
      >
        &larr; Back to {s.name}
      </Link>
      <div className="flex items-center gap-2 font-mono text-[11.5px] font-bold text-red uppercase tracking-[0.08em] mb-[14px]">
        <span className="w-[3px] h-3 rounded-sm bg-red" />
        Certificate of Completion
      </div>
      <h1 className="text-[clamp(1.75rem,4vw,2.25rem)] font-extrabold text-navy tracking-[-0.02em] leading-tight mb-3">
        Your certificate
      </h1>
      <p className="text-[15px] text-gray-500 max-w-[600px] leading-relaxed mb-7">
        Issued by Adroit Consulting when all {totalLessons} lessons are completed and the cert
        prep exam is passed at 72% or higher.
      </p>
    </>
  );

  // Guest → CTA placeholder.
  if (!isAuthed) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main id="main" className="flex-1">
          <div className="max-w-[720px] mx-auto px-6 pt-10 pb-24">
            {pageHead}
            <GuestCTA tier="certificate" ariaLabel="Certificate locked" />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Authed — derive eligibility from server-graded quiz_attempt rows (ADR-106;
  // security t_7469e31d F2: quiz_run is client-writable history and must not
  // grant a certificate, so the pass decision never reads it).
  const checkMetas = getKnowledgeChecks(series);
  const checkQuizNames = checkMetas.map((c) => `${series}:check:${c.n}`);
  const examQuizName = `${series}:exam`;

  const [lessonRes, attemptRes] = await Promise.all([
    lessonSlugs.length > 0
      ? supabase
          .from("lesson_completion")
          .select("lesson_slug")
          .eq("user_id", user!.id)
          .in("lesson_slug", lessonSlugs)
      : Promise.resolve({ data: [] as { lesson_slug: string }[], error: null }),
    supabase
      .from("quiz_attempt")
      .select("quiz_name, question_index, is_correct, attempted_at")
      .eq("user_id", user!.id)
      .in("quiz_name", [...checkQuizNames, examQuizName]),
  ]);

  const completedLessonSlugs = ((lessonRes.data ?? []) as { lesson_slug: string }[]).map(
    (r) => r.lesson_slug,
  );

  const attemptRows = (attemptRes.data ?? []) as {
    quiz_name: string;
    question_index: number;
    is_correct: boolean;
    attempted_at?: string | null;
  }[];

  // Exam: score from the graded attempt set; completion date = the latest
  // graded exam answer (quiz_attempt has no run boundaries).
  // Canonical coverage (t_55105899): a partial exam answer set (e.g. 40 of
  // 60 questions, all correct) must NOT derive as 40/40 = 100% and grant a
  // certificate — only a full-coverage set is a valid exam score.
  const examCanonical = getCertExam(series)?.questions.length;
  const examAttempts = attemptRows.filter((r) => r.quiz_name === examQuizName);
  const examScore = scoreQuizAttemptRows(examAttempts, examCanonical);
  const examRuns = examScore
    ? [
        {
          score: examScore.score,
          completedAt:
            examAttempts.reduce<string | null>(
              (max, r) => (r.attempted_at && r.attempted_at > (max ?? "") ? r.attempted_at : max),
              null,
            ) ?? null,
        },
      ]
    : [];

  // Checks: one derived score per check quizName (latest graded answer set),
  // each validated against its canonical question count (t_55105899).
  const checkRuns = checkQuizNames
    .map((quizName, i) => {
      const canonical = checkMetas[i] ? getKnowledgeCheck(series, checkMetas[i]!.n)?.questions.length : undefined;
      const s = scoreQuizAttemptRows(
        attemptRows.filter((r) => r.quiz_name === quizName),
        canonical,
      );
      return s ? { quizName, score: s.score } : null;
    })
    .filter((r): r is { quizName: string; score: number } => r !== null);

  const eligibility = buildCertificateEligibility({
    completedLessonSlugs,
    totalLessons,
    examRuns,
    checkRuns,
    checkQuizNames,
  });

  if (!eligibility.eligible) {
    const lessonsDone = eligibility.lessonsCompleted >= eligibility.lessonsTotal;
    const examStatus =
      eligibility.examBest === 0
        ? "Not taken"
        : eligibility.examPassed
          ? `${eligibility.examBest}% · passed`
          : `${eligibility.examBest}% · not yet`;
    const checksDone = eligibility.checksPassed >= eligibility.checksTotal;

    const OkIcon = (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    );
    const NoIcon = (
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    );

    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main id="main" className="flex-1">
          <div className="max-w-[720px] mx-auto px-6 pt-10 pb-24">
            {pageHead}

            <div className="max-w-[640px] bg-white border border-gray-200 rounded-2xl p-7 shadow-sm">
              <div className="flex items-center gap-2 font-mono text-[11px] font-bold text-gray-500 uppercase tracking-[0.09em] mb-2">
                <span className="w-[3px] h-3 rounded-sm bg-gray-400" />
                Certificate not yet available
              </div>
              <h2 className="text-[1.2rem] font-extrabold text-navy tracking-[-0.02em] mb-2">
                Complete all {eligibility.lessonsTotal} lessons and pass the exam with 72%+
              </h2>
              <p className="text-[13.5px] text-gray-600 leading-relaxed mb-[18px]">
                Your certificate unlocks once both conditions are met. Here&apos;s where you
                stand:
              </p>
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center gap-2.5 text-[13px] text-gray-600">
                  <span
                    className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center ${
                      lessonsDone
                        ? "bg-emerald/[0.12] text-emerald"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {lessonsDone ? OkIcon : NoIcon}
                  </span>
                  <span>
                    All {eligibility.lessonsTotal} lessons completed
                  </span>
                  <span className="font-mono text-[11px] text-gray-500 ml-auto">
                    {eligibility.lessonsCompleted}/{eligibility.lessonsTotal}
                  </span>
                </div>
                <div className="flex items-center gap-2.5 text-[13px] text-gray-600">
                  <span
                    className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center ${
                      eligibility.examPassed
                        ? "bg-emerald/[0.12] text-emerald"
                        : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {eligibility.examPassed ? OkIcon : NoIcon}
                  </span>
                  <span>Cert prep exam passed (≥ 72%)</span>
                  <span className="font-mono text-[11px] text-gray-500 ml-auto">{examStatus}</span>
                </div>
                <div className="flex items-center gap-2.5 text-[13px] text-gray-600">
                  <span
                    className={`w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center ${
                      checksDone ? "bg-emerald/[0.12] text-emerald" : "bg-gray-100 text-gray-500"
                    }`}
                  >
                    {checksDone ? OkIcon : NoIcon}
                  </span>
                  <span>
                    <b className="text-gray-800">Exam unlocked</b> — all {eligibility.checksTotal}{" "}
                    knowledge checks ≥ 80%
                  </span>
                  <span className="font-mono text-[11px] text-gray-500 ml-auto">
                    {eligibility.checksPassed}/{eligibility.checksTotal} checks
                  </span>
                </div>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // Eligible — printable certificate.
  const completedAtIso = certificateCompletionDate(examRuns) ?? new Date().toISOString();
  return (
    <div className="min-h-screen flex flex-col">
      <div className="print:hidden">
        <Header />
      </div>
      <main id="main" className="flex-1">
        <Certificate
          recipientName={certificateRecipientName(user!)}
          courseName={certificateCourseName(series, s.name)}
          completedAt={formatCertDate(completedAtIso)}
          examScore={eligibility.examBest}
          totalLessons={eligibility.lessonsTotal}
        />
      </main>
      <div className="print:hidden">
        <Footer />
      </div>
    </div>
  );
}
