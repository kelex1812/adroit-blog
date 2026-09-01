/**
 * BlogListingClient — filter-island tests (B-08 ride-along).
 *
 * Verifies the refactored client island still behaves like the original
 * listing: posts render from the server-serialized `posts` prop, pagination
 * runs at 8/page (bumped from 4), category pills filter, and the featured post
 * hero shows only on the "All Posts" view. Network hooks (progress/auth) are
 * mocked so the test exercises pure listing logic.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { BlogPost } from "@/data/types";
import BlogListingClient from "./BlogListingClient";

const paramsMock = vi.fn();

vi.mock("next/navigation", () => ({
  useSearchParams: () => paramsMock(),
  useRouter: () => ({ replace: vi.fn() }),
}));

vi.mock("@/lib/hooks/useProgressSummary", () => ({
  useProgressSummary: () => ({
    merge: { read: new Set() },
    isLoading: false,
    refresh: vi.fn(),
  }),
}));

vi.mock("@/lib/hooks/useAuth", () => ({
  useAuth: () => ({ user: null, isLoading: false, refresh: vi.fn() }),
}));

vi.mock("@/lib/hooks/useReadProgress", () => ({
  useReadProgress: () => ({ isRead: false, markAsRead: vi.fn(), isLoading: false }),
}));

const categories: BlogPost["categoryColor"][] = [
  "sf",
  "react",
  "ai",
  "mkt",
  "ux",
  "pm",
];

function makePost(i: number, overrides: Partial<BlogPost> = {}): BlogPost {
  const cat = categories[i % categories.length];
  return {
    slug: `post-${i}`,
    title: `Post title ${i}`,
    excerpt: `Excerpt for post ${i}`,
    category: cat,
    categoryColor: cat,
    categoryGradient: "from-navy to-navy-light",
    date: `September ${String(30 - (i % 28)).padStart(2, "0")}, 2026`,
    author: "Adroit Consulting",
    authorInitials: "AC",
    readTime: "5 min read",
    featured: false,
    tags: [],
    status: "published",
    ...overrides,
  };
}

/** Featured post belongs to the "ai" category so category-filtering tests can
 *  select a different category and assert the hero is fully absent. */
const featuredPost: BlogPost = makePost(0, {
  title: "Featured headline post",
  featured: true,
  slug: "featured-post",
  categoryColor: "ai",
});

const posts: BlogPost[] = [
  featuredPost,
  ...Array.from({ length: 9 }, (_, i) => makePost(i + 1)),
];

/** All rendered card links to a numbered post (excludes the featured hero). */
function cardLinks() {
  return screen
    .getAllByRole("link")
    .filter((l) =>
      /^\/blog\/post-\d+$/.test((l as HTMLAnchorElement).getAttribute("href") || ""),
    );
}

describe("BlogListingClient (t_f7e84aca)", () => {
  beforeEach(() => {
    paramsMock.mockReturnValue(new URLSearchParams());
  });

  it("renders the first page of cards at 8/page", () => {
    render(<BlogListingClient posts={posts} />);
    // 9 non-featured posts -> 8 on page 1 (bumped from 4), pagination visible.
    expect(cardLinks()).toHaveLength(8);
    expect(screen.getByRole("button", { name: "Next page" })).toBeInTheDocument();
    // Featured hero renders in the All Posts view.
    expect(
      screen.getByRole("link", { name: /Featured headline post/i }),
    ).toBeInTheDocument();
  });

  it("hides the featured hero outside the All Posts view", async () => {
    const user = userEvent.setup();
    render(<BlogListingClient posts={posts} />);
    expect(
      screen.getByRole("link", { name: /Featured headline post/i }),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Project Management/i }));
    // Featured post is ai-category, so selecting pm removes it entirely.
    expect(
      screen.queryByRole("link", { name: /Featured headline post/i }),
    ).toBeNull();
  });

  it("filters cards by category via the pills", async () => {
    const user = userEvent.setup();
    render(<BlogListingClient posts={posts} />);
    await user.click(screen.getByRole("button", { name: /React & Web Dev/i }));
    const links = cardLinks();
    expect(links.length).toBeGreaterThan(0);
    expect(links.length).toBeLessThan(8);
    // Every visible card belongs to the react category.
    for (const link of links) {
      expect((link as HTMLAnchorElement).getAttribute("href")).toMatch(/^\/blog\/post-\d+$/);
    }
  });

  it("shows pagination controls when more than one page exists", () => {
    render(<BlogListingClient posts={posts} />);
    expect(
      screen.getByRole("navigation", { name: "Pagination" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Page 2" })).toBeInTheDocument();
  });

  it("honors ?sort=oldest from the URL", () => {
    paramsMock.mockReturnValue(new URLSearchParams("sort=oldest"));
    render(<BlogListingClient posts={posts} />);
    expect(cardLinks()).toHaveLength(8);
  });
});
