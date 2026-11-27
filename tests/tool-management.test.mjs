import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const garage=readFileSync(new URL("../public/garage.html",import.meta.url),"utf8");
const code=garage.slice(garage.indexOf("inventoryMatchKey(value) {"),garage.indexOf("guidedRepairProgress(entry) {"));
const mock=()=>({...new Function("return ({"+code+"})")(),projects:[{id:"p",title:"Repair",status:"Planned"}],toolInventory:[{id:"t",name:"Torque wrench"}],saveToStorage:async()=>true,toolToday:()=>"2026-11-26"});
const draft=(m,action,extra={})=>{m.openToolAction(m.toolInventory[0]);return {...m.toolActionDraft,action,reason:"Test",...extra};};
test("checkout and return preserve tool identity and distinguish project availability",async()=>{
 const m=mock();m.toolActionDraft=draft(m,"checkout",{projectId:"p"});assert.equal(await m.commitToolAction(),true);
 assert.equal(m.toolAvailability(m.toolInventory[0],"p").available,true);assert.equal(m.toolAvailability(m.toolInventory[0],"other").available,false);
 m.toolActionDraft=draft(m,"return");assert.equal(await m.commitToolAction(),true);assert.equal(m.toolInventory[0].activity.length,2);assert.equal(m.toolInventory[0].id,"t");
});
test("borrowed and loaned tools cannot be double checked out",()=>{
 const m=mock(),tool=m.toolInventory[0];const loan=m.applyToolAction(tool,draft(m,"loan",{holder:"Borrower",due:"2026-11-30"}));
 assert.equal(m.toolAvailability(loan).available,false);assert.throws(()=>m.applyToolAction({...tool,ownership:"borrowed"},draft(m,"loan",{holder:"Other"})),/owned/);
 assert.throws(()=>m.applyToolAction(loan,{...draft(m,"checkout",{projectId:"p"}),expectedHistory:1}),/not available/);
});
test("calibration dates and references are required and overdue tools are flagged",()=>{
 const m=mock(),tool=m.toolInventory[0];
 assert.throws(()=>m.applyToolAction(tool,draft(m,"calibrate",{calibratedOn:"2026-02-30",calibrationDue:"2027-02-28",certificate:"C"})),/valid date/);
 const next=m.applyToolAction(tool,draft(m,"calibrate",{calibratedOn:"2026-10-01",calibrationDue:"2026-11-25",certificate:"C"}));
 assert.equal(m.toolAvailability(next).available,false);assert.equal(next.activity[0].after.calibrationCertificate,"C");
});
test("special service tool match, readiness warning and failed save rollback",async()=>{
 const m=mock();m.toolInventory=[{id:"t",name:"Puller",specialToolNumber:"09228-06501",custody:{status:"loaned",holder:"A"}}];
 assert.equal(m.planToolMatches("SST 09228-06501").length,1);
 const r=m.projectReadiness({id:"p",repairPlan:{tools:[{name:"SST 09228-06501"}]}});
 assert.equal(r.items.find(x=>x.id==="tool-0").inventoryMatch,false);
 m.toolActionDraft=draft(m,"return");m.saveToStorage=async()=>false;assert.equal(await m.commitToolAction(),false);assert.equal(m.toolInventory[0].custody.status,"loaned");
});
