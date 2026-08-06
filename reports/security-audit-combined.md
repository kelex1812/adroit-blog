# Security Review Report — Blog Progress & Quizzes Data

**Task:** t_551b5165 · **Tenant:** adroit-blog · **Auditor:** Val-El (security-workflow)
**Scope:** Combined RLS + auth/session review of the blog's progress/quizzes data (Supabase)
**Sources (completed audits):**
- RLS audit — `reports/security-audit-rls-policies.md` (t_ea38d052)
- Auth & session audit — `reports/security-audit-auth-session.md` (t_4ee14a75)
- Original full audit — `reports/security-audit-progress-rls.md` (t_3bbee885)
**State verified at compile time:** 2026-08-06 (on-disk checks: package.json, migrations, src/lib/api-security.ts, next.config.ts, supabase/config.toml, scripts/)

**Verdict:** NEEDS_REVISION — core posture PASS, 1 MEDIUM + 6 LOW remaining, 0 HIGH. The original HIGH (dependency CVEs) and the two MEDIUMs from the first audit (unbounded quiz_attempt inserts, client-trusted quiz correctness) are **verified fixed** in the current tree.

**Severity summary**

| Severity | Count | Status |
|---|---|---|
| Critical | 0 | — |
| High | 0 | 1 resolved (dependencies) |
| Medium | 1 | open (dev script admin-key misuse); 2 resolved |
| Low | 6 | open; 4 resolved |
| Info | 4 | see §4 |

---

## 1. Findings by Severity

### HIGH

**H1 — RESOLVED — Outdated dependencies with known CVEs (next@16.2.9 / sharp / postcss)**
- **CWE-1104 · OWASP A06** · **File:** `package.json`
- Original: `npm audit` 5 high + 1 moderate — Image Optimization DoS (GHSA-q8wf-6r8g-63ch), cache confusion (GHSA-68g3-v927-f742, GHSA-4633-3j49-mh5q), SSRF in rewrites (GHSA-p9j2-gv94-2wf4), Server Function endpoint disclosure (GHSA-955p-x3mx-jcvp); sharp@0.34.5 libvips CVEs.
- **Verified fixed:** `"next": "16.3.0"` in package.json (2026-08-06). Confirm clean with `npm audit` (0 high) once `npm install` completes in the workspace.

### MEDIUM

**M1 — OPEN — Dev script calls Supabase admin endpoint with the anon key and asserts a false security property**
- **CWE-798 (latent) · OWASP A07** · **File:** `scripts/update-supabase-auth.py` (lines 21–47, comment line 21) — tracked in git
- **Affected flow:** Local dev tooling only; not in `package.json` scripts or CI.
- **Issue:** Sends `NEXT_PUBLIC_SUPABASE_ANON_KEY` as `apikey`/`Bearer` to `…/auth/v1/admin/settings` (GoTrue admin endpoint) and comments *"The anon key can be used as the service_role key for admin endpoints"* — false. It also hardcodes `minimum_password_length: 6` and `http://localhost:3000` in the payload, which would **revert** the config.toml hardening (see L2) if the script ever succeeds.
- **Risk:** Today the call 401s harmlessly. The danger is the pattern: a developer "fixing" it with a real `service_role` key embeds an admin-capable secret in a tracked file; or a JWT misconfig minting elevated anon claims turns the script into a silent admin-config tool.
- **Recommendation:** Delete the script or rewrite it to (1) read `SUPABASE_SERVICE_ROLE_KEY`/`SUPABASE_ACCESS_TOKEN` from the environment only, (2) fix the comment, (3) fail closed if the key looks like an anon/public key, (4) sync payload values (password length, redirects) with config.toml.

**M2 — RESOLVED — `quiz_attempt`: INSERT policy permitted unbounded self-scoped inserts (storage abuse)**
- **CWE-770 · OWASP A04** · **Table:** `quiz_attempt` · **Policy:** `Users can insert their own quiz attempts` (migration 001 lines 98–100)
- **Issue:** Insert-only table, no unique constraint — an authenticated user could POST unlimited rows (DB bloat).
- **Verified fixed:** migration `002_quiz_attempt_unique.sql` adds `UNIQUE INDEX idx_quiz_attempt_user_quiz_question (user_id, quiz_name, question_index)`; the quiz route now upserts; `src/lib/api-security.ts` adds `SLUG_MAX=200` + charset `^[a-zA-Z0-9_-]+$` + rate limiter (30/min/IP).

**M3 — RESOLVED — Server trusted client-supplied quiz correctness**
- **CWE-345 · OWASP A04** · **Auth flow:** POST `/api/progress/quiz`
- **Issue:** `correctAnswerIndex`/`isCorrect` persisted verbatim from client — fabricated scores possible.
- **Verified fixed:** `src/app/api/progress/quiz/route.ts` now validates `questionIndex`/`userAnswerIndex` as ints within bounds and **recomputes** `correctAnswerIndex`/`isCorrect` server-side from canonical `questions.json`.

