# Security Audit — Server-Side Grading & Session Enforcement

**Task:** t_870dde90 · **Auditor:** val-el (Val-El, Security Auditor)
**Scope:** Authed quiz/exam data path — `POST /api/progress/quiz`, exam batch route, lesson/check/exam/certificate page gating, API write-route auth, certificate integrity.
**Source of truth:** `~/.hermes/plans/2026-08-10_182705-omni-interactive-quiz-tiers.md` + `docs/course-progression-pattern.md`.
**Date:** 2026-08-11 · **Verdict:** NEEDS_REVISION

---

## Executive summary

The per-question grading routes are correctly implemented: both `POST /api/progress/quiz`
(single question) and `POST /api/progress/quiz/batch` (exam) recompute correctness
server-side from the canonical JSON and never trust client-supplied `isCorrect` /
`correctAnswerIndex`. Page gating is also correct: lesson/check/exam/certificate pages
load question content **only** in the authed server branch, and all API write routes
reject unauthenticated requests.

**One blocking integrity flaw:** the run-level score records that drive exam unlock and
certificate eligibility (`quiz_run` rows) are client-trusted. `POST /api/progress/quiz/run`
accepts client-supplied `correct`/`total`, and RLS permits `authenticated` users to insert
`quiz_run` rows directly. Any logged-in user can forge check scores (≥80) to unlock the
exam and an exam score (≥72) to mint the certificate of completion — without answering a
single question correctly. The server-side grading guarantee is therefore not enforced at
the layer that matters for progression/certification.

---

## Pass criteria (from task body)

| Criterion | Result | Evidence |
|---|---|---|
| `POST /api/progress/quiz` grades server-side, never trusts client `isCorrect`/`correctAnswerIndex` | **PASS** | `src/app/api/progress/quiz/route.ts:77-79` — `correctAnswerIndex = quiz.questions[questionIndex].correct_answer_index; isCorrect = userAnswerIndex === correctAnswerIndex`. Client body fields are ignored for grading; indexes validated via `validateIndex` against the canonical quiz. |
| Exam batch route grades server-side from canonical JSON | **PASS** | `src/app/api/progress/quiz/batch/route.ts:142` — `isCorrect = answer.userAnswerIndex === question.correct_answer_index`, recomputed per answer; duplicate/out-of-range `questionIndex` rejected; unanswered questions count wrong (score = correct/questionCount). |
| Client answers are hints only | **PASS** | `src/lib/hooks/useQuizProgress.ts:87-104` sends answers to the API; server recomputes. `ExamWidget` posts only `questionIndex`/`userAnswerIndex` to the batch route (`src/components/Progress/ExamWidget.tsx:104-113`). |
| Lesson page gates question content server-side | **PASS** | `src/app/learn/[series]/[slug]/page.tsx:72-75` — `lessonQuiz = isAuthed ? getQuizForLesson(...) : null`; guest branch renders `GuestCTA` only (line 176-177). `dynamic = "force-dynamic"` prevents static question leakage. |
| Check page gates server-side | **PASS** | `src/app/learn/[series]/check/[n]/page.tsx:67-70,130-131` — questions passed to `QuizWidget` only when authed; guest gets `GuestCTA`. |
| Exam page gates server-side | **PASS** | `src/app/learn/[series]/exam/page.tsx:64-92` — guest → `GuestCTA`; authed-but-locked → `ExamLocked`; only authed + all checks ≥80 → `ExamWidget` with questions (line 119-125). |
| Certificate page gates server-side | **PASS** | `src/app/learn/[series]/certificate/page.tsx:100-113` — guest → `GuestCTA`; eligibility derived server-side from `lesson_completion` + `quiz_run` rows; printable certificate rendered only when eligible. |
| All API write routes reject unauthenticated | **PASS** | quiz, quiz/batch, quiz/run, lesson (POST/DELETE), read (POST/DELETE) all call `supabase.auth.getUser()` and return `unauthenticated` without writing when no user. |
| Guest HTML contains no question content (omni-studio-cert) | **PASS** | Question JSON loaded only in authed branches; `content/learn/omni-studio-cert/questions|checks|exam.json` are not in `public/` and have no serving route. No prose `Practice Questions` blocks remain in omni-studio-cert MDX (verified by grep). |

