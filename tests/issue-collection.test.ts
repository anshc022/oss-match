import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { Issue, type IssueDoc } from "../src/models/Issue";
import { ApiCache } from "../src/models/ApiCache";
import { docToCandidate, docToRepoSignals } from "../src/lib/issue-mapper";
import { scoreBase, scoreIssue, type ScoreProfile } from "../src/lib/scoring";
import type { CandidateIssue, RepoSignals } from "../src/lib/github";

let mongo: MongoMemoryServer;

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), { dbName: "oss-match-fetcher-test" });
  await Promise.all([Issue.syncIndexes(), ApiCache.syncIndexes()]);
});

after(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([Issue.deleteMany({}), ApiCache.deleteMany({})]);
});

const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

function candidate(o: Partial<CandidateIssue> = {}): CandidateIssue {
  return {
    id: 99, number: 7, title: "Add a tooltip", body: "y".repeat(300),
    htmlUrl: "https://github.com/acme/tool/issues/7",
    repoFullName: "acme/tool", repoUrl: "https://github.com/acme/tool",
    labels: ["good first issue"], comments: 2,
    createdAt: daysAgo(6).toISOString(), updatedAt: daysAgo(1).toISOString(),
    hasLinkedPr: false, assigned: false, language: "TypeScript", ...o,
  };
}

function signals(o: Partial<RepoSignals> = {}): RepoSignals {
  return {
    fullName: "acme/tool", etag: "", stars: 900, forks: 120, openIssues: 12,
    pushedAt: daysAgo(3), language: "TypeScript", topics: ["react"],
    defaultBranch: "main", cloneUrl: "https://github.com/acme/tool.git",
    hasContributing: true, contributingPath: "", hasCodeOfConduct: true,
    hasCi: true, archived: false, fetchedAt: new Date(), ...o,
  };
}

async function insert(c: CandidateIssue, r: RepoSignals, extra: Record<string, unknown> = {}) {
  const { baseScore, breakdown } = scoreBase(c, r);
  return Issue.create({
    issueUrl: c.htmlUrl, githubId: c.id, number: c.number, title: c.title, body: c.body,
    repoFullName: c.repoFullName, repoUrl: c.repoUrl, labels: c.labels, comments: c.comments,
    issueCreatedAt: new Date(c.createdAt), issueUpdatedAt: new Date(c.updatedAt),
    assigned: c.assigned, hasLinkedPr: c.hasLinkedPr,
    language: r.language, topics: r.topics, stars: r.stars, forks: r.forks,
    pushedAt: r.pushedAt, defaultBranch: r.defaultBranch, cloneUrl: r.cloneUrl,
    hasContributing: r.hasContributing, hasCodeOfConduct: r.hasCodeOfConduct,
    hasCi: r.hasCi, archived: r.archived,
    baseScore, baseBreakdown: breakdown, ...extra,
  });
}

const profile: ScoreProfile = {
  languages: ["TypeScript"], interests: ["web"], skillLevel: "beginner",
};

test("issueUrl is unique, so re-fetching the same issue does not duplicate it", async () => {
  await insert(candidate(), signals());
  await assert.rejects(() => insert(candidate(), signals()), /duplicate key/i);
  assert.equal(await Issue.countDocuments({}), 1);
});

test("an upsert refreshes a changed issue in place", async () => {
  await insert(candidate({ comments: 2 }), signals());

  await Issue.updateOne(
    { issueUrl: "https://github.com/acme/tool/issues/7" },
    { $set: { comments: 25, lastScoredAt: new Date() }, $addToSet: { sourceQueries: "gh:typescript:help wanted" } },
    { upsert: true },
  );

  const doc = await Issue.findOne({}).lean();
  assert.equal(await Issue.countDocuments({}), 1);
  assert.equal(doc?.comments, 25);
  assert.deepEqual(doc?.sourceQueries, ["gh:typescript:help wanted"]);
});

