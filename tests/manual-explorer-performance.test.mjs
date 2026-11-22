import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const path = fileURLToPath(new URL("../public/manuals.html", import.meta.url));
const html = readFileSync(path, "utf8");
const inline = [...html.matchAll(/<script(?:\\s[^>]*)?>([\\s\\S]*?)<\\/script>/gi)].map(x => x[1]).filter(x => x.trim());

test("Manual Explorer loads only the index needed for the requested route", () => {
  assert.match(html, /async function ensureGuide\\(vi,gi\\)/);
  assert.match(html, /async function ensureRouteIndexes\\(a,b,c\\)/);
  assert.match(html, /await ensureRouteIndexes\\(a,b,c\\)/);
  assert.doesNotMatch(html, /M\\.vehicles\\.flatMap\\(\\(v,vi\\)=>v\\.guides\\.map\\(async/);
});

test("Manual search still loads all guide indexes on demand", () => {
  assert.match(html, /if\\(a==="search"\\)\\{await ensureAllGuides\\(\\);return\\}/);
  assert.match(html, /if\\(a==="v"\\|\\|a==="t"\\)\\{await ensureGuide\\(\\+b,\\+c\\);return\\}/);
});

test("Manual Explorer inline JavaScript remains syntactically valid", () => {
  assert.ok(inline.length);
  for (const source of inline) {
    const result = spawnSync(process.execPath, ["--check", "-"], { input: source, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  }
});
