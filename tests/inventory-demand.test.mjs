import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const module={exports:{}};
new Function("module",readFileSync(new URL("../public/inventory-demand.js",import.meta.url),"utf8"))(module);
const engine=module.exports;
const v={id:"s",name:"Subaru",oilFilter:"A"},other={id:"t",name:"Scion",oilFilter:"B"};
const req=(id,quantity,extra={})=>({id,description:"Filter",partNumber:"A",quantity,...extra});
const project=(id,partRequirements,purchaseOrders=[])=>({id,vehicleId:"s",title:id,status:"Planned",partRequirements,purchaseOrders});
const inventory=[{id:1,description:"Filter",partNumber:"A",quantity:3,reservedQuantity:1,vehicleCompatibility:"Subaru"},{id:2,description:"Filter",partNumber:"A",quantity:99,vehicleCompatibility:"Scion"}];
test("allocates reserved and free stock once, respects fitment and counts partial incoming order",()=>{
 const f=engine.forecast({inventory,vehicles:[v,other],projects:[project("a",[req("r1",1,{reserved:true,inventoryId:1}),req("r2",2)]),project("b",[req("r3",3)],[{status:"Ordered",lines:[{requirementId:"r3",quantity:1}]}])]});
 assert.equal(f.rows.reduce((n,r)=>n+r.onHand+r.reserved,0),3);
 assert.equal(f.rows.find(r=>r.key==="project:b:r3").shortage,2);
 assert.equal(f.rows.find(r=>r.key==="project:b:r3").incoming,1);
 assert.equal(inventory[0].quantity,3);
});
test("forecast boundaries, unquantified materials, and inspection exclusion",()=>{
 const predictions=[{id:"subaru_oil",vehicleId:"s",remainingDays:20,serviceName:"Oil service"},{id:"subaru_cvt_inspection",vehicleId:"s",remainingDays:1},{id:"subaru_air_filter",vehicleId:"s",remainingDays:21,serviceName:"Air filter"}];
 const input={vehicles:[v],predictions};
 const f=engine.forecast(input);
 assert.equal(f.shortages.length,1);
 assert.equal(f.reviews.length,1);
 assert.equal(engine.forecast({...input,horizon:90}).shortages.length,2);
});
test("protects legacy maintenance reservations outside the horizon",()=>{
 const f=engine.forecast({inventory,vehicles:[v],maintenancePlans:[{id:"m",vehicleId:"s",status:"Planned",targetDate:"2027-02-01",parts:[req("r",1,{reserved:true,inventoryId:1})]}],projects:[project("c",[req("r",3)])],now:Date.parse("2026-11-26")});
 assert.equal(f.shortages[0].shortage,2);
});
test("received unstocked orders and linked plans do not create duplicate demand",()=>{
 const p=project("p",[req("r",2)],[{status:"Received",lines:[{requirementId:"r",quantity:2}]}]);
 p.maintenancePlanId="m";
 const f=engine.forecast({vehicles:[v],projects:[p],maintenancePlans:[{id:"m",projectId:"p",vehicleId:"s",status:"In Progress",scheduleId:"subaru_oil",parts:[req("same",2)]}],predictions:[{id:"subaru_oil",vehicleId:"s",remainingDays:0}]});
 assert.equal(f.rows.length,1);
 assert.equal(f.rows[0].received,2);
 assert.equal(f.shortages.length,0);
});


test("shopping list consolidates only same vehicle, part identity and unit, preserving sources",()=>{
 const row=(key,extra={})=>({key,name:"Filter",partNumber:"A-1",unit:"each",vehicleId:"s",quantity:3,shortage:2,onHand:1,days:0,source:key,kind:"project",projectId:key,...extra});
 const f={horizon:20,rows:[row("a"),row("b",{partNumber:"A1",shortage:1,quantity:3,incoming:1}),row("c",{vehicleId:"t"}),row("d",{unit:"set"}),row("e",{partNumber:""}),row("f",{partNumber:""}),row("g",{shortage:0})],reviews:[{name:"Oil",source:"Service",reason:"Confirm volume"}]};
 const list=engine.shoppingList(f,[v,other]);
 assert.equal(list.items.length,5);
 const merged=list.items.find(x=>x.sources.length===2);
 assert.equal(merged.quantity,3);
 assert.equal(merged.incoming,1);
 assert.deepEqual(merged.sources.map(s=>s.key),["a","b"]);
 assert.equal(list.items.filter(x=>!x.partNumber).length,2);
 assert.match(engine.shoppingText(list),/Confirm before buying/);
});

