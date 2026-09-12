import { test } from "node:test";
import assert from "node:assert/strict";
import {
  compactNumber,
  relativeTime,
  plainPreview,
  scoreTone,
} from "../src/lib/format";

const daysAgo = (days: number) =>
  new Date(Date.now() - days * 86_400_000);

test("compactNumber keeps numbers below 1000 unchanged", () => {
  assert.equal(compactNumber(999), "999");
});

test("compactNumber formats 1000 as 1.0k", () => {
  assert.equal(compactNumber(1000), "1.0k");
});

test("compactNumber formats 9999 with one decimal", () => {
  assert.equal(compactNumber(9999), "10.0k");
});

test("compactNumber formats 10000 without a decimal", () => {
  assert.equal(compactNumber(10000), "10k");
});

test("compactNumber formats one million as 1.0m", () => {
  assert.equal(compactNumber(1_000_000), "1.0m");
});

test("relativeTime returns unknown for null", () => {
  assert.equal(relativeTime(null), "unknown");
});

test("relativeTime returns today for the current date", () => {
  assert.equal(relativeTime(new Date()), "today");
});

test("relativeTime returns yesterday for one day ago", () => {
  assert.equal(relativeTime(daysAgo(1)), "yesterday");
});

test("relativeTime returns days for dates less than 30 days old", () => {
  assert.equal(relativeTime(daysAgo(29)), "29d ago");
});

test("relativeTime switches to months at 30 days", () => {
  assert.equal(relativeTime(daysAgo(30)), "1mo ago");
});

test("relativeTime uses months until one year", () => {
  assert.equal(relativeTime(daysAgo(364)), "12mo ago");
});

test("relativeTime switches to years after 365 days", () => {
  assert.equal(relativeTime(daysAgo(400)), "1y ago");
});

test("plainPreview removes fenced code blocks", () => {
  assert.equal(
    plainPreview("Hello ```js\nconst x = 1;\n``` world"),
    "Hello world",
  );
});

test("plainPreview removes images", () => {
  assert.equal(
    plainPreview("Hello ![cat](cat.png) world"),
    "Hello world",
  );
});

test("plainPreview keeps link text and removes the URL", () => {
  assert.equal(
    plainPreview("Visit [GitHub](https://github.com) today"),
    "Visit GitHub today",
  );
});

test("plainPreview removes HTML comments", () => {
  assert.equal(
    plainPreview("Hello <!-- secret comment --> world"),
    "Hello world",
  );
});

test("plainPreview leaves short text without an ellipsis", () => {
  assert.equal(
    plainPreview("Short text", 20),
    "Short text",
  );
});

test("plainPreview truncates text longer than max", () => {
  assert.equal(
    plainPreview("This is a long piece of text", 10),
    "This is a…",
  );
});

test("scoreTone uses the amber tone at exactly 0.45", () => {
  assert.equal(scoreTone(0.45), "text-amber-400");
});

test("scoreTone uses the primary tone at exactly 0.7", () => {
  assert.equal(scoreTone(0.7), "text-primary");
});