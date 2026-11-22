import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const workerPath = fileURLToPath(new URL("../preview/worker.mjs", import.meta.url));
const worker = readFileSync(workerPath, "utf8");

test("preview Worker parses as valid JavaScript", () => {
  const result = spawnSync(process.execPath, ["--check", workerPath], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("preview overrides only the feature-branch viewer and repair module", () => {
  assert.ok(worker.includes('"/garage"'));
  assert.ok(worker.includes('"/garage-overrides.css"'));
  assert.ok(worker.includes('"/manuals.css"'));
  assert.ok(worker.includes('file: "garage.html"'));
  assert.ok(worker.includes('"/manuals"'));
  assert.ok(worker.includes('"/manuals.html"'));
  assert.ok(worker.includes('"/repair-workspace.js"'));
  assert.ok(worker.includes("feat/compact-repair-engine-integration/public"));
});

test("manual requests proxy to the existing Worker without a new storage binding", () => {
  assert.match(worker, /claude-manual\.phillipstg\.workers\.dev/);
  assert.match(worker, /url\.pathname\.startsWith\("\/m\/"\)/);
  assert.doesNotMatch(worker, /R2|bucket\.put|\.put\(/i);
});

test("manual HTML rewrites root-relative Phoenix assets into the R2 manual path", () => {
  assert.match(worker, /const manualRoot = url\.pathname\.split\("\/"\)\.slice\(0, 4\)\.join\("\/"\)/);
  assert.ok(worker.includes("assets\\//.test(value)"));
  assert.match(worker, /manualRoot \+ "\/" \+ value\.replace/);
});


test("preview Worker retries missing vehicle-local assets from the manual-level assets directory", () => {
  assert.match(worker, /response\.status === 404/);
  assert.match(worker, /assetPath = url\.pathname\.match/);
  assert.match(worker, /\/m\/\$\{assetPath\[1\]\}\/assets\/\$\{assetPath\[2\]\}/);
});


test("preview page overrides fall back to the GitHub Contents API when raw source fetch fails", () => {
  assert.ok(worker.includes("api.github.com/repos/5cxxpb2yrr-ui/claude-manual/contents/public/"));
  assert.match(worker, /apiResponse\.ok/);
  assert.match(worker, /file\.encoding === "base64"/);
  assert.match(worker, /Preview source unavailable/);
});

test("Garage Manual Explorer project and repair-cart links navigate in the current tab", async () => {
  const garage = readFileSync(new URL("../public/garage.html", import.meta.url), "utf8");
  assert.match(garage, /:href="manualProjectLink\(selectedProject\)"(?![^>]*\btarget="_blank")/);
  assert.match(garage, /:href="repairCartManualLink\(cart\)"(?![^>]*\btarget="_blank")/);
});