const rags={id:"rags",description:"Shop rags",partNumber:"RAGS",unit:"pack",vehicleCompatibility:"Universal",quantity:3,reservedQuantity:1};
const report={id:"r",name:"Shop rags",scope:"garage",vehicleId:null,inventoryId:"rags",unit:"pack",targetQuantity:6,status:"open"};
const ctx=(extra={})=>({inventory:[rags],reports:[report],consumables:[{id:"r",state:"waiting"}],storage:{groups:[{items:[{id:"rags",available:2}]}],reorder:[{id:"rags",target:5}]},orders:[{status:"Partially received",lines:[{inventoryId:"rags",partNumber:"RAGS",unit:"pack",vehicleCompatibility:"Universal",quantity:3,receivedQuantity:1,consumableReportId:"r"}]}],...extra});
test("unified shopping counts the highest shared stock target once and credits only outstanding compatible receipts",()=>{
 const f={rows:[],reviews:[],horizon:20},c=ctx(),before=JSON.stringify(c),list=engine.unifiedShoppingList(f,[v,other],c);
 assert.equal(list.items.length,1);const item=list.items[0];assert.equal(item.required,6);assert.equal(item.stock,2);assert.equal(item.incoming,2);assert.equal(item.quantity,2);assert.equal(item.stockId,"rags");
 assert.deepEqual(item.reportIds,["r"]);assert.equal(JSON.stringify(c),before);
 assert.match(engine.shoppingText(list),/2 pack — Shop rags/);
 const sufficient=ctx({orders:[{status:"Ordered",lines:[{inventoryId:"rags",partNumber:"RAGS",unit:"pack",vehicleCompatibility:"Universal",quantity:4,receivedQuantity:0}]}]});
 assert.equal(engine.unifiedShoppingList(f,[v,other],sufficient).items.length,0);
});
test("unified shopping leaves repair allocations intact and asks for review of overlapping stock targets",()=>{
 const f=engine.forecast({inventory:[rags],vehicles:[v],projects:[project("repair",[{id:"a",description:"Shop rags",partNumber:"RAGS",inventoryId:"rags",unit:"pack",quantity:4}])]});
 const list=engine.unifiedShoppingList(f,[v],ctx());
 assert.equal(list.items.length,1);assert.equal(list.items[0].quantity,2);assert.equal(list.items[0].sources[0].kind,"project");
 assert.match(list.reviews.find(r=>r.stockId==="rags").reason,/Overlaps/);
 const c=ctx({reports:[report,{id:"fluid",name:"Shop rags",scope:"vehicle",vehicleId:"s",inventoryId:"rags",unit:"pack",status:"open"}]});
 assert.equal(engine.unifiedShoppingList({rows:[],reviews:[]},[v],c).items.length,0);
});
test("qualitative shortages stay reviews, waiting and refill states do not become purchase lines",()=>{
 const reports=[{id:"a",name:"Washer fluid",scope:"vehicle",vehicleId:"s",status:"open"},{id:"b",name:"Towels",scope:"garage",status:"open"},{id:"c",name:"Cleaner",scope:"garage",status:"open"}];
 const f={rows:[],reviews:[]},c=ctx({reports,consumables:[{id:"a",state:"verify-stock"},{id:"b",state:"waiting"},{id:"c",state:"confirm-stock"}],storage:{groups:[],reorder:[]},inventory:[],orders:[]});
 const list=engine.unifiedShoppingList(f,[v],c);assert.equal(list.items.length,0);assert.deepEqual(list.reviews.map(r=>r.consumableId),["a"]);assert.match(engine.shoppingText(list),/Washer fluid/);
});
test("stock targets do not credit incoming orders allocated to repair work, incompatible products or other vehicle reports",()=>{
 const f={rows:[],reviews:[]},c=ctx({orders:[{status:"Ordered",lines:[
 {inventoryId:"rags",partNumber:"RAGS",unit:"pack",vehicleCompatibility:"Universal",quantity:4,demandKey:"project:p:r"},
 {inventoryId:"rags",partNumber:"RAGS",unit:"each",vehicleCompatibility:"Universal",quantity:4},
 {inventoryId:"rags",partNumber:"OTHER",unit:"pack",vehicleCompatibility:"Universal",quantity:4},
 {inventoryId:"rags",partNumber:"RAGS",unit:"pack",vehicleCompatibility:"Universal",quantity:4,consumableReportId:"vehicle-other"}
 ]}]});
 const item=engine.unifiedShoppingList(f,[v],c).items[0];assert.equal(item.incoming,0);assert.equal(item.quantity,4);
});

test("usage forecast adds a review only, never a speculative purchase or duplicate incoming order",()=>{
 const input={rows:[],reviews:[]},c=ctx({reports:[],consumables:[],storage:{groups:[],reorder:[]},orders:[],consumption:{items:[{id:"rags",name:"Shop rags",status:"estimated",review:true,daysRemaining:7}]}});
 const list=engine.unifiedShoppingList(input,[v],c);assert.equal(list.items.length,0);assert.equal(list.reviews[0].key,"usage-forecast:rags");
 assert.equal(engine.unifiedShoppingList(input,[v],{...c,orders:[{status:"Ordered",lines:[{inventoryId:"rags",quantity:2}]}]}).reviews.length,0);
});
