/**
 * GET /api/admin/users?q= — admin user list (US-010): every auth user with
 * role + display_name, filterable by name/email substring. Admin-only.
 * Contract: AdminUserListRow.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import { listAuthUsers } from "@/lib/supabase/auth-admin";
import type {
  AdminUserListRow,
  UserRole,
} from "@/shared/contracts-course-catalog";

export async function GET(req: NextRequest) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();

  try {
    const service = getSupabaseServiceClient();
    // Auth users come from the GoTrue Admin API (the `auth` schema is not
    // exposed to PostgREST — PGRST205). Roles/profiles are public tables.
    const [authUsers, rolesRes, profilesRes] = await Promise.all([
      listAuthUsers(),
      service.from("user_roles").select("user_id, role"),
      service.from("user_profiles").select("user_id, display_name"),
    ]);
    if (rolesRes.error) throw rolesRes.error;
    if (profilesRes.error) throw profilesRes.error;

    const roleByUser = new Map<string, UserRole>();
    for (const r of (rolesRes.data ?? []) as { user_id: string; role: UserRole }[]) {
      roleByUser.set(r.user_id, r.role);
    }
    const nameByUser = new Map<string, string | null>();
    for (const p of (profilesRes.data ?? []) as {
      user_id: string;
      display_name: string | null;
    }[]) {
      nameByUser.set(p.user_id, p.display_name);
    }

    const rows: AdminUserListRow[] = authUsers
      .map((u) => ({
        user_id: u.id,
        email: u.email,
        display_name: nameByUser.get(u.id) ?? null,
        role: roleByUser.get(u.id) ?? ("member" as UserRole),
        entitlements: {},
      }))
      .filter((u) => {
        if (!q) return true;
        return (
          u.email.toLowerCase().includes(q) ||
          (u.display_name ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.email.localeCompare(b.email));

    return NextResponse.json({ ok: true, data: rows });
  } catch {
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
