# Security Audit — Supabase Auth & Session Handling (Blog)

**Task:** t_4ee14a75 · **Tenant:** adroit-blog · **Auditor:** Val-El (security-workflow)
**Scope:** Supabase auth settings, client/server Supabase initialization, session validation + ownership checks on progress/quizzes API routes, hardcoded secrets / exposed service keys.
**Verdict:** NEEDS_REVISION (core auth posture PASS — no cross-user or unauthenticated access found; hardening items remain)
**Critical:** 0 | **High:** 0 | **Medium:** 1 | **Low:** 4 | **Info:** 3
**OWASP Categories Affected:** 4 of 10 (A07, A04, A05, A01)

> Note: a steel fix task (t_c7f51ff6) is concurrently applying the parent audit's F1–F7 fixes in this workspace. Findings below reflect the **current on-disk state** at audit time (all three POST routes already hardened with origin checks, rate limiting, slug validation, sanitised errors; next@16.3.0; CSP+HSTS added; quiz correctness recomputed server-side).

---

## 1. Acceptance Criteria — Results

| Criterion | Result | Evidence |
|---|---|---|
| Inspect Supabase auth settings (providers, JWT expiry, email verification) | **PASS** | `supabase/config.toml`: `jwt_expiry = 3600`, `enable_refresh_token_rotation = true`, `[auth.email] enable_confirmations = true`, all OAuth providers disabled (`[auth.external.*] enabled = false`) — only email+password auth. Auth-endpoint rate limits configured (`sign_in_sign_ups = 30/5min`, `token_refresh = 150/5min`, etc.) |
| Client init uses anon key + RLS, never service_role | **PASS** | `src/lib/supabase/client.ts` + `server.ts` both use `NEXT_PUBLIC_SUPABASE_ANON_KEY` only. Zero `service_role` usage in `src/` (grep). RLS enabled on all 3 tables (migration 001 lines 54/73/92), all 12 policies scoped `auth.uid() = user_id` |
| API routes / middleware / server actions: session validation + ownership | **PASS (with gap)** | All 4 progress routes call `supabase.auth.getUser()` (server-validated JWT, not `getSession()`), bind `user_id` from session, never from body. No IDOR. No server actions. **Gap:** no `middleware.ts`/`proxy.ts` — session refresh happens only inside route handlers (see F3) |
| Scan for hardcoded secrets / exposed service keys | **PASS (with finding)** | `.env.local` gitignored (root + `supabase/.gitignore`), contains only URL + anon key. No service keys anywhere. `npm audit`: **0 vulnerabilities** (next@16.3.0). **Finding:** `scripts/update-supabase-auth.py` misuses the anon key against an admin endpoint (F1) |

---

## 2. Findings

### F1 — MEDIUM — Dev script calls Supabase Admin endpoint with the anon key and asserts a false security property
**CWE-798 (Use of Hard-coded Credentials, latent) · OWASP A07**
**File:** `scripts/update-supabase-auth.py` (lines 21-47) — tracked in git

The script reads `NEXT_PUBLIC_SUPABASE_ANON_KEY` from `.env.local` and sends it as `apikey`/`Bearer` to `https://zrggxfdyptiahskogwnn.supabase.co/auth/v1/admin/settings` (a GoTrue **admin** endpoint). The comment on line 21 claims: *"The anon key can be used as the service_role key for admin endpoints"* — that is false. Admin endpoints require the `service_role` key (or a JWT with elevated claims).

**Affected flow:** Local dev tooling only — the script is not in `package.json` scripts or any CI, so it never runs in production.
**Risk:** Today the call fails with 401/403 (harmless). The danger is the pattern: (a) the false comment normalizes treating an app-level key as an admin credential, and (b) if a developer "fixes" the script by substituting a real `service_role` key, an admin-capable secret is now being loaded into a tracked repo file and sent to an endpoint over plain HTTP library calls — one miscommit away from exposure. If the anon key were ever minted with elevated claims (JWT misconfig), this script would silently perform admin config changes.
**Recommendation:** Delete the script or rewrite it to (1) read a real `SUPABASE_SERVICE_ROLE_KEY` (or better, `SUPABASE_ACCESS_TOKEN`) from the environment only — never from a tracked file, (2) fix the comment, and (3) fail closed if the key looks like an anon/public key.

---

### F2 — LOW — `validateSlug` allows `/` and `.`; `quizName` flows into a filesystem path join
**CWE-22 (Path Traversal, latent) · OWASP A03**
**Files:** `src/lib/api-security.ts` (line 15, `SLUG_RE = /^[a-zA-Z0-9_/.-]+$/`), `src/app/api/progress/quiz/route.ts` (line 61 `getQuizForSeries(quizName)`), `src/lib/quiz.ts` (line 23 `path.join(process.cwd(), "content", series, "questions.json")`)

`validateSlug` permits `/` and `.` (and `..` by composition). For `read`/`lesson` routes the value only reaches the DB (parameterized) — benign. But on the quiz route `quizName` is joined into a filesystem path (`content/<quizName>/questions.json`), so a crafted value like `../../../any-dir` changes the directory the server probes.

**Affected flow:** POST `/api/progress/quiz` (authenticated).
**Risk:** Low today — the file read is parsed as JSON and any failure returns a generic `ok`/`400`; no file contents are ever reflected to the client. Worst case an attacker probes for the existence of JSON files by directory layout. Still, input that reaches a filesystem path should not accept path separators.
**Recommendation:** Tighten the slug charset to `^[a-zA-Z0-9_-]+$` (no `/` or `.`) for values that enter filesystem paths, or validate `quizName` against the known series list (`src/data/learn.ts`) before the path join.

