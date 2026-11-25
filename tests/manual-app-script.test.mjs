import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Script } from "node:vm";

test("manual explorer inline application script parses before boot", () => {
  const html = readFileSync(new URL("../public/manuals.html", import.meta.url), "utf8");
  const match = html.match(/<script>([\s\S]*?)<\/script>/);

  assert.ok(match, "manual explorer inline script should exist");
  assert.doesNotThrow(
    () => new Script(match[1], { filename: "public/manuals.html" }),
    "manual explorer inline script should be valid JavaScript",
  );
});
