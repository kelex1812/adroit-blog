"use client";

import { useState } from "react";
import { useAdminUsers } from "@/lib/hooks/useAdminUsers";
import { useAdminCourses } from "@/lib/hooks/useAdminCourses";
import type { UserRole } from "@/shared/contracts-course-catalog";

/**
 * /admin/users (US-010/011) — user list + search + role assignment + grant.
 * Client table fed by GET /api/admin/users; the server admin gate stays
 * authoritative for every write.
 */
export default function AdminUsersPage() {
  const {
    rows,
    loading,
    error,
    query,
    setQuery,
    setRole,
    grant,
    revoke,
  } = useAdminUsers();
  const { rows: courses } = useAdminCourses();
  const [grantCourse, setGrantCourse] = useState<string>("");
  const [toast, setToast] = useState<string | null>(null);

  // Default the grant course select to the first course once loaded — derived,
  // so the select shows a course without a sync setState-in-effect.
  const defaultCourseId =
    courses && courses.length > 0 ? courses[0].course.id : "";
  const effectiveGrantCourse = grantCourse || defaultCourseId;

  async function onSetRole(userId: string, role: UserRole) {
    setToast((await setRole(userId, role)) ? "Role updated" : "Failed");
  }

  async function onGrant(userId: string) {
    if (!effectiveGrantCourse) return setToast("Select a course first");
    const ok = await grant({ userId, courseId: effectiveGrantCourse });
    setToast(ok ? "Granted" : "Grant failed");
  }

  async function onRevoke(userId: string) {
    if (!effectiveGrantCourse) return setToast("Select a course first");
    const ok = await revoke(userId, effectiveGrantCourse);
    setToast(ok ? "Revoked" : "Revoke failed");
  }

  if (loading && !rows)
    return (
      <p role="status" className="text-sm text-gray-500">
        Loading users…
      </p>
    );
  if (error)
    return (
      <p role="status" className="text-sm text-red-600">
        {error}
      </p>
    );

  return (
    <div>
      <div className="flex items-center justify-between mb-5 gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-[var(--ink-primary)]">
            Users
          </h1>
          <p className="text-[13px] text-[var(--ink-muted)] mt-0.5">
            Assign roles and grant/revoke course access.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={effectiveGrantCourse}
            onChange={(e) => setGrantCourse(e.target.value)}
            className="rounded-md border text-[12.5px] px-2 py-1.5 bg-transparent"
            style={{ borderColor: "var(--admin-table-border)" }}
            aria-label="Course for grant/revoke"
          >
            {(courses ?? []).map(({ course }) => (
              <option key={course.id} value={course.id}>
                {course.series_slug}
              </option>
            ))}
          </select>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or email…"
            className="rounded-md border text-[13px] px-3 py-1.5 bg-transparent w-56"
            style={{ borderColor: "var(--admin-table-border)" }}
            aria-label="Search users"
          />
        </div>
      </div>

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="mb-4 text-[12.5px] font-medium text-emerald-700 bg-emerald/10 px-3 py-1.5 rounded-full inline-block"
        >
          {toast}
        </div>
      )}

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--admin-table-border)" }}>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="font-mono text-[11px] font-bold uppercase tracking-[0.07em]" style={{ color: "var(--admin-table-head)" }}>
              <th scope="col" className="px-4 py-3">User</th>
              <th scope="col" className="px-4 py-3">Role</th>
              <th scope="col" className="px-4 py-3">Active entitlements</th>
              <th scope="col" className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((u) => {
              const entCount = Object.keys(u.entitlements).length;
              return (
                <tr key={u.user_id} className="text-[13.5px]" style={{ borderTop: "1px solid var(--admin-table-border)" }}>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-[var(--ink-primary)]">
                      {u.display_name ?? u.email}
                    </span>
                    <div className="font-mono text-[11px] text-[var(--ink-muted)]">
                      {u.email}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={u.role}
                      onChange={(e) =>
                        onSetRole(u.user_id, e.target.value as UserRole)
                      }
                      aria-label={`Role for ${u.display_name ?? u.email}`}
                      className="rounded-md border text-[12.5px] px-2 py-1.5 bg-transparent"
                      style={{ borderColor: "var(--admin-table-border)" }}
                    >
                      <option value="member">member</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td className="px-4 py-3 font-mono text-[12.5px] text-[var(--ink-muted)]">
                    {entCount}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => onGrant(u.user_id)}
                        className="rounded-md bg-[var(--color-red)] text-white text-[12px] font-semibold px-3 py-1.5 hover:opacity-90"
                      >
                        Grant
                      </button>
                      <button
                        onClick={() => onRevoke(u.user_id)}
                        className="rounded-md border text-[12px] font-semibold px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800"
                        style={{ borderColor: "var(--admin-table-border)" }}
                      >
                        Revoke
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {(rows ?? []).length === 0 && (
          <p className="px-4 py-6 text-sm text-gray-500">No users found.</p>
        )}
      </div>
    </div>
  );
}
