import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const m={exports:{}};new Function("module",readFileSync(new URL("../public/garage-backup.js",import.meta.url),"utf8"))(m);const B=m.exports;
const fixture=()=>({schemaVersion:9,vehicles:[{id:"v",name:"Car"}],logs:[{id:"l",vehicleId:"v",attachments:[{id:"a",storageKey:"a"}]}],projects:[{id:"p",vehicleId:"v",attachments:[{id:"b",storageKey:"b"}]}],inventory:[],inventoryLedger:[],vendorOrders:[],toolInventory:[],maintenancePlans:[],archivedMaintenance:[{id:"arch"}],maintenanceSetupVersion:2});
test("portable backup includes both attachment files without changing source records",async()=>{
 const f=fixture(),before=JSON.stringify(f),b=await B.portable(f,async k=>"data:application/pdf;base64,"+(k==="a"?"YQ==":"Yg=="));
 assert.equal(b.logs[0].attachments[0].dataUrl,"data:application/pdf;base64,YQ==");assert.equal(b.projects[0].attachments[0].storageKey,undefined);assert.equal(JSON.stringify(f),before);
 assert.equal((await B.portable(b,()=>{throw Error("should not read");})).projects[0].attachments[0].dataUrl,"data:application/pdf;base64,Yg==");
});
test("missing attachment prevents export",async()=>{await assert.rejects(B.portable(fixture(),async()=>null),/Missing/);});
test("restore retains archived maintenance and explicitly empty ledger; rejects unknown vehicles and duplicates",()=>{
 const f=fixture(),r=B.candidate(f,{inventory:[],inventoryLedger:[],archivedMaintenance:[],maintenanceSetupVersion:3},()=>[]);
 assert.equal(r.archivedMaintenance.length,0);assert.equal(r.maintenanceSetupVersion,3);
 assert.throws(()=>B.candidate(f,{logs:[{id:"x",vehicleId:"wrong"}]},()=>[]),/Unknown vehicle/);
 assert.throws(()=>B.candidate(f,{logs:[f.logs[0],f.logs[0]]},()=>[]),/duplicate/);
});
