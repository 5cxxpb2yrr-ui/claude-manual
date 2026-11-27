import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const garage=readFileSync(new URL("../public/garage.html",import.meta.url),"utf8");
const slice=(a,b)=>garage.slice(garage.indexOf(a),garage.indexOf(b,garage.indexOf(a)));
const methods=new Function("alert","return ({"+slice("legacyMaintenanceHeld(id,","async addProjectAttachments(project,event)") + slice("maintenanceLinkedProject(plan){","async toggleMaintenanceTask(plan, index)") + slice("projectReadyToComplete(project) {","async saveProjectWorkspace(project)")+"})")(()=>{});
const fixture=()=>{
 const p={id:"p",vehicleId:"v",title:"Repair",status:"In Progress",tasks:[{done:true}],partRequirements:[]},m={id:"m",vehicleId:"v",title:"Service",status:"Planned",parts:[{inventoryId:"s",quantity:2}],tasks:[]},v={id:"v",name:"Scion",odometer:100};
 return {...methods,projects:[p],maintenancePlans:[m],inventory:[{id:"s",description:"Filter",quantity:5,reservedQuantity:2}],vehicles:[v],logs:[],modals:{projectCompletion:true,completeMaintenance:true},selectedMaintenancePlan:m,projectCompletionForm:{verified:true,date:"2026-11-26",mileage:101},completeMaintenanceForm:{verified:true,date:"2026-11-26",mileage:101,partsCost:0,labor:0,other:0},toolToday:()=>"2026-11-26",toolDateValid:()=>true,guidedOpenFindings:()=>[],projectActualCost:()=>25,saveToStorage:async()=>true};
};
test("project completion failure rolls back log, vehicle and project; retry records exactly once",async()=>{
 const m=fixture(),p=m.projects[0];m.saveToStorage=async()=>false;
 assert.equal(await m.completeProjectAndRecordService(p),false);assert.equal(p.status,"In Progress");assert.equal(m.logs.length,0);assert.equal(m.vehicles[0].odometer,100);assert.equal(m.modals.projectCompletion,true);
 m.saveToStorage=async()=>true;assert.equal(await m.completeProjectAndRecordService(p),true);assert.equal(await m.completeProjectAndRecordService(p),false);assert.equal(m.logs.length,1);assert.equal(m.logs[0].cost,25);
});
test("maintenance reserves aggregate quantities and respects project plus other legacy reservations",async()=>{
 const m=fixture(),p=m.selectedMaintenancePlan;m.maintenancePlans.push({id:"other",status:"Planned",parts:[{inventoryId:"s",quantity:2,reserved:true}]});
 assert.equal(await m.reserveMaintenanceParts(p),false);assert.equal(p.parts[0].reserved,undefined);
 m.maintenancePlans.pop();p.parts.push({inventoryId:"s",quantity:2});assert.equal(await m.reserveMaintenanceParts(p),false);
 p.parts.pop();assert.equal(await m.reserveMaintenanceParts(p),true);assert.equal(m.legacyMaintenanceHeld("s"),2);
});
test("maintenance completion rollback and retry preserve stock reserved for other projects",async()=>{
 const m=fixture(),p=m.selectedMaintenancePlan;assert.equal(await m.reserveMaintenanceParts(p),true);m.saveToStorage=async()=>false;
 assert.equal(await m.completeMaintenancePlan(),false);assert.equal(m.inventory[0].quantity,5);assert.equal(m.logs.length,0);assert.equal(p.parts[0].reserved,true);assert.equal(m.vehicles[0].odometer,100);
 m.saveToStorage=async()=>true;assert.equal(await m.completeMaintenancePlan(),true);assert.equal(m.inventory[0].quantity,3);assert.equal(m.inventory[0].reservedQuantity,2);assert.equal(m.logs.length,1);assert.equal(p.parts[0].reserved,false);assert.equal(p.parts[0].used,true);assert.equal(await m.completeMaintenancePlan(),false);
});
test("linked maintenance cannot bypass project completion and started guided work must finish",async()=>{
 const m=fixture(),p=m.projects[0];m.selectedMaintenancePlan.projectId=p.id;assert.equal(await m.completeMaintenancePlan(),false);
 p.guidedExecution={completed:{scope:"date"},status:"in-progress"};assert.equal(m.projectReadyToComplete(p),false);p.guidedExecution.status="completed";assert.equal(m.projectReadyToComplete(p),true);
});
