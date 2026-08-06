**Fix security findings for t_3bbee885** (Security audit of Blog Life & Depth — Supabase RLS + auth + progress API)

Original audit: *Security: Blog Supabase RLS + auth review (progress/quizzes data)*
By: **val-el**
Full report: `reports/security-audit-progress-rls.md` (workspace root, attached to t_3bbee885)

**Findings to fix:**

F1 — HIGH — Outdated dependencies with known CVEs (CWE-1104, OWASP A06)
- `package.json` pins `next: 16.2.9` exact. npm audit: 5 high + 1 moderate (image-opt DoS via SVG GHSA-q8wf-6r8g-63ch; cache confusion GHSA-68g3-v927-f742, GHSA-4633-3j49-mh5q; SSRF in rewrites GHSA-p9j2-gv94-2wf4; unauthenticated disclosure of internal Server Function endpoints GHSA-955p-x3mx-jcvp). sharp@0.34.5 inherits libvips CVEs (used by next/image in BannerImage.tsx, categories page). postcss@8.5.15 XSS/file-read (build-time).
- Fix: `npm install next@16.3.0` (bump the exact pin), verify sharp/postcss resolve patched, re-run `npm audit` until 0 high.

F2 — MEDIUM — No rate limiting / input-length bounds on progress API (CWE-770, OWASP A04)
- Files: `src/app/api/progress/read/route.ts` (line 34), `lesson/route.ts` (line 26), `quiz/route.ts` (line 35). Unbounded contentSlug/lessonSlug/quizName; quiz_attempt is insert-only with no dedupe — authenticated user can POST unlimited rows (DB bloat).
- Fix: validate slug length <= 200 + charset; add rate limiting (in-memory/IP or Supabase-side); add unique constraint on quiz_attempt(user_id, quiz_name, question_index) or single latest-attempt row per question.

F3 — MEDIUM — Server trusts client-supplied quiz correctness (CWE-345, OWASP A04)
- `src/app/api/progress/quiz/route.ts` (lines 14-20, 35-43) persists correctAnswerIndex/isCorrect verbatim from client — fabricated scores + wrong correct answers stored. RLS-scoped (own data) but corrupts future reporting.
- Fix: validate questionIndex/userAnswerIndex are ints >= 0 within quiz question count (getQuizForSeries); recompute is_correct server-side from questions.json, or explicitly document quiz_attempt as client-authoritative and exclude from trusted reporting.

F4 — LOW — Missing CSP + HSTS headers (CWE-693, OWASP A05)
- `next.config.ts` (lines 33-52) sets nosniff, X-Frame-Options, Referrer-Policy but not Content-Security-Policy or Strict-Transport-Security.
- Fix: add conservative CSP (`default-src 'self'`; allow inline styles/images from self) + `Strict-Transport-Security: max-age=63072000`.

F5 — LOW — Supabase error messages leaked to clients (CWE-209, OWASP A05)
- `read/route.ts` (line 45), `lesson/route.ts` (line 36), `quiz/route.ts` (line 36) return `error: error.message` on write failure — exposes table/schema/constraint details.
- Fix: log server-side, return generic message to client.

F6 — LOW — No CSRF defense-in-depth (CWE-352, OWASP A01)
- POST routes authenticate via Supabase session cookie; mitigated by SameSite=Lax + JSON content-type. Add cheap Origin header check (reject when Origin present and not https://adroit.io / localhost).

F7 — LOW — Weak password policy / signup config hygiene (CWE-521, OWASP A07)
- `supabase/config.toml` (lines 181-190): minimum_password_length = 6, empty password_requirements; `additional_redirect_urls` includes http://localhost:3000 in committed prod config.
- Fix: raise min length to 8+ with lower_upper_letters_digits; remove localhost from prod redirect URLs.

NOT in scope (no action): F8 MDX w/o rehype-sanitize (content is trusted in-repo; add sanitize before any user-authored content path).

---
- Fix only what's listed. Do not touch src/lib/sort.ts, content/, or build scripts.
- Run `npm run build` + `npm run lint` at repo root — must pass.
- When the fix completes, t_3bbee885 re-promotes for security re-review; the full original acceptance criteria still applies — no regressions.
