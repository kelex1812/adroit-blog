import Link from "next/link";
import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { getAllTags } from "@/lib/tags";
import { buildMetadata } from "@/lib/seo";

export const metadata: Metadata = buildMetadata({
  title: "Tags — Adroit Consulting Blog",
  description: "Browse all blog post tags covering Salesforce, React, AI, and digital transformation.",
  path: "/tags",
});

export default function TagsPage() {
  const allTags = getAllTags();

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        <div className="max-w-[1120px] mx-auto px-6 pt-12 pb-0">
          <h1 className="text-3xl md:text-4xl font-extrabold text-navy tracking-tight mb-2">
            Tags
          </h1>
          <p className="text-[1.0625rem] text-gray-500 max-w-[560px] leading-relaxed mb-8">
            Browse content by topic tag.
          </p>
        </div>

        <div className="max-w-[1120px] mx-auto px-6 pb-10">
          <div className="flex flex-wrap gap-3">
            {allTags.map((tag) => (
              <Link
                key={tag.slug}
                href={`/tags/${tag.slug}`}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-gray-200 bg-white text-sm font-medium text-gray-700 no-underline hover:bg-navy hover:text-white hover:border-navy transition-all duration-150"
              >
                {tag.tag}
                <span className="text-xs text-gray-400 group-hover:text-white/70">
                  {tag.count}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