### LOW

**L1 — OPEN — No middleware/proxy for Supabase session refresh**
- **CWE-613 (latent) · OWASP A07** · **File:** repo root — no `middleware.ts` / `proxy.ts`
- **Affected flow:** Session lifecycle — all protected data today flows through the 4 progress routes, which refresh via `getUser()`; no live breakage.
- **Risk:** Becomes real the moment a protected server component or per-user SSR page is added (expired 1h token → silent "guest" degradation).
- **Recommendation:** Add Next.js `middleware.ts`/`proxy.ts` per the `@supabase/ssr` reference pattern; consider `[auth.sessions] timebox/inactivity_timeout` in config.toml.

**L2 — PARTIALLY OPEN — Weak password policy + localhost in prod redirect allowlist**
- **CWE-521 · OWASP A07** · **Files:** `supabase/config.toml` (lines 163–168, 186–189), `scripts/update-supabase-auth.py` (payload)
- **Affected flow:** Email/password signup + post-auth redirect.
- **Verified fixed in config.toml:** `minimum_password_length = 8`, `password_requirements = "lower_upper_letters_digits"`.
- **Still open:** `update-supabase-auth.py` payload hardcodes `minimum_password_length: 6` and `http://localhost:3000` in `additional_redirect_urls` — running the script would regress the fix. Fix together with M1.

**L3 — OPEN — Rate limiter is in-memory per-process (best-effort on serverless)**
- **CWE-770 (partial) · OWASP A04** · **File:** `src/lib/api-security.ts` (lines 69–101)
- **Affected flow:** POST `/api/progress/*` rate limiting.
- **Issue:** Module-level `Map` per lambda instance; `getClientIp` trusts the first `x-forwarded-for` entry (client-controllable unless the edge strips it). Mitigated for quiz writes by the migration-002 dedupe.
- **Recommendation:** Accept + document as best-effort (recommended for a blog), or move limits to edge (Vercel/Cloudflare)/Supabase. Add a comment on the `x-forwarded-for` trust assumption.

**L4 — OPEN — UPDATE policies omit explicit `WITH CHECK`**
- **CWE-693 (hardening) · OWASP A05** · **Tables:** `read_progress`, `lesson_completion`, `quiz_attempt` · **Policies:** the 3 `Users can update their own …` (migration 001 lines 64–66, 83–85, 102–104)
- **Issue:** Safe today — PG falls back to `USING` for new-row checks, so `user_id` cannot be retargeted. But the guarantee is implicit; a future `USING` loosening silently widens the write surface.
- **Recommendation:** Add explicit `WITH CHECK (auth.uid() = user_id)` to each UPDATE policy.

**L5 — OPEN — All 12 policies apply to PUBLIC (no `TO authenticated`)**
- **CWE-732 (hardening) · OWASP A01** · **Tables:** all 3 · **Policies:** all 12 (migration 001 lines 56–108)
- **Issue:** Not exploitable — `auth.uid() = user_id` still denies anon — but PUBLIC widens the blast radius of any future expression edit.
- **Recommendation:** Add `TO authenticated` to all 12 `CREATE POLICY` statements.

**L6 — OPEN — `user_id` has no foreign key to `auth.users`**
- **CWE-404 · OWASP A05** · **Tables:** `read_progress` (line 10), `lesson_completion` (line 24), `quiz_attempt` (line 37)
- **Issue:** Rows survive user deletion as orphans; no cascade cleanup.
- **Recommendation:** Add `REFERENCES auth.users(id) ON DELETE CASCADE` on the three `user_id` columns (or periodic cleanup job).

**Resolved LOWs (verified at compile time):**
- **F4 (CSP/HSTS)** — `next.config.ts` now sets `Strict-Transport-Security` and `Content-Security-Policy` (lines 51, 55).
- **F5 (Supabase error leak)** — routes return `sanitiseDbError(error)` → generic `"Failed to save progress"`, real error logged server-side (`src/lib/api-security.ts` line 134).
- **F6 (CSRF origin check)** — `checkOrigin()` rejects non-allowlisted `Origin` on POST routes (403); allowlist = adroit.io, www.adroit.io, vercel app, localhost.
- **A-F2 (slug charset / path traversal)** — `SLUG_RE = /^[a-zA-Z0-9_-]+$/` (no `/` or `.`) — `quizName` can no longer inject path separators into `path.join(process.cwd(), "content", …)`.

---

## 2. Affected-Table / Policy / Auth-Flow Map

