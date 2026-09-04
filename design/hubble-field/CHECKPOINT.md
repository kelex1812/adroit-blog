# Checkpoint — Hubble Field lab review

**Status:** Phase 1 lab is ready for Chris. **No production `ProfileGalaxy3D` / `SeriesScene` rewrite until this is signed.**

**Direction pivot (2026-09-04):** primary look is now **Star chart** — a top-down / high-oblique navy + gold celestial atlas plate (Urania’s Mirror / Jamieson / modern navy-gold chart cues), not a pitch-black Hubble flythrough. Deep field / volume atlas remain as contrast studies.

## How to review

```
npm run dev
→ http://localhost:3000/lab/hubble-field
```

Start on **Star chart** (default):

| Study | What to judge |
|---|---|
| **Star chart** | Is this the product? Navy plate, gold figures, mythic overlays, click-to-focus |
| **Star material** | Point shader vs shipped sprites (still useful) |
| **Deep field** | Photographic flythrough — contrast only |
| **Volume atlas** | Old 3D orbit atlas — contrast only |
| **Warp** | Framed ↔ fullscreen interaction |

## Figure art (2026-09-04)

Each course constellation now carries an engraved drawing of what it depicts —
Orion the hunter, Cygnus the swan, Corona Borealis the crown, and so on. Assets
live in `public/constellations/*.png` as grayscale plates; the chart keys them
with an SVG `feColorMatrix` that takes alpha from luminance and replaces the
colour with a flat tint, so they render as apparitions rather than pasted
images. Cool blue = course in progress, warm gold = complete. Toggle them off
in the chart header to compare against bare lines.

## Depth & motion (2026-09-04)

Three parallax bands track the pointer at different rates — nebulae and the
deep star field barely move, the graticule sits between, the courses move most.
Behind that: a lit dome gradient, five drifting nebula clouds, ~420 deterministic
stars (seeded so SSR and client agree), a faint atlas graticule, and a vignette.
Ambient sky is also painted on the panel in CSS, because the SVG keeps a square
aspect and letterboxes on wide viewports.

Backdrop maths lives in `chart-sky.ts` so it can be tested. The star field uses
a mulberry32 stream, **not** `seededUnit(seed + key)` — FNV-1a maps a
one-character seed difference to a near-constant output difference, which once
collapsed the entire field onto the line y = x. `lab.test.ts` guards this with
a correlation check; range assertions alone did not catch it.

Motion is all CSS: stars twinkle on `fill-opacity` so per-star brightness
survives, apparitions breathe on a stagger, sparks run the completed rails
(`pathLength=100` normalises speed across segment lengths), finished exam stars
pulse, completion rings rotate, and two meteors cross on long cycles. The whole
set is disabled under `prefers-reduced-motion`.

## Pass / fail

- **Pass:** feels like a luminous fantasy star atlas you want to explore — still readable as *your* learning sky. Figures read as ghosts behind the stars; the constellation lines stay crisp on top of them.
- **Fail:** pitch-black void, cyan HUD, CAD stick figures with no mythic presence, or artwork so loud it buries the star lines.

## After approval

1. Follow `docs/implementation-plan-hubble-field.md` (update for chart-first if needed)
2. Port into production profile / series
3. CHANGELOG + README What’s New on ship only
