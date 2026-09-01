import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { siteConfig, buildMetadata } from "@/lib/seo";
import { ThemeProvider } from "@/components/Theme/ThemeProvider";
import AnalyticsInit from "@/components/Analytics/AnalyticsInit";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700", "800"],
});

export const metadata: Metadata = buildMetadata({
  title: siteConfig.title,
  description: siteConfig.description,
  path: "/",
  ogImage: "/og-blog-card.png",
});

/** FOUC guard — apply persisted/OS theme to <html> before hydration. */
function themeFoucScript() {
  return `(function(){try{var p=JSON.parse(localStorage.getItem('adroit-theme')||'{"mode":"light"}');var m=(p&&p.v===2)?(p.mode||'light'):'light';var dark=m==='dark'||(m==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);if(dark)document.documentElement.classList.add('dark');}catch(e){}})();`;
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeFoucScript() }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <AnalyticsInit />
          <a href="#main" className="skip-link">
            Skip to content
          </a>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
