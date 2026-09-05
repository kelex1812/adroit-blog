# Implementation Plan — Hubble Field (Phase 2 production port)

**Tenant:** adroit-blog · **Branch:** `feat/hubble-field` · **Date:** 2026-09-04
**Phase:** 2 — port the approved lab look into production
**Governing specs:** `docs/hubble-field-north-star.md`, `docs/requirements-hubble-field.md`, `docs/arch-hubble-field.md`, `design/hubble-field/direction-brief.md`
**Approved look source:** `src/components/Constellations/lab/chart-atlas.tsx` + `chart-2d.css` + `chart-sky.ts`, at `/lab/hubble-field` (study: **Star chart**)

---

## 0. Direction reset — read this first

**This plan was rewritten on 2026-09-04.** The previous version described
promoting GLSL point shaders, `deep-field-gl`, `dust-volume` and `WarpRig` into
production `3d/`. **That plan is void.** None of it should be executed.

Phase 1 built four WebGL studies on the theory that wow lives in the star
shader and the camera. On review they read as a pitch-black void — technically
faithful to Hubble, and unreadable as a progress surface. The study that won is
a **2D SVG celestial chart**: a navy plate of constellation figures, each course
carrying an engraved drawing of what it depicts, progress lighting the star
lines.

The chart is treated as the **new baseline, not the finished product.** It is
being ported because it is legible and shippable, and because a real surface in
front of real users is a better starting point for the next iteration than more
lab rounds. Expect a v2 that pushes closer to the intended end state.

**Consequence for the 3D stack:** the production r3f components
(`ProfileScene`, `SeriesScene`, `ConstellationGlyph`, `CameraRig`, `SkyRoad`,
`starfield-gl`, `nebula-gl`, `meteors`, `dust-motes`) stop being mounted. They
are **left in tree and unreferenced** for one release so the port can be rolled
back cheaply. Removing them, and dropping `three` / `@react-three/fiber` /
`@react-three/drei` / `@react-three/postprocessing` from the shipped bundle, is
a **separate follow-up commit** taken once the chart is confirmed in production.
Do not bundle the deletion into the port.

---

## 1. Goals

1. `/profile` "Your Sky" renders the **chart** as its hero.
2. `/learn/[series]` renders a **single-figure** chart as the course tracker.
3. A newcomer can answer "what am I looking at?" without help — the figure
   drawing, the plain-language labels, and the legend carry it.
4. Progress reads at a glance: lit lines for lessons done, a distinct final
   exam, a visibly *finished* constellation when the course is complete.
5. No WebGL anywhere on the path. The chart is SVG, so the old
   "3D + 2D fallback" split collapses into one surface.

**Out of scope:** inventing a new progress model, README What's New (ships with
the release cut), GitHub wiki sync, deleting the 3D stack (see §0).

---

## 2. What Phase 1 already landed (do not redo)

- Chart renderer: `lab/chart-atlas.tsx`, `lab/chart-2d.css`
- Backdrop maths, isolated and tested: `lab/chart-sky.ts`
- Engraved figure plates for the **full IAU 88**: `public/constellations/<slug>.png`
  (grayscale, 640px, ~170 KB each, ~15 MB total). Regenerate or extend with
  `node scripts/sync-constellation-plates.js`, which reports coverage against the
  canonical 88 and is idempotent.
- Luma-key ghost treatment, depth pockets, parallax bands, CSS motion, reduced-motion path
- Lab route gated on `NODE_ENV=development` or `ALLOW_HUBBLE_LAB=1`, noindex, robots `disallow: /lab/`
- Tests: `lab/lab.test.ts` (12), including the star-field correlation guard.
  Was 18 — six went out with the rejected WebGL studies they covered.
- Docs: north star, requirements, arch (+ HTML twins), design brief, supersession banners

---

## 3. Gaps between the lab and production

These are the real work. Each is a gap the lab papered over with fixtures.

### 3.1 Star roles — the achievement hierarchy has no data behind it

The chart's whole read depends on three kinds of node: lesson, knowledge check,
final exam. Production `ConstellationStar` (`src/shared/contracts-constellations.ts`)
carries only `lessonSlug`, `index`, `label`, `lit`. **There is no role.**
`lab/field-fixtures.ts` invents roles positionally — brightest star becomes the
exam, every *n*th becomes a check — which is fine for a lab and is not shippable
as a claim about someone's progress.

What is genuinely derivable today:

