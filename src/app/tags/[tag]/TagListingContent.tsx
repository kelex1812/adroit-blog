"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PostCard from "@/components/BlogListing/PostCard";
import FeaturedPost from "@/components/BlogListing/FeaturedPost";
import SortToggle from "@/components/BlogListing/SortToggle";
import { sortPosts } from "@/lib/sort";
import type { TagInfo } from "@/lib/tags";

function TagPageContent({ tagInfo }: { tagInfo: TagInfo }) {
  const searchParams = useSearchParams();
  const sortOrder = searchParams.get("sort") === "oldest" ? "oldest" : "newest";

  const sorted = sortPosts(tagInfo.posts, sortOrder);
  const featured = sorted.find((p) => p.featured);
  const nonFeatured = sorted.filter((p) => !p.featured);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        <div className="max-w-[1120px] mx-auto px-6 pt-12 pb-0">
          <Link
            href="/tags"
            className="inline-flex items-center gap-1.5 text-gray-500 text-xs font-medium no-underline mb-6 hover:text-navy transition-colors duration-150"
          >
            &larr; All Tags
          </Link>
          <h1 className="text-3xl md:text-4xl font-extrabold text-navy tracking-tight mb-2">
            {tagInfo.tag}
          </h1>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[1.0625rem] text-gray-500 max-w-[560px] leading-relaxed">
              {tagInfo.count} {tagInfo.count === 1 ? "post" : "posts"} tagged
              with this topic.
            </p>
            <SortToggle compact />
          </div>
        </div>

        {featured && (
          <div className="mt-8">
            <FeaturedPost post={featured} />
          </div>
        )}

        {nonFeatured.length > 0 && (
          <div className="max-w-[1120px] mx-auto px-6 py-8 pb-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {nonFeatured.map((post) => (
                <PostCard key={post.slug} post={post} />
              ))}
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

export default function TagListingContent({ tagInfo }: { tagInfo: TagInfo }) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex flex-col">
          <Header />
          <main className="flex-1 flex items-center justify-center">
            <div className="text-gray-400 text-sm">Loading posts...</div>
          </main>
          <Footer />
        </div>
      }
    >
      <TagPageContent tagInfo={tagInfo} />
    </Suspense>
  );
}
