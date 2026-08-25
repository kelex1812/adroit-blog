/**
 * PATCH /api/admin/courses/[slug] — admin course mutation (US-009): update
 * status / access_model / price_cents; launching sets launched_at. Writes an
 * admin_audit_log row (ADR-205). Admin-only (US-016).
 *
 * Contract: AdminCourseUpdateRequest.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi, notFoundJson, writeAuditLog } from "@/lib/admin";
import { getSupabaseServiceClient } from "@/lib/supabase/service";
import {
  checkOrigin,
  checkRateLimit,
  getClientIp,
} from "@/lib/api-security";
import type {
  AdminCourseUpdateRequest,
  CourseRow,
} from "@/shared/contracts-course-catalog";

const STATUSES = ["pending", "live", "archived"] as const;
const MODELS = [
  "free",
  "subscription",
  "one-time",
  "sub-or-one-time",
  "granted",
] as const;

type Params = { params: Promise<{ slug: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const gate = await requireAdminApi();
  if (!gate.ok) return gate.response;

  const originErr = checkOrigin(req);
  if (originErr) return NextResponse.json({ error: originErr }, { status: 403 });
  if (!checkRateLimit(getClientIp(req))) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: AdminCourseUpdateRequest;
  try {
    body = (await req.json()) as AdminCourseUpdateRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (body.status !== undefined && !STATUSES.includes(body.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  if (body.access_model !== undefined && !MODELS.includes(body.access_model)) {
    return NextResponse.json({ error: "Invalid access_model" }, { status: 400 });
  }
  if (
    body.price_cents !== undefined &&
    body.price_cents !== null &&
    (typeof body.price_cents !== "number" || body.price_cents < 0)
  ) {
    return NextResponse.json({ error: "Invalid price_cents" }, { status: 400 });
  }
  if (
    body.status === undefined &&
    body.access_model === undefined &&
    body.price_cents === undefined
  ) {
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });
  }

  const { slug } = await params;
  const service = getSupabaseServiceClient();

  try {
    const { data: existing, error: findErr } = await service
      .from("courses")
      .select("*")
      .eq("series_slug", slug)
      .maybeSingle();
    if (findErr) throw findErr;
    const existingRow = (existing as CourseRow | null) ?? null;
    if (!existingRow) return notFoundJson();

    const updates: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (body.status !== undefined) updates.status = body.status;
    if (body.access_model !== undefined) updates.access_model = body.access_model;
    if (body.price_cents !== undefined) updates.price_cents = body.price_cents;
    // Launching sets launched_at (idempotent — keep the first launch timestamp).
    if (body.status === "live" && !existingRow.launched_at) {
      updates.launched_at = new Date().toISOString();
    }

    const { data, error } = await service
      .from("courses")
      .update(updates)
      .eq("series_slug", slug)
      .select("*")
      .single();
    if (error) throw error;

    const updated = data as CourseRow;

    // Audit (ADR-205): launch / status_change / access_model_change.
    const auditActions: { action: string; details: Record<string, unknown> }[] =
      [];
    if (body.status !== undefined && body.status !== existingRow.status) {
      auditActions.push({
        action: body.status === "live" ? "course.launch" : "course.status_change",
        details: {
          from: existingRow.status,
          to: body.status,
          first_launch: !existingRow.launched_at && body.status === "live",
        },
      });
    }
    if (
      body.access_model !== undefined &&
      body.access_model !== existingRow.access_model
    ) {
      auditActions.push({
        action: "course.access_model_change",
        details: {
          from: existingRow.access_model,
          to: body.access_model,
        },
      });
    }
    for (const a of auditActions) {
      await writeAuditLog({
        actorUserId: gate.userId,
        action: a.action,
        targetType: "course",
        targetId: slug,
        details: a.details,
      });
    }

    return NextResponse.json({ ok: true, data: updated });
  } catch (err) {
    console.error("[admin] PATCH course", err);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
