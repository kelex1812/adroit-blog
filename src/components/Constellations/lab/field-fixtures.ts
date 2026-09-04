/**
 * field-fixtures.ts — PURE synthetic lab data (no network, no auth, no three).
 *
 * The lab has to be reviewable without a session, so this module fabricates a
 * `ProfileSky` covering all seven real series slugs at assorted completion
 * levels — two complete, four part-way, one untouched — plus the figure each
 * course draws.
 *
 * Orion and Cassiopeia come from the shipped `asterism-data.ts`. The other
 * five courses get REAL small constellations authored here (Lyra, Corvus,
 * Delphinus, Corona Borealis, Cygnus) in the same `Asterism` shape, projected
 * through the shipped `projectAsterism`. That is deliberately not a generated
 * ring: a ring of equidistant equal stars is the "invented scatter wearing a
 * course name" failure the architecture doc calls out, and these figures are
 * cheap to author because the coordinates already exist in the sky.
 *
 * Nothing here is a production data source — `asterism-data.ts` stays
 * untouched, and promoting any of these figures is a Phase 2 decision.
 */
import type {
  AchievementStats,
  ConstellationState,
  ProfileSky,
} from "@/shared/contracts-constellations";
import type { Asterism } from "../3d/asterism-data";
import { asterismFor, projectAsterism } from "../3d/asterism-data";
import { seededUnit } from "../3d/star-model";
import type { FigureStar } from "./deep-field-model";

/* ------------------------------------------------------------------ */
/*  Lab-only real asterisms for the five unauthored courses            */
/* ------------------------------------------------------------------ */

/** LYRA — the lyre. Vega plus the parallelogram. */
const LYRA: Asterism = {
  seriesSlug: "omni-studio-cert",
  name: "Lyra",
  stars: [
    { name: "Vega (α Lyr)", raH: 18.6156, decDeg: 38.78, spectralClass: "A", magnitude: 0.03 },
    { name: "ζ¹ Lyr", raH: 18.7461, decDeg: 37.6, spectralClass: "A", magnitude: 4.36 },
    { name: "Sheliak (β Lyr)", raH: 18.8347, decDeg: 33.36, spectralClass: "B", magnitude: 3.52 },
    { name: "Sulafat (γ Lyr)", raH: 18.9822, decDeg: 32.69, spectralClass: "B", magnitude: 3.24 },
    { name: "δ² Lyr", raH: 18.9, decDeg: 36.9, spectralClass: "M", magnitude: 4.3 },
    { name: "ε Lyr", raH: 18.7392, decDeg: 39.67, spectralClass: "A", magnitude: 4.6 },
  ],
  connections: [
    [0, 1],
    [1, 2],
    [2, 3],
    [3, 4],
    [4, 1],
    [0, 5],
  ],
};

/** CORVUS — the crow. The "sail" quadrilateral. */
const CORVUS: Asterism = {
  seriesSlug: "hermes-consultant",
  name: "Corvus",
  stars: [
    { name: "Gienah (γ Crv)", raH: 12.2634, decDeg: -17.54, spectralClass: "B", magnitude: 2.59 },
    { name: "Algorab (δ Crv)", raH: 12.4979, decDeg: -16.52, spectralClass: "B", magnitude: 2.95 },
    { name: "Kraz (β Crv)", raH: 12.5721, decDeg: -23.4, spectralClass: "G", magnitude: 2.65 },
    { name: "Minkar (ε Crv)", raH: 12.1683, decDeg: -22.62, spectralClass: "K", magnitude: 3.02 },
    { name: "Alchiba (α Crv)", raH: 12.1405, decDeg: -24.73, spectralClass: "F", magnitude: 4.02 },
  ],
  connections: [
    [4, 3],
    [3, 0],
    [0, 1],
    [1, 2],
    [2, 3],
  ],
};

