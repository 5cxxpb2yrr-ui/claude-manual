import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const load=name=>{const m={exports:{}};new Function("module",readFileSync(new URL("../public/"+name+".js",import.meta.url),"utf8"))(m);return m.exports;};
const capture=load("inventory-capture"),purchase=load("inventory-purchasing");
const stock={id:"p1",description:"Oil filter",partNumber:"F-01",barcode:"00123",quantity:3,reservedQuantity:2,unit:"each",vehicleCompatibility:"Scion"};
const line={description:"Oil filter",partNumber:"F01",barcode:"00123",quantity:1,unit:"each",unitCost:8,vehicleCompatibility:"Scion"};
const need={key:"project:p:r",name:"Oil filter",partNumber:"F-01",shortage:1,unit:"each",vehicleId:"v",source:"Oil change"};
const context={inventory:[stock],demand:[need],vehicles:[{id:"v",name:"Scion"}]};
test("exact identities rank first without mutating receipt, stock or demand",()=>{
 const before=JSON.stringify({line,context}),r=capture.suggestMatches(line,context);
 assert.equal(r.stock[0].evidence,"Exact barcode");assert.equal(r.stock[0].available,1);assert.equal(r.stock[0].eligible,true);assert.equal(r.requirements[0].eligible,true);assert.equal(JSON.stringify({line,context}),before);
});
test("unknown fitment, description-only, unit conflicts and excessive quantity require review",()=>{
 assert.equal(capture.suggestMatches({...line,vehicleCompatibility:"Not verified"},context).stock[0].eligible,false);
 assert.equal(capture.suggestMatches({...line,barcode:"",partNumber:""},context).stock[0].eligible,false);
 assert.equal(capture.suggestMatches({...line,barcode:"999",unit:"box"},context).stock[0].eligible,false);
 assert.equal(capture.suggestMatches({...line,quantity:2},context).requirements[0].eligible,false);
});
test("retailer codes use received history scoped to the same vendor",()=>{
 const l={...line,barcode:"",partNumber:"",description:"Retail receipt label",retailerItemCode:"001"};
 const orders=[{vendor:"AutoZone",status:"Received",lines:[{retailerItemCode:"001",inventoryId:"p1",receivedQuantity:1}]}];
 assert.equal(capture.suggestMatches(l,{...context,vendor:"AutoZone",orders}).stock[0].evidence,"Prior received retailer item");
 assert.equal(capture.suggestMatches(l,{...context,vendor:"NAPA Auto Parts",orders}).stock.length,0);
 assert.equal(capture.suggestMatches(l,{...context,vendor:"AutoZone",orders:[{...orders[0],status:"Ordered"}]}).stock.length,0);
});
test("ambiguous exact stock matches block automatic receiving instead of creating duplicate stock",()=>{
 const inventory=[stock,{...stock,id:"p2",barcode:""}],l={...line,barcode:""};
 assert.equal(capture.suggestMatches(l,{inventory}).duplicateWarning,true);
 const order={...purchase.validateDraft({vendor:"Shop",orderNumber:"1",lines:[l]}),id:"o"};
 assert.throws(()=>purchase.receive(order,inventory,{"line-1":1}),/Multiple exact stock matches/);
 const selected={...order,lines:[{...order.lines[0],inventoryId:"p1"}]};
 assert.equal(purchase.receive(selected,inventory,{"line-1":1}).inventory[0].quantity,4);
});
