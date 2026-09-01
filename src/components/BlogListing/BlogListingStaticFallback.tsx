/**
 * BlogListingStaticFallback — static first-page content for the /blog SSG.
 *
 * B-08 CWV fix (t_66f1d65c): BlogListingContent calls `useSearchParams()`,
 * which during static prerendering forces the client tree up to the nearest
 * Suspense boundary to be client-rendered — so the prerendered blog.html would
 * otherwise contain only the fallback ("Loading posts..."), with zero post
 * cards in the initial HTML (the exact LCP/CWV claim the build makes).
 *
 * Per the Next.js docs, the Suspense fallback is what lands in the static
 * document. So this fallback renders the REAL first page (default state: All
 * Posts, newest-first, page 1, featured hero shown) from the server-serialized
 * `posts` prop. No hooks, no localStorage, no auth — pure presentational
 * markup, so it is safe to render to static HTML and hydrates cleanly. After
 * hydration the interactive <BlogListingContent> replaces it seamlessly,
 * preserving a stable layout (no flash of empty skeleton).
 */
import type { BlogPost } from "@/data/types";
import { sortPosts } from "@/lib/sort";
import PostCard from "./PostCard";
import FeaturedPost from "./FeaturedPost";

interface BlogListingStaticFallbackProps {
  posts: BlogPost[];
}

export default function BlogListingStaticFallback({
  posts,
}: BlogListingStaticFallbackProps) {
  const postsPerPage = 8;
  const sorted = sortPosts(posts, "newest");
  const featured = sorted.find((p) => p.featured);
  const nonFeatured = sorted.filter((p) => !p.featured);
  const firstPage = nonFeatured.slice(0, postsPerPage);

  return (
    <>
      {/* Featured Post — part of the default All Posts first page */}
      {featured && (
        <div className="mt-8">
          <FeaturedPost post={featured} />
        </div>
      )}

      {/* Post Cards Grid — the 8-card content that must be in initial HTML */}
      <div className="max-w-[1120px] mx-auto px-6 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {firstPage.map((post) => (
            <div key={post.slug} className="relative">
              <PostCard post={post} read={false} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
