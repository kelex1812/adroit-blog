# Security Audit — Consolidated Findings (adroit-blog)

Task: t_1e5534a4 (consolidation) · Tenant: adroit-blog · Auditor: val-el (security-workflow)
Date: 2026-08-11 · Verdict: **NEEDS_REVISION (blocked, review-required)**
Aggregates: t_05fad9a9, t_57dad207, t_870dde90, t_bb5cc227, t_7469e31d

## Source-of-truth plan
- Plan: `~/.hermes/plans/2026-08-10_182705-omni-interactive-quiz-tiers.md`
- Pattern ref: `docs/course-progression-pattern.md`, `docs/requirements-quiz-tiers.md` (US-005/008, Decision 9), `docs/implementation-plan-quiz-tiers.md` (ADR-101..104)

## Severity rollup (deduplicated across the 5 audits)
- Critical: 1
- High: 2
- Medium: 5
- Low: 7
- Info: 2

## CRITICAL
**C1 · CWE-345/807/471 · OWASP A01 (Broken Access Control) + A04 (Insecure Design) + A08 (Integrity)**
`src/app/api/progress/quiz/run/route.ts:66-75` trusts client-supplied `correct`/`total`, computes
`score = round(correct/total*100)`, and inserts a `quiz_run` row for ANY quiz_name (incl. `omni-studio-cert:exam`).
CONFIRMED STILL PRESENT (read 2026-08-11). No cross-check against server-graded `quiz_attempt` rows.
Attack: 9 POSTs fabricate all checks ≥100% → exam unlocks; 1 POST fabricates exam 100% → certificate forgeable.
Directly violates task acceptance "users cannot skip checks or fabricate pass scores".

## HIGH
**H1 · CWE-345 · OWASP A01/A08**
Exam-unlock gate + certificate eligibility + tiers rollup read client-writable `quiz_run`, NOT the
server-graded `quiz_attempt` table (task scope required `quiz_attempt` as source-of-truth):
- `src/app/learn/[series]/exam/page.tsx:97-111`
- `src/app/learn/[series]/certificate/page.tsx:128-156`
- `src/app/api/progress/quiz/tiers/route.ts:72-105`
Same root cause as C1; fix must switch source-of-truth in these queries.

**H2 · CWE-602 · OWASP A04**
`src/app/api/progress/quiz/batch/route.ts:85-96` only bounds a client-supplied `elapsedSeconds` ([0,6360]).
Server has no record of exam start → clock tampering trusted. ADR-103 accepted-caveat, but does not satisfy
the "server-side elapsed-time check" requirement. Recommendation: server-issued signed start token / exam_session.started_at.

## MEDIUM
**M1 · CWE-200 · OWASP A05/A08** — Exam answer key shipped to client: `src/app/learn/[series]/exam/page.tsx:120-125`
passes full `exam.json` (correct_answer_index + explanation, 60/60) to `ExamWidget`. Strip to `{question, options}` server-side.

**M2 · CWE-307 · OWASP A07** — No rate limiting / lockout on `src/app/api/auth/login/route.ts`. Add `checkRateLimit` (5-10/min) + lockout.

**M3 · CWE-770/307 · OWASP A07** — `src/lib/api-security.ts:113-145` in-memory per-IP rate limiter: resets on restart,
not shared across serverless instances, IP-spoofable via first `x-forwarded-for`. Key on user_id for authed calls; consider shared store.

**M4 · CWE-471 · OWASP A01** — RLS permits `authenticated` INSERT on `quiz_attempt`/`quiz_run`
(`supabase/migrations/004_quiz_run_stats.sql`). Route writes through a server-only service-role client; revoke client INSERT/UPDATE/DELETE on score-bearing tables.

**M5 · CWE-1104 · OWASP A06** — `package.json` pins `next@16.2.9` exact; `npm audit` reports 5 high + 1 moderate
(image-opt DoS GHSA-q8wf-6r8g-63ch, cache confusion, rewrites SSRF, internal endpoint disclosure) + sharp libvips CVEs +
postcss XSS. Upgrade `next@16.3.0`, verify sharp/postcss, re-run audit to zero high.

