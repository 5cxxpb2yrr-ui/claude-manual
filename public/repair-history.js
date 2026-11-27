/* Read-only personal service history. No diagnosis, fitment or factory specifications inferred. */
(function(root){
"use strict";
const norm=v=>String(v??"").trim().toLowerCase();
const words=v=>norm(v).replace(/[^a-z0-9]+/g," ").trim();
const partKey=v=>norm(v).replace(/[^a-z0-9]/g,"");
const num=v=>v!=null&&String(v).trim()!==""&&Number.isFinite(Number(v))&&Number(v)>=0?Number(v):null;
const arr=v=>Array.isArray(v)?v:[];
function matchesVehicle(log,vehicle,vehicles){
 if(!vehicle)return false;
 const id=norm(vehicle.id),name=norm(vehicle.name),lid=norm(log.vehicleId),lname=norm(log.vehicle);
 // Explicit known identity wins; inconsistent ID/name remains outside the history view.
 const byName=arr(vehicles).filter(v=>lname&&[v.name,v.id].some(x=>norm(x)===lname));
 if(lid){if(lid!==id)return false;return !byName.length||byName.length===1&&norm(byName[0].id)===id;}
 return !!lname&&(byName.length===1?norm(byName[0].id)===id:!byName.length&&lname===name);
}
function evidence(log){
 const run=log.guidedExecution||{};
 return {id:log.id,serviceType:String(log.serviceType||"Service record"),date:log.date||"",mileage:num(log.mileage),cost:num(log.cost),materialValue:num(log.materialConsumedValue),durationMs:num(run.elapsedMs),running:!!run.timerStartedAt,notes:String(log.notes||""),installed:arr(log.installedParts).filter(p=>num(p.quantity)>0).map(p=>({description:String(p.description||""),partNumber:String(p.partNumber||""),quantity:num(p.quantity),unit:p.unit||"",materialCost:num(p.materialCost),phaseId:p.phaseId||""})),findings:arr(run.findings).map(f=>({text:String(f.text||""),status:f.status||"unknown",resolution:String(f.resolution||"")})),workNotes:arr(run.notes).map(n=>({text:String(n.text||""),phaseId:n.phaseId||""})),torque:arr(run.torqueChecks).map(t=>({target:t.target||"",specification:t.specification||"",source:t.source||"",confirmedAt:t.confirmedAt||""})),references:arr(log.procedureReferences).map(r=>({title:r.title||"",sourceLabel:r.sourceLabel||"",sourcePath:r.sourcePath||""})),log};
}
function searchText(log){
 const e=evidence(log);
 return [e.serviceType,log.vehicle,log.category,log.date,e.notes,...e.installed.flatMap(p=>[p.description,p.partNumber]),...e.findings.flatMap(f=>[f.text,f.resolution,f.status]),...e.workNotes.map(n=>n.text),...e.torque.flatMap(t=>[t.target,t.specification,t.source]),...e.references.flatMap(r=>[r.title,r.sourceLabel])].filter(Boolean).join(" ");
}
function history({logs=[],vehicle,vehicles=[],query="",predictions=[]}={}){
 const records=[],seen=new Set(),terms=norm(query).split(/\s+/).filter(Boolean);
 const ids=new Map();for(const log of logs){if(log?.id==null)continue;const k=String(log.id);ids.set(k,(ids.get(k)||0)+1);}
 for(const log of logs){
  if(!log||log.id==null||!matchesVehicle(log,vehicle,vehicles))continue;
  const id=String(log.id);if(ids.get(id)!==1||seen.has(id))continue;seen.add(id);records.push(evidence(log));
 }
 records.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
 const filtered=records.filter(r=>{const text=norm(searchText(r.log)),codes=r.installed.map(p=>partKey(p.partNumber)).filter(Boolean);return terms.every(t=>text.includes(t)||!!partKey(t)&&codes.includes(partKey(t)));});
 const repeated=new Map(),parts=new Map();
 for(const r of records){
  const k=words(r.serviceType);if(k&&k!=="service record"){if(!repeated.has(k))repeated.set(k,{name:r.serviceType,records:[]});repeated.get(k).records.push(r);}
  for(const p of r.installed){const pn=partKey(p.partNumber);if(!pn)continue;const k=JSON.stringify([pn,norm(p.unit)]);if(!parts.has(k))parts.set(k,{partNumber:p.partNumber,description:p.description,unit:p.unit,quantity:0,records:[]});const group=parts.get(k);group.quantity+=p.quantity;if(!group.records.some(x=>x.id===r.id))group.records.push(r);}
 }
 const costs=records.filter(r=>r.cost!==null),times=records.filter(r=>r.durationMs!==null&&!r.running);
 const schedule=arr(predictions).filter(p=>p.hasHistory&&["Red","Orange","Yellow"].includes(p.status)).map(p=>({id:p.id,name:p.serviceName,status:p.status,lastPerformedDate:p.lastPerformedDate||"",nextDueDate:p.nextDueDate||"",remainingMiles:p.remainingMiles}));
 return {records,filtered,repeat:[...repeated.values()].filter(g=>g.records.length>1),parts:[...parts.values()],summary:{recordCount:records.length,costCount:costs.length,costTotal:costs.reduce((n,r)=>n+r.cost,0),durationCount:times.length,durationMs:times.reduce((n,r)=>n+r.durationMs,0),installedCount:records.filter(r=>r.installed.length).length,duplicateIds:[...ids].filter(([,n])=>n>1).length},schedule};
}
const api={history,evidence,searchText,matchesVehicle};root.MotorNoteHistory=api;if(typeof module!=="undefined")module.exports=api;
})(typeof globalThis!=="undefined"?globalThis:this);
