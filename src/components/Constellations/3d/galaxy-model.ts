/**
 * galaxy-model.ts — PURE profile-galaxy model (no three/r3f imports).
 *
 * Lays out every course's constellation as a "sector" of the navigable galaxy,
 * scatters free-floating article stars, and maps the rank ladder to how much of
 * the galaxy is lit (rank → illumination). Deterministic so tests + HUD chrome
 * (sector list, minimap dots, illumination %) share one source of truth.
 */
import type { ProfileSky, RankId } from "@/shared/contracts-constellations";
import { STAR_PALETTE } from "./star-model";

/** Rank ladder → galaxy illumination (mirrors design-tokens-3d.css §4). */
export const RANK_ILLUMINATION: Record<RankId, number> = {
  starseed: 0.1,
  wayfarer: 0.3,
  explorer: 0.55,
  polestar: 0.8,
  celestial: 1.0,
};

export function rankIllumination(rankId: RankId): number {
  return RANK_ILLUMINATION[rankId] ?? RANK_ILLUMINATION.starseed;
}

export type SectorState = "unstarted" | "in-progress" | "completed" | "certified";

export interface GalaxySector {
  seriesSlug: string;
  name: string;
  state: SectorState;
  /** World position (center of the sector's constellation). */
  position: [number, number, number];
  litStars: number;
  totalStars: number;
  /** Normalized 0..1 space for the minimap overlay (x=right, y=down). */
  minimap: { x: number; y: number };
}

export interface ArticleStar {
  id: number;
  title: string;
  position: [number, number, number];
  /** Articles are always lit (free-floating stars). */
  color: string;
  size: number;
}

/** Sector visual state from a constellation + cert info. */
export function sectorState(
  complete: boolean,
  litStars: number,
  certified: boolean,
): SectorState {
  if (certified) return "certified";
  if (complete) return "completed";
  if (litStars > 0) return "in-progress";
  return "unstarted";
}

/** World sector center for the i-th course on a ring in the XZ plane. */
export function sectorPosition(
  index: number,
  count: number,
  radius = 5.2,
): [number, number, number] {
  const angle = (index / Math.max(count, 1)) * Math.PI * 2 - Math.PI / 2;
  return [
    Number((Math.cos(angle) * radius).toFixed(3)),
    Number((Math.sin(index * 1.7) * 0.4).toFixed(3)), // slight height variation
    Number((Math.sin(angle) * radius).toFixed(3)),
  ];
}

/** Map a world position to normalized minimap coords (x right, y down). */
export function toMinimap(
  world: [number, number, number],
  radius: number,
): { x: number; y: number } {
  // Galaxy spans roughly [-radius, radius] in x and z. Fold z→y on the minimap.
  const half = radius * 1.25;
  const x = Math.min(1, Math.max(0, (world[0] / half + 1) / 2));
  const y = Math.min(1, Math.max(0, (world[2] / half + 1) / 2));
  return { x: Number(x.toFixed(3)), y: Number(y.toFixed(3)) };
}

/**
 * Build the full galaxy model from a ProfileSky payload + cert set.
 * `certifiedSeriesSlugs` marks sectors whose certificate was earned.
 */
export function buildGalaxyModel(input: {
  sky: ProfileSky;
  certifiedSeriesSlugs?: ReadonlySet<string>;
}): { sectors: GalaxySector[]; articles: ArticleStar[] } {
  const { sky, certifiedSeriesSlugs = new Set() } = input;
  const count = sky.constellations.length;

  const sectors: GalaxySector[] = sky.constellations.map((c, i) => {
    const pos = sectorPosition(i, count);
    const state = sectorState(
      c.complete,
      c.litStars,
      certifiedSeriesSlugs.has(c.seriesSlug),
    );
    return {
      seriesSlug: c.seriesSlug,
      name: c.name,
      state,
      position: pos,
      litStars: c.litStars,
      totalStars: c.totalStars,
      minimap: toMinimap(pos, 5.2),
    };
  });

  // Free-floating article stars scattered through the galaxy ring interior.
  // G1: source from REAL `article` rows (blog reads), never faked from lesson
  // rows. Until the article write site lands, this yields zero article stars
  // (graceful fallback) — the placeholder is removed only when the source exists.
  const articles: ArticleStar[] = sky.chronicle
    .filter((e) => e.eventType === "article")
    .slice(0, 24)
    .map((e, i) => {
      const angle = (i / 24) * Math.PI * 2 + 0.7;
      const r = 1.2 + (i % 5) * 0.6;
      const p: [number, number, number] = [
        Number((Math.cos(angle) * r).toFixed(3)),
        Number((Math.sin(i * 3.1) * 0.3).toFixed(3)),
        Number((Math.sin(angle) * r).toFixed(3)),
      ];
      const palette = STAR_PALETTE.ignited;
      return {
        id: e.id,
        title: e.label,
        position: p,
        color: i % 3 === 0 ? "#F0B83A" : palette.color,
        size: 0.4 + (i % 4) * 0.1,
      };
    });

  return { sectors, articles };
}

/** Rank-appropriate scene background luminance tint (0..1 → scene fog/glow). */
export function rankLuminance(rankId: RankId): number {
  const illumination = rankIllumination(rankId);
  // Warm counterpoint near completed sectors; cooler near unstarted.
  return illumination;
}

/** Choose the active SectorState from a rank for the galaxy HUD chip. */
export function sectorStateForRank(rankId: RankId): SectorState {
  const illum = rankIllumination(rankId);
  if (illum >= 0.8) return "certified";
  if (illum >= 0.55) return "completed";
  if (illum >= 0.3) return "in-progress";
  return "unstarted";
}
