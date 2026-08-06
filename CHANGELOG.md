# Changelog

All notable changes to the Adroit Consulting Blog project will be documented in this file.

## [Unreleased]

### Added
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
