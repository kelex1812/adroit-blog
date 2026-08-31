/**
 * route.test.ts — POST /api/auth/reset-password/update (t_e25638b3).
 *
 * Requires an active session (guest → 401). Password must be >= 6 chars.
 * On success calls supabase.auth.updateUser({ password }).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { mocks } = vi.hoisted(() => {
  const getSupabaseServerClient = vi.fn();
  const getUser = vi.fn();
  const updateUser = vi.fn();
  return { mocks: { getSupabaseServerClient, getUser, updateUser } };
});

vi.mock("@/lib/supabase/server", () => ({
  getSupabaseServerClient: async () => ({
    auth: { getUser: mocks.getUser, updateUser: mocks.updateUser },
  }),
}));

import { POST } from "./route";

function req(body: unknown): NextRequest {
  return new NextRequest("http://localhost:3000/api/auth/reset-password/update", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function authed(id = "user-1") {
  mocks.getUser.mockResolvedValue({ data: { user: { id } } });
}

beforeEach(() => {
  vi.clearAllMocks();
  authed();
  mocks.updateUser.mockResolvedValue({ error: null });
});

describe("POST /api/auth/reset-password/update (t_e25638b3)", () => {
  it("updates the password for an authenticated session", async () => {
    const res = await POST(req({ password: "new-password-123" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(mocks.updateUser).toHaveBeenCalledWith({ password: "new-password-123" });
  });

  it("rejects a guest with 401 (no session)", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(req({ password: "new-password-123" }));
    expect(res.status).toBe(401);
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("rejects a password shorter than 6 chars (400)", async () => {
    const res = await POST(req({ password: "12345" }));
    expect(res.status).toBe(400);
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("rejects a missing password (400)", async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(400);
    expect(mocks.updateUser).not.toHaveBeenCalled();
  });

  it("surfaces a Supabase update error as 400", async () => {
    mocks.updateUser.mockResolvedValue({ error: { message: "Password too weak" } });
    const res = await POST(req({ password: "new-password-123" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Password too weak");
  });
});
