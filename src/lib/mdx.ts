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
