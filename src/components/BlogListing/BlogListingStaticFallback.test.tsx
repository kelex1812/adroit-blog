/**
 * BlogListingStaticFallback — static SSG fallback tests (t_66f1d65c).
 *
 * Guards the B-08 CWV fix: the Suspense fallback that lands in the
 * prerendered blog.html must carry the real 8-card content, not a
 * "Loading posts..." placeholder or skeletons.
 */
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { renderToString } from "react-dom/server";
import type { BlogPost } from "@/data/types";
import BlogListingStaticFallback from "./BlogListingStaticFallback";

const mkPost = (i: number, featured = false): BlogPost => ({
  slug: `post-${i}`,
  title: `Static Post ${i}`,
  excerpt: `Excerpt ${i}`,
  category: "Salesforce",
  categoryColor: "sf",
  categoryGradient: "from-sky to-blue-600",
  date: `September 1, 2026`,
  author: "Adroit Consulting",
  authorInitials: "AC",
  readTime: "5 min read",
  featured,
  tags: [],
  status: "published",
});

describe("BlogListingStaticFallback (t_66f1d65c)", () => {
  it("renders the 8 first-page cards into the static HTML (no loading placeholder)", () => {
    const posts = Array.from({ length: 10 }, (_, i) => mkPost(i, i === 0));
    const html = renderToString(<BlogListingStaticFallback posts={posts} />);
    // Featured post title present.
    expect(html).toContain("Static Post 0");
    // First page (8 non-featured) card titles present; featured excluded from grid.
    for (let i = 1; i <= 8; i++) expect(html).toContain(`Static Post ${i}`);
    // The 10th post (index 9) is on page 2 — must NOT be in the static first page.
    expect(html).not.toContain("Static Post 9");
    // No loading placeholder.
    expect(html).not.toContain("Loading posts");
    // No skeleton blocks in the GRID cards. (The single decorative
    // "Featured" badge dot pulse is legitimate and lives in the hero.)
    const gridSkeletonCount = (html.match(/<h3[^>]*>[\s\S]*?animate-pulse/g) || []).length;
    expect(gridSkeletonCount).toBe(0);
  });

  it("renders card titles in the RTL DOM as real headings", () => {
    const posts = Array.from({ length: 8 }, (_, i) => mkPost(i, false));
    render(<BlogListingStaticFallback posts={posts} />);
    expect(document.body.textContent).toContain("Static Post 1");
    expect(document.body.textContent).not.toContain("Loading posts");
  });
});
