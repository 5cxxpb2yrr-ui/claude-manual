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


test("editing inventory preserves identity and reservations and rolls back failed saves",async()=>{
 const code=garage.slice(garage.indexOf("inventoryCompatibilityOptions() {"),garage.indexOf("async handleFileUpload(event)"));
 const mock={...new Function("return ({"+code+"})")(),inventory:[{id:1,description:"Filter",quantity:4,reservedQuantity:2,unitCost:6,partNumber:"A",vehicleCompatibility:"Scion",custom:"keep"}],projects:[],vehicles:[{name:"Scion"}],modals:{},saveToStorage:async()=>true};
 mock.openEditPartModal(mock.inventory[0]);
 mock.newPartForm.quantity=1;
 assert.equal(await mock.saveNewPart(),false);
 mock.newPartForm.quantity=3;mock.newPartForm.unitCost=7;
 assert.equal(await mock.saveNewPart(),true);
 assert.equal(mock.inventory[0].id,1);
 assert.equal(mock.inventory[0].reservedQuantity,2);
 assert.equal(mock.inventory[0].custom,"keep");
 mock.openEditPartModal(mock.inventory[0]);mock.newPartForm.partNumber="B";
 assert.equal(await mock.saveNewPart(),false);
 mock.newPartForm.partNumber="A";mock.newPartForm.quantity=5;mock.saveToStorage=async()=>false;
 assert.equal(await mock.saveNewPart(),false);
 assert.equal(mock.inventory[0].quantity,3);
});
test("owned tool editing keeps its ID and rejects duplicate names",async()=>{
 const code=garage.slice(garage.indexOf("inventoryMatchKey(value) {"),garage.indexOf("guidedRepairProgress(entry) {"));
 const mock={...new Function("return ({"+code+"})")(),toolInventory:[{id:"a",name:"Torque wrench",notes:""},{id:"b",name:"Ratchet",notes:""}],saveToStorage:async()=>true};
 mock.editOwnedTool(mock.toolInventory[0]);mock.toolDraftName="Ratchet";
 assert.equal(await mock.saveOwnedTool(),false);
 mock.toolDraftName="Torque wrench";mock.toolDraftNotes="5–50 N·m";
 assert.equal(await mock.saveOwnedTool(),true);
 assert.equal(mock.toolInventory[0].id,"a");
 assert.equal(mock.toolInventory[0].notes,"5–50 N·m");
 mock.editOwnedTool(mock.toolInventory[0]);mock.toolDraftNotes="changed";mock.saveToStorage=async()=>false;
 assert.equal(await mock.saveOwnedTool(),false);
 assert.equal(mock.toolInventory[0].notes,"5–50 N·m");
});

 test("Scion rear brakes resolve actual operation documents and numbered headings, not ABS diagnostic pages",async()=>{
 const engineModule={exports:{}};new Function("module",readFileSync(new URL("../public/repair-workspace.js",import.meta.url),"utf8"))(engineModule);
 const engine=engineModule.exports,component="Rear Brake Shoe, Wheel Cylinder & Brake Drum",makePage=(title,headings,extra="")=>'<div class="main"><h1>'+title+'</h1><ol class="ARABICNUM">'+headings.map(h=>'<li><span class="clsEmphBOLD">'+h+'</span><ol class="LOWERALPHA"><li>Review source instruction.</li></ol></li>').join("")+'</ol>'+extra+'</div>';
 const fixture={c:[{n:"Brakes",c:[{n:"DTC rear brake",c:[{p:99,n:"Inspection Procedure"}]},{n:component,c:["Components","Disassembly","Inspection","Reassembly"].map((name,i)=>({p:1269+i,n:component+": "+name}))}]}]};
 const html={1269:makePage(component+": Components",[]),1270:makePage(component+": Disassembly",["REMOVE REAR WHEEL","REMOVE REAR BRAKE SHOE"]),1271:makePage(component+": Inspection",["CHECK BRAKE SHOE LINING THICKNESS"]),1272:makePage(component+": Reassembly",["TEMPORARILY TIGHTEN BLEEDER PLUG","INSTALL REAR BRAKE SHOE"],'<a href="../pages/7711.html#Brake%20Fluid/">BLEEDING</a><a href="../pages/7732.html">ADJUSTMENT</a>'),7711:makePage("Brake Fluid: Bleeding",["BLEED AIR FROM BRAKE LINE"]),7732:makePage("Parking Brake System: Adjustment",["ADJUST PARKING BRAKE LEVER TRAVEL"])};
 const fetcher=async url=>url.startsWith("/api/navigation/")?{ok:true,json:async()=>fixture}:{ok:!!html[Number(url.match(/(\\d+)\\.html$/)?.[1])],text:async()=>html[Number(url.match(/(\\d+)\\.html$/)?.[1])]};
 const result=await planner.generate({vehicleId:"scion-xb",scope:"Replace rear brakes",fetcher,engine});
 assert.deepEqual(result.documents.map(d=>d.sourceLabel),[1269,1270,1271,1272,7711,7732].map(p=>"Factory manual #"+p));
 assert.equal(result.documents[3].steps.length,2);assert.equal(result.documents[3].steps[0].title,"TEMPORARILY TIGHTEN BLEEDER PLUG");
 assert.ok(result.tasks.some(t=>/Disassembly/.test(t.name)));assert.ok(result.tasks.some(t=>/Reassembly/.test(t.name)));assert.equal(result.unavailable.length,0);
 assert.ok(result.parts.some(p=>p.name==="Rear brake shoe set"&&p.relationship==="candidate"));assert.ok(!result.parts.some(p=>p.relationship==="required"));assert.match(result.limitations[0],/shoe-only/);
 assert.ok(planner.buildGuidedPhases(result).some(p=>p.id==="manual-work"));
 html[1272]=makePage(component+": Reassembly",["UNRECOGNIZED STEP"]);
 const incomplete=await planner.generate({vehicleId:"scion-xb",scope:"Replace rear brakes",fetcher,engine});assert.ok(incomplete.unavailable.some(x=>x.page===1272));
 });
