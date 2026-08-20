import type { Metadata } from "next";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { isBatchAnalysisEnabled } from "@/lib/product-features";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL?.startsWith("http")
      ? process.env.NEXT_PUBLIC_SITE_URL
      : "http://localhost:3000",
  ),
  title: {
    default: "Opportunity Facts",
    template: "%s · Opportunity Facts",
  },
  description:
    "Turn a student opportunity into a clear, source-backed facts card.",
  applicationName: "Opportunity Facts",
  category: "education",
  openGraph: {
    title: "Opportunity Facts",
    description:
      "Know what you’re applying to with source-backed opportunity facts.",
    type: "website",
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const batchAnalysisEnabled = isBatchAnalysisEnabled();
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <a className="skip-link" href="#main-content">
          Skip to main content
        </a>
        <div className="site-frame">
          <SiteHeader />
          {children}
          <SiteFooter batchAnalysisEnabled={batchAnalysisEnabled} />
        </div>
      </body>
    </html>
  );
}
