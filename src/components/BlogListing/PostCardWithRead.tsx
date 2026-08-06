/**
 * PostCardWithRead — client wrapper that wires the real read state
 * (localStorage + Supabase merge via useReadProgress) into PostCard.
 *
 * The blog listing renders cards in a loop, so hooks can't be called
 * there directly — this per-card component is the hook boundary
 * (design brief §4.1 read/unread dimming).
 */
"use client";

import { BlogPost } from "@/data/types";
import { useReadProgress } from "@/lib/hooks/useReadProgress";
import PostCard from "./PostCard";

interface PostCardWithReadProps {
  post: BlogPost;
}

export default function PostCardWithRead({ post }: PostCardWithReadProps) {
  // Canonical read key matches MarkAsRead: `blog/<slug>`
  const { isRead, isLoading } = useReadProgress(`blog/${post.slug}`, "blog");

  if (isLoading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
        <div className="h-[100px] md:h-[140px] bg-gray-100 animate-pulse" />
        <div className="p-4 space-y-2">
          <div className="h-3 bg-gray-100 animate-pulse rounded" />
          <div className="h-4 w-3/4 bg-gray-100 animate-pulse rounded" />
          <div className="h-3 w-full bg-gray-100 animate-pulse rounded" />
        </div>
      </div>
    );
  }

  return <PostCard post={post} read={isRead} />;
}
