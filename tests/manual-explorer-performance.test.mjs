import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const path = fileURLToPath(new URL("../public/manuals.html", import.meta.url));
const html = readFileSync(path, "utf8");
const scriptStart = html.indexOf("<script>") + "<script>".length;
const scriptEnd = html.indexOf("</script>", scriptStart);
const inline = html.slice(scriptStart, scriptEnd);

test("Manual Explorer loads guide indexes on demand for the selected route", () => {
  assert.ok(html.includes("async function loadGuide("));
  assert.ok(html.includes("async function loadAllGuides("));
  assert.ok(html.includes("await loadAllGuides()"));
  assert.ok(html.includes("await loadGuide(+b,+c)"));
  assert.ok(!html.includes("M.vehicles.flatMap((v,vi)=>v.guides.map(async"));
});

test("Manual search loads all guide indexes only when the search route is opened", () => {
  assert.ok(html.includes('if(a==="search")'));
  assert.ok(html.includes("await loadAllGuides()"));
  assert.ok(html.includes('else if(a==="t"||a==="v")'));
  assert.ok(html.includes("await loadGuide(+b,+c)"));
});

test("Manual Explorer inline JavaScript remains syntactically valid", () => {
  assert.ok(inline.trim());
  const result = spawnSync(process.execPath, ["--check", "-"], { input: inline, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
