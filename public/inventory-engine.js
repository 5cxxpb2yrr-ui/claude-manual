/* Inventory Engine V1: append-only balance journal, compatible with existing stock records. */
(function(root){
"use strict";
const finite=v=>Number.isFinite(Number(v))?Number(v):0;
const balance=p=>({onHand:finite(p?.quantity),reserved:finite(p?.reservedQuantity)});
const same=(a,b)=>a.onHand===b.onHand&&a.reserved===b.reserved;
const zero=()=>({onHand:0,reserved:0});
function project(ledger){
 const latest=new Map(),ids=new Set();
 for(const entry of ledger||[]){
  if(!entry||!entry.id||ids.has(entry.id)||entry.itemId==null||!entry.before||!entry.after||![entry.before.onHand,entry.before.reserved,entry.after.onHand,entry.after.reserved].every(Number.isFinite))throw Error("Invalid inventory ledger entry.");
  ids.add(entry.id);
  const key=String(entry.itemId),prior=latest.get(key);
  if(!same(prior?.after||zero(),entry.before))throw Error("Inventory ledger balance chain is inconsistent for "+key);
  latest.set(key,entry);
 }
 return latest;
}
function reconcile(ledger,inventory,options={}){
 const old=Array.isArray(ledger)?ledger:[],latest=project(old),next=old.slice(),seen=new Set(),timestamp=options.timestamp||new Date().toISOString();
 const append=(key,part,prior,after,present)=>{
  const before=prior?.after||zero(),delta={onHand:after.onHand-before.onHand,reserved:after.reserved-before.reserved};
  const count=options.reference?.action==="physical-count"&&String(options.reference.itemId)===key&&present;
  const merge=options.reference?.action==="stock-merge"&&(String(options.reference.itemId)===key||String(options.reference.sourceId)===key);
  const storage=present&&["storage-transfer","reorder-settings"].includes(options.reference?.action)&&String(options.reference.itemId)===key;
  if(prior&&same(before,after)&&prior.present===present&&!count&&!merge&&!storage)return;
  let type;
  if(!prior)type=old.length?"stock-added":"opening-balance";
  else if(!present)type="stock-removed";
  else if(delta.onHand<0&&delta.reserved<0)type="consumption";
  else if(!delta.onHand&&delta.reserved>0)type="reservation";
  else if(!delta.onHand&&delta.reserved<0)type="release";
  else type="stock-adjustment";
  if(count)type="physical-count";
  if(merge)type=present?"merge-in":"merge-out";
  if(storage)type=options.reference.action;
  next.push({id:"inventory-movement-"+(next.length+1),itemId:key,name:String(part?.description||prior?.name||"Inventory item"),partNumber:String(part?.partNumber||prior?.partNumber||""),timestamp,type,reason:!prior&&!old.length&&!count&&!merge&&!storage?"Existing stock at ledger initialization":String(options.reason||"Saved inventory change"),reference:options.reference||null,before:{...before},after:{...after},delta,present});
 };
 for(const part of inventory||[]){
  if(part?.id==null)throw Error("Inventory item has no ID.");
  const key=String(part.id);if(seen.has(key))throw Error("Duplicate inventory item ID: "+key);seen.add(key);
  append(key,part,latest.get(key),balance(part),true);
 }
 for(const [key,prior] of latest)if(!seen.has(key)&&prior.present!==false)append(key,null,prior,zero(),false);
 return next;
}
function audit(ledger,inventory){
 try{
  const latest=project(ledger),stock=new Map((inventory||[]).map(p=>[String(p.id),p]));
  const issues=[];
  if(stock.size!==(inventory||[]).length)issues.push("Duplicate inventory IDs.");
  for(const [id,p] of stock){const e=latest.get(id);if(!e||e.present===false||!same(e.after,balance(p)))issues.push("Balance mismatch: "+id);}
  for(const [id,e] of latest)if(e.present!==false&&!stock.has(id))issues.push("Missing inventory item: "+id);
  return issues;
 }catch(e){return [e.message];}
}

const key=v=>String(v??"").trim().toLowerCase();
const identity=v=>key(v).replace(/[^a-z0-9]/g,"");
const idIs=(a,b)=>a!=null&&b!=null&&String(a)===String(b);
const copy=v=>JSON.parse(JSON.stringify(v));
const active=p=>! /^(completed|cancelled|canceled|archived)$/i.test(p?.status||"");
const validNumber=v=>v!==null&&v!==undefined&&String(v).trim()!==""&&Number.isFinite(Number(v))&&Number(v)>=0;
function reservationFloor(item,{projects=[],maintenancePlans=[]}={}){
 const canonical=Number(item.reservedQuantity||0);
 if(!validNumber(item.reservedQuantity??0))throw Error("Invalid reserved quantity.");
 let legacy=0;
 for(const plan of maintenancePlans.filter(active)){
  if(projects.some(p=>active(p)&&(idIs(p.id,plan.projectId)||idIs(p.maintenancePlanId,plan.id))&&(p.partRequirements||[]).length))continue;
  for(const req of plan.parts||[])if(idIs(req.inventoryId,item.id)&&req.reserved&&!req.used&&!/^(used|installed|cancelled|canceled)$/i.test(req.status||"")){
   if(!validNumber(req.quantity))throw Error("Invalid maintenance reservation.");
   legacy+=Number(req.quantity);
  }
 }
 return canonical+legacy;
}
function references(id,context={}){
 const links=[];
 function visit(value,path){
  if(!value||typeof value!=="object")return;
  if(Array.isArray(value)){value.forEach((x,i)=>visit(x,path+"["+i+"]"));return;}
  for(const [k,v] of Object.entries(value)){
   if((k==="inventoryId"||k==="itemId"||k==="stockId"||k==="partInventoryId")&&idIs(v,id))links.push(path+"."+k);
   else if((k==="inventoryIds"||k==="itemIds"||k==="stockIds")&&Array.isArray(v)&&v.some(x=>idIs(x,id)))links.push(path+"."+k);
   else if(v&&typeof v==="object")visit(v,path+"."+k);
  }
 }
 for(const name of ["projects","maintenancePlans","archivedMaintenance","vendorOrders","logs","vehicles"])visit(context[name]||[],name);
 return links;
}
function inspectInventory(inventory=[],ledger=[],context={}){
 const issues=[],groups=new Map(),counts=new Map();
 for(const item of inventory){
  const id=String(item.id),pn=identity(item.partNumber);
  counts.set(id,(counts.get(id)||0)+1);
  try{
   const floor=reservationFloor(item,context);
   if(!validNumber(item.quantity)||!validNumber(item.unitCost??0)||floor>Number(item.quantity))issues.push({id,message:(item.description||id)+": invalid balance, cost or insufficient reserved stock"});
  }catch(err){issues.push({id,message:(item.description||id)+": "+err.message});}
  if(pn){const group=JSON.stringify([pn,key(item.unit||"each"),key(item.vehicleCompatibility||"Not verified")]);if(!groups.has(group))groups.set(group,[]);groups.get(group).push(item);}
 }
 for(const [id,n] of counts)if(n>1)issues.push({id,message:"Duplicate stock ID: "+id});
 const duplicates=[...groups.values()].filter(items=>items.length>1).map(items=>({key:String(items[0].id),items}));
 const ledgerIssues=ledger.length?audit(ledger,inventory):[];
 return {issues,duplicates,ledgerIssues,initialized:ledger.length>0,items:inventory.length};
}
function physicalCount(inventory,request,context={}){
 const item=inventory.find(p=>idIs(p.id,request.id));
 if(!item||inventory.filter(p=>idIs(p.id,request.id)).length!==1)throw Error("Stock record changed or is ambiguous.");
 if(!validNumber(item.quantity)||Number(item.quantity)!==Number(request.expected))throw Error("Stock changed since count began. Start a fresh count.");
 const reason=String(request.reason||"").trim(),n=Number(request.count);
 if(!reason||reason.length>300)throw Error("Enter a count reason (up to 300 characters).");
 if(!validNumber(request.count))throw Error("Enter a nonnegative physical count.");
 const floor=reservationFloor(item,context);
 if(n<floor)throw Error("Count is below reserved stock ("+floor+"). Resolve reservations first.");
 return {inventory:inventory.map(p=>idIs(p.id,item.id)?{...p,quantity:n}:p),reference:{action:"physical-count",itemId:item.id,expected:Number(item.quantity),count:n,reservationFloor:floor,reason}};
}
function mergeStock(inventory,request,context={}){
 const target=inventory.find(p=>idIs(p.id,request.targetId)),source=inventory.find(p=>idIs(p.id,request.sourceId));
 if(!target||!source||idIs(target.id,source.id)||inventory.filter(p=>idIs(p.id,target.id)||idIs(p.id,source.id)).length!==2)throw Error("Choose two distinct, unambiguous records.");
 if(locationCode(target.storageLocation)!==locationCode(source.storageLocation))throw Error("Move both records to the same storage location before merging.");
 if((target.reorderMinimum??null)!==(source.reorderMinimum??null)||(target.reorderTarget??null)!==(source.reorderTarget??null))throw Error("Reorder settings differ; review before merging.");
 const reason=String(request.reason||"").trim();
 if(!reason||reason.length>300)throw Error("Enter a merge reason (up to 300 characters).");
 if(!identity(target.partNumber)||identity(target.partNumber)!==identity(source.partNumber)||key(target.unit||"each")!==key(source.unit||"each")||key(target.vehicleCompatibility)!==key(source.vehicleCompatibility)||!key(target.vehicleCompatibility)||key(target.vehicleCompatibility)==="not verified")throw Error("Merge requires matching manufacturer number, unit and verified fitment.");
 if(reservationFloor(target,context)||reservationFloor(source,context)||references(target.id,context).length||references(source.id,context).length||target.projectId||source.projectId||target.purchaseOrderId||source.purchaseOrderId)throw Error("Referenced or reserved records cannot be merged. Preserve the original links.");
 if(![target.quantity,source.quantity,target.unitCost,source.unitCost].every(validNumber))throw Error("Invalid stock balance or cost.");
 if(Number(target.quantity)!==Number(request.expectedTarget)||Number(source.quantity)!==Number(request.expectedSource))throw Error("Stock changed. Review both records again.");
 const barcodes=p=>[p.barcode,...(Array.isArray(p.barcodes)?p.barcodes:[])].filter(x=>String(x??"").trim()).map(x=>String(x).trim());
 const t=new Set(barcodes(target)),s=new Set(barcodes(source));
 if(t.size&&s.size&&![...t].some(x=>s.has(x)))throw Error("Different barcodes; verify packaging and identity before merging.");
 const all=[...new Set([...t,...s])];
 if(inventory.some(p=>!idIs(p.id,target.id)&&!idIs(p.id,source.id)&&barcodes(p).some(x=>all.includes(x))))throw Error("Barcode also belongs to another record.");
 const quantity=Number(target.quantity)+Number(source.quantity),value=Number(target.quantity)*Number(target.unitCost)+Number(source.quantity)*Number(source.unitCost);
 const merged={...target,quantity,unitCost:quantity?value/quantity:Number(target.unitCost),reservedQuantity:0,...(all.length?{barcode:target.barcode||all[0],barcodes:all}:{})};
 return {inventory:inventory.filter(p=>!idIs(p.id,source.id)).map(p=>idIs(p.id,target.id)?merged:p),reference:{action:"stock-merge",itemId:target.id,sourceId:source.id,targetBefore:copy(target),sourceBefore:copy(source),reason}};
}


function locationCode(value){
 const raw=String(value??"").trim().toUpperCase();
 if(!raw)return "";
 if(!/^[A-Z0-9][A-Z0-9 ._/-]{0,79}$/.test(raw))throw Error("Location code must be 1–80 letters, numbers, spaces or . _ / -.");
 return raw;
}
function storageSummary(inventory=[],context={}){
 const groups=new Map(),reorder=[],issues=[];
 for(const p of inventory){
  let code="",floor=0;
  try{code=locationCode(p.storageLocation);floor=reservationFloor(p,context);if(!validNumber(p.quantity))throw Error("Invalid stock quantity.");}catch(err){issues.push({id:p.id,message:(p.description||p.id)+": "+err.message});continue;}
  const available=Math.max(0,Number(p.quantity)-floor),row={id:p.id,description:p.description,partNumber:p.partNumber||"",quantity:Number(p.quantity),available,unit:p.unit||"each",location:code,minimum:p.reorderMinimum??null,target:p.reorderTarget??null};
  if(!groups.has(code))groups.set(code,{code,label:code||"Unassigned",items:[]});
  groups.get(code).items.push(row);
  if(row.minimum===null&&row.target===null)continue;
  if(!validNumber(row.minimum)||!validNumber(row.target)||Number(row.target)<=Number(row.minimum)){issues.push({id:p.id,message:(p.description||p.id)+": invalid reorder settings"});continue;}
  if(available<=Number(row.minimum)){
   // Only credit incoming order lines explicitly linked to this stock record.
   const incoming=(context.vendorOrders||[]).filter(o=>["Ordered","Partially received"].includes(o.status)).flatMap(o=>o.lines||[]).filter(l=>idIs(l.inventoryId,p.id)&&key(l.unit||"each")===key(p.unit||"each")&&key(l.vehicleCompatibility||"Not verified")===key(p.vehicleCompatibility||"Not verified")&&(!identity(p.partNumber)||identity(l.partNumber)===identity(p.partNumber))).reduce((sum,l)=>sum+Math.max(0,Number(l.quantity||0)-Number(l.receivedQuantity||0)),0);
   const suggested=Math.max(0,Number(row.target)-available-incoming);
   reorder.push({...row,incoming,suggested});
  }
 }
 return {groups:[...groups.values()].sort((a,b)=>a.code.localeCompare(b.code)),reorder,issues};
}
// Explicit consumption is distinct from stock corrections and reservations.
function recordConsumption(inventory,request,context={}){
 const matches=inventory.filter(p=>idIs(p.id,request.id)),p=matches[0];
 if(matches.length!==1)throw Error("Stock record is missing or ambiguous.");
 const quantity=Number(request.quantity),reason=String(request.reason||"").trim();
 if(!validNumber(request.quantity)||quantity<=0||!reason||reason.length>300)throw Error("Enter actual positive usage and a reason (up to 300 characters).");
 if(!validNumber(p.quantity)||!validNumber(request.expectedQuantity)||Number(p.quantity)!==Number(request.expectedQuantity)||key(p.unit||"each")!==key(request.unit))throw Error("Stock or unit changed; reopen the record.");
 const floor=reservationFloor(p,context);
 if(quantity>Number(p.quantity)-floor)throw Error("Usage exceeds unreserved stock.");
 return {inventory:inventory.map(x=>idIs(x.id,p.id)?{...x,quantity:Number(x.quantity)-quantity}:x),reference:{action:"consumable-use",itemId:p.id,quantity,unit:p.unit||"each",reason}};
}
// Forecast is advisory only. Count verified, unit-matched physical consumption;
// never infer use from purchases, corrections, merges, reservation or removal.
function consumptionForecast(inventory=[],ledger=[],context={},now=new Date().toISOString()){
 const end=Date.parse(now),day=86400000,windowDays=90,reviewDays=14,coverageDays=30;
 if(!Number.isFinite(end))throw Error("Invalid forecast date.");
 if(!ledger.length)return {items:[],issues:[],windowDays,reviewDays,coverageDays};
 const issues=audit(ledger,inventory);if(issues.length)return {items:[],issues,windowDays,reviewDays,coverageDays};
 const items=[];
 for(const p of inventory){
  const unit=p.unit||"each",movements=ledger.filter(e=>idIs(e.itemId,p.id));let start=end-windowDays*day;
  // A merge or record removal/recreation ends the comparable observation window.
  for(const e of movements)if(["merge-in","merge-out","stock-removed","opening-balance","stock-added"].includes(e.type)&&Number.isFinite(Date.parse(e.timestamp)))start=Math.max(start,Date.parse(e.timestamp));
  const events=movements.filter(e=>{
   const t=Date.parse(e.timestamp),ref=e.reference||{},q=Number(ref.quantity);
   const explicit=ref.action==="consumable-use"&&e.reason==="Consumable stock used"||e.reason==="Consumable replenishment confirmed"&&!!ref.reportId;
   return explicit&&e.present!==false&&idIs(ref.itemId,p.id)&&key(ref.unit)===key(unit)&&key(e.name)===key(p.description)&&identity(e.partNumber)===identity(p.partNumber)&&Number.isFinite(q)&&q>0&&Math.abs(e.delta.onHand+q)<1e-8&&e.delta.reserved===0&&Number.isFinite(t)&&t>=start&&t<=end;
  }).sort((a,b)=>Date.parse(a.timestamp)-Date.parse(b.timestamp));
  if(!events.length)continue;
  let available;try{const floor=reservationFloor(p,context);if(!validNumber(p.quantity)||floor>Number(p.quantity))throw Error("Invalid available balance");available=Number(p.quantity)-floor;}catch(e){continue;}
  const first=Date.parse(events[0].timestamp),last=Date.parse(events.at(-1).timestamp),span=(last-first)/day,distinct=new Set(events.map(e=>new Date(e.timestamp).toISOString().slice(0,10))).size,total=events.reduce((n,e)=>n-e.delta.onHand,0);
  const enough=distinct>=3&&span>=14&&(end-last)/day<=30;
  const base={id:String(p.id),name:p.description||"Stock item",unit,events:events.length,distinctDays:distinct,observedDays:span,consumed:total,available,lastUsed:events.at(-1).timestamp};
  if(!enough){items.push({...base,status:"insufficient-history",rate:null,daysRemaining:null,suggestedTarget:null,review:false});continue;}
  // First event establishes the observation anchor; only subsequent events
  // contribute to the rate. Include elapsed time since last usage.
  const rate=(total+events[0].delta.onHand)/((end-first)/day);
  if(!Number.isFinite(rate)||rate<=0)continue;
  const daysRemaining=available/rate,suggestedTarget=Math.ceil(rate*coverageDays);
  items.push({...base,status:"estimated",rate,daysRemaining,suggestedTarget,review:daysRemaining<=reviewDays});
 }
 return {items:items.sort((a,b)=>Number(b.review)-Number(a.review)||(a.daysRemaining??Infinity)-(b.daysRemaining??Infinity)||a.name.localeCompare(b.name)),issues,windowDays,reviewDays,coverageDays};
}
function updateStorage(inventory,request){
 const p=inventory.find(x=>idIs(x.id,request.id));
 if(!p||inventory.filter(x=>idIs(x.id,request.id)).length!==1)throw Error("Stock record is missing or ambiguous.");
 const before=locationCode(p.storageLocation),after=locationCode(request.location),reason=String(request.reason||"").trim();
 if(!validNumber(p.quantity)||!validNumber(request.expectedQuantity)||Number(p.quantity)!==Number(request.expectedQuantity)||before!==locationCode(request.expectedLocation)||(p.reorderMinimum??null)!==(request.expectedMinimum??null)||(p.reorderTarget??null)!==(request.expectedTarget??null))throw Error("Stock or settings changed; reopen the record.");
 if(!reason||reason.length>300)throw Error("Enter a reason (up to 300 characters).");
 const blank=v=>v==null||String(v).trim()==="";
 let minimum=null,target=null;
 if(!blank(request.minimum)||!blank(request.target)){
  if(!validNumber(request.minimum)||!validNumber(request.target)||Number(request.target)<=Number(request.minimum))throw Error("Enter a nonnegative minimum and a target greater than the minimum, or leave both blank.");
  minimum=Number(request.minimum);target=Number(request.target);
 }
 if(before===after&&minimum===(p.reorderMinimum??null)&&target===(p.reorderTarget??null))throw Error("No storage or reorder settings changed.");
 return {inventory:inventory.map(x=>idIs(x.id,p.id)?{...x,storageLocation:after,reorderMinimum:minimum,reorderTarget:target}:x),reference:{action:before===after?"reorder-settings":"storage-transfer",itemId:p.id,quantity:Number(p.quantity),from:before,to:after,minimumBefore:p.reorderMinimum??null,targetBefore:p.reorderTarget??null,minimumAfter:minimum,targetAfter:target,reason}};
}

const api={balance,project,reconcile,audit,inspectInventory,physicalCount,mergeStock,reservationFloor,locationCode,storageSummary,updateStorage,recordConsumption,consumptionForecast};root.MotorNoteInventoryEngine=api;if(typeof module!=="undefined")module.exports=api;
})(typeof globalThis!=="undefined"?globalThis:this);
