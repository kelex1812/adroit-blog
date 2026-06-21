import Link from "next/link";
import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { buildMetadata } from "@/lib/seo";
import { posts } from "@/data/posts";

export const metadata: Metadata = buildMetadata({
  title: "Blog Categories — Adroit Consulting",
  description:
    "Browse our content by topic — Salesforce, React & Web Dev, AI & Consulting, and Marketing.",
  path: "/blog/categories",
});

const categories = [
  {
    key: "sf",
    name: "Salesforce",
    description:
      "Flow design tips, Apex patterns, integration guides, and release highlights.",
    icon: "\u2601",
    postCount: posts.filter((p) => p.categoryColor === "sf").length,
    color: "sf",
    bg: "from-[#F0F9FF] to-[#E0F2FE]",
    border: "border-[#BAE6FD]",
    iconBg: "bg-white",
    iconColor: "text-[#0284C7]",
    countColor: "text-[#0369A1]",
  },
  {
    key: "react",
    name: "React & Web Dev",
    description:
      "Architecture patterns, component design, performance, and Next.js.",
    icon: "\u27E8/\u27E9",
    postCount: posts.filter((p) => p.categoryColor === "react").length,
    color: "react",
    bg: "from-[#ECFDF5] to-[#D1FAE5]",
    border: "border-[#6EE7B7]",
    iconBg: "bg-white",
    iconColor: "text-[#059669]",
    countColor: "text-[#047857]",
  },
  {
    key: "ai",
    name: "AI & Consulting",
    description:
      "How AI accelerates Salesforce delivery, AI-assisted React dev, and agent workflows.",
    icon: "\u2B21",
    postCount: posts.filter((p) => p.categoryColor === "ai").length,
    color: "ai",
    bg: "from-[#FFFBEB] to-[#FEF3C7]",
    border: "border-[#FCD34D]",
    iconBg: "bg-white",
    iconColor: "text-[#D97706]",
    countColor: "text-[#92400E]",
  },
  {
    key: "mkt",
    name: "Marketing",
    description:
      "Showcasing Adroit's capabilities and how we can help your business.",
    icon: "\u2726",
    postCount: posts.filter((p) => p.categoryColor === "mkt").length,
    color: "mkt",
    bg: "from-[#FDF2F8] to-[#FCE7F3]",
    border: "border-[#F9A8D4]",
    iconBg: "bg-white",
    iconColor: "text-[#DB2777]",
    countColor: "text-[#BE185D]",
  },
];

export default function CategoriesPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <div className="max-w-[1120px] mx-auto px-6 pt-10 pb-0">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-gray-500 text-xs font-medium no-underline mb-6 hover:text-navy transition-colors duration-150"
          >
            &larr; Back to Blog
          </Link>
          <h1 className="text-3xl md:text-4xl font-extrabold text-navy tracking-tight mb-2">
            Blog Categories
          </h1>
          <p className="text-base text-gray-500 max-w-[520px] leading-relaxed">
            Browse our content by topic. Each category contains curated insights
            from our consulting work with enterprise clients.
          </p>
        </div>

        {/* Category Cards */}
        <div className="max-w-[1120px] mx-auto px-6 py-6 pb-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {categories.map((cat) => (
              <Link
                key={cat.key}
                href={`/blog?category=${cat.key}`}
                className={`p-6 rounded-xl border border-transparent bg-gradient-to-br ${cat.bg} ${cat.border} hover:-translate-y-0.5 hover:shadow-md transition-all duration-200 cursor-pointer relative overflow-hidden no-underline block`}
              >
                <div
                  className={`w-9 h-9 rounded-md ${cat.iconBg} flex items-center justify-center text-base mb-3 ${cat.iconColor}`}
                >
                  {cat.icon}
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-1.5">
                  {cat.name}
                </h3>
                <p className="text-xs text-gray-600 leading-relaxed mb-3">
                  {cat.description}
                </p>
                <span
                  className={`text-xs font-semibold flex items-center gap-1 ${cat.countColor}`}
                >
                  {cat.postCount} posts &rarr;
                </span>
              </Link>
            ))}
          </div>
        </div>

        {/* Subscribe CTA */}
        <div className="max-w-[1120px] mx-auto px-6 pb-10">
          <div className="bg-navy rounded-xl p-8 md:p-10 text-center relative overflow-hidden">
            <div
              className="absolute inset-0"
              style={{
                background:
                  "radial-gradient(circle at 50% 0%, rgba(200,16,46,0.12) 0%, transparent 60%)",
              }}
            />
            <h3 className="text-white text-xl md:text-2xl font-bold mb-2 relative">
              Subscribe for Updates
            </h3>
            <p className="text-white/60 text-sm mb-5 relative max-w-md mx-auto">
              Get new posts delivered to your inbox. No spam, just insights.
            </p>
            <div className="flex gap-2.5 max-w-[440px] mx-auto relative flex-col sm:flex-row">
              <input
                type="email"
                placeholder="your@email.com"
                aria-label="Email for newsletter"
                className="flex-1 px-4 py-3 rounded-md border border-white/15 bg-white/8 text-white text-sm font-sans outline-none focus:border-red transition-colors duration-150 placeholder:text-white/35"
              />
              <button className="px-6 py-3 bg-red text-white border-none rounded-md text-sm font-semibold font-sans cursor-pointer hover:bg-red-dark transition-colors duration-150 whitespace-nowrap">
                Subscribe
              </button>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
