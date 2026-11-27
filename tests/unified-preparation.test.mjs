import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const garage=readFileSync(new URL("../public/garage.html",import.meta.url),"utf8");
const code=garage.slice(garage.indexOf("inventoryMatchKey(value) {"),garage.indexOf("guidedRepairProgress(entry) {"));
const mock=()=>({...new Function("return ({"+code+"})")(),vehicles:[{id:"v",name:"Scion"}],inventory:[{id:"s",description:"Filter",partNumber:"F1",quantity:2,reservedQuantity:1,unit:"each",vehicleCompatibility:"Scion",storageLocation:"A/03"}],toolInventory:[],vendorOrders:[],saveToStorage:async()=>true});
const project=()=>({id:"p",vehicleId:"v",repairPlan:{parts:[{name:"Filter",quantity:1,relationship:"required"}],tools:[],unavailable:[]},partRequirements:[{id:"p-plan-part-0",description:"Filter",partNumber:"F1",unit:"each",quantity:1,inventoryId:"s",reserved:true},{id:"manual",description:"Filter",partNumber:"F1",unit:"each",quantity:2}]});
test("generated and manual requirements share stock pool with reserved stock allocated first",()=>{
 const m=mock(),p=project(),before=JSON.stringify({inventory:m.inventory,p}),r=m.projectReadiness(p),one=r.items.find(x=>x.id==="part-0"),two=r.items.find(x=>x.id==="requirement-manual");
 assert.equal(one.allocated,1);assert.equal(one.inventoryMatch,true);assert.equal(two.allocated,1);assert.equal(two.inventoryMatch,false);assert.match(one.detail,/A\/03/);assert.equal(JSON.stringify({inventory:m.inventory,p}),before);
});
test("linked orders show outstanding quantities and delivery without becoming on hand",()=>{
 const m=mock(),p=project();m.vendorOrders=[{vendor:"Shop",status:"Partially received",expectedDate:"2026-12-02",lines:[{demandKey:"project:p:manual",quantity:3,receivedQuantity:1},{demandKey:"project:other:manual",quantity:9,receivedQuantity:0}]}];
 const r=m.projectReadiness(p),row=r.items.find(x=>x.id==="requirement-manual");
 assert.equal(row.incoming,2);assert.equal(row.allocated,1);assert.equal(row.inventoryMatch,false);assert.equal(r.awaiting,1);assert.match(row.detail,/2026-12-02/);
});
test("unknown quantity and incompatible stock are not counted as covered",()=>{
 const m=mock(),p=project();p.partRequirements[1].quantity=null;m.inventory[0].vehicleCompatibility="Not verified";
 const r=m.projectReadiness(p);assert.equal(r.items.find(x=>x.id==="part-0").allocated,0);assert.equal(r.items.find(x=>x.id==="requirement-manual").remaining,null);assert.equal(r.matched,0);
});
test("readiness still requires explicit confirmation and source review",async()=>{
 const m=mock(),p=project();assert.equal(m.projectReadiness(p).ready,false);
 for(const item of m.projectReadiness(p).items)await m.setProjectReadiness(p,item.id,true);
 assert.equal(m.projectReadiness(p).ready,true);
 p.repairPlan.unavailable=[{page:1}];assert.equal(m.projectReadiness(p).ready,false);
});
