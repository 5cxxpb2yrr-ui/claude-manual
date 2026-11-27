import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const m={exports:{}};new Function("module",readFileSync(new URL("../public/repair-history.js",import.meta.url),"utf8"))(m);const H=m.exports;
const vehicle={id:"s",name:"Scion"},other={id:"u",name:"Subaru"},vehicles=[vehicle,other];
const logs=[{id:"1",vehicleId:"s",vehicle:"Scion",serviceType:"Filter replacement",date:"2026-11-01",cost:25,materialConsumedValue:8,installedParts:[{description:"Filter",partNumber:"F-01",quantity:1,unit:"each"}],guidedExecution:{elapsedMs:3600000,findings:[{text:"Damaged seal",resolution:"Replaced",status:"resolved"}],torqueChecks:[{target:"Bolt",specification:"Historical",source:"Factory page 2"}]}},{id:"2",vehicleId:"s",serviceType:"Filter replacement",date:"2026-10-01",cost:10},{id:"3",vehicleId:"u",serviceType:"Filter replacement",cost:99},{id:"4",vehicleId:"s",vehicle:"Subaru",cost:88},{id:"5",vehicle:"Scion",serviceType:"Inspection",date:"2026-09-01"}];
test("scope excludes other and contradictory vehicles; totals do not double count material",()=>{
 const r=H.history({logs,vehicle,vehicles});assert.equal(r.summary.recordCount,3);assert.equal(r.summary.costTotal,35);assert.equal(r.summary.costCount,2);assert.equal(r.summary.durationMs,3600000);assert.equal(r.summary.durationCount,1);assert.equal(r.repeat[0].records.length,2);assert.equal(r.parts[0].quantity,1);
});
test("personal evidence searchable by normalized manufacturer number, finding and torque reference",()=>{
 for(const q of ["F01","damaged seal","factory page 2"])assert.equal(H.history({logs,vehicle,vehicles,query:q}).filtered[0].id,"1");
 assert.equal(H.history({logs,vehicle,vehicles,query:"unrecorded"}).filtered.length,0);
});
test("missing costs and durations remain unknown; duplicate IDs excluded; predictions require history",()=>{
 const r=H.history({logs:[...logs,{...logs[0]}],vehicle,vehicles,predictions:[{id:"a",hasHistory:true,status:"Red"},{id:"b",hasHistory:false,status:"Red"}]});assert.equal(r.summary.duplicateIds,1);assert.equal(r.summary.costTotal,10);assert.equal(r.summary.durationCount,0);assert.equal(r.schedule.length,1);assert.equal(r.records.find(x=>x.id==="5").cost,null);
});
test("history ignores purchased but uninstalled parts and never mutates records",()=>{
 const x=[{id:"a",vehicleId:"s",purchaseOrders:[{lines:[{partNumber:"P1",quantity:2}]}]}],before=JSON.stringify(x);
 assert.equal(H.history({logs:x,vehicle,vehicles}).parts.length,0);assert.equal(JSON.stringify(x),before);
});
