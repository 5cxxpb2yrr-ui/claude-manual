import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const path = fileURLToPath(new URL("../public/manuals.html", import.meta.url));
const html = readFileSync(path, "utf8");
const inline = [...html.matchAll(/<script(?:\\s[^>]*)?>([\\s\\S]*?)<\\/script>/gi)].map(x => x[1]).filter(x => x.trim());

test("Manual Explorer loads guide indexes on demand for the selected route", () => {
  assert.match(html, /async function loadGuide/);
  assert.match(html, /async function loadAllGuides/);
  assert.match(html, /await loadAllGuides\\(\\)/);
  assert.match(html, /await loadGuide\\(\\+b,\\+c\\)/);
  assert.doesNotMatch(html, /M\\.vehicles\\.flatMap\\(\\(v,vi\\)=>v\\.guides\\.map\\(async/);
});

test("Manual search loads all guide indexes only when the search route is opened", () => {
  assert.match(html, /if\\(a==="search"\\)[\\s\\S]*?await loadAllGuides\\(\\)/);
  assert.match(html, /if\\(a==="t"\\|\\|a==="v"\\)[\\s\\S]*?await loadGuide\\(\\+b,\\+c\\)/);
});

test("Manual Explorer inline JavaScript remains syntactically valid", () => {
  assert.ok(inline.length);
  for (const source of inline) {
    const result = spawnSync(process.execPath, ["--check", "-"], { input: source, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  }
});
