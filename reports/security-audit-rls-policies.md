# Security Audit — RLS Policies on Blog Progress / Quizzes Tables

**Task:** t_ea38d052 · **Tenant:** adroit-blog · **Auditor:** Val-El (security-workflow)
**Scope:** Row Level Security on all Supabase tables storing blog user progress and quiz data
**Source of truth:** `supabase/migrations/001_create_progress_tables.sql` (only migration; no other SQL in repo)
**Verdict:** PASS on core RLS posture — 1 MEDIUM (abuse surface), 4 LOW hardening items, 2 INFO. No missing RLS, no overly permissive policies, no unauthenticated access, no cross-user bypass found.

---

## 1. Table & Policy Inventory

Relevant tables (all progress/quizzes data lives here — confirmed via `src/app/api/progress/*` routes and `src/lib/hooks/*`):

| Table | RLS enabled | Policies | Line (migration) |
|---|---|---|---|
| `read_progress` | YES (line 54) | 4 (SELECT/INSERT/UPDATE/DELETE) | 56–70 |
| `lesson_completion` | YES (line 73) | 4 (SELECT/INSERT/UPDATE/DELETE) | 75–89 |
| `quiz_attempt` | YES (line 92) | 4 (SELECT/INSERT/UPDATE/DELETE) | 94–108 |

All 12 policies gate on `auth.uid() = user_id`:

- SELECT — `USING (auth.uid() = user_id)`
- INSERT — `WITH CHECK (auth.uid() = user_id)`
- UPDATE — `USING (auth.uid() = user_id)` (no explicit WITH CHECK — safe, see F2)
- DELETE — `USING (auth.uid() = user_id)`

### Verified PASS
1. RLS enabled on every progress/quizzes table — no table is exposed without RLS.
2. No policy grants unauthenticated (anon) reads/writes: `auth.uid()` is NULL for anon, so all 12 policies deny anon on every command.
3. No cross-user access: every USING/WITH CHECK expression is a strict equality on `auth.uid()`; no `OR`, no `to service_role`, no `true` policies, no owner-bypass shortcuts.
4. App never bypasses RLS: only anon-key clients are used (`src/lib/supabase/client.ts` browser singleton, `src/lib/supabase/server.ts` cookie-bound SSR client). Zero `service_role` key usage in `src/`. Server routes bind `user_id` from `supabase.auth.getUser()` (server-validated JWT), never from the client body.
5. UPDATE-without-WITH-CHECK is NOT a bypass: PostgreSQL applies the `USING` expression as the `WITH CHECK` for UPDATE policies when `WITH CHECK` is omitted (verified against postgresql.org/docs/current/sql-createpolicy.html). A user cannot re-target their own row to another `user_id`.

---

## 2. Findings

### F1 — MEDIUM — `quiz_attempt`: INSERT policy permits unbounded self-scoped inserts (storage abuse)
- **Table:** `quiz_attempt`
- **Policy:** `Users can insert their own quiz attempts` (migration line 98–100)
- **CWE-770 (Allocation of Resources Without Limits) · OWASP A04**
- **Issue:** The INSERT policy is RLS-correct (own data only), but `quiz_attempt` is insert-only with **no unique/dedupe constraint** (table def lines 35–44 has only per-user indexes) and no request bounds. `/api/progress/quiz/route.ts` persists every POST verbatim. An authenticated user can POST unlimited rows with arbitrary `quiz_name`/`question_index` values — the DB grows without bound.
- **Risk:** DB bloat / storage-cost abuse by any authenticated user; unbounded rows degrade future reporting on this table.
- **Remediation:** Add `UNIQUE (user_id, quiz_name, question_index)` and switch the route to upsert (`ON CONFLICT DO UPDATE`), or store a single latest-attempt row per question. Add input bounds (slug length/charset) and rate limiting on `/api/progress/*`.

### F2 — LOW — All 3 tables: UPDATE policies omit explicit `WITH CHECK`
- **Tables:** `read_progress`, `lesson_completion`, `quiz_attempt`
- **Policies:** `Users can update their own …` (read_progress line 64–66, lesson_completion 83–85, quiz_attempt 102–104)
- **CWE-693 (Protection Mechanism Failure, hardening) · OWASP A05**
- **Issue:** No `WITH CHECK` clause. Safe today — PostgreSQL falls back to the `USING` expression for new-row checks, so `user_id` cannot be retargeted. But the guarantee is implicit and fragile: a future edit that loosens `USING` (e.g., adds shared-content visibility) silently widens the write surface with no separate new-row guard, and reviewers cannot distinguish intent.
- **Risk:** Maintainability-driven regression, not an exploitable flaw today.
- **Remediation:** Repeat the check explicitly on each UPDATE policy: `WITH CHECK (auth.uid() = user_id)`.

