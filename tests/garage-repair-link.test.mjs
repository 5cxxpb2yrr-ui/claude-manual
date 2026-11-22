import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const path = fileURLToPath(new URL("../public/garage.html", import.meta.url));
const html = readFileSync(path, "utf8");

test("Garage publishes vehicle-linked projects for Manual Explorer", () => {
  assert.match(html, /lifeos\.repair\.projects\.v1/);
  assert.match(html, /publishRepairProjectIndex\(\)/);
  assert.match(html, /vehicleId:project\.vehicleId/);
});

test("Garage project details link back to the vehicle's Manual Explorer Repair Cart tab", () => {
  assert.match(html, /manualProjectLink\(selectedProject\)/);
  assert.match(html, /repairCartsForProject\(selectedProject\)/);
  assert.match(html, /repairCartManualLink\(cart\)/);
});

test("Garage supports vehicle and project deep links from Manual Explorer", () => {
  assert.match(html, /requestedVehicle=deepLink\.get\('vehicleId'\)/);
  assert.match(html, /requestedProject=deepLink\.get\('projectId'\)/);
  assert.match(html, /createProject=deepLink\.get\('newProject'\)===\'1\'/);
});

test("Garage inline JavaScript remains syntactically valid", () => {
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)].map(x => x[1]).filter(x => x.trim());
  assert.ok(scripts.length);
  for (const source of scripts) {
    const result = spawnSync(process.execPath, ["--check", "-"], { input: source, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr || result.stdout);
  }
});

test("Kanban cards and project modals identify their associated vehicle", () => {
  assert.equal((html.match(/vehicleNameForProject\(proj\)/g) || []).length, 2);
  assert.match(html, /vehicleNameForProject\(selectedProject\)/);
  assert.match(html, /activeVehicle\?\.name \|\| 'Select a vehicle first'/);
  assert.match(html, /vehicleNameForProject\(project\)/);
});

test("Garage imports the full Repair Cart draft into the new vehicle project", () => {
  assert.match(html, /lifeos\.repair\.project-draft\.v1/);
  assert.match(html, /requestedRepairDraft=deepLink\.get\('repairDraft'\)/);
  assert.match(html, /title:cart\?\x60\$\{procedure\} — \$\{vehicleName\}\x60:'Repair Project'/);
  assert.match(html, /cartSnapshot:cart/);
  assert.match(html, /procedures:\s*procedureRecord\?\s*\[\s*procedureRecord\s*\]\s*:\s*\[\s*\]/);
  assert.match(html, /partRequirements: importedParts/);
  assert.match(html, /tasks: importedTasks/);
  assert.match(html, /projectId:p\.id/);
  assert.match(html, /localStorage\.removeItem\('lifeos\.repair\.project-draft\.v1'\)/);
});
