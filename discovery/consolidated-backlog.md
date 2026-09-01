# Consolidated Improvement Backlog — adroit-blog

**Date:** 2026-09-01 · **Tenant:** adroit-blog · **Prepared by:** Lois (BA)
**Inputs:** `lois-discovery.md` (content/IA/journey, 13 findings) · `kara-discovery.md` (visual/UX, 12 findings) · `brainiac-discovery.md` (technical/perf/SEO/analytics, 9 findings)
**Live:** `https://adroit-blog-two.vercel.app` · **Repo:** `~/Documents/Fortress-of-Solitude/adroit-blog`

---

## Executive summary

Three parallel discoveries (content/IA, visual/UX, technical) converge on the same picture: **the site is healthy and well-built, but it has trust-eroding inconsistencies, a broken flagship journey, and no measurement.**

- **Strong:** build clean (410 static pages, 0 warnings), 384/384 tests pass, 0 npm audit vulns, strong CSP, mature token system, brand applied consistently (slop score 0/10).
- **Broken:** the certify journey 404s for 6 of 7 series — the site's flagship promise ("tracked to completion", certificates) delivers a dead end for most of the catalog.
- **Confusing:** progress labels contradict themselves, course copy overpromises lesson counts, the hub advertises a Tracks section that never renders.
- **Unmeasurable:** zero web analytics anywhere.
- **Unlaunched:** every canonical/sitemap/OG URL targets `adroit.io`, which 404s these routes today — a launch gate, not a staging bug.

After de-duplication (4 cross-discovery overlaps merged), the backlog is **27 items**: **17 quick wins** (S effort, safe to ship in any order) and **10 feature/major items**, the capstone of which is the **Constellations + Chronicle** achievement feature, whose definition inputs are consolidated in a dedicated section below.

**Recommended sequence:** quick-win sprint → trust/truth fixes → data foundation (constellation migration + streak fix) → Constellations + Chronicle build → launch gate.

---

## De-duplication map (overlaps merged)

| Merged item | Sources |
|---|---|
| B-02 Canonical domain launch gate | Lois #9 + Brainiac #2 |
| B-08 Server-render /blog listing | Lois #10 + Brainiac #3 + Brainiac #9 (48 KB bundle rides on it) |
| B-03 Branded 404 page | Kara #2 + Lois #11 (journey context: 404s are a frequent destination right now) |
| B-04 Lesson-count overpromises + lint guard | Lois #3 + Kara #8 (card badge vs description) |

---

## Bucket 1 — Quick wins (S effort)

Obvious, safe, shippable now. Impact × effort ranked highest first.

