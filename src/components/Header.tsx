"use client";

import { useState } from "react";
import Link from "next/link";

const navLinks = [
  { href: "/blog", label: "Posts" },
  { href: "/blog/categories", label: "Categories" },
  { href: "https://adroit.io", label: "Adroit.io", external: true },
];

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200">
      <div className="max-w-[1120px] mx-auto px-6 h-16 flex items-center justify-between">
        <Link href="/blog" className="flex items-center gap-2.5 no-underline text-navy">
          <div className="w-8 h-8 bg-navy rounded-sm flex items-center justify-center text-white font-extrabold text-sm">
            A
          </div>
          <span className="font-bold text-lg tracking-tight">Adroit</span>
          <span className="bg-red text-white text-[0.6rem] font-bold px-1.5 py-0.5 rounded-[3px] tracking-wider uppercase">
            BLOG
          </span>
        </Link>

        {/* Desktop Nav */}
        <nav className="hidden md:flex items-center gap-7">
          {navLinks.map((link) =>
            link.external ? (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-500 text-sm font-medium hover:text-navy transition-colors duration-150 no-underline"
              >
                {link.label}
              </a>
            ) : (
              <Link
                key={link.href}
                href={link.href}
                className="text-gray-500 text-sm font-medium hover:text-navy transition-colors duration-150 no-underline aria-[current=page]:text-navy aria-[current=page]:font-semibold"
              >
                {link.label}
              </Link>
            ),
          )}
          <Link
            href="https://adroit.io/contact"
            className="bg-navy text-white px-[18px] py-2 rounded-sm text-[0.8rem] font-semibold hover:bg-navy-light transition-colors duration-150 no-underline"
          >
            Contact Us
          </Link>
        </nav>

        {/* Mobile Hamburger */}
        <button
          className="md:hidden bg-none border-none cursor-pointer p-1"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          <span className="block w-5 h-[2px] bg-navy my-[3px] rounded-[1px] transition-all duration-150" />
          <span className="block w-5 h-[2px] bg-navy my-[3px] rounded-[1px] transition-all duration-150" />
          <span className="block w-5 h-[2px] bg-navy my-[3px] rounded-[1px] transition-all duration-150" />
        </button>
      </div>

      {/* Mobile Nav */}
      {mobileOpen && (
        <div className="md:hidden flex flex-col px-5 py-4 gap-4 border-t border-gray-200 bg-white">
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
                className="text-gray-700 text-sm font-medium py-2 border-b border-gray-100 no-underline"
                onClick={() => setMobileOpen(false)}
              >
                {link.label}
              </Link>
            ),
          )}
          <Link
            href="https://adroit.io/contact"
            className="bg-navy text-white text-center px-[18px] py-2 rounded-sm text-sm font-semibold hover:bg-navy-light no-underline"
            onClick={() => setMobileOpen(false)}
          >
            Contact Us
          </Link>
        </div>
      )}
    </header>
  );
}
