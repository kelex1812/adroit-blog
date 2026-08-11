/**
 * route.test.ts — POST /api/progress/quiz/run (security t_7469e31d F1).
 *
 * Regression tests for CWE-345 (client-supplied correctness): the client's
 * `correct`/`total` must NEVER reach a DB write. The run's
 * correct/total/score are recomputed server-side from the server-graded
 * `quiz_attempt` rows, and a run is only recorded when the graded attempt
 * set covers the canonical question count — so 9 forged POSTs can't
 * fabricate an 80% check (exam unlock) or a 100% exam (certificate).
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

import { POST } from "./route";

const CHECK_QUIZ = "omni-studio-cert:check:1"; // canonical: 15 questions

function post(body: Record<string, unknown>): Promise<Response> {
  return POST(
    new NextRequest("http://localhost:3000/api/progress/quiz/run", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "10.0.0.10" },
      body: JSON.stringify(body),
    }),
  );
}

const writeSink = { quizRunInserts: [] as unknown[] };

/** Chainable fake: quiz_attempt select().eq().eq() → attemptRows; quiz_run insert → sink. */
function makeFrom(table: string, attemptRows: unknown) {
  if (table === "quiz_attempt") {
    return {
      select: () => ({
        eq: () => ({
          eq: async () => ({ data: attemptRows, error: null }),
        }),
      }),
    };
  }
  if (table === "quiz_run") {
    return {
      insert: async (row: unknown) => {
        writeSink.quizRunInserts.push(row);
        return { error: null };
      },
    };
  }
  return {};
}

function authedUser(id = "user-1") {
  mocks.getUser.mockResolvedValue({ data: { user: { id } } });
}

beforeEach(() => {
  vi.clearAllMocks();
  writeSink.quizRunInserts.length = 0;
  mocks.from.mockImplementation((table: string) => makeFrom(table, []));
});

describe("POST /api/progress/quiz/run — server-side scoring (F1)", () => {
  it("requires quizName", async () => {
    const res = await post({});
    expect(res.status).toBe(400);
    expect(writeSink.quizRunInserts).toHaveLength(0);
  });

  it("returns unauthenticated without querying attempts or writing a run", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    const res = await post({ quizName: CHECK_QUIZ, correct: 15, total: 15 });
    expect(res.status).toBe(200);
    expect((await res.json()).status).toBe("unauthenticated");
    expect(writeSink.quizRunInserts).toHaveLength(0);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("records a run scored from graded quiz_attempt rows, ignoring forged client correct/total", async () => {
    authedUser();
    // 15 graded answers, 14 correct (question 14 wrong) → 93%.
    const rows = Array.from({ length: 15 }, (_, i) => ({
      question_index: i,
      is_correct: i !== 14,
    }));
    mocks.from.mockImplementation((table: string) => makeFrom(table, rows));

    // Client lies: claims 15/15 (100%) — must be ignored.
    const res = await post({ quizName: CHECK_QUIZ, correct: 15, total: 15 });
    expect(res.status).toBe(200);
    expect(writeSink.quizRunInserts).toHaveLength(1);
    expect(writeSink.quizRunInserts[0]).toMatchObject({
      user_id: "user-1",
      quiz_name: CHECK_QUIZ,
      correct: 14,
      total: 15,
      score: 93,
    });
  });

  it("does NOT record a run when the graded attempt set is incomplete (total != canonical count)", async () => {
    authedUser();
    // Only 10 of the canonical 15 questions have graded attempts → the run
    // would under-report total and must not be recorded.
    const rows = Array.from({ length: 10 }, (_, i) => ({
      question_index: i,
      is_correct: true,
    }));
    mocks.from.mockImplementation((table: string) => makeFrom(table, rows));

    const res = await post({ quizName: CHECK_QUIZ, correct: 10, total: 10 });
    expect(res.status).toBe(200);
    expect(writeSink.quizRunInserts).toHaveLength(0);
  });

  it("treats an unknown quiz with no graded attempts as client-only (no run row)", async () => {
    authedUser();
    mocks.from.mockImplementation((table: string) => makeFrom(table, []));

    const res = await post({ quizName: "no-such-series:check:1", correct: 5, total: 5 });
    expect(res.status).toBe(200);
    expect(writeSink.quizRunInserts).toHaveLength(0);
  });
});
