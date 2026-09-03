/**
 * RankChip — \"EXPLORER · 55% lit\" galaxy aggregate (deep-sky HUD, kara
 * t_ea789325). Renders the learner's current rank name + the fraction of the
 * galaxy illuminated (rank → illumination, see galaxy-model.RANK_ILLUMINATION).
 *
 * Pure DOM + SSR-safe (no three import) so the profile page can render it even
 * when WebGL falls back to 2D. Reads display strings from the shared
 * RANK_LADDER so chip + profile rank ladder never drift.
 */
import { RANK_LADDER } from "@/shared/rank-ladder";
import type { RankChipProps } from "@/shared/contracts-galaxy";

export function RankChip({ rank, illuminationPct }: RankChipProps) {
  const band = RANK_LADDER.find((b) => b.id === rank) ?? RANK_LADDER[0];
  const name = band?.name ?? "Starseed";
  const pct = Math.round(Math.min(100, Math.max(0, illuminationPct * 100)));

  return (
    <span
      className="cx3d-rankchip"
      data-testid="cx3d-rankchip"
      role="status"
      aria-label={`${name}, ${pct}% of the galaxy lit`}
    >
      <span className="cx3d-rankchip-rank" aria-hidden="true">
        {name.toUpperCase()}
      </span>
      <span className="cx3d-rankchip-sep" aria-hidden="true">
        ·
      </span>
      <span className="cx3d-rankchip-pct" aria-hidden="true">
        {pct}% lit
      </span>
    </span>
  );
}
