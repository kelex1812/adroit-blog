/**
 * 3D constellation — pure model + DOM overlay tests.
 *
 * The r3f scenes (SeriesScene, ProfileScene) need WebGL and are lazy-loaded
 * (ssr:false), so they are NOT unit-tested here. What IS tested is the pure,
 * deterministic layer that feeds them — the star/galaxy models, WebGL gating,
 * and the DOM HUD chrome (tooltip, minimap, loading) — which is where the
 * design decisions (state→color, rank→illumination, sector layout) live.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import {
  buildSeriesStars,
  litFraction,
  stateLabel,
  STAR_PALETTE,
  SPECTRAL_ARC,
  BETELGEUSE_ACCENT,
} from "./star-model";
import {
  buildGalaxyModel,
  rankIllumination,
  type GalaxySector,
} from "./galaxy-model";
import {
  asterismFor,
  hasAsterism,
  projectAsterism,
  overlayAsterism,
} from "./asterism-data";
import { supportsWebGL } from "./webgl";
import { StarTooltip } from "./StarTooltip";
import { SectorMinimap } from "./SectorMinimap";
import { LoadingSky } from "./LoadingSky";
import type { ProfileSky, ConstellationState } from "@/shared/contracts-constellations";

/* ── fixtures ─────────────────────────────────────────────────────── */

function makeConstellation(overrides: Partial<ConstellationState> = {}): ConstellationState {
  return {
    courseId: "c1",
    seriesSlug: "salesforce-architect",
    name: "Salesforce System Architect Primer",
    gradient: "from-sky-500 to-indigo-500",
    totalStars: 4,
    litStars: 2,
    complete: false,
    stars: [
      { lessonSlug: "l1", index: 1, label: "Lesson One", lit: true },
      { lessonSlug: "l2", index: 2, label: "Lesson Two", lit: true },
      { lessonSlug: "l3", index: 3, label: "Lesson Three", lit: false },
      { lessonSlug: "l4", index: 4, label: "Lesson Four", lit: false },
    ],
    ...overrides,
  };
}

function makeSky(overrides: Partial<ProfileSky> = {}): ProfileSky {
  return {
    stats: {
      coursesCompleted: 1,
      tracksCompleted: 0,
      streakDays: 3,
      longestStreakDays: 3,
      rank: {
        id: "explorer",
        name: "Explorer",
        index: 2,
        description: "Charting the deep sky.",
        nextProgressPct: 40,
      },
    },
    constellations: [makeConstellation()],
    chronicle: [
          { id: 1, eventType: "article", courseId: null, seriesSlug: null, courseName: null, label: "A Field Guide to Agents", completedAt: "2026-09-01T10:00:00Z" },
          { id: 2, eventType: "article", courseId: null, seriesSlug: null, courseName: null, label: "The Deep Sky", completedAt: "2026-09-01T11:00:00Z" },
        ],
    isGuest: false,
    ...overrides,
  };
}

/* ── star-model ───────────────────────────────────────────────────── */

describe("buildSeriesStars", () => {
  it("maps lit/unlit + current lesson into the 3D state ladder", () => {
    const stars = buildSeriesStars({ constellation: makeConstellation(), currentLessonSlug: "l3" });
    const bySlug = Object.fromEntries(stars.map((s) => [s.slug, s]));
    expect(bySlug.l1.state).toBe("ignited");
    expect(bySlug.l2.state).toBe("ignited");
    expect(bySlug.l3.state).toBe("current");
    expect(bySlug.l4.state).toBe("unlit");
  });

  it("marks every star complete when the whole course is done", () => {
    const stars = buildSeriesStars({
      constellation: makeConstellation({
        complete: true,
        litStars: 4,
        stars: [
          { lessonSlug: "l1", index: 1, label: "L1", lit: true },
          { lessonSlug: "l2", index: 2, label: "L2", lit: true },
          { lessonSlug: "l3", index: 3, label: "L3", lit: true },
          { lessonSlug: "l4", index: 4, label: "L4", lit: true },
        ],
      }),
      currentLessonSlug: "l4",
    });
    expect(stars.every((s) => s.state === "complete")).toBe(true);
  });

  it("assigns unique 3D positions and per-star variation", () => {
    const stars = buildSeriesStars({ constellation: makeConstellation(), currentLessonSlug: null });
    const positions = new Set(stars.map((s) => s.position.join(",")));
    expect(positions.size).toBe(stars.length); // no two stars share a position
    const twinkles = new Set(stars.map((s) => `${s.twinkleDuration}-${s.twinklePhase}`));
    expect(twinkles.size).toBeGreaterThan(1); // staggered, never in unison
  });

  it("keeps the REV 2 palette: unlit cool, current blue-white, ignited warm-gold, complete white-hot (never red)", () => {
      expect(STAR_PALETTE.unlit.color).toBe("#6b7a99");
      expect(STAR_PALETTE.current.color).toBe("#aac4ff");
      expect(STAR_PALETTE.ignited.color).toBe("#fff4e0");
      expect(STAR_PALETTE.complete.color).toBe("#ffffff");
      // Red is reserved for the Betelgeuse accuracy accent only (ADR-303).
      expect(BETELGEUSE_ACCENT).toBe("#ff7a3d");
    });

    it("exposes the real OBAFGKM spectral arc for per-star color temperature", () => {
      expect(Object.keys(SPECTRAL_ARC)).toEqual(["O", "B", "A", "F", "G", "K", "M"]);
      expect(SPECTRAL_ARC.O.color).toBe("#9bb0ff");
      expect(SPECTRAL_ARC.G.color).toBe("#fff4e0");
      expect(SPECTRAL_ARC.M.color).toBe("#ffcc6f");
    });

    it("derives per-star spectral class + magnitude (vary every star)", () => {
      const stars = buildSeriesStars({ constellation: makeConstellation(), currentLessonSlug: null });
      const classes = new Set(stars.map((s) => s.spectralClass));
      expect(classes.size).toBeGreaterThan(1); // not all identical
      expect(stars.every((s) => typeof s.magnitude === "number")).toBe(true);
    });
  });

