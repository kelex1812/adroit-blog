/**
 * Tag aggregation utilities for the Adroit Blog tags system.
 */

import { posts, type BlogPost } from "@/data/posts";

export interface TagInfo {
  tag: string;
  slug: string;
  count: number;
  posts: BlogPost[];
}

/**
 * Build a complete list of tags from all posts, with post counts.
 */
export function getAllTags(): TagInfo[] {
  const map = new Map<string, BlogPost[]>();

  for (const post of posts) {
    const tags = post.tags ?? [];
    for (const tag of tags) {
      const existing = map.get(tag) ?? [];
      existing.push(post);
      map.set(tag, existing);
    }
  }

  return Array.from(map.entries())
    .map(([tag, taggedPosts]) => ({
      tag,
      slug: tag.toLowerCase().replace(/\s+/g, "-"),
      count: taggedPosts.length,
      posts: taggedPosts,
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Get all unique tag slugs for static generation.
 */
export function getAllTagSlugs(): string[] {
  return getAllTags().map((t) => t.slug);
}

/**
 * Look up a tag by its URL slug. Returns undefined if not found.
 */
export function getTagBySlug(slug: string): TagInfo | undefined {
  return getAllTags().find((t) => t.slug === slug);
}
