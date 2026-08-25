"use client";

import { useAdminAudit } from "@/lib/hooks/useAdminAudit";

/** /admin/audit (US-015) — read-only audit log of every admin mutation. */
export default function AdminAuditPage() {
  const { rows, loading, error, refresh } = useAdminAudit(200);

  if (loading && !rows) {
    return <p className="text-sm text-gray-500">Loading audit log…</p>;
  }
  if (error) return <p className="text-sm text-red-600">{error}</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-extrabold tracking-tight text-[var(--ink-primary)]">
            Audit Log
          </h1>
          <p className="text-[13px] text-[var(--ink-muted)] mt-0.5">
            Every launch, status/access-model change, role assignment, and
            grant/revoke.
          </p>
        </div>
        <button
          onClick={refresh}
          className="rounded-md border text-[12px] font-semibold px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-800"
          style={{ borderColor: "var(--admin-table-border)" }}
        >
          Refresh
        </button>
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ borderColor: "var(--admin-table-border)" }}>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="font-mono text-[11px] font-bold uppercase tracking-[0.07em]" style={{ color: "var(--admin-table-head)" }}>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Target</th>
              <th className="px-4 py-3">Details</th>
            </tr>
          </thead>
          <tbody>
            {(rows ?? []).map((r) => (
              <tr key={r.id} className="text-[13px] align-top" style={{ borderTop: "1px solid var(--admin-table-border)" }}>
                <td className="px-4 py-3 font-mono text-[11.5px] text-[var(--ink-muted)] whitespace-nowrap">
                  {new Date(r.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-3 font-mono text-[11.5px] text-[var(--ink-muted)]">
                  {r.actor_user_id?.slice(0, 8) ?? "system"}
                </td>
                <td className="px-4 py-3">
                  <span className="font-mono text-[11.5px] font-semibold rounded-md bg-gray-100 dark:bg-gray-800 px-2 py-0.5">
                    {r.action}
                  </span>
                </td>
                <td className="px-4 py-3 font-mono text-[11.5px] text-[var(--ink-muted)]">
                  {r.target_type}
                  {r.target_id ? ` · ${r.target_id.slice(0, 36)}` : ""}
                </td>
                <td className="px-4 py-3 font-mono text-[11px] text-[var(--ink-muted)] max-w-[280px] truncate">
                  {r.details ? JSON.stringify(r.details) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {(rows ?? []).length === 0 && (
          <p className="px-4 py-6 text-sm text-gray-500">No audit entries yet.</p>
        )}
      </div>
    </div>
  );
}
