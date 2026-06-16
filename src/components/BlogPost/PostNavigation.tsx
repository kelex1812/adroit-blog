import Link from "next/link";
import { BlogPost } from "@/data/posts";

interface PostNavigationProps {
  prev?: BlogPost;
  next?: BlogPost;
}

export default function PostNavigation({ prev, next }: PostNavigationProps) {
  return (
    <div className="max-w-[720px] mx-auto px-6 py-6 grid grid-cols-2 gap-4">
      {prev ? (
        <Link
          href={`/blog/${prev.slug}`}
          className="p-5 border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-sm transition-all duration-150 no-underline"
        >
          <div className="text-[0.7rem] text-gray-400 uppercase tracking-wider font-semibold mb-1.5">
            &larr; Previous
          </div>
          <h4 className="text-sm font-semibold text-navy leading-snug">
            {prev.title}
          </h4>
        </Link>
      ) : (
        <div />
      )}
      {next ? (
        <Link
          href={`/blog/${next.slug}`}
          className="p-5 border border-gray-200 rounded-xl hover:border-gray-300 hover:shadow-sm transition-all duration-150 no-underline text-right"
        >
          <div className="text-[0.7rem] text-gray-400 uppercase tracking-wider font-semibold mb-1.5">
            Next &rarr;
          </div>
          <h4 className="text-sm font-semibold text-navy leading-snug">
            {next.title}
          </h4>
        </Link>
      ) : (
        <div />
      )}
    </div>
  );
}
