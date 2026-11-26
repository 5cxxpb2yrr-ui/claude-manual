import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Script } from "node:vm";

test("alternator search includes generator procedures and ranks service work above maps and DTCs", () => {
  const html = readFileSync(new URL("../public/manuals.html", import.meta.url), "utf8");
  assert.match(html, /termGroups=terms\.map\(t=>\/\^\(alternator\|alternators\)\$\/\.test\(t\)\?\["alternator","alternators","generator","generators"\]/);
  assert.match(html, /tumble generator valve/i);
  assert.match(html, /serviceProcedureBonus=.*?repair and diagnosis.*?removal\|installation\|inspection\|testing\|service and repair/s);
  assert.match(html, /mapPenalty=.*?map - electrical systems.*?700/s);
  assert.match(html, /dtcPenalty=.*?dtc .*?700/s);
  assert.match(html, /variantPenalty=.*?different variant\/trim.*?700/s);
  assert.match(html, /guides\[gi\]\.title\+" › "/);
});

test("manual explorer inline application script parses before boot", () => {
  const html = readFileSync(new URL("../public/manuals.html", import.meta.url), "utf8");
  const match = html.match(/<script>([\s\S]*?)<\/script>/);

  assert.ok(match, "manual explorer inline script should exist");
  assert.doesNotThrow(
    () => new Script(match[1], { filename: "public/manuals.html" }),
    "manual explorer inline script should be valid JavaScript",
  );
});