/** DELPHINUS — the dolphin. Job's Coffin plus the tail. */
const DELPHINUS: Asterism = {
  seriesSlug: "hermes-consultant-intermediate",
  name: "Delphinus",
  stars: [
    { name: "Rotanev (β Del)", raH: 20.6255, decDeg: 14.6, spectralClass: "F", magnitude: 3.63 },
    { name: "Sualocin (α Del)", raH: 20.6607, decDeg: 15.91, spectralClass: "B", magnitude: 3.77 },
    { name: "γ Del", raH: 20.7758, decDeg: 16.12, spectralClass: "K", magnitude: 4.27 },
    { name: "δ Del", raH: 20.7325, decDeg: 15.07, spectralClass: "A", magnitude: 4.43 },
    { name: "ε Del", raH: 20.5566, decDeg: 11.3, spectralClass: "B", magnitude: 4.03 },
  ],
  connections: [
    [4, 0],
    [0, 3],
    [3, 2],
    [2, 1],
    [1, 0],
  ],
};

/** CORONA BOREALIS — the northern crown. */
const CORONA_BOREALIS: Asterism = {
  seriesSlug: "hermes-consultant-advanced",
  name: "Corona Borealis",
  stars: [
    { name: "Alphecca (α CrB)", raH: 15.5781, decDeg: 26.71, spectralClass: "A", magnitude: 2.22 },
    { name: "Nusakan (β CrB)", raH: 15.4638, decDeg: 29.11, spectralClass: "F", magnitude: 3.68 },
    { name: "γ CrB", raH: 15.7108, decDeg: 26.3, spectralClass: "B", magnitude: 3.84 },
    { name: "θ CrB", raH: 15.5486, decDeg: 31.36, spectralClass: "B", magnitude: 4.14 },
    { name: "δ CrB", raH: 15.8267, decDeg: 26.07, spectralClass: "G", magnitude: 4.63 },
    { name: "ε CrB", raH: 15.9585, decDeg: 26.88, spectralClass: "K", magnitude: 4.15 },
  ],
  connections: [
    [3, 1],
    [1, 0],
    [0, 2],
    [2, 4],
    [4, 5],
  ],
};

/** CYGNUS — the swan / Northern Cross. */
const CYGNUS: Asterism = {
  seriesSlug: "ai-at-work",
  name: "Cygnus",
  stars: [
    { name: "Deneb (α Cyg)", raH: 20.6905, decDeg: 45.28, spectralClass: "A", magnitude: 1.25 },
    { name: "Sadr (γ Cyg)", raH: 20.3705, decDeg: 40.26, spectralClass: "F", magnitude: 2.23 },
    { name: "δ Cyg", raH: 19.7495, decDeg: 45.13, spectralClass: "B", magnitude: 2.87 },
    { name: "Gienah (ε Cyg)", raH: 20.7702, decDeg: 33.97, spectralClass: "K", magnitude: 2.48 },
    { name: "Albireo (β Cyg)", raH: 19.5121, decDeg: 27.96, spectralClass: "K", magnitude: 3.08 },
    { name: "ζ Cyg", raH: 21.2149, decDeg: 30.23, spectralClass: "G", magnitude: 3.2 },
  ],
  connections: [
    [0, 1],
    [1, 3],
    [1, 2],
    [1, 4],
    [3, 5],
  ],
};

const LAB_ASTERISMS: Record<string, Asterism> = {
  [LYRA.seriesSlug]: LYRA,
  [CORVUS.seriesSlug]: CORVUS,
  [DELPHINUS.seriesSlug]: DELPHINUS,
  [CORONA_BOREALIS.seriesSlug]: CORONA_BOREALIS,
  [CYGNUS.seriesSlug]: CYGNUS,
};

/**
 * The asterism a course draws: the shipped authored data first, then the
 * lab-only figures. Null would mean a course renders as a lone dot, which is
 * exactly the state the lab exists to eliminate — so every fixture slug
 * resolves.
 */
export function labAsterismFor(seriesSlug: string): Asterism | null {
  return asterismFor(seriesSlug) ?? LAB_ASTERISMS[seriesSlug] ?? null;
}

/* ------------------------------------------------------------------ */
/*  Course fixtures                                                    */
/* ------------------------------------------------------------------ */

/** One fixture course: real slug, real name, assorted progress. */
export interface LabCourseFixture {
  seriesSlug: string;
  name: string;
  /** Constellation the course draws. */
  figureName: string;
  totalStars: number;
  litStars: number;
}

/**
 * Seven real series slugs at deliberately uneven completion, so every visual
 * state is on screen at once: two complete, four in progress at different
 * depths, one never started.
 */
