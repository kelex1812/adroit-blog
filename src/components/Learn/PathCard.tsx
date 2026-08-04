import Link from "next/link";
import { LearningSeries } from "@/data/types";
import { seriesShortLabel } from "@/lib/learn";
import LessonProgress from "./LessonProgress";

interface PathCardProps {
  series: LearningSeries;
}

/** Landing-page card per learning path (mockup: learn-landing.html). */
export default function PathCard({ series }: PathCardProps) {
  const empty = series.lessons.length === 0;

  return (
    <Link
      href={`/learn/${series.slug}`}
      className="block rounded-2xl overflow-hidden border border-gray-200 bg-white hover:shadow-xl hover:border-gray-300 hover:-translate-y-[3px] transition-all duration-200 no-underline"
    >
      {/* Gradient header band */}
      <div
        className={`h-[132px] relative overflow-hidden bg-gradient-to-br ${series.gradient}`}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/20" />
        <span className="absolute bottom-3.5 left-5 bg-white/20 backdrop-blur-sm px-2.5 py-1 rounded-full text-xs font-bold text-white uppercase tracking-[0.06em] z-10">
          {seriesShortLabel(series.slug)}
        </span>
      </div>

      {/* Body */}
      <div className="p-[22px] pb-6">
        <h3 className="text-xl font-bold text-navy tracking-tight mb-1.5 leading-snug">
          {series.name}
        </h3>
        <p className="text-[13.5px] text-gray-500 leading-relaxed mb-[18px]">
          {series.description}
        </p>

        {empty ? (
          <span className="inline-flex items-center gap-1.5 font-mono text-[11px] font-bold text-gray-400 uppercase tracking-[0.06em] bg-gray-100 px-2.5 py-1 rounded-full">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />
            Coming soon
          </span>
        ) : (
          <LessonProgress
            published={series.lessons.length}
            total={series.totalLessons}
          />
        )}
      </div>
    </Link>
  );
}
