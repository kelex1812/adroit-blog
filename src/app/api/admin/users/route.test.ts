/**
 * route.test.ts — GET /api/admin/users (QA fix t_48183726).
 *
 * Auth users must come from the GoTrue Admin API (listAuthUsers) because the
 * `auth` schema is not exposed to PostgREST — the old service.from("auth.users")
 * 500'd with PGRST205. Verifies: admin gate, roles resolved from user_roles,
 * and that a users read failure surfaces as a 500 (never a silent wrong list).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mocks } = vi.hoisted(() => {
  const getAccessUserId = vi.fn();
  const isAdmin = vi.fn();
  const listAuthUsers = vi.fn();
  const service = { from: vi.fn() };
  return { mocks: { getAccessUserId, isAdmin, listAuthUsers, service } };
});

vi.mock("@/lib/access", () => ({
  accessSeam: { isAdmin: mocks.isAdmin },
  getAccessUserId: mocks.getAccessUserId,
}));

vi.mock("@/lib/supabase/service", () => ({
  getSupabaseServiceClient: () => mocks.service,
}));

vi.mock("@/lib/supabase/auth-admin", () => ({
  listAuthUsers: mocks.listAuthUsers,
}));

import { GET } from "./route";

const ADMIN_ID = "admin-1";

function req(q = ""): NextRequest {
  const url = q
    ? `http://localhost:3000/api/admin/users?q=${encodeURIComponent(q)}`
    : "http://localhost:3000/api/admin/users";
  return new NextRequest(url);
}

function admin() {
  mocks.getAccessUserId.mockResolvedValue(ADMIN_ID);
  mocks.isAdmin.mockResolvedValue(true);
}

/** Public-table reads: user_roles → rows, user_profiles → rows. */
function wirePublic(roles: { user_id: string; role: string }[], profiles: { user_id: string; display_name: string | null }[]) {
  mocks.service.from.mockImplementation((table: string) => {
    if (table === "user_roles") {
      return { select: async () => ({ data: roles, error: null }) };
    }
    if (table === "user_profiles") {
      return { select: async () => ({ data: profiles, error: null }) };
    }
    return { select: async () => ({ data: [], error: null }) };
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.isAdmin.mockReset();
  mocks.getAccessUserId.mockReset();
  mocks.listAuthUsers.mockReset();
  mocks.service.from.mockReset();
});

describe("GET /api/admin/users — GoTrue auth source (t_48183726)", () => {
  it("403s a non-admin and never calls the auth source", async () => {
    mocks.getAccessUserId.mockResolvedValue("member");
    mocks.isAdmin.mockResolvedValue(false);
    const res = await GET(req());
    expect(res.status).toBe(403);
    expect(mocks.listAuthUsers).not.toHaveBeenCalled();
  });

  it("returns the full auth-user list with roles resolved from user_roles", async () => {
    admin();
    mocks.listAuthUsers.mockResolvedValue([
      { id: "u-admin", email: "admin@adroit.io" },
      { id: "u-member", email: "member@adroit.io" },
      { id: "u-no-role", email: "nobody@adroit.io" },
    ]);
    wirePublic(
      [
        { user_id: "u-admin", role: "admin" },
        { user_id: "u-member", role: "member" },
      ],
      [{ user_id: "u-admin", display_name: "Admin User" }],
    );
    const res = await GET(req());
    expect(res.status).toBe(200);
    const json = await res.json();
    const rows = json.data as { user_id: string; email: string; role: string; display_name: string | null }[];
    expect(rows).toHaveLength(3);
    expect(rows.find((r) => r.user_id === "u-admin")).toMatchObject({
      role: "admin",
      display_name: "Admin User",
    });
    expect(rows.find((r) => r.user_id === "u-member")).toMatchObject({
      role: "member",
    });
    // Missing role row → defaults to member (never crashes on unknown user).
    expect(rows.find((r) => r.user_id === "u-no-role")?.role).toBe("member");
    // service client must NOT be asked for auth.users (the PGRST205 path).
    expect(mocks.service.from).not.toHaveBeenCalledWith("auth.users");
  });

  it("filters by name/email substring via ?q=", async () => {
    admin();
    mocks.listAuthUsers.mockResolvedValue([
      { id: "1", email: "Alice@adroit.io" },
      { id: "2", email: "bob@adroit.io" },
    ]);
    wirePublic([], [{ user_id: "1", display_name: "Alice Wonder" }]);
    const res = await GET(req("ali"));
    const json = await res.json();
    const rows = json.data as { email: string }[];
    expect(rows).toHaveLength(1);
    expect(rows[0].email).toBe("Alice@adroit.io");
  });

  it("returns 500 (never a wrong empty list) when the auth read fails", async () => {
    admin();
    mocks.listAuthUsers.mockRejectedValue(new Error("GoTrue down"));
    wirePublic([], []);
    const res = await GET(req());
    expect(res.status).toBe(500);
  });
});
