import { after, before, beforeEach, test } from "node:test";
import assert from "node:assert/strict";

/** Mongoose phrases validation errors differently for create() vs save(). */
const isValidationError = (err: unknown) =>
  err instanceof mongoose.Error.ValidationError;
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { User } from "../src/models/User";
import { SavedIssue } from "../src/models/SavedIssue";
import { SkippedIssue } from "../src/models/SkippedIssue";

let mongo: MongoMemoryServer;

before(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), { dbName: "oss-match-test" });
  // Unique indexes are only enforced once built.
  await Promise.all([
    User.syncIndexes(),
    SavedIssue.syncIndexes(),
    SkippedIssue.syncIndexes(),
  ]);
});

after(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

beforeEach(async () => {
  await Promise.all([
    User.deleteMany({}),
    SavedIssue.deleteMany({}),
    SkippedIssue.deleteMany({}),
  ]);
});

async function makeUser() {
  return User.create({ githubId: "1", username: "octocat" });
}

function issueFields(userId: mongoose.Types.ObjectId) {
  return {
    userId,
    issueUrl: "https://github.com/acme/tool/issues/42",
    issueNumber: 42,
    issueTitle: "Fix the thing",
    repoName: "acme/tool",
    repoUrl: "https://github.com/acme/tool",
  };
}

test("a user starts un-onboarded with empty preferences", async () => {
  const user = await makeUser();
  assert.equal(user.onboardedAt, null);
  assert.equal(user.skillLevel, null);
  assert.deepEqual(user.interests, []);
});

test("githubId is unique across users", async () => {
  await makeUser();
  await assert.rejects(
    () => User.create({ githubId: "1", username: "impostor" }),
    /duplicate key/i,
  );
});

test("an invalid skill level is rejected", async () => {
  const user = await makeUser();
  user.set("skillLevel", "wizard");
  await assert.rejects(() => user.save(), isValidationError);
});

test("an invalid interest is rejected", async () => {
  const user = await makeUser();
  user.set("interests", ["web", "underwater-basket-weaving"]);
  await assert.rejects(() => user.save(), isValidationError);
});

test("a saved issue defaults to saved with no progress", async () => {
  const user = await makeUser();
  const issue = await SavedIssue.create(issueFields(user._id));
  assert.equal(issue.status, "saved");
  assert.deepEqual(issue.guideProgress, []);
  assert.ok(issue.savedAt instanceof Date);
});

test("the same user cannot save one issue twice", async () => {
  const user = await makeUser();
  await SavedIssue.create(issueFields(user._id));
  await assert.rejects(
    () => SavedIssue.create(issueFields(user._id)),
    /duplicate key/i,
  );
});

test("two users can each save the same issue", async () => {
  const a = await makeUser();
  const b = await User.create({ githubId: "2", username: "hubot" });
  await SavedIssue.create(issueFields(a._id));
  await SavedIssue.create(issueFields(b._id));
  assert.equal(await SavedIssue.countDocuments({}), 2);
});

test("guide progress outside 1-8 is rejected", async () => {
  const user = await makeUser();
  const issue = await SavedIssue.create(issueFields(user._id));

  issue.guideProgress = [0];
  await assert.rejects(() => issue.save(), isValidationError);

  issue.guideProgress = [9];
  await assert.rejects(() => issue.save(), isValidationError);

  issue.guideProgress = [1, 8];
  await issue.save();
  assert.deepEqual(issue.guideProgress, [1, 8]);
});

test("an invalid status is rejected", async () => {
  const user = await makeUser();
  const issue = await SavedIssue.create(issueFields(user._id));
  issue.set("status", "shipped");
  await assert.rejects(() => issue.save(), isValidationError);
});

test("skips are unique per user and issue", async () => {
  const user = await makeUser();
  const doc = { userId: user._id, issueUrl: "https://github.com/a/b/issues/1" };
  await SkippedIssue.create(doc);
  await assert.rejects(() => SkippedIssue.create(doc), /duplicate key/i);
});

test("upserting a skip twice is idempotent", async () => {
  const user = await makeUser();
  const filter = { userId: user._id, issueUrl: "https://github.com/a/b/issues/1" };
  await SkippedIssue.findOneAndUpdate(filter, filter, { upsert: true });
  await SkippedIssue.findOneAndUpdate(filter, filter, { upsert: true });
  assert.equal(await SkippedIssue.countDocuments({}), 1);
});

test("saving an issue with $setOnInsert does not clobber existing progress", async () => {
  const user = await makeUser();
  const fields = issueFields(user._id);

  const first = await SavedIssue.findOneAndUpdate(
    { userId: user._id, issueUrl: fields.issueUrl },
    { $setOnInsert: { ...fields, guideProgress: [1, 2, 3], status: "in-progress" } },
    { upsert: true, new: true },
  );
  assert.deepEqual(first.guideProgress, [1, 2, 3]);

  // A duplicate save (e.g. a double-tap in the feed) must be a no-op.
  const second = await SavedIssue.findOneAndUpdate(
    { userId: user._id, issueUrl: fields.issueUrl },
    { $setOnInsert: { ...fields, guideProgress: [], status: "saved" } },
    { upsert: true, new: true },
  );
  assert.deepEqual(second.guideProgress, [1, 2, 3]);
  assert.equal(second.status, "in-progress");
  assert.equal(await SavedIssue.countDocuments({}), 1);
});

test("only contributed issues surface on a public profile query", async () => {
  const user = await makeUser();
  await SavedIssue.create({ ...issueFields(user._id), status: "saved" });
  await SavedIssue.create({
    ...issueFields(user._id),
    issueUrl: "https://github.com/acme/tool/issues/43",
    status: "contributed",
  });

  const public_ = await SavedIssue.find({ userId: user._id, status: "contributed" });
  assert.equal(public_.length, 1);
  assert.equal(public_[0].issueNumber, 42);
});