| Node | Derivable now? | From |
|---|---|---|
| Lesson | Yes | `ConstellationStar.lit` |
| Course finished | Yes | `ConstellationState.complete` |
| Exam **passed** | Yes, per series | `CompletionEventType = "exam"` in `completion_events` |
| Quiz **run** | Yes, per series | `CompletionEventType = "quiz"` |
| *Which star* is the exam / a check | **No** | nothing maps a quiz or exam to a position in the series |

**Staged recommendation:**

- **v1 (this port):** ship two roles, not three. Lessons are the star line; the
  exam is a distinct crowning node whose lit state comes from `complete` (or from
  an `exam` completion event where one exists). Drop knowledge-check diamonds
  rather than fake their positions.
- **v2:** widen `ConstellationState` with real anchors once the catalog exposes
  where quizzes sit in a series. That is a contract change and needs its own ADR.

Do **not** port `labFigure`'s role assignment into production.

### 3.2 Asterism coverage — production has 2 of 7

`3d/asterism-data.ts` contains **Orion** and **Cassiopeia** only.
`lab/field-fixtures.ts` has all seven. Promote **Lyra, Corvus, Delphinus,
Corona Borealis, Cygnus** into `asterism-data.ts` in the existing `Asterism`
shape (real RA/Dec, magnitude, spectral class — the lab drafts already use IAU
figures). `hasAsterism()` and `labAsterismFor()` already gate on presence, so
partial coverage degrades safely; full coverage is still the goal.

### 3.3 Layout does not scale past seven courses

`chartLayout()` is seven hardcoded `[cx, cy, scale]` slots. Production must
handle courses being added, removed, or hidden by access rules. Needs a
deterministic layout from course count — ring or phyllotaxis packing, seeded so
a given catalog always produces the same sky. Must stay stable when a course is
added (existing figures should not all jump).

### 3.4 Figure art needs a fallback and a home for its metadata

`FIGURE_ART` is a hardcoded map in the lab component, keyed by `seriesSlug`,
with hand-tuned `scale` / `dx` / `dy`. For production:

- Move it beside the asterism data, not inside the renderer.
- **A course with no plate must still render** — lines, labels and progress
  only. Never a broken `<image>`.
- Per-figure alignment is currently approximate; Cassiopeia's throne and Lyra's
  eagle in particular want tuning against their stars.

### 3.5 Data adapter

The chart consumes `LabFigure`. Production must feed it from `ProfileSky` /
`ConstellationState`. Write a **pure** `buildChartFigures()` alongside
`sky.ts` — no React, no DOM — so it is unit-testable the way `galaxy-model.ts`
is. The renderer should take chart-ready figures and nothing else.

### 3.6 Asset weight

The full 88 plates are ≈ 15 MB in tree, and a seven-course sky pulls ≈ 1.2 MB of
that. Acceptable for a lab, not for a hero above the fold. Before ship: serve
WebP with PNG fallback, load below-fold figures lazily, and confirm the art is
not blocking first paint of the star lines.

Only the plates a course actually maps to are ever requested, so page weight
tracks course count, not the 88. The 88 in tree is a repo-size question, not a
page-weight one — if it becomes a problem the answer is a CDN or LFS, not
deleting figures.

---

## 4. File-level port contract

### 4.1 New production modules

| File | Role |
|---|---|
| `Constellations/chart/StarChart.tsx` | The renderer, promoted from `lab/chart-atlas.tsx`. Presentational: takes figures + focus, emits selection. No data loading. |
| `Constellations/chart/chart-sky.ts` | Promoted as-is from the lab (already pure and tested). |
| `Constellations/chart/chart-figures.ts` | Layout (§3.3) + figure-art registry (§3.4). Pure. |
| `Constellations/chart/star-chart.css` | Promoted from `chart-2d.css`, prefixed to match production CSS conventions. |
| `src/lib/chart.ts` | `buildChartFigures(ProfileSky)` / single-course variant (§3.5). Pure. |

### 4.2 Changed production files

| File | Change |
|---|---|
| `FullSkySection.tsx` | Mount `StarChart` in place of `ProfileGalaxy3D`. Rank title, stats, JourneyRail and Chronicle stay **siblings**, never overlay. The separate 2D constellation dot grid is now redundant with the chart — decide whether it stays as a dense list or goes. |
| `ProfileGalaxy3D.tsx` | No longer mounted by `FullSkySection`. Leave the file (§0). |
| `SeriesConstellation3D.tsx` | Render the single-figure chart instead of the r3f scene / vertical-rail fallback. |
| `SeriesConstellation.tsx` | Was the no-WebGL fallback. With an SVG hero there is no WebGL to fall back from — retire or repoint at the chart. |
| `asterism-data.ts` | Add the five missing asterisms (§3.2). |
| `constellations-3d.css` | Drop rules for chrome-on-canvas that the chart does not use. Do not delete the file while the 3D modules remain in tree. |

