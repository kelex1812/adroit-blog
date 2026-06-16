import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-navy-dark text-white/70">
      <div className="max-w-[1120px] mx-auto px-6 pt-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-10">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 bg-white/10 rounded-sm flex items-center justify-center text-white font-extrabold text-xs">
                A
              </div>
              <span className="font-bold text-lg tracking-tight text-white">
                Adroit
              </span>
            </div>
            <p className="text-sm text-white/50 leading-relaxed max-w-[280px]">
              Salesforce strategy, operational intelligence, and AI-enhanced
              digital experiences. Helping businesses modernize and scale.
            </p>
          </div>

          {/* Blog Links */}
          <div>
            <h4 className="text-white text-xs font-semibold uppercase tracking-[0.06em] mb-3.5">
              Blog
            </h4>
            <ul className="list-none space-y-2">
              <FooterLink href="/blog">All Posts</FooterLink>
              <FooterLink href="/blog?category=salesforce">Salesforce</FooterLink>
              <FooterLink href="/blog?category=react">React & Web Dev</FooterLink>
              <FooterLink href="/blog?category=ai">AI & Consulting</FooterLink>
              <FooterLink href="/blog?category=marketing">Marketing</FooterLink>
            </ul>
          </div>

          {/* Company Links */}
          <div>
            <h4 className="text-white text-xs font-semibold uppercase tracking-[0.06em] mb-3.5">
              Company
            </h4>
            <ul className="list-none space-y-2">
              <FooterLink href="https://adroit.io/about">About Adroit</FooterLink>
              <FooterLink href="https://adroit.io/services">Services</FooterLink>
              <FooterLink href="https://adroit.io/contact">Contact Us</FooterLink>
              <FooterLink href="https://adroit.io/careers">Careers</FooterLink>
              <FooterLink href="https://adroit.io/privacy">Privacy Policy</FooterLink>
            </ul>
          </div>

          {/* Subscribe */}
          <div>
            <h4 className="text-white text-xs font-semibold uppercase tracking-[0.06em] mb-3.5">
              Stay Updated
            </h4>
            <p className="text-xs text-white/40 mb-2.5">
              Get new posts delivered to your inbox. No spam, just insights.
            </p>
            <div className="flex gap-1.5">
              <input
                type="email"
                placeholder="your@email.com"
                aria-label="Email for newsletter"
                className="flex-1 px-2.5 py-2 rounded-md border border-white/15 bg-white/8 text-white text-xs font-sans outline-none focus:border-red transition-colors duration-150 placeholder:text-white/35"
              />
              <button className="px-3.5 py-2 bg-red text-white border-none rounded-md text-xs font-semibold font-sans cursor-pointer hover:bg-red-dark transition-colors duration-150 whitespace-nowrap">
                Subscribe
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-white/8 py-5 flex items-center justify-between text-xs text-white/30">
          <span>&copy; 2026 Adroit Consulting. All rights reserved.</span>
          <div className="flex gap-3">
            <SocialIcon title="LinkedIn">in</SocialIcon>
            <SocialIcon title="X/Twitter">𝕏</SocialIcon>
            <SocialIcon title="Facebook">fb</SocialIcon>
          </div>
        </div>
      </div>
    </footer>
  );
}

function FooterLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <li>
      <Link
        href={href}
        className="text-white/50 text-xs no-underline hover:text-white/85 transition-colors duration-150"
      >
        {children}
      </Link>
    </li>
  );
}

function SocialIcon({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <span
      title={title}
      className="w-7 h-7 rounded-full bg-white/8 flex items-center justify-center text-white/40 text-[0.65rem] select-none"
    >
      {children}
    </span>
  );
}
