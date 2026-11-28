import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const m={exports:{}};new Function("module",readFileSync(new URL("../public/garage-consumables.js",import.meta.url),"utf8"))(m);const C=m.exports;
const vehicles=[{id:"s",name:"Scion"},{id:"u",name:"Subaru"}],now="2026-11-27T23:00:00Z";
const draft={scope:"vehicle",vehicleId:"s",name:"Washer fluid",level:"empty",inventoryId:"fluid",unit:"gal",targetQuantity:null};
const report=()=>C.report([],draft,vehicles,"r",now);
const stock=(quantity,reservedQuantity=0)=>[{id:"fluid",unit:"gal",vehicleCompatibility:"Universal",quantity,reservedQuantity}];
const order=(status="Ordered",receivedQuantity=0)=>[{id:"o",status,expectedDate:"2026-11-26",lines:[{id:"l",inventoryId:"fluid",unit:"gal",vehicleCompatibility:"Universal",quantity:2,receivedQuantity}]}];
const projection=(reports,inventory=[],orders=[])=>C.project({reports,inventory,orders,vehicles,today:"2026-11-27"});
test("report deduplicates an open shortage by scope, vehicle and normalized name; keeps unknown quantities unknown",()=>{
 const before=report(),next=C.report(before,{...draft,name:" washer  fluid ",level:"low"},vehicles,"new",now);
 assert.equal(next.length,1);assert.equal(next[0].id,"r");assert.equal(next[0].targetQuantity,null);assert.equal(before[0].level,"empty");
 const other=C.report(next,{...draft,vehicleId:"u"},vehicles,"new",now);assert.equal(other.length,2);
 assert.throws(()=>C.report([], {...draft,vehicleId:"missing"},vehicles,"r",now));
 assert.throws(()=>C.report([], {...draft,targetQuantity:0},vehicles,"r",now));
});
test("empty vehicle stays actionable across missing stock, order, partial receipt and refill confirmation",()=>{
 const rows=report(),original=JSON.stringify(rows);
 assert.equal(projection(rows)[0].state,"verify-stock");
 assert.equal(projection(rows,stock(0))[0].state,"replenish");
 assert.equal(projection(rows,stock(0),order())[0].state,"waiting");assert.equal(projection(rows,stock(0),order())[0].overdue,true);
 assert.equal(projection(rows,stock(1),order("Partially received",1))[0].state,"refill");
 assert.equal(projection(rows,stock(2),order("Received",2))[0].state,"refill");
 assert.throws(()=>C.resolve(rows,"r",{kind:"ordered",confirmed:true},{},now));
 assert.throws(()=>C.resolve(rows,"r",{kind:"refilled",confirmed:true,quantity:1},{},now));
 const closed=C.resolve(rows,"r",{kind:"refilled",confirmed:true},{},now);
 assert.equal(projection(closed).length,0);assert.equal(JSON.stringify(rows),original);
});
test("garage supply requires confirmation and honors verified stock targets, reservations and units",()=>{
 const rows=C.report([],{scope:"garage",name:"Shop rags",level:"low",inventoryId:"rags",unit:"pack",targetQuantity:2},vehicles,"r",now);
 const inventory=[{id:"rags",unit:"pack",vehicleCompatibility:"Universal",quantity:3,reservedQuantity:2}];
 assert.equal(projection(rows,inventory)[0].state,"replenish");
 assert.throws(()=>C.resolve(rows,"r",{kind:"sufficient-stock",confirmed:true},{inventory,vehicles},now));
 inventory[0].reservedQuantity=1;assert.equal(projection(rows,inventory)[0].state,"confirm-stock");
 assert.throws(()=>C.resolve(rows,"r",{kind:"sufficient-stock",confirmed:false},{inventory,vehicles},now));
 assert.equal(projection(C.resolve(rows,"r",{kind:"sufficient-stock",confirmed:true},{inventory,vehicles},now)).length,0);
 inventory[0].unit="each";assert.equal(projection(rows,inventory)[0].available,null);
});
test("unlinked, cancelled, incompatible and fully received order lines do not suppress action",()=>{
 const rows=report();
 for(const orders of [order("Cancelled"),order("Ordered",2),[{...order()[0],lines:[{...order()[0].lines[0],inventoryId:"other"}]}],[{...order()[0],lines:[{...order()[0].lines[0],unit:"each"}]}]])assert.equal(projection(rows,stock(0),orders)[0].state,"replenish");
 assert.equal(projection(rows,stock(2,2))[0].state,"replenish");
 assert.equal(projection(rows,stock(1))[0].rank,83);
});

test("vehicle extensions preserve unrelated fields, shared scope and records through legacy serialization",()=>{
 const original=JSON.parse(JSON.stringify(vehicles)); original[0].odometer=224634;
 const rows=C.report(report(),{scope:"garage",name:"Shop rags",level:"low"},vehicles,"shared",now);
 const next=C.writeVehicles(original,rows);
 assert.deepEqual(original[0],{id:"s",name:"Scion",odometer:224634});
 assert.equal(next[0].odometer,224634);
 const legacy=JSON.parse(JSON.stringify(next)).map(v=>({...v,id:v.id}));
 assert.deepEqual(C.readVehicles(legacy),rows);
 assert.equal(C.readVehicles(legacy).find(r=>r.id==="shared").vehicleId,null);
 assert.deepEqual(C.writeVehicles(next,[]),original);
 const malformed=JSON.parse(JSON.stringify(next));malformed[1].motorNoteConsumablesV1=[rows[0]];
 assert.throws(()=>C.readVehicles(malformed));
 assert.throws(()=>C.writeVehicles([original[1]],rows));
});
