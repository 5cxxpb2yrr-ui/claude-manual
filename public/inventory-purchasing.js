/* Local vendor-neutral order/receipt intake; no retailer account access. */
(function(root){
"use strict";
const norm=v=>String(v||"").trim().toLowerCase(),pn=v=>norm(v).replace(/[^a-z0-9]/g,""),same=(a,b)=>a!=null&&b!=null&&String(a)===String(b);
const clone=v=>JSON.parse(JSON.stringify(v));
function parseRows(text){
 const rows=[];let row=[],cell="",quoted=false;
 const delimiter=String(text).includes("\t")?"\t":",";
 const raw=String(text||"").replace(/\r\n/g,"\n").trim();
 for(let i=0;i<raw.length;i++){const c=raw[i];if(c==='"'){if(quoted&&raw[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(c===delimiter&&!quoted){row.push(cell.trim());cell="";}else if(c==="\n"&&!quoted){row.push(cell.trim());if(row.some(Boolean))rows.push(row);row=[];cell="";}else cell+=c;}
 if(quoted)throw Error("Unclosed quoted field.");row.push(cell.trim());if(row.some(Boolean))rows.push(row);
 if(rows.length<2)throw Error("Paste a header row and at least one item.");
 const headers=rows.shift().map(h=>norm(h).replace(/[^a-z0-9]/g,""));
 const col=(r,...keys)=>{const i=headers.findIndex(h=>keys.includes(h));return i<0?"":r[i]||"";};
 if(!headers.some(h=>["description","item","product","title","name"].includes(h)))throw Error("Include a description column. Receipt layouts differ; copy the item rows into the supported format.");
 return rows.map(r=>({description:col(r,"description","item","product","title","name"),partNumber:col(r,"partnumber","mpn","partno"),quantity:col(r,"quantity","qty"),unitCost:col(r,"unitcost","unitprice","price").replace(/^\$/,""),unit:col(r,"unit")||"each",vehicleCompatibility:"",demandKey:"",inventoryId:"",receivedQuantity:0}));
}
function validateDraft(draft,orders=[],legacy=[]){
 const vendor=String(draft.vendor||"").trim(),orderNumber=String(draft.orderNumber||"").trim();
 if(!vendor||!orderNumber)throw Error("Enter vendor and order/receipt number to prevent duplicate imports.");
 if([...orders,...legacy].some(o=>norm(o.vendor)===norm(vendor)&&norm(o.orderNumber)===norm(orderNumber)))throw Error("This vendor order or receipt is already recorded. Open the existing order instead.");
 if(!draft.lines?.length)throw Error("Add at least one item.");
 const lines=draft.lines.map((l,i)=>{
  const description=String(l.description||"").trim(),quantity=Number(l.quantity),unitCost=Number(l.unitCost);
  if(!description||l.quantity===""||!Number.isFinite(quantity)||quantity<=0||l.unitCost===""||l.unitCost==null||!Number.isFinite(unitCost)||unitCost<0)throw Error("Line "+(i+1)+": confirm description, positive quantity and unit cost (0 if free).");
  if(!String(l.unit||"").trim())throw Error("Line "+(i+1)+": enter the unit.");
  if(!String(l.vehicleCompatibility||"").trim())throw Error("Line "+(i+1)+": choose fitment or Not verified.");
  return {id:"line-"+(i+1),description,partNumber:String(l.partNumber||"").trim(),quantity,unitCost,unit:String(l.unit).trim(),vehicleCompatibility:l.vehicleCompatibility,inventoryId:l.inventoryId||null,demandKey:l.demandKey||null,receivedQuantity:0};
 });
 return {vendor,orderNumber,orderedDate:draft.orderedDate||"",expectedDate:draft.expectedDate||"",status:"Ordered",lines};
}
function receive(order,inventory,amounts,now=new Date().toISOString()){
 if(!order||!["Ordered","Partially received"].includes(order.status))throw Error("Order is not open for receiving.");
 const next=clone(order),stock=clone(inventory),changed=[];
 for(const line of next.lines){
  const requested=amounts[line.id];if(requested==null||requested==="")continue;
  const n=Number(requested),remaining=Number(line.quantity)-Number(line.receivedQuantity||0);
  if(!Number.isFinite(n)||n<0||n>remaining)throw Error("Invalid receive quantity for "+line.description);
  if(!n)continue;
  let part=line.inventoryId?stock.find(p=>same(p.id,line.inventoryId)):null;
  if(line.inventoryId&&!part)throw Error("Linked stock item no longer exists: "+line.description);
  if(part&&(part.vehicleCompatibility||"Not verified")!==line.vehicleCompatibility)throw Error("Stock compatibility differs for "+line.description);
  if(part&&((pn(line.partNumber)&&pn(part.partNumber)!==pn(line.partNumber))||norm(part.unit||"each")!==norm(line.unit)))throw Error("Stock identity or unit differs for "+line.description);
  if(!part){
   const matches=stock.filter(p=>pn(line.partNumber)&&pn(p.partNumber)===pn(line.partNumber)&&p.vehicleCompatibility===line.vehicleCompatibility&&norm(p.unit||"each")===norm(line.unit));
   if(matches.length===1)part=matches[0];
  }
  if(!part){part={id:"receipt-"+order.id+"-"+line.id,description:line.description,partNumber:line.partNumber,vendor:order.vendor,quantity:0,reservedQuantity:0,unitCost:line.unitCost,unit:line.unit,vehicleCompatibility:line.vehicleCompatibility};if(stock.some(p=>same(p.id,part.id)))throw Error("Duplicate receipt stock identity.");stock.push(part);}
  const before=Number(part.quantity)||0;
  part.unitCost=(before*Number(part.unitCost||0)+n*line.unitCost)/(before+n);
  part.quantity=before+n;line.inventoryId=part.id;line.receivedQuantity=Number(line.receivedQuantity||0)+n;
  changed.push({lineId:line.id,itemId:part.id,quantity:n});
 }
 if(!changed.length)throw Error("Enter a quantity actually received.");
 next.status=next.lines.every(l=>Number(l.receivedQuantity)>=Number(l.quantity))?"Received":"Partially received";
 next.receipts=[...(next.receipts||[]),{timestamp:now,lines:changed}];
 return {order:next,inventory:stock,changed};
}
const api={parseRows,validateDraft,receive};root.MotorNotePurchasing=api;if(typeof module!=="undefined")module.exports=api;
})(typeof globalThis!=="undefined"?globalThis:this);
