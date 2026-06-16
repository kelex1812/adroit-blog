import { notFound } from "next/navigation";
import { posts } from "@/data/posts";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BackLink from "@/components/BackLink";
import ReadingProgress from "@/components/BlogPost/ReadingProgress";
import ShareBar from "@/components/BlogPost/ShareBar";
import PostNavigation from "@/components/BlogPost/PostNavigation";
import { Tag } from "@/components/Tag";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const post = posts.find((p) => p.slug === slug);
  if (!post) notFound();

  const currentIdx = posts.findIndex((p) => p.slug === slug);
  const prev = currentIdx > 0 ? posts[currentIdx - 1] : undefined;
  const next =
    currentIdx < posts.length - 1 ? posts[currentIdx + 1] : undefined;

  return (
    <div className="min-h-screen flex flex-col">
      <ReadingProgress />
      <Header />

      <main className="flex-1">
        {/* Post Hero */}
        <div className="max-w-[720px] mx-auto px-6 pt-10 pb-0">
          <BackLink />

          {/* Author row */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-navy flex items-center justify-center text-white font-bold text-xs">
              {post.authorInitials}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-gray-800">
                {post.author}
              </span>
              <div className="flex items-center text-xs text-gray-400">
                <span>{post.date}</span>
                <span className="mx-3 h-3 w-px bg-gray-200" />
                <span>{post.readTime}</span>
              </div>
            </div>
          </div>

          <Tag label={post.category} color={post.categoryColor} />

          <h1 className="text-3xl md:text-4xl font-extrabold text-navy tracking-tight leading-tight mt-4 mb-4">
            {post.title}
          </h1>

          <ShareBar />
        </div>

        {/* Article Body */}
        <article className="article-body max-w-[720px] mx-auto px-6 pb-16">
          <p>
            2026 is the year AI moves from &ldquo;interesting technology&rdquo; to
            &ldquo;table stakes.&rdquo; Companies that haven&rsquo;t built an AI
            strategy are already falling behind.
          </p>

          <p>
            But here&rsquo;s the problem most businesses face: they know they
            need AI, but they don&rsquo;t know where to start.
          </p>

          <h2>The Three Waves of AI Adoption</h2>

          <h3>Wave 1: Augmentation (Now)</h3>

          <p>AI that helps your team work faster:</p>
          <ul>
            <li>AI-assisted code generation</li>
            <li>AI-powered data analysis</li>
            <li>AI-enhanced customer communication</li>
          </ul>

          <p>
            <strong>ROI:</strong> Immediate productivity gains, 20-40% efficiency
            improvements.
          </p>

          <h3>Wave 2: Transformation (1-2 years)</h3>

          <p>AI that changes how you work:</p>
          <ul>
            <li>Automated workflow orchestration</li>
            <li>AI-driven decision support</li>
            <li>Intelligent process automation</li>
          </ul>

          <p>
            <strong>ROI:</strong> Structural cost reduction, 40-60% process
            speed improvements.
          </p>

          <blockquote>
            &ldquo;AI adoption is a journey, not a destination. Start with the
            problem, not the tool.&rdquo;
          </blockquote>

          <h2>Building Your AI Strategy: A 5-Step Framework</h2>

          <h3>Step 1: Audit Your Processes</h3>

          <p>
            Map every business process and identify where humans spend the most
            time, where errors are most costly, and where decisions are
            repetitive.
          </p>

          <pre>{`The AI opportunity score:
Time spent (0-10) × Error cost (0-10) = Opportunity score`}</pre>

          <hr />

          <h3>Step 2: Identify Quick Wins</h3>
          <ul>
            <li>Document-heavy processes</li>
            <li>Data entry and reconciliation</li>
            <li>Report generation</li>
            <li>Customer communication triage</li>
          </ul>

          <p>These are low-risk, high-impact AI opportunities.</p>

          <h3>Step 3: Build Your Data Foundation</h3>

          <p>
            AI is only as good as the data it learns from. Before deploying any
            AI solution, ensure your data infrastructure can support it.
          </p>

          <p>
            This means clean, well-structured data with clear governance
            policies. Companies that skip this step find their AI projects
            failing within months.
          </p>

          <h3>Step 4: Start Small, Scale Fast</h3>

          <p>
            The most successful AI adopters don&rsquo;t try to transform
            everything at once. They pick one process, prove the value, and
            expand from there.
          </p>

          <p>
            <strong>ROI:</strong> Each successful pilot builds organizational
            confidence and data infrastructure for the next wave.
          </p>

          <h3>Step 5: Build for Continuous Learning</h3>

          <p>
            AI models need continuous refinement. Set up feedback loops where
            model predictions are compared against real outcomes, and retrain
            regularly.
          </p>

          <p>
            The companies that win with AI aren&rsquo;t the ones with the best
            models today — they&rsquo;re the ones that learn fastest.
          </p>
        </article>

        {/* Next/Prev */}
        <PostNavigation prev={prev} next={next} />
      </main>

      <Footer />
    </div>
  );
}
