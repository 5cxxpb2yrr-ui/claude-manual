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
  if(prior&&same(before,after)&&prior.present===present)return;
  let type;
  if(!prior)type=old.length?"stock-added":"opening-balance";
  else if(!present)type="stock-removed";
  else if(delta.onHand<0&&delta.reserved<0)type="consumption";
  else if(!delta.onHand&&delta.reserved>0)type="reservation";
  else if(!delta.onHand&&delta.reserved<0)type="release";
  else type="stock-adjustment";
  next.push({id:"inventory-movement-"+(next.length+1),itemId:key,name:String(part?.description||prior?.name||"Inventory item"),partNumber:String(part?.partNumber||prior?.partNumber||""),timestamp,type,reason:!prior&&!old.length?"Existing stock at ledger initialization":String(options.reason||"Saved inventory change"),reference:options.reference||null,before:{...before},after:{...after},delta,present});
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
const api={balance,project,reconcile,audit};root.MotorNoteInventoryEngine=api;if(typeof module!=="undefined")module.exports=api;
})(typeof globalThis!=="undefined"?globalThis:this);
