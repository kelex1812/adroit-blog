/**
 * chart.test.ts — the adapter and the layout.
 *
 * These cover the claims the chart makes about someone's progress, which is why
 * the adapter was kept pure. The renderer is presentational; if a figure lights
 * the wrong rails or crowns the wrong node, it happens here.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildChartFigure,
  buildChartFigures,
  examPassedSlugs,
  figureProgress,
} from "./chart";
import {
  chartLayout,
  figureArtFor,
  layoutCapacity,
  plateSlug,
  PLATE_SLUGS,
} from "@/components/Constellations/chart/chart-figures";
import type {
  ChronicleEntry,
  ConstellationState,
  ProfileSky,
} from "@/shared/contracts-constellations";

function constellation(
  over: Partial<ConstellationState> & { seriesSlug: string },
): ConstellationState {
  const totalStars = over.totalStars ?? 10;
  const litStars = over.litStars ?? 0;
  return {
    courseId: over.courseId ?? `course-${over.seriesSlug}`,
    seriesSlug: over.seriesSlug,
    name: over.name ?? "A Course",
    gradient: over.gradient ?? "from-blue-500 to-purple-500",
    totalStars,
    litStars,
    complete: over.complete ?? (totalStars > 0 && litStars === totalStars),
    stars: over.stars ?? [],
  };
}

function chronicleEntry(over: Partial<ChronicleEntry>): ChronicleEntry {
  return {
    id: over.id ?? 1,
    eventType: over.eventType ?? "lesson",
    courseId: over.courseId ?? "c1",
    seriesSlug: over.seriesSlug ?? null,
    courseName: over.courseName ?? null,
    label: over.label ?? "",
    completedAt: over.completedAt ?? "2026-01-01T00:00:00.000Z",
    score: over.score ?? null,
  };
}

describe("figureProgress", () => {
  it("is the lit fraction of the course", () => {
    expect(figureProgress({ litStars: 5, totalStars: 10 })).toBe(0.5);
    expect(figureProgress({ litStars: 10, totalStars: 10 })).toBe(1);
  });

  it("returns 0 rather than NaN for a course with no lessons", () => {
    expect(figureProgress({ litStars: 0, totalStars: 0 })).toBe(0);
  });

  it("clamps impossible data instead of exceeding 1", () => {
    expect(figureProgress({ litStars: 14, totalStars: 10 })).toBe(1);
    expect(figureProgress({ litStars: -3, totalStars: 10 })).toBe(0);
  });
});

describe("examPassedSlugs", () => {
  it("collects series with an exam event, since the event is only written on a pass", () => {
    const passed = examPassedSlugs([
      chronicleEntry({ eventType: "exam", seriesSlug: "agentic-ai" }),
      chronicleEntry({ eventType: "quiz", seriesSlug: "omni-studio-cert" }),
      chronicleEntry({ eventType: "lesson", seriesSlug: "ai-at-work" }),
    ]);
    expect([...passed]).toEqual(["agentic-ai"]);
  });

  it("ignores exam events with no series attached", () => {
    expect(examPassedSlugs([chronicleEntry({ eventType: "exam", seriesSlug: null })]).size).toBe(0);
  });
});

describe("buildChartFigure", () => {
  it("resolves the mapped constellation and its connections", () => {
    const f = buildChartFigure(
      constellation({ seriesSlug: "agentic-ai", litStars: 0, totalStars: 10 }),
    );
    expect(f.figureName).toBe("Cassiopeia");
    expect(f.stars).toHaveLength(5);
    expect(f.connections.length).toBeGreaterThan(0);
  });

  /*
   * A course with no asterism is a supported state, not an error — it renders
   * label and progress only. The guard that matters is that it never produces a
   * figure with connections pointing at stars that do not exist.
   */
  it("degrades to a label-only figure when no constellation is mapped", () => {
    const f = buildChartFigure(
      constellation({ seriesSlug: "not-a-real-course", litStars: 3, totalStars: 6 }),
    );
    expect(f.figureName).toBeNull();
    expect(f.stars).toEqual([]);
    expect(f.connections).toEqual([]);
    // Progress is still real and still renderable.
    expect(f.litStars).toBe(3);
    expect(f.totalStars).toBe(6);
  });

  it("crowns exactly one member as the exam", () => {
    const f = buildChartFigure(constellation({ seriesSlug: "omni-studio-cert" }));
    expect(f.stars.filter((s) => s.role === "exam")).toHaveLength(1);
  });

  it("crowns the brightest member, so the exam node is the figure's anchor star", () => {
    const f = buildChartFigure(constellation({ seriesSlug: "omni-studio-cert" }));
    const exam = f.stars.find((s) => s.role === "exam")!;
    const brightest = Math.min(...f.stars.map((s) => s.magnitude));
    expect(exam.magnitude).toBe(brightest);
    // Vega is Lyra's anchor.
    expect(exam.name).toContain("Vega");
    expect(exam.name).toContain("Final exam");
  });

  it("ships two roles only — knowledge checks are not faked in v1", () => {
    const f = buildChartFigure(constellation({ seriesSlug: "salesforce-architect" }));
    expect(new Set(f.stars.map((s) => s.role))).toEqual(new Set(["lesson", "exam"]));
  });

  it("leaves the crown dark until the course is finished", () => {
    const partial = buildChartFigure(
      constellation({ seriesSlug: "agentic-ai", litStars: 9, totalStars: 10 }),
    );
    expect(partial.complete).toBe(false);
    expect(partial.stars.find((s) => s.role === "exam")?.lit).toBe(false);
  });

  it("lights the crown when the course is complete", () => {
    const done = buildChartFigure(
      constellation({ seriesSlug: "agentic-ai", litStars: 10, totalStars: 10 }),
    );
    expect(done.complete).toBe(true);
    expect(done.stars.find((s) => s.role === "exam")?.lit).toBe(true);
  });

  /*
   * The exam event is the only exam truth ProfileSky carries. A learner can
   * pass the cert exam without every lesson being ticked, and that should crown
   * the figure — otherwise passing the exam is invisible.
   */
  it("lights the crown on a passed exam even when lessons remain", () => {
    const f = buildChartFigure(
      constellation({ seriesSlug: "agentic-ai", litStars: 4, totalStars: 10 }),
      { examPassed: true },
    );
    expect(f.complete).toBe(false);
    expect(f.examPassed).toBe(true);
    expect(f.stars.find((s) => s.role === "exam")?.lit).toBe(true);
  });

  it("lights more members as progress rises, and all of them when complete", () => {
    const lit = (n: number) =>
      buildChartFigure(
        constellation({ seriesSlug: "ai-at-work", litStars: n, totalStars: 10 }),
      ).stars.filter((s) => s.lit).length;
    expect(lit(0)).toBe(0);
    expect(lit(5)).toBeGreaterThan(0);
    expect(lit(5)).toBeLessThan(lit(10));
    const all = buildChartFigure(
      constellation({ seriesSlug: "ai-at-work", litStars: 10, totalStars: 10 }),
    );
    expect(all.stars.every((s) => s.lit)).toBe(true);
  });

  /*
   * Orion pads to 29 members so the 3D scene can give every lesson a star, but
   * only the 9 forming the hunter are connected. The chart draws the figure, so
   * the padding must never be lit — a lit floating dot outside the figure is
   * the visible symptom.
   */
  it("never lights Orion's unconnected padding members", () => {
    const f = buildChartFigure(
      constellation({ seriesSlug: "salesforce-architect", litStars: 29, totalStars: 29 }),
    );
    const drawn = new Set(f.connections.flat());
    for (const [i, s] of f.stars.entries()) {
      if (!drawn.has(i)) expect(s.lit, `padding member ${i} is lit`).toBe(false);
    }
  });

  it("is deterministic — the same course produces the same figure", () => {
    const c = constellation({ seriesSlug: "hermes-consultant", litStars: 4, totalStars: 9 });
    expect(JSON.stringify(buildChartFigure(c))).toBe(JSON.stringify(buildChartFigure(c)));
  });
});