### F3 — LOW — All 12 policies apply to PUBLIC (no `TO authenticated`)
- **Tables:** `read_progress`, `lesson_completion`, `quiz_attempt`
- **Policies:** all 12 (migration lines 56–108)
- **CWE-732 (Incorrect Permission Assignment, hardening) · OWASP A01**
- **Issue:** No `TO` role clause, so policies default to `PUBLIC`. Not exploitable — the `auth.uid() = user_id` expression still denies anon. But the Supabase hardening convention is explicit `TO authenticated`; PUBLIC-scoped policies widen the blast radius of any future expression edit (e.g., adding `OR …` for a public feature would immediately expose data to anon).
- **Risk:** Accidental future exposure via a too-broad policy edit.
- **Remediation:** Add `TO authenticated` to all 12 `CREATE POLICY` statements.

### F4 — LOW — `user_id` has no foreign key to `auth.users`
- **Tables:** `read_progress` (line 10), `lesson_completion` (line 24), `quiz_attempt` (line 37)
- **Policy:** n/a — schema-level referential integrity
- **CWE-404 (Improper Resource Shutdown, data hygiene) · OWASP A05**
- **Issue:** `user_id uuid NOT NULL` with no `REFERENCES auth.users(id)`. RLS still protects the data (scoped by uid), but rows survive user deletion as orphans and a client bug could persist a `user_id` that matches no auth user (self-inflicted only — RLS prevents writing others' IDs).
- **Risk:** Orphaned data accumulation; no cascade cleanup on account deletion.
- **Remediation:** Add `REFERENCES auth.users(id) ON DELETE CASCADE` on the three columns (or a periodic cleanup job).

### F5 — INFO — `FORCE ROW LEVEL SECURITY` not set
- **Tables:** all three (migration lines 54, 73, 92)
- **Policy:** n/a — table-owner behavior
- **Issue:** Table owner (`postgres`) bypasses RLS unless `FORCE ROW LEVEL SECURITY` is set. Standard Supabase practice does not set FORCE; the app never connects as owner, so this is expected, not a defect.
- **Remediation:** No action. Set FORCE only if a server-side role must be constrained by the same policies.

### F6 — INFO — Live `pg_policies` dump not performed — deployed-state verification outstanding
- **Tables:** all three
- **Policy:** n/a — verification step
- **Issue:** The local Supabase stack was not running (port 54322 not listening) and no DB credentials were available, so the audit is against the committed migration (the repo's canonical RLS definition). Deployed-state drift (policies added/changed outside migrations) cannot be ruled out from the repo alone.
- **Remediation:** On the linked project, verify deployed state matches the migration: `supabase db lint` (against a running stack) and/or `SELECT tablename, policyname, cmd, qual, with_check FROM pg_policies;` in the Supabase SQL editor.

---

## 3. Summary

| Severity | Count | Items |
|---|---|---|
| Critical | 0 | — |
| High | 0 | — |
| Medium | 1 | F1 (quiz_attempt unbounded inserts) |
| Low | 4 | F2 (UPDATE WITH CHECK), F3 (PUBLIC role), F4 (FK), F5+… (see below) |
| Info | 2 | F5 (FORCE RLS), F6 (live verification) |

**OWASP Categories Affected:** 3 of 10 (A04 — F1, A05 — F2/F4, A01 — F3).

**Bottom line:** RLS is correctly implemented across all blog progress/quizzes tables. Every policy is scoped to `auth.uid() = user_id`; anon is denied everywhere; the app never bypasses RLS. No missing RLS, no overly permissive policies, no cross-user access. The MEDIUM finding is a resource-abuse surface (unbounded self-scoped inserts), already routed for remediation via the parent audit (t_3bbee885 → fix task body F2: unique constraint + rate limiting). The LOW items are hardening/defense-in-depth; none are exploitable today.

*Audited by Val-El (security-workflow) · source read: supabase/migrations/001_create_progress_tables.sql, 4 API progress routes, supabase clients (server + browser), 2 client hooks · PostgreSQL RLS semantics verified against official docs (UPDATE policy WITH CHECK fallback).*
