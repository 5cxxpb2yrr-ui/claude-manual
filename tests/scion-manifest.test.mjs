import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const manifest = JSON.parse(
  readFileSync(new URL("../public/data/manifest.json", import.meta.url), "utf8"),
);

test("Scion search results resolve into the published Standard manual folder", () => {
  const scion = manifest.vehicles.find((vehicle) => vehicle.name === "2006 Scion xB");
  assert.ok(scion, "Scion xB must be present in the manual manifest");
  assert.equal(scion.manual, "scion-service-manual");
  assert.equal(scion.folder, "2006 Scion xB Standard");

  const pageUrl = "/m/" + [scion.manual, scion.folder, "pages", "6661.html"]
    .map(encodeURIComponent)
    .join("/");
  assert.equal(
    pageUrl,
    "/m/scion-service-manual/2006%20Scion%20xB%20Standard/pages/6661.html",
  );
});