describe("buildChartFigures", () => {
  const sky = (over: Partial<ProfileSky> = {}): ProfileSky => ({
    stats: {
      streakDays: 0,
      longestStreakDays: 0,
      rank: null,
      coursesCompleted: 0,
      tracksCompleted: 0,
    },
    constellations: over.constellations ?? [],
    chronicle: over.chronicle ?? [],
    isGuest: false,
  });

  it("builds one figure per course, in catalog order", () => {
    const figures = buildChartFigures(
      sky({
        constellations: [
          constellation({ seriesSlug: "agentic-ai" }),
          constellation({ seriesSlug: "ai-at-work" }),
        ],
      }),
    );
    expect(figures.map((f) => f.seriesSlug)).toEqual(["agentic-ai", "ai-at-work"]);
  });

  it("wires the chronicle's exam events through to the right course", () => {
    const figures = buildChartFigures(
      sky({
        constellations: [
          constellation({ seriesSlug: "agentic-ai", litStars: 2, totalStars: 10 }),
          constellation({ seriesSlug: "ai-at-work", litStars: 2, totalStars: 10 }),
        ],
        chronicle: [chronicleEntry({ eventType: "exam", seriesSlug: "ai-at-work" })],
      }),
    );
    expect(figures.find((f) => f.seriesSlug === "agentic-ai")!.examPassed).toBe(false);
    expect(figures.find((f) => f.seriesSlug === "ai-at-work")!.examPassed).toBe(true);
  });

  it("handles an empty sky without throwing", () => {
    expect(buildChartFigures(sky())).toEqual([]);
  });
});

