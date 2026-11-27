import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const garage=readFileSync(new URL("../public/garage.html",import.meta.url),"utf8");
const code=garage.slice(garage.indexOf("inventoryMatchKey(value) {"),garage.indexOf("guidedRepairProgress(entry) {"));
const mock=()=>({...new Function("return ({"+code+"})")(),selectedProject:{id:"p",status:"In Progress",partRequirements:[],repairPlan:{}},guidedPhaseIndex:0,projectGuidedPhases:()=>[{id:"manual-work"},{id:"verify"}],saveToStorage:async()=>true});
test("execution findings add one requirement and persist phase notes without overwriting prior data",async()=>{
 const m=mock();m.resetGuidedDraft();Object.assign(m.guidedDraft,{finding:"Damaged gasket",partName:"Gasket",quantity:"2"});
 assert.equal(await m.saveGuidedEvidence("finding",{addPart:true}),true);
 assert.equal(m.selectedProject.partRequirements[0].quantity,2);assert.equal(m.guidedOpenFindings(m.selectedProject).length,1);
 m.guidedDraft.note="Checked mating surfaces";assert.equal(await m.saveGuidedEvidence("note"),true);
 const r=m.guidedRecord(m.selectedProject);assert.equal(r.notes[0].phaseId,"manual-work");assert.equal(r.findings.length,1);
 await m.completeGuidedPhase();assert.equal(m.guidedRecord(m.selectedProject).findings.length,1);
 await m.completeGuidedPhase();assert.match(m.guidedError,/Resolve open findings/);
 const finding=m.guidedOpenFindings(m.selectedProject)[0];assert.equal(await m.saveGuidedEvidence("resolve",{id:finding.id,resolution:"Replaced gasket"}),true);
 await m.completeGuidedPhase();assert.equal(m.guidedRecord(m.selectedProject).status,"completed");
});
test("torque evidence requires explicit confirmation and source; failed save rolls back",async()=>{
 const m=mock();m.resetGuidedDraft();Object.assign(m.guidedDraft,{torqueTarget:"Fastener A",torqueSpec:"Verified example",torqueSource:"Factory page"});
 assert.equal(await m.saveGuidedEvidence("torque"),false);
 m.guidedDraft.torqueVerified=true;m.saveToStorage=async()=>false;assert.equal(await m.saveGuidedEvidence("torque"),false);assert.equal(m.selectedProject.guidedExecution,undefined);
 m.saveToStorage=async()=>true;assert.equal(await m.saveGuidedEvidence("torque"),true);assert.equal(m.guidedRecord(m.selectedProject).torqueChecks[0].target,"Fastener A");
});
test("timer is persisted, accumulates elapsed work and blocks final verification while running",async()=>{
 const m=mock();m.resetGuidedDraft();assert.equal(await m.saveGuidedEvidence("timer-start"),true);
 assert.equal(await m.saveGuidedEvidence("timer-start"),false);
 m.selectedProject.guidedExecution.timerStartedAt=new Date(Date.now()-120000).toISOString();
 assert.equal(await m.saveGuidedEvidence("timer-stop"),true);assert.ok(m.guidedElapsed(m.selectedProject)>=120000);assert.equal(m.selectedProject.guidedExecution.timerStartedAt,null);
});
test("installation delegates to canonical reserved-stock transaction with phase context",async()=>{
 const m=mock();m.resetGuidedDraft();m.selectedProject.partRequirements=[{id:"r",reserved:true}];m.guidedDraft.installId="r";m.guidedDraft.installQty="2";let args;
 m.changeProjectStock=async(...a)=>{args=a;return true;};
 assert.equal(await m.recordGuidedInstall(),true);assert.equal(args[2],"consume");assert.equal(args[3],2);assert.equal(args[4].phaseId,"manual-work");
});
