import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const m={exports:{}};new Function("module",readFileSync(new URL("../public/inventory-engine.js",import.meta.url),"utf8"))(m);const E=m.exports;
const part={id:"rags",description:"Shop rags",partNumber:"RAGS",unit:"pack",quantity:10,reservedQuantity:1,vehicleCompatibility:"Universal"};
function fixture(){
 let stock=[{...part}],ledger=E.reconcile([],stock,{timestamp:"2026-10-01T00:00:00Z"});
 function use(date,q){const result=E.recordConsumption(stock,{id:"rags",expectedQuantity:stock[0].quantity,unit:"pack",quantity:q,reason:"Cleaned workbench"});stock=result.inventory;ledger=E.reconcile(ledger,stock,{timestamp:date,reason:"Consumable stock used",reference:result.reference});}
 use("2026-10-10T00:00:00Z",1);use("2026-10-20T00:00:00Z",2);use("2026-11-01T00:00:00Z",2);
 return {stock,ledger,use};
}
test("actual use is atomic, rejects stale units, insufficient stock, and legacy reservations",()=>{
 const stock=[part],d={id:"rags",expectedQuantity:10,unit:"pack",quantity:2,reason:"Cleanup"};
 const result=E.recordConsumption(stock,d);assert.equal(result.inventory[0].quantity,8);assert.equal(stock[0].quantity,10);assert.equal(result.reference.action,"consumable-use");
 for(const x of [{quantity:0},{quantity:10},{unit:"each"},{expectedQuantity:9},{reason:""}])assert.throws(()=>E.recordConsumption(stock,{...d,...x}));
 assert.throws(()=>E.recordConsumption(stock,{...d,quantity:8},{maintenancePlans:[{id:"m",status:"Planned",parts:[{inventoryId:"rags",reserved:true,quantity:2}]}]}));
});
test("forecast needs three dates spanning two weeks and uses only verified consumption",()=>{
 const {stock,ledger}=fixture(),now="2026-11-05T00:00:00Z",before=JSON.stringify({stock,ledger});
 const x=E.consumptionForecast(stock,ledger,{},now).items[0];
 assert.equal(x.status,"estimated");assert.equal(x.events,3);assert.equal(x.consumed,5);assert.equal(x.available,4);assert.equal(x.rate,4/26);assert.equal(x.daysRemaining,26);assert.equal(x.suggestedTarget,5);
 assert.equal(JSON.stringify({stock,ledger}),before);
 const changed=[{...stock[0],quantity:2}],corrected=E.reconcile(ledger,changed,{timestamp:"2026-11-03T00:00:00Z",reason:"Manual stock correction",reference:{itemId:"rags",quantity:3,unit:"pack"}});
 const y=E.consumptionForecast(changed,corrected,{},now).items[0];assert.equal(y.consumed,5);assert.equal(y.available,1);assert.equal(y.review,true);
 assert.equal(E.consumptionForecast(stock,ledger,{},"2026-12-20T00:00:00Z").items[0].status,"insufficient-history");
 assert.equal(E.consumptionForecast([{...stock[0],unit:"each"}],ledger,{},now).items.length,0);
 assert.ok(E.consumptionForecast([{...stock[0],quantity:99}],ledger,{},now).issues.length);
});
test("verified quantified vehicle refill counts but qualitative report, purchases and unrelated deductions do not",()=>{
 let stock=[{...part}],ledger=E.reconcile([],stock,{timestamp:"2026-10-01T00:00:00Z"});
 stock=[{...part,quantity:9}];ledger=E.reconcile(ledger,stock,{timestamp:"2026-10-10T00:00:00Z",reason:"Consumable replenishment confirmed",reference:{reportId:"r",itemId:"rags",unit:"pack",quantity:1}});
 const x=E.consumptionForecast(stock,ledger,{},"2026-10-11T00:00:00Z").items[0];assert.equal(x.events,1);assert.equal(x.status,"insufficient-history");assert.equal(x.rate,null);
});
