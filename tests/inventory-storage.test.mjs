import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const m={exports:{}};new Function("module",readFileSync(new URL("../public/inventory-engine.js",import.meta.url),"utf8"))(m);const E=m.exports;
const a={id:"a",description:"Filter",partNumber:"F-1",unit:"each",vehicleCompatibility:"Scion",quantity:4,reservedQuantity:2,unitCost:8};
const req={id:"a",expectedQuantity:4,expectedLocation:"",location:"garage/a/03",minimum:2,target:6,reason:"Put away"};
test("whole record transfer preserves quantity reservations and value, journals zero balance movement",()=>{
 const initial=E.reconcile([],[a]),r=E.updateStorage([a],req);
 assert.equal(r.inventory[0].storageLocation,"GARAGE/A/03");assert.equal(r.inventory[0].quantity,4);assert.equal(r.inventory[0].reservedQuantity,2);assert.equal(r.inventory[0].unitCost,8);assert.equal(a.storageLocation,undefined);
 const ledger=E.reconcile(initial,r.inventory,{reference:r.reference});assert.equal(ledger.at(-1).type,"storage-transfer");assert.deepEqual(ledger.at(-1).delta,{onHand:0,reserved:0});assert.deepEqual(E.audit(ledger,r.inventory),[]);
});
test("reorder recommendation subtracts verified linked incoming and uses available balance",()=>{
 const r=E.updateStorage([a],req),s=E.storageSummary(r.inventory,{vendorOrders:[{status:"Ordered",lines:[{inventoryId:"a",partNumber:"F-1",unit:"each",vehicleCompatibility:"Scion",quantity:2,receivedQuantity:0},{inventoryId:"b",quantity:9}]}]});
 assert.equal(s.groups[0].code,"GARAGE/A/03");assert.equal(s.reorder[0].available,2);assert.equal(s.reorder[0].incoming,2);assert.equal(s.reorder[0].suggested,2);
});
test("storage change rejects stale input, invalid location, thresholds and missing reason",()=>{
 for(const patch of [{expectedQuantity:3},{location:"<bad>"},{minimum:5,target:4},{minimum:"",target:3},{reason:""}])assert.throws(()=>E.updateStorage([a],{...req,...patch}));
});
test("duplicate records cannot merge across storage locations",()=>{
 const x={...a,reservedQuantity:0,storageLocation:"A"},y={...x,id:"b",storageLocation:"B"};
 assert.throws(()=>E.mergeStock([x,y],{targetId:"a",sourceId:"b",expectedTarget:4,expectedSource:4,reason:"Merge"}),/same storage location/);
});
