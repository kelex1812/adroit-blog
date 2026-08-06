## Security Audit — Blog Supabase RLS + Auth (progress/quizzes data)

**Scope:** adroit-blog — Supabase RLS policies, auth flow, progress API routes (read/lesson/quiz/summary), client hooks, dependencies
**Verdict:** NEEDS_REVISION
**Critical:** 0 | **High:** 1 | **Medium:** 2 | **Low:** 4 | **Info:** 1
**OWASP Categories Affected:** 4 of 10 (A06 Vulnerable Components, A04 Insecure Design, A05 Security Misconfiguration, A03 Injection surface)

---

### PASS — what is done right

1. **RLS is correctly enabled on all three tables** (`supabase/migrations/001_create_progress_tables.sql` lines 54, 73, 92) with per-user policies `auth.uid() = user_id` for SELECT/INSERT/UPDATE/DELETE. No anon access to other users' data. Verified: every policy gates on `auth.uid()`.
2. **Server-side writes bind `user_id` from the session, not the client body** — all three POST routes use `user.id` from `supabase.auth.getUser()`. No IDOR via body injection.
3. **`getUser()` (server-validated JWT) is used, not `getSession()`** — correct pattern for the API routes.
4. **No hardcoded secrets** — `.env.local` is gitignored; only `NEXT_PUBLIC_*` anon key/URL are used (anon key is public by design and safe because RLS is enforced). No `service_role` key anywhere in the app.
5. **Parameterized queries throughout** (supabase-js ORM) — no SQL injection.
6. **Content-type whitelist validated** on `/api/progress/read` (`contentType` must be `blog`/`lesson`).
7. **Security headers partially set** in `next.config.ts`: X-Content-Type-Options nosniff, X-Frame-Options DENY, Referrer-Policy.
8. **Auth config sane**: `jwt_expiry = 3600` (1h), refresh-token rotation on, email confirmations required, Supabase-side rate limits on sign-in/signup/token-refresh.
9. **No dangerous client-side HTML sinks** — the only `dangerouslySetInnerHTML` uses are JSON-LD `JSON.stringify` from trusted, build-time content files (not user input).

---

### Findings

### F1 — HIGH — Outdated dependencies with known CVEs
**CWE-1104 (Use of Unmaintained Third-Party Components) · OWASP A06**
**File:** `package.json` (line 1, `next: 16.2.9` pinned exact)

`npm audit` reports **5 high + 1 moderate** vulnerabilities:
- **next@16.2.9** — multiple advisories including DoS in Image Optimization API using SVGs (GHSA-q8wf-6r8g-63ch), cache confusion of response bodies (GHSA-68g3-v927-f742, GHSA-4633-3j49-mh5q), SSRF in rewrites (GHSA-p9j2-gv94-2wf4), unauthenticated disclosure of internal Server Function endpoints (GHSA-955p-x3mx-jcvp). Fix: **next@16.3.0** (audit fix --force; currently pinned exact `16.2.9`).
- **sharp@0.34.5** — inherited libvips CVEs (CVE-2026-33327/33328/35590/35591). Relevant because `next/image` (used in `BannerImage.tsx`, `blog/categories/page.tsx`) runs sharp server-side for image optimization.
- **postcss@8.5.15** (via tailwind, build-time) — XSS via unescaped `</style>` + arbitrary file read via sourceMappingURL.

**Risk:** Remote DoS via image optimization endpoint; framework-level cache/SSRF advisories. App doesn't use Server Actions or rewrites, so several advisories are not reachable — but the Image Optimization DoS is on the exposed path and the pinned framework version is stale.
**Recommendation:** `npm install next@16.3.0` (bump the pin), verify `sharp`/`postcss` resolve to patched versions, re-run `npm audit` to zero high.

---

### F2 — MEDIUM — No rate limiting, no request-size/input-length bounds on progress API
**CWE-770 (Allocation of Resources Without Limits) · OWASP A04**
**Files:** `src/app/api/progress/read/route.ts` (line 34), `lesson/route.ts` (line 26), `quiz/route.ts` (line 35)

