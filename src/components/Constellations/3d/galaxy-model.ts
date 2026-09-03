/**
 * galaxy-model.ts — PURE profile-galaxy model (no three/r3f imports).
 *
 * Lays out every course's constellation as a "sector" of the navigable galaxy,
 * scatters free-floating article stars, maps the rank ladder to how much of
 * the galaxy is lit (rank → illumination), and (deep-sky "Sky Roads", kara
 * t_ea789325 + arch t_2156deb1) derives the LOD glyph per sector, the guided
 * Sky Road route, the Frontier Waypoint (the "next" beacon), and the focused
 * sector. Deterministic so tests + scene + HUD share one source of truth.
 *
 * Pure-model rule (ADR-305): no three/r3f imports; all design math is here,
 * unit-tested, and shared by the r3f scene (ProfileScene) + the 2D HUD chrome.
 */
import type { ProfileSky, RankId } from "@/shared/contracts-constellations";
import type {
  GalaxySectorNav,
  GlyphStar,
  SkyRoad,
  GalaxyModel,
} from "@/shared/contracts-galaxy";
import { STAR_PALETTE } from "./star-model";
import { asterismFor, projectAsterism } from "./asterism-data";

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

/* ────────────────────────────────────────────────────────────────── */
/*  Deep-sky "Sky Roads" (kara t_ea789325) — LOD glyph + road + frontier */
/* ────────────────────────────────────────────────────────────────── */

/**
 * The recognizable bright-anchor subset (apparent magnitude < 3.5) of a real
 * asterism — what a "constellation glyph" node renders at distance. Fainter
 * members only materialize when the camera approaches (LOD). Empty for a
 * course with no authored asterism (graceful fallback — the node shows as a
 * lone dot, never a broken figure). Deterministic (ADR-307 / ADR-309).
 */
export function glyphFor(seriesSlug: string): GlyphStar[] {
  const asterism = asterismFor(seriesSlug);
  if (!asterism) return [];
  return projectAsterism(asterism)
    .filter((s) => s.magnitude < 3.5)
    .map((s) => ({
      name: s.name,
      position: s.position,
      spectralClass: s.spectralClass,
      magnitude: s.magnitude,
      isRedGiantAccent: s.isRedGiantAccent,
      isNebula: s.isNebula,
    }));
}

/**
 * Sector achievement ladder → which Sky-Road segments are "traveled" (behind
 * you, warm gold) vs "untraveled" (ahead, faint cool).
 */
export function isTraveled(state: SectorState): boolean {
  return state === "completed" || state === "certified";
}

/**
 * Build the guided Sky Road: the route threading the sectors in journey order
 * (the ProfileSky course order — the canonical learning order surfaced by the
 * loader), split into traveled/untraveled segments, plus a Catmull-Rom curve
 * (sampled to `samples` world points) through the node positions for the drawn
 * path. Deterministic.
 */
export function buildRoad(
  sectors: GalaxySectorNav[],
  samples = 48,
): SkyRoad {
  const nodes = sectors.map((s) => s.seriesSlug);
  const traveled: string[] = [];
  const untraveled: string[] = [];
  for (const s of sectors) {
    (isTraveled(s.state) ? traveled : untraveled).push(s.seriesSlug);
  }
  return { nodes, traveled, untraveled, curve: catmullRomSamples(sectors, samples) };
}

/**
 * Deterministic, dependency-free Catmull-Rom sampler through the sector node
 * positions (the road's drawn path). Closed loop so the route returns to the
 * learner's starting sector. SSR-safe (pure math — no three import).
 */
export function catmullRomSamples(
  sectors: GalaxySectorNav[],
  samples = 48,
): [number, number, number][] {
  if (sectors.length === 0) return [];
  if (sectors.length === 1) return [sectors[0]!.position];
  const pts = sectors.map((s) => s.position);
  const n = pts.length;
  const out: [number, number, number][] = [];
  // Catmull-Rom over the closed loop P0..P(n-1), P wraps to P0.
  for (let i = 0; i < samples; i++) {
    const t = (i / samples) * n;
    const seg = Math.floor(t) % n;
    const local = t - Math.floor(t);
    const p0 = pts[(seg - 1 + n) % n]!;
    const p1 = pts[seg]!;
    const p2 = pts[(seg + 1) % n]!;
    const p3 = pts[(seg + 2) % n]!;
    const t2 = local * local;
    const t3 = t2 * local;
    const x =
      0.5 *
      (2 * p1[0] +
        (-p0[0] + p2[0]) * local +
        (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
        (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
    const y =
      0.5 *
      (2 * p1[1] +
        (-p0[1] + p2[1]) * local +
        (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
        (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
    const z =
      0.5 *
      (2 * p1[2] +
        (-p0[2] + p2[2]) * local +
        (2 * p0[2] - 5 * p1[2] + 4 * p2[2] - p3[2]) * t2 +
        (-p0[2] + 3 * p1[2] - 3 * p2[2] + p3[2]) * t3);
    out.push([Number(x.toFixed(3)), Number(y.toFixed(3)), Number(z.toFixed(3))]);
  }
  return out;
}

/**
 * The next recommended sector — the first unstarted/in-progress sector in road
 * order (the "frontier waypoint"). Pure + deterministic. Returns null when the
 * whole sky is lit (no frontier).
 */
export function frontierSlug(
  sectors: GalaxySectorNav[],
  road: SkyRoad,
): string | null {
  for (const slug of road.nodes) {
    const s = sectors.find((x) => x.seriesSlug === slug);
    if (s && (s.state === "unstarted" || s.state === "in-progress")) return slug;
  }
  return null;
}

/** Set exactly one sector as `focus` (returns a new array; null clears focus). */
export function withFocus(
  sectors: GalaxySectorNav[],
  focusSlug: string | null,
): GalaxySectorNav[] {
  return sectors.map((s) => ({ ...s, focus: s.seriesSlug === focusSlug }));
}

/**
 * Build the full galaxy model from a ProfileSky payload + cert set.
 * `certifiedSeriesSlugs` marks sectors whose certificate was earned.
 * Optional `focusSlug` focuses one sector at build time (defaults to the
 * frontier); callers can re-focus cheaply via `withFocus`.
 */
export function buildGalaxyModel(input: {
  sky: ProfileSky;
  certifiedSeriesSlugs?: ReadonlySet<string>;
  focusSlug?: string | null;
}): GalaxyModel {
  const { sky, certifiedSeriesSlugs = new Set() } = input;
  const count = sky.constellations.length;

  const base: GalaxySectorNav[] = sky.constellations.map((c, i) => {
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
      glyph: glyphFor(c.seriesSlug),
      focus: false,
    };
  });

  const road = buildRoad(base);
  const frontier = frontierSlug(base, road);
  const sectors = withFocus(base, input.focusSlug ?? frontier);

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

  return { sectors, articles, road, frontierSlug: frontier };
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
