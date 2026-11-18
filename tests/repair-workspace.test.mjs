import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";

const require = createRequire(import.meta.url);
const Engine = require("../public/repair-workspace.js");
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

test("engine is importable without a browser and keeps carts local", () => {
  assert.equal(typeof Engine.extractProcedure, "function");
  assert.equal(typeof Engine.toRelationships, "function");
  const source = readFileSync(script, "utf8");
  assert.match(source, /lifeos\.repair\.carts\.v1/);
  assert.match(source, /Stored in this browser only/);
  assert.match(source, /Export JSON/);
});

test("Scion water-pump page excerpt distinguishes the service target from a required new gasket", () => {
  // Short excerpts taken from the indexed 2006 Scion xB Water Pump: Service and Repair page (page 6552).
  const realPageExcerpt = `
    <h1>Water Pump: Service and Repair</h1>
    <b>REMOVAL</b>
    <p>REMOVE GENERATOR V BELT</p>
    <p>REMOVE WATER PUMP ASSEMBLY</p>
    <p>Remove the water pump and gasket.</p>
    <b>INSTALLATION</b>
    <p>Install a new gasket and the water pump with the 3 bolts and 2 nuts.</p>
    <p>Torque: 11 Nm (112 kgf-cm, 8 ft. lbs.)</p>
    <p>Using SST, install the pump pulley.</p>
    <p>SST 09960-10010 (09962-01000, 09963-00600)</p>`;
  const facts = Engine.extractProcedure(realPageExcerpt);
  const part = id => facts.parts.find(item => item.id === id);

  assert.equal(part("water-pump").relationship, "target");
  assert.equal(part("gasket").relationship, "required");
  assert.equal(part("drive-belt").relationship, "mention");
  assert.ok(!Engine.toRelationships(facts).requiredParts.includes("water-pump"));
  assert.ok(Engine.toRelationships(facts).requiredParts.includes("gasket"));
  assert.deepEqual(facts.torque.map(x => [x.value, x.unit]), [
    [11, "N·m"], [112, "kgf·cm"], [8, "ft·lbf"]
  ]);
  assert.ok(facts.tools.includes("special-service-tool"));
  assert.ok(facts.toolReferences.some(x => x.reference.includes("09960-10010")));
});

test("Subaru oil-filter excerpt detects the filter as a service target and the manual-specified wrench", () => {
  // Short excerpts taken from the indexed 2019 Subaru Crosstrek Oil Filter removal page (page 7751).
  const realPageExcerpt = `
    <h1>Oil Filter</h1>
    <ol><li>Remove the oil filter.</li></ol>
    <p>Special tool:</p>
    <p>OIL FILTER WRENCH (18332AA000)</p>
    <p>Preparation tool:</p>
    <p>Oil filter wrench (65/67 mm 14 Flutes)</p>`;
  const facts = Engine.extractProcedure(realPageExcerpt);
  assert.equal(facts.parts.find(x => x.id === "oil-filter").relationship, "target");
  assert.ok(facts.tools.includes("oil-filter-wrench"));
  assert.ok(facts.toolReferences.some(x => x.reference === "18332AA000"));
});

test("EyeSight mention alone does not claim calibration is required", () => {
  const excerpt = `
    <h1>Windshield Glass And Dashboard</h1>
    <p>Check the windshield glass and dashboard in front of the stereo camera.</p>`;
  const facts = Engine.extractProcedure(excerpt);
  assert.equal(facts.requiresCalibration, false);
  assert.equal(facts.parts.find(x => x.id === "windshield").relationship, "target");
});

test("replacement cues are scoped to the named part on a line", () => {
  const facts = Engine.extractProcedure(`
    <h1>Water Pump: Service and Repair</h1>
    <p>Install a new gasket and the water pump.</p>`);
  assert.equal(facts.parts.find(x => x.id === "gasket").relationship, "required");
  assert.equal(facts.parts.find(x => x.id === "water-pump").relationship, "target");
});

test("HTML text extraction removes scripts and decodes entities", () => {
  assert.equal(Engine.htmlToText("<script>x()</script><p>A &amp; B</p><p>C&nbsp;D</p>"), "A & B\nC D");
});

test("torque parser supports OEM unit variants", () => {
  const torque = Engine.extractTorque("9.0 N·m (92 kgf·cm, 80 in·lbf)\n37 ft. lbs.");
  assert.deepEqual(torque.map(x => x.unit), ["N·m", "kgf·cm", "in·lbf", "ft·lbf"]);
});

test("torque cart eligibility requires an explicit fastener association and consistent units", () => {
  const supported = Engine.extractProcedure(`
    <h1>Water Pump: Service and Repair</h1>
    <p>Water pump bolts torque: 11 Nm (112 kgf-cm, 8 ft. lbs.)</p>`);
  assert.equal(supported.torqueSpecs[0].association.component, "Water Pump");
  assert.equal(supported.torqueSpecs[0].consistent, true);
  assert.equal(supported.torqueSpecs[0].selectable, true);

  const unassigned = Engine.extractProcedure(`
    <h1>Oil Filter: Service and Repair</h1>
    <p>Torque: 17.2 Nm (175 kgf-cm, 13 ft. lbs.)</p>`);
  assert.equal(unassigned.torqueSpecs[0].association, null);
  assert.equal(unassigned.torqueSpecs[0].selectable, false);

  const inconsistent = Engine.extractProcedure(`
    <h1>Front Axle: Service and Repair</h1>
    <p>Front axle nut torque: 132 Nm (350 kgf-cm, 97 ft. lbs.)</p>`);
  assert.equal(inconsistent.torqueSpecs[0].consistent, false);
  assert.equal(inconsistent.torqueSpecs[0].selectable, false);
  assert.match(inconsistent.torqueSpecs[0].reviewReason, /Conflicting unit conversions/);
});
