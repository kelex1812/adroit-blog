# Adroit Consulting Site

The **Adroit Consulting site** — a [Next.js](https://nextjs.org) (App Router) application hosting the Adroit Consulting **blog** and the **Learn tab** (learning paths and certification-prep courses). Published content is authored as MDX and generated into static data at build time; user accounts, progress, and quizzes are backed by [Supabase](https://supabase.com).

- **Production:** `https://adroit-blog-two.vercel.app` (Vercel project `adroit-blog`; auto-deploys on push to `main`)
- **Documentation:** [Wiki](https://github.com/kelex1812/adroit-blog/wiki)
- **Project board:** [Adroit Consulting Site](https://github.com/users/kelex1812/projects/1) (GitHub Projects)

> The production domain `adroit.io/blog` is intentionally not wired until launch. The site is staged on the private Vercel deployment.
## What's New

### Password-reset update route hardening: origin check + rate limit (PR #174) — 2026-08-31

The password-reset update API route (`/api/auth/reset-password/update`) now has defense-in-depth hardening that was committed but never shipped. Two guards now run before any request body is parsed: (1) an origin check that rejects cross-origin requests with HTTP 403 (CSRF protection, CWE-352), and (2) a per-IP sliding-window rate limit (30 requests/min) that returns HTTP 429 (brute-force protection, CWE-307). This closes the gap where the hardening existed in code but was not live in production. Verified live: cross-origin POST returns 403, homepage returns 200. All three audits (a11y/lara, QA/zod, security/val-el) PASS; 384 tests green. Risk LOW (defense-in-depth on an auth-gated route, +77/-3 lines across 3 files).

### A11Y fix: focus indicators + hint-text contrast on auth forms (v1.0) — 2026-08-31

The password-reset flow's auth forms (forgot-password, reset-password, login) now meet WCAG accessibility standards. Two a11y audit findings were fixed: (1) WCAG 2.4.7 Focus Visible (HIGH) - removed focus:outline-none from the five text inputs so keyboard focus shows a visible brand-red ring; and (2) WCAG 1.4.3 Contrast (MEDIUM) - raised hint text from text-gray-400 to text-gray-500 so helper text passes WCAG AA on white. Purely presentational Tailwind class edits; no auth logic, data, or API changes. All three audits (a11y/lara, QA/zod, security/val-el) PASS; 384 tests green.
### Password Reset flow (2026-08-31)

The Adroit Academy now has a full password-reset flow. Users request a secure, one-time reset link from `/forgot-password` (valid for 30 minutes and enumeration-safe, so it never reveals whether an account exists); a valid link opens the new-password form to set a new password. The flow is backed by enumeration-safe request, authenticated update, and resend-confirmation API routes plus a Supabase recovery-code callback. The reset page gates server-side before rendering markup: a guest with no valid reset session is redirected to `/login?next=/reset-password`, and expired/invalid links show a `role=alert` error with a "Request a new link" action and zero password inputs (flow t_e25638b3; gate fix t_13982e68, PR #172).

### /reset-password no longer leaks the new-password form to guests (2026-08-31)

The password-reset new-password page is now gated server-side before any markup renders. Visitors without a valid reset session are redirected to `/login?next=/reset-password`, and expired/invalid reset links show a `role=alert` error message with a "Request a new link" action instead of password fields. This closes the SSR leak where the raw new-password form HTML was served to any unauthenticated visitor. Security headers (CSP, HSTS, X-Frame-Options DENY) verified on the route.

### Paywall panel Light-mode contrast fix (2026-08-30) — 2026-08-30

Course-locked Paywall now renders as a dark navy panel with readable white text in Light mode (was white-on-light). Ships the .paywall-panel rule in globals.css reusing existing tokens, plus the follow-up accent-label contrast fix (4.88-5.75:1 AA).


## Stack

| | |
|---|---|
| **Framework** | Next.js 16 (App Router), React 19 |
| **Styling** | Tailwind CSS v4 with semantic design tokens |
| **Content** | MDX (blog + learn) → generated static data |
| **Backend** | Supabase (auth, progress, quizzes, course catalog) |
| **Testing** | Vitest + React Testing Library |
| **Deployment** | Vercel (auto-deploy on push to `main`) |

## Quick Start

```bash
npm install          # install dependencies
npm run dev          # development server (default :3000)
```

Requires the Supabase env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).

Production build:

```bash
npm run build        # prebuild (generates data) + next build
npm start            # run the production build
```

## Project Layout

```
content/
  blog/<slug>.mdx          # blog articles (frontmatter-driven)
  learn/<series>/          # learning lessons + series.json
scripts/
  build-posts.js           # regenerates src/data/posts.ts
  build-learn.js           # regenerates src/data/learn.ts
src/
  app/                     # App Router pages + API routes
  components/              # React components (Blog, Learn, Progress, MDX)
  lib/                     # helpers, Supabase clients, access seam, mdx
  data/                    # GENERATED static data (do not hand-edit)
  shared/                  # contracts + types
docs/                      # architecture, plans, audit reports
supabase/                  # migrations, config
```

## Key Scripts

```bash
npm run dev          # development server
npm run build        # prebuild + next build
npm run prebuild     # node scripts/build-posts.js && node scripts/build-learn.js
npm run lint         # eslint
npm test             # vitest run
npm run test:watch   # vitest watch
```

## Documentation

Full documentation lives in the **repo wiki**:

- [Architecture](https://github.com/kelex1812/adroit-blog/wiki/Architecture)
- [Content Pipeline](https://github.com/kelex1812/adroit-blog/wiki/Content-Pipeline)
- [Learn Tab & Course Progression](https://github.com/kelex1812/adroit-blog/wiki/Learn-Tab-and-Course-Progression)
- [Auth & User Progress](https://github.com/kelex1812/adroit-blog/wiki/Auth-and-User-Progress)
- [Admin & Course Catalog](https://github.com/kelex1812/adroit-blog/wiki/Admin-and-Course-Catalog)
- [Development Setup](https://github.com/kelex1812/adroit-blog/wiki/Development-Setup)
- [Testing](https://github.com/kelex1812/adroit-blog/wiki/Testing)

For AI agents: read the Next.js version docs in `node_modules/next/dist/docs/` before writing code — this version has breaking changes vs older Next.js.

## Contributing Notes (Fortress conventions)

- **Never hand-edit `src/data/posts.ts` or `src/data/learn.ts`** — they are generated by `prebuild`. Regenerate instead.
- **No em-dashes** anywhere; content follows the Fortress writing standards (no AI-slop, GFM endnote citations).
- Content is authored as MDX; course status + entitlements live in the database, not in content files.
- Commits land on `main` and auto-deploy. Keep the working tree clean of worker scratch (see `.gitignore`).

## License

Not yet licensed.
