/**
 * route.test.ts — GET /api/continue-learning (Round 3, t_e0362113).
 *
 * In-progress predicate: series with >=1 distinct completed lesson AND
 * < totalLessons, most-recent-first, resume link = lowest-numbered
 * uncompleted lesson. Guests always get []. Pure derivation is exercised
 * against mocked lesson_completion rows.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mocks } = vi.hoisted(() => {
  const getSupabaseServerClient = vi.fn();
  const getUser = vi.fn();
  const from = vi.fn();
  return { mocks: { getSupabaseServerClient, getUser, from } };
});

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: async () => ({
    auth: { getUser: mocks.getUser },
    from: mocks.from,
  }),
}));

import { GET } from "./route";

const AUTHED = { data: { user: { id: "u1", email: "jane@adroit.io" } } };
const GUEST = { data: { user: null } };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getUser.mockResolvedValue(GUEST);
  mocks.from.mockImplementation(() => ({
    select: () => ({
      eq: () => ({ data: [], error: null }),
    }),
  }));
});

describe("GET /api/continue-learning", () => {
  it("returns [] for guests", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ items: [] });
  });

  it("returns an in-progress series with the next uncompleted lesson", async () => {
    mocks.getUser.mockResolvedValue(AUTHED);
    // omni-studio-cert has 9 published lessons; mark the first 3 complete.
    const completed = [
      "day-01-f1-omnistudio-solution-and-industry-use-cases",
      "day-02-f2-project-needs-requirements-assumptions-risks-const",
      "day-03-f3-managed-package-vs-standard-runtime-upgrades",
    ].map((slug) => ({ lesson_slug: slug, completed_at: "2026-08-11T10:00:00Z" }));
    mocks.from.mockImplementation(() => ({
      select: () => ({
        eq: () => ({ data: completed, error: null }),
      }),
    }));

    const res = await GET();
    const json = await res.json();
    expect(json.items).toHaveLength(1);
    const item = json.items[0];
    expect(item.seriesSlug).toBe("omni-studio-cert");
    expect(item.completedCount).toBe(3);
    expect(item.totalLessons).toBe(9);
    expect(item.percent).toBe(33);
    expect(item.nextLessonSlug).toBeTruthy(); // lowest-numbered uncompleted
    expect(item.lastCompletedAt).toBe("2026-08-11T10:00:00Z");
  });

  it("excludes fully-completed series (completedCount === total)", async () => {
    mocks.getUser.mockResolvedValue(AUTHED);
    // agentic-ai has 8 published lessons; mark ALL complete.
    const slugs = [
      "what-is-an-agent",
      "how-llms-work-tokens-context-inference",
      "the-agent-loop-perceive-reason-act-observe",
      "prompting-for-agents-system-prompts-few-shot",
      "tokens-context-cost-engineering-agents",
      "choosing-models-providers-routing-fallbacks",
      "structured-output-json-mode-function-calling-tool-schemas",
      "tool-design-schemas-error-handling-retries",
    ];
    const completed = slugs.map((slug) => ({
      lesson_slug: slug,
      completed_at: "2026-08-10T08:00:00Z",
    }));
    mocks.from.mockImplementation(() => ({
      select: () => ({
        eq: () => ({ data: completed, error: null }),
      }),
    }));

    const res = await GET();
    const json = await res.json();
    // agentic-ai fully complete → not in-progress; nothing else has completions.
    expect(json.items).toEqual([]);
  });

  it("sorts multiple in-progress series most-recent-first", async () => {
    mocks.getUser.mockResolvedValue(AUTHED);
    // agentic-ai: 1 of 8 complete, recent. omni: 1 of 9 complete, older.
    const completed = [
      { lesson_slug: "what-is-an-agent", completed_at: "2026-08-11T09:00:00Z" },
      {
        lesson_slug: "day-01-f1-omnistudio-solution-and-industry-use-cases",
        completed_at: "2026-08-09T09:00:00Z",
      },
    ];
    mocks.from.mockImplementation(() => ({
      select: () => ({
        eq: () => ({ data: completed, error: null }),
      }),
    }));

    const res = await GET();
    const json = await res.json();
    expect(json.items).toHaveLength(2);
    expect(json.items[0].seriesSlug).toBe("agentic-ai");
    expect(json.items[1].seriesSlug).toBe("omni-studio-cert");
  });
});