describe("litFraction + stateLabel", () => {
  it("reports the lit fraction for HUD chrome", () => {
    expect(litFraction(buildSeriesStars({ constellation: makeConstellation(), currentLessonSlug: null }))).toBe(0.5);
  });
  it("labels states for the tooltip chip", () => {
    expect(stateLabel("complete")).toBe("Complete");
    expect(stateLabel("current")).toBe("Current");
    expect(stateLabel("ignited")).toBe("Ignited");
    expect(stateLabel("unlit")).toBe("Unlit");
  });
});

/* ── galaxy-model ──────────────────────────────────────────────────── */

describe("buildGalaxyModel", () => {
  it("places each course as a sector on a ring, lit by its constellation", () => {
    const { sectors } = buildGalaxyModel({ sky: makeSky() });
    expect(sectors).toHaveLength(1);
    const s = sectors[0];
    expect(s.seriesSlug).toBe("salesforce-architect");
    expect(s.litStars).toBe(2);
    expect(s.totalStars).toBe(4);
    expect(s.state).toBe("in-progress"); // partially lit
    expect(s.position).toHaveLength(3);
    expect(s.minimap).toHaveProperty("x");
    expect(s.minimap).toHaveProperty("y");
  });

  it("marks a fully-lit sector completed and an empty one unstarted", () => {
    const full = buildGalaxyModel({
      sky: makeSky({
        constellations: [makeConstellation({
          complete: true,
          litStars: 4,
          stars: [
            { lessonSlug: "l1", index: 1, label: "L1", lit: true },
            { lessonSlug: "l2", index: 2, label: "L2", lit: true },
            { lessonSlug: "l3", index: 3, label: "L3", lit: true },
            { lessonSlug: "l4", index: 4, label: "L4", lit: true },
          ],
        })],
      }),
    });
    expect(full.sectors[0].state).toBe("completed");

    const empty = buildGalaxyModel({
      sky: makeSky({
        constellations: [makeConstellation({
          litStars: 0,
          stars: [
            { lessonSlug: "l1", index: 1, label: "L1", lit: false },
            { lessonSlug: "l2", index: 2, label: "L2", lit: false },
            { lessonSlug: "l3", index: 3, label: "L3", lit: false },
            { lessonSlug: "l4", index: 4, label: "L4", lit: false },
          ],
        })],
      }),
    });
    expect(empty.sectors[0].state).toBe("unstarted");
  });

  it("scatters free-floating article stars from REAL article rows (G1)", () => {
    const { articles } = buildGalaxyModel({ sky: makeSky() });
    expect(articles).toHaveLength(2);
    expect(articles[0].title).toBe("A Field Guide to Agents");
    expect(articles[0].position).toHaveLength(3);
  });

  it("does NOT fake article stars from lesson rows (G1)", () => {
    const sky = makeSky({
      chronicle: [
        { id: 1, eventType: "lesson", courseId: "c1", seriesSlug: "salesforce-architect", courseName: "Salesforce System Architect Primer", label: "Lesson One", completedAt: "2026-09-01T10:00:00Z" },
      ],
    });
    const { articles } = buildGalaxyModel({ sky });
    expect(articles).toHaveLength(0);
  });

  it("maps rank → galaxy illumination monotonically", () => {
    const ids = ["starseed", "wayfarer", "explorer", "polestar", "celestial"] as const;
    const vals = ids.map((r) => rankIllumination(r));
    for (let i = 1; i < vals.length; i++) expect(vals[i]).toBeGreaterThan(vals[i - 1]);
  });
});

/* ── asterism-data (real-astronomy grounding, ADR-307) ─────────────── */

