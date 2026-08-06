import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ReadingProgress from "@/components/BlogPost/ReadingProgress";
import ShareBar from "@/components/BlogPost/ShareBar";
import LessonNavigation from "@/components/Learn/LessonNavigation";
import { learnSeries } from "@/data/learn";
import {
  getAuthorInitials,
  getLearnMDXContent,
  getLesson,
  getLessonsForSeries,
  getSeriesBySlug,
  stripMDXFrontmatter,
} from "@/lib/learn";
import { linkifySourceCitations } from "@/lib/mdx";
import { buildMetadata, siteConfig } from "@/lib/seo";

interface Props {
  params: Promise<{ series: string; slug: string }>;
}

export async function generateStaticParams() {
  return learnSeries.flatMap((s) =>
    s.lessons.map((l) => ({ series: s.slug, slug: l.slug })),
  );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { series, slug } = await params;
  const lesson = getLesson(series, slug);
  if (!lesson) return {};
  const s = getSeriesBySlug(series);
  return buildMetadata({
    title: `Lesson ${lesson.lesson}: ${lesson.title} — ${s?.name ?? series} — Adroit`,
    description: lesson.excerpt,
    path: `/learn/${series}/${slug}`,
    publishedTime: lesson.date,
    tags: lesson.tags,
  });
}

export default async function LessonPage({ params }: Props) {
  const { series, slug } = await params;
  const lesson = getLesson(series, slug);
  if (!lesson) notFound();
  const seriesInfo = getSeriesBySlug(series);
  if (!seriesInfo) notFound();

  // Load and compile MDX content from content/learn/<series>/[slug].mdx
  // (frontmatter stripped — the blog renderer's raw-pass-through bug is not
  // replicated for Learn; see lib/learn.ts stripMDXFrontmatter)
  const mdxContent = getLearnMDXContent(series, slug);
  if (!mdxContent) notFound();
  const mdxBody = linkifySourceCitations(stripMDXFrontmatter(mdxContent));

  const lessons = getLessonsForSeries(series);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: lesson.title,
    description: lesson.excerpt,
    datePublished: lesson.date,
    author: { "@type": "Organization", name: lesson.author },
    url: `${siteConfig.url}/learn/${series}/${slug}`,
    isPartOf: {
      "@type": "LearningPath",
      name: seriesInfo.name,
      url: `${siteConfig.url}/learn/${series}`,
    },
  };

  return (
    <div className="min-h-screen flex flex-col">
      <ReadingProgress />
      <Header />

      <main className="flex-1">
        {/* Lesson hero */}
        <div className="max-w-[720px] mx-auto px-6 pt-10 pb-0">
          <Link
            href={`/learn/${series}`}
            className="inline-flex items-center gap-1.5 text-gray-500 text-xs font-medium no-underline mb-5 hover:text-navy transition-colors duration-150"
          >
            &larr; Back to {seriesInfo.name}
          </Link>

          {/* Series crumb — mono sequence voice */}
          <div className="flex items-center gap-2 font-mono text-[11.5px] font-semibold text-gray-500 mb-[18px]">
            <span className="bg-navy text-white px-2 py-0.5 rounded-[5px] font-bold">
              Lesson {lesson.lesson}
            </span>
            <span>
              of {seriesInfo.totalLessons} &middot;{" "}
              <Link
                href={`/learn/${series}`}
                className="text-gray-500 no-underline hover:text-navy transition-colors duration-150"
              >
                {seriesInfo.name}
              </Link>
            </span>
          </div>

          <h1 className="text-[clamp(1.75rem,4vw,2.25rem)] font-extrabold text-navy tracking-[-0.02em] leading-tight mb-5">
            {lesson.title}
          </h1>

          {/* Author row */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-navy to-navy-light ring-2 ring-white shadow-sm flex items-center justify-center text-white font-bold text-xs">
              {getAuthorInitials(lesson.author)}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-gray-800">
                {lesson.author}
              </span>
              <div className="flex items-center text-xs text-gray-400">
                <span>{lesson.date}</span>
                <span className="mx-3 h-3 w-px bg-gray-200" />
                <span>{lesson.readTime}</span>
              </div>
            </div>
          </div>

          {/* Tags */}
          {lesson.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {lesson.tags.map((tag) => (
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
          <MDXArticle mdx={mdxBody} />
        </article>

        {/* Prev/Next within series (authored sequence) */}
        <LessonNavigation lessons={lessons} currentSlug={slug} />

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </main>

      <Footer />
    </div>
  );
}

/**
 * MDX Article Renderer — uses next-mdx-remote/rsc for server-side MDX rendering
 * (same pattern as src/app/blog/[slug]/page.tsx). remark-gfm autolinks bare
 * http(s) URLs so citations render as clickable links.
 */
async function MDXArticle({ mdx }: { mdx: string }) {
  const [{ MDXRemote }, remarkGfm] = await Promise.all([
    import("next-mdx-remote/rsc"),
    import("remark-gfm"),
  ]);
  return (
    <MDXRemote
      source={mdx}
      options={{ mdxOptions: { remarkPlugins: [remarkGfm.default] } }}
    />
  );
}
