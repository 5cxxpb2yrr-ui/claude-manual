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

test("recovery rejects malformed attachment collections and unsafe inline values before reading storage",async()=>{
 const f=fixture(),record=attachments=>({logs:[{id:"l",vehicleId:"v",attachments}]});
 for(const attachments of [{},[null],[[]],[{id:"a",data:"javascript:alert(1)"}],[{id:"a",dataUrl:"data:text/html;base64,YQ=="}],[{id:"a",data:"https://other.example/file.pdf"}],[{id:"a",data:"blob:https://example.test/expired"}],[{id:"a",dataUrl:"data:application/pdf;base64,YQ==",data:"data:application/pdf;base64,Yg=="}],[{storageKey:{id:"a"}}],[{}]]){
  assert.throws(()=>B.candidate(f,record(attachments),()=>[]),/attachment/i);
 }
 let reads=0;
 const bad={...f,logs:record([{id:"a",storageKey:"a",data:"javascript:alert(1)"}]).logs};
 await assert.rejects(B.portable(bad,async()=>{reads++;return "data:application/pdf;base64,YQ==";}),/Invalid inline attachment/);
 assert.equal(reads,0);
});
test("legacy inline data and valid existing storage references still recover",async()=>{
 const f=fixture(),inline="data:image/png;base64,YQ==";
 const next=B.candidate(f,{logs:[{id:"l",vehicleId:"v",attachments:[{id:"a",data:inline}]}]},()=>[]);
 const result=await B.portable(next,async key=>{assert.equal(key,"b");return "data:application/pdf;base64,Yg==";});
 assert.equal(result.logs[0].attachments[0].dataUrl,inline);
 assert.equal(result.logs[0].attachments[0].data,undefined);
 assert.equal(result.projects[0].attachments[0].dataUrl,"data:application/pdf;base64,Yg==");
});
