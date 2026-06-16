import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PostCard from "@/components/BlogListing/PostCard";
import FeaturedPost from "@/components/BlogListing/FeaturedPost";
import { getAllTagSlugs, getTagBySlug, type TagInfo } from "@/lib/tags";
import { buildMetadata } from "@/lib/seo";

interface Props {
  params: Promise<{ tag: string }>;
}

export async function generateStaticParams(): Promise<{ tag: string }[]> {
  return getAllTagSlugs().map((slug) => ({ tag: slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tag } = await params;
  const tagInfo = getTagBySlug(tag);
  if (!tagInfo) return {};

  return buildMetadata({
    title: `${tagInfo.tag} — Adroit Consulting Blog`,
    description: `Posts tagged with "${tagInfo.tag}" covering Salesforce, React, AI, and digital transformation insights.`,
    path: `/tags/${tag}`,
  });
}

function TagPageContent({ tagInfo }: { tagInfo: TagInfo }) {
  const featured = tagInfo.posts.find((p) => p.featured);
  const nonFeatured = tagInfo.posts.filter((p) => !p.featured);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        <div className="max-w-[1120px] mx-auto px-6 pt-12 pb-0">
          <Link
            href="/tags"
            className="inline-flex items-center gap-1.5 text-gray-500 text-xs font-medium no-underline mb-6 hover:text-navy transition-colors duration-150"
          >
            &larr; All Tags
          </Link>
          <h1 className="text-3xl md:text-4xl font-extrabold text-navy tracking-tight mb-2">
            {tagInfo.tag}
          </h1>
          <p className="text-[1.0625rem] text-gray-500 max-w-[560px] leading-relaxed">
            {tagInfo.count} {tagInfo.count === 1 ? "post" : "posts"} tagged with this topic.
          </p>
        </div>

        {featured && (
          <div className="mt-8">
            <FeaturedPost post={featured} />
          </div>
        )}

        {nonFeatured.length > 0 && (
          <div className="max-w-[1120px] mx-auto px-6 py-8 pb-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {nonFeatured.map((post) => (
                <PostCard key={post.slug} post={post} />
              ))}
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

export default async function TagPage({ params }: Props) {
  const { tag } = await params;
  const tagInfo = getTagBySlug(tag);
  if (!tagInfo) notFound();

  return <TagPageContent tagInfo={tagInfo} />;
}