| Finding | Severity | Table | Policy / Flow | Migration / File |
|---|---|---|---|---|
| M1 | MED | n/a (auth config) | GoTrue admin settings via dev script | `scripts/update-supabase-auth.py:21` |
| M2 (fixed) | MED | `quiz_attempt` | INSERT policy + POST `/api/progress/quiz` | 001:98–100 → 002 unique index |
| M3 (fixed) | MED | `quiz_attempt` | POST `/api/progress/quiz` | `quiz/route.ts` |
| L1 | LOW | n/a (session) | Session refresh lifecycle | repo root (missing middleware) |
| L2 | LOW | n/a (auth config) | Signup password + redirect | `config.toml:163,186` + script |
| L3 | LOW | all 3 | POST `/api/progress/*` rate limit | `api-security.ts:69–101` |
| L4 | LOW | all 3 | UPDATE policies (no WITH CHECK) | 001:64–66, 83–85, 102–104 |
| L5 | LOW | all 3 | All 12 policies PUBLIC | 001:56–108 |
| L6 | LOW | all 3 | `user_id` FK | 001:10, 24, 37 |

---

## 3. Quick Wins (low effort, high value)

1. **Delete or neutralize `scripts/update-supabase-auth.py`** (M1 + half of L2) — one file removal eliminates the admin-key-misuse pattern and the config-reverting payload. Highest value / lowest effort.
2. **Add explicit `WITH CHECK` + `TO authenticated`** (L4 + L5) — three small edits to migration 001 covering all 12 policies; defense-in-depth that future-proofs policy edits.
3. **Add `REFERENCES auth.users(id) ON DELETE CASCADE`** (L6) — schema-level hygiene, prevents orphan accumulation.
4. **Ship a `middleware.ts`** (L1) — the `@supabase/ssr` reference pattern is copy-paste; unblocks future protected SSR pages.
5. **Document the rate limiter as best-effort** (L3) — one comment + README line; zero code change.

---

## 4. Info Items (no action required)

- **I1 (RLS):** `FORCE ROW LEVEL SECURITY` not set — standard Supabase practice; app never connects as table owner.
- **I2 (RLS + auth):** Live `pg_policies` / deployed-state verification outstanding — local Supabase stack not running and no DB creds available; audit is against committed migrations. Verify with `supabase db lint` / `SELECT … FROM pg_policies;` on project `zrggxfdyptiahskogwnn`.
- **I3 (auth):** No signup/login UI ships — the authenticated progress-sync path is dormant (`enable_signup = true`, email confirmations on). Not a vulnerability; note for product.
- **I4 (MDX):** `MDXRemote` renders checked-in content without `rehype-sanitize` — safe while content is authored in-repo; add sanitization before any user-authored/CMS content path (CWE-79 latent).

---

## 5. Compliance & OWASP Considerations

- **OWASP Top 10 (2021) categories affected:** 7 of 10, all low/materiality except A06 which is resolved:
  - A01 Broken Access Control — L5 (PUBLIC policy hardening)
  - A03 Injection — resolved (slug charset); latent MDX (I4)
  - A04 Insecure Design — M2/M3 resolved; L3 partial
  - A05 Security Misconfiguration — L4, L6 (hardening); F4/F5 resolved
  - A06 Vulnerable Components — H1 resolved (next@16.3.0)
  - A07 Identification & Auth Failures — M1 open; L1, L2
- **Access control (A01):** PASS — RLS `auth.uid() = user_id` on all 12 policies, anon denied everywhere, no IDOR (server-bound `user_id` from `getUser()`), no service_role in app code.
- **Data protection:** progress/quizzes data is scoped per-user; no PII collected beyond email (auth); data in transit via HTTPS (Vercel); `config.toml` documents prod URL.
- **AuthN best practices met:** email confirmations required, JWT 1h, refresh-token rotation + reuse interval, Supabase-side rate limits on sign-in/signup/token-refresh.
- **Remaining exposure to close before any login UI ships:** M1 (script), L1 (middleware), L2 (password policy consistency).

---

## 6. Follow-up Fix Task Routing

- **Already created:** `t_a719a31c` — "Security follow-up: auth/session hardening (admin-endpoint script, slug charset, session-refresh middleware, RLS policy hardening)" → assignee **steel**, status **ready**. This card covers M1, L1, L2 (script half), L4, L5, L6 — assign it priority for the quick wins in §3.
- **Not yet carded (recommend adding to t_a719a31c body or a second card):**
  - L3 — rate-limiter documentation note (best-effort acceptance).
  - I2 — deployed-state verification task (could route to devops/alpha for `supabase db lint` + `pg_policies` check on the linked project).
- **Routing rule:** code-level fixes → steel (developer-web); architecture decisions (e.g., moving rate limiting to edge) → brainiac first if it exceeds a bounded code change.

---

*Compiled by Val-El (security-workflow) from t_ea38d052 (RLS audit) + t_4ee14a75 (auth audit) + t_3bbee885 (original audit); current-state claims verified against the workspace tree on 2026-08-06.*
