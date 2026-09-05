/**
 * chart.ts — production data → star-chart figures.
 *
 * Pure: no React, no DOM, no fetching. The renderer takes chart-ready figures
 * and nothing else, so everything that decides *what* the chart claims about
 * someone's progress is unit-testable here.
 *
 * The v1 role model is deliberately two roles, not three. Production carries
 * `ConstellationStar.lit` per lesson and `ConstellationState.complete` per
 * course, and nothing maps a quiz or an exam to a *position* in a series. The
 * lab faked that by making the brightest star the exam and every nth star a
 * knowledge check, which is fine for a lab and is not shippable as a claim
 * about what someone has passed. So: lessons are the star line, the exam is a
 * single crowning node, and the knowledge-check diamonds are dropped until the
 * catalog exposes where quizzes sit. See
 * `docs/implementation-plan-hubble-field.md` §3.1.
 */
import type {
  ChronicleEntry,
  ConstellationState,
  ProfileSky,
} from "@/shared/contracts-constellations";
import {
  asterismFor,
  projectAsterism,
} from "@/components/Constellations/3d/asterism-data";
import type { SpectralClass } from "@/components/Constellations/3d/star-model";

/** One drawn member of a course figure. */
export interface ChartStar {
  name: string;
  position: [number, number, number];
  spectralClass: SpectralClass;
  magnitude: number;
  /**
   * Whether this member burns.
   *
   * Member-level lighting is a *proportional rendering of course progress*,
   * not a claim that a named lesson owns this star. Real per-lesson progress
   * lives in `litStars` / `totalStars`, which is what the rails read. A figure
   * has however many members the real constellation has (Cassiopeia has five),
   * which rarely equals the lesson count, so a 1:1 mapping would be fiction.
   */
  lit: boolean;
  isRedGiantAccent?: boolean;
  isNebula?: boolean;
  /** v1 is two roles. `check` is deliberately absent — see the file header. */
  role: "lesson" | "exam";
}

/** A course, ready to draw. */
export interface ChartFigure {
  seriesSlug: string;
  /** Course display name. */
  name: string;
  /** Constellation the course draws, or null when no figure is mapped. */
  figureName: string | null;
  litStars: number;
  totalStars: number;
  complete: boolean;
  /** True when an `exam` completion event exists for this course. */
  examPassed: boolean;
  /** Empty when the course has no mapped asterism — renders label-only. */
  stars: ChartStar[];
  connections: ReadonlyArray<readonly [number, number]>;
}

/** Fraction of the course finished, 0-1. Guards a zero-lesson course. */
export function figureProgress(figure: {
  litStars: number;
  totalStars: number;
}): number {
  if (figure.totalStars <= 0) return 0;
  return Math.min(1, Math.max(0, figure.litStars / figure.totalStars));
}

/**
 * Series slugs with a passed cert exam, read off the chronicle.
 *
 * An `exam` event is only written on a pass, so its presence is the pass. This
 * is the one piece of exam truth `ProfileSky` already carries; without it the
 * crowning node can only follow `complete`.
 */
export function examPassedSlugs(
  chronicle: readonly ChronicleEntry[],
): Set<string> {
  const out = new Set<string>();
  for (const e of chronicle) {
    if (e.eventType === "exam" && e.seriesSlug) out.add(e.seriesSlug);
  }
  return out;
}

/**
 * Which member crowns the figure.
 *
 * The brightest member, ties broken by name so the choice is stable across
 * runs. This is a *display* choice about where to put the course's exam node —
 * it is not asserting that this star is the exam question.
 */
function crownIndex(
  stars: ReadonlyArray<{ magnitude: number; name: string }>,
  drawn: readonly number[],
): number {
  if (drawn.length === 0) return -1;
  return [...drawn].sort((a, b) => {
    const sa = stars[a]!;
    const sb = stars[b]!;
    return sa.magnitude - sb.magnitude || (sa.name < sb.name ? -1 : 1);
  })[0]!;
}

/**
 * Members the figure actually draws — the ones a connection touches.
 *
 * Orion pads to 29 members so the 3D scene can give every lesson a star, but
 * only the 9 forming the hunter are connected. The chart draws the figure, so
 * unconnected padding must not become floating dots.
 */
function drawnIndices(
  connections: ReadonlyArray<readonly [number, number]>,
  starCount: number,
): number[] {
  const set = new Set<number>();
  for (const [a, b] of connections) {
    if (a >= 0 && a < starCount) set.add(a);
    if (b >= 0 && b < starCount) set.add(b);
  }
  return [...set].sort((a, b) => a - b);
}

/** Build one course's chart figure from production constellation state. */
export function buildChartFigure(
  constellation: ConstellationState,
  options: { examPassed?: boolean } = {},
): ChartFigure {
  const { seriesSlug, name, litStars, totalStars, complete } = constellation;
  const asterism = asterismFor(seriesSlug);
  const examPassed = options.examPassed ?? false;

  if (!asterism) {
    return {
      seriesSlug,
      name,
      figureName: null,
      litStars,
      totalStars,
      complete,
      examPassed,
      stars: [],
      connections: [],
    };
  }

  const projected = projectAsterism(asterism);
  const drawn = drawnIndices(asterism.connections, projected.length);
  const crown = crownIndex(projected, drawn);
  const progress = figureProgress({ litStars, totalStars });

  /*
   * Light the drawn members brightest-first, proportional to real progress.
   * Brightest-first rather than index order so a half-finished course reads as
   * the figure's skeleton emerging, not as its left half.
   */
  const byBrightness = [...drawn]
    .filter((i) => i !== crown)
    .sort((a, b) => {
      const sa = projected[a]!;
      const sb = projected[b]!;
      return sa.magnitude - sb.magnitude || (sa.name < sb.name ? -1 : 1);
    });
  const litCount = Math.round(byBrightness.length * progress);
  const litSet = new Set(byBrightness.slice(0, litCount));

  // The crown lights only when the course is finished — it closes the figure.
  const crownLit = complete || examPassed;
  if (crown >= 0 && crownLit) litSet.add(crown);

  const stars: ChartStar[] = projected.map((s, i) => ({
    name: i === crown ? `${s.name} · Final exam` : s.name,
    position: s.position,
    spectralClass: s.spectralClass,
    magnitude: s.magnitude,
    lit: litSet.has(i),
    isRedGiantAccent: s.isRedGiantAccent,
    isNebula: s.isNebula,
    role: i === crown ? "exam" : "lesson",
  }));

  return {
    seriesSlug,
    name,
    figureName: asterism.name,
    litStars,
    totalStars,
    complete,
    examPassed,
    stars,
    connections: asterism.connections,
  };
}

/**
 * Build every course's figure for the profile sky.
 *
 * Order follows `sky.constellations`, which is catalog order — the layout is
 * index-driven, so a stable input order is what keeps figures from swapping
 * places between loads.
 */
export function buildChartFigures(sky: ProfileSky): ChartFigure[] {
  const passed = examPassedSlugs(sky.chronicle);
  return sky.constellations.map((c) =>
    buildChartFigure(c, { examPassed: passed.has(c.seriesSlug) }),
  );
}