## LOW
**L1 · CWE-345/807 · OWASP A01** — `src/app/api/progress/lesson/route.ts:37-46,71-78` upserts `lesson_completion` for any
format-valid slug, no membership check vs canonical lesson set → mark all 46 lessons complete without reading.

**L2 · CWE-20 · OWASP A03** — `src/lib/quiz.ts:195` `parseInt` lax (`check:3abc` → 3). Use strict `/^[0-9]+$/`.

**L3 · CWE-352 · OWASP A01** — `src/app/api/auth/login/route.ts` lacks `checkOrigin` (login CSRF). Apply like progress routes.

**L4 · CWE-693 · OWASP A05** — `next.config.ts` header gaps: HSTS no `includeSubDomains`/`preload`, no `Permissions-Policy`,
CSP `script-src 'unsafe-inline'`.

**L5 · CWE-209 · OWASP A05** — progress routes return Supabase `error.message` to clients (`read/lesson/quiz` explicit error branches).

**L6 · CWE-352 · OWASP A01** — progress POST routes rely on implicit SameSite=Lax + JSON content-type, no explicit Origin/Host validation on older `read/lesson/quiz` routes.

**L7 · CWE-521 · OWASP A07** — `supabase/config.toml` min password length 6, empty requirements, localhost in prod redirect URLs.

## PASS (verified)
- Server-side grading: POST /api/progress/quiz + exam batch both recompute correctness from canonical JSON, never trust client `isCorrect`/`correctAnswerIndex`.
- Session gating: guest HTML has zero question content (force-dynamic server components); all write routes reject unauthenticated.
- RLS: all tables per-user `auth.uid()` scoped + WITH CHECK; no cross-user data access.
- SQLi / path traversal: all queries parameterized; strict slug/quizName/index validation (no dots/slashes, length caps).
- Origin/CSRF check present on progress POST routes.
- Timer bound + retake rate limit present (accepted caveats M3/H2).
- Tests: `npx vitest run src/lib/api-security.test.ts src/lib/quiz.test.ts src/lib/certificate.test.ts` → 32/32 pass.

## Deferred / accepted (documented, not blocking)
1. Timer trust (H2) — ADR-103 accepted for prep tool; proctored model post-v1. Recommend documenting on exam UI.
2. In-memory rate limiter reset (M3) — accepted for a blog; revisit on multi-instance deploy.
3. Origin allowlist includes `http://localhost:3000` (M3 dev convenience) — prune in prod.
4. MDX rendered without `rehype-sanitize` (F8, info) — safe while content is in-repo/trusted; add before any user-authored content path.
5. No signup/login UI in app (F7) — authenticated progress sync is dormant until a login flow ships.

## OWASP categories affected: 6 of 10
A01 (C1,H1,L1,L3,L6,M4) · A04 (C1,H2,M3) · A05 (M1,L4,L5) · A06 (M5) · A07 (M2,M3,L7) · A08 (C1,H1,M1)

## Existing fix tasks (do NOT duplicate)
- **t_fb1663ec** (steel, todo) — consolidates C1, H1, M1, L1, L2 (source-of-truth, exam key, lesson slug, parseInt).
- **t_c6333dd3** (steel, running) / **t_d9a15b73** (steel, ready) — exam unlock enforced server-side (C1 check-leg).

## Top fixes to schedule/complete
1. C1/H1 — Derive check/exam scores server-side from `quiz_attempt`; make `/quiz/run` verify counts or reject tier quiz_names; switch unlock/eligibility/tiers queries to `quiz_attempt`.
2. M4 — Harden RLS: route score-bearing writes through service-role client; revoke client INSERT on quiz_attempt/quiz_run.
3. M5 — Upgrade next@16.2.9 → 16.3.0 and re-run `npm audit`.
