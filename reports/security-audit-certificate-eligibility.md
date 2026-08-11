# Security Audit — Certificate Eligibility Validation

- **Task:** t_bb5cc227
- **Auditor:** val-el (security)
- **Tenant:** adroit-blog
- **Date:** 2026-08-11
- **Scope:** Certificate issuance path in the quiz-tiers feature. Reference: `docs/requirements-quiz-tiers.md` (US-008), `docs/course-progression-pattern.md`.

---

## Verdict: NEEDS_REVISION

The **certificate read path** is implemented correctly, but the **underlying records it trusts are client-writable**, so completion *can* be spoofed. The audit question — *"client-side state cannot spoof completion"* — is answered **NO**.

---

## What is correct (PASS)

1. **Certificate page is gated server-side** — `src/app/learn/[series]/certificate/page.tsx:74-75, 100-113`. Uses `supabase.auth.getUser()` in a `force-dynamic` server component. Guest → `GuestCTA` placeholder; no certificate text or completion signals are rendered for guests. **PASS (guests leak nothing).**
2. **Eligibility is recomputed from DB rows, not a client flag/params** — `page.tsx:120-156` reads `lesson_completion` and `quiz_run` from Supabase and calls `buildCertificateEligibility` (`src/lib/certificate.ts:54-85`). No stored client flag, no request parameters influence eligibility. **PASS at the page layer.**
3. **Origin/CSRF check** (`checkOrigin`) and **rate limiting** (30/min/IP) present on all write routes. **PASS.**
4. **RLS on `quiz_run`** restricts SELECT/INSERT to `auth.uid() = user_id` (migration `004_quiz_run_stats.sql:28-34`) — prevents cross-user injection. **PASS for tenant isolation; does NOT stop self-forgery.**

---

## Findings

### Finding 1 — CRITICAL · Exam score forgeable → certificate forgery (broken access control)

- **CWE-287 / CWE-345 / OWASP A01 (Broken Access Control), A04 (Insecure Design)**
- **File:** `src/app/api/progress/quiz/run/route.ts` (POST, lines 34–85)
- **Issue:** This endpoint accepts `quizName`, `correct`, and `total` **from the client request body** and writes a `quiz_run` row whose `score = round(correct/total*100)` (line 66) **with no server-side recomputation**. Unlike `/api/progress/quiz/route.ts` (line 78, recomputes `is_correct`) and `/api/progress/quiz/batch/route.ts` (lines 142, 161, recompute correctness from canonical `exam.json`), this route **never reloads the canonical question set** and never validates that `quizName` is a non-exam tier. `quizName` only passes the format regex (`QUIZ_NAME_RE`); `omni-studio-cert:exam` is accepted.
- **Exploit (any authenticated user, 2 requests):**
  1. `POST /api/progress/quiz/run` body `{"quizName":"omni-studio-cert:exam","correct":60,"total":60}` → inserts `quiz_run` row with `score:100` for the exam tier.
  2. `POST /api/progress/lesson` body `{"lessonSlug":"<planned-slug>"}` ×46 → creates `lesson_completion` rows for every planned lesson.
- **Risk:** Certificate eligibility (`buildCertificateEligibility`, `certificate.ts:61-62,74`) reads `examBest = MAX(score)` over `quiz_run` and `lessonsCompleted >= totalLessons`. After the two forged writes, the server-side recomputation returns `eligible=true` and the certificate page renders a **printable certificate of completion — without the user taking the exam or completing a single lesson**.
- **Recommendation:** Derive exam best score from the **authoritative, server-graded `quiz_attempt` table** (which already stores server-recomputed `is_correct`/`correct_answer_index` from `/quiz` and `/batch`), not from client-supplied `quiz_run.score`. Alternatively, harden `/api/progress/quiz/run` to: (a) reject exam-tier quizNames (only allow `:lesson:`/`:check:`), and (b) recompute the score server-side from canonical question JSON like the other two routes do.

### Finding 2 — HIGH · Lesson completion forgeable via arbitrary slug

- **CWE-345 / OWASP A01 (Broken Access Control)**
- **File:** `src/app/api/progress/lesson/route.ts` (POST, lines 48–88)
- **Issue:** The route upserts a `lesson_completion` row for **any** format-valid `lessonSlug` (only `validateSlug` regex checked). It never verifies the slug corresponds to a real lesson in the series, nor that the user actually reached/read it. A client can mark all 46 planned lessons complete with 46 POSTs.
- **Risk:** Independently and in combination with Finding 1, this satisfies the "all lessons complete" leg of certificate eligibility. Devalues the completion credential; users can mark lessons complete without reading them.
- **Recommendation:** Validate `lessonSlug` against the series' planned lesson set (`getSeriesLessonSlugs`/`getLessonsForSeries`) before upserting; reject slugs not in the set. For a stronger guarantee on the certificate leg, require the lesson to have been read first (check `read_progress`) or gate completion server-side.

### Finding 3 — MEDIUM · Certificate trusts `quiz_run.score` (client-writable) instead of server-graded `quiz_attempt`

- **CWE-285 (Improper Authorization) / OWASP A01**
- **File:** `src/app/learn/[series]/certificate/page.tsx:128-148`
- **Issue:** The eligibility source of truth is `quiz_run.score`, a value the client controls through Finding 1. The authoritative, server-graded record for exam correctness is `quiz_attempt` (its `is_correct`/`correct_answer_index` are recomputed from canonical JSON in both `/quiz` and `/batch`). Certificate eligibility should be derived from `quiz_attempt`, making client forgery impossible even if `/run` stays permissive for display stats.
- **Risk:** Architecture-level — the certificate's trust anchor is the one writable-by-client table, not the server-graded one.
- **Recommendation:** Compute exam best + check pass from `quiz_attempt` rows (group by run, `SUM(is_correct)/COUNT(*)`). Keep `quiz_run` for display stats only.

---

## Security checklist summary

| Check | Result |
|---|---|
| Auth on protected certificate page | PASS (server `getUser`, guest→CTA) |
| Session management | PASS (Supabase cookie SSR) |
| Eligibility recomputed, not trusted flag/params | PASS at page layer |
| **Client state cannot spoof completion** | **FAIL** (F1 + F2) |
| Sensitive data hidden from guests | PASS (no cert text in guest HTML) |
| Input validation on write routes | PARTIAL (format-only; no tier/slug existence checks) |
| Server-side grading (not trusting client) | PARTIAL (`/quiz` & `/batch` recompute; `/run` does not) |
| CSRF / origin check | PASS |
| Rate limiting | PASS (30/min/IP) |
| RLS | PASS (own-rows only) |
| Error handling (no stack leaks) | PASS (`sanitiseDbError`) |

---

## Top fixes (priority order)

1. **Harden `POST /api/progress/quiz/run`** — reject exam-tier quizNames and recompute score server-side (or block the tier entirely and move exam scoring to `/batch` only).
2. **Derive certificate exam best from `quiz_attempt`** (server-graded) instead of `quiz_run.score`.
3. **Validate `lessonSlug` against the series' planned lesson set** before upserting `lesson_completion`.

OWASP categories affected: **4 of 10** (A01 Broken Access Control, A04 Insecure Design, A07 Identification/Auth Failures, A08 Integrity Failures).
