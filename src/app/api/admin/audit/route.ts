/**
 * GET /api/admin/audit — admin audit log (US-015). Read-only view of
 * admin_audit_log rows, newest first. Admin-only.
 * Contract: AdminAuditLogRow.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/admin";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import type { AdminAuditLogRow } from "@/shared/contracts-course-catalog";

export async function GET(req: NextRequest) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 100), 500);

  try {
    const service = getSupabaseServiceClient();
    const { data, error } = await service
      .from("admin_audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) throw error;
    return NextResponse.json({ ok: true, data: (data ?? []) as AdminAuditLogRow[] });
  } catch {
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
