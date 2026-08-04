import Link from "next/link";

interface EmptyStateProps {
  title?: string;
  body?: string;
  ctaHref?: string;
  ctaLabel?: string;
}

/**
 * Graceful "coming soon" state for empty series (BA edge case).
 * Never 404s, never breaks layout.
 */
export default function EmptyState({
  title = "No lessons published yet",
  body = "This track is being written. New lessons publish daily once the series launches — check back soon.",
  ctaHref = "/learn",
  ctaLabel = "Browse other tracks",
}: EmptyStateProps) {
  return (
    <div className="border border-dashed border-gray-300 rounded-2xl px-6 py-12 text-center">
      <div className="font-mono text-3xl font-bold text-gray-300 tracking-tight mb-3.5">
        00 / 00
      </div>
      <div className="text-[15px] font-bold text-gray-600 mb-1.5">{title}</div>
      <p className="text-[12.5px] text-gray-400 leading-relaxed max-w-[240px] mx-auto mb-[18px]">
        {body}
      </p>
      <Link
        href={ctaHref}
        className="inline-flex items-center text-xs font-bold text-white bg-navy px-[18px] py-2.5 rounded-lg no-underline hover:bg-navy-light transition-colors duration-150"
      >
        {ctaLabel}
      </Link>
    </div>
  );
}
