import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";
import { dbConnect } from "@/lib/mongodb";
import { Issue } from "@/models/Issue";

/** Issue pages are the only content worth indexing at volume. */
const MAX_ISSUES = 5000;

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: BRAND.url, changeFrequency: "daily", priority: 1 },
    { url: `${BRAND.url}/feed`, changeFrequency: "hourly", priority: 0.8 },
  ];

  try {
    await dbConnect();
    const issues = await Issue.find({ archived: { $ne: true } })
      .select("_id issueUpdatedAt")
      .sort({ baseScore: -1 })
      .limit(MAX_ISSUES)
      .lean();

    return [
      ...staticRoutes,
      ...issues.map((i) => ({
        url: `${BRAND.url}/issue/${String(i._id)}`,
        lastModified: i.issueUpdatedAt ?? undefined,
        changeFrequency: "weekly" as const,
        priority: 0.6,
      })),
    ];
  } catch {
    // A sitemap is not worth a 500. Serve the static routes and move on.
    return staticRoutes;
  }
}