**Existing test coverage:** 32 tests pass across `api-security.test.ts`, `quiz.test.ts`,
`certificate.test.ts` (verified 2026-08-11, `npx vitest run`).

---

## Findings

### F1 — HIGH — Quiz run scores are client-trusted and forgeable: exam unlock + certificate bypass
- **CWE:** CWE-471 (Modification of Assumed-Immutable Data) / CWE-345 (Insufficient Verification of Data Authenticity)
- **OWASP:** A01 Broken Access Control · A04 Insecure Design
- **Files:**
  - `src/app/api/progress/quiz/run/route.ts:48-56` — validates only `typeof correct/total === "number"`, `correct <= total`; line 66-75 inserts the client-supplied score straight into `quiz_run`.
  - `supabase/migrations/004_quiz_run_stats.sql:38-41` — RLS `INSERT TO authenticated WITH CHECK (auth.uid() = user_id)`: any logged-in user can insert `quiz_run` rows directly with the public anon key, bypassing the API entirely.
  - `src/lib/hooks/useQuizProgress.ts:107-118` — `syncRunAPI` posts client-computed `correct`/`total`.
- **Attack:** an authenticated user (or anyone who can obtain their own Supabase JWT) POSTs `{quizName:"omni-studio-cert:check:1", correct:15, total:15}` … ×9 → all checks show ≥80 → exam unlocks (`exam/page.tsx:96-113` reads `quiz_run`). Same route accepts `quizName:"omni-studio-cert:exam"` with `correct:60,total:60` → certificate eligibility passes (`certificate/page.tsx:143-156`, `lib/certificate.ts:61-62`). No server-side verification of score origin anywhere in the chain.
- **Risk:** certificate of completion is forgeable; the exam-unlock gate is meaningless; the product's core integrity control ("server-side grading") is not enforced at the layer that drives progression.
- **Recommendation (defense in depth):**
  1. Make `/api/progress/quiz/run` derive `correct`/`total` server-side from the canonical quiz JSON + the user's **server-graded** `quiz_attempt` rows for that `quiz_name` (count `is_correct` for the questions in the run); never accept the client's counts.
  2. Harden RLS: revoke `INSERT`/`UPDATE`/`DELETE` on `quiz_attempt` and `quiz_run` for `authenticated` (keep SELECT own rows). Route writes go through a server-only service-role client (`getSupabaseAdminClient`), so the client can never write score-bearing tables directly.
  3. Document the remaining honor-system inputs: `lesson_completion` is client-marked by design — the certificate is only as strong as the least-trusted input feeding it.

### F2 — MEDIUM — No rate limiting / lockout on the auth endpoint
- **CWE:** CWE-307 (Improper Restriction of Excessive Authentication Attempts)
- **OWASP:** A07 Identification & Authentication Failures
- **File:** `src/app/api/auth/login/route.ts` (entire route) — no `checkRateLimit`, no origin check, no lockout/backoff.
- **Risk:** credential stuffing / password brute-force against user accounts. Supabase's own server-side auth limits may partially mitigate, but the route adds none.
- **Recommendation:** apply `checkRateLimit` (or a stricter 5–10/min limiter) to `/api/auth/login`; enable Supabase built-in rate limiting; consider lockout after N failures.

