import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      // /preview/ holds auth-gated drafts — never indexable (draft-state).
      disallow: ['/api/', '/preview/'],
    },
    sitemap: 'https://adroit.io/sitemap.xml',
  };
}
