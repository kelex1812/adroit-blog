"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { posts as allPosts } from "@/data/posts";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FeaturedPost from "@/components/BlogListing/FeaturedPost";
import PostCard from "@/components/BlogListing/PostCard";
import SortToggle from "@/components/BlogListing/SortToggle";
import { sortPosts, type SortOrder } from "@/lib/sort";

const categories = [
  { key: "all", label: "All Posts" },
  { key: "sf", label: "Salesforce" },
  { key: "react", label: "React & Web Dev" },
  { key: "ai", label: "AI & Consulting" },
  { key: "mkt", label: "Marketing" },
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

  const filtered = allPosts.filter((post) => {
    if (activeCategory === "all") return true;
    return post.categoryColor === activeCategory;
  });

  // Defensive sort — never trust generated array order in a view.
  const sorted = sortPosts(filtered, sortOrder);
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

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
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
          <div className="max-w-[1120px] mx-auto px-6 pt-12 pb-0 relative">
            <div className="inline-flex items-center gap-2 font-mono text-[11px] font-semibold text-red uppercase tracking-[0.08em] mb-[14px]">
              <span className="w-1.5 h-1.5 rounded-full bg-red" />
              Adroit Consulting &mdash; Field Notes
            </div>
            <h1 className="text-[clamp(2.25rem,5vw,3rem)] font-extrabold text-navy tracking-[-0.03em] leading-[1.05] mb-3 bg-gradient-to-r from-navy to-navy-light bg-clip-text text-transparent">
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

            {/* Category Pills */}
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
                      className={`group inline-flex items-center gap-1.5 pl-4 pr-1.5 py-1.5 rounded-full text-xs font-semibold cursor-pointer no-underline transition-all duration-150 ${
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
              <div className="ml-auto">
                <SortToggle />
              </div>
            </div>
          </div>
        </div>

        {/* Featured Post */}
        {featured && activeCategory === "all" && (
          <div className="mt-8">
            <FeaturedPost post={featured} />
          </div>
        )}

        {/* Post Cards Grid */}
        <div className="max-w-[1120px] mx-auto px-6 pb-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {paginatedPosts.map((post) => (
              <PostCard key={post.slug} post={post} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1.5 mt-8">
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="w-9 h-9 rounded-md border border-gray-200 bg-white flex items-center justify-center text-xs font-medium text-gray-600 cursor-pointer hover:bg-gray-50 hover:border-gray-300 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                &lsaquo;
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                (page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`w-9 h-9 rounded-md border flex items-center justify-center text-xs font-medium cursor-pointer transition-all duration-150 ${
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
                className="w-9 h-9 rounded-md border border-gray-200 bg-white flex items-center justify-center text-sm font-medium text-gray-600 cursor-pointer hover:bg-gray-50 hover:border-gray-300 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                &rsaquo;
              </button>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default function BlogListing() {
  return (
    <Suspense fallback={<div className="min-h-screen flex flex-col"><Header /><main className="flex-1 flex items-center justify-center"><div className="text-gray-400 text-sm">Loading posts...</div></main><Footer /></div>}>
      <BlogListingContent />
    </Suspense>
  );
}