describe("chartLayout", () => {
  it("returns one slot per course", () => {
    expect(chartLayout(7)).toHaveLength(7);
    expect(chartLayout(0)).toEqual([]);
  });

  it("keeps every figure inside the plate", () => {
    for (const count of [1, 7, 12, 26, 40]) {
      for (const slot of chartLayout(count)) {
        const dx = slot.cx - 500;
        const dy = slot.cy - 520;
        expect(Math.hypot(dx, dy), `count ${count} escaped the plate`).toBeLessThanOrEqual(331);
      }
    }
  });

  it("never overlaps two figures", () => {
    for (const count of [2, 7, 8, 12, 18, 26, 36, 50, 64]) {
      const slots = chartLayout(count);
      for (let i = 0; i < slots.length; i++) {
        for (let j = i + 1; j < slots.length; j++) {
          const d = Math.hypot(slots[i]!.cx - slots[j]!.cx, slots[i]!.cy - slots[j]!.cy);
          /*
           * A figure is drawn out to about `70 * scale` from its centre, so two
           * centres must stay more than that apart or the linework collides.
           */
          expect(d, `count ${count}: slots ${i}/${j} collide`).toBeGreaterThan(
            140 * slots[i]!.scale,
          );
        }
      }
    }
  });

  /*
   * Regression: even-area packing (`r ∝ √i`) put the first figures of a
   * seven-course sky near the centre and left the outer plate empty, so the
   * chart read as a huddle in the middle of a large circle. Every assertion
   * above passed while that was true — only the distance from centre catches it.
   */
  it("pushes a sparse sky out into a ring rather than huddling it centrally", () => {
    for (const count of [3, 7, 8]) {
      const radii = chartLayout(count).map((s) =>
        Math.hypot(s.cx - 500, s.cy - 520),
      );
      expect(Math.min(...radii), `count ${count} sits too close to centre`)
        .toBeGreaterThan(0.45 * 330);
    }
  });

  it("uses the full disc once there are enough figures to fill it", () => {
    const radii = chartLayout(26).map((s) => Math.hypot(s.cx - 500, s.cy - 520));
    // A full sky should reach both the middle and the rim.
    expect(Math.min(...radii)).toBeLessThan(0.35 * 330);
    expect(Math.max(...radii)).toBeGreaterThan(0.9 * 330);
  });

  it("is deterministic", () => {
    expect(chartLayout(9)).toEqual(chartLayout(9));
  });

  /*
   * §3.3 of the plan: adding a course must not make every existing figure jump.
   * Layout is a function of the capacity tier, so growth inside a tier is
   * append-only and only a tier crossing reshuffles.
   */
  it("does not move existing figures when a course is added inside the tier", () => {
    expect(layoutCapacity(7)).toBe(layoutCapacity(8));
    const before = chartLayout(7);
    const after = chartLayout(8);
    expect(after.slice(0, 7)).toEqual(before);
  });

  it("steps to a bigger tier rather than cramming", () => {
    expect(layoutCapacity(8)).toBe(8);
    expect(layoutCapacity(9)).toBe(12);
    expect(layoutCapacity(60)).toBeGreaterThanOrEqual(60);
  });

  it("shrinks figures as the sky fills up", () => {
    expect(chartLayout(26)[0]!.scale).toBeLessThan(chartLayout(7)[0]!.scale);
  });
});

describe("figure art registry", () => {
  it("slugifies constellation names, including two-word and accented ones", () => {
    expect(plateSlug("Orion")).toBe("orion");
    expect(plateSlug("Corona Borealis")).toBe("corona-borealis");
    expect(plateSlug("Canes Venatici")).toBe("canes-venatici");
    expect(plateSlug("Boötes")).toBe("bootes");
  });

  it("resolves a plate for every constellation the courses map to", () => {
    for (const name of [
      "Orion",
      "Cassiopeia",
      "Lyra",
      "Corvus",
      "Delphinus",
      "Corona Borealis",
      "Cygnus",
    ]) {
      const art = figureArtFor(name);
      expect(art, `${name} has no plate`).not.toBeNull();
      expect(art!.src).toBe(`/constellations/${plateSlug(name)}.webp`);
    }
  });

  it("returns null rather than a broken image for an unmapped figure", () => {
    expect(figureArtFor(null)).toBeNull();
    expect(figureArtFor("Not A Constellation")).toBeNull();
  });

  it("covers all 88 IAU constellations, so a new course needs a mapping not art", () => {
    expect(PLATE_SLUGS.size).toBe(88);
  });

  /*
   * There is no runtime existence check in the browser: a slug in this set with
   * no file on disk renders as a broken `<image>`. This is the guard.
   */
  it("matches the plates actually on disk", () => {
    const dir = path.join(process.cwd(), "public", "constellations");
    const onDisk = new Set(
      fs
        .readdirSync(dir)
        .filter((f) => f.endsWith(".webp"))
        .map((f) => f.replace(/\.webp$/, "")),
    );
    const missing = [...PLATE_SLUGS].filter((s) => !onDisk.has(s));
    const untracked = [...onDisk].filter((s) => !PLATE_SLUGS.has(s));
    expect(missing, "declared in PLATE_SLUGS but not on disk").toEqual([]);
    expect(untracked, "on disk but not declared in PLATE_SLUGS").toEqual([]);
  });
});
