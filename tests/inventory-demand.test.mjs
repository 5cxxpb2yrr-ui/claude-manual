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
