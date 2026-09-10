/**
 * `npm run demo` — the app, running, with nothing to set up.
 *
 * Starts an in-memory MongoDB, seeds it from fixtures/demo-issues.json, and
 * hands the connection string to `next dev` along with the flags that turn on
 * demo sign-in. Nothing is written to disk and nothing outlives the process,
 * so there is no cleanup and no way to corrupt a real database with it.
 *
 * This exists because the full setup needs a database and a GitHub OAuth app,
 * which is a lot to ask of someone who only wants to fix a button.
 */
import { spawn } from "node:child_process";
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

type Fixture = {
  generatedAt: string;
  issues: Array<Record<string, unknown>>;
  repos: Record<string, Record<string, unknown>>;
};

async function main() {
  console.log("· starting an in-memory database (first run downloads MongoDB, ~1 min)");
  const server = await MongoMemoryServer.create({ instance: { dbName: "oss-match" } });
  const uri = server.getUri("oss-match");

  console.log("· seeding demo issues");
  const seeded = await seed(uri);
  console.log(`  ${seeded.issues} issues across ${seeded.repos} repositories`);

  const env = {
    ...process.env,
    MONGODB_URI: uri,
    DEMO_MODE: "true",
    // Sessions only need to survive this process.
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET || randomBytes(32).toString("base64"),
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || "http://localhost:3000",
  };

  console.log("\n  Demo ready. Open http://localhost:3000 and press Sign in.");
  console.log("  No GitHub app needed: sign-in gives you a local demo account.\n");

  const next = spawn("npx", ["next", "dev"], { env, stdio: "inherit" });

  const shutdown = async () => {
    next.kill("SIGINT");
    await mongoose.disconnect().catch(() => {});
    await server.stop().catch(() => {});
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  next.on("exit", shutdown);
}

async function seed(uri: string) {
  // Imported here so the fixture shape is checked against the real models and
  // the real scorer, rather than drifting from them.
  const { Issue } = await import("../src/models/Issue");
  const { RepoMeta } = await import("../src/models/RepoMeta");
  const { scoreBase } = await import("../src/lib/scoring");

  const fixture: Fixture = JSON.parse(readFileSync("fixtures/demo-issues.json", "utf8"));
  await mongoose.connect(uri);

  const now = new Date();
  const issues = [];

  for (const raw of fixture.issues) {
    const item = raw as Record<string, any>;
    const repo = fixture.repos[item.repoFullName] as Record<string, any> | undefined;
    if (!repo) continue;

    const { baseScore, breakdown } = scoreBase(item as never, repo as never);
    issues.push({
      issueUrl: item.htmlUrl,
      githubId: item.id,
      number: item.number,
      title: item.title,
      body: item.body,
      repoFullName: item.repoFullName,
      repoUrl: item.repoUrl,
      labels: item.labels,
      comments: item.comments,
      issueCreatedAt: new Date(item.createdAt),
      issueUpdatedAt: new Date(item.updatedAt),
      assigned: item.assigned,
      hasLinkedPr: item.hasLinkedPr,
      language: repo.language || item.language,
      topics: repo.topics ?? [],
      stars: repo.stars,
      forks: repo.forks,
      pushedAt: repo.pushedAt,
      defaultBranch: repo.defaultBranch,
      cloneUrl: repo.cloneUrl,
      hasContributing: repo.hasContributing,
      hasCodeOfConduct: repo.hasCodeOfConduct,
      hasCi: repo.hasCi,
      archived: repo.archived,
      baseScore,
      baseBreakdown: breakdown,
      isHacktoberfest: (item.labels as string[]).some((l) => /hacktoberfest/i.test(l)),
      lastScoredAt: now,
      lastSeenAt: now,
      firstSeenAt: now,
      sourceQueries: ["demo:fixture"],
    });
  }

  await Issue.insertMany(issues, { ordered: false });
  await RepoMeta.insertMany(
    Object.values(fixture.repos).map((r) => ({ ...r, fetchedAt: now })),
    { ordered: false },
  );

  return { issues: issues.length, repos: Object.keys(fixture.repos).length };
}

main().catch((err) => {
  console.error("demo failed to start:", err);
  process.exit(1);
});
