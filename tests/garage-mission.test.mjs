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

test("empty consumables outrank routine actions but not existing findings or integrity errors",()=>{
 const c={id:"r",name:"Washer fluid",location:"Scion",level:"empty",state:"replenish",available:0,unit:"gal",rank:83,group:"Execute"};
 const r=M.build({consumables:[c],projects:[{id:"p",title:"Routine",status:"Planned"}]});
 assert.equal(r.next.id,"consumable:r");assert.equal(r.consumables.length,1);assert.equal(r.next.target.consumableId,"r");
 assert.equal(M.build({...fixture(),consumables:[c]}).next.id,"finding:p");
 assert.equal(M.build({consumables:[c],saveError:true}).next.id,"save-error");
 const w=M.build({consumables:[{...c,state:"waiting",rank:81,group:"Waiting",overdue:true}]});
 assert.match(w.next.detail,/Delivery overdue/);assert.equal(w.groups.find(g=>g.name==="Waiting").rows.length,1);
});

test("only fully represented vendor orders are deduplicated from mission waiting rows",()=>{
 const c={id:"r",name:"Washer fluid",location:"Scion",level:"empty",state:"waiting",rank:81,group:"Waiting",overdue:true,incoming:[{orderId:"o",lineId:"l",explicit:true}]};
 const o={id:"o",key:"vendor:o",vendor:"Fixture",expectedDate:"2026-11-25",lines:[{id:"l",quantity:2,receivedQuantity:0,consumableReportId:"r"}]};
 const rows=(order,consumable=c)=>M.build({today:"2026-11-27",consumables:[consumable],orders:[order]}).groups.find(g=>g.name==="Waiting").rows;
 assert.deepEqual(rows(o).map(x=>x.id),["consumable:r"]);
 assert.ok(rows({...o,lines:[...o.lines,{id:"other",quantity:1}]}).some(x=>x.id==="order:vendor:o"));
 assert.ok(rows(o,{...c,state:"refill",group:"Execute"}).some(x=>x.id==="order:vendor:o"));
});
