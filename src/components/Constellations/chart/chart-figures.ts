/**
 * chart-figures.ts — where figures sit on the plate, and what art they wear.
 *
 * Pure. Both halves exist because the lab hardcoded them: seven `[cx, cy,
 * scale]` slots and a seven-entry art map, neither of which survives a course
 * being added, removed, or hidden by access rules.
 */

/* ------------------------------------------------------------------ */
/*  Layout                                                             */
/* ------------------------------------------------------------------ */

/** Plate centre and the radius figures are allowed to occupy, in viewBox units. */
const CENTRE_X = 500;
const CENTRE_Y = 520;
const MAX_RADIUS = 330;

/** 137.5° — consecutive indices land far apart, so the sky reads as scattered. */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

/**
 * Packing capacity tiers.
 *
 * A Vogel spiral normalised by the *live* course count would reflow every
 * figure whenever a course appeared, which §3.3 of the plan rules out. A
 * spiral normalised by a fixed capacity never reflows but wastes most of the
 * plate at seven courses. Tiers split the difference: layout is a function of
 * the tier, so adding a course inside the current tier moves nothing, and only
 * crossing a tier boundary reshuffles.
 */
const CAPACITY_TIERS = [8, 12, 18, 26, 36, 50] as const;

export function layoutCapacity(count: number): number {
  for (const tier of CAPACITY_TIERS) if (count <= tier) return tier;
  // Past the last tier, step in twelves so growth stays chunky.
  return Math.ceil(count / 12) * 12;
}

export interface ChartSlot {
  cx: number;
  cy: number;
  /** Multiplier on the figure's base span. */
  scale: number;
}

/**
 * Deterministic slot per course index.
 *
 * Phyllotaxis: `r ∝ √i` with a golden-angle turn each step, which is how a
 * sunflower packs seeds at even density. Index-driven, so the same catalog
 * always produces the same sky.
 */
export function chartLayout(count: number): ChartSlot[] {
  if (count <= 0) return [];
  const capacity = layoutCapacity(count);
  // Spacing that puts the outermost slot of a full tier at MAX_RADIUS.
  const spacing = MAX_RADIUS / Math.sqrt(capacity - 0.5);
  // Figures must not collide; their drawn extent is roughly 2× the base span.
  const scale = Math.min(1.45, Math.max(0.72, spacing / 108));

  return Array.from({ length: count }, (_, i) => {
    const radius = spacing * Math.sqrt(i + 0.5);
    const theta = i * GOLDEN_ANGLE;
    return {
      cx: CENTRE_X + Math.cos(theta) * radius,
      cy: CENTRE_Y + Math.sin(theta) * radius,
      scale,
    };
  });
}

/* ------------------------------------------------------------------ */
/*  Figure art                                                         */
/* ------------------------------------------------------------------ */

/**
 * The engraved plates in `public/constellations/`, by constellation slug.
 *
 * The full IAU 88, so mapping a new course to any real constellation gets art
 * for free — no new illustration, just a mapping. `chart.test.ts` asserts this
 * list against what is actually on disk, because a missing file renders as a
 * broken `<image>` and there is no runtime existence check in the browser.
 */
export const PLATE_SLUGS: ReadonlySet<string> = new Set([
  "andromeda", "antlia", "apus", "aquarius", "aquila", "ara", "aries",
  "auriga", "bootes", "caelum", "camelopardalis", "cancer", "canes-venatici",
  "canis-major", "canis-minor", "capricornus", "carina", "cassiopeia",
  "centaurus", "cepheus", "cetus", "chamaeleon", "circinus", "columba",
  "coma-berenices", "corona-australis", "corona-borealis", "corvus", "crater",
  "crux", "cygnus", "delphinus", "dorado", "draco", "equuleus", "eridanus",
  "fornax", "gemini", "grus", "hercules", "horologium", "hydra", "hydrus",
  "indus", "lacerta", "leo", "leo-minor", "lepus", "libra", "lupus", "lynx",
  "lyra", "mensa", "microscopium", "monoceros", "musca", "norma", "octans",
  "ophiuchus", "orion", "pavo", "pegasus", "perseus", "phoenix", "pictor",
  "pisces", "piscis-austrinus", "puppis", "pyxis", "reticulum", "sagitta",
  "sagittarius", "scorpius", "sculptor", "scutum", "serpens", "sextans",
  "taurus", "telescopium", "triangulum", "triangulum-australe", "tucana",
  "ursa-major", "ursa-minor", "vela", "virgo", "volans", "vulpecula",
]);

export interface FigureArt {
  src: string;
  /** Size as a multiple of the figure's base span. */
  scale: number;
  /** Offset in units of the base span. */
  dx: number;
  dy: number;
}

const DEFAULT_ART = { scale: 2.35, dx: 0, dy: -0.04 };

/**
 * Per-constellation placement nudges.
 *
 * Only constellations whose engraving does not sit well on its stars under the
 * default need an entry. Everything else takes `DEFAULT_ART`, which is what
 * makes the 88 usable without 88 hand-tuned records.
 */
const ART_TUNING: Record<string, Partial<typeof DEFAULT_ART>> = {
  orion: { scale: 2.5, dy: -0.08 },
  cassiopeia: { scale: 2.3, dy: -0.1 },
  lyra: { scale: 2.4, dy: -0.05 },
  corvus: { scale: 2.2, dy: 0 },
  delphinus: { scale: 2.3, dy: 0 },
  "corona-borealis": { scale: 2.4, dy: 0.05 },
  cygnus: { scale: 2.5, dy: 0 },
};

/** Constellation display name → plate slug. "Corona Borealis" → "corona-borealis". */
export function plateSlug(figureName: string): string {
  return figureName
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, "-");
}

/**
 * The plate a figure wears, or null when there is none.
 *
 * Null is a supported state, not an error: the figure still renders its lines,
 * labels and progress. Never return a `src` for a plate that is not on disk —
 * a broken `<image>` is worse than no art.
 */
export function figureArtFor(figureName: string | null): FigureArt | null {
  if (!figureName) return null;
  const slug = plateSlug(figureName);
  if (!PLATE_SLUGS.has(slug)) return null;
  return {
    src: `/constellations/${slug}.png`,
    ...DEFAULT_ART,
    ...ART_TUNING[slug],
  };
}
