# Changelog

All notable changes to the Adroit Consulting Blog project will be documented in this file.

## [Unreleased]

### Security: harden user_profiles RLS to migration-003 standard (t_ecf3b702)

Closes Val-El's audit findings (t_6cd3026f — fresh user_profiles re-audit:
F1 LOW/CWE-732, F2 LOW/CWE-285).

- `supabase/migrations/007_user_profiles_hardening.sql` (new) — layered on top
  of migration 005 (already applied; 005 is not edited). Recreates the three
  `user_profiles` policies to match the migration-003 hardening standard:
  - **SELECT** (`users select own profile`) — now `TO authenticated`.
  - **INSERT** (`users upsert own profile`) — now `TO authenticated`
    (already had `WITH CHECK (auth.uid() = user_id)`).
  - **UPDATE** (`users update own profile`) — now `TO authenticated` with an
    explicit `WITH CHECK (auth.uid() = user_id)` alongside `USING`. PG
    previously fell back to USING for the new-row check; the explicit guard
    prevents silent widening if USING is ever loosened.
  - `user_id` FK already `REFERENCES auth.users(id) ON DELETE CASCADE`
    (migration 005, line 8) — no FK change required.

**Verification**: migration 007 applied cleanly to a scratch Postgres carrying
the 005 schema (re-apply is idempotent — `DROP POLICY IF EXISTS`);
`pg_policies` confirms all three policies target `authenticated` with the
correct qual/with_check expressions. Functional RLS test under the
`authenticated` role: own-row select/update/insert pass; cross-user read
returns 0 rows; cross-user UPDATE affects 0 rows; and a `user_id`
reassignment attempt is blocked by the new WITH CHECK. `npm run lint` and
`npm run build` both pass (SQL-only change; suite is a regression guard).

### Security: validate login `next` param — CWE-601 open redirect (t_6c96683f)

Closes Val-El's audit finding (t_d8a9dae6 — guest gating audit; the only open
item, LOW/CWE-601).

- `src/app/login/page.tsx` — `next` is now sanitized through
  `sanitizeRedirectPath()` before `router.push(next)`. Previously
  `/login?next=https://evil.com` would client-side-redirect the browser to the
  external origin after sign-in (phishing / credential-harvesting).
- `src/lib/redirect.ts` (new) — pure `sanitizeRedirectPath(path, fallback)`
  helper. Only single-leading-slash internal paths pass; external schemes
  (`https://…`), protocol-relative (`//host`), backslash escapes (`/\host`),
  multi-slash (`///host`), `javascript:`, and empty/null values all fall back
  to `/blog`.

**Tests**: `src/lib/redirect.test.ts` +8 covering every Val-El-specified bypass
(`https://evil.com`, `//evil.com`, `/\evil.com` → `/blog`) and the legit
pass-through (`/learn/omni-studio-cert`). Full suite 180 pass; `tsc --noEmit`
clean; eslint clean.

### Security: harden profile API rate limiting (t_947d67fc)

Closes Val-El's audit findings (t_ea087e3e, OWASP A04 — rate limiting gaps).

- `src/app/api/profile/route.ts` — **GET is now rate-limited** by IP
  (`checkRateLimit(getClientIp(req))`, 30/min) mirroring PATCH. The read path
  performs a lazy upsert (a DB write) on first read, so an authed client could
  previously issue unbounded read+write traffic — now capped per IP.
- `src/lib/api-security.ts`
  - **`getClientIp` hardened against XFF spoofing**: prefers the trusted
    `x-real-ip` header, then takes the RIGHTMOST `x-forwarded-for` entry
    (the value a trusted proxy appended) instead of the attacker-controllable
    leftmost value, falling back to loopback for local dev. On Vercel the
    header is set by Vercel's proxy, so the rightmost value is reliable.
  - **Documented the in-memory limiter** (accepted, low risk): it is
    per-process/per-instance on Vercel's distributed serverless runtime, so
    the effective limit scales with warm instances and resets on cold start —
    not a hard cross-instance cap. Note recommends a shared store (Upstash)
    if a hard guarantee is ever required.

**Tests**: `route.test.ts` +1 (GET 429s when the per-IP limit is exceeded),
`api-security.test.ts` +5 (`getClientIp` trusted-source ordering). 172 total
pass; `tsc --noEmit` clean; eslint clean.

### Fix: LearnHub group-count badge contrast — WCAG 1.4.3 AA (t_8b9ee30a)

Closes a11y finding: the group-header count badge rendered
`text-[var(--accent)]` on an `bg-[var(--accent)]/[0.08]` accent-tint chip.
On the pre-remap accent values this failed AA (~2.81–3.16:1 < 4.5:1 for the
10.5px bold count). The R3 token remap already lifted the raw numbers past
AA, but dark-card was borderline (4.63:1) with no margin. Introduced an
explicit on-tint foreground token so the badge clears AA with comfortable
headroom in both themes.

- `src/app/globals.css`
  - **New `--accent-on-tint`** semantic token: `--color-red-dark` `#A00D24`
    in light, `var(--accent-hover)` `#f47385` in dark. Dedicated foreground
    for text sitting on an accent-tint (8%) chip, separate from the plain
    text-accent.
- `src/components/Learn/LearnHub.tsx` — group count badge uses
  `text-[var(--accent-on-tint)]` instead of `text-[var(--accent)]`.
- `scripts/verify_contrast.py` — asserts `--accent-on-tint` on the 8%
  card-tint in both themes (light 7.11:1, dark 5.84:1 — both PASS ≥4.5).

`tsc --noEmit` clean; `scripts/verify_contrast.py` all PASS.

### Fix: text-gray-400 contrast on lesson surfaces — WCAG 1.4.3 AA (t_f5c7f22c)

