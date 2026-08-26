"use client";

/**
 * /admin — admin dashboard landing (v4, t_0ed19ad0). Monitor-in-Operate
 * overview replacing the old drop-into-courses-table. Reuses the existing
 * useAdminCourses / useAdminUsers / useAdminAudit hooks — status + entitlement
 * counts come from the DB (never content files). Shows a pending-needs-launch
 * banner (only when count(pending) > 0), a 6-stat grid, recent audit activity,
 * and entitlements-per-course. Course management moved to /admin/courses.
 */
import Link from "next/link";
import { useAdminCourses } from "@/lib/hooks/useAdminCourses";
import { useAdminUsers } from "@/lib/hooks/useAdminUsers";
import { useAdminAudit } from "@/lib/hooks/useAdminAudit";

function Stat({
  label,
  value,
  sub,
  valueColor,
  swColor,
}: {
  label: string;
  value: number | string;
  sub: string;
  valueColor?: string;
  swColor: string;
}) {
  return (
    <div className="rounded-xl border p-[15px] shadow-[var(--shadow-card)]" style={{ borderColor: "var(--admin-table-border)", background: "var(--surface-card, #FFFFFF)" }}>
      <div className="flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.07em] text-[var(--ink-muted)] mb-[7px]">
        <span className="w-[7px] h-[7px] rounded-full" style={{ background: swColor }} />
        {label}
      </div>
      <div className="text-[1.85rem] font-extrabold tracking-[-0.025em] leading-none" style={{ color: valueColor ?? "var(--ink-primary)" }}>
        {value}
      </div>
      <div className="text-[11px] text-[var(--ink-faint)] mt-1">{sub}</div>
    </div>
  );
}

function formatTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const diff = Date.now() - t;
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.round(h / 24);
  return `${d}d`;
}

const ACTION_TAG: Record<string, string> = {
  "course.launch": "LAUNCH",
  "course.status_change": "STATUS",
  "course.access_model_change": "MODEL",
  "course.price_change": "PRICE",
  "course.provision": "CREATE",
  "role.assign": "SET_ROLE",
  "entitlement.grant": "GRANT",
  "entitlement.revoke": "REVOKE",
  "entitlement.bulk_grant": "BULK_GRANT",
};

