# Changelog

All notable changes to the Adroit Consulting Blog project will be documented in this file.

## [Unreleased]

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
