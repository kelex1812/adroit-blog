import { type MetadataRoute } from "next";
import { posts } from "@/data/posts";
import { learnLessons, learnSeries } from "@/data/learn";
import { getQuizSeriesSlugs } from "@/lib/quiz";
import { siteConfig } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const blogUrl = `${siteConfig.url}${siteConfig.blogPath}`;

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

  // Learn hub + series pages (daily content cadence → weekly)
  const learnHubPages: MetadataRoute.Sitemap = [
    {
      url: `${siteConfig.url}/learn`,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 0.9,
    },
    ...learnSeries.map((s) => ({
      url: `${siteConfig.url}/learn/${s.slug}`,
      lastModified: s.lessons[0]?.date ? new Date(s.lessons[0].date) : new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];

  // Learn lesson pages
  const learnLessonPages: MetadataRoute.Sitemap = learnLessons.map((lesson) => ({
    url: `${siteConfig.url}/learn/${lesson.series}/${lesson.slug}`,
    lastModified: lesson.date ? new Date(lesson.date) : new Date(),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  // Quiz pages (one per series with a questions.json)
  const quizPages: MetadataRoute.Sitemap = getQuizSeriesSlugs().map((slug) => ({
    url: `${siteConfig.url}/learn/${slug}/quiz`,
    lastModified: new Date(),
    changeFrequency: "monthly" as const,
    priority: 0.6,
  }));

  return [
    ...staticPages,
    ...blogPages,
    ...tagPages,
    ...learnHubPages,
    ...learnLessonPages,
    ...quizPages,
  ];
}
