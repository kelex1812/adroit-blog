/**
 * route.test.ts — GET /api/progress/quiz/tiers canonical coverage (t_55105899 F2).
 *
 * Regression test for the exam-unlock forgery: a user who answers only SOME
 * questions on a knowledge check (all correct) must NOT derive a 100% score
 * from quiz_attempt rows. The route scores against the canonical question
 * count per quiz (mirror run/route.ts:90), so partial attempt sets yield
 * bestScore 0 / passed false / unlocked false.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mocks } = vi.hoisted(() => {
  const getSupabaseServerClient = vi.fn();
  const getUser = vi.fn();
  const from = vi.fn();
  return {
    mocks: { getSupabaseServerClient, getUser, from },
  };
});

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: async () => ({
    auth: { getUser: mocks.getUser },
    from: mocks.from,
  }),
}));

import { GET } from "./route";

function get(series: string): Promise<Response> {
  return GET(new NextRequest(`http://localhost:3000/api/progress/quiz/tiers?series=${series}`));
}

/** Chainable fake: one table, returning rows for a single .in() query. */
function makeFrom(table: string, rows: unknown) {
  if (table === "lesson_completion") {
    return {
      select: () => ({
        eq: () => ({
          in: async () => ({ data: rows, error: null }),
        }),
      }),
    };
  }
  if (table === "quiz_attempt" || table === "quiz_run") {
    return {
      select: () => ({
        eq: () => ({
          in: async () => ({ data: rows, error: null }),
        }),
      }),
    };
  }
  return {};
}

function authedUser(id = "user-1") {
  mocks.getUser.mockResolvedValue({ data: { user: { id } } });
}

function guest() {
  mocks.getUser.mockResolvedValue({ data: { user: null } });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.from.mockImplementation((table: string) => makeFrom(table, []));
});

describe("GET /api/progress/quiz/tiers — canonical coverage (t_55105899)", () => {
  it("does NOT pass a check when only 8 of its canonical 15 questions are graded (all correct)", async () => {
    authedUser();
    // check:1 has 15 canonical questions; only 8 have quiz_attempt rows —
    // all correct. Without the coverage guard this derived 8/8 = 100% and
    // unlocked the exam.
    const partialRows = Array.from({ length: 8 }, (_, i) => ({
      quiz_name: "omni-studio-cert:check:1",
      question_index: i,
      is_correct: true,
    }));
    mocks.from.mockImplementation((table: string) => makeFrom(table, table === "quiz_attempt" ? partialRows : []));

    const res = await get("omni-studio-cert");
    expect(res.status).toBe(200);
    const json = await res.json();
    const check1 = json.checks.find((c: { n: number }) => c.n === 1);
    expect(check1.bestScore).toBe(0);
    expect(check1.passed).toBe(false);
    expect(json.unlocked).toBe(false);
  });

  it("passes a check only when the graded set covers all 15 canonical questions", async () => {
    authedUser();
    const fullRows = Array.from({ length: 15 }, (_, i) => ({
      quiz_name: "omni-studio-cert:check:1",
      question_index: i,
      is_correct: i !== 14, // 14/15 correct → 93%
    }));
    mocks.from.mockImplementation((table: string) => makeFrom(table, table === "quiz_attempt" ? fullRows : []));

    const res = await get("omni-studio-cert");
    const json = await res.json();
    const check1 = json.checks.find((c: { n: number }) => c.n === 1);
    expect(check1.bestScore).toBe(93);
    expect(check1.passed).toBe(true);
  });

  it("does NOT mark the exam passed from a partial exam attempt set (40 of 60, all correct)", async () => {
    authedUser();
    // The certificate forgery: 40 known-correct exam answers must NOT derive
    // as 40/40 = 100% >= 72. quiz_attempt has 40 rows for omni-studio-cert:exam.
    const partialExam = Array.from({ length: 40 }, (_, i) => ({
      quiz_name: "omni-studio-cert:exam",
      question_index: i,
      is_correct: true,
    }));
    mocks.from.mockImplementation((table: string) => makeFrom(table, table === "quiz_attempt" ? partialExam : []));

    const res = await get("omni-studio-cert");
    const json = await res.json();
    expect(json.exam.bestScore).toBe(0);
    expect(json.exam.passed).toBe(false);
  });

  it("marks the exam passed for a full-coverage set scoring >= 72 (54 of 60 correct)", async () => {
    authedUser();
    const fullExam = Array.from({ length: 60 }, (_, i) => ({
      quiz_name: "omni-studio-cert:exam",
      question_index: i,
      is_correct: i < 54, // 54/60 = 90%
    }));
    mocks.from.mockImplementation((table: string) => makeFrom(table, table === "quiz_attempt" ? fullExam : []));

    const res = await get("omni-studio-cert");
    const json = await res.json();
    expect(json.exam.bestScore).toBe(90);
    expect(json.exam.passed).toBe(true);
  });

  it("returns zeros for guests (no data leak)", async () => {
    guest();
    const res = await get("omni-studio-cert");
    const json = await res.json();
    expect(json.unlocked).toBe(false);
    expect(json.exam.bestScore).toBe(0);
  });

  it("reports lessons.total as the PLANNED lesson set (46), not published (9), for tier series", async () => {
    // QA t_1d04b259 F2 / US-006 AC1: the rollup denominator is the
    // generator's planned per-lesson question files (46), matching the
    // certificate page — not s.totalLessons (9 today, build-learn.js tracks
    // published MDX). Guest path exercises emptyTierProgress.
    guest();
    const res = await get("omni-studio-cert");
    const json = await res.json();
    expect(json.lessons.total).toBe(46);
  });

  it("reports lessons.total as the planned set (46) for authed users with no rows yet", async () => {
    authedUser();
    const res = await get("omni-studio-cert");
    const json = await res.json();
    expect(json.lessons.total).toBe(46);
    expect(json.lessons.completed).toBe(0);
  });

  it("keeps s.totalLessons for non-tier series (no planned question files)", async () => {
    guest();
    const res = await get("agentic-ai");
    const json = await res.json();
    // agentic-ai has no content/learn/agentic-ai/questions/ → fall back to
    // the series' totalLessons (10 lessons published in src/data/learn.ts).
    expect(json.lessons.total).toBe(10);
    expect(json.checks).toEqual([]);
  });
});
