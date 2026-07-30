export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  categoryColor: "sf" | "react" | "ai" | "mkt";
  categoryGradient: string;
  date: string;
  author: string;
  authorInitials: string;
  readTime: string;
  featured?: boolean;
  tags: string[];
}