### F3 — LOW — Exam timer is client-controlled; server only bounds elapsed time
- **CWE:** CWE-693 (Protection Mechanism Failure) · **OWASP:** A04 Insecure Design
- **File:** `src/app/api/progress/quiz/batch/route.ts:86-96` — `elapsedSeconds` ∈ [0, 6360] accepted; client may claim 0 elapsed and take unlimited time.
- **Risk:** limited — questions are already client-side, there is no per-question feedback during the run, and grading is per-answer server-side. ADR-103 documents this as an accepted trust trade-off. Noted for the record; a server-issued signed start token would close it if the product wants strict timing.
- **Recommendation:** accept as documented (ADR-103) or issue a signed start timestamp when `ExamWidget` mounts.

### F4 — LOW — Login route lacks Origin check (login CSRF)
- **CWE:** CWE-352 (Cross-Site Request Forgery) · **OWASP:** A01 Broken Access Control
- **File:** `src/app/api/auth/login/route.ts` — unlike the progress routes, no `checkOrigin(req)`.
- **Risk:** a cross-site request can log a victim into the attacker's account (login CSRF), enabling follow-on abuse. Low severity for this surface (the attacker controls the account).
- **Recommendation:** apply `checkOrigin` to `/api/auth/login` like the progress routes.

### F5 — LOW — Header hardening gaps
- **File:** `next.config.ts` — HSTS has no `includeSubDomains`/`preload`; no `Permissions-Policy`; CSP `script-src 'unsafe-inline'` (documented Next.js static-render trade-off).
- **Recommendation:** add `includeSubDomains`; add a `Permissions-Policy` header; revisit CSP with nonces once pages are fully dynamic.

### F6 — INFO — Legacy prose questions remain in salesforce-architect MDX
- **Files:** `content/learn/salesforce-architect/{core-building-blocks-objects-fields-relationships,integration-fundamentals-rest-soap-bulk-apis,multi-tenant-platform-architecture}.mdx`
- **Note:** these series are not part of the quiz-tier gating (entire lesson is public content), so no leak under the current model. Required scrub if/when sfarch adopts the course-progression pattern (checklist step 4).

---

## OWASP Top 10 coverage

| # | Category | Status |
|---|---|---|
| 01 | Broken Access Control | **FAIL** — F1 (score forgery), F4 (login CSRF) |
| 02 | Cryptographic Failures | PASS — TLS/HSTS; session cookie HttpOnly via Supabase SSR |
| 03 | Injection | PASS — parameterized Supabase queries; strict slug/quizName validation; no SQL concat |
| 04 | Insecure Design | **FAIL** — F1 trust boundary; F3 timer trust |
| 05 | Security Misconfiguration | PASS — CSP, X-Frame-Options, nosniff, Referrer-Policy, HSTS set (F5 minor gaps) |
| 06 | Vulnerable & Outdated Components | PASS (build-time; not re-scanned this run) |
| 07 | Identification & Authentication Failures | **FAIL** — F2 (no rate limit on login) |
| 08 | Software & Data Integrity Failures | PASS — no untrusted deserialization; JSON parsed from trusted repo files |
| 09 | Security Logging & Monitoring | PASS — DB errors logged server-side (`sanitiseDbError`); auth events logged by Supabase |
| 10 | SSRF | PASS — no server-side URL fetching in this path |

**Affected:** 3 of 10 categories.

---

## Severity counts

- Critical: 0
- High: 1 (F1)
- Medium: 1 (F2)
- Low: 3 (F3, F4, F5)
- Info: 1 (F6)

## Top fixes (in order)

1. **F1a** — Derive `quiz_run` scores server-side from canonical JSON + server-graded `quiz_attempt` rows; remove client-trusted `correct`/`total` from `POST /api/progress/quiz/run`.
2. **F1b** — Harden RLS: revoke authenticated `INSERT`/`UPDATE`/`DELETE` on `quiz_attempt` + `quiz_run`; route writes through a server-only service-role client.
3. **F2** — Add rate limiting to `POST /api/auth/login`.

---

*Report artifact for consolidation task. Findings formatted per security-workflow v2 contract; a developer fix task should be created from F1 (+F2 optionally) after merge.*
