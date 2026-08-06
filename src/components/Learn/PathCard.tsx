import Link from "next/link";
import { LearningSeries } from "@/data/types";
import { seriesShortLabel } from "@/lib/learn";
import LessonProgress from "./LessonProgress";
import QuizStats from "@/components/Progress/QuizStats";

interface PathCardProps {
  series: LearningSeries;
}

/** Landing-page card per learning path (mockup: learn-landing.html). */
export default function PathCard({ series }: PathCardProps) {
  const empty = series.lessons.length === 0;

  return (
    <Link
      href={`/learn/${series.slug}`}
      className="group block rounded-2xl overflow-hidden border border-gray-200 bg-white hover:shadow-xl hover:shadow-navy/10 hover:border-gray-300 hover:-translate-y-[3px] transition-all duration-300 no-underline"
    >
      {/* Gradient header band */}
      <div
        className={`h-[132px] relative overflow-hidden bg-gradient-to-br ${series.gradient}`}
      >
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 80% 20%, rgba(255,255,255,0.25) 0%, transparent 45%), radial-gradient(circle at 20% 100%, rgba(255,255,255,0.12) 0%, transparent 40%)",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/20 transition-opacity duration-300 group-hover:opacity-80" />
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <span className="translate-y-2 group-hover:translate-y-0 transition-transform duration-300 inline-flex items-center gap-1.5 text-white text-xs font-bold bg-black/25 backdrop-blur-sm px-3 py-1.5 rounded-full">
            Start track <span aria-hidden>&rarr;</span>
          </span>
        </div>
        <span className="absolute bottom-3.5 left-5 bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-full text-xs font-bold text-white uppercase tracking-[0.06em] z-10">
          {seriesShortLabel(series.slug)}
        </span>
      </div>

      {/* Body */}
      <div className="p-[22px] pb-6">
        <h3 className="text-xl font-bold text-navy tracking-tight mb-1.5 leading-snug transition-colors duration-200 group-hover:text-red">
          {series.name}
        </h3>
        <p className="text-[13.5px] text-gray-500 leading-relaxed mb-[18px]">
          {series.description}
        </p>

        {empty ? (
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold text-gray-400 uppercase tracking-[0.06em] bg-gray-100 border border-dashed border-gray-300 px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
            Coming soon
          </span>
        ) : (
          <div className="mt-4 pt-3 border-t border-gray-100">
            <LessonProgress
              published={series.lessons.length}
              total={series.totalLessons}
            />
            {/* Quiz average + attempt count (design brief §5.3) */}
            <div className="mt-2.5">
              <QuizStats seriesSlug={series.slug} />
            </div>
          </div>
        )}
      </div>
    </Link>
  );
}
