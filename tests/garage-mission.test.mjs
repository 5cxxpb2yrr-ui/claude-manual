import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const m={exports:{}};new Function("module",readFileSync(new URL("../public/garage-mission.js",import.meta.url),"utf8"))(m);const M=m.exports;
const fixture=()=>({today:"2026-11-26",projects:[{id:"p",title:"Pump",vehicleName:"Scion",status:"In Progress",findings:1,readiness:{ready:false,label:"2/4 confirmed",next:"Parts"}},{id:"closed",title:"Closed",status:"Completed",findings:5}],predictions:[{id:"oil",vehicleId:"u",vehicleName:"Subaru",serviceName:"Oil change",status:"Red",hasHistory:true},{id:"oil",vehicleId:"s",vehicleName:"Scion",serviceName:"Oil change",status:"Red",hasHistory:false}],orders:[{key:"a",vendor:"Shop",expectedDate:"2026-11-25",status:"Ordered"}],forecast:{shortages:[{}],reviews:[]},storage:{reorder:[{suggested:0},{suggested:2}]},tools:[{id:"t",name:"Wrench",calibrationDue:"2026-11-26"}],history:[{vehicleId:"s",vehicleName:"Scion",repeatCount:2}]});
test("prioritizes open findings and confirmed maintenance, distinguishes unknown history and closed projects",()=>{
 const f=fixture(),before=JSON.stringify(f),r=M.build(f),all=r.groups.flatMap(g=>g.rows);
 assert.equal(r.next.id,"finding:p");assert.ok(all.some(x=>x.id==="maintenance:u:oil"));assert.ok(all.some(x=>x.id==="unknown:s:oil"));assert.ok(!all.some(x=>x.id.includes("closed")));assert.equal(JSON.stringify(f),before);
});
test("overdue deliveries, calibration and stock recommendations retain correct routes",()=>{
 const r=M.build(fixture()),all=r.groups.flatMap(g=>g.rows);
 assert.equal(all.find(x=>x.id==="order:a").target.view,"orders");assert.match(all.find(x=>x.id==="order:a").detail,/overdue/);assert.equal(all.find(x=>x.id==="cal:t").target.view,"tools");assert.match(all.find(x=>x.id==="reorder").detail,/1 stock records/);
});
test("source failures and unsaved changes outrank routine actions",()=>{
 const r=M.build({...fixture(),errors:[{section:"inventory demand"}],saveError:true});assert.equal(r.next.id,"save-error");assert.equal(r.incomplete,true);
});
test("informational custody and historical repeats are never the next action",()=>{
 const r=M.build({today:"2026-11-26",tools:[{id:"t",name:"Puller",custody:{status:"loaned"}}],history:[{vehicleId:"s",repeatCount:1}]});assert.equal(r.next,null);assert.equal(r.actionCount,0);
});