test("a stored document rescores to exactly the live score", async () => {
  const c = candidate();
  const r = signals();
  await insert(c, r);

  const doc = (await Issue.findOne({}).lean()) as unknown as IssueDoc;
  const fromCache = scoreIssue(docToCandidate(doc), docToRepoSignals(doc), profile);
  const live = scoreIssue(c, r, profile);

  assert.equal(
    fromCache.matchScore,
    live.matchScore,
    "serving a cached document must not change the score",
  );
  for (const key of Object.keys(live.breakdown) as (keyof typeof live.breakdown)[]) {
    assert.ok(
      Math.abs(fromCache.breakdown[key] - live.breakdown[key]) < 1e-9,
      `${key} drifted: ${fromCache.breakdown[key]} vs ${live.breakdown[key]}`,
    );
  }
});

test("the adapters preserve the fields the contribution guide needs", async () => {
  await insert(candidate(), signals({ defaultBranch: "canary", cloneUrl: "https://github.com/acme/tool.git" }));
  const doc = (await Issue.findOne({}).lean()) as unknown as IssueDoc;
  const repo = docToRepoSignals(doc);

  assert.equal(repo.defaultBranch, "canary");
  assert.equal(repo.cloneUrl, "https://github.com/acme/tool.git");
  assert.equal(docToCandidate(doc).number, 7);
});

test("the feed's filter shape selects by language, hacktoberfest and exclusions", async () => {
  await insert(candidate(), signals());
  await insert(
    candidate({ htmlUrl: "https://github.com/acme/go-tool/issues/1", repoFullName: "acme/go-tool", labels: ["hacktoberfest"] }),
    signals({ fullName: "acme/go-tool", language: "Go" }),
    { isHacktoberfest: true },
  );
  await insert(
    candidate({ htmlUrl: "https://github.com/dead/repo/issues/1", repoFullName: "dead/repo" }),
    signals({ fullName: "dead/repo", archived: true }),
    { archived: true },
  );

  const ts = await Issue.find({ archived: false, assigned: false, language: { $in: [/^typescript$/i] } });
  assert.equal(ts.length, 1);
  assert.equal(ts[0].repoFullName, "acme/tool");

  const hf = await Issue.find({ archived: false, isHacktoberfest: true });
  assert.equal(hf.length, 1);
  assert.equal(hf[0].language, "Go");

  const excluded = await Issue.find({
    archived: false,
    issueUrl: { $nin: ["https://github.com/acme/tool/issues/7"] },
  });
  assert.equal(excluded.length, 1);
});

test("results come back ordered by baseScore so pagination is stable", async () => {
  await insert(candidate({ htmlUrl: "https://github.com/a/one/issues/1", repoFullName: "a/one", comments: 0, createdAt: daysAgo(1).toISOString() }), signals({ fullName: "a/one" }));
  await insert(candidate({ htmlUrl: "https://github.com/a/two/issues/2", repoFullName: "a/two", comments: 40, createdAt: daysAgo(700).toISOString(), updatedAt: daysAgo(700).toISOString() }), signals({ fullName: "a/two", stars: 4, forks: 0, pushedAt: daysAgo(600), hasContributing: false, hasCodeOfConduct: false, hasCi: false }));

  const page1 = await Issue.find({}).sort({ baseScore: -1 }).limit(1).lean();
  const all = await Issue.find({}).sort({ baseScore: -1 }).lean();

  assert.equal(page1[0].repoFullName, "a/one");
  assert.ok(all[0].baseScore >= all[1].baseScore);
});

test("ApiCache keys are unique and track etag hits against misses", async () => {
  const key = "gh:typescript:good first issue";
  await ApiCache.create({ queryKey: key, etag: 'W/"abc"' });
  await assert.rejects(() => ApiCache.create({ queryKey: key }), /duplicate key/i);

  await ApiCache.updateOne({ queryKey: key }, { $inc: { hitCount: 1 }, $set: { lastStatus: 304 } });
  await ApiCache.updateOne({ queryKey: key }, { $inc: { missCount: 1 }, $set: { lastStatus: 200 } });

  const row = await ApiCache.findOne({ queryKey: key }).lean();
  assert.equal(row?.hitCount, 1);
  assert.equal(row?.missCount, 1);
  assert.equal(row?.etag, 'W/"abc"', "a 304 must not clear the stored etag");
});
