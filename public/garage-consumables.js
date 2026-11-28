/* V20.2 pure replenishment lifecycle; stock and orders remain canonical. */
(function(root){
"use strict";
const list=x=>Array.isArray(x)?x:[];
const str=x=>String(x??"").trim();
const norm=x=>str(x).toLowerCase().replace(/\s+/g," ");
const same=(a,b)=>a!=null&&b!=null&&String(a)===String(b);
const positive=x=>typeof x==="number"&&Number.isFinite(x)&&x>0;
function validateReport(d,vehicles=[]){
 const scope=d.scope,vehicleId=scope==="vehicle"?str(d.vehicleId):null,name=str(d.name),level=d.level,inventoryId=str(d.inventoryId)||null,unit=str(d.unit)||null,target=d.targetQuantity??null;
 if(!["vehicle","garage"].includes(scope)||!name||name.length>120||!["low","empty"].includes(level))throw Error("Confirm consumable name, scope and Low/Empty level.");
 if(scope==="vehicle"&&!vehicles.some(v=>same(v.id,vehicleId)))throw Error("Select a known vehicle.");
 if(target!==null&&(!positive(target)||!unit||!inventoryId))throw Error("A stock target requires a positive quantity, unit and verified stock link.");
 return {scope,vehicleId,name,level,inventoryId,unit,targetQuantity:target};
}
const reportKey=r=>JSON.stringify([r.scope,r.vehicleId,norm(r.name)]);
function report(reports,draft,vehicles,id,now){
 const fields=validateReport(draft,vehicles);
 const rows=list(reports),existing=rows.find(r=>r.status==="open"&&reportKey(r)===reportKey(fields));
 if(!str(id)||!str(now))throw Error("Report identity and timestamp required.");
 if(existing)return rows.map(r=>r===existing?{...r,...fields,updatedAt:now}:r);
 if(rows.some(r=>same(r.id,id)))throw Error("Duplicate report ID.");
 return [...rows,{...fields,id:str(id),status:"open",createdAt:now,updatedAt:now}];
}
function verifiedStock(r,inventory,vehicles){
 if(!r.inventoryId||!r.unit)return null;
 const matches=list(inventory).filter(p=>same(p.id,r.inventoryId));
 if(matches.length!==1)return null;
 const p=matches[0],vehicle=list(vehicles).find(v=>same(v.id,r.vehicleId));
 if(norm(p.unit||"each")!==norm(r.unit)||!(p.vehicleCompatibility==="Universal"||r.scope==="vehicle"&&vehicle&&p.vehicleCompatibility===vehicle.name))return null;
 const q=Number(p.quantity),reserved=Number(p.reservedQuantity||0);
 if(!Number.isFinite(q)||!Number.isFinite(reserved)||q<0||reserved<0||reserved>q)return null;
 return {part:p,available:q-reserved};
}
function compatible(r,fitment,vehicles){
 const v=list(vehicles).find(v=>same(v.id,r.vehicleId));
 return fitment==="Universal"||r.scope==="vehicle"&&!!v&&fitment===v.name;
}
function lineMatches(r,l,inventory,vehicles){
 const stock=verifiedStock(r,inventory,vehicles);
 if(l.demandKey||l.consumableReportId&&!same(l.consumableReportId,r.id))return false;
 if(stock)return same(l.inventoryId,stock.part.id)&&norm(l.unit)===norm(r.unit)&&l.vehicleCompatibility===stock.part.vehicleCompatibility;
 // No name-only association: an explicit report link is required.
 if(r.inventoryId||!same(l.consumableReportId,r.id)||norm(l.description)!==norm(r.name)||!str(l.unit)||r.unit&&norm(l.unit)!==norm(r.unit)||!compatible(r,l.vehicleCompatibility,vehicles))return false;
 if(l.inventoryId){const p=list(inventory).find(p=>same(p.id,l.inventoryId));return !!p&&norm(p.unit||"each")===norm(l.unit)&&p.vehicleCompatibility===l.vehicleCompatibility;}
 return true;
}
function incomingFor(r,inventory,orders,vehicles){
 return list(orders).filter(o=>["Ordered","Partially received"].includes(o.status)).flatMap(o=>list(o.lines).filter(l=>lineMatches(r,l,inventory,vehicles)&&positive(Number(l.quantity)-Number(l.receivedQuantity||0))).map(l=>({orderId:o.id,lineId:l.id,remaining:Number(l.quantity)-Number(l.receivedQuantity||0),expectedDate:o.expectedDate||null,explicit:same(l.consumableReportId,r.id)})));
}
function validateOrderLinks(lines,reports,inventory,orders,vehicles){
 const seen=new Set();
 for(const l of list(lines)){
  if(!l.consumableReportId)continue;
  const r=list(reports).find(r=>same(r.id,l.consumableReportId)&&r.status==="open");
  if(!r||!lineMatches(r,l,inventory,vehicles))throw Error("Confirm the consumable report, product identity, unit and fitment before recording the linked purchase.");
  if(l.demandKey)throw Error("One order line cannot be allocated to both repair demand and a consumable report.");
  if(seen.has(r.id))throw Error("Use one linked line per consumable report; record extra stock separately.");
  seen.add(r.id);
  if(incomingFor(r,inventory,orders,vehicles).length)throw Error("A matching purchase is already incoming. Review the existing order before recording another linked purchase.");
 }
}
function linkReceived(reports,result,vehicles,now){
 const changed=new Set(list(result.changed).map(x=>String(x.lineId)));
 return list(reports).map(r=>{
  if(r.status!=="open"||r.inventoryId)return r;
  const lines=list(result.order?.lines).filter(l=>changed.has(String(l.id))&&same(l.consumableReportId,r.id)&&lineMatches(r,l,result.inventory,vehicles)&&l.inventoryId);
  if(lines.length!==1)return r;
  const l=lines[0],next={...r,inventoryId:String(l.inventoryId),unit:l.unit,updatedAt:now};
  return verifiedStock(next,result.inventory,vehicles)?next:r;
 });
}
function project({reports,inventory,orders,vehicles,today}={}){
 return list(reports).filter(r=>r.status==="open").map(r=>{
  const stock=verifiedStock(r,inventory,vehicles),available=stock?.available??null;
  const incoming=incomingFor(r,inventory,orders,vehicles);
  const due=incoming.some(o=>o.expectedDate&&today&&o.expectedDate<today),enough=r.targetQuantity==null?available>0:available!==null&&available>=r.targetQuantity;
  const state=enough?(r.scope==="vehicle"?"refill":"confirm-stock"):incoming.length?"waiting":available===null?"verify-stock":"replenish";
  const rank=state==="waiting"?(due?81:44):r.scope==="vehicle"&&r.level==="empty"?83:r.level==="empty"?74:66;
  const vehicle=list(vehicles).find(v=>same(v.id,r.vehicleId));
  return {id:r.id,name:r.name,scope:r.scope,vehicleId:r.vehicleId,level:r.level,location:r.scope==="garage"?"Garage":vehicle?.name||"Vehicle not recorded",state,rank,group:state==="waiting"?"Waiting":"Execute",available,unit:r.unit,incoming,overdue:due};
 });
}
function resolve(reports,id,confirmation,context,now){
 const rows=list(reports),r=rows.find(x=>same(x.id,id)&&x.status==="open");
 if(!r||!str(now))throw Error("Open report and timestamp required.");
 if(r.scope==="vehicle"&&confirmation?.kind!=="refilled")throw Error("Confirm the vehicle was actually refilled.");
 if(r.scope==="garage"&&confirmation?.kind!=="sufficient-stock")throw Error("Confirm sufficient garage stock.");
 if(r.scope==="garage"&&r.targetQuantity!==null){
  const stock=verifiedStock(r,context?.inventory,context?.vehicles);
  if(!stock||stock.available<r.targetQuantity)throw Error("Available stock is below the configured target.");
 }
 if(confirmation.confirmed!==true)throw Error("Explicit confirmation required.");
 // This operation records a qualitative confirmation only. Known stock
 // consumption must first be committed atomically by the canonical ledger path.
 if(confirmation.quantity!=null)throw Error("Quantified consumption requires the inventory transaction workflow.");
 return rows.map(x=>x===r?{...r,status:"resolved",resolvedAt:now,updatedAt:now,resolution:confirmation.kind}:x);
}
// Vehicle extensions survive the pinned V9 serializer. Shared supply
// records are stored on one existing vehicle solely as a storage carrier;
// their scope remains garage-wide, and their vehicleId must remain null.
const field="motorNoteConsumablesV1";
function readVehicles(vehicles){
 const rows=[],ids=new Set(),keys=new Set();
 for(const v of list(vehicles)){
  const ext=v[field];if(ext===undefined)continue;
  if(!Array.isArray(ext))throw Error("Invalid consumable collection.");
  for(const r of ext){
   if(!r||!str(r.id)||ids.has(str(r.id))||!["open","resolved"].includes(r.status))throw Error("Invalid or duplicate consumable record.");
   validateReport(r,vehicles);
   if(r.scope==="vehicle"&&!same(r.vehicleId,v.id)||r.scope==="garage"&&r.vehicleId!==null)throw Error("Consumable scope mismatch.");
   if(r.status==="open"&&keys.has(reportKey(r)))throw Error("Duplicate open consumable report.");
   if(r.status==="open")keys.add(reportKey(r));
   ids.add(str(r.id));rows.push(r);
  }
 }
 return rows;
}
function writeVehicles(vehicles,rows){
 if(!list(vehicles).length)throw Error("At least one vehicle is required.");
 const carrier=[...vehicles].sort((a,b)=>String(a.id).localeCompare(String(b.id)))[0].id;
 const next=vehicles.map(v=>{const n={...v};const assigned=rows.filter(r=>r.scope==="garage"?same(v.id,carrier):same(v.id,r.vehicleId));if(assigned.length)n[field]=assigned;else delete n[field];return n;});
 if(readVehicles(next).length!==rows.length)throw Error("Consumable record could not be assigned.");
 return next;
}
const api={validateReport,report,project,resolve,verifiedStock,readVehicles,writeVehicles,validateOrderLinks,linkReceived,incomingFor};root.MotorNoteConsumables=api;if(typeof module!=="undefined")module.exports=api;
})(typeof globalThis!=="undefined"?globalThis:this);
