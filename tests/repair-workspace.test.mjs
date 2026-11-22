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
  assert.match(html, /T\("rep","Repair Cart"\)/);
  assert.match(html, /lifeos\.repair\.projects\.v1/);
  assert.match(html, /\/garage\?vehicleId=/);
  assert.match(html, /src="\/repair-workspace\.js" defer/);
});

test("repair workspace reads the manual through the same-origin route instead of iframe DOM access", () => {
  const source = readFileSync(script, "utf8");
  assert.match(source, /fetch\(pageUrl\.href,\{credentials:"same-origin",cache:"no-store"\}\)/);
  assert.match(source, /new DOMParser\(\)\.parseFromString\(pageHtml,"text\/html"\)/);
  assert.doesNotMatch(source, /frame&&frame\.contentDocument/);
});

test("engine is importable without a browser and keeps carts local", () => {
  assert.equal(typeof Engine.extractProcedure, "function");
  assert.equal(typeof Engine.toRelationships, "function");
  const source = readFileSync(script, "utf8");
  assert.match(source, /lifeos\.repair\.carts\.v1/);
  assert.match(source, /lifeos\.repair\.projects\.v1/);
  assert.match(source, /projectTitle/);
  assert.match(source, /route:location\.hash/);
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
  assert.ok(supported.torqueSpecs[0].association, JSON.stringify(supported.torqueSpecs));
  assert.equal(supported.torqueSpecs[0].association.component, "Water Pump");
  assert.equal(supported.torqueSpecs[0].consistent, true);
  assert.equal(supported.torqueSpecs[0].selectable, true);

  const nearby = Engine.extractProcedure(`
    <h1>Water Pump: Service and Repair</h1>
    <p>Tighten the water pump bolts in the specified sequence.</p>
    <p>Torque: 11 Nm (112 kgf-cm, 8 ft. lbs.)</p>`);
  assert.equal(nearby.torqueSpecs[0].association.component, "Water Pump");
  assert.equal(nearby.torqueSpecs[0].selectable, true);

  const pulleyToolContext = Engine.extractProcedure(`
    <h1>Water Pump Pulley: Installation</h1>
    <p>ST2: PULLEY WRENCH PIN SET (18334AA020)</p>
    <p>Tightening torque: 14 N.m (1.4 kgf-m, 10.3 ft-lb)</p>
    <p>Install the V-belts.</p>`);
  assert.equal(pulleyToolContext.torqueSpecs[0].association.component, "Water Pump Pulley");
  assert.equal(pulleyToolContext.torqueSpecs[0].selectable, true);

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


test("unassigned torque can be manually assigned to a component and fastener in the repair workspace", () => {
  const source = readFileSync(script, "utf8");
  assert.match(source, /data-torque-component/);
  assert.match(source, /data-torque-fastener/);
  assert.match(source, /Assign component/);
  assert.match(source, /Choose fastener/);
  assert.match(source, /User-assigned in Repair Workspace/);
  assert.match(source, /savedTorque/);
});


test("rear wheel brake cylinder torque values inherit their own procedure-step associations and split into separate specs", () => {
  const facts = Engine.extractProcedure(`
    <h1>REAR WHEEL BRAKE CYLINDER ASSEMBLY LH</h1>
    <p>3. INSTALL REAR WHEEL BRAKE CYLINDER ASSEMBLY LH a) Install the wheel brake cylinder with the bolt. Torque: 9.8 Nm (100 kgf-cm, 87 inch lbs.) b) Using SST, connect the brake line. SST 09023-00101</p>
    <p>Torque: 15 Nm (155 kgf-cm, 11 ft. lbs.) without SST 14 Nm (143 kgf-cm, 10 ft. lbs.) with SST HINT: Use a torque wrench with a fulcrum length of 30 cm (11.81 inch).</p>
    <p>18. CHECK FOR BRAKE FLUID LEAKAGE 19. INSTALL REAR WHEEL Torque: 103 Nm (1,050 kgf-cm, 76 ft. lbs.)</p>`);
  assert.equal(facts.torqueSpecs.length, 4);
  assert.deepEqual(facts.torqueSpecs.map(x => x.values[0]), [
    {value:9.8,unit:"N·m"},
    {value:15,unit:"N·m"},
    {value:14,unit:"N·m"},
    {value:103,unit:"N·m"}
  ]);
  assert.deepEqual(facts.torqueSpecs.map(x => [x.association?.component,x.association?.fastener]), [
    ["Wheel Brake Cylinder","Bolt"],
    ["Brake Line","Brake line fitting"],
    ["Brake Line","Brake line fitting"],
    ["Wheel","Wheel nuts"]
  ]);
  assert.ok(facts.torqueSpecs.every(x => x.consistent && x.selectable));
  assert.equal(facts.torqueSpecs[3].values.find(x => x.unit==="kgf·cm").value,1050);
});

test("manual torque assignment choices are restricted to components and fasteners on the active page", () => {
  const facts = Engine.extractProcedure(`<h1>Water Pump: Service and Repair</h1><p>Remove the water pump.</p><p>Remove the two water pump bolts.</p><p>Tightening torque: 11 Nm (112 kgf-cm, 8 ft. lbs.)</p>`);
  const options = Engine.torqueAssignmentOptions(facts);
  assert.ok(options.components.includes("Water Pump"));
  assert.ok(!options.components.includes("Oil Filter"));
  assert.deepEqual(options.fasteners, ["Bolt(s)"]);

  const pulley = Engine.extractProcedure(`<h1>Water Pump Pulley: Installation</h1><p>ST2: PULLEY WRENCH PIN SET (18334AA020)</p><p>Tightening torque: 14 N.m (1.4 kgf-m, 10.3 ft-lb)</p><p>Install the V-belts.</p>`);
  assert.deepEqual(Engine.torqueAssignmentOptions(pulley).fasteners, ["Pulley mounting fastener"]);
});


test("water-pump assembly and pulley torques associate to their own numbered installation steps", () => {
  const excerpt = `
    <h1>Water Pump: Service and Repair</h1>
    <b>INSTALLATION</b>
    <p>1. INSTALL WATER PUMP ASSEMBLY</p>
    <p>a) Install a new gasket and the water pump with the 3 bolts and 2 nuts.</p>
    <p>Torque: 11 Nm (112 kgf-cm, 8 ft. lbs.)</p>
    <p>2. INSTALL WATER PUMP PULLEY</p>
    <p>a) Using SST, install the pump pulley with the 3 bolts.</p>
    <p>SST 09960-10010 (09962-01000, 09963-00600)</p>
    <p>Torque: 15 Nm (153 kgf-cm, 11 ft. lbs.)</p>`;
  const facts = Engine.extractProcedure(excerpt);
  assert.equal(facts.torqueSpecs.length, 2);
  assert.deepEqual(facts.torqueSpecs.map(x => x.values[0]), [
    {value:11,unit:"N·m"}, {value:15,unit:"N·m"}
  ]);
  assert.deepEqual(facts.torqueSpecs.map(x => [x.association?.component,x.association?.fastener]), [
    ["Water Pump Assembly","Bolts and nuts"],
    ["Water Pump Pulley","Bolts"]
  ]);
  assert.ok(facts.torqueSpecs.every(x => x.consistent && x.selectable));
  assert.match(facts.torqueSpecs[0].association.evidence, /1\. INSTALL WATER PUMP ASSEMBLY/);
  assert.match(facts.torqueSpecs[1].association.evidence, /2\. INSTALL WATER PUMP PULLEY/);
  assert.ok(facts.tools.includes("special-service-tool"));
  assert.ok(facts.toolReferences.some(x => x.reference.includes("09960-10010")));
});

test("Repair Workspace can create a new Garage project for the active vehicle and refresh the project selector", () => {
  const source = readFileSync(script, "utf8");
  assert.match(source, /id="rw-create-project"/);
  assert.match(source, /Create new Garage project/);
  assert.match(source, /\/garage\?vehicleId=/);
  assert.match(source, /newProject=1/);
  assert.match(source, /id="rw-refresh-projects"/);
  assert.match(source, /refreshProjects\(\)/);
});
