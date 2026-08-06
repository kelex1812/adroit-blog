import Link from "next/link";
import { BlogPost } from "@/data/types";
import { Tag } from "@/components/Tag";
import BannerImage from "@/components/BlogListing/BannerImage";

interface PostCardProps {
  post: BlogPost;
}

export default function PostCard({ post }: PostCardProps) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="block rounded-xl overflow-hidden border border-gray-200 bg-white hover:shadow-md hover:border-gray-300 transition-all duration-200 no-underline"
    >
      {/* Image header */}
      <div className="relative">
        <BannerImage
          post={post}
          className="h-[100px] md:h-[140px]"
          watermark={false}
        />
        <span className="absolute bottom-2.5 left-3 bg-white/20 backdrop-blur-sm px-2 py-0.5 rounded text-[0.65rem] font-semibold text-white z-10">
          {post.category}
        </span>
      </div>

      {/* Body */}
      <div className="p-4">
        <Tag label={post.category} color={post.categoryColor} />
        <h3 className="text-base font-bold text-gray-900 mt-2 mb-1.5 leading-snug tracking-tight">
          {post.title}
        </h3>
        <p className="text-xs text-gray-500 leading-relaxed mb-2.5 line-clamp-2">
          {post.excerpt}
        </p>
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>{post.date}</span>
          <span className="text-red font-semibold">Read more &rarr;</span>
        </div>
      </div>
    </Link>
  );
}
