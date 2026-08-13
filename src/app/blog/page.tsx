"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { posts as allPosts } from "@/data/posts";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FeaturedPost from "@/components/BlogListing/FeaturedPost";
import PostCardWithRead from "@/components/BlogListing/PostCardWithRead";
import ReadFilter, { type ReadFilterValue } from "@/components/BlogListing/ReadFilter";
import SortToggle from "@/components/BlogListing/SortToggle";
import { sortPosts, type SortOrder } from "@/lib/sort";
import MarkAsRead from "@/components/Progress/MarkAsRead";
import BlogReadProgress from "@/components/Progress/BlogReadProgress";
import { useProgressSummary } from "@/lib/hooks/useProgressSummary";
import { useAuth } from "@/lib/hooks/useAuth";

const categories = [
  { key: "all", label: "All Posts" },
  { key: "sf", label: "Salesforce" },
  { key: "react", label: "React & Web Dev" },
  { key: "ai", label: "AI & Consulting" },
  { key: "mkt", label: "Marketing" },
  { key: "ux", label: "UI/UX" },
  { key: "pm", label: "Project Management" },
];

function BlogListingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const categoryFromUrl = searchParams.get("category") || "all";
  const normalized =
    categories.some((c) => c.key === categoryFromUrl) ? categoryFromUrl : "all";
  const [activeCategory, setActiveCategory] = useState(normalized);
  const [currentPage, setCurrentPage] = useState(1);
  const postsPerPage = 4;
  const sortOrder: SortOrder =
    searchParams.get("sort") === "oldest" ? "oldest" : "newest";

  // Read filter from ?read=all|unread|read (design brief §4.2)
  const readParam = searchParams.get("read");
  const readFilter: ReadFilterValue =
    readParam === "unread" || readParam === "read" ? readParam : "all";

  const filtered = allPosts.filter((post) => {
    if (activeCategory === "all") return true;
    return post.categoryColor === activeCategory;
  });

  // Canonical read keys for the visible category set
  // Canonical read keys for the visible category set (cheap — ≤13 posts)
  const readKeys = filtered.map((post) => `blog/${post.slug}`);

  const { merge } = useProgressSummary(readKeys, []);

  // Apply the read filter against the REAL merged read state
  const readFiltered = useMemo(() => {
    if (readFilter === "all") return filtered;
    return filtered.filter((post) => {
      const isRead = merge.read.has(`blog/${post.slug}`);
      return readFilter === "read" ? isRead : !isRead;
    });
  }, [filtered, readFilter, merge.read]);

  // Defensive sort — never trust generated array order in a view.
  const sorted = sortPosts(readFiltered, sortOrder);
  const featured = sorted.find((p) => p.featured);
  const nonFeatured = sorted.filter((p) => !p.featured);

  const totalPages = Math.max(
    1,
    Math.ceil(nonFeatured.length / postsPerPage),
  );
  const startIdx = (currentPage - 1) * postsPerPage;
  const paginatedPosts = nonFeatured.slice(startIdx, startIdx + postsPerPage);

  function handleCategoryClick(key: string) {
    setActiveCategory(key);
    setCurrentPage(1);
    const params = new URLSearchParams(searchParams.toString());
    if (key === "all") {
      params.delete("category");
    } else {
      params.set("category", key);
    }
    const qs = params.toString();
    router.replace(qs ? `/blog?${qs}` : "/blog", { scroll: false });
  }

  function handleReadFilterChange(value: ReadFilterValue) {
    setCurrentPage(1);
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete("read");
    } else {
      params.set("read", value);
    }
    const qs = params.toString();
    router.replace(qs ? `/blog?${qs}` : "/blog", { scroll: false });
  }

  const { user, isLoading: authLoading } = useAuth();

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main id="main" className="flex-1">
        {/* Hero */}
        <div className="relative overflow-hidden">
          {/* Ambient brand glow — subtle depth behind the hero */}
          <div
            aria-hidden
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(60% 120% at 12% -10%, rgba(200,16,46,0.07) 0%, transparent 60%), radial-gradient(50% 100% at 88% -20%, rgba(11,29,58,0.08) 0%, transparent 55%)",
            }}
          />
          <div className="max-w-[1120px] mx-auto px-6 pt-12 pb-0 relative hero-fade-in">
            <div className="inline-flex items-center gap-2 font-mono text-[11px] font-semibold text-red uppercase tracking-[0.08em] mb-[14px]">
              <span className="w-1.5 h-1.5 rounded-full bg-red" />
              Adroit Consulting &mdash; Field Notes
            </div>
            <h1 className="text-[clamp(2.25rem,5vw,3rem)] font-extrabold text-navy tracking-[-0.03em] leading-[1.05] mb-3 bg-gradient-to-r from-navy to-navy-light dark:from-slate-100 dark:to-slate-300 bg-clip-text text-transparent">
              Adroit Consulting Blog
            </h1>
            <p className="text-[1.0625rem] text-gray-500 max-w-[560px] leading-relaxed">
              Insights on Salesforce, React, AI, and digital transformation to
              help your business scale smarter.
            </p>
            <a
              href="/feed.xml"
              className="inline-flex items-center gap-2 text-xs text-gray-400 mt-3 hover:text-navy transition-colors duration-150 no-underline group"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="w-6 h-6 rounded-md border border-gray-200 bg-white flex items-center justify-center text-[0.65rem] text-gray-400 group-hover:border-red group-hover:text-red transition-colors duration-150">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="4" cy="20" r="3" />
                  <path d="M4 11a9 9 0 0 1 9 9h3a12 12 0 0 0-12-12v3z" />
                  <path d="M4 4a16 16 0 0 1 16 16h3a19 19 0 0 0-19-19v3z" />
                </svg>
              </span>
              RSS Feed
            </a>

            {/* Category Pills + Read Filter + Sort */}
            <div className="flex flex-wrap items-center gap-2 mt-7 pb-8 border-b border-gray-200">
              <div className="flex flex-wrap gap-2">
                {categories.map((cat) => {
                  const count =
                    cat.key === "all"
                      ? allPosts.length
                      : allPosts.filter((p) => p.categoryColor === cat.key)
                          .length;
                  const active = activeCategory === cat.key;
                  return (
                    <button
                      key={cat.key}
                      onClick={() => handleCategoryClick(cat.key)}
                      aria-pressed={active}
                      className={`group inline-flex items-center gap-1.5 pl-4 pr-1.5 py-1.5 rounded-full text-xs font-semibold cursor-pointer no-underline transition-all duration-150 active:scale-[0.98] ${
                        active
                          ? "bg-navy text-white shadow-md shadow-navy/20"
                          : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50 hover:border-gray-300 hover:-translate-y-px"
                      }`}
                    >
                      {cat.label}
                      <span
                        className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full font-mono text-[10.5px] font-bold tabular-nums transition-colors duration-150 ${
                          active
                            ? "bg-white/15 text-white"
                            : "bg-gray-100 text-gray-400 group-hover:bg-gray-200 group-hover:text-gray-500"
                        }`}
                      >
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
              {/* Read Filter + Sort — wrap on narrow viewports so the
                  controls never clip off the right edge (390px QA finding) */}
              <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
                <ReadFilter
                  readKeys={readKeys}
                  value={readFilter}
                  onChange={handleReadFilterChange}
                />
                <SortToggle />
              </div>
            </div>
          </div>
        </div>

        {/* Featured Post */}
        {featured && activeCategory === "all" && readFilter === "all" && (
          <div className="mt-8">
            <FeaturedPost post={featured} />
          </div>
        )}

        {/* Reading progress — real merged read count across the listing */}
        <BlogReadProgress postSlugs={filtered.map((p) => p.slug)} />

        {/* Sign-in prompt — per-user cross-device sync (design brief §4.3) */}
        {!authLoading && !user && (
          <div className="max-w-[1120px] mx-auto px-6 mb-6">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border-default)] bg-[var(--surface-card)] px-4 py-3">
              <p className="text-[12.5px] text-gray-500 leading-relaxed">
                Progress is saved on this device.{" "}
                <span className="hidden sm:inline">Sign in to sync across devices.</span>
              </p>
              <Link
                href="/login?next=/blog"
                className="flex-shrink-0 text-[12px] font-bold text-navy underline underline-offset-2 decoration-red/40 hover:decoration-red no-underline transition-colors duration-150"
              >
                Sign in
              </Link>
            </div>
          </div>
        )}

        {/* Post Cards Grid */}
        <div className="max-w-[1120px] mx-auto px-6 pb-10">
          {paginatedPosts.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-gray-300 bg-white/60 px-6 py-12 text-center">
              <p className="text-[14.5px] font-semibold text-gray-700">
                {readFilter === "unread"
                  ? "No unread posts in this category."
                  : readFilter === "read"
                    ? "No read posts in this category yet."
                    : "No posts in this category yet."}
              </p>
              <p className="text-[12.5px] text-gray-400 mt-1.5">
                {readFilter !== "all" ? (
                  <>
                    Try the{" "}
                    <button
                      onClick={() => handleReadFilterChange("all")}
                      className="font-semibold text-navy underline underline-offset-2 decoration-red/40 hover:decoration-red cursor-pointer bg-none border-none"
                    >
                      All
                    </button>{" "}
                    filter to see everything.
                  </>
                ) : (
                  "Check back soon for new posts."
                )}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {paginatedPosts.map((post) => (
                <div key={post.slug} className="relative">
                  <PostCardWithRead post={post} />
                  <div className="mt-2 px-1">
                    <MarkAsRead slug={`blog/${post.slug}`} contentType="blog" showLabel={false} label={post.title} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && paginatedPosts.length > 0 && (
            <nav
              aria-label="Pagination"
              className="flex items-center justify-center gap-1.5 mt-8"
            >
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                aria-label="Previous page"
                className="w-9 h-9 rounded-md border border-gray-200 bg-white flex items-center justify-center text-xs font-medium text-gray-600 cursor-pointer hover:bg-gray-50 hover:border-gray-300 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
              >
                &lsaquo;
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                (page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    aria-current={page === currentPage ? "page" : undefined}
                    aria-label={`Page ${page}`}
                    className={`w-9 h-9 rounded-md border flex items-center justify-center text-xs font-medium cursor-pointer transition-all duration-150 active:scale-[0.98] ${
                      page === currentPage
                        ? "bg-navy text-white border-navy"
                        : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:border-gray-300"
                    }`}
                  >
                    {page}
                  </button>
                ),
              )}
              <button
                onClick={() =>
                  setCurrentPage(Math.min(totalPages, currentPage + 1))
                }
                disabled={currentPage === totalPages}
                aria-label="Next page"
                className="w-9 h-9 rounded-md border border-gray-200 bg-white flex items-center justify-center text-sm font-medium text-gray-600 cursor-pointer hover:bg-gray-50 hover:border-gray-300 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
              >
                &rsaquo;
              </button>
            </nav>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default function BlogListing() {
  return (
    <Suspense fallback={<div className="min-h-screen flex flex-col"><Header /><main id="main" className="flex-1 flex items-center justify-center"><div className="text-gray-400 text-sm">Loading posts...</div></main><Footer /></div>}>
      <BlogListingContent />
    </Suspense>
  );
}
