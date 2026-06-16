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
}

export const posts: BlogPost[] = [
  {
    slug: "ai-strategy-2026",
    title: "Why Every Business Needs an AI Strategy in 2026",
    excerpt:
      "AI is no longer optional. Here's how to build a practical AI strategy that drives real business outcomes — from quick wins to transformation.",
    category: "AI & Consulting",
    categoryColor: "ai",
    categoryGradient: "from-amber to-amber-dark",
    date: "June 1, 2026",
    author: "Adroit Consulting",
    authorInitials: "AC",
    readTime: "6 min read",
    featured: true,
  },
  {
    slug: "salesforce-flow-patterns",
    title: "5 Salesforce Flow Design Patterns for Complex Automation",
    excerpt:
      "Master these five flow patterns to build scalable, maintainable automation across your org.",
    category: "Salesforce",
    categoryColor: "sf",
    categoryGradient: "from-sky to-sky-dark",
    date: "May 15, 2026",
    author: "Adroit Consulting",
    authorInitials: "AC",
    readTime: "8 min read",
  },
  {
    slug: "scalable-react-2026",
    title: "Building Scalable React Apps: Architecture Patterns for 2026",
    excerpt:
      "Server components, edge rendering, and modern state management — what actually works now.",
    category: "React & Web Dev",
    categoryColor: "react",
    categoryGradient: "from-emerald to-emerald-dark",
    date: "May 8, 2026",
    author: "Adroit Consulting",
    authorInitials: "AC",
    readTime: "7 min read",
  },
  {
    slug: "ai-agents-salesforce",
    title: "AI Agents Transforming Salesforce: Agentforce in Practice",
    excerpt:
      "How autonomous AI agents are reshaping Salesforce implementation and day-to-day operations.",
    category: "AI & Consulting",
    categoryColor: "ai",
    categoryGradient: "from-amber to-amber-dark",
    date: "Apr 28, 2026",
    author: "Adroit Consulting",
    authorInitials: "AC",
    readTime: "5 min read",
  },
  {
    slug: "ai-strategy-marketing",
    title: "Why Every Business Needs an AI Strategy in 2026",
    excerpt:
      "Three waves of AI adoption — from augmentation to innovation — and where your company should focus.",
    category: "Marketing",
    categoryColor: "mkt",
    categoryGradient: "from-pink to-pink-dark",
    date: "Jun 1, 2026",
    author: "Adroit Consulting",
    authorInitials: "AC",
    readTime: "6 min read",
  },
  {
    slug: "digital-transformation-2026",
    title: "Digital Transformation Roadmap: What's Changing in 2026",
    excerpt:
      "Key technology trends shaping enterprise digital transformation this year and how to prepare.",
    category: "Salesforce",
    categoryColor: "sf",
    categoryGradient: "from-sky to-sky-dark",
    date: "Apr 15, 2026",
    author: "Adroit Consulting",
    authorInitials: "AC",
    readTime: "7 min read",
  },
];
