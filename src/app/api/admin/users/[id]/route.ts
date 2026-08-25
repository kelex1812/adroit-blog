/**
 * GET /api/admin/users/[id] — admin user detail (US-010/014): role + active
 * entitlements (keyed by course_id → source) for the user matrix. Admin-only.
 * Contract: AdminUserListRow (entitlements populated).
 */
import { NextResponse } from "next/server";
import { requireAdminApi, notFoundJson } from "@/lib/admin";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import type {
  AdminUserListRow,
  EntitlementSource,
  UserRole,
} from "@/shared/contracts-course-catalog";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const { id } = await params;
  try {
    const service = getSupabaseServiceClient();
    const [userRes, roleRes, profileRes, entRes] = await Promise.all([
      service.from("auth.users").select("id, email").eq("id", id).maybeSingle(),
      service
        .from("user_roles")
        .select("role")
        .eq("user_id", id)
        .maybeSingle(),
      service
        .from("user_profiles")
        .select("display_name")
        .eq("user_id", id)
        .maybeSingle(),
      service
        .from("user_entitlements")
        .select("course_id, source")
        .eq("user_id", id)
        .is("revoked_at", null),
    ]);
    if (userRes.error) throw userRes.error;
    if (!userRes.data) return notFoundJson();

    const entitlements: Record<string, EntitlementSource> = {};
    for (const e of (entRes.data ?? []) as {
      course_id: string;
      source: EntitlementSource;
    }[]) {
      entitlements[e.course_id] = e.source;
    }

    const row: AdminUserListRow = {
      user_id: id,
      email: (userRes.data as { email: string }).email,
      display_name:
        ((profileRes.data as { display_name: string | null } | null)
          ?.display_name) ?? null,
      role: ((roleRes.data as { role: UserRole } | null)?.role) ?? "member",
      entitlements,
    };
    return NextResponse.json({ ok: true, data: row });
  } catch {
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
