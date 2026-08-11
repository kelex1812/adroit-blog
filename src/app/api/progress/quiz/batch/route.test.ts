/**
 * route.test.ts — POST /api/progress/quiz/batch exam-unlock gate.
 *
 * Regression test for security audit t_05fad9a9 (OWASP A01 / CWE-285):
 * the exam must be rejected with 403 unless the user has passed EVERY
 * knowledge check (best score >= 80) for the series. Exercises the real
 * route handler with a mocked Supabase client so the unlock predicate and
 * the grading path both run against the real content files.
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

const EXAM_QUIZ_NAME = "omni-studio-cert:exam";

/** A valid exam-submit body (question 0 answered correctly; grading is F3's job). */
function examBody(overrides: Record<string, unknown> = {}) {
  return {
    quizName: EXAM_QUIZ_NAME,
    answers: [{ questionIndex: 0, userAnswerIndex: 1 }], // q0 correct answer is 1
    elapsedSeconds: 30,
    ...overrides,
  };
}

function post(body: Record<string, unknown>): Promise<Response> {
  return POST(
    new NextRequest("http://localhost:3000/api/progress/quiz/batch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}

/** Chainable fake for the write calls the route makes after the gate. */
const writeSink = {
  quizAttemptUpserts: [] as unknown[],
  quizRunInserts: [] as unknown[],
};

function makeFrom(table: string, checkRows: unknown) {
  if (table === "quiz_run") {
    return {
      select: () => ({
        eq: () => ({
          in: async () => ({ data: checkRows, error: null }),
        }),
      }),
      insert: async (row: unknown) => {
        writeSink.quizRunInserts.push(row);
        return { error: null };
      },
    };
  }
  if (table === "quiz_attempt") {
    return {
      upsert: async (rows: unknown) => {
        writeSink.quizAttemptUpserts.push(rows);
        return { error: null };
      },
    };
  }
  return {};
}

function authedUser(id = "user-1") {
  mocks.getUser.mockResolvedValue({ data: { user: { id } } });
}

function unauthenticated() {
  mocks.getUser.mockResolvedValue({ data: { user: null } });
}

beforeEach(() => {
  vi.clearAllMocks();
  writeSink.quizAttemptUpserts.length = 0;
  writeSink.quizRunInserts.length = 0;
  mocks.from.mockImplementation((table: string) => makeFrom(table, []));
});

describe("POST /api/progress/quiz/batch — exam unlock gate", () => {
  it("returns 401 for unauthenticated requests (no gate check runs)", async () => {
    unauthenticated();
    const res = await post(examBody());
    expect(res.status).toBe(401);
    // Must reject before querying check runs.
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("returns 403 unlock-required when the user has no check runs at all", async () => {
    authedUser();
    mocks.from.mockImplementation((table: string) => makeFrom(table, []));
    const res = await post(examBody());
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.status).toBe("unlock-required");
    // Nothing may be written when the exam is locked.
    expect(writeSink.quizAttemptUpserts).toHaveLength(0);
    expect(writeSink.quizRunInserts).toHaveLength(0);
  });

  it("returns 403 unlock-required when any single check is below 80", async () => {
    authedUser();
    const checkRows = [
      { quiz_name: "omni-studio-cert:check:1", score: 95 },
      { quiz_name: "omni-studio-cert:check:2", score: 79 }, // < 80 → locked
      { quiz_name: "omni-studio-cert:check:3", score: 88 },
    ];
    mocks.from.mockImplementation((table: string) => makeFrom(table, checkRows));
    const res = await post(examBody());
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.status).toBe("unlock-required");
    expect(writeSink.quizRunInserts).toHaveLength(0);
  });

  it("accepts the exam when every check best is >= 80 (retakes: best wins)", async () => {
    authedUser();
    const checkRows = [
      { quiz_name: "omni-studio-cert:check:1", score: 100 },
      { quiz_name: "omni-studio-cert:check:1", score: 60 }, // retake below — best is 100
      { quiz_name: "omni-studio-cert:check:2", score: 81 },
      { quiz_name: "omni-studio-cert:check:3", score: 82 },
      { quiz_name: "omni-studio-cert:check:4", score: 83 },
      { quiz_name: "omni-studio-cert:check:5", score: 84 },
      { quiz_name: "omni-studio-cert:check:6", score: 85 },
      { quiz_name: "omni-studio-cert:check:7", score: 86 },
      { quiz_name: "omni-studio-cert:check:8", score: 87 },
      { quiz_name: "omni-studio-cert:check:9", score: 88 },
    ];
    mocks.from.mockImplementation((table: string) => makeFrom(table, checkRows));
    const res = await post(examBody());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.score).toBe(2); // 1/60 correct → 2%
    // The quiz_run write is reached: exam submission recorded after unlock.
    expect(writeSink.quizRunInserts).toHaveLength(1);
    expect(writeSink.quizRunInserts[0]).toMatchObject({
      user_id: "user-1",
      quiz_name: EXAM_QUIZ_NAME,
    });
  });
});
