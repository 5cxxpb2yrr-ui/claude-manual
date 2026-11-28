/* Read-only action projection; no writes, orders, diagnosis or automatic reservations. */
(function(root){
"use strict";
const list=v=>Array.isArray(v)?v:[];
const date=v=>typeof v==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v+"T00:00:00Z").toISOString().slice(0,10)===v?v:"";
const days=(a,b)=>Math.round((Date.parse(a)-Date.parse(b))/86400000);
const active=p=>!/^(completed|cancelled|canceled|archived)$/i.test(p.status||"");
function build(input={}){
 const today=date(input.today)||new Date().toISOString().slice(0,10),rows=[],seen=new Set();
 const add=(id,group,rank,title,detail,target,actionable=true)=>{
  if(seen.has(id))return;seen.add(id);rows.push({id,group,rank,title,detail,target,actionable});
 };
 for(const error of list(input.errors))add("error:"+error.section,"Review",100,"Check "+error.section,"Data unavailable — do not assume this section is clear.",{tab:"database"});
 if(input.integrity?.ledgerIssues?.length||input.integrity?.issues?.length)add("integrity","Review",98,"Review inventory integrity",((input.integrity.ledgerIssues||[]).length+(input.integrity.issues||[]).length)+" recorded issues",{tab:"inventory",view:"reconcile"});
 if(input.saveError)add("save-error","Review",110,"Resolve unsaved changes","Last save failed. Verify local data before continuing.",{tab:"database"});
 for(const p of list(input.projects).filter(active)){
  const target={tab:"projects",projectId:p.id},prefix=(p.vehicleName||"Vehicle not recorded")+" · ";
  if(p.findings>0)add("finding:"+p.id,"Review",95,"Resolve findings: "+p.title,prefix+p.findings+" open execution findings",target);
  const due=date(p.dueDate),overdue=due&&due<today,waiting=/waiting for parts/i.test(p.status||"");
  if(p.timerRunning)add("timer:"+p.id,"Execute",85,"Review running timer: "+p.title,prefix+"Work timer remains active",target);
  if(p.readiness&&!p.readiness.ready&&!p.readinessCompleted)add("prepare:"+p.id,"Execute",overdue?84:65,"Prepare "+p.title,prefix+(p.readiness.label||"Confirm checklist")+" · "+(p.readiness.next||"Review resources"),target);
  else if(waiting)add("waiting:"+p.id,"Waiting",overdue?82:45,"Check parts for "+p.title,prefix+(overdue?"Project due "+due:"Waiting for parts"),target);
  else add("project:"+p.id,"Execute",overdue?88:p.status==="In Progress"?76:50,"Continue "+p.title,prefix+(p.next||"Review project tasks"),target);
 }
 for(const p of list(input.predictions)){
  if(!p.hasHistory){add("unknown:"+p.vehicleId+":"+p.id,"Review",38,"Confirm service history: "+p.serviceName,(p.vehicleName||"Vehicle")+" · no matching service record",{tab:"predictive",vehicleId:p.vehicleId});continue;}
  if(!["Red","Orange","Yellow"].includes(p.status))continue;
  add("maintenance:"+p.vehicleId+":"+p.id,"Execute",p.status==="Red"?90:p.status==="Orange"?70:55,p.serviceName,(p.vehicleName||"Vehicle")+" · "+(p.status==="Red"?"Overdue": "Due soon")+(date(p.dueDateISO)?" · projected "+p.dueDateISO:""),{tab:"predictive",vehicleId:p.vehicleId});
 }
 for(const c of list(input.consumables)){
  const verb={refill:"Refill",replenish:"Replenish","verify-stock":"Check stock for","confirm-stock":"Confirm sufficient","waiting":"Check delivery for"}[c.state]||"Review";
  add("consumable:"+c.id,c.group,c.rank,verb+" "+c.name,c.location+" · "+(c.level==="empty"?"Empty":"Low")+" · "+(c.state==="waiting"?(c.overdue?"Delivery overdue":"Awaiting delivery"):c.available===null?"Stock unknown":c.available+" "+(c.unit||"")+" available"),{consumableId:c.id});
 }
 for(const o of list(input.orders)){
  // Preserve mixed orders and orders with unrelated lines. Only a vendor
  // order fully represented by explicit waiting consumable links is redundant.
  const remaining=list(o.lines).filter(l=>Number(l.quantity)>Number(l.receivedQuantity||0));
  const waiting=list(input.consumables).filter(c=>c.state==="waiting");
  if(String(o.key).startsWith("vendor:")&&remaining.length&&remaining.every(l=>l.consumableReportId&&waiting.some(c=>String(c.id)===String(l.consumableReportId)&&list(c.incoming).some(i=>i.explicit&&String(i.orderId)===String(o.id)&&String(i.lineId)===String(l.id)))))continue;
  const due=date(o.expectedDate),overdue=due&&due<today,now=due===today;
  add("order:"+o.key,"Waiting",overdue?86:now?72:40,"Check delivery: "+(o.vendor||"Supplier"),[o.orderNumber&&"#"+o.orderNumber,o.vehicleName,o.status,overdue?"Expected "+due+" · overdue":due?"Expected "+due:"No delivery date"].filter(Boolean).join(" · "),o.target||{tab:"inventory",view:"orders"});
 }
 if(input.forecast?.shortages?.length)add("shortages","Review",68,"Review inventory shortages",input.forecast.shortages.length+" uncovered requirements · confirm fitment and quantity",{tab:"inventory",view:"shopping"});
 if(input.forecast?.reviews?.length)add("demand-review","Review",52,"Confirm upcoming part requirements",input.forecast.reviews.length+" quantities or specifications to review",{tab:"inventory",view:"soon"});
 const reorder=list(input.storage?.reorder).filter(r=>Number(r.suggested)>0);
 if(reorder.length)add("reorder","Review",42,"Review low-stock recommendations",reorder.length+" stock records below configured targets after linked incoming orders",{tab:"inventory",view:"storage"});
 for(const t of list(input.tools)){
  const cal=date(t.calibrationDue),borrow=date(t.borrowDue),loan=date(t.custody?.due),state=t.custody?.status||"available";
  if(state==="returned")continue;
  const target={tab:"inventory",view:"tools"};
  if(cal&&days(cal,today)<=30)add("cal:"+t.id,"Review",cal<=today?89:54,"Review calibration: "+t.name,cal<=today?"Due / overdue · "+cal:"Due "+cal,target);
  if((t.ownership==="borrowed"&&borrow&&borrow<=today)||(state==="loaned"&&loan&&loan<=today))add("tool-return:"+t.id,"Execute",78,"Review tool return: "+t.name,"Return date reached · "+(state==="loaned"?loan:borrow),target);
  if(["loaned","checked-out"].includes(state))add("custody:"+t.id,"Waiting",30,t.name+" unavailable to other jobs",state==="loaned"?"Loaned out":"Checked out · "+(t.custody.holder||"Project"),target,false);
 }
 for(const p of list(input.projects).filter(active))if(p.unavailableTools>0)add("tools:"+p.id,"Review",64,"Confirm tool access: "+p.title,(p.vehicleName||"Vehicle")+" · "+p.unavailableTools+" unmatched or unavailable tool requirements",{tab:"projects",projectId:p.id});
 for(const h of list(input.history))if(h.repeatCount>0)add("history:"+h.vehicleId,"History",10,"Review repeat service records",(h.vehicleName||"Vehicle")+" · "+h.repeatCount+" repeated service titles; not a failure diagnosis",{tab:"repairs",vehicleId:h.vehicleId},false);
 rows.sort((a,b)=>b.rank-a.rank||a.id.localeCompare(b.id));
 const groups=["Execute","Review","Waiting","History"].map(name=>({name,rows:rows.filter(r=>r.group===name)}));
 return {next:rows.find(r=>r.actionable)||null,groups,consumables:rows.filter(r=>r.id.startsWith("consumable:")),actionCount:rows.filter(r=>r.actionable).length,incomplete:list(input.errors).length>0};
}
const api={build};root.MotorNoteMission=api;if(typeof module!=="undefined")module.exports=api;
})(typeof globalThis!=="undefined"?globalThis:this);
