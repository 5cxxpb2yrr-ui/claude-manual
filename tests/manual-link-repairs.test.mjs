import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  SCION_PAGE_REPLACEMENTS,
  SCION_UNAVAILABLE_PAGE_IDS,
  resolveManualRootPath,
  resolveScionPageKey,
} from "../manual-link-repairs.mjs";

const scionPrefix =
  "manuals/scion-service-manual/2006 Scion xB L4-1.5L (1NZ-FE)/pages/";

test("all audited missing Scion IDs have an explicit disposition", () => {
  const auditedMissing = [
    610, 726, 775,
    1226, 1227, 1228, 1229, 1230, 1231, 1232, 1233, 1234, 1235, 1236,
    ...Array.from({ length: 30 }, (_, index) => 1265 + index),
    1369, 4238, 4248, 4266, 4274, 4276, 4280, 5970, 5972, 6056, 6379, 6735, 6759,
  ];

  const dispositionIds = [
    ...Object.keys(SCION_PAGE_REPLACEMENTS).map(Number),
    ...SCION_UNAVAILABLE_PAGE_IDS,
  ].sort((a, b) => a - b);

  assert.deepEqual(dispositionIds, auditedMissing.sort((a, b) => a - b));
  assert.equal(new Set(dispositionIds).size, auditedMissing.length);
});

test("verified equivalents resolve to existing indexed Scion pages", () => {
  const expected = {
    610: 36,
    726: 26,
    775: 1652,
    1227: 81,
    1228: 158,
    1230: 147,
    1231: 153,
    1232: 159,
    1233: 154,
    1234: 167,
    1235: 129,
    1369: 99,
    4238: 1667,
    4248: 1623,
    4274: 1636,
    4276: 1630,
    4280: 6546,
    5972: 1613,
    6379: 1614,
    6735: 1631,
  };

  assert.deepEqual(SCION_PAGE_REPLACEMENTS, expected);
  for (const [source, destination] of Object.entries(expected)) {
    const result = resolveScionPageKey(`${scionPrefix}${source}.html`);
    assert.equal(result.kind, "redirect");
    assert.equal(result.key, `${scionPrefix}${destination}.html`);
  }
});

test("unresolved pages are marked unavailable rather than redirected speculatively", () => {
  for (const pageId of SCION_UNAVAILABLE_PAGE_IDS) {
    const result = resolveScionPageKey(`${scionPrefix}${pageId}.html`);
    assert.deepEqual(result, { kind: "unavailable", pageId });
  }
});

test("legacy SEO suffixes are removed after the page filename", () => {
  const result = resolveScionPageKey(
    `${scionPrefix}1227.html/Hoses/Radiator%20Hose/`,
  );
  assert.equal(result.kind, "redirect");
  assert.equal(result.key, `${scionPrefix}81.html`);

  const commaSuffix = resolveScionPageKey(
    `${scionPrefix}1228.html, Cooling and Exhaust/Cooling System/Radiator Cap/`,
  );
  assert.equal(commaSuffix.kind, "redirect");
  assert.equal(commaSuffix.key, `${scionPrefix}158.html`);

  const existingPage = resolveScionPageKey(
    `${scionPrefix}1617.html/Management/Tune-up/`,
  );
  assert.equal(existingPage.kind, "canonical");
  assert.equal(existingPage.key, `${scionPrefix}1617.html`);
});

test("root-relative manual assets resolve within the vehicle folder", () => {
  const root = "manuals/scion-service-manual/2006 Scion xB L4-1.5L (1NZ-FE)";
  assert.equal(
    resolveManualRootPath(root, "/style.css"),
    "/m/scion-service-manual/2006 Scion xB L4-1.5L (1NZ-FE)/style.css",
  );
  assert.equal(
    resolveManualRootPath(root, "/"),
    "/m/scion-service-manual/2006 Scion xB L4-1.5L (1NZ-FE)/index.html",
  );
  assert.equal(
    resolveManualRootPath(root, "/assets/phoenix.css"),
    "/m/scion-service-manual/2006 Scion xB L4-1.5L (1NZ-FE)/assets/phoenix.css",
  );
  assert.equal(
    resolveManualRootPath(root, "/assets/phoenix.js"),
    "/m/scion-service-manual/2006 Scion xB L4-1.5L (1NZ-FE)/assets/phoenix.js",
  );
  assert.equal(
    resolveManualRootPath(root, "https://example.com/file.css"),
    "https://example.com/file.css",
  );
});


test("Scion manifest targets the published Standard corpus folder", () => {
  const manifest = JSON.parse(readFileSync(new URL("../public/data/manifest.json", import.meta.url), "utf8"));
  const scion = manifest.vehicles.find((vehicle) => vehicle.make === "Scion" && vehicle.year === "2006");
  assert.ok(scion, "2006 Scion xB must be present in the manual manifest");
  assert.equal(scion.folder, "2006 Scion xB Standard");
  assert.equal(resolveScionPageKey(`manuals/${scion.manual}/${scion.folder}/pages/13871.html`), null);
});
