import fs from "fs";
import path from "path";

/**
 * Read the raw MDX content for a blog post by slug.
 * Returns null if the file doesn't exist.
 */
export function getMDXContent(slug: string): string | null {
  const mdxPath = path.join(
    process.cwd(),
    "content",
    "blog",
    `${slug}.mdx`,
  );

  try {
    return fs.readFileSync(mdxPath, "utf-8");
  } catch {
    return null;
  }
}

/**
 * Strip the `---` frontmatter block from raw MDX before rendering.
 * Mirrors the Learn renderer fix (lib/learn.ts) — without this the
 * frontmatter YAML blob renders as a stray heading inside the article.
 */
export function stripMDXFrontmatter(raw: string): string {
  const lines = raw.split("\n");
  if (lines[0]?.trim() !== "---") return raw;
  const end = lines.findIndex((l, i) => i > 0 && l.trim() === "---");
  if (end === -1) return raw;
  return lines.slice(end + 1).join("\n");
}

/**
 * Convert `[Source: https://...]` citation literals into proper markdown
 * links with a clean anchor (`[Source: domain.com](url)`) so article bodies
 * stop showing raw URL text. Used by the blog + learn MDX renderers.
 */
export function linkifySourceCitations(raw: string): string {
  return raw.replace(
    /\[Source:\s+(https?:\/\/[^\]\s]+)\]/g,
    (_match, url: string) => {
      let domain = url;
      try {
        domain = new URL(url).hostname.replace(/^www\./, "");
      } catch {
        // keep the URL as anchor text if it won't parse
      }
      return `[Source: ${domain}](${url})`;
    },
  );
}

/**
 * Get a list of all MDX slugs available in content/blog/.
 */
export function getAllMDXSlugs(): string[] {
  const blogDir = path.join(process.cwd(), "content", "blog");

  try {
    const files = fs.readdirSync(blogDir);
    return files
      .filter((f) => f.endsWith(".mdx"))
      .map((f) => f.replace(/\.mdx$/, ""));
  } catch {
    return [];
  }
}