All three POST endpoints accept unbounded input: `contentSlug`, `lessonSlug`, and `quizName` have no length/format validation; `quiz_attempt` rows are insert-only with no unique constraint (unlike read/lesson upserts), so a single authenticated user can POST unlimited rows with arbitrary `quizName`/`questionIndex` values — DB bloat / storage abuse. There is no rate limiting on any `/api/progress/*` route (only Supabase's own auth endpoints are rate-limited).
**Risk:** An authenticated user can trivially fill the `quiz_attempt` table (unbounded inserts, no dedupe) and store arbitrarily large slugs.
**Recommendation:** Validate slug length (e.g. ≤ 200 chars) and charset; add rate limiting (in-memory/IP or Supabase-side); consider a unique constraint on `quiz_attempt(user_id, quiz_name, question_index)` or a single latest-attempt row per question.

---

### F3 — MEDIUM — Server trusts client-supplied quiz correctness
**CWE-345 (Insufficient Verification of Data Authenticity) · OWASP A04**
**File:** `src/app/api/progress/quiz/route.ts` (lines 14-20, 35-43)

The quiz route accepts `correctAnswerIndex` and `isCorrect` directly from the client and persists them verbatim. A user can POST arbitrary `correctAnswerIndex`/`isCorrect` values to fabricate perfect scores and store wrong "correct answers" in `quiz_attempt`. Impact is limited to the attacker's own progress (RLS-scoped, no cross-user read), and the quiz is client-graded by design (ADR-004), so this is integrity-of-own-data rather than privilege escalation — but the DB now contains untrustworthy correctness data that any future feature (leaderboard, certificates, analytics) would consume.
**Recommendation:** Validate `questionIndex`/`userAnswerIndex` are integers ≥ 0 and within the quiz's question count (via `getQuizForSeries`), and either recompute `is_correct` server-side from canonical `questions.json` or document that quiz_attempt is client-authoritative and exclude it from any trusted reporting.

---

### F4 — LOW — Missing CSP and HSTS security headers
**CWE-693 (Protection Mechanism Failure) · OWASP A05**
**File:** `next.config.ts` (lines 33-52)

Headers set: nosniff, X-Frame-Options, Referrer-Policy. Missing: Content-Security-Policy and Strict-Transport-Security (HSTS). For a static content site with no user-generated HTML this is defense-in-depth, but CSP would contain the MDX/JSON-LD sink surface and HSTS prevents protocol downgrade on adroit.io.
**Recommendation:** Add a conservative CSP (`default-src 'self'`; allow inline styles/images from self) and `Strict-Transport-Security: max-age=63072000` (platform/Vercel may set it — verify at edge).

---

### F5 — LOW — Supabase error messages leaked to clients
**CWE-209 (Information Exposure Through Error Messages) · OWASP A05**
**Files:** `read/route.ts` (line 45), `lesson/route.ts` (line 36), `quiz/route.ts` (line 36)

On write failure the routes return `error: error.message` from Supabase to the browser, which can expose table/schema/constraint details. The catch-all paths correctly return a generic `{status:"error"}` — the explicit error branches do not.
**Recommendation:** Log the Supabase error server-side and return a generic message to the client (or omit `error` from the JSON response).

---

### F6 — LOW — No CSRF defense-in-depth on cookie-authenticated POSTs
**CWE-352 (Cross-Site Request Forgery) · OWASP A01**
**Files:** all three POST routes + `src/lib/supabase/server.ts`

The routes authenticate via the Supabase session cookie (`@supabase/ssr`). Mitigations are implicit: SameSite=Lax on the session cookie + JSON `Content-Type` requirement (cross-origin forms can't send JSON without preflight). No explicit Origin/Host header validation or CSRF token.
**Risk:** Low in practice (SameSite=Lax + JSON content type blocks the classic vectors), but no defense-in-depth.
**Recommendation:** Add a cheap `Origin` header check on the POST routes (reject when Origin is present and not `https://adroit.io` / localhost).

---

### F7 — LOW — Weak password policy / signup config hygiene
**CWE-521 (Weak Password Requirements) · OWASP A07**
**File:** `supabase/config.toml` (lines 181-190)

`minimum_password_length = 6` with empty `password_requirements`. Also `additional_redirect_urls` includes `http://localhost:3000` in the committed prod config (open-redirect hygiene: keep localhost entries dev-only). `enable_signup = true` is fine for a blog but note there is **no signup/login UI in the app at all** — Supabase auth is provisioned and wired (hooks call `getUser()`), but no user-facing way to authenticate exists, so the "authenticated progress sync" path is effectively dormant until a login flow ships.
**Recommendation:** Raise min password length to 8+ with `lower_upper_letters_digits`; remove localhost from prod redirect URLs (or keep in a dev config); decide whether a login UI is in scope for the auth investment to pay off.

---

### F8 — INFO — MDX rendered without sanitization
**CWE-79 (cross-site scripting, latent) · OWASP A03**
**Files:** `src/app/blog/[slug]/page.tsx` (line 172), `src/app/learn/[series]/[slug]/page.tsx` (line 185)

`MDXRemote` renders checked-in `content/*.mdx` with only `remark-gfm` — no `rehype-sanitize`. Currently safe because content is authored in-repo (trusted). If content ever becomes user-supplied (CMS, comments), this becomes stored XSS.
**Recommendation:** No action required today; add `rehype-sanitize` before any user-authored content path is introduced.

---

## Top Fixes (priority order)

1. **F1 — Upgrade next@16.2.9 → 16.3.0** and re-run `npm audit` to zero the 5 high CVEs (image-opt DoS + sharp libvips CVEs are on the exposed path).
2. **F2 + F3 — Harden the progress POST routes**: input length/format bounds, rate limiting, dedupe/last-attempt constraint on `quiz_attempt`, and server-side validation (or explicit documentation) of quiz correctness fields.
3. **F4 — Add CSP + HSTS headers** in `next.config.ts` (and verify HSTS at the edge).

## OWASP Categories Affected: 4/10
A06 (F1), A04 (F2, F3), A05 (F4, F5), A01 (F6) — plus A03/A07 as latent/informational (F7, F8).

---
*Audited by Val-El (security-workflow) · dependencies audited via `npm audit` · source read: supabase migrations, 4 API routes, 4 hooks, supabase clients, next.config, auth config*