export const LAB_COURSES: readonly LabCourseFixture[] = [
  {
    seriesSlug: "salesforce-architect",
    name: "Salesforce System Architect Primer",
    figureName: "Orion",
    totalStars: 29,
    litStars: 29,
  },
  {
    seriesSlug: "agentic-ai",
    name: "Agentic AI Implementation Path",
    figureName: "Cassiopeia",
    totalStars: 5,
    litStars: 3,
  },
  {
    seriesSlug: "omni-studio-cert",
    name: "OmniStudio Developer Certification",
    figureName: "Lyra",
    totalStars: 12,
    litStars: 7,
  },
  {
    seriesSlug: "hermes-consultant",
    name: "Hermes Agent Consultant",
    figureName: "Corvus",
    totalStars: 10,
    litStars: 10,
  },
  {
    seriesSlug: "hermes-consultant-intermediate",
    name: "Hermes Agent Consultant — Intermediate",
    figureName: "Delphinus",
    totalStars: 10,
    litStars: 4,
  },
  {
    seriesSlug: "hermes-consultant-advanced",
    name: "Hermes Agent Consultant — Advanced",
    figureName: "Corona Borealis",
    totalStars: 12,
    litStars: 0,
  },
  {
    seriesSlug: "ai-at-work",
    name: "AI at Work",
    figureName: "Cygnus",
    totalStars: 8,
    litStars: 1,
  },
];

/** Gradients mirror the real series.json values (2D fallback parity). */
const GRADIENTS: Record<string, string> = {
  "salesforce-architect": "from-sky to-blue-600",
  "agentic-ai": "from-amber to-yellow-600",
  "omni-studio-cert": "from-red to-rose-600",
  "hermes-consultant": "from-teal to-emerald-600",
  "hermes-consultant-intermediate": "from-teal to-emerald-600",
  "hermes-consultant-advanced": "from-teal to-emerald-600",
  "ai-at-work": "from-fuchsia to-purple-600",
};

/** Build one course's `ConstellationState`, lit lessons first. */
export function labConstellation(fixture: LabCourseFixture): ConstellationState {
  const figure = labAsterismFor(fixture.seriesSlug);
  const stars = Array.from({ length: fixture.totalStars }, (_, i) => {
    const member = figure?.stars[i % Math.max(figure.stars.length, 1)];
    return {
      lessonSlug: `${fixture.seriesSlug}-lesson-${i + 1}`,
      index: i + 1,
      label: member ? member.name : `Lesson ${i + 1}`,
      lit: i < fixture.litStars,
    };
  });
  return {
    courseId: `lab-${fixture.seriesSlug}`,
    seriesSlug: fixture.seriesSlug,
    name: fixture.name,
    gradient: GRADIENTS[fixture.seriesSlug] ?? "from-sky to-blue-600",
    totalStars: fixture.totalStars,
    litStars: fixture.litStars,
    complete: fixture.litStars >= fixture.totalStars,
    stars,
  };
}

/** Lab `AchievementStats` — mid-ladder, so illumination has room both ways. */
const LAB_STATS: AchievementStats = {
  streakDays: 6,
  longestStreakDays: 23,
  rank: {
    id: "explorer",
    name: "Explorer",
    description: "Half the sky answers to you.",
    index: 2,
    nextProgressPct: 48,
  },
  coursesCompleted: 2,
  tracksCompleted: 0,
};

/**
 * The synthetic `ProfileSky` the lab renders. Chronicle is empty on purpose —
 * the lab reviews the field, and a feed would be page chrome.
 */
export function labProfileSky(): ProfileSky {
  return {
    stats: LAB_STATS,
    constellations: LAB_COURSES.map(labConstellation),
    chronicle: [],
    isGuest: false,
  };
}

/* ------------------------------------------------------------------ */
/*  Figures for the 3D studies                                         */
/* ------------------------------------------------------------------ */

/** A course as the atlas draws it: projected figure stars + connections. */
export interface LabFigure {
  seriesSlug: string;
  name: string;
  figureName: string;
  litStars: number;
  totalStars: number;
  complete: boolean;
  stars: FigureStar[];
  connections: ReadonlyArray<readonly [number, number]>;
}

