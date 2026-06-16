import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { posts } from "@/data/posts";
import { getMDXContent, getAllMDXSlugs } from "@/lib/mdx";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BackLink from "@/components/BackLink";
import ReadingProgress from "@/components/BlogPost/ReadingProgress";
import ShareBar from "@/components/BlogPost/ShareBar";
import PostNavigation from "@/components/BlogPost/PostNavigation";
import { Tag } from "@/components/Tag";
import { buildMetadata } from "@/lib/seo";

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const mdxSlugs = getAllMDXSlugs();
  return mdxSlugs
    .filter((slug) => posts.some((p) => p.slug === slug))
    .map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const post = posts.find((p) => p.slug === slug);
  if (!post) return {};

  return buildMetadata({
    title: `${post.title} — Adroit Consulting Blog`,
    description: post.excerpt,
    path: `/blog/${slug}`,
    publishedTime: post.date,
    tags: post.tags,
  });
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = posts.find((p) => p.slug === slug);
  if (!post) notFound();

  // Load and compile MDX content from content/blog/[slug].mdx
  const mdxContent = getMDXContent(slug);
  if (!mdxContent) notFound();

  const currentIdx = posts.findIndex((p) => p.slug === slug);
  const prev = currentIdx > 0 ? posts[currentIdx - 1] : undefined;
  const next =
    currentIdx < posts.length - 1 ? posts[currentIdx + 1] : undefined;

  return (
    <div className="min-h-screen flex flex-col">
      <ReadingProgress />
      <Header />

      <main className="flex-1">
        {/* Post Hero */}
        <div className="max-w-[720px] mx-auto px-6 pt-10 pb-0">
          <BackLink />

          {/* Author row */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-navy flex items-center justify-center text-white font-bold text-xs">
              {post.authorInitials}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-gray-800">
                {post.author}
              </span>
              <div className="flex items-center text-xs text-gray-400">
                <span>{post.date}</span>
                <span className="mx-3 h-3 w-px bg-gray-200" />
                <span>{post.readTime}</span>
              </div>
            </div>
          </div>

          <Tag label={post.category} color={post.categoryColor} />

          <h1 className="text-3xl md:text-4xl font-extrabold text-navy tracking-tight leading-tight mt-4 mb-4">
            {post.title}
          </h1>

          {/* Tags */}
          {post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="px-2.5 py-0.5 rounded-full bg-gray-100 text-gray-500 text-[11px] font-medium"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          <ShareBar />
        </div>

        {/* Article Body — rendered from MDX content */}
        <article className="article-body max-w-[720px] mx-auto px-6 pb-16">
          <MDXArticle mdx={mdxContent} />
        </article>

        {/* Next/Prev */}
        <PostNavigation prev={prev} next={next} />
      </main>

      <Footer />
    </div>
  );
}

/**
 * MDX Article Renderer — uses next-mdx-remote/rsc for server-side MDX rendering.
 */
async function MDXArticle({ mdx }: { mdx: string }) {
  const { MDXRemote } = await import("next-mdx-remote/rsc");
  return <MDXRemote source={mdx} />;
}
