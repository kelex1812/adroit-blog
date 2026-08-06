"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth, notifyAuthChanged } from "@/lib/hooks/useAuth";

const navLinks = [
  { href: "/blog", label: "Posts" },
  { href: "/blog/categories", label: "Categories" },
  { href: "/learn", label: "Learn" },
  { href: "https://adroit.io", label: "Adroit.io", external: true },
];

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const isLearnActive = pathname === "/learn" || pathname.startsWith("/learn/");
  const { user, isLoading } = useAuth();
  const [isSigningOut, startTransition] = useTransition();

  function handleSignOut() {
    startTransition(async () => {
      try {
        await fetch("/api/auth/logout", { method: "POST" });
      } catch {
        // best-effort — the session may already be gone
      }
      notifyAuthChanged();
      router.refresh();
    });
  }

  const authControl = isLoading ? null : user ? (
    <div className="flex items-center gap-2">
      <span
        className="hidden lg:inline-block max-w-[140px] truncate font-mono text-[10.5px] font-semibold text-gray-400 uppercase tracking-wide"
        title={user.email}
      >
        {user.email}
      </span>
      <button
        onClick={handleSignOut}
        disabled={isSigningOut}
        className="text-gray-500 text-sm font-medium hover:text-navy transition-colors duration-150 cursor-pointer bg-none border-none disabled:opacity-50"
      >
        {isSigningOut ? "…" : "Sign out"}
      </button>
    </div>
  ) : (
    <Link
      href={`/login${pathname && pathname !== "/login" ? `?next=${encodeURIComponent(pathname)}` : ""}`}
      className="text-gray-500 text-sm font-medium hover:text-navy transition-colors duration-150 no-underline"
    >
      Sign in
    </Link>
  );

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b border-gray-200 shadow-[0_1px_0_rgba(11,29,58,0.03)]">
      <div className="max-w-[1120px] mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/blog" className="flex items-center gap-2.5 no-underline text-navy group">
          <div className="w-8 h-8 bg-navy rounded-sm flex items-center justify-center text-white font-extrabold text-sm transition-transform duration-150 group-hover:scale-105">
            A
          </div>
          <span className="font-bold text-lg tracking-tight">Adroit</span>
          <span className="bg-red text-white text-[0.6rem] font-bold px-1.5 py-0.5 rounded-[3px] tracking-wider uppercase">
            BLOG
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav aria-label="Main" className="hidden md:flex items-center gap-7">
          {navLinks.map((link) =>
            link.external ? (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="relative text-gray-500 text-sm font-medium hover:text-navy transition-colors duration-150 no-underline"
              >
                {link.label}
              </a>
            ) : (
              <Link
                key={link.href}
                href={link.href}
                aria-current={
                  link.href === "/learn" && isLearnActive ? "page" : undefined
                }
                className="relative text-gray-500 text-sm font-medium hover:text-navy transition-colors duration-150 no-underline aria-[current=page]:text-navy aria-[current=page]:font-semibold"
              >
                {link.label}
                <span
                  aria-hidden
                  className={`absolute -bottom-[18px] left-0 right-0 h-[2px] rounded-full bg-red transition-opacity duration-150 ${
                    (link.href === "/learn" && isLearnActive) ||
                    pathname === link.href
                      ? "opacity-100"
                      : "opacity-0"
                  }`}
                />
              </Link>
            ),
          )}
          <div className="flex items-center gap-4 pl-2 border-l border-gray-100">
            {authControl}
            <Link
              href="https://adroit.io/contact"
              className="bg-navy text-white px-[18px] py-2 rounded-sm text-[0.8rem] font-semibold hover:bg-navy-light hover:-translate-y-px active:scale-[0.98] transition-all duration-150 no-underline"
            >
              Contact Us
            </Link>
          </div>
        </nav>

        {/* Mobile Hamburger */}
        <div className="flex items-center gap-3 md:hidden">
          {authControl}
          <button
            className="bg-none border-none cursor-pointer p-1"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
          >
            <span className="block w-5 h-[2px] bg-navy my-[3px] rounded-[1px] transition-all duration-150" />
            <span className="block w-5 h-[2px] bg-navy my-[3px] rounded-[1px] transition-all duration-150" />
            <span className="block w-5 h-[2px] bg-navy my-[3px] rounded-[1px] transition-all duration-150" />
          </button>
        </div>
      </div>

      {/* Mobile Nav */}
      {mobileOpen && (
        <nav
          id="mobile-nav"
          aria-label="Mobile"
          className="md:hidden flex flex-col px-5 py-4 gap-4 border-t border-gray-200 bg-white"
        >
          {navLinks.map((link) =>
            link.external ? (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-700 text-sm font-medium py-2 border-b border-gray-100 no-underline"
              >
                {link.label}
              </a>
            ) : (
              <Link
                key={link.href}
                href={link.href}
                aria-current={
                  link.href === "/learn" && isLearnActive ? "page" : undefined
                }
                className="text-gray-700 text-sm font-medium py-2 border-b border-gray-100 no-underline aria-[current=page]:text-navy aria-[current=page]:font-semibold"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ),
          )}
          {!isLoading && !user && (
            <Link
              href={`/login${pathname && pathname !== "/login" ? `?next=${encodeURIComponent(pathname)}` : ""}`}
              className="text-gray-700 text-sm font-medium py-2 border-b border-gray-100 no-underline"
              onClick={() => setMobileOpen(false)}
            >
              Sign in
            </Link>
          )}
          {!isLoading && user && (
            <button
              onClick={() => {
                handleSignOut();
                setMobileOpen(false);
              }}
              className="text-left text-gray-700 text-sm font-medium py-2 border-b border-gray-100 no-underline cursor-pointer bg-none border-none"
            >
              Sign out ({user.email})
            </button>
          )}
          <Link
            href="https://adroit.io/contact"
            className="bg-navy text-white text-center px-[18px] py-2 rounded-sm text-sm font-semibold hover:bg-navy-light no-underline"
            onClick={() => setMobileOpen(false)}
          >
            Contact Us
          </Link>
        </nav>
      )}
    </header>
  );
}
