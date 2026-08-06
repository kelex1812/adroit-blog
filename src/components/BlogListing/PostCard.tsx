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
      className="group block rounded-xl overflow-hidden border border-gray-200 bg-white shadow-card hover:shadow-card-hover hover:border-navy/15 hover:-translate-y-1 transition-all duration-300 no-underline"
    >
      {/* Image header */}
      <div className="relative overflow-hidden">
        <div className="transition-transform duration-500 ease-out group-hover:scale-[1.04]">
          <BannerImage
            post={post}
            className="h-[100px] md:h-[140px]"
            watermark={false}
          />
        </div>
        <span className="absolute bottom-2.5 left-3 bg-white/20 backdrop-blur-sm px-2 py-0.5 rounded text-[0.65rem] font-semibold text-white z-10">
          {post.category}
        </span>
      </div>

      {/* Body */}
      <div className="p-4">
        <div className="flex items-center justify-between">
          <Tag label={post.category} color={post.categoryColor} />
          <span className="text-[0.65rem] font-mono text-gray-300 tabular-nums">
            {post.readTime}
          </span>
        </div>
        <h3 className="text-lg font-bold text-gray-900 mt-2.5 mb-1.5 leading-snug tracking-tight transition-colors duration-200 group-hover:text-red">
          {post.title}
        </h3>
        <p className="text-xs text-gray-500 leading-relaxed mb-3 line-clamp-2">
          {post.excerpt}
        </p>
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span className="font-mono text-[0.7rem]">{post.date}</span>
          <span className="inline-flex items-center gap-1 text-red font-semibold">
            Read more
            <span className="transition-transform duration-300 group-hover:translate-x-0.5">
              &rarr;
            </span>
          </span>
        </div>
      </div>
    </Link>
  );
}
