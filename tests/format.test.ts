import {test} from "node:test"
import assert from "node:assert";
import {compactNumber,relativeTime,plainPreview,scoreTone} from "../src/lib/format"

test("Formats compact numbers correctly around value boundaries",()=>{
    assert.strictEqual(compactNumber(999),"999")
    assert.strictEqual(compactNumber(1000),"1.0k")
    assert.strictEqual(compactNumber(999999), "1000k");
    assert.strictEqual(compactNumber(1000000), "1.0m");
})

test("Converts dates into human-readable relative time",()=>{
    assert.strictEqual(relativeTime(null), "unknown");
    assert.strictEqual(
        relativeTime(new Date(Date.now() - 86_400_000)),
        "yesterday"
      );
    assert.strictEqual(
        relativeTime(new Date(Date.now() - 86_400_000)),
        "yesterday"
      );

    assert.strictEqual(
        relativeTime(new Date(Date.now() - 30 * 86_400_000)),
        "1mo ago"
      );

    assert.strictEqual(
        relativeTime(new Date(Date.now() - 365 * 86_400_000)),
        "1y ago"
      );
    assert.strictEqual(relativeTime(new Date()), "today");
})

test("Converts Markdown into clean plain-text previews",()=>{
    assert.strictEqual(
        plainPreview("# Hello **world**"),
        "Hello world"
      );

    assert.strictEqual(
        plainPreview("[GitHub](https://github.com)"),
        "GitHub"
      );

    assert.strictEqual(
        plainPreview("Hello ![image](image.png) world"),
        "Hello world"
      );

    assert.strictEqual(
        plainPreview("Hello ```console.log('hi')``` world"),
        "Hello world"
      );

    assert.strictEqual(
        plainPreview("1234567890", 5),
        "12345…"
      );

    assert.strictEqual(
        plainPreview("12345", 5),
        "12345"
      );
})

test("Returns the correct text tone based on score thresholds",()=>{
    assert.strictEqual(scoreTone(0.7), "text-primary");
    assert.strictEqual(scoreTone(0.45), "text-amber-400");
    assert.strictEqual(scoreTone(0.44), "text-muted-foreground");

    assert.strictEqual(scoreTone(1), "text-primary");
    assert.strictEqual(scoreTone(0), "text-muted-foreground");
})