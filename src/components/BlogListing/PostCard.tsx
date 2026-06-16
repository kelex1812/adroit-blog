import Link from "next/link";
import { BlogPost } from "@/data/posts";
import { Tag } from "@/components/Tag";

interface PostCardProps {
  post: BlogPost;
}

const gradientMap: Record<string, string> = {
  sf: "from-sky to-blue-600",
  react: "from-emerald to-green-600",
  ai: "from-amber to-yellow-600",
  mkt: "from-pink to-rose-600",
};

export default function PostCard({ post }: PostCardProps) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="block rounded-xl overflow-hidden border border-gray-200 bg-white hover:shadow-md hover:border-gray-300 transition-all duration-200 no-underline"
    >
      {/* Image header */}
      <div
        className={`h-[100px] md:h-[140px] relative overflow-hidden bg-gradient-to-br ${gradientMap[post.categoryColor]}`}
      >
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/15" />
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
