import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Nothing behind these is useful to a crawler, and the API routes cost
      // database work to serve.
      disallow: ["/api/", "/onboarding", "/saved"],
    },
    sitemap: `${BRAND.url}/sitemap.xml`,
  };
}
