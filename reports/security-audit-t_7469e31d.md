# Security Audit — Authed Quiz/Exam Grading + Certificate Validation

Task: t_7469e31d · Tenant: adroit-blog · Auditor: val-el (security-workflow)
Date: 2026-08-11 · Verdict: **NEEDS_REVISION (blocked, review-required)**

## Scope reviewed

- POST /api/progress/quiz (single-attempt grading)
- POST /api/progress/quiz/batch (exam batch grading) — NEW
- POST/GET /api/progress/quiz/run (run stats / best score) 
- GET /api/progress/quiz/tiers (tier rollup / unlock) — NEW
- POST/DELETE /api/progress/lesson (lesson completion)
- src/lib/quiz.ts (tier lookups + resolveQuizByName + parseQuizName)
- src/lib/api-security.ts (validateSlug/validateQuizName/validateIndex, rate limit, origin check)
- src/lib/certificate.ts (eligibility derivation)
- Pages: lesson, check, exam, certificate (server-side gating)
- Components: ExamWidget, QuizWidget, useQuizProgress
- Supabase migrations 001-004 (RLS)
- Tests: api-security.test.ts, quiz.test.ts, certificate.test.ts — 32/32 pass

## Verdict by scope item

| # | Scope item | Result |
|---|---|---|
| 1 | Server-side grading (client isCorrect never trusted) | **PASS** |
| 2 | Session enforcement (guest HTML has no question content; authed-only writes) | **PASS** |
| 3 | Exam unlock integrity (≥80% gate from quiz_attempt, not client state) | **FAIL (HIGH)** |
| 4 | Timer trust (server-side elapsed bound; retake abuse rate-limited) | **PASS with caveat** |
| 5 | RLS + injection (per-user RLS, no SQLi/path traversal) | **PASS** |
| 6 | Certificate (server-validated eligibility, no spoofing) | **FAIL (HIGH)** |

OWASP categories affected: 2 of 10 (A01 Broken Access Control via A04 Insecure
Design data-authenticity gap; A08 Software/Data Integrity).

---

## Finding 1 — HIGH · CWE-345 (Insufficient Verification of Data Authenticity)

**File:** `src/app/api/progress/quiz/run/route.ts` (lines 48-75, esp. 66-75)
**Also:** `src/app/learn/[series]/exam/page.tsx:97-111`,
`src/app/learn/[series]/certificate/page.tsx:128-156`,
`src/app/api/progress/quiz/tiers/route.ts:72-105`

`POST /api/progress/quiz/run` accepts **client-reported** `correct`/`total`,
computes `score = round(correct/total*100)` and inserts a `quiz_run` row for
ANY quiz_name. Nothing cross-checks the reported counts against the
server-graded `quiz_attempt` rows for that quiz.

**Attack:** an authed user POSTs 9 requests:

    {"quizName":"omni-studio-cert:check:1","correct":15,"total":15}
    ...through check:9, then {"quizName":"omni-studio-cert:exam","correct":60,"total":60}

