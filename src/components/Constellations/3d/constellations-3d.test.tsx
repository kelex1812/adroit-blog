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
  glyphFor,
  buildRoad,
  frontierSlug,
  withFocus,
  isTraveled,
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
import { RankChip } from "./RankChip";
import { Legend } from "./Legend";
import { JourneyRail } from "./JourneyRail";
import { ConstellationCard } from "./ConstellationCard";
import { SkyChart } from "./SkyChart";
import type { ProfileSky, ConstellationState } from "@/shared/contracts-constellations";

/* ── fixtures ─────────────────────────────────────────────────────── */

function makeConstellation(overrides: Partial<ConstellationState> = {}): ConstellationState {
  return {
    courseId: "c1",
    seriesSlug: "salesforce-architect",
    name: "Salesforce System Architect Primer",
    curriculumLessons: 29,
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

/** The five figures the Phase 2 port promoted out of the lab. */
const PROMOTED_FIGURE_SLUGS = [
  "omni-studio-cert",
  "hermes-consultant",
  "hermes-consultant-intermediate",
  "hermes-consultant-advanced",
  "ai-at-work",
] as const;

const ALL_FIGURE_SLUGS = [
  "salesforce-architect",
  "agentic-ai",
  ...PROMOTED_FIGURE_SLUGS,
] as const;

describe("asterism-data", () => {
  it("maps known courses to real constellations (Orion, Cassiopeia)", () => {
    expect(asterismFor("salesforce-architect")?.name).toBe("Orion");
    expect(asterismFor("agentic-ai")?.name).toBe("Cassiopeia");
    expect(hasAsterism("salesforce-architect")).toBe(true);
    expect(hasAsterism("unknown-series")).toBe(false);
  });

  it("covers all seven catalog courses after the Phase 2 promotion", () => {
    const expected: Record<(typeof ALL_FIGURE_SLUGS)[number], string> = {
      "salesforce-architect": "Orion",
      "agentic-ai": "Cassiopeia",
      "omni-studio-cert": "Lyra",
      "hermes-consultant": "Corvus",
      "hermes-consultant-intermediate": "Delphinus",
      "hermes-consultant-advanced": "Corona Borealis",
      "ai-at-work": "Cygnus",
    };
    for (const slug of ALL_FIGURE_SLUGS) {
      expect(hasAsterism(slug)).toBe(true);
      expect(asterismFor(slug)?.name).toBe(expected[slug]);
    }
  });

  /*
   * Connections index into `stars`, so an out-of-range pair silently drops a
   * line rather than throwing — the five promoted figures were hand-authored,
   * which is exactly where an off-by-one lands.
   */
  it("keeps every connection index inside the member list", () => {
    for (const slug of ALL_FIGURE_SLUGS) {
      const a = asterismFor(slug)!;
      for (const [x, y] of a.connections) {
        expect(a.stars[x], `${a.name} connection start ${x}`).toBeDefined();
        expect(a.stars[y], `${a.name} connection end ${y}`).toBeDefined();
        expect(x, `${a.name} connects a star to itself`).not.toBe(y);
      }
    }
  });

  /*
   * Orion is the odd one out: it pads to 29 members so every lesson gets a
   * star, but only the 9 that form the recognizable hunter are connected. The
   * chart draws connected members only, so the other 20 never appear there.
   * The five figures promoted from the lab were authored as pure figures, so
   * for them "every member is drawn" IS the invariant, and a stray member
   * would be an authoring slip rather than a deliberate pad.
   */
  it("draws every member of the five promoted figures", () => {
    for (const slug of PROMOTED_FIGURE_SLUGS) {
      const a = asterismFor(slug)!;
      const drawn = new Set(a.connections.flat());
      expect(drawn.size, `${a.name} has an undrawn member`).toBe(
        a.stars.length,
      );
    }
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

/* ── deep-sky Sky Roads (kara t_ea789325) — glyph / road / frontier / focus ── */

function navSectors(): ReturnType<typeof buildGalaxyModel>["sectors"] {
  // Reuse makeSky's single in-progress Orion-mapped course + extra dummy courses
  // so road/frontier ordering is meaningful.
  const sky = makeSky({
    constellations: [
      makeConstellation(), // salesforce-architect, in-progress
      makeConstellation({
        seriesSlug: "data-cloud",
        name: "Data Cloud Architect",
        courseId: "c2",
        complete: true,
        litStars: 4,
        stars: Array.from({ length: 4 }, (_, i) => ({
          lessonSlug: `d${i + 1}`,
          index: i + 1,
          label: `D${i + 1}`,
          lit: true,
        })),
      }),
      makeConstellation({
        seriesSlug: "admin",
        name: "Admin Starter",
        courseId: "c3",
        litStars: 0,
        stars: Array.from({ length: 4 }, (_, i) => ({
          lessonSlug: `a${i + 1}`,
          index: i + 1,
          label: `A${i + 1}`,
          lit: false,
        })),
      }),
    ],
  });
  return buildGalaxyModel({ sky }).sectors;
}

describe("Sky Roads — glyph", () => {
  it("derives the bright-anchor subset (<3.5 mag) of a real asterism as the LOD glyph", () => {
    const g = glyphFor("salesforce-architect"); // Orion
    expect(g.length).toBeGreaterThan(0);
    for (const star of g) expect(star.magnitude).toBeLessThan(3.5);
    expect(g.some((s) => s.name.includes("Betelgeuse"))).toBe(true);
  });

  it("returns an empty glyph for a course with no authored asterism (graceful fallback)", () => {
    expect(glyphFor("no-such-course")).toEqual([]);
  });

  it("exposes each sector's glyph (no crash; Orion course gets bright anchors)", () => {
    const sectors = navSectors();
    const orion = sectors.find((s) => s.seriesSlug === "salesforce-architect")!;
    expect(orion.glyph.length).toBeGreaterThan(0);
    expect(orion.glyph[0]).toHaveProperty("name");
    expect(orion.glyph[0]).toHaveProperty("position");
  });
});

describe("Sky Roads — road + traveled/untraveled", () => {
  it("threads nodes in journey (payload) order", () => {
    const sectors = navSectors();
    const road = buildRoad(sectors);
    expect(road.nodes).toEqual([
      "salesforce-architect",
      "data-cloud",
      "admin",
    ]);
  });

  it("splits traveled (completed/certified) from untraveled", () => {
    const sectors = navSectors();
    const road = buildRoad(sectors);
    expect(road.traveled).toEqual(["data-cloud"]);
    expect(road.untraveled).toEqual(["salesforce-architect", "admin"]);
  });

  it("isTraveled matches the warm-gold segment rule", () => {
    expect(isTraveled("completed")).toBe(true);
    expect(isTraveled("certified")).toBe(true);
    expect(isTraveled("in-progress")).toBe(false);
    expect(isTraveled("unstarted")).toBe(false);
  });

  it("produces a sampled Catmull-Rom curve through the node positions", () => {
    const sectors = navSectors();
    const road = buildRoad(sectors);
    expect(road.curve.length).toBeGreaterThan(10);
    for (const pt of road.curve) expect(pt).toHaveLength(3);
    // Curve respects a single sector (no NaN).
    const single = buildRoad([sectors[0]!]);
    expect(single.curve).toEqual([sectors[0]!.position]);
  });
});

describe("Sky Roads — frontier + focus", () => {
  it("picks the first unstarted/in-progress sector in road order as the frontier", () => {
    const sectors = navSectors();
    const road = buildRoad(sectors);
    expect(frontierSlug(sectors, road)).toBe("salesforce-architect");
  });

  it("returns null when the whole sky is lit (no frontier)", () => {
    const allDone = navSectors().map((s) => ({ ...s, state: "completed" as const }));
    const road = buildRoad(allDone);
    expect(frontierSlug(allDone, road)).toBeNull();
  });

  it("buildGalaxyModel returns the extended GalaxyModel (sectors + road + frontierSlug)", () => {
    const model = buildGalaxyModel({ sky: makeSky() });
    expect(model).toHaveProperty("road");
    expect(model).toHaveProperty("frontierSlug");
    expect(model.sectors[0]).toHaveProperty("glyph");
    expect(model.sectors[0]).toHaveProperty("focus");
  });

  it("withFocus marks exactly one sector and clears on null", () => {
    const sectors = navSectors();
    const focused = withFocus(sectors, "admin");
    expect(focused.filter((s) => s.focus)).toHaveLength(1);
    expect(focused.find((s) => s.focus)!.seriesSlug).toBe("admin");
    const cleared = withFocus(focused, null);
    expect(cleared.some((s) => s.focus)).toBe(false);
  });

  it("focuses the frontier by default in buildGalaxyModel", () => {
    const sky = makeSky();
    const model = buildGalaxyModel({ sky });
    expect(model.frontierSlug).toBe("salesforce-architect"); // in-progress
    expect(model.sectors.find((s) => s.focus)!.seriesSlug).toBe(
      model.frontierSlug,
    );
  });
});

/* ── deep-sky HUD chrome (DOM, SSR-safe) ─────────────────────────── */

describe("RankChip", () => {
  it("shows the rank name + illuminated fraction of the galaxy", () => {
    render(<RankChip rank="explorer" illuminationPct={0.55} />);
    expect(screen.getByTestId("cx3d-rankchip")).toHaveTextContent("EXPLORER");
    expect(screen.getByTestId("cx3d-rankchip")).toHaveTextContent("55% lit");
    expect(screen.getByRole("status")).toHaveAttribute(
      "aria-label",
      "Explorer, 55% of the galaxy lit",
    );
  });

  it("clamps the percentage to 0-100", () => {
    render(<RankChip rank="starseed" illuminationPct={1.5} />);
    render(<RankChip rank="starseed" illuminationPct={-0.2} />);
    const chips = screen.getAllByTestId("cx3d-rankchip");
    expect(chips[0]).toHaveTextContent("100% lit");
    expect(chips[1]).toHaveTextContent("0% lit");
  });
});

describe("Legend", () => {
  it("renders collapsed by default and expands the state key on toggle", () => {
    render(<Legend />);
    expect(screen.queryByText("Certified")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /sky legend/i }));
    expect(screen.getByText("Certified")).toBeInTheDocument();
    expect(screen.getByText("Next waypoint")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /sky legend/i }));
    expect(screen.queryByText("Certified")).not.toBeInTheDocument();
  });
});

describe("JourneyRail", () => {
  it("renders every sector as a state-coded chip in road order", () => {
    const sectors = navSectors();
    const road = buildRoad(sectors);
    render(
      <JourneyRail
        sectors={sectors}
        road={road}
        focusSlug={null}
        frontierSlug={road.nodes[0]}
        onSelect={vi.fn()}
      />,
    );
    const list = screen.getByTestId("cx3d-journey-rail-list");
    const chips = Array.from(list.querySelectorAll("[data-journey-chip]"));
    expect(chips.map((c) => c.textContent)).toEqual([
      expect.stringContaining("Salesforce System Architect Primer"),
      expect.stringContaining("Data Cloud Architect"),
      expect.stringContaining("Admin Starter"),
    ]);
  });

  it("marks the frontier chip with NEXT and the focused chip as active", () => {
    const sectors = navSectors();
    const road = buildRoad(sectors);
    render(
      <JourneyRail
        sectors={sectors}
        road={road}
        focusSlug="data-cloud"
        frontierSlug="salesforce-architect"
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByTestId("cx3d-rail-chip-data-cloud")).toHaveAttribute(
      "aria-current",
      "true",
    );
    expect(screen.getByTestId("cx3d-rail-chip-salesforce-architect")).toHaveTextContent("NEXT");
  });

  it("fires onSelect with the sector slug when a chip is clicked", () => {
    const sectors = navSectors();
    const road = buildRoad(sectors);
    const onSelect = vi.fn();
    render(
      <JourneyRail
        sectors={sectors}
        road={road}
        focusSlug={null}
        frontierSlug={null}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByTestId("cx3d-rail-chip-admin"));
    expect(onSelect).toHaveBeenCalledWith("admin");
  });
});

describe("ConstellationCard", () => {
  it("shows name, lit/total, and a state chip for an in-progress sector", () => {
    const sectors = navSectors();
    render(
      <ConstellationCard sector={sectors[0]!} onContinue={vi.fn()} />,
    );
    expect(
      screen.getByText("Salesforce System Architect Primer"),
    ).toBeInTheDocument();
    expect(screen.getByText(/2\/4/)).toBeInTheDocument();
    expect(screen.getByText("In progress")).toBeInTheDocument();
  });

  it("renders a Continue CTA that fires onContinue", () => {
    const sectors = navSectors();
    const onContinue = vi.fn();
    render(<ConstellationCard sector={sectors[0]!} onContinue={onContinue} />);
    fireEvent.click(screen.getByRole("button", { name: "Continue course" }));
    expect(onContinue).toHaveBeenCalledTimes(1);
  });
});

describe("SkyChart", () => {
  it("renders a node dot per sector and a you-are-here ring on the focused node", () => {
    const sectors = navSectors();
    const road = buildRoad(sectors);
    render(
      <SkyChart
        sectors={sectors}
        road={road}
        focusSlug="data-cloud"
        frontierSlug="salesforce-architect"
        onSelect={vi.fn()}
      />,
    );
    expect(screen.getByTestId("cx3d-chart-dot-salesforce-architect")).toBeInTheDocument();
    expect(screen.getByTestId("cx3d-chart-dot-data-cloud")).toBeInTheDocument();
    expect(screen.getByTestId("cx3d-chart-dot-admin")).toBeInTheDocument();
    expect(screen.getByTestId("cx3d-chart-you-ring")).toBeInTheDocument();
  });

  it("fires onSelect when a dot is clicked", () => {
    const sectors = navSectors();
    const road = buildRoad(sectors);
    const onSelect = vi.fn();
    render(
      <SkyChart
        sectors={sectors}
        road={road}
        focusSlug={null}
        frontierSlug={null}
        onSelect={onSelect}
      />,
    );
    fireEvent.click(screen.getByTestId("cx3d-chart-dot-admin"));
    expect(onSelect).toHaveBeenCalledWith("admin");
  });
});
