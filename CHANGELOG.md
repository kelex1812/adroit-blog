# Changelog

All notable changes to the Adroit Consulting Blog project will be documented in this file.

## [Unreleased]

### Added
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
- CHANGELOG restructured to reflect full platform feature set.

### Fixed
- **SEO robots** — layout now exports proper `robots: { index: true, follow: true }` via `buildMetadata()` (was default noindex).
- **Blog listing metadata** — added metadata layout wrapper so `/blog` has proper title/description/OG tags.

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
