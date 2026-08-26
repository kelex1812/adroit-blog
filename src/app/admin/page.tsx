"use client";

import { useState } from "react";
import { useAdminCourses } from "@/lib/hooks/useAdminCourses";
import { StatusBadge } from "@/components/Catalog/StatusBadge";
import { AccessModelChip } from "@/components/Catalog/AccessModelChip";
import type {
  AccessModel,
  CourseStatus,
} from "@/shared/contracts-course-catalog";

const STATUSES: CourseStatus[] = ["pending", "live", "archived"];
const MODELS: AccessModel[] = [
  "free",
  "subscription",
  "one-time",
  "sub-or-one-time",
  "granted",
];

/**
 * /admin (US-009) — course management. Client table fed by GET
 * /api/admin/courses; status/access-model changes PATCH per course. The
 * server seam + admin gate remain authoritative — this UI only calls them.
 */
export default function AdminCoursesPage() {
  const { rows, loading, error, updateCourse } = useAdminCourses();
  const [saving, setSaving] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  async function onStatusChange(slug: string, status: CourseStatus) {
    setSaving(slug);
    setToast(null);
    const ok = await updateCourse(slug, { status });
    setSaving(null);
    setToast(ok ? `Updated ${slug} → ${status}` : "Update failed");
  }

  async function onModelChange(slug: string, access_model: AccessModel) {
    setSaving(slug);
    setToast(null);
    const ok = await updateCourse(slug, { access_model });
    setSaving(null);
    setToast(ok ? `Updated ${slug} access model` : "Update failed");
  }

  if (loading)
    return (
      <p role="status" className="text-sm text-gray-500">
        Loading courses…
      </p>
    );
  if (error)
    return (
      <p role="status" className="text-sm text-red-600">
        {error}
      </p>
    );
  if (!rows) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-[var(--ink-primary)]">
            Courses
          </h1>
          <p className="text-[13px] text-[var(--ink-muted)] mt-0.5">
            DB-backed status + access model are the source of truth.
          </p>
        </div>
        {toast && (
          <span
            role="status"
            aria-live="polite"
            className="text-[12.5px] font-medium text-emerald-700 bg-emerald/10 px-3 py-1.5 rounded-full"
          >
            {toast}
          </span>
        )}
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--admin-table-border)" }}>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="font-mono text-[11px] font-bold uppercase tracking-[0.07em]" style={{ color: "var(--admin-table-head)" }}>
              <th scope="col" className="px-4 py-3">Series</th>
              <th scope="col" className="px-4 py-3">Status</th>
              <th scope="col" className="px-4 py-3">Access</th>
              <th scope="col" className="px-4 py-3">Entitlements</th>
              <th scope="col" className="px-4 py-3">Status</th>
              <th scope="col" className="px-4 py-3">Access model</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ course, activeEntitlementCount }) => (
              <tr key={course.id} className="text-[13.5px]" style={{ borderTop: "1px solid var(--admin-table-border)" }}>
                <td className="px-4 py-3">
                  <span className="font-semibold text-[var(--ink-primary)]">
                    {course.title}
                  </span>
                  <div className="font-mono text-[11px] text-[var(--ink-muted)]">
                    {course.series_slug}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={course.status} />
                </td>
                <td className="px-4 py-3">
                  <AccessModelChip model={course.access_model} />
                </td>
                <td className="px-4 py-3 font-mono text-[12.5px] text-[var(--ink-muted)]">
                  {activeEntitlementCount}
                </td>
                <td className="px-4 py-3">
                  <select
                    value={course.status}
                    disabled={saving === course.id}
                    aria-label={`Status for ${course.title}`}
                    onChange={(e) =>
                      onStatusChange(
                        course.series_slug,
                        e.target.value as CourseStatus,
                      )
                    }
                    className="rounded-md border text-[12.5px] px-2 py-1.5 bg-transparent disabled:opacity-50"
                    style={{ borderColor: "var(--admin-table-border)" }}
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-4 py-3">
                  <select
                    value={course.access_model}
                    disabled={saving === course.id}
                    aria-label={`Access model for ${course.title}`}
                    onChange={(e) =>
                      onModelChange(
                        course.series_slug,
                        e.target.value as AccessModel,
                      )
                    }
                    className="rounded-md border text-[12.5px] px-2 py-1.5 bg-transparent disabled:opacity-50"
                    style={{ borderColor: "var(--admin-table-border)" }}
                  >
                    {MODELS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