export default function AdminDashboardPage() {
  const courses = useAdminCourses();
  const users = useAdminUsers();
  const audit = useAdminAudit(8);

  const rows = courses.rows ?? [];
  const live = rows.filter((r) => r.course.status === "live").length;
  const pending = rows.filter((r) => r.course.status === "pending");
  const pendingCount = pending.length;
  const archived = rows.filter((r) => r.course.status === "archived").length;
  const granted = rows.filter((r) => r.course.access_model === "granted").length;
  const totalEntitlements = rows.reduce(
    (s, r) => s + r.activeEntitlementCount,
    0,
  );
  const userRows = users.rows ?? [];
  const totalUsers = userRows.length;
  const admins = userRows.filter((r) => r.role === "admin").length;

  const pendingCourse = pending[0];
  const entitlementRanked = [...rows].sort(
    (a, b) => b.activeEntitlementCount - a.activeEntitlementCount,
  );
  const maxEnt = entitlementRanked[0]?.activeEntitlementCount ?? 1;

  const loading = courses.loading || users.loading;

  return (
    <div>
      {/* pending-needs-launch banner — only when a course awaits launch */}
      {pendingCount > 0 && pendingCourse && (
        <div className="admin-banner mb-[22px]">
          <div className="relative z-[2] flex items-center gap-5 flex-wrap px-6 py-[22px]">
            <span className="urgent-dot" />
            <div className="min-w-0">
              <div className="font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--admin-banner-link)]">
                Awaiting launch
              </div>
              <h2 className="text-[19px] font-extrabold tracking-tight mt-0.5 text-[var(--admin-banner-ink)]">
                {pendingCourse.course.title} is pending
              </h2>
              <p className="text-[13px] text-[var(--admin-banner-muted)] mt-0.5">
                {pendingCount} course{pendingCount > 1 ? "s" : ""} need a review
                + launch before visible on the public catalog.
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2.5">
              <Link
                href="/admin/courses"
                className="text-[12.5px] font-semibold no-underline hover:underline"
                style={{ color: "var(--admin-banner-link)" }}
              >
                Review &amp; launch →
              </Link>
              <Link
                href={`/admin/courses`}
                className="rounded-lg px-4 h-10 inline-flex items-center text-[13px] font-semibold text-white no-underline hover:opacity-90"
                style={{ background: "var(--admin-banner-cta)" }}
              >
                Launch
              </Link>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p role="status" className="text-sm text-gray-500">
          Loading dashboard…
        </p>
      ) : (
        <>
          {/* 6-stat grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-[14px] mb-[22px]">
            <Stat label="Live" value={live} sub="Public & gated" valueColor="var(--signal-live)" swColor="var(--signal-live)" />
            <Stat label="Pending" value={pendingCount} sub="Admin-only" valueColor="#B45309" swColor="#B45309" />
            <Stat label="Archived" value={archived} sub="Retired" valueColor="var(--signal-archived)" swColor="var(--signal-archived)" />
            <Stat label="Granted" value={granted} sub="Private access" valueColor="var(--signal-granted)" swColor="var(--signal-granted)" />
            <Stat label="Users" value={totalUsers} sub={`${admins} admin${admins === 1 ? "" : "s"}`} valueColor="var(--ink-primary)" swColor="var(--color-navy)" />
            <Stat label="Entitlements" value={totalEntitlements} sub="Active grants" valueColor="var(--ink-primary)" swColor="var(--am-subscription)" />
          </div>

          {/* recent audit + entitlements-per-course */}
          <div className="grid grid-cols-1 xl:grid-cols-[1.55fr_1fr] gap-[18px] items-start">
            <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--admin-table-border)", background: "var(--surface-card, #FFFFFF)" }}>
              <div className="flex items-center gap-3 px-5 py-[15px] border-b" style={{ borderColor: "var(--admin-table-border)" }}>
                <h3 className="text-[14px] font-bold text-[var(--ink-primary)]">
                  Recent admin activity
                </h3>
                <span className="font-mono text-[10px] text-[var(--ink-faint)]">
                  live from admin_audit_log
                </span>
                <div className="flex-1" />
                <Link href="/admin/audit" className="text-[12px] font-semibold no-underline hover:underline" style={{ color: "var(--color-red)" }}>
                  View audit →
                </Link>
              </div>
              {(audit.rows ?? []).length === 0 ? (
                <p className="px-5 py-6 text-sm text-gray-500">No audit entries yet.</p>
              ) : (
                (audit.rows ?? []).map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center gap-3 px-5 py-[11px] border-b last:border-none hover:bg-[var(--surface-card-soft)]"
                    style={{ borderColor: "var(--border-subtle, #F3F4F6)" }}
                  >
                    <span className="font-mono text-[10px] font-bold uppercase tracking-[0.05em] px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-[var(--ink-muted)]">
                      {ACTION_TAG[r.action] ?? r.action.toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <div className="text-[12.5px] font-semibold text-[var(--ink-primary)] truncate">
                        {r.target_type}
                        {r.target_id ? ` · ${r.target_id}` : ""}
                      </div>
                      <div className="font-mono text-[10px] text-[var(--ink-faint)]">
                        {r.action}
                      </div>
                    </div>
                    <span className="ml-auto font-mono text-[10px] text-[var(--ink-faint)] whitespace-nowrap">
                      {formatTime(r.created_at)}
                    </span>
                  </div>
                ))
              )}
            </div>

            <div className="rounded-2xl border overflow-hidden" style={{ borderColor: "var(--admin-table-border)", background: "var(--surface-card, #FFFFFF)" }}>
              <div className="flex items-center gap-3 px-5 py-[15px] border-b" style={{ borderColor: "var(--admin-table-border)" }}>
                <h3 className="text-[14px] font-bold text-[var(--ink-primary)]">
                  Entitlements per course
                </h3>
                <span className="font-mono text-[10px] text-[var(--ink-faint)]">active</span>
                <div className="flex-1" />
                <Link href="/admin/courses" className="text-[12px] font-semibold no-underline hover:underline" style={{ color: "var(--color-red)" }}>
                  Courses →
                </Link>
              </div>
              {entitlementRanked.length === 0 ? (
                <p className="px-5 py-6 text-sm text-gray-500">No courses yet.</p>
              ) : (
                entitlementRanked.map(({ course, activeEntitlementCount }) => (
                  <div
                    key={course.id}
                    className="flex items-center gap-3 px-5 py-[11px] border-b last:border-none hover:bg-[var(--surface-card-soft)]"
                    style={{ borderColor: "var(--border-subtle, #F3F4F6)" }}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-[12.5px] font-semibold text-[var(--ink-primary)] truncate">
                        {course.title}
                      </div>
                      <div className="font-mono text-[9.5px] text-[var(--ink-faint)]">
                        {course.series_slug}
                      </div>
                    </div>
                    <div className="w-[90px]">
                      <div className="h-[7px] rounded-full overflow-hidden" style={{ background: "var(--border-subtle, #E5E7EB)" }}>
                        <span
                          className="block h-full rounded-full"
                          style={{
                            width: `${Math.round((activeEntitlementCount / maxEnt) * 100)}%`,
                            background: "linear-gradient(90deg, var(--color-navy), var(--color-red))",
                          }}
                        />
                      </div>
                    </div>
                    <span className="font-mono text-[11px] font-semibold text-[var(--ink-muted)] w-[30px] text-right">
                      {activeEntitlementCount}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
