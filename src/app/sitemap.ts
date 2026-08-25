import { type MetadataRoute } from "next";
import { posts } from "@/data/posts";
import { learnLessons, learnSeries } from "@/data/learn";
import { getCertExam, getKnowledgeChecks } from "@/lib/quiz";
import { siteConfig } from "@/lib/seo";

/**
 * Sitemap — public index. Per AC-5, learn URLs are included ONLY for courses
 * whose `courses` row status is `live` (pending/archived are excluded; a
 * content series with no DB row is treated as not-launched). Blog routes stay
 * fully public and unchanged.
 *
 * The live set is read via the SERVICE client (a system-level read of public
 * data — never used to resolve a per-user decision). If the DB is unreachable
 * at build time we fall back to the content-derived series so the build never
 * fails on a DB hiccup (arch §10 risk mitigation), logging the degradation.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const blogUrl = `${siteConfig.url}${siteConfig.blogPath}`;

  // Live series slugs from the DB (source of truth for status).
  let liveSlugs: Set<string> | null = null;
  try {
    const { getSupabaseServiceClient } = await import(
      "@/lib/supabase/service"
    );
    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from("courses")
      .select("series_slug")
      .eq("status", "live");
    if (!error && data) {
      liveSlugs = new Set(
        (data as { series_slug: string }[]).map((r) => r.series_slug),
      );
    }
  } catch {
    liveSlugs = null;
  }
  const liveSet = liveSlugs ?? new Set(learnSeries.map((s) => s.slug));
  if (!liveSlugs) {
    console.warn(
      "[sitemap] courses table unreachable — falling back to all content series",
    );
  }
  const isLive = (slug: string) => liveSet.has(slug);
  const visibleSeries = learnSeries.filter((s) => isLive(s.slug));
  const visibleLesson = (lesson: { series: string; slug: string }) =>
    isLive(lesson.series);

  // Static pages
  const staticPages: MetadataRoute.Sitemap = [
    {
      url: siteConfig.url,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 1,
    },
    {
      url: `${siteConfig.url}/blog`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${siteConfig.url}/blog/categories`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.7,
    },
  ];

  // Blog post pages
  const blogPages: MetadataRoute.Sitemap = posts.map((post) => ({
    url: `${blogUrl}/${post.slug}`,
    lastModified: post.date ? new Date(post.date) : new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.8,
  }));

  // Tag pages
  const allTags = [...new Set(posts.flatMap((p) => p.tags))];
  const tagPages: MetadataRoute.Sitemap = allTags.map((tag) => ({
    url: `${siteConfig.url}/tags/${tag.toLowerCase().replace(/\s+/g, "-")}`,
    lastModified: new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.5,
  }));

  // Learn hub + series pages (daily content cadence → weekly). Live only (AC-5).
  const learnHubPages: MetadataRoute.Sitemap = [
    {
      url: `${siteConfig.url}/learn`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    ...visibleSeries.map((s) => ({
      url: `${siteConfig.url}/learn/${s.slug}`,
      lastModified: s.lessons[0]?.date ? new Date(s.lessons[0].date) : new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];

  // Learn lesson pages — live courses only (AC-5).
  const learnLessonPages: MetadataRoute.Sitemap = learnLessons
    .filter(visibleLesson)
    .map((lesson) => ({
      url: `${siteConfig.url}/learn/${lesson.series}/${lesson.slug}`,
      lastModified: lesson.date ? new Date(lesson.date) : new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.7,
    }));

  // Tier quiz pages — knowledge checks + cert exam (legacy series quiz removed,
  // Decision 8). Only series that ship tier files AND are live contribute.
  const checkPages: MetadataRoute.Sitemap = visibleSeries.flatMap((s) =>
    getKnowledgeChecks(s.slug).map((c) => ({
      url: `${siteConfig.url}/learn/${s.slug}/check/${c.n}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  );
  const examPages: MetadataRoute.Sitemap = visibleSeries
    .filter((s) => getCertExam(s.slug) !== null)
    .map((s) => ({
      url: `${siteConfig.url}/learn/${s.slug}/exam`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.6,
    }));

  return [
    ...staticPages,
    ...blogPages,
    ...tagPages,
    ...learnHubPages,
    ...learnLessonPages,
    ...checkPages,
    ...examPages,
  ];
}