| ID | Item | Theme | Impact | Effort | Source | Notes |
|---|---|---|---|---|---|---|
| B-01 | Fix series-hero progress-label contradiction ("Lesson 22 of 22" next to "0 of 22 complete") | Visual/UX | High | S | Kara #1 | Re-label content metric as "22 lessons · published"; let SeriesProgress own "N of M complete". One label + copy. |
| B-02 | Resolve canonical-domain mismatch at launch (adroit.io/blog must serve this app; /og-blog-card.png, /sitemap.xml, /robots.txt, /feed.xml must resolve) | Technical (launch gate) | High | S–M | Brainiac #2 + Lois #9 | No code change — code is already correct for the target domain. DNS/route config + verification checklist. Blocks all SEO value. |
| B-03 | Branded 404 page (navy/red display moment + 3 CTAs: Back to blog, Browse Learn, Contact) | Visual/UX | High | S | Kara #2 + Lois #11 | 404s are a frequent destination today (6/7 series cert pages, deep learn URLs). Learn CTA goes to the hub. |
| B-04 | Fix lesson-count overpromises in 4/7 series.json + in-lesson excerpt copy + add build-time lint guard comparing description counts vs lessons.length | Content | High | S | Lois #3 + Kara #8 | "90-lesson" vs 27, "46-requirement" vs 22, "30-lesson" vs 16, "~30-lesson" vs 6. Lint guard prevents recurrence. |
| B-05 | Make empty progress affordances visible ("Not read yet" pill, empty rings, lesson checkboxes, locked exam bar) | Visual/UX | High | S | Kara #3 | Visible track + readable label in both modes; filled state stays red accent. |
| B-06 | Wire web analytics (Vercel Analytics or Plausible) + CSP connect-src/script-src update | Analytics | High | S | Brainiac #1 | Site is currently unmeasurable. Include progress-funnel custom events (lesson → quiz tier → exam → certificate) — aligns with Constellations. |
| B-07 | Stop advertising certificates on exam-less series: certificate page renders "completion record" state instead of 404; hub taxonomy labels them "Learning Path" | Content/IA | High | S–M | Lois #1 (scope path) | The trust fix that unblocks the constellation surface on 6/7 series. Exam content stays a separate backlog (B-14). |
| B-08 | Server-render /blog listing (SSG first page + client filter island); bump 4/page → 8/page | Technical | High | M* | Brainiac #3 + Lois #10 + #9 | *M effort but listed here because it is a contained, safe refactor that also fixes LCP/CWV and drops the 48 KB posts.ts out of the client chunk. |
| B-09 | Guest /profile: locked-preview value demo with one real "Sign in or create account →" CTA to /login?next=/profile | Visual/UX | Med | S–M | Lois #8 | Turns a wall of 12 dead "Sign in" strings into the members value demo; doubles as the constellation "locked sky" teaser. |
| B-10 | Reconcile hub "Tracks" promise: if Hermes track is live, add course rows so the Tracks section renders; if not, drop "multi-level Tracks"/"Hermes Consultant Track" from hero + JSON-LD (or "coming soon" cards) | Content/IA | High | S | Lois #2 | 16-lesson 3-level track is invisible to guests while hero copy + JSON-LD promise it. **Blocked on open question Q1.** |
| B-11 | Newsletter: wire both forms to a real ESP (ConvertKit/Brevo/Supabase + API route + success states) or remove both blocks | Content/IA | Med | S/M | Lois #5 | Dead forms actively burn trust. **Blocked on open question Q3.** Remove = S; wire = M. |
| B-12 | Sitemap lastmod: use content-derived dates (post.date, lesson dates); omit for hub pages with no natural date | Technical | Med | S | Brainiac #6 | Kills per-deploy re-crawl churn. |
| B-13 | Per-post OG images (use post.bannerImage when present, else default card) | Technical | Med | S | Brainiac #7 | Lifts social CTR; pairs with analytics share events (B-06). |
| B-14 | Add /learn (and optionally /tags) to header nav | Technical | Med | S | Brainiac #8 | Learn has no header link — internal-linking and discoverability gap. |
| B-15 | Sitemap: emit only tags with ≥3 posts; consider "Browse all tags" disclosure on /tags | Technical | Low | S | Lois #7 (sitemap half) | 176 one-post thin tag pages currently dilute crawl budget. Tag vocabulary curation is the M-sized companion (B-22). |
| B-16 | Visual consistency micro-fixes: standardize avatar geometry (one shared token/component), group "Mark complete" label with its control, dim zero-count category pills, de-emphasize static "80% required" exam badges, neutral "not started" icon on certificate (X reads as failed), decide footer light/dark policy | Visual/UX | Low | S (bundle) | Kara #5, #6, #9, #10, #11, #12 | One small polish pass; each item is a token/class tweak. |
| B-17 | Lift dark-mode contrast on secondary metadata (post tag pills, date/read-time, share icon strokes) | Visual/UX | Med | S–M | Kara #7 | Audit small text/icons against --ink-muted/--ink-faint; lift anything below ~4.5:1. |

---

## Bucket 2 — Feature / major work