### 4.3 Leave alone

- `contracts-constellations.ts` (except the v2 role work in §3.1, which needs its own ADR)
- `sky.ts`, `sky-server.ts`, `completion.ts` — the data layer is renderer-agnostic and already correct
- `discovery/`, B-18/B-19 data-architecture docs
- Chronicle, rank ladder, streak surfaces
- `ConstellationPreview` / `PathConstellation` (learn-hub cards) — out of scope this pass

---

## 5. Interaction contract

| Interaction | Behaviour |
|---|---|
| Click a figure | Focus it; dim the rest; **stay on `/profile`** |
| Click the focused figure again | Clear focus |
| CTA in the inspect panel | `router.push('/learn/...')` — the only egress |
| Keyboard | Figures are tab-stops; Enter/Space focuses; Esc clears |
| Pointer move | Parallax only — never changes state |

Clicking a course must not navigate. That was the Sky Roads complaint and it
still applies.

---

## 6. Accessibility and motion

The chart already ships most of this in the lab; it must survive the port.

- Every figure is a labelled control: `role="button"`, `tabIndex={0}`,
  `aria-label` naming the constellation, the course, and percent complete.
- The SVG root carries a meaningful `aria-label`; decorative backdrop layers are
  `aria-hidden`.
- `prefers-reduced-motion` disables parallax transitions, twinkle, breathing,
  rail sparks, exam pulse and meteors. Verify against the real hook
  (`usePrefersReducedMotion`), not only the media query.
- Colour is never the sole signal: completion is also carried by the closed
  ring, the "Course complete" label, and the exam node.
- Contrast-check the label and percentage text against the *lit* areas of the
  nebulae, not just the base plate.

---

## 7. Performance budget

- Each figure currently costs two filtered `<image>` passes (a blurred halo and
  a keyed core). At seven figures that is fourteen filtered rasters plus a
  Gaussian blur each. **Measure before assuming it is fine**, and cap the halo
  pass to focused and completed figures if it does not hold.
- ~420 animated background circles: keep twinkle off the far layer.
- Parallax must stay off React state (it writes CSS custom properties today —
  keep it that way).
- Target: no dropped frames on pointer move on a mid-range laptop; art not
  blocking first paint of lines and labels.

---

## 8. Verification

1. `npx tsc --noEmit` clean
2. `npm run lint` clean (one known pre-existing warning in `MDXArticle.tsx`)
3. `npx vitest run` — full suite green (76 files / 526 tests as of this branch)
4. New unit tests: `buildChartFigures` (progress → lit rails, complete → exam lit,
   course with no asterism, course with no art plate), layout stability when a
   course is added
5. Browser `/profile`: click focuses and does **not** navigate; CTA does; Esc clears
6. Browser `/learn/[series]`: single figure reflects real progress
7. Reduced motion: all animation stops, layout unchanged
8. Guest `/profile`: `LockedSkyTeaser` path untouched
9. CHANGELOG `[Unreleased]` What / Why / How / Verification for the port
10. README What's New **only on the release cut**

---

## 9. Suggested order

1. Promote `chart-sky.ts` and the renderer into `Constellations/chart/` unchanged; no wiring yet
2. Write `buildChartFigures()` + tests against real `ProfileSky` fixtures (§3.5)
3. Resolve star roles down to the v1 two-role model (§3.1)
4. Layout algorithm + art registry with fallback (§3.3, §3.4)
5. Wire `/profile` via `FullSkySection`; leave 3D in tree, unmounted
6. Wire `/learn/[series]`
7. Promote the five asterisms (§3.2)
8. Accessibility pass, perf measurement, asset optimisation
9. CHANGELOG; ship
10. **Follow-up commit:** delete unreferenced 3D modules and drop the four r3f
    packages, once the chart is confirmed in production

---

## 10. Open questions for Chris

1. **Knowledge checks.** Ship v1 with lessons + exam only (§3.1), or hold the
   port until quiz positions are modelled in the catalog?
2. **The 2D dot grid** below the profile hero — does it survive alongside the
   chart, or was it only ever a WebGL fallback?
3. **Learn-hub cards.** `ConstellationPreview` still draws a dot row. Leave for
   now, or bring into the chart language in the same pass?
4. ~~**Figure art for future courses.**~~ **Settled.** All 88 IAU plates are in
   tree, so a new course needs a *mapping* to a constellation, not a new
   illustration. Course launch picks a free figure; the lines-only fallback in
   §3.4 stays as the safety net for an unmapped course. What still needs a call
   is who owns the mapping and whether it lives in content or in code.
