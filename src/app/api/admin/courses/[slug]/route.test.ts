/**
 * route.test.ts — PATCH /api/admin/courses/[slug] price-change audit (t_10214e52).
 *
 * ADR-205 requires an admin_audit_log row for every admin mutation. A
 * price-only PATCH was previously unaudited (CWE-778): now a
 * course.price_change action (from/to) is written whenever price_cents moves.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mocks } = vi.hoisted(() => {
  const getAccessUserId = vi.fn();
  const isAdmin = vi.fn();
  const service = { from: vi.fn() };
  return { mocks: { getAccessUserId, isAdmin, service } };
});

vi.mock("@/lib/access", () => ({
  accessSeam: { isAdmin: mocks.isAdmin },
  getAccessUserId: mocks.getAccessUserId,
}));

vi.mock("@/lib/supabase/service", () => ({
  getSupabaseServiceClient: () => mocks.service,
}));

import { PATCH } from "./route";

const ADMIN_ID = "user-admin";

const existing = {
  id: "c1",
  series_slug: "my-course",
  status: "live",
  access_model: "free",
  price_cents: 0,
  launched_at: "2026-01-01T00:00:00.000Z",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

function req(body: Record<string, unknown>): NextRequest {
  return new NextRequest("http://localhost:3000/api/admin/courses/my-course", {
    method: "PATCH",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "10.0.0.1",
    },
    body: JSON.stringify(body),
  });
}

function admin() {
  mocks.getAccessUserId.mockResolvedValue(ADMIN_ID);
  mocks.isAdmin.mockResolvedValue(true);
}

function wire(updated: unknown) {
  const auditInserts: unknown[] = [];
  // from("courses"): .select("*").eq().maybeSingle() for the find, and
  // .update().eq().select().single() for the write — select/update are METHODS.
  const fromCourses = {
    select: () => ({
      eq: () => ({ maybeSingle: async () => ({ data: existing, error: null }) }),
    }),
    update: () => ({
      eq: () => ({
        select: () => ({ single: async () => ({ data: updated, error: null }) }),
      }),
    }),
  };
  mocks.service.from.mockImplementation((table: string) => {
    if (table === "courses") return fromCourses;
    if (table === "admin_audit_log") {
      return {
        insert: async (row: unknown) => {
          auditInserts.push(row);
          return { error: null };
        },
      };
    }
    return {};
  });
  return auditInserts;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isAdmin.mockReset();
  mocks.getAccessUserId.mockReset();
  mocks.service.from.mockReset();
});

describe("PATCH /api/admin/courses/[slug] — price-change audit (t_10214e52)", () => {
  it("writes a course.price_change audit row for a price-only PATCH", async () => {
    admin();
    const auditInserts = wire({ ...existing, price_cents: 9900 });
    const res = await PATCH(req({ price_cents: 9900 }), {
      params: Promise.resolve({ slug: "my-course" }),
    });
    expect(res.status).toBe(200);
    const priceAudit = auditInserts.find(
      (a) => (a as { action: string }).action === "course.price_change",
    );
    expect(priceAudit).toBeTruthy();
    expect(priceAudit).toMatchObject({
      action: "course.price_change",
      target_type: "course",
      target_id: "my-course",
      details: { from: 0, to: 9900 },
    });
  });

  it("writes NO price audit row when price is unchanged", async () => {
    admin();
    const auditInserts = wire({ ...existing, status: "archived" });
    // status change only (price stays 0)
    const res = await PATCH(req({ status: "archived" }), {
      params: Promise.resolve({ slug: "my-course" }),
    });
    expect(res.status).toBe(200);
    expect(auditInserts.some((a) => (a as { action: string }).action === "course.price_change")).toBe(false);
  });
});
