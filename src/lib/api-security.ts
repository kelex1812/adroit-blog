/**
 * Shared API security helpers for progress routes.
 *
 * Aggregates input validation, rate limiting, origin checks, and
 * standardised error handling so every POST route applies the same
 * defences (F2, F3, F5, F6 from security audit t_3bbee885).
 */
import { NextRequest } from "next/server";

/* ------------------------------------------------------------------ */
/*  Input validation (F2)                                              */
/* ------------------------------------------------------------------ */

const SLUG_MAX = 200;
// Kebab/snake-case slugs only — no dots, slashes, or path separators
// (blocks `../` traversal and any encoded path tricks).
const SLUG_RE = /^[a-zA-Z0-9_-]+$/;
// Tier quiz names carry colons: `<series>:lesson:<slug>` / `:check:<n>` /
// `:exam` (ADR-101). Colon allowed, still no dots/slashes/spaces.
const QUIZ_NAME_RE = /^[a-zA-Z0-9:_-]+$/;
// Canonical namespaced content slug, e.g. `blog/<slug>` / `lesson/<slug>`
// (ADR-002 storage form — localStorage keys, DB content_slug, and the
// summary merge all use the prefixed form). One fixed namespace + one
// bare slug: still no `..`, no dots, no extra slashes → path traversal
// stays blocked (F2).
const NAMESPACED_SLUG_RE = /^(blog|lesson)\/[a-zA-Z0-9_-]+$/;

export interface ValidateSlugOptions {
  /**
   * Accept the canonical namespaced form `blog/<slug>` / `lesson/<slug>`
   * in addition to the bare slug form. Used by contentSlug on the read
   * API; lessonSlug / quizName stay strict (bare only).
   */
  allowNamespaced?: boolean;
}

/**
 * Validate a slug (contentSlug / lessonSlug / quizName).
 * Returns a human-readable message string on failure, or `null` on pass.
 */
export function validateSlug(
  value: unknown,
  label: string,
  options?: ValidateSlugOptions,
): string | null {
  if (typeof value !== "string" || value.length === 0) {
    return `${label} is required`;
  }
  if (value.length > SLUG_MAX) {
    return `${label} must be ${SLUG_MAX} characters or fewer`;
  }
  const ok = options?.allowNamespaced
    ? SLUG_RE.test(value) || NAMESPACED_SLUG_RE.test(value)
    : SLUG_RE.test(value);
  if (!ok) {
    return `${label} contains invalid characters`;
  }
  return null;
}

/**
 * Validate a tier quiz name (`<series>:lesson:<slug>` / `:check:<n>` /
 * `:exam`, ADR-101). Colon allowed; dots/slashes/spaces still rejected so the
 * value can never reach a filesystem join or a path traversal.
 * Returns a message string on failure, or `null` on pass.
 */
export function validateQuizName(
  value: unknown,
  label: string,
): string | null {
  if (typeof value !== "string" || value.length === 0) {
    return `${label} is required`;
  }
  if (value.length > SLUG_MAX) {
    return `${label} must be ${SLUG_MAX} characters or fewer`;
  }
  if (!QUIZ_NAME_RE.test(value)) {
    return `${label} contains invalid characters`;
  }
  return null;
}

/**
 * Validate an integer index (questionIndex / userAnswerIndex).
 * Returns a message string on failure, or `null` on pass.
 */
export function validateIndex(
  value: unknown,
  label: string,
  max: number,
): string | null {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return `${label} must be an integer`;
  }
  if (value < 0) {
    return `${label} must be 0 or greater`;
  }
  if (value >= max) {
    return `${label} is out of range`;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  In-memory rate limiter (F2)                                        */
/* ------------------------------------------------------------------ */

/**
 * Simple sliding-window rate limiter keyed by IP.
 * Resets its own map on every call; GC-friendly for moderate traffic.
 * Not persisted — restarts with the process (acceptable for a blog).
 */
const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 30;  // per minute per IP

interface Bucket {
  timestamps: number[];
}

const buckets = new Map<string, Bucket>();

/** Returns `true` if the request is allowed, `false` if rate-limited. */
export function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  let bucket = buckets.get(ip);
  if (!bucket) {
    bucket = { timestamps: [] };
    buckets.set(ip, bucket);
  }
  // Prune entries older than the window
  const cutoff = now - WINDOW_MS;
  bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);
  if (bucket.timestamps.length >= MAX_REQUESTS) {
    return false;
  }
  bucket.timestamps.push(now);
  return true;
}

/** Extract client IP from a NextRequest. */
export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "127.0.0.1";
}

/* ------------------------------------------------------------------ */
/*  Origin/CSRF check (F6)                                             */
/* ------------------------------------------------------------------ */

const ALLOWED_ORIGINS = new Set([
  "https://adroit.io",
  "https://www.adroit.io",
  "https://adroit-blog.vercel.app",
  "http://localhost:3000",
]);

/**
 * Check the `Origin` header if present.
 * Returns a message on failure, or `null` on pass.
 */
export function checkOrigin(req: NextRequest): string | null {
  const origin = req.headers.get("origin");
  if (!origin) return null; // no Origin → direct browser navigation
  if (ALLOWED_ORIGINS.has(origin)) return null;
  return "Forbidden origin";
}

/* ------------------------------------------------------------------ */
/*  Error helpers (F5)                                                 */
/* ------------------------------------------------------------------ */

/**
 * Log a Supabase error server-side and return a sanitised client message.
 * Call this inside the error branch of a Supabase write so the client
 * never sees table/schema/constraint details.
 */
export function sanitiseDbError(error: { message?: string }): string {
  // Log the real error server-side
  console.error("[DB]", error?.message ?? "unknown database error");
  return "Failed to save progress";
}