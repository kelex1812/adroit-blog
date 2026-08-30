"use client";

import { useEffect, useState } from "react";
import { useAdminUsers } from "@/lib/hooks/useAdminUsers";
import { useAdminCourses } from "@/lib/hooks/useAdminCourses";
import { AccessModelChip } from "@/components/Catalog/AccessModelChip";
import type {
  AdminUserListRow,
  EntitlementSource,
} from "@/shared/contracts-course-catalog";

/** Fetch one user's detail (role + entitlements) — /api/admin/users/[id]. */
async function fetchUserDetail(id: string): Promise<AdminUserListRow | null> {
  try {
    const res = await fetch(`/api/admin/users/${id}`);
    if (!res.ok) return null;
    const json = (await res.json()) as { ok: true; data: AdminUserListRow };
    return json.data;
  } catch {
    return null;
  }
}

const SOURCE_LABEL: Record<EntitlementSource, string> = {
  granted: "G",
  "one-time": "P",
};

/** Course access models a subscription satisfies (subscription or sub-or-one-time). */
const SUB_GATED_MODELS = new Set(["subscription", "sub-or-one-time"]);

/**
 * /admin/matrix (US-014) — user × course access matrix. Each cell shows the
 * entitlement source (G=granted, P=one-time) or is empty when none active.
 */
export default function AdminMatrixPage() {
  const { rows: users, loading: usersLoading } = useAdminUsers();
  const { rows: courses, loading: coursesLoading } = useAdminCourses();
  const [details, setDetails] = useState<Record<string, AdminUserListRow>>({});

  useEffect(() => {
    if (!users || users.length === 0) return;
    let cancelled = false;
    Promise.all(users.map((u) => fetchUserDetail(u.user_id))).then((res) => {
      if (cancelled) return;
      const map: Record<string, AdminUserListRow> = {};
      for (const r of res) if (r) map[r.user_id] = r;
      setDetails(map);
    });
    return () => {
      cancelled = true;
    };
  }, [users]);

  if (usersLoading || coursesLoading) {
    return (
      <p role="status" className="text-sm text-gray-500">
        Loading matrix…
      </p>
    );
  }
  if (!users || !courses) return null;

  return (
    <div>
      <h1 className="text-xl font-extrabold tracking-tight text-[var(--ink-primary)] mb-1">
        Access Matrix
      </h1>
      <p className="text-[13px] text-[var(--ink-muted)] mb-5">
        G = admin grant · P = one-time purchase · S = active subscription ·
        empty = no active access
      </p>

      <div className="rounded-xl border overflow-x-auto" style={{ borderColor: "var(--admin-table-border)" }}>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="font-mono text-[11px] font-bold uppercase tracking-[0.07em]" style={{ color: "var(--admin-table-head)" }}>
              <th scope="col" className="px-4 py-3 min-w-[200px]">User</th>
              {courses.map(({ course }) => (
                <th scope="col" key={course.id} className="px-3 py-3 text-center min-w-[90px]">
                  <div className="truncate max-w-[90px]">{course.series_slug}</div>
                  <div className="mt-1 flex justify-center">
                    <AccessModelChip model={course.access_model} />
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const ent = details[u.user_id]?.entitlements ?? u.entitlements;
              const sub =
                details[u.user_id]?.subscription ?? u.subscription;
              return (
                <tr key={u.user_id} className="text-[13.5px]" style={{ borderTop: "1px solid var(--admin-table-border)" }}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-[var(--ink-primary)]">
                        {u.display_name ?? u.email}
                      </span>
                      {sub && (
                        <span
                          className="inline-flex items-center px-1.5 rounded-full font-mono text-[10px] font-bold uppercase tracking-wide"
                          style={{
                            backgroundColor: "rgba(16,185,129,0.16)",
                            color: "var(--am-sub-text, #059669)",
                          }}
                          title={`Active ${sub.status} subscription · ${sub.plan}`}
                        >
                          Sub
                        </span>
                      )}
                    </div>
                    <div className="font-mono text-[11px] text-[var(--ink-muted)]">
                      {u.email}
                    </div>
                  </td>
                  {courses.map(({ course }) => {
                    const src = ent[course.id];
                    // A subscription satisfies subscription / sub-or-one-time
                    // models — surface it distinctly from G/P entitlements.
                    const subGrants = sub && SUB_GATED_MODELS.has(course.access_model);
                    if (src) {
                      return (
                        <td key={course.id} className="px-3 py-3 text-center">
                          <span
                            className="inline-flex items-center justify-center w-6 h-6 rounded-full font-mono text-[11px] font-bold"
                            style={{
                              backgroundColor:
                                "rgba(225,29,72,0.14)",
                              color: "var(--am-granted-text)",
                            }}
                            title={src === "granted" ? "Granted" : "One-time"}
                          >
                            {SOURCE_LABEL[src]}
                          </span>
                        </td>
                      );
                    }
                    if (subGrants) {
                      return (
                        <td key={course.id} className="px-3 py-3 text-center">
                          <span
                            className="inline-flex items-center justify-center w-6 h-6 rounded-full font-mono text-[11px] font-bold"
                            style={{
                              backgroundColor: "rgba(16,185,129,0.16)",
                              color: "var(--am-sub-text, #059669)",
                            }}
                            title={`Active ${sub!.status} subscription`}
                          >
                            S
                          </span>
                        </td>
                      );
                    }
                    return (
                      <td key={course.id} className="px-3 py-3 text-center">
                        <span className="inline-block w-6 h-6 text-center text-[12px] text-[var(--ink-faint)]">
                          —
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
