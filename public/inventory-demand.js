/* Read-only demand forecast. Allocations are projections, never stock mutations. */
(function(root){
"use strict";
const active=p=>! /^(completed|cancelled|canceled|archived)$/i.test(p?.status||"");
const positive=v=>Math.max(0,Number(v)||0);
const norm=v=>String(v||"").toLowerCase().replace(/[^a-z0-9]/g,"");
const same=(a,b)=>a!=null&&b!=null&&String(a)===String(b);
const day=(v,now)=>{if(!v)return null;const t=new Date(v).getTime();return Number.isFinite(t)?Math.max(0,Math.ceil((t-now)/86400000)):null;};
const terminal=r=>r.used||/^(used|installed|cancelled|canceled)(?:\b|$)/i.test(r.status||"");
function forecast({inventory=[],vehicles=[],projects=[],maintenancePlans=[],predictions=[],horizon=20,now=Date.now()}={}){
 const stock=inventory.map(p=>({p,free:Math.max(0,positive(p.quantity)-positive(p.reservedQuantity)),reserved:Math.min(positive(p.quantity),positive(p.reservedQuantity)),legacy:0}));
 const liveProjects=projects.filter(active),livePlans=maintenancePlans.filter(active);
 const byVehicle=id=>vehicles.find(v=>same(v.id,id));
 const linked=p=>liveProjects.find(x=>same(x.id,p.projectId)||same(x.maintenancePlanId,p.id));
 const canonicalProject=p=>!!(linked(p)?.partRequirements||[]).length;
 // Old standalone maintenance reservations do not update reservedQuantity. Protect them before allocating.
 for(const plan of livePlans){
  if(canonicalProject(plan))continue;
  for(const r of plan.parts||[])if(r.reserved&&!terminal(r)){
   const s=stock.find(s=>same(s.p.id,r.inventoryId));if(s){const n=Math.min(s.free,positive(r.quantity));s.free-=n;s.legacy+=n;}
  }
 }
 const reqs=[],reviews=[];
 function add(r,meta){
  if(terminal(r))return;
  const quantity=Number(r.quantity);
  if(!Number.isFinite(quantity)||quantity<=0){reviews.push({...meta,key:meta.key,name:r.description||r.partNumber||"Requirement",reason:"Confirm required quantity and unit"});return;}
  reqs.push({...meta,r,name:r.description||r.partNumber||"Unnamed requirement",quantity});
 }
 for(const p of liveProjects)for(const [i,r] of (p.partRequirements||[]).entries())add(r,{key:"project:"+p.id+":"+(r.id??i),kind:"project",source:p.title||"Project",projectId:p.id,vehicleId:p.vehicleId,days:0,orders:p.purchaseOrders||[]});
 for(const plan of livePlans){
  if(canonicalProject(plan))continue; // project is the canonical source for linked work
  const pred=predictions.find(x=>same(x.vehicleId,plan.vehicleId)&&same(x.id,plan.scheduleId));
  const days=plan.status==="In Progress"?0:Math.min(day(plan.targetDate,now)??Infinity,pred?.status==="Red"?0:pred?.remainingDays??Infinity);
  if(days>horizon)continue;
  for(const [i,r] of (plan.parts||[]).entries())add(r,{key:"maintenance:"+plan.id+":"+(r.id??i),kind:"maintenance",source:plan.title||"Maintenance",vehicleId:plan.vehicleId,days:Math.max(0,days),planId:plan.id,orders:[]});
 }
 // Explicit plans take precedence over generic scheduled demand. Only known quantities are forecast.
 for(const pred of predictions){
  const days=pred.status==="Red"?0:Number(pred.remainingDays);
  if(pred.remainingDays==null&&pred.status!=="Red"||!Number.isFinite(days)||days>horizon)continue;
  const v=byVehicle(pred.vehicleId);if(!v)continue;
  const plan=livePlans.find(p=>same(p.vehicleId,pred.vehicleId)&&same(p.scheduleId,pred.id));
  if(plan&&((linked(plan)?.partRequirements||[]).length||(plan.parts||[]).length))continue;
  const meta={key:"schedule:"+v.id+":"+pred.id,kind:"schedule",source:pred.serviceName||"Scheduled maintenance",vehicleId:v.id,days:Math.max(0,days),orders:[],estimated:true};
  switch(pred.id){
   case "oil":case "subaru_oil":
    add({description:"Engine oil filter",partNumber:v.oilFilter||"",quantity:1},meta);
    reviews.push({...meta,key:meta.key+":oil",name:"Engine oil",reason:"Confirm oil specification, container units and required quantity"});break;
   case "air_filter":case "subaru_air_filter":
    add({description:"Engine air filter",quantity:1},meta);break;
   case "cabin_filter":case "subaru_cabin_filter":
    add({description:"Cabin air filter",quantity:1},meta);break;
   case "spark_plugs":case "subaru_spark_plugs":case "trans_fluid":case "subaru_brake_fluid":case "subaru_fuel_filter":
    reviews.push({...meta,name:pred.serviceName,reason:"Confirm service parts, fitment and quantities"});break;
   default:break; // inspections alone do not imply purchases
  }
 }
 const compatible=(p,v)=>!!v&&(p.vehicleCompatibility==="Universal"||p.vehicleCompatibility===v.name||same(p.vehicleId,v.id));
 function matches(s,d){
  const r=d.r,p=s.p,v=byVehicle(d.vehicleId);
  if(r.inventoryId!=null&&String(r.inventoryId)!=="")return same(p.id,r.inventoryId);
  if(!compatible(p,v))return false;
  const pn=norm(r.partNumber);if(pn)return pn===norm(p.partNumber);
  return !!norm(r.description)&&norm(r.description)===norm(p.description);
 }
 // Allocate explicitly reserved stock before free stock. Prevent double counting across work.
 reqs.sort((a,b)=>Number(!!b.r.reserved)-Number(!!a.r.reserved)||a.days-b.days||Number(b.r.inventoryId!=null)-Number(a.r.inventoryId!=null)||a.key.localeCompare(b.key));
 const rows=[];
 for(const d of reqs){
  const r=d.r,qty=d.quantity,candidates=stock.filter(s=>matches(s,d)),allocations=[];
  let reserved=0,onHand=0,incoming=0,received=0,remaining=qty;
  if(r.reserved&&r.inventoryId!=null){
   const s=candidates[0],pool=d.kind==="maintenance"?"legacy":"reserved";
   if(s){reserved=Math.min(remaining,s[pool]);s[pool]-=reserved;remaining-=reserved;if(reserved)allocations.push({itemId:s.p.id,quantity:reserved,kind:"reserved"});}
  }
  // Orders are scoped to the original requirement, not reused for unrelated jobs.
  for(const o of d.orders||[]){
   if(!/^(ordered|backordered|on order|received)$/i.test(o.status||""))continue;
   for(const line of o.lines||[])if(same(line.requirementId,r.id)){
    const n=Math.min(remaining,positive(line.quantity));
    if(/^received$/i.test(o.status)){
     if(!r.inventoryAddedAt&&!r.inventoryId){received+=n;remaining-=n;}
    }else{incoming+=n;remaining-=n;}
   }
  }
  for(const s of candidates){
   const n=Math.min(remaining,s.free);if(n){s.free-=n;onHand+=n;remaining-=n;allocations.push({itemId:s.p.id,quantity:n,kind:"available"});}
   if(remaining<=0)break;
  }
  const {r:ignored,orders:ignoredOrders,...meta}=d;
  rows.push({...meta,partNumber:r.partNumber||"",unit:r.unit||"recorded unit",reserved,onHand,incoming,received,shortage:Math.max(0,remaining),allocations,needsReview:!!d.estimated||r.relationship==="candidate"||!candidates.length,reason:remaining>0?"Uncovered requirement":incoming||received?"Awaiting delivery or stock entry":"Stock match — confirm fitment"});
 }
 return {rows,reviews,shortages:rows.filter(r=>r.shortage>0),covered:rows.filter(r=>r.shortage===0),horizon};
}
const api={forecast};root.MotorNoteDemandEngine=api;if(typeof module!=="undefined")module.exports=api;
})(typeof globalThis!=="undefined"?globalThis:this);
