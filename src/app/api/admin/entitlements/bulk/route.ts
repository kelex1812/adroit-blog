/**
 * POST /api/admin/entitlements/bulk — bulk-grant a course to many users
 * (US-013). Writes ONE admin_audit_log row (entitlement.bulk_grant) and one
 * entitlement row per selected user (AC-7). Admin-only.
 * Contract: BulkGrantRequest.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, writeAuditLog } from "@/lib/admin";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import {
  checkOrigin,
  checkRateLimit,
  getClientIp,
} from "@/lib/api-security";
import type { BulkGrantRequest } from "@/shared/contracts-course-catalog";

const MAX_BULK = 500;

export async function POST(req: NextRequest) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const originErr = checkOrigin(req);
  if (originErr) return NextResponse.json({ error: originErr }, { status: 403 });
  if (!checkRateLimit(getClientIp(req))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: BulkGrantRequest;
  try {
    body = (await req.json()) as BulkGrantRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!Array.isArray(body.userIds) || body.userIds.length === 0) {
    return NextResponse.json({ error: "userIds required" }, { status: 400 });
  }
  if (body.userIds.length > MAX_BULK) {
    return NextResponse.json(
      { error: `userIds exceeds ${MAX_BULK}` },
      { status: 400 },
    );
  }
  if (typeof body.courseId !== "string" || !body.courseId) {
    return NextResponse.json({ error: "courseId required" }, { status: 400 });
  }

  const service = getSupabaseServiceClient();
  try {
    const courseRes = await service
      .from("courses")
      .select("id")
      .eq("id", body.courseId)
      .maybeSingle();
    if (courseRes.error) throw courseRes.error;
    if (!courseRes.data) {
      return NextResponse.json({ error: "Course not found" }, { status: 404 });
    }

    const userIds = [...new Set(body.userIds)].filter(
      (u): u is string => typeof u === "string" && u.length > 0,
    );
    const note = typeof body.note === "string" ? body.note.trim() || null : null;

    // Validate all users exist (skip unknown ids silently).
    const { data: known, error: userErr } = await service
      .from("auth.users")
      .select("id")
      .in("id", userIds);
    if (userErr) throw userErr;
    const knownIds = new Set((known as { id: string }[]).map((r) => r.id));
    const validUserIds = userIds.filter((id) => knownIds.has(id));

    const rows = validUserIds.map((userId) => ({
      user_id: userId,
      course_id: body.courseId,
      source: "granted" as const,
      grant_note: note,
      granted_by: gate.userId,
    }));

    if (rows.length > 0) {
      const { error } = await service
        .from("user_entitlements")
        .upsert(rows, { onConflict: "user_id, course_id, source" });
      if (error) throw error;
    }

    await writeAuditLog({
      actorUserId: gate.userId,
      action: "entitlement.bulk_grant",
      targetType: "entitlement",
      targetId: body.courseId,
      details: { requested: userIds.length, granted: rows.length, note },
    });

    return NextResponse.json({
      ok: true,
      data: { requested: userIds.length, granted: rows.length },
    });
  } catch (err) {
    console.error("[admin] bulk grant", err);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
