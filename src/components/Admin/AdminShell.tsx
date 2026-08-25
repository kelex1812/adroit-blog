"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * AdminShell — navy sidebar + content column for the /admin operate surface.
 * kara tokens (design-tokens-course-catalog-admin.css §3): navy sidebar,
 * red active-nav rule, dense tables. Non-admins never reach this shell — the
 * layout guard 404s before rendering (US-016).
 */
const NAV = [
  { href: "/admin", label: "Courses", exact: true },
  { href: "/admin/users", label: "Users", exact: false },
  { href: "/admin/matrix", label: "Access Matrix", exact: false },
  { href: "/admin/audit", label: "Audit Log", exact: false },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = (href: string, exact: boolean) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <div className="min-h-screen flex">
      <aside
        className="w-60 shrink-0 flex flex-col text-white"
        style={{ backgroundColor: "var(--admin-sidebar-bg)" }}
      >
        <div className="px-5 h-16 flex items-center border-b border-white/10">
          <Link href="/admin" className="flex items-center gap-2 no-underline">
            <span className="w-2.5 h-2.5 rounded-sm bg-[var(--color-red)]" />
            <span className="font-extrabold tracking-tight text-[15px]">
              Adroit Admin
            </span>
          </Link>
        </div>
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1" aria-label="Admin">
          {NAV.map((item) => {
            const active = isActive(item.href, item.exact);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`relative rounded-lg px-3 py-2 text-[13.5px] font-medium no-underline transition-colors ${
                  active
                    ? "bg-white/10 text-white"
                    : "text-white/75 hover:bg-white/10 hover:text-white"
                }`}
                style={
                  active
                    ? { boxShadow: "inset 3px 0 0 var(--color-red)" }
                    : undefined
                }
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="px-5 py-4 border-t border-white/10 text-[11px] font-mono text-white/50">
          /admin
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="h-16 flex items-center px-6 border-b bg-[var(--color-off-white)] dark:bg-[var(--surface-page)]" style={{ borderBottom: "1px solid var(--admin-table-border)" }}>
          <span className="font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--admin-table-head)]">
            Course Catalog &amp; Entitlements
          </span>
        </div>
        <main id="main" className="flex-1 px-6 py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
