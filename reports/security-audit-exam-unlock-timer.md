# Security Audit — Exam Unlock, Timer & Rate Limits (adroit-blog)

> Task: t_57dad207 · Auditor: val-el (security) · Date: 2026-08-11
> Scope: exam unlock integrity (80%-per-check gate), exam timer trust, retake rate limiting.
> References: docs/implementation-plan-quiz-tiers.md (ADR-101/102/103/104), docs/requirements-quiz-tiers.md (Decision 9, US-005).

## Verdict: NEEDS_REVISION (1 Critical, 1 High, 1 Medium, 1 Low)

---

## Finding 1 — CRITICAL · Check pass scores are client-forgeable → exam unlock & certificate bypass (CWE-807)

**Files**
- `src/app/api/progress/quiz/run/route.ts:66` — score computed from client-supplied `correct`/`total`.
- `src/app/api/progress/quiz/run/route.ts:68-75` — `quiz_run` row inserted with that client score.
- Downstream trust: `src/app/learn/[series]/exam/page.tsx:97-113`, `src/app/api/progress/quiz/tiers/route.ts:72-118`, `src/app/learn/[series]/certificate/page.tsx:128-156` all read best-score from the **`quiz_run`** table.

**Issue**
The exam-unlock gate (all 9 checks ≥ 80), the tiers rollup, and the certificate eligibility all derive pass state from `quiz_run.score` (MAX per quiz_name). But `quiz_run` is populated by `POST /api/progress/quiz/run`, which **does not recompute correctness server-side** — it accepts the client's `correct` and `total` and computes `score = round(correct/total*100)` verbatim:

```ts
const score = Math.round((body.correct / body.total) * 100);
const { error } = await supabase.from("quiz_run").insert({ ... score ... });
```

A caller can `POST /api/progress/quiz/run` with
`{ quizName: "omni-studio-cert:check:1", correct: 15, total: 15 }`
and immediately get `score=100` for that check, with **zero actual answers recorded**. Repeat for checks 1–9 → exam unlocks. This also satisfies the certificate "all checks passed" branch.

The server-verified correctness path (`POST /api/progress/quiz`, which recomputes from canonical JSON and upserts `quiz_attempt`) is **not** what the gate reads. The `quiz_attempt` table (the trustworthy record) is ignored by every unlock/eligibility decision.

**Risk**
A user can skip every knowledge check and fabricate a 100% pass on all 9 checks, unlocking the timed exam and the certificate without earning them. Directly violates the task's requirement: "80%-per-check gate computed server-side from quiz_attempt rows … users cannot … fabricate pass scores."

