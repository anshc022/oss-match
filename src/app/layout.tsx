import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { Providers } from "@/components/providers";
import { BRAND } from "@/lib/brand";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  // Absolute URLs for social cards and canonicals are resolved against this.
  metadataBase: new URL(BRAND.url),
  title: {
    default: `${BRAND.name} — find your first open source issue`,
    template: `%s · ${BRAND.name}`,
  },
  description: BRAND.description,
  applicationName: BRAND.name,
  keywords: [
    "open source",
    "good first issue",
    "first contribution",
    "hacktoberfest",
    "github issues",
    "beginner friendly",
    "learn to contribute",
  ],
  authors: [{ name: `${BRAND.name} contributors`, url: BRAND.repo }],
  creator: `${BRAND.name} contributors`,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: BRAND.name,
    title: `${BRAND.name} — find your first open source issue`,
    description: BRAND.shortDescription,
    url: BRAND.url,
    locale: "en_GB",
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND.name} — find your first open source issue`,
    description: BRAND.shortDescription,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
  category: "technology",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Matches the two palettes in globals.css, so the browser chrome does not
  // flash the wrong colour on load.
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: BRAND.color.light },
    { media: "(prefers-color-scheme: dark)", color: BRAND.color.dark },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${mono.variable} min-h-dvh bg-background font-sans antialiased`}
      >
        <script
          type="application/ld+json"
          // Static, brand-derived, no user input.
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebApplication",
              name: BRAND.name,
              url: BRAND.url,
              description: BRAND.description,
              applicationCategory: "DeveloperApplication",
              operatingSystem: "Any",
              offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
              isAccessibleForFree: true,
              license: "https://opensource.org/licenses/MIT",
              codeRepository: BRAND.repo,
            }),
          }}
        />
        <Providers>{children}</Providers>
        <Toaster position="bottom-center" />
      </body>
    </html>
  );
}
