/**
 * SEO configuration for Adroit Consulting Blog
 *
 * Site-wide defaults and per-page metadata helpers.
 */

export const siteConfig = {
  name: "Adroit Consulting",
  title: "Adroit Consulting Blog",
  description:
    "Insights on Salesforce, React, AI, and digital transformation to help your business scale smarter.",
  url: "https://adroit.io",
  blogPath: "/blog",
  logo: "/logo.png",
  social: {
    twitter: "@adroitconsult",
  },
} as const;

export interface PageSEO {
  title: string;
  description: string;
  path: string;
  ogImage?: string;
  publishedTime?: string;
  tags?: string[];
  noindex?: boolean;
}

export function buildMetadata(page: PageSEO) {
  const url = `${siteConfig.url}${page.path}`;
  const images = page.ogImage
    ? [{ url: page.ogImage, width: 1200, height: 630 }]
    : undefined;

  return {
    title: page.title,
    description: page.description,
    alternates: { canonical: url },
    openGraph: {
      title: page.title,
      description: page.description,
      url,
      siteName: siteConfig.name,
      type: "article" as const,
      ...(images ? { images } : {}),
      ...(page.publishedTime ? { publishedTime: page.publishedTime } : {}),
    },
    twitter: {
      card: "summary_large_image" as const,
      title: page.title,
      description: page.description,
      ...(images ? { images: images.map((i) => i.url) } : {}),
    },
    robots: page.noindex
      ? { index: false, follow: false }
      : { index: true, follow: true },
  };
}
