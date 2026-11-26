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
 const code=garage.slice(garage.indexOf("inventoryMatchKey(value) {"),garage.indexOf("guidedRepairProgress(entry) {"));
 const mock={...new Function("window","return ({"+code+"})")({MotorNoteRepairPlanner:planner}),selectedProject:{repairPlan:plan},modals:{},guidedSaving:false,saveToStorage:async()=>true};
 mock.openProjectGuided(mock.selectedProject);
 assert.equal(mock.projectGuidedCanOpen(mock.selectedProject,1),false);
 await mock.completeGuidedPhase();
 assert.equal(mock.guidedPhaseIndex,1);
 assert.equal(mock.projectGuidedDone(mock.selectedProject),1);
 await mock.completeGuidedPhase();
 assert.equal(mock.projectGuidedDone(mock.selectedProject),1);
 assert.match(mock.guidedError,/Confirm all preparation/);
 for(const item of mock.projectReadiness(mock.selectedProject).items)await mock.setProjectReadiness(mock.selectedProject,item.id,true);
 assert.equal(mock.projectReadiness(mock.selectedProject).ready,true);
 mock.saveToStorage=async()=>false;
 await mock.completeGuidedPhase();
 assert.equal(mock.projectGuidedDone(mock.selectedProject),1);
 assert.ok(mock.guidedError);
 mock.selectedProject=JSON.parse(JSON.stringify(mock.selectedProject));
 mock.openProjectGuided(mock.selectedProject);
 assert.equal(mock.guidedPhaseIndex,1);
});

test("readiness uses explicit checks and missing source documents block completion",async()=>{
 const code=garage.slice(garage.indexOf("inventoryMatchKey(value) {"),garage.indexOf("guidedRepairProgress(entry) {"));
 const mock={...new Function("window","return ({"+code+"})")({MotorNoteRepairPlanner:planner}),saveToStorage:async()=>true};
 const project={repairPlan:{...plan,parts:[{name:"Sensor",relationship:"candidate"}],tools:[{name:"Socket"}],unavailable:[]}};
 assert.equal(mock.projectReadiness(project).ready,false);
 for(const item of mock.projectReadiness(project).items)await mock.setProjectReadiness(project,item.id,true);
 assert.equal(mock.projectReadiness(project).ready,true);
 project.repairPlan.unavailable=[{page:14661}];
 assert.equal(mock.projectReadiness(project).ready,false);
 assert.equal(mock.projectReadiness(project).items.find(i=>i.id==="sources").blocked,true);
});
test("dashboard maintenance indicator reflects overdue and unknown history without expanded cards",()=>{
 const source=garage.slice(garage.indexOf("get predictiveStatus() {"),garage.indexOf("get nextMaintenanceCountdown() {"));
 const get=Object.getOwnPropertyDescriptor(new Function("return ({"+source+"})")(),"predictiveStatus").get;
 assert.equal(get.call({predictiveItems:[]}).label,"No schedules");
 assert.equal(get.call({predictiveItems:[{status:"Green",hasHistory:true}]}).tone,"bg-emerald-400");
 assert.equal(get.call({predictiveItems:[{status:"Red",hasHistory:true},{status:"Green",hasHistory:false}]}).label,"1 overdue · 1 history unconfirmed");
 assert.doesNotMatch(garage,/predictiveItems\.slice\(0, 4\)/);
});

test("stock and tool suggestions respect compatibility, reservations and explicit confirmation",async()=>{
 const code=garage.slice(garage.indexOf("inventoryMatchKey(value) {"),garage.indexOf("guidedRepairProgress(entry) {"));
 const mock={...new Function("return ({"+code+"})")(),inventory:[{id:1,description:"Rear Oxygen Sensor",quantity:2,reservedQuantity:1,vehicleCompatibility:"Subaru"},{id:2,description:"Front Oxygen (A/F) Sensor",quantity:2,vehicleCompatibility:"Scion"}],vehicles:[{id:"sub",name:"Subaru"}],toolInventory:[{id:"t",name:"Torque wrench",notes:"5–50 N·m"}],saveToStorage:async()=>true};
 const project={id:"p",vehicleId:"sub",repairPlan:{parts:[{name:"Rear Oxygen Sensor",quantity:1,relationship:"candidate"},{name:"Front Oxygen (A/F) Sensor",quantity:1,relationship:"candidate"}],tools:[{name:"Torque wrench (appropriate range)"}],unavailable:[]}};
 assert.equal(mock.projectReadiness(project).matched,2);
 assert.equal(mock.projectReadiness(project).unmatched,1);
 assert.equal(mock.projectReadiness(project).ready,false);
 assert.equal(mock.projectReadiness(project).items.find(i=>i.id==="part-1").inventoryMatch,false);
 mock.inventory[0].reservedQuantity=2;
 assert.equal(mock.projectReadiness(project).matched,1);
 await mock.addOwnedTool("OBD-II scanner");
 assert.equal(mock.toolInventory.length,2);
 assert.equal(await mock.addOwnedTool("OBD-II scanner"),false);
 mock.saveToStorage=async()=>false;
 await mock.removeOwnedTool("t");
 assert.equal(mock.toolInventory.length,2);
});
