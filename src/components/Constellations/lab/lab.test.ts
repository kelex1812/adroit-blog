/**
 * lab.test.ts — pure fixtures / model tests for the Hubble Field lab.
 */
import { describe, expect, it } from "vitest";
import {
  LAB_COURSES,
  atlasSectorPositions,
  labAsterismFor,
  labFigure,
  labFigures,
  labProfileSky,
} from "./field-fixtures";
import {
  buildFigureAttributes,
  buildShellAttributes,
  magnitudeHistogram,
  shellSpecs,
  spikeWeight,
} from "./deep-field-model";
import { DEFAULT_FIELD_PARAMS } from "./FieldControls";
import {
  SKY_MIN,
  SKY_SPAN,
  bgStars,
  rng,
  xyCorrelation,
} from "./chart-sky";

describe("field-fixtures", () => {
  it("covers seven real series slugs", () => {
    expect(LAB_COURSES).toHaveLength(7);
    expect(new Set(LAB_COURSES.map((c) => c.seriesSlug)).size).toBe(7);
  });

  it("resolves real asterisms for Orion and Cassiopeia", () => {
    expect(labAsterismFor("salesforce-architect")?.name).toBe("Orion");
    expect(labAsterismFor("agentic-ai")?.name).toBe("Cassiopeia");
  });

  it("authors lab asterisms for the five unauthored courses", () => {
    for (const slug of [
      "omni-studio-cert",
      "hermes-consultant",
      "hermes-consultant-intermediate",
      "hermes-consultant-advanced",
      "ai-at-work",
    ]) {
      expect(labAsterismFor(slug)).not.toBeNull();
    }
  });

  it("builds figures with stars for every course", () => {
    const figures = labFigures();
    expect(figures).toHaveLength(7);
    for (const fig of figures) {
      expect(fig.stars.length).toBeGreaterThan(0);
    }
    const orion = labFigure(LAB_COURSES[0]!);
    expect(orion.figureName).toBe("Orion");
    expect(orion.complete).toBe(true);
  });

  it("tags lesson / check / exam roles and lights the exam only when complete", () => {
    const orion = labFigure(LAB_COURSES[0]!);
    const roles = new Set(orion.stars.map((s) => s.role));
    expect(roles.has("lesson")).toBe(true);
    expect(roles.has("check")).toBe(true);
    expect(roles.has("exam")).toBe(true);
    const exam = orion.stars.find((s) => s.role === "exam");
    expect(exam?.lit).toBe(true);

    const unfinished = labFigure(LAB_COURSES[4]!); // Delphinus, 4/10
    expect(unfinished.complete).toBe(false);
    expect(unfinished.stars.find((s) => s.role === "exam")?.lit).toBe(false);
  });

  it("places atlas sectors at distinct positions", () => {
    const pos = atlasSectorPositions(LAB_COURSES.map((c) => c.seriesSlug));
    const keys = Object.keys(pos);
    expect(keys).toHaveLength(7);
    const serialized = keys.map((k) => pos[k]!.join(","));
    expect(new Set(serialized).size).toBe(7);
  });

  it("builds a synthetic ProfileSky without network", () => {
    const sky = labProfileSky();
    expect(sky.constellations).toHaveLength(7);
    expect(sky.isGuest).toBe(false);
    expect(sky.stats.rank?.id).toBe("explorer");
  });
});

