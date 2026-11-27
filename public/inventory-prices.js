/* V8: historical purchasing intelligence; read-only, no live quotes. */
(function(root){
"use strict";
const norm=v=>String(v??"").trim().toLowerCase();
const part=v=>norm(v).replace(/[^a-z0-9]/g,"");
const num=v=>v!==null&&v!==undefined&&String(v).trim()!==""&&Number.isFinite(Number(v))?Number(v):null;
const day=v=>{const s=String(v||"").slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(s)&&Number.isFinite(Date.parse(s))?s:"";};
const key=(id,unit)=>JSON.stringify([id,norm(unit||"each")]);
function analyze({orders=[],inventory=[],shopping=[],now=new Date().toISOString()}={}){
 const products=new Map(),vendors=new Map(),seen=new Set(),stock=new Map(inventory.map(p=>[String(p.id),p]));
 for(const o of orders){
  if(!o?.id||seen.has(String(o.id))||!["Ordered","Partially received","Received"].includes(o.status))continue;
  seen.add(String(o.id));const supplier=String(o.vendor||"").trim(),vk=norm(supplier);if(!vk)continue;
  let v=vendors.get(vk);if(!v){v={key:vk,name:supplier,orders:0,completed:0,open:0,receivedValue:0,orderedValue:0,timed:0,onTime:0};vendors.set(vk,v);}
  v.orders++;if(o.status==="Received")v.completed++;else v.open++;
  const dated=(o.receipts||[]).map(r=>day(r.timestamp)).filter(Boolean).sort(),due=day(o.expectedDate);
  if(o.status==="Received"&&due&&dated.length){v.timed++;if(dated.at(-1)<=due)v.onTime++;}
  for(const l of o.lines||[]){
   const price=num(l.unitCost),qty=num(l.quantity),received=num(l.receivedQuantity);
   if(price===null||price<0||qty===null||qty<=0)continue;
   v.orderedValue+=price*qty;
   if(received===null||received<=0||received>qty)continue;
   v.receivedValue+=price*received;
   const p=stock.get(String(l.inventoryId)),pn=part(l.partNumber),barcode=String(l.barcode||"").trim(),unit=norm(l.unit||"each"),fit=norm(l.vehicleCompatibility);
   // Never pool unverified fitment or description-only records across products.
   const verified=fit&&fit!=="not verified";
   const identity=verified&&pn?JSON.stringify(["part",pn,fit]):verified&&barcode?JSON.stringify(["barcode",barcode,fit]):l.inventoryId!=null&&String(l.inventoryId)!==""?JSON.stringify(["stock",String(l.inventoryId)]):JSON.stringify(["line",String(o.id),String(l.id)]);
   const k=key(identity,unit);
   let g=products.get(k);if(!g){g={key:k,name:l.description||p?.description||"Item",partNumber:l.partNumber||"",fitment:l.vehicleCompatibility||"Not verified",unit,observations:[],stockIds:[]};products.set(k,g);}
   if(l.inventoryId!=null&&!g.stockIds.includes(String(l.inventoryId)))g.stockIds.push(String(l.inventoryId));
   g.observations.push({orderId:o.id,lineId:l.id,supplier,vendorKey:vk,date:day(o.orderedDate),price,quantity:received});
  }
 }
 const rows=[...products.values()].map(g=>{
  const obs=g.observations.slice().sort((a,b)=>b.date.localeCompare(a.date)),dated=obs.filter(x=>x.date),latest=dated[0]||null,total=obs.reduce((s,x)=>s+x.quantity,0),average=obs.reduce((s,x)=>s+x.price*x.quantity,0)/total;
  const suppliers=[...new Set(obs.map(x=>x.vendorKey))].map(k=>{const list=obs.filter(x=>x.vendorKey===k),last=list.find(x=>x.date)||null;return {key:k,name:list[0].supplier,count:list.length,latest:last,low:Math.min(...list.map(x=>x.price))};}).sort((a,b)=>(a.latest?.price??Infinity)-(b.latest?.price??Infinity));
  return {...g,observations:obs,latest,average,low:Math.min(...obs.map(x=>x.price)),high:Math.max(...obs.map(x=>x.price)),suppliers};
 }).sort((a,b)=>a.name.localeCompare(b.name));
 const recommendations=shopping.map(item=>{
  const pn=part(item.partNumber),fit=norm(item.vehicleName),unit=norm(item.unit);
  const candidates=pn&&fit&&unit&&unit!=="recorded unit"?rows.filter(r=>part(r.partNumber)===pn&&[fit,"universal"].includes(norm(r.fitment))&&r.unit===unit):[];
  const exact=candidates.length===1?candidates[0]:null;
  const cutoff=Date.parse(day(now))-90*86400000;
  const recent=exact?.suppliers.filter(s=>s.latest&&Date.parse(s.latest.date)>=cutoff&&Date.parse(s.latest.date)<=Date.parse(day(now)))||[];
  const best=recent[0],latest=exact?.latest,quantity=num(item.quantity);
  const savings=best&&latest&&quantity>0&&Date.parse(latest.date)>=cutoff?Math.max(0,(latest.price-best.latest.price)*quantity):null;
  return {key:item.key,item,match:exact,supplier:best||null,estimatedSavings:savings,action:best?"Compare current quote":"Request quote"};
 });
 return {products:rows,suppliers:[...vendors.values()].sort((a,b)=>b.receivedValue-a.receivedValue),recommendations,observations:rows.reduce((s,r)=>s+r.observations.length,0)};
}
const api={analyze};root.MotorNotePriceIntelligence=api;if(typeof module!=="undefined")module.exports=api;
})(typeof globalThis!=="undefined"?globalThis:this);
