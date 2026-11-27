import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import worker, { servePdfReader } from "../worker.js";
import { PDF_READER_FILES } from "../pdf-reader-data.mjs";
const url = "https://example.com/api/receipt-pdf/4.10.38/";
test("PDF modules use explicit JavaScript MIME and preserve exact content", async () => {
  const payload = "export const example = 1;\n";
  const res = servePdfReader(new Request(url + "pdf.mjs"), { "pdf.mjs": payload });
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type"), /^text\/javascript/);
  assert.equal(await res.text(), payload);
  assert.equal(res.headers.get("cache-control"), "no-store");
});
test("PDF reader route never invokes SPA fallback", async () => {
  const env = { ASSETS: { fetch() { throw new Error("unexpected fallback"); } } };
  const missing = await worker.fetch(new Request(url + "missing.mjs"), env);
  assert.equal(missing.status, 404);
  for (const name of ["pdf.mjs", "pdf.worker.mjs"]) {
    const response = await worker.fetch(new Request(url + name), env);
    if (!PDF_READER_FILES[name]) { assert.equal(response.status, 503); continue; }
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type"), /^text\/javascript/);
    assert.equal(await response.text(), readFileSync(new URL("../node_modules/pdfjs-dist/legacy/build/" + name, import.meta.url), "utf8"));
  }
});