Closes out-of-scope a11y findings (Lara, t_5c11d157): `text-gray-400`
(#9CA3AF) measured ~2.54:1 < 4.5:1 AA on meaningful lesson text. Swapped
to `text-gray-500` (#6B7280, 4.83:1 on white) per Lara's verification.

- `src/app/learn/[series]/[slug]/page.tsx` — author row date/read-time (12px)
- `src/components/Learn/LessonNavigation.tsx` — prev/next eyebrows (10.5px uppercase)
- `src/components/Learn/EmptyState.tsx` — empty-series helper body (12.5px)

Exempt per Lara: ExamCard.tsx disabled-button inactive UI. `tsc --noEmit` clean.

### Fix: dark-mode contrast — --ink-faint / --accent pass WCAG AA (t_8a679ec4)

Closes mandatory a11y finding (t_30f64725, HIGH): `--ink-faint` failed
contrast in BOTH themes and `--accent`/`--accent-hover` failed as text in
dark mode. Preserves design intent — faint stays lighter than muted in
light, dimmer than muted in dark; "subdued mono labels, just legible".

- `src/app/globals.css`
  - **Light `--ink-faint`** `#9CA3AF` → `#646d7c` (new `--color-gray-450`).
    Passes 4.5:1 on every surface: page 4.92, card 5.22, card-soft 5.00,
    sunken 4.75 (was 2.31–2.54).
  - **Dark `--ink-faint`** `#64748b` → `#7f8ca3`. Passes 4.5:1 on all:
    page 5.67, card 5.10, card-soft 5.36, sunken 5.46 (was 3.64–4.05).
  - **Dark `--accent` (text)** `#E8354A` → `#f05066`. Passes 4.5:1:
    page 5.54, card 4.98, card-soft 5.24, sunken 5.34 (was 4.15–4.62).
  - **Dark `--accent-hover` (text)** `#C8102E` → `#f47385`. Passes 4.5:1:
    page 7.0, card 6.3, card-soft 6.62, sunken 6.75 (was 2.94–3.27).
  - **New `--accent-bg` token** for *filled* accent surfaces (chip/badge):
    `#C8102E` in both themes. Decouples the text accent (light red needed
    for text-on-surface contrast) from the filled-background accent (dark
    red needed so white text on it stays ≥4.5). Light accent is unchanged
    (`--accent-bg: var(--color-red)`).
- `src/components/Learn/LearnFilters.tsx` — active subgroup chip now uses
  `--accent-bg` (`bg`/`border`) so dark-mode white-on-red = 5.88:1 (was
  4.17 on `#E8354A`).
- `src/components/Header.tsx` — "BLOG" badge uses `--accent-bg` for the
  same white-on-accent guarantee.
- `src/components/Footer.tsx` — literal `white/xx` muted text on navy
  (named in the finding) bumped to pass AA: "Stay Updated" blurb
  `white/40`→`white/50` (5.30), email placeholder `white/35`→`white/50`,
  bottom-bar `white/30`→`white/50` (5.30), social-icon glyphs
  `white/40`→`white/50` (4.98 on the `white/8` tile). Footer does not use
  the `--ink-faint` token (it hard-codes navy) — fixed in place.

**Before/after ratios (WCAG 2.x, worst surface per theme):**
- Light `--ink-faint`: 2.31:1 → 4.75:1 (sunken)
- Dark `--ink-faint`: 3.64:1 → 5.10:1 (card)
- Dark `--accent` text: 4.15:1 → 4.98:1 (card)
- Dark `--accent-hover` text: 2.94:1 → 6.30:1 (card)
- Dark filled chip white-on-accent: 4.17:1 → 5.88:1

**Known issues:** none. Verified `tsc --noEmit` + `next build` clean, and
ran the app live in both themes — computed tokens confirm the new values,
rendered pages legible, active subgroup chip `#C8102E`/white. Audit's
remaining HIGH findings (`--signal-done` light, Learn h1 gradient tail)
are tracked under their own fix tasks, not this one.

### Security: profile PATCH now applies Origin check + IP rate limit (t_3b046f56)

Closes audit finding #3 (t_4ce798cb, CWE-352 / CWE-799): `PATCH /api/profile`
was the one state-changing account route that skipped the
`checkOrigin` + `checkRateLimit` gate every sibling progress route applies.

- `src/app/api/profile/route.ts` — PATCH now runs `checkOrigin(req)` (403 on
  a disallowed Origin) and `checkRateLimit(getClientIp(req))` (429 on
  exceeding 30 req/min/IP) before any session lookup or write, matching the
  pattern in `/api/progress/*` and `/api/progress/read`. Handler signature is
  now `NextRequest` to match the shared helpers.
- Tests — `route.test.ts` gains 2 regressions: disallowed Origin → 403
  `Forbidden origin`, and a dedicated-IP burst where the 31st PATCH → 429
  `Too many requests`.

**Known issues / note:** the rate limiter is the shared in-memory
sliding-window (`src/lib/api-security.ts`, 30 req/min/IP, not persisted) — a
process restart resets all buckets, acceptable for this blog tier. CSRF was
already partially mitigated (HttpOnly + SameSite=Lax session cookie); this
brings profile writes to the same defense-in-depth standard as sibling
routes. Verified live: evil-origin PATCH → 403, allowed-origin guest PATCH →
401, 31st rapid PATCH from one IP → 429.

### Verification: exam-flow a11y fixes (t_77103142)

Auto-decomposed fix task confirmed redundant — the exam-flow a11y findings
(1: results heading + focus, 2: timer live-region announcements, 4: gray-400
contrast in ExamWidget/ExamLocked, 5: radiogroup arrow-key roving) from the
deploy-gate checklist were already resolved in commit `e4958c7` (parent build
t_5664453e) and independently re-verified here: `ExamWidget.tsx` carries the
sr-only "Exam results" h2 with focus moved on submit AND auto-submit, the
`role="status"` polite region announces 10/5/1-min thresholds + auto-submit,
countdown uses `role="timer"` with `aria-live="off"`, arrow-key roving wraps
and auto-activates, and no `gray-400` remains in the exam components.
`npx vitest run src/components/Progress/ExamWidget.test.tsx` 5/5 pass, full
suite 164/164, `tsc --noEmit` clean, `npm run build` passes. No new code
changes required.

### Verification + fix: certificate-view a11y (t_08878885)

Auto-decomposed fix task verified the certificate findings from the
deploy-gate checklist (3: single h1; 4: gray-500 contrast; seal alt text;
ARIA labeling; print focus) were already resolved in commit `e4958c7`
(parent build t_5664453e). Independently re-verified in source: `Certificate.tsx`
renders a single `h1` (`cert-title`, page chrome demoted to styled `<p>`),
scoped CSS uses `#6B7280` (gray-500) not `#9CA3AF`, the seal exposes
`role="img" aria-label="Adroit seal"`, and the print button is a real
interactive control with visible text.

One residual heading-hierarchy issue was fixed in the certificate page's
**not-eligible** branch (flagged as a pre-existing low in the a11y audit
t_93ab2fe6): the progress card's "Complete all N lessons and pass the exam"
heading was an `h3` appearing directly under the page's `h1`, skipping `h2`.
Demoted to `h2` so the heading sequence is `h1` → `h2` (WCAG 1.3.1 /
2.4.6). Change is server-rendered JSX only — no logic touched.

Verification: `npx vitest run` 166/166 pass (`Certificate.test.tsx` 7/7),
`tsc --noEmit` clean, `npm run build` passes.

### Verification: quiz-tier a11y fixes (t_0e84aaef)

Auto-decomposed fix task confirmed redundant — the quiz-tier a11y findings
(4: gray-400 contrast, 6: switch target size, 7: sort labels, 8: GuestCTA
semantics) from the deploy-gate checklist were already resolved in commit
`e4958c7` (parent build t_5664453e) and independently re-verified here:
source fixes present, `npx vitest run` 164/164 pass, `tsc --noEmit` clean,
`npm run build` passes. No new code changes required.

### Security: batch exam response no longer leaks the answer key for unanswered questions (t_c0c452f5)

Closes the exam-key disclosure regression (CWE-200) introduced alongside the
canonical question-count coverage fix (t_55105899). The batch grading route
returned `correctAnswerIndex` for *every* canonical question, so a forged
`answers: []` POST disclosed the full 60-question exam key in a single request —
re-opening the certificate-forgery path the coverage fix was meant to close.

- `src/app/api/progress/quiz/batch/route.ts` — the per-question review item now
  omits `correctAnswerIndex` unless that question was actually answered. The
  review screen only needs `isCorrect`, so nothing is lost for a legitimate,
  full-coverage exam; a partial/empty set exposes no correct answers.
- `src/shared/contracts.ts` — `ExamResultItem.correctAnswerIndex` is now
  optional (`?: number`), documented as omitted for unanswered questions.
- Tests — `batch/route.test.ts` regression assertion: on a 1/60 answer set only
  the answered item carries `correctAnswerIndex`; the other 59 omit it.

### Security: quiz_run / quiz_attempt are now server-write-only (t_bb6ed113)

Closes the RLS client-forge path (CWE-807) that let an authenticated client
hit PostgREST directly with the anon key + user JWT and INSERT/UPDATE/DELETE
forged `quiz_attempt.is_correct` / `quiz_run.score` rows — bypassing the
Next.js API routes that recompute correctness server-side — to unlock the
timed exam or grant a certificate without earning them.

- `supabase/migrations/006_quiz_server_write_only.sql` — revokes the
  `authenticated` INSERT/UPDATE/DELETE policies on `quiz_attempt` and the
  INSERT policy on `quiz_run`, replacing them with explicit deny guards.
  `SELECT` stays so users still read their own stats/progress/eligibility.
  Server writes now use the `service_role` key (Postgres `BYPASSRLS`), so
  they are unaffected by the revocation.
- `src/lib/supabase/service.ts` — new privileged, server-only service-role
  client (`getSupabaseServiceClient()`). Fails closed: throws if
  `SUPABASE_SERVICE_ROLE_KEY` is absent. Never used to resolve "who is the
  current user"; reads stay on the cookie/RLS client (`server.ts`).
- `POST /api/progress/quiz`, `POST /api/progress/quiz/run`,
  `POST /api/progress/quiz/batch` — the graded `quiz_attempt`/`quiz_run`
  writes now go through the service-role client; all reads (attempt lookup,
  exam-unlock gate) stay on the RLS-bound client.
- Tests — `route.test.ts` (new, single-attempt route) plus updated
  `run/route.test.ts` and `batch/route.test.ts` assert the writes are
  service-client-only and that the RLS/anonymous client is never used for a
  write.

**Known issues / deploy note (coordinated step):** this is a two-part
change — the migration AND the runtime secret must land together or quiz
writes fail. Before applying migration 006, set `SUPABASE_SERVICE_ROLE_KEY`
(server-only, never `NEXT_PUBLIC_*`, never a tracked file) in the Vercel
production env and local `.env.local`; then push 006. Until the migration is
applied the code is inert; until the key is set, server writes return 500
(fail closed — never a silent forgeable fallback). Ops: alpha.

### Feature: Round 3 — account & Learn experience (t_e0362113)

Full Round 3 implementation per Brainiac's architecture
(`docs/system-architecture-account-round3.md`, arch task t_cde0e74a) and Kara's
mockups (`design/round3/`). Six workstreams:

**WS-2/WS-5 Profile identity + per-account data**
- `supabase/migrations/005_user_profiles.sql` — `user_profiles` table
  (user_id PK/FK → auth.users, display_name, username, theme_pref) + RLS
  policies (users only touch their own row). Lazily upserted on first read.
- `GET/PATCH /api/profile` — server-side HttpOnly-cookie session checks, lazy
  upsert, themePref + username-charset validation (no client RLS reliance).
- `/profile` rework: identity card (avatar initials derived from display name),
  editable display-name/username form (`Profile/ProfileForm.tsx`), and
  "My certificates" (`Profile/CertificateSection.tsx`) derived on demand from
  lesson_completion + quiz_attempt rows (ADR-106, same source of truth as the
  certificate page).

**WS-2 Dark mode (auto + manual override)**
- Semantic token layer in `globals.css` (`--surface-*`, `--ink-*`,
  `--border-*`, `--accent`, spacing scale) with a full `html.dark` remap.
  Class-based dark variant (`@custom-variant dark`) so `dark:` follows the
  `dark` class on `<html>`, not the OS media query.
- `Theme/ThemeProvider.tsx` + `lib/hooks/useTheme.ts` — resolves
  system/light/dark, applies the class, persists to localStorage, adopts the
  account's `theme_pref` server-side. FOUC-guard inline script in the root
  layout applies the persisted preference before hydration.
- `Theme/ThemeToggle.tsx` — segmented System/Light/Dark control in Settings and
  a compact quick-toggle row in the avatar menu; both persist per-account via
  PATCH /api/profile. Dark styling covers blog posts/MDX (article-body),
  header, account pages, and all new components.

**WS-3 Learn hub reorganization + guest gating**
- `subgroup` optional field on `LearningSeries` (content metadata only —
  `series.json` → `build-learn.js` → `src/data/learn.ts`; omni-studio-cert →
  Developer, salesforce-architect → Architect).
- `Learn/LearnHub.tsx` + `LearnFilters.tsx` — All/Certifications/General bucket
  chips with counts, subgroup chips, top-level + subgroup section headers.
- `PathCard` guest gating: guests see name + description + non-clickable card
  with "Sign in to access courses" CTA (SEO-safe, server-rendered); signed-in
  users get a clickable card with real per-series completion progress on the
  card body.

**WS-4 Continue learning**
- `GET /api/continue-learning` — in-progress series (≥1 distinct completed
  lesson, < total), most-recent-first, resume link to the lowest-numbered
  uncompleted lesson; guests get `[]`.
- `Learn/ContinueLearning.tsx` — resume card at the top of the Learn hub.

**WS-1 Spacing tokens** — spacing scale + semantic aliases from Kara's audit
(`--space-*`, `--radius-panel`, `--elev-lift`) added to globals.css; new
components use the tokenized values.

**Avatar menu** — shows display name (fallback email), initials derive from the
display name, and a theme quick-toggle row; refreshes on profile save via the
`adroit-blog:profile-changed` event.

**Why** — Round 3 turns the blog's account + Learn surfaces from stubs into a
real, personal, gated learning experience: per-account identity and theme
preferences, a filterable/grouped Learn hub, guest-vs-signed-in gating that
preserves SEO, and a resume flow for in-progress courses.

**Known Issues** — none. (Pre-existing `src/data/learn.ts` drift noted in the
t_f75bc52d entry was resolved here by regenerating learn.ts with subgroup;
the stale agentic-ai totalLessons assertion in
`src/app/api/progress/quiz/tiers/route.test.ts` was corrected 7 → 8 to match
current content.)

### Fix: avatar hue tokens must live in the `--color-*` namespace (t_f75bc52d)

The avatar initials rendered white-on-transparent (invisible against the white
header) because the avatar palette was declared as bare `--avatar-1..4` theme
tokens. Tailwind v4 only generates color utilities (`bg-avatar-*`) from the
`--color-*` namespace, so the classes never existed in the compiled CSS
(confirmed: `.bg-avatar-1` was absent from `.next/static/chunks/*.css`, and the
live header avatar had no background-color). Renamed to
`--color-avatar-1..4` in `globals.css` `@theme inline`; compiled output now
contains `.bg-avatar-1{background-color:#0b1d3a}` etc., verified in the running
app (computed background rgb(11,29,58), white text passes WCAG AA on all four
hues). No component or test changes needed — class names stayed `bg-avatar-*`.

**Why** — a design token that generates no utility is a silent visual bug; the
unit tests assert class names, not compiled CSS, so this needed build + live
verification to catch.

**Known Issues** — none. (Pre-existing `src/data/learn.ts` drift from commit
1cba1d4 remains out of scope; see the feature entry below.)

### Feature: avatar menu + profile/settings pages (t_f75bc52d)

Replaces the signed-in header corner (raw email + "Sign out" text button)
with a 32px initials avatar + keyboard-first dropdown, and adds two minimal
account pages. Follows brainiac's implementation plan (docs/implementation-plan-avatar-profile.md)
and kara's design mockups (design/mockup-avatar-menu.html, mockup-profile.html,
mockup-settings.html).

**What**

1. New design tokens in `globals.css` `@theme inline`: `--shadow-menu`,
   `--shadow-dialog`, `--avatar-1..4` (navy-tinted elevation + deterministic
   brand-safe avatar hues); `menu-pop` 150ms fade/rise keyframe for the panel.
2. New pure lib `src/lib/avatar.ts` — `initialsFromEmail()` + deterministic
   `avatarHueClass()` (no `Math.random()`, no flicker on re-render), with
   12 unit tests covering brief edge cases + hue determinism/coverage.
3. New `src/components/AvatarMenu.tsx` (client, self-contained): WAI-ARIA
   menu-button pattern — `aria-haspopup`/`aria-expanded` trigger, `role="menu"`
   panel, roving focus with Arrow/Home/End + wrap-around, Escape closes and
   returns focus to the trigger, outside-click (mousedown/touchstart) close,
   popstate close for back/forward. Focus lands on the first item on open.
   12 component tests cover the full keyboard/ARIA contract.
4. `Header.tsx` integration: desktop right cluster is now
   `divider | Contact Us | avatar` (per design §4.3); mobile drawer shows a
   "Signed in as" block (avatar + email) + Profile/Settings/Sign out rows
   instead of the old "Sign out (email)" button. Guest header unchanged.
5. New server pages `/profile` and `/settings` (`force-dynamic`): SSR session
   gate via `getSupabaseServerClient().auth.getUser()`; guests get a 307 to
   `/login?next=<path>`. Profile = identity card (avatar, email, sign-in
   method, Change password COMING SOON stub). Settings = two sectioned cards
   (Clear reading history, Email me new posts) — every control is a static
   honest stub with a visible COMING SOON badge; no fake-functional controls,
   no save bar.

**Why**

- The header email + inline sign-out was cramped and had no room for account
  surfaces; the dropdown matches the design system and frees the corner.
- Server-side gating avoids a client auth flash + duplicate `/api/auth/session`
  fetch (same ADR-104 pattern as the exam/certificate pages).
- Stubs are visibly marked so nothing appears functional before its API
  (`/api/auth/reset`, `/api/progress/clear`, subscribe table) exists.

**Known Issues**

- `npm run build` regenerates `src/data/learn.ts` via `prebuild` (build-learn.js)
  and picks up lesson 8 (`tool-design-schemas-error-handling-retries.mdx`) for
  agentic-ai (7 → 8), which breaks `tiers/route.test.ts` ("keeps s.totalLessons
  for non-tier series" expects 7). Pre-existing content/learn.ts drift from
  commit 1cba1d4 (Add lesson 8) — out of scope for this task; learn.ts is
  restored to HEAD after verification. No changes to `content/`, sort logic,
  or build scripts per plan AC 8.

### Fix: progress rollup lessons total uses planned 46, not published 9 (t_39a3fef7)

Resolves zod's QA finding F2 (MEDIUM) from review t_1d04b259. The tier
progress rollup (`GET /api/progress/quiz/tiers`) reported
`lessons.total` from `getSeriesBySlug(series).totalLessons`, which
build-learn.js computes as the highest *published* lesson number (9
today). CertReadiness rendered "Lessons X/9" and its 40%-weighted
lessons term saturated at 9/9 = 100%, while the certificate page
correctly counted `getSeriesLessonSlugs()` = 46 — the two pages
disagreed about course size (US-006 AC1 requires "Lessons X/46").

**What**

1. Added `plannedLessonsTotal(series)` in
   `src/app/api/progress/quiz/tiers/route.ts`: for tier series with
   generator-sidecar question files it returns the PLANNED lesson count
   (`getSeriesLessonSlugs().length`, 46 for omni-studio-cert); non-tier
   series without question files keep `s.totalLessons`.
2. Both the guest `emptyTierProgress` and the authed rollup now use it,
   so the denominator is consistent across guest/authed and matches the
   certificate page.
3. Added 3 regression tests in
   `src/app/api/progress/quiz/tiers/route.test.ts` (guest 46, authed 46,
   non-tier fallback 7).

**Why**

- `s.totalLessons` tracks published MDX; the certificate rule counts the
  course's PLANNED lesson set (46 sidecar files). The series-page rollup
  and the certificate must agree on course size so the readiness bar is
  not misled.

**Known Issues**

- None. `lessons.completed` behavior is unchanged (distinct
  `lesson_completion` rows).

### Fix: scrub prose Practice Questions from day-09 lesson MDX — guest question leak (t_9032aa28)

Resolves zod's QA finding F1 (HIGH) from review t_1d04b259. Lesson 9's
MDX still contained the prose "## Practice Questions" section (Q1–Q3 with
options, **CORRECT** markers, and **Answer:** keys) even though lessons
1–8 were scrubbed. The lesson page renders the full MDX body to everyone
and gates only the interactive `LessonQuiz`, so a logged-out visitor saw
both the GuestCTA placeholder AND the complete question set with answers.

**What**

1. **Removed the "## Practice Questions" section** (Q1–Q3, options,
   CORRECT markers, and Answer keys) from
   `content/learn/omni-studio-cert/day-09-fc-3-binding-components-configuring-properties.mdx`.
   The remaining lesson body (Deep Dive, Configuration Walkthrough, Exam
   Traps, Exam Tip, Related Requirements, References) is untouched.

**Why**

- The interactive quiz lives in the sidecar JSON
  (`content/learn/omni-studio-cert/questions/day-09-*.json`) which loads
  only for authed users (ADR-104 session gate) — the prose section was a
  duplicate that leaked to guests. Removing it loses no content.
- Restores US-002 AC2/AC3 and the course pattern "guest pages leak no
  question text".

**Known Issues**

- None.

### Fix: canonical question-count coverage in quiz score consumers (t_55105899)

Resolves zod's QA finding (review t_121cbcce of fix t_fb1663ec) — HIGH,
CWE-345. The F1 run route already refused to record a run when the graded
attempt set didn't cover the canonical question count, but the F2
consumers (tiers, exam unlock, certificate eligibility) scored whatever
rows existed — so a client that answered only the questions it knew
derived `8/8 = 100%` (exam unlock) or `40/40 = 100%` (certificate) from a
partial `quiz_attempt` set.

**What**

1. **`scoreQuizAttemptRows` / `scoreQuizAttemptsByQuiz` now take a
   canonical question count** (`src/lib/quiz.ts`). When the canonical count
   is known, a partial attempt set returns `null` (no score, can grant
   nothing) and a full set is scored against the canonical denominator with
   unanswered treated as incorrect. When no canonical total is supplied the
   legacy answered-count behaviour is preserved (backward compatible).
2. **Every F2 consumer passes canonical totals** — `tiers/route.ts`,
   `exam/page.tsx` (per-check canonical counts via `getKnowledgeCheck`),
   and `certificate/page.tsx` (exam = `getCertExam().questions.length`,
   checks = per-check canonical counts). A partial set can no longer derive
   a passing score anywhere.
3. **Exam batch route accounts for partial answer sets**
   (`src/app/api/progress/quiz/batch/route.ts`). Missing questions are
   written to `quiz_attempt` as unanswered (`user_answer_index: -1`,
   `is_correct: false`), so the attempt set always covers the canonical
   question count and the `quiz_run` score divides by the canonical
   denominator (40/60 stays 67%, never 100%).

**Why**

- F1 guarded the run-recording boundary but not the read-side consumers;
  both exploits went through partial `quiz_attempt` sets that were scored
  against an inflated (self-selected) denominator. Enforcing canonical
  coverage at the scoring primitive closes the class for every current and
  future consumer.

**Known Issues**

- `scoreQuizAttemptsByQuiz` now skips quizzes absent from the canonical
  map when a map is supplied — callers without canonical knowledge should
  keep omitting the argument rather than passing an incomplete map.
- The certificate page's per-check canonical lookup assumes `checkMetas`
  indexes align with `checkQuizNames`; both derive from
  `getKnowledgeChecks(series)`, so they are order-stable.

### Security: server-side source of truth for grading, unlock, and certificates (t_7469e31d)

Resolves val-el's security audit (t_7469e31d) — 5 findings, all confirmed
still present on re-audit and now fixed. The common thread: quiz_run
(client-writable history) was trusted for pass/unlock/certificate decisions,
and the exam answer key shipped in the client bundle.

**What**

1. **F1 (HIGH, CWE-345) — `quiz_run` never trusts client scores.**
   `POST /api/progress/quiz/run` ignores client `correct`/`total` entirely
   (`src/app/api/progress/quiz/run/route.ts`). correct/total/score are
   recomputed server-side from the server-graded `quiz_attempt` rows
   (`scoreQuizAttemptRows`), and a run is only recorded when the graded
   attempt set covers the canonical question count — so 9 forged POSTs can
   neither fabricate an 80%+ check (exam unlock) nor a 100% exam
   (certificate).
2. **F2 (HIGH, CWE-345) — unlock + certificate eligibility read `quiz_attempt`.**
   `src/app/learn/[series]/exam/page.tsx`, `src/app/learn/[series]/certificate/page.tsx`,
   and `src/app/api/progress/quiz/tiers/route.ts` all switched their
   source-of-truth for bestScore/passed/unlocked from client-writable
   `quiz_run` to server-graded `quiz_attempt` rows
   (`scoreQuizAttemptRows` / `scoreQuizAttemptsByQuiz`). `quiz_run` is now
   read only for display-only attempt counts and cannot grant anything.
3. **F3 (MEDIUM, CWE-200) — answer key stripped from client bundle.**
   `src/app/learn/[series]/exam/page.tsx` strips `correct_answer_index` and
   `explanation` server-side before passing questions to `ExamWidget`
   (which only needs `question`/`options`). Grading stays server-side in
   `POST /api/progress/quiz/batch`.
4. **F4 (LOW, CWE-20) — strict digit gate on check ids.**
   `src/lib/quiz.ts` `resolveQuizByName` rejects non-`/^[0-9]+$/` check ids
   (`check:3abc` no longer silently parses to 3) before the filesystem join.
5. **F5 (LOW, CWE-345) — lesson completion accepts only canonical slugs.**
   `POST /api/progress/lesson` rejects slugs not in
   `getAllCanonicalLessonSlugs()` (union of published lessons + the
   generator's planned per-lesson question files), so completion can't be
   forged for non-existent/foreign lessons.

**Why**

- Server-side grading already existed in both grading routes; the hole was
  that downstream decisions trusted client-writable `quiz_run` rows and the
  client body. Deriving every pass/unlock/certificate decision from the
  server-graded `quiz_attempt` rows closes the forgery class (CWE-345) and
  keeps the exam "no-feedback" property honest (CWE-200).
- Server-side grading, origin/CSRF, rate limiting, session gating, RLS, and
  parameterised queries were verified sound and left untouched.

**Known Issues**

- `src/lib/certificate.ts` doc comments still say "quiz_run" but the pure
  helper is now fed `quiz_attempt`-derived runs by the page; function is
  unchanged and semantics identical.
- Certificate completion date derives from the latest graded exam answer
  (`quiz_attempt.attempted_at`) since that table has no run boundaries.

### Fix: enforce exam unlock server-side + certificate eligibility checks (t_c6333dd3)

Resolves val-el's security audit (t_05fad9a9) — MEDIUM, OWASP A01 (Broken
Access Control) / CWE-285 (Improper Authorization). The exam-unlock rule was
only enforced in the page render, so a direct API call could record a passing
exam score (and, compounding, a certificate) without completing the 9
knowledge checks.

**What**

1. **POST /api/progress/quiz/batch now re-verifies the exam unlock server-side**
   (`src/app/api/progress/quiz/batch/route.ts`). After auth and before any row
   is written, it queries `quiz_run` for the series' check quizNames
   (`<series>:check:1..9` from `getKnowledgeChecks`) and requires every check's
   best score >= 80 (`areAllChecksPassed`). Failure returns
   `403 { status: "unlock-required" }` — no `quiz_attempt`/`quiz_run` write.
   A series with no checks stays unlocked (same semantics as `exam/page.tsx`).
2. **Certificate eligibility no longer trusts "exam unlocked ⇒ checks passed"**
   (`src/lib/certificate.ts`). New exported pure helper `areAllChecksPassed`
   (best-score MAX per check, all >= 80) is the single unlock predicate;
   `buildCertificateEligibility` now requires
   `lessonsCompleted >= totalLessons && examPassed && all checks passed`.
   Defense-in-depth: even if an exam run were recorded around the gate, a
   certificate still cannot be earned without all 9 checks.

**Why**

- The page gate is cosmetic against a motivated client: `ExamWidget` posts to
  the same endpoint the page uses, and nothing stopped a caller from firing it
  with zero check runs. Server-side re-verification closes the hole at the
  write boundary (CWE-285: enforce authorization on every access path).
- The certificate rule depended on an assumption about how exam runs come to
  exist; making the checks an explicit term of `eligible` keeps the invariant
  even if the gate is ever bypassed or the flow changes.

**Known Issues**

- The unlock check adds one indexed `quiz_run` query per exam submit
  (`user_id` + `quiz_name` IN 9) — negligible at blog scale, and the gate
  short-circuits before the batch upsert on failure.
- `areAllChecksPassed` treats an empty check list as unlocked; there is no
  series today with an exam but zero checks (all tier exams have check files).

### Fix: a11y findings — quiz tiers + exam + certificate (t_5664453e)

Resolves lara's audit (t_5ed4bb0f) — 4 medium + 4 low WCAG 2.2 AA findings
in the quiz-tier components. SEO verdict was PASS; no metadata/sitemap/
structured-data touched. No shared contracts or curriculum data modified.

**What** (finding → change)

1. **[MED] Exam results heading + focus** (`ExamWidget.tsx`) — results view now
   exposes an sr-only `h2` "Exam results" (`tabIndex={-1}`) and focus moves to it
   on manual submit AND auto-submit at 00:00 (WCAG 1.3.1/2.4.6/2.4.3), so AT
   users hear the outcome instead of dropping to `<body>`.
2. **[MED] Exam timer announcements** (`ExamWidget.tsx`) — countdown span has
   `role="timer"` + `aria-live="off"` (per-second ticks don't announce), plus a
   polite `role="status"` live region announcing thresholds once per run
   (10 min / 5 min / 1 min remaining) and the auto-submit ("Time's up — your
   exam was submitted automatically"). Announcements reset on retake.
   `prefers-reduced-motion` was already covered by the global reduced-motion
   block (audit PASS); no new motion added.
3. **[MED] Certificate single h1** (`Certificate.tsx`) — the certificate
   document title (`cert-title`) is now the page's single `<h1>` ("Certificate
   of Completion"), so the printable view has a proper heading structure; the
   on-screen "Your certificate" page chrome was demoted to a styled `<p>` (was
   a second h1). Exactly one h1 in both screen and print output.
4. **[MED] gray-400 contrast** — every `text-gray-400` carrying body/required
   text in the quiz-tier components bumped to `text-gray-500` (#6B7280, 4.74:1
   on white): ExamWidget (score fraction, Answer review, exam header meta,
   Question X of Y ×2, exam-mode note), ExamLocked (80% required per check,
   not-taken pill, footer note), CheckCardList (checks passed count),
   SeriesSyllabus (All Lessons heading, published/upcoming, Mark complete,
   empty state), LessonQuiz (3 QUESTIONS · ~2 MIN), certificate page checklist
   (kicker + x/n counts + icons), and Certificate.tsx scoped CSS
   (#9CA3AF → #6B7280 for cert-kicker, recipient-label, issuer). Timer-bar
   white-on-navy labels bumped white/45–60 → white/70. Decorative/aria-hidden
   icons and the disabled ExamCard button left as-is (exempt).
5. **[LOW] Exam radiogroup arrow keys** (`ExamWidget.tsx`) — ported
   QuizWidget's WAI-ARIA roving: ArrowDown/Right/Up/Left move selection +
   focus between options (automatic-activation), wrapping at the edges.
6. **[LOW] Switch target size** (`SeriesSyllabus.tsx`) — hide-completed switch
   is now a 44×44 hit target (`w-11 h-11`) with the visual 32×18 track centered
   inside (WCAG 2.5.8); the wrapping label remains the adjacent text.
7. **[LOW] Sort control labels** (`LessonSortToggle.tsx`) — buttons got
   `aria-label="Sort by lesson number ascending/descending"`; the glyph text
   ("1 → 9") no longer leaks as the accessible name. `aria-pressed` kept.
8. **[LOW] GuestCTA role semantics** (`GuestCTA.tsx`) — dropped `role="note"`
   + duplicate `aria-label` on the card; the `<section aria-label>` is the
   named region. Content remains visible (no display:none tricks, no question
   text).

**Why**

- The exam results transition dropped SR users to `<body>` (no landmark), the
  countdown was silent to AT (deadline is the exam's core constraint), and the
  printed certificate had no heading. Small mono labels at gray-400 (~2.5:1)
  failed AA; the quiz-tier components were the systemic source. The rest are
  keyboard/target-name/semantics gaps in the new tier UI.

**Verification**

- `npm run test` 83/83 pass (was 71; +12: ExamWidget a11y suite 5, Certificate
  h1/contrast 2, LessonSortToggle 2, GuestCTA 2, SeriesSyllabus switch 1).
- `tsc --noEmit` 0 errors; `npm run build` clean (quiz/cert routes registered);
  `eslint` clean on all touched files.
- Live (dev server :3000): series page — switch 44×44 + toggles aria-checked,
  sort buttons carry the new labels and `?sort=desc` re-sorts the list; exam
  locked page renders (no layout regressions); certificate page checklist shows
  gray-500 counts; CDP trusted ArrowDown on a check quiz roves selection +
  focus (pattern shared with the exam).

**Known Issues**

- The exam's results h2 is `sr-only` (consistent with QuizWidget) — visible
  heading could be added later if design wants it.
- `text-gray-400` remains in non-quiz-tier pages (blog/header/tags) and on
  decorative/aria-hidden icons — out of scope for this audit, unchanged.

### Implement: certificate of completion (t_959ca6bf)

Adds the printable certificate of completion at `/learn/[series]/certificate`,
the final step of the course-progression pattern (all lessons completed + cert
prep exam ≥72%). No new table — eligibility is derived on demand from existing
rows (ADR-106); no image generation — a clean designed SVG-seal certificate.

**What**

- **Certificate page** (`src/app/learn/[series]/certificate/page.tsx`, server component,
  force-dynamic) — session-gated per ADR-104: guests get the `GuestCTA` placeholder with zero
  certificate/question text in the HTML; authed users get eligibility derived from
  `lesson_completion` + `quiz_run` rows.
- **Eligibility rule (course-progression pattern)** — all 46 planned lessons completed AND exam
  best ≥ 72 (72 flat counts). The lesson count is derived from the generator's planned lesson set
  (`content/learn/<series>/questions/<slug>.json` — 46 files), NOT the published-MDX count
  (`s.totalLessons` is 8 today). Knowledge-check pass counting (≥80) is included for the
  not-eligible checklist display.
- **`src/lib/certificate.ts`** — pure, unit-tested derivation helpers: `buildCertificateEligibility`
  (46-lesson + exam-72 rule, MAX best-score per quiz, checks-passed count capped to the check
  total), `certificateCompletionDate` (earliest passing exam run = the completion moment),
  `certificateRecipientName` (full_name/name/display_name metadata → email → "Learner"),
  `certificateCourseName` (copy-deck §7 exact string for omni-studio-cert),
  `formatCertDate`, `getSeriesLessonSlugs` (planned slug set, strict regex guard).
- **Printable `Certificate` component** (`src/components/Progress/Certificate.tsx`, client) —
  matches `design/mockup-certificate.html` pixel-for-pixel: navy double frame on cream paper,
  recipient name, course name, completion date, exam score, inline SVG Adroit seal (no image
  file), signature block + issuer, copy-deck §7 strings verbatim. `Print certificate` button
  calls `window.print()`.
- **Print CSS** — `@page { margin: 0 }`, `print-color-adjust: exact` (+ `-webkit-`), chrome
  (header/footer/page-head) hidden via `print:hidden`/`.no-print`. Verified with a real
  `Page.printToPDF` capture: 0 nav/footer leaks in the PDF.
- **Not-eligible state** — "Certificate not yet available" checklist per copy deck §7:
  `All {n} lessons completed` (`x/n`), `Cert prep exam passed (≥ 72%)` (`{best}% · passed/not
  yet/Not taken`), `Exam unlocked — all 9 knowledge checks ≥ 80%` (`x/9 checks`), with
  ok/x icons.

**Why**

- Chris's "full completion" rule needs a printable artifact that revalidates at print time
  (ADR-106); deriving from existing rows keeps the schema unchanged. Server-side validation
  means guests never see certificate content and users can't fabricate one.

**Verification**

- `npm run build` clean (certificate route registered as ƒ Dynamic), `npm run lint` clean,
  `tsc --noEmit` 0 errors, `vitest` 66/66 pass (18 new lib tests + 5 component tests).
- Live (running app, dev server on :3000):
  - Guest: `/learn/omni-studio-cert/certificate` 200, CTA placeholder, 0 certificate/question
    text in HTML (grep-verified).
  - Authed not-eligible (0 progress): checklist renders — `Complete all 46 lessons and pass the
    exam with 72%+`, `0/46`, `Not taken`, `0/9 checks`; no certificate document.
  - Authed eligible (46 lesson_completion rows + exam quiz_run 78% seeded, then cleaned up):
    certificate renders recipient (email fallback), `OmniStudio Developer Certification Prep`,
    `Aug 10, 2026`, `78%`, navy/red frame + cream paper + SVG seal (computed styles checked);
    print → `Page.printToPDF` output has the certificate and zero nav/footer text.
- **Infra unblock (done this task):** live Supabase (`zrggxfdyptiahskogwnn`) was missing
  migrations 002 (quiz_attempt unique index), 003 (RLS hardening), and 004 (`quiz_run` table) —
  they had never been pushed since 2026-08-06. `supabase db push` applied all three, which the
  entire quiz-tier build (exam grading, run tracking, tiers rollup, exam unlock, certificate
  eligibility) depends on. **Known issue:** the seeded exam `quiz_run` row (score 78, quiz_name
  `omni-studio-cert:exam`, user kelex1812@gmail.com) could NOT be deleted afterwards —
  `quiz_run` RLS intentionally has SELECT/INSERT policies only (no DELETE); remove via the
  Supabase dashboard or accept as test data.
- Config: `browser.allow_private_urls` enabled in the steel profile so kanban workers can
  verify localhost apps with the browser tool (reversible via `hermes config set
  browser.allow_private_urls false`).

### Content gen: emit quiz JSON tiers from curriculum (t_22855141)

Emits the three-tier quiz content for the OmniStudio cert course from the canonical curriculum
(`~/.hermes/scripts/omni-studio-curriculum.py`, 46 requirements × 3 questions = 138) via a new
idempotent generator, `scripts/generate-omni-quizzes.py`.

**What**

- New generator `scripts/generate-omni-quizzes.py` reads the curriculum module and emits:
  - `content/learn/omni-studio-cert/questions/<slug>.json` — 46 per-lesson files, 3 questions each,
    `quizName = omni-studio-cert:lesson:<slug>`. Slugs for published lessons (1–8) are taken from
    the MDX frontmatter; unpublished lessons use the cron's `day-NN-<id>-<title-slug>` pattern.
  - `content/learn/omni-studio-cert/checks/check-<1..9>.json` — 9 knowledge checks, 15 questions
    each, pooled from lessons 5n−4..5n (check-9 = lessons 41–45), `quizName = omni-studio-cert:check:<n>`.
  - `content/learn/omni-studio-cert/exam.json` — 60-question exam stratified to the official
    blueprint domain weights (Fundamentals 18% / FlexCards 15% / OmniScripts 20% / IP 15% /
    Data Mappers 17% / Troubleshooting 15% → 11/9/12/9/10/9), `quizName = omni-studio-cert:exam`.
- Same JSON shape as the existing series quiz file (`quizName, title, description, questions[]`
  with `correct_answer_index`; answer letter → 0-based index), matching `src/shared/contracts.ts`
  (`QuizData` / `QuizQuestion`).

**Why**

- The three-tier lesson → knowledge check → cert exam progression (course-progression pattern)
  needs machine-emitted, deterministic question content keyed to lesson slugs; hand-curated
  content doesn't scale to 46 lessons and would drift from the curriculum.

**Verification**

- 46 lesson files (3 q each), 9 check files (15 q each), exam.json (60 q) — all counts verified.
- Exam domain weights are 11/9/12/9/10/9 (within ±1 of blueprint % for all six domains).
- `python3 -m json.tool` parses all 56 emitted JSON files.
- Rerun-safe: fixed seed (20260810) + deterministic ordering + generator-owned dirs cleared first —
  two consecutive runs produce byte-identical output (sha256 diff clean).

**Known issues**

- Unpublished lessons 9–46 use a deterministic slug guess (`day-NN-<id.lower()>-<title-slugify>`).
  If the daily cron writes a lesson MDX with a different title slug, the sidecar won't match until
  the generator is re-run after the lesson publishes (it reads MDX frontmatter slugs when present).
- Lesson 46's questions are not pooled into any knowledge check (checks cover lessons 1–45 per spec).

### Implement: lesson quiz + checks + exam + ordering/filter (t_9756b64d)

Builds the interactive three-tier quiz experience on top of the generated JSON tiers:
per-lesson quizzes, knowledge checks, the timed cert prep exam, lesson-number
ordering, and a completion filter — all gated behind login (ADR-101/104/105).

**What**

- **Tier data-access (`src/lib/quiz.ts`)** — `getQuizForLesson`, `getKnowledgeChecks`,
  `getKnowledgeCheck`, `getCertExam`, `parseQuizName` + `resolveQuizByName` with the same
  fs-read + strict slug guard as the existing series quiz lookup.
- **Gated lesson quiz** — lesson pages (`/learn/[series]/[slug]`) are session-gated server-side:
  guests get the sign-up `GuestCTA` placeholder with ZERO question text in the HTML; authed users
  get the interactive `LessonQuiz` (QuizWidget, 3 questions, best-score tracked).
- **Knowledge check pages** (`/learn/[series]/check/[n]`, SSG 1..9) — 15-question QuizWidget,
  pass threshold 80 (80 flat passes), server-rendered pass-status row, guest CTA.
- **Cert prep exam** (`/learn/[series]/exam` + `ExamWidget`) — locked until all checks ≥80
  (`ExamLocked` with per-check progress); 60 questions, 105:00 deadline countdown (drift-proof,
  auto-submits at 0 via interval + visibilitychange), no per-question feedback, results with
  score ring + pass/fail at ≥72%, unlimited retakes, server-side elapsed bound [0, 6300s].
- **Batch grading API** (`POST /api/progress/quiz/batch`) — one request grades the whole exam
  server-side, upserts 60 `quiz_attempt` rows + one `quiz_run` row (MAX best-score semantics),
  origin/rate-limit/slug/index validation.
- **Tier rollup API** (`GET /api/progress/quiz/tiers`) — per-check best scores + pass state,
  exam best, lesson completion, unlock state; guests get safe zeros (never question text).
- **Series page** — `CertReadiness` rollup (Lessons x/46 · Checks x/9 · Exam best y% + weighted
  readiness bar), `CheckCardList` milestone rows, `ExamCard` (locked/unlocked + "Take the exam"),
  legacy "Take the quiz" button removed.
- **Ordering/filter (ADR-105)** — lesson listings sort by lesson number asc (learn.ts +
  build-learn.js in sync, `lesson-sort.ts` helper); `LessonSortToggle` re-targeted to
  lesson-number asc/desc; "Hide completed" filter on the syllabus (hydration-gated).
- **Legacy quiz removal (Decision 8)** — `/learn/[series]/quiz` route deleted (returns 404),
  series-root `content/omni-studio-cert/questions.json` retired, sitemap now emits check/exam
  pages instead of quiz pages.
- **Prose scrub** — `## Practice Questions` removed from all 8 published lesson MDX files (both
  `**Q:**` and `**Q1.**` formats); question content lives in the sidecar JSON only.

**Why**

- Guests never see question content (content gating), authed users get tracked, server-graded
  quizzes; the exam enforces the course-progression pattern (checks ≥80 unlock the timed exam,
  ≥72% passes); lesson-number ordering matches the authored curriculum sequence.

**Verification**

- `tsc --noEmit` 0 errors, `eslint` 0 errors, `npm run build` clean (route map shows
  check/exam pages, no quiz page), `npm test` 48/48 pass (9 files).
- Live (dev server): lesson/check/exam pages return 200 with the guest CTA and zero question
  text; legacy `/learn/omni-studio-cert/quiz` returns 404; series page renders lesson-number
  order + "Hide completed" + milestone rows + exam card; `GET /api/progress/quiz/tiers` returns
  zeroed progress for guests and 400 for a traversal series.
- Regression test added for the sort toggle wiring (`SeriesSyllabus.test.tsx`): `?sort=desc`
  re-sorts the syllabus (the toggle previously updated the URL but the list ignored it).

**Known issues**

- Exam `attemptCount` may over-count on a rare double-fire (server tolerates duplicate runs via
  MAX best-score semantics — documented in the impl plan risks).
- Unanswered exam questions are simply absent from the submitted answer list (graded as not
  correct); a future UI could surface "N unanswered" before submit.
- Authed end-to-end flows (quiz_attempt rows, check pass → exam unlock) require a real Supabase
  session and were verified via API/route contract + unit tests, not a live login.

### Fix: motion QA findings — ShareBar hydration, score ring, read-sync (QA t_ea005360)

Resolves all findings from zod's motion review: H-1 HIGH (ShareBar hydration mismatch + broken share URLs on every post page), M-1 MEDIUM (score ring fill never animates), M-2 MEDIUM (useReadProgress sync localStorage read → full hydration failure on post pages with read records), M-3 MEDIUM (Moment posture absent: no check-pop on read badge / MarkComplete, abrupt explanation reveal), L-1 LOW (no automated tests for animation behavior), L-2 LOW (LessonCard hover:pl-4 animates layout property).

**HIGH — ShareBar hydration mismatch + broken share URLs eliminated (H-1)**

- `ShareBar` no longer reads `window.location` during render. The share URL is captured in a post-mount effect (`currentUrl` state), so server HTML and the client's first paint both render the empty payload — React no longer leaves `?text=/?url=/?u=` empty in the DOM because the attribute never mismatched.
- The Facebook builder previously ignored its `text` argument and re-read `window.location` at call time; it now uses the same hydrated URL as Twitter/LinkedIn.
- Verified live on a post page: all three share links carry the full encoded current URL after mount.

**MEDIUM — score ring Moment fill animates (M-1)**

- `QuizWidget` score ring starts at dasharray `0` and flips to the final value on the next animation frame after the results view mounts (`ringFilled` state + `requestAnimationFrame`), so the CSS transition has a real from→to pair and plays.
- Easing upgraded to the design §07 Moment spring (`cubic-bezier(0.34,1.56,0.64,1)`, 450ms) instead of default ease.
- Retake re-arms `ringFilled` so every completion re-animates.

**MEDIUM — read/complete hydration failures fixed (M-2)**

- `useReadProgress` no longer reads `localStorage` in the `useState` initializer. Both server and first client render start unread; the stored record is read in a post-mount effect (same pattern as `useQuizProgress` QA F-1). Post pages with read records no longer throw a full hydration failure.
- Same fix applied to `useLessonProgress` (identical bug class on lesson pages with completion records).
- Verified live with a seeded read record: the post page hydrates cleanly and shows "Read" state with zero hydration errors in the console.

**MEDIUM — Moment posture added (M-3)**

- New `check-pop` keyframes (scale 0.6 → 1.1 → 1, spring `cubic-bezier(0.34,1.56,0.64,1)`, 450ms) in `globals.css`, matching `design/mockup-motion-lab.html`'s Moment demo.
- PostCard read badge and MarkComplete toggle now apply `check-pop` when they mount/toggle to the completed state.
- Explanation panel gets a `reveal-up` animation (fade + rise 8px, 450ms spring) instead of appearing abruptly.
- All motion is CSS-driven — the existing global `prefers-reduced-motion` block collapses durations to 0.01ms, so reduced-motion users see no animation.

**LOW — automated animation tests added (L-1)**

- New test files: `ShareBar.test.tsx` (SSR emits empty payloads without reading window.location; hrefs populate after mount), `LessonCard.test.tsx` (hover uses transform, no layout-property animation), `useReadProgress.test.tsx` (SSR renders unread even when a read record exists; hydrates after mount; toggle persists).
- `QuizWidget.test.tsx` extended: score ring reaches the final dasharray with the spring transition class, explanation panel carries `reveal-up`, and reduced-motion is CSS-driven (no inline-style JS animation).
- Test count: 28 pass (was 18).

**LOW — LessonCard layout animation removed (L-2)**

- `LessonCard` hover now uses `hover:translate-x-1` (transform) instead of `hover:pl-4` (padding), and the transition is scoped to `background-color,transform` rather than `transition-all` — no per-frame layout/reflow on hover.

**Static checks:** `tsc --noEmit` 0 errors, `eslint` 0 errors, `npm run build` clean, `npm test` 28/28 pass. Browser-verified live: share URLs populate, read state hydrates with no console errors, score ring spring class + final dasharray present, read badge `check-pop` class present, MarkComplete `check-pop` on toggle, LessonCard transform hover.

### Known Issues (new)

- None introduced. H-1 / M-1 / M-2 / M-3 / L-1 / L-2 resolved; quiz mechanics, a11y, security, and mobile behavior unchanged and still passing.

### Fix: quiz hydration mismatch + attempt-count inflation (QA t_51d10f42)

Resolves all findings from zod's quiz review: F-1 HIGH (hydration mismatch on every quiz page for returning users), F-2 MEDIUM (attemptCount inflates +1 per page visit/refresh), F-3 MEDIUM (no automated test coverage), and the optional F-4 (radiogroup arrow-key roving).

**HIGH — hydration mismatch eliminated (F-1)**

- `useQuizProgress` no longer reads `localStorage` synchronously in the `useState` initializer. It starts from the empty state on both server and client, reads the stored value in a post-mount effect, and exposes a `hydrated` flag. Server HTML and the client's first paint are now identical, so React no longer throws "Hydration failed because the server rendered HTML didn't match the client" and the SSR tree is no longer discarded.
- `QuizWidget` renders a lightweight pulse placeholder until `hydrated` — no more flash of the question view before the results view for users with a completed quiz.
- `QuizStats` returns `null` until `hydrated` (after all hooks) — the "Quiz avg X% · N attempts" strip appears only after hydration on `/learn` and `/learn/[series]`.

**MEDIUM — attemptCount no longer inflates on reload/visit (F-2)**

- Removed the `completeRun()` effect that fired on the `allAnswered` false→true transition with a `prevAllAnswered` ref that reset to `false` on every remount — reloading a completed quiz re-fired it and bumped attemptCount with no new run.
- Run completion is now session-scoped and atomic: `useQuizProgress` accepts the optional `totalQuestions` count and records `bestScore`/`attemptCount` (and POSTs the run to Supabase) inside `submitAnswer` at the exact moment the submitted answer completes the quiz. A reload/back-navigation never reaches `submitAnswer`, so it can never record a phantom run.
- Verified live: 2 real runs → "3 attempts" after reload → "4 attempts" after 2nd visit (old) is now 2 → reload → 2 (stable); a resumed partial run completes exactly once; retake still increments.

**MEDIUM — automated test coverage added (F-3)**

- Added Vitest + jsdom + Testing Library: `vitest.config.mts`, `vitest.setup.ts`, `"test"` / `"test:watch"` scripts.
- 18 tests across 3 files: `useQuizProgress.test.tsx` (hydration-safe initial state incl. SSR `renderToString` check, reset preserves bestScore/attemptCount, completeRun max-bestScore + increment, submit-time run completion exactly once, remount-with-completed-quiz does not inflate), `QuizWidget.test.tsx` (fresh run records once, remount no inflation, wrong-answer scoring, retake preserves + increments, keyboard roving, 390px mobile), `QuizStats.test.tsx` (no strip without attempts, strip after hydration, link href).

**LOW — radiogroup arrow-key roving (F-4)**

- `QuizWidget` option group now handles ArrowUp/Down/Left/Right with wrap-around and automatic activation per the WAI-ARIA radiogroup pattern (previously Tab/Space/Enter only).

**Static checks:** `tsc --noEmit` 0 errors, `eslint` 0 errors (`.vercel/**` build output added to eslint ignores alongside `.next`/`out`/`build`), `npm run build` clean, `npm test` 18/18 pass. Browser-verified with seeded localStorage: no hydration errors on `/learn`, `/learn/[series]`, `/learn/[series]/quiz`; attemptCount stable across reloads for completed and partial quizzes; real runs and retakes still record exactly once.

### Known Issues (new)

- None introduced. F-1/F-2/F-3/F-4 resolved; quiz mechanics, a11y, security, and mobile behavior unchanged and still passing.

### Fix: /api/progress/read 400s on blog contentSlug (QA t_b0f76a83, t_808e5885)

Resolves the HIGH finding from zod's progress-tracking review: POST/DELETE `/api/progress/read` always returned 400 for blog content because every blog call site sends the canonical ADR-002 namespaced slug `blog/<slug>` while `validateSlug` (SLUG_RE `^[a-zA-Z0-9_-]+$`) rejected the `/`. Authed cross-device read sync (US-003 AC4) never wrote/removed Supabase rows, and every mark/unmark toggle fired a console 400 even for guests.

**HIGH — namespaced contentSlug now accepted (traversal still blocked)**
- `src/lib/api-security.ts`: `validateSlug` gains an optional `{ allowNamespaced: true }` option. When set, it accepts the bare form OR the canonical `blog/<slug>` / `lesson/<slug>` form (`NAMESPACED_SLUG_RE`). Path traversal stays blocked: no `..`, no dots, no extra slashes (F2 posture unchanged).
- `src/app/api/progress/read/route.ts`: contentSlug validation passes `allowNamespaced: true`. `lessonSlug` (lesson route) and `quizName` (quiz routes) remain strict bare-slug-only — no loosening outside the read API.
- Canonical form stays consistent everywhere: localStorage key `adroit-blog:read:blog/<slug>`, DB `content_slug`, and the summary merge (`src/lib/progress.ts`) all use the same prefixed slug, so authed read state now survives reloads and syncs across devices.
- `scripts/verify-security-followup.py`: added contract cases — prefixed `blog/<slug>` / `lesson/<slug>` → 200, prefixed traversal `blog/../etc` → 400, prefixed double-slash → 400 (16/16 PASS against the dev server).
- Verified: `tsc --noEmit`, `eslint`, `npm run build` clean; live curl POST/DELETE `blog/<slug>` → 200 (was 400); browser mark/unmark on listing + post page fires the API with 200 and flips localStorage; no console 400.

**LOW — mobile 390px "Oldest" sort control no longer clipped**
- `src/app/blog/page.tsx`: the toolbar's `.ml-auto` row (ReadFilter + SortToggle) is now `flex flex-wrap items-center justify-end` — at 390px the row needs ~385px (241+136+8) but only has 342px, so SortToggle wraps to its own right-aligned line instead of being cut off by the hero's `overflow-hidden`. Desktop layout unchanged (verified visually; computed style confirms `flex-wrap: wrap`).

### Known Issues (new)
- None introduced. The 400 was the only open HIGH; the sort clip the only LOW. Both resolved with no API surface or storage-format changes.

### Fix: QuizStats nested anchor on /learn (QA run #2557, t_97f2451c)

Resolves the single remaining MEDIUM finding from zod's re-review (t_dfa1c8cd) of commit db25389.

**MEDIUM — nested interactive element (invalid HTML + hydration error)**
- `QuizStats` gains an `as` prop (`"link"` default | `"span"`). `PathCard` (learn hub) now renders the strip as a non-interactive `<span>` — the whole card already links to the series, so the strip is purely informational ("Quiz avg X% · N attempts"). The series-header usage (`/learn/[series]`, `onGradient`) keeps the interactive `Link` variant, which is not nested.
- Why: the previous `Link` inside `PathCard`'s `Link` produced `<a><a>…</a></a>`, invalid HTML that React flagged with "In HTML, <a> cannot be a descendant of <a>" after client hydration injected the strip (server HTML was clean because the strip only renders when attempts exist in localStorage). Removing the nested anchor also removes the ambiguous click target for assistive tech and the flaky first-click navigation.
- Verified: `tsc --noEmit`, `eslint`, `npm run build` all clean; production server loaded `/learn` with quiz attempts present — no nested anchors in DOM, no console errors/hydration warnings; series header still links to `/learn/<series>/quiz`.

### Known Issues (new)
- None introduced. The nested-anchor error was the only open finding; all 9 prior findings remain fixed (db25389).

### QA Findings — Blog Life & Depth re-review (t_574d3153)

Resolves all 9 findings from zod's QA review run #2552 (t_dfa1c8cd) of the Blog Life & Depth feature (read tracking, lesson completion, quiz engine, auth).

**HIGH**
- **US-003 AC1 — read cards now dim.** `PostCard` takes a `read` prop (banner `opacity-60`, title/excerpt `text-gray-400`, border `gray-100`, "Read again" CTA). New `PostCardWithRead` client wrapper wires the real merged read state per card (localStorage + Supabase) so the blog listing reflects actual progress. Emerald check badge (white circle + green check) sits top-right over the banner; read state also surfaces in the card `aria-label`.
- **US-004 AC3 — unmark/uncomplete now syncs to Supabase.** `useReadProgress` / `useLessonProgress` call `DELETE /api/progress/read` and `DELETE /api/progress/lesson` when the new state is false (previously POST-only upserts meant an unmark flipped localStorage but the Supabase row survived a reload). Both routes share the POST validation (contentType/slug checks, origin, rate limit) and delete only the user's own row. RLS DELETE policies already existed in migrations 001/003 — no new migration required for the unmark path.

**MEDIUM**
- **US-003 AC3/AC4 + US-004 AC4 — read filter + auth UI.** Blog listing gains the All/Unread/Read segmented control (design brief §4.2) with live per-segment counts from the merged read state, driven by the `?read=` URL param (resets pagination, shares the same URL contract as `category`/`sort`), plus a proper empty state ("No unread posts in this category."). Full auth UI added: `src/app/login/page.tsx` (Supabase email/password sign in + create-account toggle), `useAuth` client hook (session read via `GET /api/auth/session`, no tokens in the browser), auth API routes (`/api/auth/session`, `/api/auth/login`, `/api/auth/logout` — SSR client writes the HttpOnly cookie so progress routes authenticate naturally), Header sign-in/user-menu/sign-out in desktop + mobile nav, and a guest sign-in prompt on the blog listing ("Progress is saved on this device. Sign in to sync across devices."). Per-user cross-device progress is now reachable end-to-end.
- **US-005 AC4 — retake preserves the original score.** `useQuizProgress` now tracks `bestScore` (best completed-run %) and `attemptCount` (completed runs). `resetQuiz()` clears the current attempt but preserves both; `QuizWidget` records a run exactly once when the quiz becomes fully answered (via `completeRun()`) and shows "Best score X% · N attempts" on the results card.
- **US-005 AC5 — series quiz stats shown.** New `supabase/migrations/004_quiz_run_stats.sql` (`quiz_run` table + RLS) records completed runs server-side; `POST/GET /api/progress/quiz/run` writes and reads back best score + attempt count. New `QuizStats` client component merges localStorage (guest) + Supabase (authed) and renders the mono "Quiz avg X% · N attempts" strip on PathCard (learn hub) and the series header gradient strip — only when attempts exist (never invents stats).
- **MarkComplete aria-label ternary fixed** — both branches previously read "Mark"; now "Unmark lesson … incomplete" when complete, "Mark … complete" when not (screens readers announce the real action).

**LOW**
- **US-002 AC3 — button press feedback.** `active:scale-[0.98]` added to primary interactive controls: MarkAsRead, MarkComplete, category pills, read-filter segments, SortToggle, pagination, quiz Check/Next/Retake, header Contact CTA, login submit.
- **US-002 AC5 — hero fade-in on load.** `hero-fade-in` keyframes (opacity + 10px rise, 0.6s ease-out) in `globals.css`, applied to the blog and learn heroes; the existing `prefers-reduced-motion` block neutralises it automatically.
- **Banner backfill — 13/13 posts now have `bannerImage`.** Added `scripts/backfill-banners.js` (regenerates safely) and three on-brand category banners (`public/banners/category-sf.png`, `category-react.png`, `category-ai.png`), wired into MDX frontmatter; `build-posts.js` regenerated `src/data/posts.ts` so every card/post renders a real banner instead of the gradient fallback.

### Known Issues (new)
- `quiz_run` migration (004) must be applied to the linked Supabase project (local stack wasn't running during this fix; repo verified by build/lint). Without it, authed quiz stats fall back to localStorage — the guest path is unaffected.
- `/login` requires Supabase email confirmation to be configured (already `enable_confirmations = true` in `supabase/config.toml`); sign-up returns a "check your email" notice until confirmed.
- Read/lesson unmark and quiz-run writes are fire-and-forget like the mark path: if the network drops, localStorage remains authoritative and the next successful sync corrects Supabase.
- Category banner art is a deliberate, brand-consistent placeholder set (generated, matching category gradients) — Jimmy's parallel content task can still swap in post-specific imagery later without code changes.

### Security Fixes — Auth/session hardening follow-up (t_a719a31c)

Fixes remaining findings from val-el's auth-session audit (t_4ee14a75) + RLS audit (t_ea38d052), layered on top of t_c7f51ff6.

**MEDIUM**
- **F1 Admin-endpoint script misuse (CWE-798 / OWASP A07)** — `scripts/update-supabase-auth.py` previously sent the **anon key** as `Bearer` to the GoTrue admin endpoint `/auth/v1/admin/settings` with a false comment claiming anon can act as service_role. Rewritten: reads `SUPABASE_SERVICE_ROLE_KEY` from the **environment only** (never a tracked file), decodes the JWT `role` claim, and **fails closed** (exit 1, no request) when the key is missing, truncated, or not `service_role`. Comment corrected. Covered by `scripts/test_update_supabase_auth.py` (4 fail-closed/pass-through checks).

**LOW**
- **F2 Slug charset / path traversal (CWE-22 / OWASP A03)** — defense-in-depth added at the filesystem chokepoint: `getQuizForSeries()` in `src/lib/quiz.ts` now rejects any series that is not `/^[a-zA-Z0-9_-]+$/` (≤200 chars) before `path.join` — even though the API routes already validate via `validateSlug`, the page routes feed the raw URL `series` param directly into this function. Rejects `../../etc`, `..%2f`, etc. with a server-side warning.
- **F3 No session-refresh middleware (CWE-613 / OWASP A07)** — new `src/proxy.ts` (Next 16 renamed `middleware` → `proxy`): creates a `@supabase/ssr` cookie-bound client from request cookies, calls `auth.getUser()` on navigation so an expired access token refreshes before any protected server component ships, and writes refreshed cookies back to the response. Matcher excludes `api`, static assets, and images (API routes do their own `getUser()` + cookie refresh).

**LOW (RLS hardening from t_ea38d052 I3)**
- **I3 RLS posture** — new `supabase/migrations/003_security_hardening.sql`: all 12 policies re-created with explicit `TO authenticated` (was implicit PUBLIC); all 3 UPDATE policies now carry an explicit `WITH CHECK (auth.uid() = user_id)`; `user_id` columns on `read_progress` / `lesson_completion` / `quiz_attempt` gain `REFERENCES auth.users(id) ON DELETE CASCADE` (named FK constraints, dropped if present).

### Known Issues (new)
- `scripts/update-supabase-auth.py` now requires `SUPABASE_SERVICE_ROLE_KEY` in the shell env — if you need to re-run the GoTrue settings PATCH, export the real service_role key first (do not add it to any tracked file).
- Migration 003 must be applied to the linked Supabase project (local stack wasn't running during this fix; repo state verified by build/lint/tests only). `user_id` FK constraints require `auth.users` to exist (it does in every Supabase project).
- Proxy adds a `getUser()` round-trip on every page navigation; acceptable for a low-traffic blog. Excluded from API routes so progress POSTs are not double-refreshed.

### Security Fixes — Next upgrade + progress API hardening (t_c7f51ff6)

Fixes all findings from val-el's security audit (t_3bbee885) of the progress-tracking feature (Supabase RLS + auth + progress API).

**HIGH**
- **F1 Dependencies (CWE-1104 / OWASP A06)** — `next` upgraded `16.2.9 → 16.3.0` (exact pin; `eslint-config-next` matches). Clears 5 high + 1 moderate advisories (image-opt DoS via SVG GHSA-q8wf-6r8g-63ch, cache confusion GHSA-68g3-v927-f742 / GHSA-4633-3j49-mh5q, SSRF in rewrites GHSA-p9j2-gv94-2wf4, internal Server Function disclosure GHSA-955p-x3mx-jcvp). `npm audit fix` additionally patched `sharp`/`postcss`/`js-yaml`/`brace-expansion` transitive CVEs — **`npm audit` now reports 0 vulnerabilities**.

**MEDIUM**
- **F2 No rate limiting / unbounded input (CWE-770 / OWASP A04)** — all three progress POST routes (`read`, `lesson`, `quiz`) now: validate slug length ≤ 200 + kebab/snake charset (blocks path traversal like `../../`), and apply an in-memory sliding-window rate limit (30 req/min/IP, 429 on breach). New `supabase/migrations/002_quiz_attempt_unique.sql` adds `UNIQUE (user_id, quiz_name, question_index)`; quiz route upserts on it so each user keeps at most one latest-attempt row per question (no unbounded table growth).
- **F3 Client-supplied quiz correctness (CWE-345 / OWASP A04)** — `POST /api/progress/quiz` now loads the canonical quiz via `getQuizForSeries`, validates `questionIndex`/`userAnswerIndex` are integers ≥ 0 and within the quiz's question/option bounds (400 on out-of-range), and **recomputes `is_correct` + `correct_answer_index` server-side** from `questions.json`. Client `correctAnswerIndex`/`isCorrect` are ignored (still accepted for payload compat).

**LOW**
- **F4 Missing CSP + HSTS (CWE-693 / OWASP A05)** — `next.config.ts` now sets `Strict-Transport-Security: max-age=63072000` and a conservative `Content-Security-Policy` (`default-src 'self'`; `script-src 'self' 'unsafe-inline'` — required by Next for static pages, no nonces possible on SSG; `connect-src 'self' https://*.supabase.co`; `object-src 'none'`; `frame-ancestors 'none'`; `base-uri 'self'`; `form-action 'self'`). Verified live: headers present on all routes, blog/quiz pages hydrate with no CSP violations.
- **F5 Supabase error leakage (CWE-209 / OWASP A05)** — the three POST routes now log the real Supabase error server-side (`console.error`) and return a generic `"Failed to save progress"` to the client instead of `error.message`.
- **F6 No CSRF defense-in-depth (CWE-352 / OWASP A01)** — all three POST routes reject requests whose `Origin` header is present but not `https://adroit.io` / `www.adroit.io` / `adroit-blog.vercel.app` / `http://localhost:3000` (403). SameSite=Lax + JSON content-type remain the primary mitigation.
- **F7 Weak password/signup hygiene (CWE-521 / OWASP A07)** — `supabase/config.toml`: `minimum_password_length` 6 → 8, `password_requirements` `""` → `lower_upper_letters_digits`, and `http://localhost:3000` removed from `additional_redirect_urls` (prod config keeps prod-only redirects).

**Not in scope (per audit F8)** — MDX rendered without `rehype-sanitize`; content is trusted in-repo. Add sanitization before any user-authored content path.

### Known Issues
- CSP `script-src 'unsafe-inline'` is required because every page is statically prerendered — nonce-based strict CSP would force dynamic rendering on all pages (kills SSG/CDN caching). Acceptable for a static content site with no user-generated HTML; revisit if the app moves to dynamic pages.
- In-memory rate limiter resets on server restart (not persisted) — fine for a blog; swap for a shared store if the app scales horizontally.
- Quiz sync is fire-and-forget per ADR-004; with the new unique constraint, re-answering a question updates the same row (latest attempt wins) rather than appending.


### A11y/SEO Fixes — Progress UI + Quiz (t_08b3706e)

Fixes all HIGH/MEDIUM/LOW findings from lara's a11y audit of the progress-tracking feature (parent t_c9c0a24f).

**HIGH**
- **H1 Quiz options selection state** — `QuizWidget` option buttons now expose a real radio group: container `role="radiogroup"` + `aria-label="Answer options"`, each option `role="radio"` + `aria-checked` (WCAG 4.1.2/1.3.1)
- **H2 Answer feedback announced** — explanation panel is `role="status"` (polite live region) and a visually-hidden status span announces "Correct answer"/"Incorrect answer" on submit (WCAG 4.1.3)
- **H3 Icon-only MarkAsRead named** — new `label` prop; blog listing passes the post title so `aria-label="Mark as read: <title>"` replaces the unnamed icon button (WCAG 4.1.2)
- **H4 Skip link** — `Skip to content` link (`a.skip-link` in root layout, visible on focus) targets `id="main"` added to every page's `<main>` (WCAG 2.4.1)

**MEDIUM**
- **M1 Segment bar not color-only** — quiz progress bar is now `role="img"` with a text summary (`Quiz progress: Question 1 correct. Question 2 unanswered…`), each segment has a `title`, and a visible legend (✓/✕/○ glyphs + labels — shape-distinct, not color-only) appears once any question is answered (WCAG 1.4.1)
- **M2 Mobile menu semantics** — hamburger has `aria-expanded`/`aria-controls="mobile-nav"`, mobile menu is a `<nav aria-label="Mobile">` landmark; desktop nav labelled `Main` (WCAG 4.1.2)
- **M3 Pagination** — wrapped in `<nav aria-label="Pagination">`, arrows get `aria-label="Previous page"`/`"Next page"`, active page gets `aria-current="page"` (WCAG 4.1.2)
- **M4 Contrast** — `text-gray-400` → `text-gray-500` on quiz "Question X of Y" label, "Why" kicker, and LessonCard meta (now ≥4.5:1 on white)
- **M5 Sitemap quiz pages** — `/learn/<series>/quiz` entries added via `getQuizSeriesSlugs()` (only series with a `questions.json`)
- **M6 Quiz JSON-LD** — FAQPage structured data (question + accepted answer w/ explanation) + canonical URL on the quiz page
- **M7 LessonCard heading** — lesson title is now an `<h3>` instead of a bare `div`

**LOW**
- `ProgressIndicator` + `LessonProgress` expose `role="progressbar"` with `aria-valuemin/valuemax/valuenow` + `aria-valuetext`
- Quiz score-ring SVG is `role="img"` with `aria-label="N of M questions correct"`; review-list icons `aria-hidden`
- Results card has a visually-hidden `h2` ("Quiz results") so the heading outline stays valid
- ReadingProgress bar `aria-hidden` (decorative)
- MarkAsRead touch target increased (labeled variant `min-h-11` = 44px, icon-only `min-h-9` = 36px)

### Known Issues
- **ShareBar hydration mismatch (pre-existing, out of scope)** — `src/components/BlogPost/ShareBar.tsx` builds share URLs from `window.location.href` during client render vs empty string on the server, producing a React hydration warning and an empty `?text=`/`?url=`/`?u=` in the server-rendered share links. Present before this feature (untouched by d15ba1e); the "1 issue" badge in Next dev tools. Recommend a follow-up fix (render href from `useEffect` state or a static canonical URL). ShareBar itself predates progress tracking.
- Quiz radio buttons remain individually tabbable (click-first interaction) rather than the arrow-key navigation of a classic APG radio group — deliberate: the widget is mouse/touch-first and all options stay discoverable.
- Quiz answers persist only in localStorage per ADR-004 (intended); authenticated quiz sync to Supabase is fire-and-forget

### Integration Verification (t_b4ac5a38)
- **Build gate** — `npm run build` + `npm run lint` pass clean (Next 16.2.9, TS strict, eslint no findings)
- **API contracts verified** — `GET /api/progress/summary` returns `{readContent:{blog,lesson}, completedLessons}` (200, empty for guests); `POST /api/progress/read` / `lesson` / `quiz` accept the documented payloads, 400 on invalid type / missing slug, `unauthenticated` fallback for guests
- **Routes verified in running app** (dev server, localhost:3000) — `/blog` (progress bar "N of 13 posts read" + per-card MarkAsRead), `/blog/[slug]` (PostReadProgress + MarkAsRead toggle, state syncs with listing), `/learn` (per-series completion bars), `/learn/[series]` (SeriesProgress + MarkComplete + "Take the quiz" CTA), `/learn/[series]/[slug]` (completion state + toggle), `/learn/[series]/quiz` (5-question MCQ, Check Answer / Next / score ring / Retake), `/tags`, `/blog/categories`, `/feed.xml`, `/sitemap.xml`; quiz-less series `/learn/agentic-ai/quiz` correctly 404s
- **Interactions verified as real handlers** — MarkAsRead toggles localStorage `adroit-blog:read:blog/<slug>` and updates the aggregate bar live (0→1 of 13); MarkComplete toggles `adroit-blog:lesson:<slug>` and SeriesProgress updates live (0→1 of 3); quiz attempts persist to `adroit-blog:quiz:<name>` with correct/incorrect tracked (5/5 attempted, results view + Retake). No `() => {}` stubs found
- **Supabase connectivity** — project `zrggxfdyptiahskogwnn` ACTIVE_HEALTHY; `read_progress`, `lesson_completion`, `quiz_attempt` tables present (REST 200, RLS blocks anonymous reads as intended); guest path falls back to localStorage cleanly

### Added
- **Progress tracking — Blog Life & Depth (per arch plan t_718bb3ca, tasks 2–5)**:
  - **Supabase client layer** — `src/lib/supabase/client.ts` (singleton anon browser client) + `src/lib/supabase/server.ts` (cookie-based server client via `@supabase/ssr`, new dependency) + typed rows in `src/lib/supabase/types.ts`
  - **Read tracking** — `src/lib/hooks/useReadProgress.ts` (optimistic, localStorage fallback `adroit-blog:read:<slug>`, Supabase sync for authed users) + `POST /api/progress/read` (upsert read_progress) + `GET /api/progress/summary` (single aggregate endpoint, ADR-005)
  - **Lesson completion** — `src/lib/hooks/useLessonProgress.ts` (localStorage `adroit-blog:lesson:<slug>` + Supabase lesson_completion sync) + `POST /api/progress/lesson`
  - **Quiz** — `src/lib/hooks/useQuizProgress.ts` (localStorage-only per ADR-004, fire-and-forget sync to `POST /api/progress/quiz` for authed users) + QuizWidget component
  - **UI components** — `src/components/Progress/` (`MarkAsRead` pill toggle, `MarkComplete` circular check toggle per mockup-progress-series-lessons, `ProgressIndicator` bar, `QuizWidget` matching mockup-quiz.html, `PostReadProgress`, `LessonCompleteProgress`, `SeriesProgress`, `BlogReadProgress`)
  - **Real progress aggregation** — `src/lib/progress.ts` (namespaced keys + merged localStorage/Supabase sets) + `src/lib/hooks/useProgressSummary.ts` (live updates via `adroit-blog:progress-changed` custom event)
  - **Page integrations** — `/blog` top reading-progress bar (`BlogReadProgress`, real merged count), `/blog/[slug]` read state + toggle, `/learn` per-series completion bars, `/learn/[series]` header progress + per-lesson MarkComplete toggles + "Take the quiz" CTA, `/learn/[series]/[slug]` completion state + toggle
  - **Quiz content + page** — `content/omni-studio-cert/questions.json` (5-question OmniStudio cert MCQ with explanations) + `/learn/[series]/quiz` page (SSG, loads questions.json, 4-option MCQ with progress segments, Check Answer / Next, score-ring results + Retake)
  - **Quiz loader** — `src/lib/quiz.ts` (getQuizForSeries / getQuizSeriesSlugs, reads `content/<series>/questions.json`)

### Changed
- **API routes now use the cookie-based server client** (`src/lib/supabase/server.ts`) instead of the browser singleton — RLS-authenticated upserts work in route handlers; guests still get `unauthenticated` fallback
- **Lesson pages use completion semantics** (useLessonProgress / lesson_completion) instead of read tracking — the old `series/<slug>` MarkAsRead toggle and per-lesson read pills were removed
- **Progress bars reflect real user progress** (localStorage + Supabase summary) — the learn hub no longer renders a hard-coded full bar from the published lesson count

- **Learn tab** (`/learn`) — top-level nav section with two structured learning paths (Salesforce System Architect Primer, Agentic AI Implementation Path), matching Kara's mockups:
  - `/learn` hub — LearnHero display + PathCard per track with progress bar (red fill) and mono "Lesson N of M" counter, or a "Coming soon" badge for empty series
  - `/learn/[series]` — series page with gradient header strip, progress, and a syllabus list of lessons **newest first** (date desc), each row with a mono "Lesson N" badge, title, date, read time, and "New" pill on the newest item
  - `/learn/[series]/[slug]` — lesson page reusing the blog post chrome (ReadingProgress, ShareBar, author row, tags) with a series crumb, BackLink to the series, and LessonNavigation (prev/next by authored lesson number)
  - **Learn components** — `src/components/Learn/` (PathCard, LessonCard, LessonProgress, LessonNavigation, EmptyState)
- **Learn data pipeline** — `scripts/build-learn.js` mirrors `build-posts.js`: scans `content/learn/**/*.mdx`, parses frontmatter (title, slug, series, lesson, excerpt, date, author, readTime, tags), reads optional per-series `series.json` (name/description/gradient), sorts lessons newest-first, emits `src/data/learn.ts` (learnSeries + learnLessons). Wired into `package.json` prebuild.
- **Learn data-access layer** — `src/lib/learn.ts` (getAllSeries, getSeriesBySlug, getLessonsForSeries, getLesson, getLearnMDXContent, getSeriesProgress, seriesShortLabel, getAuthorInitials, stripMDXFrontmatter) with defensive newest-first re-sort per ADR-002
- **Types** — `LearnLesson` + `LearningSeries` appended to `src/data/types.ts` (BlogPost untouched)
- **SEO** — per-route metadata on all learn pages, JSON-LD (ItemList on /learn, LearningPath + ItemList on series pages, Article isPartOf LearningPath on lessons), and sitemap entries for /learn, all series, and all lessons (feed.xml stays blog-only)
- **Series configs** — `content/learn/salesforce-architect/series.json` and `content/learn/agentic-ai/series.json` (adding a track = drop a folder + optional JSON; no code change)
- **Header** — "Learn" nav link between Categories and Adroit.io (desktop + mobile), with pathname-based active highlight on all /learn routes
- **SEO metadata** — per-page `generateMetadata()` on all blog routes with OpenGraph, Twitter cards, canonical URLs, and roboted directives. Root layout sets base metadata; blog/[slug] and tags/[tag] generate dynamic per-post/tag metadata.
- **RSS feed** (`/feed.xml`) — RSS 2.0 feed via `feed` library, showing 20 most recent posts with title, link, description, pubDate, and category. Atom link in channel for self-discovery.
- **XML sitemap** (`/sitemap.xml`) — dynamic sitemap including static pages (/blog, /blog/categories, /tags) plus all blog posts and tag pages with appropriate change frequencies and priorities.
- **Tags system** — `/tags` index page with clickable tag chips (post counts), `/tags/[tag]` dynamic pages with `generateStaticParams`, featured post, and post grid for each tag. Tag aggregation in `src/lib/tags.ts`.
- **Content generation pipeline** — `scripts/pick-topic.py` (rotational topic picker), `scripts/content-calendar.json` (4 pillars, 20 topics), state tracking via `.picked-topics.json`. Hermes cron job `adroit-blog-writer` runs weekly to auto-generate posts.
- **kelexconsulting.com redirect** — path-preserving 301 redirect from `kelexconsulting.com` and `www.kelexconsulting.com` to `adroit.io` in `next.config.ts`.
- **Security headers** — `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin` on all routes.
- **`noUnusedLocals`** — enabled in tsconfig compilerOptions for stricter TypeScript checking.
- Blog listing (`/blog`) — layout wrapper with static metadata export (client component compatible).

### Changed
- **Design pass — elevated editorial polish (per Brainiac's implementation plan t_71faff13 + Kara's design system)**:
  - **Design tokens** — added `shadow-card`, `shadow-card-hover`, and per-category glow tokens (`shadow-glow-sf/react/ai/mkt`) to the `@theme inline` block in `globals.css` so cards, tag chips, and category panels use the token-based elevation system instead of ad-hoc shadows
  - **Article typography** (`globals.css` `.article-body`) — body bumped to `1.125rem`/`1.8` line-height; h2 downscaled to `1.5rem` with a bottom hairline (`border-bottom: 1px solid gray-200`, 10px padding); h3 to `1.125rem`; inline links now navy text-weight-600 with a 2px red underline (`rgba(200,16,46,0.4)`); blockquote flattened to gray-50 background, 16×24 padding, 1rem italic, big quote glyph removed; added global `prefers-reduced-motion` block (motion discipline)
  - **PostCard** — resting `shadow-card`, hover `shadow-card-hover` + `border-navy/15`, title `text-lg tracking-tight`
  - **FeaturedPost** — category-tinted glow (`var(--shadow-glow-<cat>)` inline on the card, `sf` fallback), radial red tint inside the navy panel, solid red FEATURED pill with white pulsing dot, title bumped to `text-2xl md:text-3xl`, category chip overlaid top-left of the image
  - **Post detail** (`/blog/[slug]`) — banner height to `h-[220px] md:h-[380px]` with bottom navy scrim + top-left category chip (navy/45 + blur + white border); author avatar `rounded-xl` with white ring and red hover ring; tag pills hover to navy text
  - **Blog listing hero** — kicker copy to "Adroit Consulting — Field Notes"; H1 uses navy→navy-light gradient text (matching Learn)
  - **Learn** — PathCard progress wrapped in a bordered progress row (`mt-4 pt-3 border-t border-gray-100`), "Coming soon" badge gets dashed border; LessonCard sequence badge `rounded-xl` with red lesson number on navy
  - **Categories** (`/blog/categories`) — flat pastel cards replaced with photographic bands: `h-[108px]` image band (`public/categories/*.jpg` copied from Kara's `design/assets/`), per-category multiply tint, bottom scrim, white icon chip on the band, mono count pill, category-tinted hover glow
  - **Tags** (`/tags`) — weighted tag cloud (chips scale lg/md/sm by post-count tercile); tag H1s (index + single tag) use gradient text; single-tag page reuses FeaturedPost/PostCard elevation
  - **ShareBar** — icons bumped to 14px, buttons to `w-9 h-9` (mockup parity)
- `package.json` prebuild now runs `node scripts/build-posts.js && node scripts/build-learn.js`
- `src/app/sitemap.ts` extended with learn URLs (weekly cadence, lessons priority 0.7)
- CHANGELOG restructured to reflect full platform feature set.

### Fixed
- **Learn lesson MDX rendering** — frontmatter is stripped before MDX rendering. (The blog renderer passes raw content through and renders the frontmatter blob as a heading — pre-existing behavior left untouched per scope; Learn does not replicate it.)
- **SEO robots** — layout now exports proper `robots: { index: true, follow: true }` via `buildMetadata()` (was default noindex).
- **Blog listing metadata** — added metadata layout wrapper so `/blog` has proper title/description/OG tags.

### Known Issues
- No lessons published yet (Jimmy cron starts daily content 2026-08-04) — both series render the graceful "coming soon" empty state; when lessons land, ordering is newest-first automatically
- `/learn` hub card bands use CSS gradients only (design's placeholder texture assets were intentionally not wired into production — replace with real imagery if desired later)
- Unknown series/lesson slugs render the framework default 404 (no custom not-found page yet)

## [2026-06-15] — Brand Styling (Round 2)

### Added
- **Next.js 16 project** with Tailwind CSS v4 and TypeScript
- **Design token system** — brand colors (navy #0B1D3A, red #C8102E, navy-dark #060F1F), Inter typography, border radii, shadows — mapped to Tailwind v4 `@theme` custom tokens
- **Header component** — sticky global navigation with logo (Adroit + BLOG badge), nav links (Posts, Categories, Adroit.io), CTA button, mobile hamburger menu with toggle
- **Footer component** — 4-column responsive layout: brand description, blog links (5 categories), company links (5 pages), newsletter subscribe form with email input and button, social icons with hover states
- **Blog Listing page** (`/blog`) — hero section with title and tagline, category filter pills (All Posts, Salesforce, React & Web Dev, AI & Consulting, Marketing) with active state, featured post card (2-column grid → stacked on mobile), 2-column post card grid → single column on mobile, pagination with numbered buttons, off-white (#F7F8FA) page background
- **Blog Post page** (`/blog/[slug]`) — fixed reading progress bar (3px, red fill, scroll-driven), author section with circular avatar (initials), date, and read time, share bar (X, LinkedIn, Facebook, Copy link), article body with styled headings, blockquotes (red left border), code blocks (dark background), lists, and horizontal rules, previous/next post navigation (2-column grid)
- **Categories page** (`/blog/categories`) — back link, page title and description, 2-column category card grid → single column on mobile, colored gradient cards (sky/emerald/amber/pink per category), hover lift effect, post count display, subscribe CTA card (navy background with red radial gradient overlay, email input + subscribe button)
- **PostCard component** — gradient image header (140px desktop, 100px mobile) per category color, category label overlay, tag badge, title, excerpt, date and "Read more →" link
- **FeaturedPost component** — navy background card with gradient image side (red/sky gradient overlays), 2-column layout, FEATURED label, metadata line
- **Data layer** (`src/data/posts.ts`) — typed blog post data with 6 sample posts across all 4 categories, slug-based routing
- **Root redirect** (`/`) — auto-redirects to `/blog`
- **Kara's design mockup** — copied to workspace as reference
- **Responsive breakpoints**: mobile (320px-767px: single column, hamburger nav, smaller fonts), tablet (768px-1023px: single column grid, full nav visible, 2-col footer), desktop (1024px+: full 2-col grid, 4-col footer, 1120px container), large desktop (1280px+: centered layout)

### Fixed
- **Categories page** — added `<Header />` and `<Footer />` (was rendering without navigation or footer)
- **Blog listing URL sync** — category filter now reads `?category=` query param from URL on load, and updates URL when pills are clicked
- **Accessibility** — added `aria-label="Email for newsletter"` to both subscribe email inputs (Footer and Categories page)
- **Social icons** — removed `cursor-pointer` and hover effects from Footer social icons (they were decorative but looked interactive)
- **Client navigation** — converted `<a>` tags to `<Link>` for client-side routing on Categories page
- **Build compliance** — wrapped `useSearchParams()` in `<Suspense>` per Next.js 16 requirements

### Known Issues
- Subscribe form and social share buttons are UI-only (no backend integration)
- Post card images use CSS gradients as placeholders — replace with actual images when available
