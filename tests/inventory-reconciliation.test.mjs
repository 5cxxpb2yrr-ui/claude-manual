import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const m={exports:{}};new Function("module",readFileSync(new URL("../public/inventory-engine.js",import.meta.url),"utf8"))(m);const E=m.exports;
const a={id:"a",description:"Filter",partNumber:"F-1",unit:"each",vehicleCompatibility:"Scion",quantity:2,reservedQuantity:0,unitCost:8};
const b={...a,id:"b",quantity:3,unitCost:10};
test("count records variance and no-change counts without losing ledger chain",()=>{
 const inventory=[a],initial=E.reconcile([],inventory),r=E.physicalCount(inventory,{id:"a",expected:2,count:1.5,reason:"Shelf count"});
 const ledger=E.reconcile(initial,r.inventory,{reference:r.reference,reason:"Physical count: Shelf count"});
 assert.equal(ledger.at(-1).type,"physical-count");assert.equal(ledger.at(-1).delta.onHand,-.5);assert.equal(a.quantity,2);
 const n=E.physicalCount(r.inventory,{id:"a",expected:1.5,count:1.5,reason:"Recount"});
 const next=E.reconcile(ledger,n.inventory,{reference:n.reference});assert.equal(next.length,ledger.length+1);assert.deepEqual(E.audit(next,n.inventory),[]);
});
test("count rejects stale stock, missing reason and protected legacy reservations",()=>{
 const context={maintenancePlans:[{id:"m",status:"Planned",parts:[{inventoryId:"a",reserved:true,quantity:1}]}]};
 for(const request of [{expected:3,count:1,reason:"Count"},{expected:2,count:"",reason:"Count"},{expected:2,count:0,reason:"Count"},{expected:2,count:2,reason:""}])assert.throws(()=>E.physicalCount([a],{id:"a",...request},context));
});
test("duplicate merge preserves quantity and weighted cost with two ledger events",()=>{
 const initial=E.reconcile([],[a,b]),r=E.mergeStock([a,b],{targetId:"a",sourceId:"b",expectedTarget:2,expectedSource:3,reason:"Same verified part"});
 assert.equal(r.inventory.length,1);assert.equal(r.inventory[0].quantity,5);assert.equal(r.inventory[0].unitCost*5,46);
 const ledger=E.reconcile(initial,r.inventory,{reference:r.reference});assert.equal(ledger.at(-2).type,"merge-in");assert.equal(ledger.at(-1).type,"merge-out");assert.deepEqual(ledger.at(-1).reference.sourceBefore,b);assert.deepEqual(E.audit(ledger,r.inventory),[]);
});
test("merge blocks referenced, reserved or mismatched records",()=>{
 const req={targetId:"a",sourceId:"b",expectedTarget:2,expectedSource:3,reason:"Review"};
 assert.throws(()=>E.mergeStock([a,b],req,{vendorOrders:[{lines:[{inventoryId:"b"}]}]}),/Referenced/);
 assert.throws(()=>E.mergeStock([a,{...b,reservedQuantity:1}],req),/Referenced/);
 assert.throws(()=>E.mergeStock([a,{...b,vehicleCompatibility:"Subaru"}],req),/matching/);
 assert.throws(()=>E.mergeStock([{...a,barcode:"001"},{...b,barcode:"002"}],req),/Different barcodes/);
 assert.equal(E.inspectInventory([a,b],E.reconcile([],[a,b])).duplicates.length,1);
});
