import { dbConnect } from "@/lib/mongodb";
import { Issue } from "@/models/Issue";

export type LandingStats = {
  issues: number;
  repos: number;
  languages: number;
};

/**
 * Real numbers for the landing page, straight from the serving collection.
 * The landing must never fail because the database is down or empty, so any
 * error collapses to null and the page falls back to its static stats.
 */
export async function getLandingStats(): Promise<LandingStats | null> {
  if (!process.env.MONGODB_URI) return null;
  try {
    const timeout = new Promise<null>((r) => setTimeout(() => r(null), 1500));
    const query = (async () => {
      await dbConnect();
      const [issues, repos, languages] = await Promise.all([
        Issue.countDocuments({ archived: false }),
        Issue.distinct("repoFullName").then((r) => r.length),
        Issue.distinct("language").then((r) => r.filter(Boolean).length),
      ]);
      return { issues, repos, languages };
    })();
    const result = await Promise.race([query, timeout]);
    return result && result.issues > 0 ? result : null;
  } catch {
    return null;
  }
}
