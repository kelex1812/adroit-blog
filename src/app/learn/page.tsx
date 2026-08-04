import Header from "@/components/Header";
import Footer from "@/components/Footer";
import PathCard from "@/components/Learn/PathCard";
import { getAllSeries } from "@/lib/learn";
import { siteConfig } from "@/lib/seo";

/**
 * /learn hub — one PathCard per learning path with progress
 * (or a "coming soon" badge for empty series).
 */
export default function LearnLandingPage() {
  const series = getAllSeries();

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Adroit Learn — Learning Paths",
    description:
      "Structured, sequence-aware learning paths on Salesforce architecture and agentic AI implementation.",
    itemListElement: series.map((s, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: s.name,
      url: `${siteConfig.url}/learn/${s.slug}`,
    })),
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        {/* Learn hero — typographic display, not a stock photo */}
        <section className="max-w-[1120px] mx-auto px-6 pt-14 pb-2">
          <div className="inline-flex items-center gap-2 font-mono text-[11px] font-semibold text-red uppercase tracking-[0.08em] mb-[18px]">
            <span className="w-1.5 h-1.5 rounded-full bg-red" />
            Adroit Academy
          </div>
          <h1 className="text-[clamp(2.5rem,5vw,3.25rem)] font-extrabold tracking-[-0.03em] leading-[1.05] text-navy mb-4 bg-gradient-to-r from-navy to-navy-light bg-clip-text text-transparent">
            Learn
          </h1>
          <p className="text-[17px] text-gray-500 max-w-[560px] leading-relaxed">
            Structured, sequence-aware learning paths on Salesforce
            architecture and agentic AI implementation — published daily, read
            in order.
          </p>
        </section>

        {/* Track grid */}
        <section className="max-w-[1120px] mx-auto px-6 py-10 pb-24">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {series.map((s) => (
              <PathCard key={s.slug} series={s} />
            ))}
          </div>
        </section>

        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </main>

      <Footer />
    </div>
  );
}
