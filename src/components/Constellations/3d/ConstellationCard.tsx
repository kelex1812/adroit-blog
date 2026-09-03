/**
 * ConstellationCard — contextual info card for the focused constellation
 * (deep-sky HUD, kara t_ea789325). Replaces the tooltip-only affordance with
 * an edge-anchored card: name, course (kicker), state chip, lit/total, and a
 * "Continue / Next star" CTA that navigates into the course.
 *
 * Pure DOM + SSR-safe.
 */
import Link from "next/link";
import type { ConstellationCardProps } from "@/shared/contracts-galaxy";

const STATE_LABEL: Record<string, string> = {
  certified: "Certified",
  completed: "Completed",
  "in-progress": "In progress",
  unstarted: "Unstarted",
};

const STATE_CLASS: Record<string, string> = {
  certified: "is-certified",
  completed: "is-completed",
  "in-progress": "is-inprogress",
  unstarted: "is-unstarted",
};

export function ConstellationCard({
  sector,
  onContinue,
}: ConstellationCardProps) {
  const stateLabel = STATE_LABEL[sector.state] ?? "Unstarted";
  const stateClass = STATE_CLASS[sector.state] ?? "is-unstarted";
  const remaining = sector.totalStars - sector.litStars;
  const cta =
    remaining > 0
      ? sector.state === "unstarted"
        ? "Begin course"
        : "Continue course"
      : "Review course";

  return (
    <aside
      className="cx3d-card"
      data-testid={`cx3d-card-${sector.seriesSlug}`}
      aria-label={`${sector.name} — ${stateLabel}, ${sector.litStars} of ${sector.totalStars} lit`}
    >
      <p className="cx3d-card-kicker">COURSE · {sector.seriesSlug}</p>
      <h3 className="cx3d-card-title">{sector.name}</h3>
      <p className="cx3d-card-progress" aria-label={`${sector.litStars} of ${sector.totalStars} stars lit`}>
        <span className="cx3d-card-progress-num">
          {sector.litStars}/{sector.totalStars}
        </span>{" "}
        stars lit
      </p>
      <span className={`cx3d-card-state ${stateClass}`}>{stateLabel}</span>
      {onContinue ? (
        <button type="button" className="cx3d-card-cta" onClick={onContinue}>
          {cta}
        </button>
      ) : (
        <Link
          href={`/learn/${sector.seriesSlug}`}
          className="cx3d-card-cta"
          data-testid={`cx3d-card-cta-${sector.seriesSlug}`}
        >
          {cta}
        </Link>
      )}
    </aside>
  );
}