---

### F3 — LOW — No middleware/proxy for session refresh (latent, blocks future protected pages)
**CWE-613 (Insufficient Session Expiration, latent) · OWASP A07**
**File:** repo root — no `middleware.ts` / `proxy.ts` present

`@supabase/ssr` cookie-bound clients (server.ts) refresh an expired access token only when a **route handler** calls `auth.getUser()` (cookies are writable there). With no middleware, server components and statically-gated pages cannot refresh an expired session — a user whose access token has expired (1h TTL) would silently degrade to "guest" on navigation until they hit a progress API.

**Affected flow:** Session lifecycle on the blog (all protected data today flows through the 4 progress routes, so no live breakage).
**Risk:** Low today — the only session-gated data is read via the API routes, which do refresh. Becomes a real issue the moment a protected server component or per-user SSR page is added.
**Recommendation:** Add a Next.js `middleware.ts` (or Next 16 `proxy.ts`) that refreshes the Supabase session cookie on navigation, per the `@supabase/ssr` reference pattern. Also consider `[auth.sessions] timebox / inactivity_timeout` in config.toml for absolute session limits.

---

### F4 — LOW — Weak password policy + localhost in production redirect allowlist
**CWE-521 (Weak Password Requirements) · OWASP A07**
**File:** `supabase/config.toml` (lines 186-190, 163-168)

`minimum_password_length = 6` with empty `password_requirements` (no letters/digits/symbol composition rule). `additional_redirect_urls` includes `http://localhost:3000` in the committed prod config (redirect-allowlist hygiene — not exploitable, allowlist is exact-match, but localhost entries belong in a dev-only config).
**Affected flow:** Email/password signup + post-auth redirect.
**Risk:** Low — password brute-force is throttled by `sign_in_sign_ups` rate limit and email confirmation is required; redirect list is an exact-match allowlist so no open redirect. 6-char passwords are still weak if the auth surface ever gets a login UI.
**Recommendation:** Raise to `minimum_password_length = 8` + `password_requirements = "lower_upper_letters_digits"`; remove `http://localhost:3000` from the committed prod redirects (or split dev/prod configs). *(Already tracked — F7 in the in-flight fix task t_c7f51ff6.)*

---

### F5 — LOW — Rate limiter is in-memory per-process (best-effort on serverless)
**CWE-770 (Allocation of Resources Without Limits, partial) · OWASP A04**
**File:** `src/lib/api-security.ts` (lines 67-99)

The sliding-window limiter stores buckets in a module-level `Map`. On Vercel/serverless each lambda instance has its own map, so 30 req/min/IP is enforced per instance, not per origin; an attacker rotating instances (or spoofing `x-forwarded-for`, which the code trusts as the first entry) can exceed the limit. `getClientIp` takes the first `x-forwarded-for` value, which is client-controllable unless the edge strips it.
**Affected flow:** POST `/api/progress/*` rate limiting.
**Risk:** Low for a blog (progress writes are self-scoped; the DB dedupe from migration 002 caps quiz_attempt growth). Not a bypass of any auth control.
**Recommendation:** Accept + document as best-effort, or move limits to the edge (Vercel/Cloudflare) / Supabase-side. Note `x-forwarded-for` trust assumption in a comment.

---

### Info items

- **I1 — No signup/login UI exists.** `enable_signup = true` with email confirmation on; anyone can create an account via the auth API directly, but the app ships no auth UI, so the authenticated progress-sync path is dormant. Not a vulnerability — call out in docs so the auth investment isn't assumed to be user-visible.
- **I2 — Deployed-state auth settings not verified.** The committed `config.toml` documents intent; the hosted project's live settings (JWT secret, signup toggle, confirmations) can't be confirmed from the repo. Verify with `supabase db lint` / the Dashboard on the linked project (`zrggxfdyptiahskogwnn`).
- **I3 — RLS hardening leftovers** (from RLS audit t_ea38d052, not in the F1–F7 fix body): add explicit `WITH CHECK (auth.uid() = user_id)` on the 12 UPDATE policies, `TO authenticated` on all policies, and `REFERENCES auth.users(id) ON DELETE CASCADE` on the three `user_id` columns. No exploit today.

---

## 3. Summary

| Severity | Count | Items |
|---|---|---|
| Critical | 0 | — |
| High | 0 | — |
| Medium | 1 | F1 (admin-endpoint script misuse) |
| Low | 4 | F2 (slug charset/path join), F3 (no session-refresh middleware), F4 (password policy/redirects), F5 (per-instance rate limiter) |
| Info | 3 | I1 (no auth UI), I2 (deployed-state verify), I3 (RLS hardening) |

**OWASP Categories Affected:** 4 of 10 — A07 (F1, F3, F4), A03 (F2), A04 (F5), A05 (I3).

**Bottom line:** The core acceptance criteria are **met** — no path lets one user read/write another user's progress (RLS `auth.uid()` scoping on all 12 policies + `user_id` bound from the server-validated session), no unauthenticated access to protected endpoints (every route checks `getUser()`; anon denied by RLS), client uses only the anon key, no service keys or hardcoded secrets in the app. The remaining items are hardening/defense-in-depth; F1 (script) is the only one worth scheduling before a login UI ships. Fixes routed via follow-up card.

*Audited by Val-El (security-workflow) · source read: supabase/config.toml, migrations 001+002, 4 progress API routes, src/lib/api-security.ts, supabase clients (server+browser), 3 client hooks, next.config.ts, scripts/update-supabase-auth.py, .env.local (names only), npm audit · concurrent fix task t_c7f51ff6 observed mid-flight.*
