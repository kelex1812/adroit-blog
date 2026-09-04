# Implementation Plan — Hubble Field (Phase 2 production port)

**Tenant:** adroit-blog · **Branch:** `feat/hubble-field` · **Date:** 2026-09-04  
**Phase:** 2 — **blocked until Chris approves the lab look** at `/lab/hubble-field`  
**Governing specs:** `docs/hubble-field-north-star.md`, `docs/requirements-hubble-field.md`, `docs/arch-hubble-field.md`, `design/hubble-field/direction-brief.md`  
**Lab (approved look source):** `src/components/Constellations/lab/` + `src/app/lab/hubble-field/`

This is the file-level port contract. Do **not** start until the lab passes the north-star human gate. Do **not** rewrite Wave-1 discovery, `contracts-constellations.ts`, or the 2D / Chronicle floors.

---

## 1. Goals

Port the approved lab language into production `/profile` (and the on-course tracker) so the sky is the hero:

1. Hubble-style **point-shader stars** replace bokeh `IgnitedStar` sprites as the default field primitive.
2. Profile galaxy is a **framed observatory window**; warp-in → fullscreen; Esc / warp-out returns.
3. **Stay in the galaxy:** click = focus / inspect; CTA alone routes to `/learn/...`.
4. Rank illumination actually modulates the field; missing asterisms get real figures.
5. Sky Roads HUD chrome moves **off** the canvas (below/beside); thin telescope HUD only in observatory mode.

**Out of scope for this port:** README What’s New (cut with the release), GitHub wiki sync, inventing a new progress model, HTML mockup rounds.

---

## 2. Checkpoint (must be true before coding)

- [ ] Chris reviews `/lab/hubble-field` studies: **Star material**, **Deep field**, **Atlas**, **Warp**
- [ ] Frame still reads as a telescope image (not cyan HUD / bloom demo)
- [ ] Parameter presets worth shipping are recorded (field count, spike threshold, exposure, dust, illumination)
- [ ] Reduced-motion path accepted (static field + instant mode swap)

Until then: lab stays; production `ProfileGalaxy3D` / `SeriesScene` stay frozen.

---

## 3. Promote lab modules into `3d/`

| Lab source | Production destination | Notes |
|---|---|---|
| `lab/spike-material.glsl.ts` | `3d/spike-material.glsl.ts` (or merge into `star-material.glsl.ts`) | Hot core + magnitude-gated spikes; retire soft sprite path for field stars |
| `lab/deep-field-gl.tsx` | `3d/deep-field-gl.tsx` (+ thin wrappers used by Profile/Series) | Single `Points` buffer; shells + luminosity |
| `lab/deep-field-model.ts` | `3d/deep-field-model.ts` or fold into `galaxy-model.ts` / `starfield` builders | Pure attribute builders only |
| `lab/dust-volume.tsx` | `3d/dust-volume.tsx` | Replaces / demotes `nebula-gl` wash sphere |
| `lab/WarpRig.tsx` | `3d/WarpRig.tsx` | Modes: `framed` \| `observatory` \| warping; reduced motion snaps |
| `lab/field-fixtures.ts` asterism drafts | Expand `asterism-data.ts` | Author five missing courses from IAU figures (Lyra, Corvus, etc. as starting drafts) |

Keep `LabCanvas` / `FieldControls` / `/lab/hubble-field` as the tuning sandbox; do not delete until after ship.

---

## 4. File-level production changes

### 4.1 Profile framed window + warp

| File | Change |
|---|---|
| `FullSkySection.tsx` | Stop passing `SkyHeroChrome` as canvas `children`. Rank title, stats, JourneyRail, Chronicle = **siblings** of the framed galaxy, not overlay. |
| `ProfileGalaxy3D.tsx` | Own `GalaxyMode` (`framed` \| `observatory`). Wire WarpRig. **Never** `router.push` on first sector select. Invert Overview / warp-out so it exists when focused / in observatory. |
| `ProfileScene.tsx` | Swap field + figure stars to deep-field / spike material. Dim unfocused asterisms; focus fills frame. Strip glyph rings, progress donuts, world-space HTML pills. |
| `CameraRig.tsx` | Demote or replace for profile: WarpRig + OrbitControls in observatory only. Rest pose is in-sky, not looking down at a diagram. |
| `constellations-3d.css` | Framed window sizing; observatory fixed inset; thin telescope HUD; remove chrome-on-canvas rules that fight the sky. |

### 4.2 Navigation contract

| Interaction | Behavior |
|---|---|
| Click course / sector | Focus + camera approach; stay on `/profile` |
| Click lit / unlit star | Inspect lesson (name, progress); stay in sky |
| CTA in inspect panel | `router.push('/learn/...')` — only egress |
| Warp in | Fullscreen observatory + orbit |
| Esc / Warp out | Framed section; restore scroll |

### 4.3 Series / on-course tracker

| File | Change |
|---|---|
| `SeriesConstellation3D.tsx` / `SeriesScene.tsx` | Same star + dust language as profile. Click inspects; CTA routes (no instant eject). Optional later: small warp. |

### 4.4 Data / contracts

| File | Change |
|---|---|
| `asterism-data.ts` | Author OmniStudio, Hermes ×3, AI at Work figures |
| `galaxy-model.ts` / `sky.ts` | Apply `rankIllumination` to field uniforms (already computed) |
| `contracts-galaxy.ts` | Only if types change: update `Mirrors:` → `docs/arch-hubble-field.md` |
| `contracts-constellations.ts` | **Do not touch** |

### 4.5 Leave alone

- `discovery/`, B-18/B-19 constellation data architecture docs
- 2D constellation list, rank ladder, Chronicle (a11y + no-WebGL floor)
- Stock drei `<Stars>` (still forbidden)

---

## 5. Verification (Phase 2)

1. `npx tsc --noEmit` clean on touched files  
2. Vitest: galaxy model + any new warp/mode pure helpers; existing constellation tests still green  
3. Browser: `/profile` framed sky → warp in → orbit → Esc out; click sector does **not** leave page; CTA does  
4. Reduced motion: no warp tween; field static  
5. No-WebGL: 2D fallback still mounts  
6. CHANGELOG `[Unreleased]` What/Why/How/Verification for the production port  
7. README What’s New **only when the release ships**

---

## 6. Suggested implement order

1. Promote shaders + deep-field + dust behind a feature flag or parallel components; lab remains reference  
2. Wire ProfileScene field swap; strip overlay chrome  
3. WarpRig + mode on ProfileGalaxy3D; fix select/CTA  
4. SeriesScene parity  
5. Asterism coverage + rank illumination uniform  
6. Polish, tests, CHANGELOG; ship README What’s New with the cut  

---

## 7. Phase 1 already landed (do not redo)

- Docs: north star, requirements, arch (+ HTML twins), design brief, supersession banners  
- Lab route gated (`NODE_ENV=development` or `ALLOW_HUBBLE_LAB=1`), noindex, robots `/lab/`  
- Studies: star compare, deep field, atlas, warp  
- Unit tests: `src/components/Constellations/lab/lab.test.ts`