/**
 * Project a fixture course into figure stars.
 *
 * Lit members are allocated proportionally to course progress and assigned
 * brightest-first, because a learner's completed lessons should read as the
 * recognizable part of the figure lighting up rather than a random subset.
 *
 * Roles (for the 2D chart hierarchy):
 *   - most members = lesson (quiet pinpricks)
 *   - ~every 4th bright-ish member = knowledge check (brighter)
 *   - the brightest / keystone member = exam (completes the figure when lit)
 */
export function labFigure(fixture: LabCourseFixture, scale = 1): LabFigure {
  const asterism = labAsterismFor(fixture.seriesSlug);
  const projected = asterism ? projectAsterism(asterism, 6.5) : [];
  const progress = fixture.totalStars > 0 ? fixture.litStars / fixture.totalStars : 0;
  const litCount = Math.round(projected.length * progress);
  const complete = fixture.litStars >= fixture.totalStars;

  // Brightest-first lighting order, ties broken deterministically by name.
  const byBright = projected
    .map((s, i) => ({ i, magnitude: s.magnitude, name: s.name }))
    .sort((a, b) => a.magnitude - b.magnitude || (a.name < b.name ? -1 : 1));

  const examIndex = byBright[0]?.i ?? projected.length - 1;
  const checkEvery = Math.max(3, Math.floor(projected.length / 5));
  const checkIndices = new Set<number>();
  byBright.forEach((s, rank) => {
    if (s.i === examIndex) return;
    // Spread checks through the brightness ladder (not the dimmest clutter).
    if (rank > 0 && rank % checkEvery === 0) checkIndices.add(s.i);
  });

  const order = byBright.slice(0, litCount).map((s) => s.i);
  const lit = new Set(order);

  // Exam only lights when the course is fully complete — it finishes the figure.
  if (complete) lit.add(examIndex);
  else lit.delete(examIndex);

  const stars: FigureStar[] = projected.map((s, i) => {
    const role: FigureStar["role"] =
      i === examIndex ? "exam" : checkIndices.has(i) ? "check" : "lesson";
    return {
      name: role === "exam" ? `${s.name} · Exam` : role === "check" ? `${s.name} · Check` : s.name,
      position: [s.position[0] * scale, s.position[1] * scale, s.position[2] * scale],
      spectralClass: s.spectralClass,
      magnitude: s.magnitude,
      lit: lit.has(i),
      complete,
      isRedGiantAccent: s.isRedGiantAccent,
      isNebula: s.isNebula,
      role,
    };
  });

  return {
    seriesSlug: fixture.seriesSlug,
    name: fixture.name,
    figureName: asterism?.name ?? fixture.figureName,
    litStars: fixture.litStars,
    totalStars: fixture.totalStars,
    complete,
    stars,
    connections: asterism?.connections ?? [],
  };
}

/** All seven course figures. */
export function labFigures(scale = 1): LabFigure[] {
  return LAB_COURSES.map((c) => labFigure(c, scale));
}

/* ------------------------------------------------------------------ */
/*  Atlas placement                                                    */
/* ------------------------------------------------------------------ */

/**
 * Scatter the course sectors through a flattened volume on a golden-angle
 * spiral, with a deterministic per-slug jitter in radius and height.
 *
 * A ring at fixed radius is what made the shipped scene read as a diagram: it
 * gives every course the same distance from camera, so nothing is far away and
 * nothing is approached. Varying radius by roughly 2x means approaching a
 * sector is a real change in scale.
 */
export function atlasSectorPositions(
  slugs: readonly string[],
  opts: { rMin?: number; rMax?: number; spread?: number } = {},
): Record<string, [number, number, number]> {
  const { rMin = 20, rMax = 46, spread = 9 } = opts;
  const golden = Math.PI * (3 - Math.sqrt(5));
  const out: Record<string, [number, number, number]> = {};
  slugs.forEach((slug, i) => {
    const angle = i * golden + seededUnit(`${slug}:atlas:a`) * 0.5;
    const t = slugs.length > 1 ? i / (slugs.length - 1) : 0;
    const r = rMin + t * (rMax - rMin) + (seededUnit(`${slug}:atlas:r`) - 0.5) * 6;
    const y = (seededUnit(`${slug}:atlas:y`) - 0.5) * spread;
    out[slug] = [
      Number((Math.cos(angle) * r).toFixed(3)),
      Number(y.toFixed(3)),
      Number((Math.sin(angle) * r).toFixed(3)),
    ];
  });
  return out;
}
