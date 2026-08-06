import Link from "next/link";
import { BlogPost } from "@/data/types";
import BannerImage from "@/components/BlogListing/BannerImage";

interface FeaturedPostProps {
  post: BlogPost;
}

export default function FeaturedPost({ post }: FeaturedPostProps) {
  return (
    <div className="max-w-[1120px] mx-auto mb-8 px-6">
      <Link
        href={`/blog/${post.slug}`}
        className="block rounded-xl overflow-hidden bg-navy border border-gray-200 grid grid-cols-1 md:grid-cols-2 hover:shadow-lg transition-shadow duration-200 no-underline"
      >
        {/* Image side */}
        <BannerImage
          post={post}
          className="min-h-[160px] md:min-h-[240px]"
          watermark
        />

        {/* Content side */}
        <div className="p-6 md:p-8 flex flex-col justify-center">
          <span className="inline-flex items-center gap-1.5 bg-red/15 text-red-light text-[0.7rem] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider mb-4 w-fit">
            Featured
          </span>
          <h2 className="text-white text-xl md:text-2xl font-bold tracking-tight mb-3 leading-tight">
            {post.title}
          </h2>
          <p className="text-white/60 text-sm leading-relaxed mb-4">
            {post.excerpt}
          </p>
          <div className="flex items-center gap-3 text-xs text-white/40">
            <span>{post.author}</span>
            <span className="w-[3px] h-[3px] bg-white/30 rounded-full" />
            <span>{post.date}</span>
            <span className="w-[3px] h-[3px] bg-white/30 rounded-full" />
            <span>{post.readTime}</span>
          </div>
        </div>
      </Link>
    </div>
  );
}
