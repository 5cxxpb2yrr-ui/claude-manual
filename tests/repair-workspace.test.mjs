import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const script = new URL("../public/repair-workspace.js", import.meta.url);
const html = readFileSync(new URL("../public/manuals.html", import.meta.url), "utf8");

test("repair workspace module parses as valid JavaScript", () => {
  const result = spawnSync(process.execPath, ["--check", script.pathname], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test("manual viewer exposes the repair workspace from procedure pages", () => {
  assert.match(html, /data-repair-workspace/);
  assert.match(html, /src="\/repair-workspace\.js" defer/);
});

test("repair workspace keeps carts local and supports evidence, torque, and exports", () => {
  const source = readFileSync(script, "utf8");
  assert.match(source, /lifeos\.repair\.carts\.v1/);
  assert.match(source, /evidence/);
  assert.match(source, /Torque specifications/);
  assert.match(source, /Export JSON/);
});
