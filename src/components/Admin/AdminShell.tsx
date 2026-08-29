"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * AdminShell — navy sidebar + content column for the /admin operate surface.
 * kara tokens (design-tokens-course-catalog-admin.css §3): navy sidebar,
 * red active-nav rule, dense tables. Non-admins never reach this shell — the
 * layout guard 404s before rendering (US-016).
 *
 * v4 (t_0ed19ad0): added an Overview (dashboard) nav + Analytics; Courses is
 * now /admin/courses (the dashboard is the /admin landing).
 */
type NavSection = { section?: string; href: string; label: string; exact?: boolean };

const NAV: NavSection[] = [
  { href: "/admin", label: "Dashboard", exact: true },
  { section: "Management", href: "/admin/courses", label: "Courses" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/matrix", label: "Access Matrix" },
  { section: "System", href: "/admin/analytics", label: "Analytics" },
  { href: "/admin/audit", label: "Audit Log" },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isActive = (href: string, exact: boolean | undefined) =>
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
          {NAV.map((item, i) => (
            <div key={item.href}>
              {item.section && i > 0 && (
                <div className="font-mono text-[9.5px] font-bold uppercase tracking-[0.1em] text-white/30 px-3 pt-3.5 pb-1.5">
                  {item.section}
                </div>
              )}
              <Link
                href={item.href}
                aria-current={isActive(item.href, item.exact) ? "page" : undefined}
                className={`relative rounded-lg px-3 py-2 text-[13.5px] font-medium no-underline transition-colors ${
                  isActive(item.href, item.exact)
                    ? "bg-white/10 text-white"
                    : "text-white/75 hover:bg-white/10 hover:text-white"
                }`}
                style={
                  isActive(item.href, item.exact)
                    ? { boxShadow: "inset 3px 0 0 var(--color-red)" }
                    : undefined
                }
              >
                {item.label}
              </Link>
            </div>
          ))}
        </nav>
        <div className="px-5 py-4 border-t border-white/10 flex flex-col gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-[12.5px] font-semibold no-underline text-white/75 hover:text-white transition-colors"
          >
            <span aria-hidden className="text-white/50">
              &larr;
            </span>
            Back to site
          </Link>
          <div className="font-mono text-[11px] text-white/50">/admin</div>
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