| ID | Item | Theme | Impact | Effort | Source | Notes |
|---|---|---|---|---|---|---|
| B-18 | **Constellations + Chronicle achievement feature** (visual layer on the data foundation below) | Constellations | High | L | Kara (immersion map) + Lois #12 + Brainiac #5 | See dedicated section below for the full feature-definition inputs. Elevation of the static stub at commit 780fe81, not reuse. |
| B-19 | Constellations data foundation: widen completion_events.event_type CHECK (quiz/exam/certificate + optional metadata jsonb), add write sites (quiz-run, exam-pass, certificate-eligibility), fix unused-`now` streak bug (live streak, 0 if last activity not today/yesterday), add rank derivation | Constellations | High | M | Brainiac #5 | Migration 010 + 3 write sites + streak fix + rank. Must land before B-18's streak/rank surfaces are trustworthy. |
| B-20 | Post → Learn "Keep learning" funnel: context-aware block at post bottom (category → recommended series + 1-line "why this fits"), plus lightweight related-posts row (same category, 3 cards) | Content/IA | High | M | Lois #4 | The Read → Learn funnel currently exists only in the header nav. Reuse hub series-card component. |
| B-21 | Client-side site search over posts.ts + learn.ts (header search icon → results overlay grouped by post/series/lesson) | Content/IA | Med | M | Lois #6 | Both datasets are static imports — no backend needed. 63 posts + 109 lessons are browse-only today. |
| B-22 | Tag vocabulary curation: cap ~40 tags, merge synonyms (content task) | Content | Med | M | Lois #7 (curation half) | Companion to B-15 (sitemap filter). |
| B-23 | Learn rendering + proxy split: SSG/ISR public (non-gated) lessons with client-side access gate; proxy skips auth.getUser() when no session cookie | Technical | Med | M | Brainiac #4 | Makes Learn content CDN-cacheable; removes a DB round-trip from every page load. Tradeoff-aware: gated lessons stay dynamic. |
| B-24 | Mobile filter toolbar rework: category pills → single scrollable chip row, read/sort into compact toolbar, tighten H1 | Visual/UX | Med | M | Kara #4 | 7 pills + 2 toggle groups stack into a wall above content at 390px. |
| B-25 | Exam content for the 6 non-omni series (exam.json + tier checks, series by series) | Content | High | L (per series) | Lois #1 (content path) | The quiz/check tooling exists — omni proves the shape. This is what makes the flagship promise real. **Blocked on open question Q2.** |
| B-26 | Constellation entry-point surfaces beyond the P1 set: track-page 3-star constellation (Level 1→2→3 lights per level) once Hermes track is live; optional blog reading mini-constellation | Constellations | Med | M | Lois #12 + Kara (P3) | Track surface is the only place "track" completion is visible. Blog mini-constellation is optional/P3. |
| B-27 | Hermes Consultant track launch (if Q1 = yes): live course rows + standalone value-prop copy for the three level pages | Content/IA | Med | M | Lois #2 + #13 | Only if the track is launching. Level pages currently lead with "Level N of the Hermes Consultant track" with no standalone value prop. |

---

## Constellations + Chronicle — feature definition inputs

Consolidated from all three discoveries. This section is the self-contained input for the feature spec and build.

### What the feature is