**Recommendation**
Derive check best-score from `quiz_attempt` rows server-side (e.g., count `is_correct` for the check's question set), or have `POST /api/progress/quiz/run` recompute correctness against the canonical quiz file and refuse client-claimed scores. Do not trust `correct`/`total` from the request body.

---

## Finding 2 — HIGH · Exam timer is client-trusted; "server-side elapsed check" is only a bounds check on a client-supplied value (CWE-602)

**Files**
- `src/app/api/progress/quiz/batch/route.ts:85-96` — validates `elapsedSeconds ∈ [0, 105*60+60]`.
- `src/components/Progress/ExamWidget.tsx:99-103` — client computes `elapsedSeconds = (Date.now() - startedAt)/1000` and sends it.

**Issue**
The batch route's only timer defence is a range check on `elapsedSeconds`, a value **supplied by the client**. The server has no record of when the exam started, so it cannot verify the submitted elapsed time is real. A user can POST with `elapsedSeconds: 0` at any real-world elapsed time (or after pausing / resuming days later) and the server accepts it as valid. Clock tampering is therefore effectively trusted — the "server-side elapsed check" only rejects negative/absurd values.

This is the acknowledged ADR-103 tradeoff ("not foolproof — flagged for val-el"), but it does **not** satisfy the task requirement: "exam submit path performs a server-side elapsed-time check so clock tampering is not trusted." It does not.

**Risk**
The 105-minute timer is fully client-enforced. A determined user gets unlimited time / resumable pauses on the exam.

**Recommendation**
Issue a server-side exam start (signed token or a `quiz_run`/`exam_session` row recording `started_at` when the exam loads) and on submit compare against it; reject when elapsed exceeds 105 min (+grace) regardless of the client value. If a proctored model is out of scope (post-v1), state this explicitly as an accepted residual risk rather than claiming server-side enforcement.

---

## Finding 3 — MEDIUM · Rate limiter is weak against retake abuse (CWE-770 / CWE-307)

**File** `src/lib/api-security.ts:113-145`

**Issue**
`checkRateLimit` is an in-memory, per-IP sliding window: 30 requests/min, keyed by IP from `x-forwarded-for`'s first value. Weaknesses:
- **In-memory only** — resets on every process restart; on Vercel serverless it is not shared across instances, so there is effectively **no global rate limit**.
- **IP-spoofable** — `getClientIp` trusts the first `x-forwarded-for` value; on hosts not stripping it (localhost, some reverse proxies) an attacker can rotate the header to bypass.
- **30/min is ample for retakes** — a batch exam submit is 1 request, so 30 retakes/min per IP (or 30 run-forge requests) are permitted; unlimited retakes by design make this a bounded-but-generous allowance.

**Risk**
Does not meaningfully bound retake abuse or API flood across instances / spoofed IPs. The requirement "retake abuse bounded by rate limiting" is only weakly met.

**Recommendation**
Rate limit on `user_id` for authed calls (fall back to IP for guests), lower the per-user window for exam submits, and/or move to a shared store (e.g., Supabase/Upstash) for multi-instance consistency. At minimum, stop trusting the first `x-forwarded-for` value.

---

## Finding 4 — LOW · Lesson completion is client-forgeable → certificate eligibility trust (CWE-807)

**File** `src/app/api/progress/lesson/route.ts:71-78`

**Issue**
`POST /api/progress/lesson` upserts a `lesson_completion` row for any `lessonSlug` the client sends, with no server-side check that the lesson actually exists or was read. Certificate eligibility counts these rows toward "all {totalLessons} lessons." A user can mark all 46 lessons complete without reading them. (Reading the exam requires passing checks, so the certificate still requires a real exam ≥72 — the exam score itself comes from the server-computed batch route.)

**Risk**
Bypasses the lesson-completion component of the certificate gate. Lower impact than Finding 1 but part of the same "unlock integrity" surface.

**Recommendation**
Validate `lessonSlug` against the known lesson set for the series and/or derive completion from server-observable activity (e.g., `read_progress` with a minimum dwell). At minimum scope the certificate lesson count to the series' known lesson set (already partly done via `getSeriesLessonSlugs`).

---

## What PASSES

- `POST /api/progress/quiz` (single attempt) **recomputes correctness server-side** from canonical JSON and never trusts client `isCorrect` — good (F3).
- `POST /api/progress/quiz/batch` (exam) **recomputes every answer server-side**, validates every `questionIndex`/`userAnswerIndex`, rejects duplicates, and only then inserts `quiz_attempt` + `quiz_run` — good (F3, ADR-102).
- Input validation (slug/quiz-name/index) is robust: `validateQuizName` allows colons but rejects dots/slashes/spaces → no path traversal; `validateIndex` bounds all indexes.
- Origin/CSRF check present on all POST routes; unauthenticated users get `unauthenticated` (no data written).
- Guest gating (ADR-104) is server-side; question JSON never ships to guests.
- RLS policies are `TO authenticated` scoped to `auth.uid() = user_id` with explicit `WITH CHECK` (003_security_hardening.sql) — no cross-user data access.

---

## Summary

| # | Severity | CWE | Area | Status |
|---|---|---|---|---|
| 1 | Critical | CWE-807 | Unlock gate trusts client-forgeable `quiz_run` scores | FAIL |
| 2 | High | CWE-602 | Timer bound is a client-supplied value, not a real server check | FAIL |
| 3 | Medium | CWE-770/307 | In-memory per-IP rate limiter, spoofable & non-shared | PARTIAL |
| 4 | Low | CWE-807 | Lesson completion forgeable → certificate | PARTIAL |
