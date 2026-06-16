"use client";

import { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { posts as allPosts, BlogPost } from "@/data/posts";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FeaturedPost from "@/components/BlogListing/FeaturedPost";
import PostCard from "@/components/BlogListing/PostCard";

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

  const filtered = allPosts.filter((post) => {
    if (activeCategory === "all") return true;
    return post.categoryColor === activeCategory;
  });

  const featured = filtered.find((p) => p.featured);
  const nonFeatured = filtered.filter((p) => !p.featured);

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
        <div className="max-w-[1120px] mx-auto px-6 pt-12 pb-0">
          <h1 className="text-3xl md:text-4xl font-extrabold text-navy tracking-tight mb-2">
            Adroit Consulting Blog
          </h1>
          <p className="text-[1.0625rem] text-gray-500 max-w-[560px] leading-relaxed">
            Insights on Salesforce, React, AI, and digital transformation to
            help your business scale smarter.
          </p>

          {/* Category Pills */}
          <div className="flex flex-wrap gap-2 mt-6 pb-8 border-b border-gray-200">
            {categories.map((cat) => (
              <button
                key={cat.key}
                onClick={() => handleCategoryClick(cat.key)}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold cursor-pointer no-underline transition-all duration-150 ${
                  activeCategory === cat.key
                    ? "bg-navy text-white"
                    : "bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200 hover:border-gray-300"
                }`}
              >
                {cat.label}
              </button>
            ))}
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