describe("asterism-data", () => {
  it("maps known courses to real constellations (Orion, Cassiopeia)", () => {
    expect(asterismFor("salesforce-architect")?.name).toBe("Orion");
    expect(asterismFor("agentic-ai")?.name).toBe("Cassiopeia");
    expect(hasAsterism("salesforce-architect")).toBe(true);
    expect(hasAsterism("unknown-series")).toBe(false);
  });

  it("authors real member stars with spectral class + magnitude", () => {
    const orion = asterismFor("salesforce-architect");
    expect(orion).not.toBeNull();
    expect(orion!.stars.length).toBeGreaterThanOrEqual(29); // lesson count
    // Betelgeuse is the astronomically-red accent (ADR-303).
    const betelgeuse = orion!.stars.find((s) => s.name.includes("Betelgeuse"));
    expect(betelgeuse?.isRedGiantAccent).toBe(true);
    expect(betelgeuse?.spectralClass).toBe("M");
    // Rigel is blue-white.
    const rigel = orion!.stars.find((s) => s.name.includes("Rigel"));
    expect(rigel?.spectralClass).toBe("B");
    // M42 is the nebula ignition anchor.
    const m42 = orion!.stars.find((s) => s.isNebula);
    expect(m42?.name).toContain("M42");
  });

  it("projects the asterism to unique 3D positions (deterministic)", () => {
    const orion = asterismFor("salesforce-architect")!;
    const a = projectAsterism(orion);
    const b = projectAsterism(orion);
    expect(a).toHaveLength(orion.stars.length);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b)); // deterministic
    const positions = new Set(a.map((s) => s.position.join(",")));
    expect(positions.size).toBe(a.length); // no two stars share a position
    a.forEach((s) => expect(s.position).toHaveLength(3));
  });

  it("overlays real asterism data onto the Star3D set (keeps star-model pure)", () => {
    const base = buildSeriesStars({
      constellation: makeConstellation(),
      currentLessonSlug: null,
    });
    const overlaid = overlayAsterism(base, "salesforce-architect");
    expect(overlaid).toHaveLength(base.length);
    // Positions now come from the real asterism, not the scaffold.
    expect(overlaid[0].position).not.toEqual(base[0].position);
    overlaid.forEach((s) => {
      expect(s.spectralClass).toBeDefined();
      expect(typeof s.magnitude).toBe("number");
    });
  });

  it("leaves unknown series untouched (graceful fallback)", () => {
    const base = buildSeriesStars({
      constellation: makeConstellation(),
      currentLessonSlug: null,
    });
    const overlaid = overlayAsterism(base, "unknown-series");
    expect(overlaid).toEqual(base);
  });
});

/* ── webgl gating ──────────────────────────────────────────────────── */

describe("supportsWebGL", () => {
  it("returns false when the canvas context is unavailable (SSR/headless)", () => {
    expect(
      supportsWebGL({
        windowStub: { WebGL2RenderingContext: {}, WebGLRenderingContext: {} },
        ctxGetter: () => null,
      }),
    ).toBe(false);
  });

  it("returns true when a webgl2 context is available", () => {
    expect(
      supportsWebGL({
        windowStub: { WebGL2RenderingContext: {}, WebGLRenderingContext: {} },
        ctxGetter: () => ({}),
      }),
    ).toBe(true);
  });

  it("returns false when the WebGL API is entirely absent (SSR)", () => {
    expect(supportsWebGL({ windowStub: {} })).toBe(false);
  });
});

/* ── DOM HUD chrome ───────────────────────────────────────────────── */

describe("StarTooltip", () => {
  it("renders the lesson kicker, title, and state chip", () => {
    render(<StarTooltip x={120} y={80} kicker="Lesson 3" title="Lesson Three" stateLabel="Current" />);
    expect(screen.getByText("Lesson 3")).toBeInTheDocument();
        expect(screen.getByText("Lesson Three")).toBeInTheDocument();
        expect(screen.getByText(/Current/)).toBeInTheDocument();
  });
});

describe("SectorMinimap", () => {
  const sectors: GalaxySector[] = [
    { seriesSlug: "a", name: "Alpha", position: [0, 0, 0], state: "completed", litStars: 4, totalStars: 4, minimap: { x: 0.5, y: 0.5 } },
    { seriesSlug: "b", name: "Beta", position: [1, 0, 0], state: "in-progress", litStars: 2, totalStars: 4, minimap: { x: 0.6, y: 0.5 } },
    { seriesSlug: "c", name: "Gamma", position: [0, 0, 1], state: "unstarted", litStars: 0, totalStars: 4, minimap: { x: 0.5, y: 0.6 } },
  ];

  it("renders one clickable dot per sector", () => {
    render(<SectorMinimap sectors={sectors} activeSlug={null} onSelect={() => {}} />);
    expect(screen.getAllByRole("button")).toHaveLength(3);
  });

  it("fires onSelect with the sector slug on click", () => {
    const onSelect = vi.fn();
    render(<SectorMinimap sectors={sectors} activeSlug={null} onSelect={onSelect} />);
    fireEvent.click(screen.getAllByRole("button")[1]);
    expect(onSelect).toHaveBeenCalledWith("b");
  });
});

describe("LoadingSky", () => {
  it("shows the shimmer fallback with its label", () => {
    render(<LoadingSky label="Materializing your galaxy" />);
    expect(screen.getByText("Materializing your galaxy")).toBeInTheDocument();
  });
});
