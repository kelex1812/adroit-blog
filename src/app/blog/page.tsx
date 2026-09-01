/**
 * /blog listing — server component (B-08 ride-along).
 *
 * SSGs the first page of post cards at build time (post content present in the
 * initial HTML — fixes LCP / INP / CWV, Brainiac #3 + #9) and imports the 48 KB
 * `posts.ts` dataset server-side only, so it no longer rides in the client JS
 * bundle. The interactive filters (category pills, read filter, sort toggle,
 * pagination) live in the <BlogListingClient> island, which receives the posts
 * as a serialized RSC prop. Behavior is unchanged from the previous fully
 * client-side listing.
 */
import { Suspense } from "react";
import { posts } from "@/data/posts";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BlogListingClient from "@/components/BlogListing/BlogListingClient";

export default function BlogListing() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main id="main" className="flex-1">
        <Suspense
          fallback={
            <div className="flex items-center justify-center py-24">
              <div className="text-gray-500 text-sm">Loading posts...</div>
            </div>
          }
        >
          <BlogListingClient posts={posts} />
        </Suspense>
      </main>

      <Footer />
    </div>
  );
}