A branded achievement layer: each course is a **constellation** (connected stars, one per lesson, lit as completed), each track is a larger pattern, and a **Chronicle** (narrative completion log) plus streak/rank stats sit alongside. The design direction already exists as a static stub — commit `780fe81`, `design/t_cffa75b8/mockups/mockup-chronicle-constellation-seam.html` — which defines the token set (`--constellation-star` #4FC3F7, `--constellation-star-lit` red, `--constellation-line`, `--chronicle-streak`, `--chronicle-rank-ladder`). **The stub is a direction artifact to be elevated, not shipped** — the real implementation is a React component driven by `useProgressSummary`/`deriveProgress`.

### Where it surfaces (merged from Kara's immersion map + Lois's entry-point ranking + Brainiac's wow list)

| Priority | Surface | Route / component | What it shows |
|---|---|---|---|
| P1 | Lesson-complete moment | `/learn/[series]/[slug]` (LessonCompleteProgress, MarkComplete) | The wow moment: star "ignition" pop + brief constellation pulse + streak counter at the exact habit-loop beat |
| P1 | Series outline | `/learn/[series]` (SeriesSyllabus) | Full course constellation (lesson = star, lit as completed) + Chronicle of recent completions beside it |
| P1 | Learn hub | `/learn` (LearnHub) | Per-course constellation preview in card header (replaces/augments the flat gradient); keep light — the hub is a discovery surface |
| P2 | Profile | `/profile` (CertificateSection) | The full sky: aggregate constellations, streak, rank ladder, Chronicle feed. Guest version = "locked sky" teaser (pairs with B-09) |
| P2 | Certificate | `/learn/[series]/certificate` | Earned-certificate celebration: constellation completes + certificate reveal. **Blocked by B-07** until the page renders for exam-less series |
| P3 | Blog reading | `/blog` + post (BlogReadProgress) | Optional mini-constellation for the "N of M posts read" track |
| Later | Track pages | Hermes track (when live, B-27) | 3-star track constellation, Level 1→2→3 lights per level — the only surface where track completion is visible |

**Chronicle placement (all three agree):** the Chronicle lives on the profile, fed by the same completion events. No new IA surface needed.

### What data it needs

**Already available (no schema change for the visual layer):** `deriveProgress` (`src/lib/completion.ts`) yields `lessonsCompleted`, `coursesCompleted`, `tracksCompleted`, `streakDays`, `longestStreakDays`, `timeToCompleteDays` — sufficient for lesson/course/track constellations, streaks, and time-to-complete.

**Gaps to close first (B-19, migration 010 + 3 write sites):**
1. `completion_events.event_type` is `CHECK (lesson|course)` only — quiz/exam/certificate events are not in the log (quiz progress lives in `quiz_attempts`/`quiz_runs`, certificates are derived on-demand from exam runs, blog reads in `read_progress`). Widen the CHECK to include `quiz`/`exam`/`certificate` (+ optional `metadata jsonb` for tier/score).
2. `appendCompletionEvent` is called only from `/api/progress/lesson` — add write sites in the quiz-run and exam-pass handlers and the certificate-eligibility path.
3. **Streak bug:** `CompletionInput.now` is accepted but never used — "current streak" is the run ending at last activity, not live-as-of-today (a user idle 5 days still sees their old streak). Fix: compute relative to injected `now` (0 if last completion not today/yesterday); add a test with last-event < now. The lesson-complete streak counter (P1 surface) displays stale data until this lands.
4. **Rank:** `DerivedProgress` has no rank field (the "rank ladder" exists only in comments). Add a rank derivation (e.g. bands over coursesCompleted/lessonsCompleted) if the ladder ships.

### Design direction (from Kara)

- Surface type: Monitor (watching progress change) with a celebration moment on completion. Density + glanceability, not marketing.
- Motion: star ignition pop on completion (reuse the existing `check-pop` spring `cubic-bezier(0.34,1.56,0.64,1)`), subtle connecting-line draw, brief constellation pulse on course completion. Respect `prefers-reduced-motion` (global block already handles it).
- Tokens: keep the stub's additive token set — brand-safe.
- Do NOT reuse the stub's static HTML as the shipped component.

### Build sequence (recommended)

1. **B-07** (certificate page renders for exam-less series) — the P2 certificate surface must exist first.
2. **B-19** (data foundation) — streak fix + event types + write sites + rank.
3. **B-18 P1 surfaces** — lesson-complete moment, series outline, hub preview.
4. **B-18 P2 surfaces** — profile full sky (+ locked-sky guest teaser via B-09), certificate celebration.
5. **B-26** — track constellation (gated on B-27), optional blog mini-constellation.

---

## Recommended sequence (whole backlog)

| Phase | Items | Why this order |
|---|---|---|
| 1. Quick-win sprint | B-01, B-03, B-04, B-05, B-06, B-12, B-13, B-14, B-15, B-16, B-17 | All S, safe, independent. Fixes the "reads as a bug" trust issues and turns on measurement before anything else ships. |
| 2. Trust/truth fixes | B-07, B-10, B-11, B-09 | Journey and copy truthfulness. B-07 unblocks the constellation certificate surface. B-10/B-11 need Chris's answers (Q1, Q3). |
| 3. Funnel + navigation | B-20, B-21, B-22, B-24, B-23 | Read → Learn conversion and content discoverability. |
| 4. Constellations foundation | B-19 | Schema + write sites + streak fix + rank. Must precede the visual build. |
| 5. Constellations + Chronicle build | B-18 (P1 → P2), then B-26 | The capstone feature. |
| 6. Content backlog | B-25 (exams, series by series), B-27 (Hermes track if launching) | Content-heavy; proceeds in parallel at the team's cadence. |
| 7. Launch gate | B-02 | Adroit.io route wiring + asset verification. Done at promotion, not before. |
| Ride-along | B-08 (SSR /blog) | Contained refactor; slot into phase 3 or run in parallel — it also trims the client bundle. |

---

## Open questions for Chris (blockers for the marked items)

1. **Q1 — Hermes Consultant track:** is it launching? Decides B-10 (data fix vs copy fix) and whether B-27 is in scope.
2. **Q2 — Exams for the 6 non-omni series:** content backlog (B-25, series by series), or should exam-less series stop advertising certificates now (B-07 scope path, recommended)?
3. **Q3 — Newsletter:** is there an ESP account to wire, or should both dead forms come down? Decides B-11 (S remove vs M wire).

---

## Handoff note

To the architect (Brainiac — web lane): the `requirements`-equivalent source of truth for execution is this backlog. The item that shapes the constellation build is the **Constellations + Chronicle** section above — it is self-contained (surfaces, data, design direction, sequence). B-19 is the prerequisite migration task; B-18 is the feature build. Everything in Bucket 1 is independently shippable.

**Counts:** 27 items total · 17 quick wins (Bucket 1) · 10 feature/major (Bucket 2) · 3 open questions.
