import { test } from "node:test";
import assert from "node:assert/strict";
import { box, bounds, facesOf, hexToHsl, hslToHex, merge, project, shade } from "@/lib/voxel";
import { figure } from "@/components/landing/story/characters";

test("box expands to w*d*h cubes at the right offsets", () => {
  const v = box(2, 3, 4, 2, 1, 3, "#fff");
  assert.equal(v.length, 6);
  assert.ok(v.some((c) => c.x === 3 && c.y === 3 && c.z === 6));
  assert.ok(!v.some((c) => c.x === 4), "nothing outside the box");
});

test("merge lets a later layer repaint a cube", () => {
  const base = box(0, 0, 0, 2, 1, 1, "#aaa");
  const eye = box(1, 0, 0, 1, 1, 1, "#000");
  const out = merge(base, eye);
  assert.equal(out.length, 2, "same cube, not a duplicate");
  assert.equal(out.find((c) => c.x === 1)?.color, "#000");
});

test("a lone cube shows exactly three faces", () => {
  const faces = facesOf(box(0, 0, 0, 1, 1, 1, "#808080"));
  assert.deepEqual(faces.map((f) => f.side).sort(), ["left", "right", "top"]);
});

test("touching cubes hide the faces between them", () => {
  // Two cubes side by side along x: the shared face is never drawn.
  const faces = facesOf(box(0, 0, 0, 2, 1, 1, "#808080"));
  assert.equal(faces.filter((f) => f.side === "right").length, 1, "only the outer +x face");
  assert.equal(faces.filter((f) => f.side === "top").length, 2);
  assert.equal(faces.filter((f) => f.side === "left").length, 2);
});

test("a stacked cube hides the top of the one beneath it", () => {
  const faces = facesOf(box(0, 0, 0, 1, 1, 2, "#808080"));
  assert.equal(faces.filter((f) => f.side === "top").length, 1);
});

test("faces come out in painter's order", () => {
  const faces = facesOf(merge(box(0, 0, 0, 1, 1, 1, "#000"), box(1, 1, 1, 1, 1, 1, "#000")));
  for (let i = 1; i < faces.length; i++) {
    assert.ok(faces[i].depth >= faces[i - 1].depth, "never draws a nearer cube before a farther one");
  }
});

test("projection sends +x to the lower-right and +y to the lower-left", () => {
  const [ox, oy] = project(0, 0, 0);
  const [xx, xy] = project(1, 0, 0);
  const [yx, yy] = project(0, 1, 0);
  const [, zy] = project(0, 0, 1);
  assert.ok(xx > ox && xy > oy);
  assert.ok(yx < ox && yy > oy);
  assert.ok(zy < oy, "+z goes up the screen");
});

test("lighting brightens the top and darkens the sides", () => {
  const [, , l] = hexToHsl("#808080");
  assert.ok(hexToHsl(shade("#808080", "top"))[2] > l);
  assert.ok(hexToHsl(shade("#808080", "right"))[2] < l);
  assert.ok(hexToHsl(shade("#808080", "left"))[2] < hexToHsl(shade("#808080", "right"))[2]);
});

test("hex to hsl and back round-trips", () => {
  for (const hex of ["#7c5cff", "#22d3ee", "#f1c7a0", "#000000", "#ffffff"]) {
    const [h, s, l] = hexToHsl(hex);
    assert.equal(hslToHex(h, s, l), hex);
  }
});

test("bounds wrap every corner of the figure", () => {
  const b = bounds(box(0, 0, 0, 1, 1, 1, "#000"));
  const [minCornerX] = project(0, 1, 0);
  const [maxCornerX] = project(1, 0, 0);
  assert.equal(b.minX, minCornerX);
  assert.equal(b.maxX, maxCornerX);
  assert.ok(b.height > 0 && b.width > 0);
});

test("every role builds a figure with a face", () => {
  const roles = ["newcomer", "guide", "crown", "beret", "beanie", "cap", "headset", "hood", "builder", "reader"] as const;
  for (const role of roles) {
    const v = figure({ role });
    assert.ok(v.length > 100, `${role} is a real figure, not a stub`);
    // The mouth is the one facial voxel every role keeps.
    assert.ok(v.some((c) => c.x === 3 && c.y === 1 && c.z === 7), `${role} kept its mouth`);
  }
});

test("roles differ from each other", () => {
  const a = JSON.stringify(figure({ role: "guide" }));
  const b = JSON.stringify(figure({ role: "newcomer" }));
  assert.notEqual(a, b);
});