→ best score 100 for every check → exam unlocks without answering a single
question; exam best 100 → certificate eligible. Lesson completion is likewise
client-driven (`POST /api/progress/lesson` accepts any slug matching the
charset — no membership check against the series' canonical lesson set), so
all 46 lessons can be marked complete in 46 POSTs.

**Risk:** the explicit acceptance criterion "a user cannot skip checks or
fabricate pass scores" and "no client-side spoofing of completion" is violated.
Anyone with a free account can mint the certificate and unlock the exam.

**Recommendation:** derive check/exam scores server-side from the graded
`quiz_attempt` rows (count `is_correct` per user+quiz_name), and make
`/api/progress/quiz/run` verify `correct`/`total` against those rows (or
reject tier quiz_names on that route entirely — the batch route already
records the exam run). Enforce lesson-slug membership against the series'
canonical slug set in `/api/progress/lesson`.

---

## Finding 2 — HIGH · CWE-345 (data-authenticity gap in unlock + certificate derivation)

**Files:** `src/app/learn/[series]/exam/page.tsx:97-111`
`src/app/learn/[series]/certificate/page.tsx:128-156`
`src/app/api/progress/quiz/tiers/route.ts:72-105`

The exam-unlock gate and certificate eligibility read `quiz_run` rows
(client-writable per Finding 1), not the server-graded `quiz_attempt` rows.
The task scope explicitly required the ≥80%-per-check gate to be "computed
server-side from quiz_attempt rows, not client state"; the implementation
reads `quiz_run` best scores. Same root cause as Finding 1; listed separately
because the fix must land in the unlock/eligibility queries themselves
(switch source-of-truth to `quiz_attempt`), not only the run-sync route.

---

## Finding 3 — MEDIUM · CWE-200 (exam answer key shipped to client)

**File:** `src/app/learn/[series]/exam/page.tsx:120-125`
`src/components/Progress/ExamWidget.tsx` (props: `questions`)

The exam page passes the FULL canonical `exam.json` questions (including
`correct_answer_index` and `explanation` — confirmed present, 60/60) into the
client `ExamWidget`. Exam mode is supposed to give "no per-question feedback";
a user can trivially extract the answer key from the RSC payload / bundle and
score 100%. Grading remains server-side (so scores are recomputed honestly),
but the anti-cheat value of the exam is defeated.

**Risk:** exam integrity is cosmetic; anyone can read the key from the payload.

**Recommendation:** pass a sanitized question list to `ExamWidget` —
`{question, options}` only, stripping `correct_answer_index`/`explanation`
server-side (the batch route recomputes correctness from canonical JSON, so
the client never needs the key).

---

## Finding 4 — LOW · CWE-20 (lax integer parse in parseQuizName)

**File:** `src/lib/quiz.ts:195` (`parseInt(parsed.id, 10)`)

`omni-studio-cert:check:3abc` passes `isValidSegment` (charset) and
`parseInt` → 3, so it resolves to check-3 questions. Not exploitable today
(the stored quiz_name would differ from the canonical `...:check:3`, so it
won't count toward unlock), but it's sloppy validation. Use a strict
`/^\d+$/` check on the check id before parseInt.

---

## Finding 5 — LOW · CWE-345 (lesson completion membership)

**File:** `src/app/api/progress/lesson/route.ts:37-46, 71-78`

`POST /api/progress/lesson` validates only the slug charset, not that the
slug belongs to the requested series or exists at all. Certificate eligibility
depends on these rows. Tighten: require the slug to be in the series' canonical
slug set (and optionally require an active session check + that the lesson
exists). Self-attestation of completion is acceptable for a study tool, but
the slug set must be bounded to the course.

---

## Accepted / deferred items (documented, not blocking)

1. **Timer trust (ADR-103, scope item 4 — PASS with caveat):** the server
   bounds `elapsedSeconds` to [0, 105*60+60] and rate-limits submits; but the
   client controls `startedAt`, so a user can claim `elapsedSeconds: 0` after
   any real duration. Bounded, not bulletproof — explicitly accepted in the
   arch plan for a prep tool; a proctored model (server-side start token /
   table) is post-v1. Recommend documenting this limitation on the exam UI.
2. **In-memory rate limiter** resets on process restart (documented; fine for
   a blog).
3. **Origin allowlist includes `http://localhost:3000`** — dev convenience;
   consider pruning in prod.

## Evidence

- Tests: `npx vitest run src/lib/api-security.test.ts src/lib/quiz.test.ts src/lib/certificate.test.ts` → 3 files, 32/32 pass.
- exam.json: 60 questions, all with `correct_answer_index` + `explanation` (confirmed via read).
- RLS: migrations 001/003/004 — all policies `TO authenticated` with
  `auth.uid() = user_id` on SELECT/INSERT/UPDATE/DELETE + WITH CHECK;
  `quiz_run` SELECT/INSERT only (no update/delete needed). PASS.
- Path traversal: `validateQuizName`/`validateSlug`/`QUIZ_SERIES_RE` reject
  dots/slashes; segment length ≤ 200; `getKnowledgeCheck` guards n ≥ 1. PASS.
- SQLi: all Supabase queries parameterized via the typed client. PASS.

---

## Re-audit (2026-08-11) — APPROVED

Fix task t_fb1663ec (steel) landed commits 1bc921c + f2aadd2. Re-verified in code:

- **F1 HIGH (CWE-345) — FIXED.** `src/app/api/progress/quiz/run/route.ts` ignores client
  `correct`/`total` (never read from body); score derived from server-graded
  `quiz_attempt` rows via `scoreQuizAttemptRows`; run recorded only when
  `attempts.total === quiz.questions.length` (canonical coverage gate).
- **F2 HIGH (CWE-345) — FIXED.** Exam unlock (`exam/page.tsx`), certificate eligibility
  (`certificate/page.tsx`), and tiers `unlocked`/scores (`tiers/route.ts`) all read
  `quiz_attempt` via `scoreQuizAttemptRows` / `scoreQuizAttemptsByQuiz`.
  `quiz_run` is display-only (attempt count) and grants nothing.
- **F3 MEDIUM (CWE-200) — FIXED.** `exam/page.tsx` maps questions to `{question, options}`
  server-side; `ExamWidget` receives no `correct_answer_index`/`explanation`.
  Grading stays server-side in `POST /api/progress/quiz/batch` (canonical JSON, line 143).
- **F4 LOW (CWE-20) — FIXED.** `resolveQuizByName` rejects check ids not matching
  `/^[0-9]+$/` before `getKnowledgeCheck` (`quiz.ts:199`).
- **F5 LOW (CWE-345) — FIXED.** `POST /api/progress/lesson` rejects slugs outside
  `getAllCanonicalLessonSlugs()` with 400 before any write.

Verification: `vitest run` 106/106 pass (new tests: forged correct/total ignored,
incomplete attempt set not recorded, foreign slug rejected, `check:3abc` rejected,
attempt-scoring units). `eslint` clean on all touched files. Timer bound
`[0, 6360s]` + origin/CSRF + rate limit + RLS unchanged and still enforced.

**Verdict: PASS — 0 critical, 0 high, 0 medium, 0 low.**
