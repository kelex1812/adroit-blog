import Link from "next/link";
import { BlogPost } from "@/data/posts";

interface FeaturedPostProps {
  post: BlogPost;
}

const gradientMap: Record<string, string> = {
  sf: "from-sky via-sky to-blue-600",
  react: "from-emerald via-emerald to-green-600",
  ai: "from-amber via-amber to-yellow-600",
  mkt: "from-pink via-pink to-rose-600",
};

export default function FeaturedPost({ post }: FeaturedPostProps) {
  return (
    <div className="max-w-[1120px] mx-auto mb-8 px-6">
      <Link
        href={`/blog/${post.slug}`}
        className="block rounded-xl overflow-hidden bg-navy border border-gray-200 grid grid-cols-1 md:grid-cols-2 hover:shadow-lg transition-shadow duration-200 no-underline"
      >
        {/* Image side */}
        <div
          className={`bg-gradient-to-br ${gradientMap[post.categoryColor]} min-h-[160px] md:min-h-[240px] flex items-center justify-center relative overflow-hidden`}
        >
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 30% 40%, rgba(200,16,46,0.15) 0%, transparent 50%), radial-gradient(circle at 70% 60%, rgba(14,165,233,0.1) 0%, transparent 50%)",
            }}
          />
          <span className="text-white/15 text-6xl md:text-7xl font-extrabold relative z-10 select-none">
            {post.category === "AI & Consulting" ? "AI" : "AC"}
          </span>
        </div>

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