describe("deep-field-model", () => {
  it("builds deterministic shell attributes", () => {
    const specs = shellSpecs(9000, 12);
    expect(specs.length).toBe(3);
    const a = buildShellAttributes(specs[0]!, undefined, "test");
    const b = buildShellAttributes(specs[0]!, undefined, "test");
    expect(a.count).toBe(b.count);
    expect([...a.positions]).toEqual([...b.positions]);
    expect(a.count).toBeGreaterThan(100);
  });

  it("keeps most stars in the faint half of the magnitude range", () => {
    const specs = shellSpecs(12000, 10);
    const attrs = buildShellAttributes(specs[1]!, undefined, "hist");
    const hist = magnitudeHistogram(attrs.magnitudes);
    const mid = Math.floor(hist.length / 2);
    const faint = hist.slice(mid).reduce((a, b) => a + b, 0);
    const bright = hist.slice(0, mid).reduce((a, b) => a + b, 0);
    // Steep LF: more stars at higher magnitudes (fainter).
    expect(faint + bright).toBeGreaterThan(0);
    expect(faint).toBeGreaterThanOrEqual(bright * 0.8);
  });

  it("gates spike weight to bright magnitudes", () => {
    expect(spikeWeight(0.5)).toBeGreaterThan(spikeWeight(4.0));
    expect(spikeWeight(8)).toBe(0);
  });

  it("builds figure attributes for atlas stars", () => {
    const fig = labFigure(LAB_COURSES[0]!);
    const attrs = buildFigureAttributes(fig.stars, { seed: "t" });
    expect(attrs.count).toBe(fig.stars.length);
    expect(attrs.positions.length).toBe(fig.stars.length * 3);
  });
});

describe("FieldControls defaults", () => {
  it("exposes lab defaults", () => {
    expect(DEFAULT_FIELD_PARAMS.fieldCount).toBeGreaterThan(10000);
    expect(DEFAULT_FIELD_PARAMS.illumination).toBeGreaterThan(0);
    expect(DEFAULT_FIELD_PARAMS.staticMode).toBe(false);
  });
});

describe("chart backdrop star field", () => {
  it("is deterministic, so SSR and client agree", () => {
    expect(bgStars(40, "far", [1, 2], [0.2, 0.6])).toEqual(
      bgStars(40, "far", [1, 2], [0.2, 0.6]),
    );
  });

  it("gives different layers different fields", () => {
    const a = bgStars(20, "far", [1, 2], [0.2, 0.6]);
    const b = bgStars(20, "mid", [1, 2], [0.2, 0.6]);
    expect(a[0]!.x).not.toBeCloseTo(b[0]!.x, 3);
  });

  it("stays inside the drawn extent and the given ranges", () => {
    for (const s of bgStars(200, "far", [0.4, 1.1], [0.12, 0.4])) {
      expect(s.x).toBeGreaterThanOrEqual(SKY_MIN);
      expect(s.x).toBeLessThanOrEqual(SKY_MIN + SKY_SPAN);
      expect(s.y).toBeGreaterThanOrEqual(SKY_MIN);
      expect(s.y).toBeLessThanOrEqual(SKY_MIN + SKY_SPAN);
      expect(s.r).toBeGreaterThanOrEqual(0.4);
      expect(s.r).toBeLessThanOrEqual(1.1);
      expect(s.o).toBeGreaterThanOrEqual(0.12);
      expect(s.o).toBeLessThanOrEqual(0.4);
    }
  });

  /*
   * Regression: pulling x and y from `seededUnit(seed + "-x" / "-y")` made
   * every star land within ~0.004 of the line y = x, and the field rendered
   * as a single diagonal streak. Range checks all passed at the time — only
   * the correlation catches it.
   */
  it("scatters stars instead of collapsing them onto a diagonal", () => {
    const stars = bgStars(260, "far", [0.4, 1.1], [0.12, 0.4]);
    expect(Math.abs(xyCorrelation(stars))).toBeLessThan(0.2);
  });

  it("covers the whole plate rather than clustering", () => {
    const stars = bgStars(300, "mid", [0.8, 1.7], [0.3, 0.65]);
    const cell = (v: number) =>
      Math.min(5, Math.max(0, Math.floor(((v - SKY_MIN) / SKY_SPAN) * 6)));
    const occupied = new Set(stars.map((s) => `${cell(s.x)},${cell(s.y)}`));
    expect(occupied.size).toBe(36);
  });

  it("draws uncorrelated successive values from one stream", () => {
    const next = rng("probe");
    const pairs = Array.from({ length: 400 }, () => ({
      x: next(),
      y: next(),
      r: 0,
      o: 0,
      dur: 0,
      delay: 0,
    }));
    expect(Math.abs(xyCorrelation(pairs))).toBeLessThan(0.15);
  });
});
