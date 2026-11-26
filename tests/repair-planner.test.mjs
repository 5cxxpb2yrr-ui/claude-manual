import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const plannerSource=readFileSync(new URL("../public/repair-planner.js",import.meta.url),"utf8");
const garage=readFileSync(new URL("../public/garage.html",import.meta.url),"utf8");
const module={exports:{}};
new Function("module",plannerSource)(module);
const planner=module.exports;
const doc=(id,title,role="component")=>({id,title,role,sourcePath:"/v/0/0/"+id,sourceLabel:"Factory manual #"+id,specs:[]});
const plan={vehicleId:"subaru-crosstrek",sections:["Front Oxygen (A/F) Sensor","Rear Oxygen Sensor"],documents:[doc(7655,"Front Oxygen (A/F) Sensor: Removal"),doc(7656,"Front Oxygen (A/F) Sensor: Installation"),doc(7657,"Front Oxygen (A/F) Sensor: Inspection"),doc(7658,"Rear Oxygen Sensor: Removal"),doc(7659,"Rear Oxygen Sensor: Installation"),doc(7660,"Rear Oxygen Sensor: Inspection"),doc(14661,"Repair Contents: Note: Battery","support"),doc(14687,"Front Under Cover: Removal","support"),doc(14688,"Front Under Cover: Installation","support")]};
test("Subaru oxygen repair phases include shared dependencies and both installation sources",()=>{
 const phases=planner.buildGuidedPhases(plan);
 assert.deepEqual(phases.map(p=>p.id),["scope","readiness","isolate","access","remove","inspect","install","reassemble","verify"]);
 assert.deepEqual(phases.find(p=>p.id==="install").documents.map(d=>d.id),[7656,7659]);
 assert.deepEqual(phases.find(p=>p.id==="reassemble").documents.map(d=>d.id),[14688,14661]);
});
test("missing supporting sources do not produce a prescriptive oxygen sensor sequence",()=>{
 const phases=planner.buildGuidedPhases({...plan,documents:plan.documents.filter(d=>d.id!==14688)});
 assert.ok(phases.some(p=>p.id==="manual-work"));
 assert.ok(!phases.some(p=>p.id==="install"));
});
test("Garage guided phases persist, lock later phases and roll back failed saves",async()=>{
 const code=garage.slice(garage.indexOf("projectGuidedPhases(project) {"),garage.indexOf("guidedRepairProgress(entry) {"));
 const mock={...new Function("window","return ({"+code+"})")({MotorNoteRepairPlanner:planner}),selectedProject:{repairPlan:plan},modals:{},guidedSaving:false,saveToStorage:async()=>true};
 mock.openProjectGuided(mock.selectedProject);
 assert.equal(mock.projectGuidedCanOpen(mock.selectedProject,1),false);
 await mock.completeGuidedPhase();
 assert.equal(mock.guidedPhaseIndex,1);
 assert.equal(mock.projectGuidedDone(mock.selectedProject),1);
 mock.saveToStorage=async()=>false;
 await mock.completeGuidedPhase();
 assert.equal(mock.projectGuidedDone(mock.selectedProject),1);
 assert.ok(mock.guidedError);
 mock.selectedProject=JSON.parse(JSON.stringify(mock.selectedProject));
 mock.openProjectGuided(mock.selectedProject);
 assert.equal(mock.guidedPhaseIndex,1);
});
