import Link from "next/link";
import Image from "next/image";
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

const categoryDefs = [
  {
    key: "sf",
    name: "Salesforce",
    description:
      "Flow design tips, Apex patterns, integration guides, and release highlights.",
    icon: "☁",
    image: "/categories/sf.jpg",
    alt: "Salesforce category",
    // Category tint overlay (multiply) — mockup .cat-band .tint
    tint: "linear-gradient(135deg, rgba(14,165,233,0.55), rgba(37,99,235,0.55))",
    // Category-tinted hover glow (token utility — literal so Tailwind scans it)
    glow: "hover:shadow-glow-sf",
    countColor: "text-[#0369A1]",
  },
  {
    key: "react",
    name: "React & Web Dev",
    description:
      "Architecture patterns, component design, performance, and Next.js.",
    icon: "⟨/⟩",
    image: "/categories/react.jpg",
    alt: "React & Web Dev category",
    tint: "linear-gradient(135deg, rgba(16,185,129,0.55), rgba(5,150,105,0.55))",
    glow: "hover:shadow-glow-react",
    countColor: "text-[#047857]",
  },
  {
    key: "ai",
    name: "AI & Consulting",
    description:
      "How AI accelerates Salesforce delivery, AI-assisted React dev, and agent workflows.",
    icon: "⬡",
    image: "/categories/ai.jpg",
    alt: "AI & Consulting category",
    tint: "linear-gradient(135deg, rgba(245,158,11,0.55), rgba(217,119,6,0.55))",
    glow: "hover:shadow-glow-ai",
    countColor: "text-[#B45309]",
  },
  {
    key: "mkt",
    name: "Marketing",
    description: "Showcasing Adroit's capabilities and how we can help your business.",
    icon: "✦",
    image: "/categories/mkt.jpg",
    alt: "Marketing category",
    tint: "linear-gradient(135deg, rgba(236,72,153,0.55), rgba(225,29,72,0.55))",
    glow: "hover:shadow-glow-mkt",
    countColor: "text-[#BE185D]",
  },
];

// Derive post counts from actual data
const categories = categoryDefs.map((cat) => ({
  ...cat,
  postCount: posts.filter((p) => p.categoryColor === cat.key).length,
}));

export default function CategoriesPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main id="main" className="flex-1">
        {/* Hero */}
        <div className="max-w-[1120px] mx-auto px-6 pt-10 pb-0">
          <Link
            href="/blog"
            className="inline-flex items-center gap-1.5 text-gray-500 text-xs font-medium no-underline mb-6 hover:text-navy transition-colors duration-150"
          >
            &larr; Back to Blog
          </Link>
          <div className="inline-flex items-center gap-2 font-mono text-[11px] font-semibold text-red uppercase tracking-[0.08em] mb-[14px]">
            <span className="w-1.5 h-1.5 rounded-full bg-red" />
            Browse by Topic
          </div>
          <h1 className="text-[clamp(2rem,4.5vw,2.75rem)] font-extrabold text-navy tracking-[-0.03em] leading-[1.05] mb-3 bg-gradient-to-r from-navy to-navy-light bg-clip-text text-transparent">
            Blog Categories
          </h1>
          <p className="text-base text-gray-500 max-w-[520px] leading-relaxed">
            Browse our content by topic. Each category contains curated insights
            from our consulting work with enterprise clients.
          </p>
        </div>

        {/* Category Cards — photographic bands + tint + glow */}
        <div className="max-w-[1120px] mx-auto px-6 py-8 pb-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {categories.map((cat) => (
              <Link
                key={cat.key}
                href={`/blog?category=${cat.key}`}
                className={`group relative rounded-xl overflow-hidden border border-gray-200 bg-white shadow-card hover:-translate-y-1 ${cat.glow} transition-all duration-300 cursor-pointer no-underline block`}
              >
                {/* Photographic band */}
                <div className="relative h-[108px] overflow-hidden">
                  <Image
                    src={cat.image}
                    alt={cat.alt}
                    fill
                    sizes="(max-width: 768px) 100vw, 560px"
                    className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.05]"
                  />
                  {/* Category tint (multiply) */}
                  <div
                    aria-hidden
                    className="absolute inset-0 mix-blend-multiply opacity-70"
                    style={{ background: cat.tint }}
                  />
                  {/* Bottom scrim */}
                  <div
                    aria-hidden
                    className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-navy/55"
                  />
                  {/* Icon chip on band */}
                  <div className="absolute bottom-3 left-4 w-10 h-10 rounded-lg bg-white/90 backdrop-blur-sm shadow-md flex items-center justify-center text-lg transition-transform duration-200 group-hover:scale-110">
                    {cat.icon}
                  </div>
                </div>

                {/* Body */}
                <div className="p-[20px_22px_22px]">
                  <h3 className="text-[1.25rem] font-extrabold text-gray-900 tracking-[-0.02em] mb-2 group-hover:text-navy transition-colors duration-200">
                    {cat.name}
                  </h3>
                  <p className="text-[13px] text-gray-500 leading-relaxed mb-4">
                    {cat.description}
                  </p>
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-white/90 font-mono text-[10.5px] font-bold tabular-nums ${cat.countColor}`}
                    >
                      {cat.postCount}
                    </span>
                    <span className="text-xs font-semibold flex items-center gap-1 text-gray-600">
                      posts
                      <span className="transition-transform duration-200 group-hover:translate-x-0.5">
                        &rarr;
                      </span>
                    </span>
                  </span>
                </div>
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
