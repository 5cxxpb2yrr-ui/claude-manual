/* Local receipt and barcode intake. No remote uploads or automatic stock changes. */
(function(root){
"use strict";
function barcode(value){
 const s=String(value??"").trim();
 if(!s||s.length>128||/[\x00-\x1f\x7f]/.test(s))throw Error("Enter a valid barcode value.");
 return s;
}
function matches(value,inventory=[]){const code=barcode(value);return inventory.filter(p=>String(p.barcode||"").trim()===code||(Array.isArray(p.barcodes)&&p.barcodes.some(b=>String(b).trim()===code)));}
function applyBarcode(value,line,inventory=[]){
 const code=barcode(value),found=matches(code,inventory);
 if(found.length>1)throw Error("Barcode matches multiple stock records. Resolve the duplicate before linking.");
 if(!found.length)return {...line,barcode:code,inventoryId:""};
 const p=found[0];return {...line,barcode:code,inventoryId:String(p.id),description:p.description||line.description,partNumber:p.partNumber||"",unit:p.unit||"each",vehicleCompatibility:p.vehicleCompatibility||"Not verified"};
}
async function receiptFile(file){
 if(!file||file.size<=0||file.size>2*1024*1024)throw Error("Choose a nonempty receipt file up to 2 MB.");
 const allowed=["application/pdf","image/jpeg","image/png","image/webp","image/heic","image/heif","text/plain","text/csv","text/tab-separated-values"];
 const ext={pdf:"application/pdf",jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",webp:"image/webp",heic:"image/heic",heif:"image/heif",txt:"text/plain",csv:"text/csv",tsv:"text/tab-separated-values"};
 const type=file.type||ext[String(file.name).split(".").pop().toLowerCase()];
 if(!allowed.includes(type))throw Error("Unsupported receipt format.");
 const bytes=new Uint8Array(await file.arrayBuffer());
 if(bytes.length!==file.size)throw Error("Receipt file could not be read completely.");
 if(!root.crypto?.subtle)throw Error("Secure receipt hashing is unavailable in this browser.");
 const hash=Array.from(new Uint8Array(await root.crypto.subtle.digest("SHA-256",bytes)),b=>b.toString(16).padStart(2,"0")).join("");
 let binary="";for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
 return {name:String(file.name||"receipt"),type,size:bytes.length,sha256:hash,base64:root.btoa(binary)};
}
function duplicateReceipt(receipt,orders=[]){return !!receipt?.sha256&&orders.some(o=>o.receiptSource?.sha256===receipt.sha256);}
async function scanImage(file){
 if(typeof root.BarcodeDetector!=="function"||typeof root.createImageBitmap!=="function")throw Error("Image barcode recognition is unavailable here. Use the iPhone scanner or enter the barcode manually.");
 const bitmap=await root.createImageBitmap(file);
 try{const detector=new root.BarcodeDetector();const results=await detector.detect(bitmap);const values=[...new Set(results.map(r=>barcode(r.rawValue)))];if(values.length!==1)throw Error(values.length?"Multiple barcodes found. Capture a single label.":"No barcode found. Enter it manually.");return values[0];}finally{bitmap.close?.();}
}

function parseAmazonText(text){
 const raw=String(text||""),flat=raw.replace(/\s+/g," ").trim();
 const order=flat.match(/Order\s*#\s*(\d{3}-\d{7}-\d{7})/i),placed=flat.match(/Order placed\s+([A-Za-z]+\s+\d{1,2},\s+\d{4})/i);
 if(!order||!placed)throw Error("Receipt format not recognized. Enter reviewed item details manually.");
 const d=new Date(placed[1]+" UTC");if(!Number.isFinite(d.getTime()))throw Error("Check order date.");
 const money=label=>{const m=flat.match(new RegExp(label+"\\s*:?\\s*(-?\\$[\\d,]+\\.\\d{2})","i"));return m?Number(m[1].replace(/[$,]/g,"")):null;};
 const subtotal=money("Item\\(s\\) Subtotal"),shipping=money("Shipping & Handling"),discount=money("Subscribe & Save"),tax=money("Estimated tax to be collected"),total=money("Grand Total");
 const matches=[...flat.matchAll(/\b(?:Arriving\s+(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday|tomorrow|today)|Delivered\s+[A-Za-z]+\s+\d{1,2})\s+(.{3,500}?)\s+Sold by:\s*([^$]{1,200}?)\s*(\$[\d,]+\.\d{2})/gi)];
 if(matches.length!==1||(flat.match(/Sold by:/gi)||[]).length!==1)throw Error("Order recognized; item layout requires manual review.");
 const m=matches[0],name=m[1].trim(),price=Number(m[3].replace(/[$,]/g,""));
 if(subtotal===null||Math.abs(price-subtotal)>.005)throw Error("Item price and subtotal do not reconcile. Enter reviewed quantities.");
 const mpn=name.match(/\bWIX\s+(\d{4,}[A-Z0-9]*)\b/i);
 return {vendor:"Amazon",orderNumber:order[1],orderedDate:d.toISOString().slice(0,10),lines:[{description:name,partNumber:mpn?.[1]||"",quantity:1,unitCost:price,unit:"each",vehicleCompatibility:"Not verified",inventoryId:"",demandKey:"",barcode:""}],receiptTotals:{subtotal,shipping,discount,tax,total},notice:"Review inferred quantity of one, fitment, discounts and totals. Order is not received."};
}

function detectReceiptVendor(text){
 const header=String(text||"").split(/\r?\n/).slice(0,12).join(" ");
 const vendors=[["AutoZone",/\bauto\s*zone\b/i],["O'Reilly Auto Parts",/\bo[’']?\s*reilly(?:\s+auto\s+parts)?\b/i],["Advance Auto Parts",/\badvance\s+auto\s+parts\b/i],["NAPA Auto Parts",/\bnapa(?:\s+auto\s+parts)?\b/i]];
 const hits=vendors.filter(([,pattern])=>pattern.test(header));
 if(hits.length===1)return hits[0][0];
 if(/\bOrder\s*#\s*\d{3}-\d{7}-\d{7}\b/i.test(text)&&/\bOrder placed\b/i.test(text))return "Amazon";
 return "";
}
function parseRetailText(text){
 const raw=String(text||"").slice(0,50000),rows=raw.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
 const vendor=detectReceiptVendor(raw);
 if(!vendor||vendor==="Amazon")throw Error("Retailer not recognized. Enter reviewed item details manually.");
 if(/\b(?:return receipt|refund|exchange|credit memo|void|core charge|core deposit|core return)\b/i.test(raw))throw Error("Return, exchange or core-charge receipt needs manual review.");
 const unique=(pattern,label)=>{
  const matches=rows.map(row=>row.match(pattern)).filter(Boolean).map(m=>m[1]);
  const values=[...new Set(matches)];
  if(values.length>1)throw Error("Multiple "+label+" values. Review manually.");
  return values[0]??null;
 };
 const receipt=unique(/^(?:receipt|invoice|order|transaction)(?:\s*(?:number|no\.?|#))?\s*[:#]?\s+([A-Z0-9][A-Z0-9-]{2,39})$/i,"receipt numbers");
 const store=unique(/^store\s*(?:number|no\.?|#)\s*[:#]?\s*(\d{1,8})$/i,"store numbers");
 const date=unique(/^(?:date|purchase date|transaction date)\s*:\s*(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})(?:\s+\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)?$/i,"dates");
 if(!receipt||!store||!date)throw Error(vendor+" recognized. Confirm store number, receipt number and full date before importing items.");
 const pieces=date.includes("/")?date.split("/").map(Number):date.split("-").map(Number);
 const [year,month,day]=date.includes("/")?[pieces[2],pieces[0],pieces[1]]:pieces;
 const d=new Date(Date.UTC(year,month-1,day));
 if(year<2000||year>2100||d.getUTCFullYear()!==year||d.getUTCMonth()!==month-1||d.getUTCDate()!==day)throw Error("Invalid receipt date. Review manually.");
 const cents=s=>Math.round(Number(s.replace(/[$,]/g,""))*100);
 const money=(pattern,label)=>{const v=unique(pattern,label);return v===null?null:cents(v);};
 const subtotal=money(/^(?:sub\s*total|merchandise subtotal)\s*:?\s*(\$?[\d,]+\.\d{2})$/i,"subtotals");
 const tax=money(/^(?:sales tax|tax)\s*:?\s*(\$?[\d,]+\.\d{2})$/i,"tax amounts");
 const shipping=money(/^shipping(?:\s*&\s*handling)?\s*:?\s*(\$?[\d,]+\.\d{2})$/i,"shipping amounts");
 const discount=money(/^(?:discount|total discount|coupon)\s*:?\s*(-\$?[\d,]+\.\d{2})$/i,"discount amounts");
 const total=money(/^(?:grand total|total|total sale|amount due)\s*:?\s*(\$?[\d,]+\.\d{2})$/i,"totals");
 if(subtotal===null||tax===null||total===null)throw Error("Receipt subtotal, tax and total must be readable before item extraction.");
 if(/\b(?:discount|coupon|savings|promotion)\b/i.test(raw)&&discount===null)throw Error("Discount amount is ambiguous. Review manually.");
 if(subtotal+(shipping??0)+(discount??0)+tax!==total)throw Error("Printed subtotal, tax, discounts and total do not reconcile.");
 // Narrow, explicitly labeled item grammar. Never infer quantity or convert retailer SKU to MPN.
 const items=[];
 for(let i=0;i<rows.length;i++){
  const row=rows[i];
  const item=row.match(/^(?:item|sku|part(?:\s*(?:number|no\.?|#))?)\s*[:#]?\s+([A-Z0-9][A-Z0-9-]{1,39})\s+(.{2,160})$/i);
  if(!item)continue;
  const amounts=rows[i+1]?.match(/^(?:qty|quantity)\s*:?\s*(\d{1,4})\s+(?:@|x|unit(?:\s+price)?\s*:?)\s*(\$?[\d,]+\.\d{2})\s+(?:=|ext(?:ended)?\s*:?)\s*(\$?[\d,]+\.\d{2})$/i);
  if(!amounts)throw Error("Item quantity or unit price is not explicit. Review manually.");
  const qty=Number(amounts[1]),price=cents(amounts[2]),extension=cents(amounts[3]);
  if(qty<1||qty*price!==extension)throw Error("Item extension does not match quantity times unit price.");
  items.push({description:item[2],partNumber:"",retailerItemCode:item[1],quantity:qty,unitCost:price/100,unit:"each",vehicleCompatibility:"Not verified",inventoryId:"",demandKey:"",barcode:""});
  i++;
 }
 if(!items.length||items.length>100||items.reduce((n,x)=>n+Math.round(x.unitCost*100)*x.quantity,0)!==subtotal)throw Error("Item rows do not reconcile with subtotal. Review recognized text and enter items manually.");
 if(/\b(?:qty|quantity)\b/i.test(raw)&&rows.filter(row=>/^(?:qty|quantity)\b/i.test(row)).length!==items.length)throw Error("Unmatched quantity rows. Review manually.");
 const amount=n=>n===null?null:n/100;
 return {vendor,orderNumber:"store-"+store+"-"+d.toISOString().slice(0,10)+"-"+receipt,orderedDate:d.toISOString().slice(0,10),lines:items,receiptTotals:{subtotal:amount(subtotal),shipping:amount(shipping),discount:amount(discount),tax:amount(tax),total:amount(total)},notice:"Review all extracted rows against the receipt. Retailer item codes are not verified manufacturer part numbers. No stock has been received."};
}
function parseReceiptText(text){
 const vendor=detectReceiptVendor(text);
 if(vendor==="Amazon")return parseAmazonText(text);
 if(vendor)return parseRetailText(text);
 throw Error("Receipt layout not recognized. Review the text and enter item details manually.");
}

const OCR_BASE="/receipt-ocr-v6/";
let ocrScript;
async function loadOcr(){
 if(root.Tesseract?.createWorker)return root.Tesseract;
 if(!ocrScript)ocrScript=new Promise((resolve,reject)=>{
 const script=root.document.createElement("script");script.src=OCR_BASE+"tesseract.min.js";
 script.onload=()=>root.Tesseract?.createWorker?resolve(root.Tesseract):reject(Error("OCR engine did not initialize."));
 script.onerror=()=>reject(Error("OCR unavailable. Paste iPhone Live Text or enter details manually."));
 root.document.head.appendChild(script);
 }).catch(e=>{ocrScript=null;throw e;});
 return ocrScript;
}
async function createReceiptOcr(progress=()=>{}){
 const engine=await loadOcr(),base=new URL(OCR_BASE,root.location.origin).href;
 const worker=await engine.createWorker("eng",1,{workerPath:base+"worker.min.js",corePath:base+"tesseract-core-lstm.wasm.js",langPath:base.slice(0,-1),workerBlobURL:false,logger:m=>progress(m.status+(Number.isFinite(m.progress)?" "+Math.round(m.progress*100)+"%":""))});
 return {async read(image){const r=await worker.recognize(image);return {text:String(r.data.text||""),confidence:Number.isFinite(r.data.confidence)?r.data.confidence:null};},close:()=>worker.terminate()};
}
async function extractImageText(file,progress=()=>{}){
 const url=root.URL.createObjectURL(file);let canvas,ocr;
 try{
 const image=await new Promise((resolve,reject)=>{const img=new root.Image();img.onload=()=>resolve(img);img.onerror=()=>reject(Error("Image cannot be decoded. Try JPEG or PNG."));img.src=url;});
 const w=image.naturalWidth,h=image.naturalHeight,scale=Math.min(1,2600/Math.max(w,h),Math.sqrt(5000000/(w*h)));
 canvas=root.document.createElement("canvas");canvas.width=Math.max(1,Math.round(w*scale));canvas.height=Math.max(1,Math.round(h*scale));
 const ctx=canvas.getContext("2d");ctx.fillStyle="#fff";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
 ocr=await createReceiptOcr(progress);const result=await ocr.read(canvas);if(!result.text.trim())throw Error("No readable text. Try a clearer photo.");return result;
 }finally{if(canvas){canvas.width=0;canvas.height=0;}root.URL.revokeObjectURL(url);if(ocr)await ocr.close();}
}
async function extractPdfText(file,progress=()=>{}){
 const pdf=await import("/api/receipt-pdf/4.10.38/pdf.mjs");
 pdf.GlobalWorkerOptions.workerSrc="/api/receipt-pdf/4.10.38/pdf.worker.mjs";
 const task=pdf.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false});
 let ocr,scans=0;
 try{const doc=await task.promise;if(doc.numPages>20)throw Error("Receipt exceeds 20 pages.");const pages=[];
 for(let n=1;n<=doc.numPages;n++){const page=await doc.getPage(n),content=await page.getTextContent(),embedded=content.items.map(item=>(item.str||"")+(item.hasEOL?"\n":" ")).join("");
 if(embedded.trim().length>=30){pages.push(embedded);continue;}
 if(++scans>5)throw Error("Scanned receipt limit is five pages. Split the file or paste text manually.");
 progress("Reading scanned page "+n+" of "+doc.numPages);
 const view=page.getViewport({scale:1}),scale=Math.min(2.5,2600/Math.max(view.width,view.height),Math.sqrt(5000000/(view.width*view.height))),viewport=page.getViewport({scale});
 const canvas=root.document.createElement("canvas");canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
 try{await page.render({canvasContext:canvas.getContext("2d"),viewport}).promise;if(!ocr)ocr=await createReceiptOcr(progress);const result=await ocr.read(canvas);pages.push(result.text||embedded);}finally{canvas.width=0;canvas.height=0;}}
 const text=pages.join("\n");if(!text.trim())throw Error("No readable receipt text.");return text;
 }finally{try{if(ocr)await ocr.close();}finally{await task.destroy();}}
}

const matchKey=v=>String(v??"").trim().toLowerCase();
const partKey=v=>matchKey(v).replace(/[^a-z0-9]/g,"");
const descriptionKey=v=>matchKey(v).replace(/[^a-z0-9]+/g," ").trim();
const fitment=v=>String(v||"Not verified");
const verified=v=>fitment(v)!=="Not verified"&&!!v;
function suggestMatches(line,{inventory=[],demand=[],vehicles=[],orders=[],vendor=""}={}){
 const code=String(line.barcode||"").trim(),mpn=partKey(line.partNumber),desc=descriptionKey(line.description),sku=matchKey(line.retailerItemCode),unit=matchKey(line.unit||"each"),quantity=Number(line.quantity);
 const history=sku&&matchKey(vendor)?orders.filter(o=>matchKey(o.vendor)===matchKey(vendor)&&["Received","Partially received"].includes(o.status)).flatMap(o=>(o.lines||[]).filter(l=>matchKey(l.retailerItemCode)===sku&&Number(l.receivedQuantity)>0&&l.inventoryId!=null)):[];
 const historyIds=new Set(history.map(l=>String(l.inventoryId)));
 const stock=[];
 for(const item of inventory){
  const itemCode=String(item.barcode||"").trim(),aliases=(item.barcodes||[]).map(x=>String(x).trim()),number=partKey(item.partNumber);
  const barcodeMatch=!!code&&(itemCode===code||aliases.includes(code)),partMatch=!!mpn&&mpn===number,historyMatch=historyIds.has(String(item.id)),descriptionMatch=!!desc&&desc===descriptionKey(item.description);
  if(!barcodeMatch&&!partMatch&&!historyMatch&&!descriptionMatch)continue;
  const evidence=barcodeMatch?"Exact barcode":partMatch?"Exact manufacturer number":historyMatch?"Prior received retailer item":"Exact description only";
  const conflicts=[];
  if(code&&(itemCode||aliases.length)&&!barcodeMatch)conflicts.push("Different barcode");
  if(mpn&&number!==mpn)conflicts.push("Different or missing manufacturer number");
  if(unit!==matchKey(item.unit||"each"))conflicts.push("Different unit");
  if(verified(line.vehicleCompatibility)&&fitment(item.vehicleCompatibility)!==fitment(line.vehicleCompatibility))conflicts.push("Different fitment");
  if(historyMatch&&historyIds.size>1)conflicts.push("Retailer code has multiple stock links");
  const eligible=(barcodeMatch||partMatch||historyMatch)&&!conflicts.length&&verified(line.vehicleCompatibility)&&fitment(item.vehicleCompatibility)===fitment(line.vehicleCompatibility);
  stock.push({id:String(item.id),description:item.description||"Stock item",partNumber:item.partNumber||"",vehicleCompatibility:fitment(item.vehicleCompatibility),quantity:Number(item.quantity)||0,available:Math.max(0,(Number(item.quantity)||0)-(Number(item.reservedQuantity)||0)),evidence,rank:barcodeMatch?4:partMatch?3:historyMatch?2:1,conflicts,eligible});
 }
 stock.sort((a,b)=>Number(b.eligible)-Number(a.eligible)||b.rank-a.rank||a.id.localeCompare(b.id));
 const requirements=[];
 for(const row of demand){
  if(!(Number(row.shortage)>0))continue;
  const number=partKey(row.partNumber),partMatch=!!mpn&&mpn===number,descriptionMatch=!!desc&&desc===descriptionKey(row.name),linked=!!line.inventoryId&&String(row.inventoryId??"")===String(line.inventoryId);
  if(!partMatch&&!descriptionMatch&&!linked)continue;
  const vehicle=vehicles.find(v=>String(v.id)===String(row.vehicleId)),conflicts=[];
  if(number&&number!==mpn)conflicts.push("Confirm required manufacturer number");
  if(!vehicle||!verified(line.vehicleCompatibility)||![vehicle.name,"Universal"].includes(line.vehicleCompatibility))conflicts.push("Confirm vehicle fitment");
  if(row.unit!=="recorded unit"&&unit!==matchKey(row.unit))conflicts.push("Different unit");
  if(!Number.isFinite(quantity)||quantity<=0||quantity>Number(row.shortage))conflicts.push("Quantity exceeds shortage or is invalid");
  const eligible=!conflicts.length&&(partMatch||linked);
  requirements.push({key:row.key,name:row.name,source:row.source,vehicleName:vehicle?.name||"Unknown vehicle",shortage:Number(row.shortage),evidence:partMatch?"Exact manufacturer number":linked?"Linked stock ID":"Exact description only",conflicts,eligible,rank:partMatch?3:linked?2:1});
 }
 requirements.sort((a,b)=>Number(b.eligible)-Number(a.eligible)||b.rank-a.rank||String(a.key).localeCompare(String(b.key)));
 return {stock,requirements,duplicateWarning:stock.filter(s=>s.rank>=2&&!s.conflicts.length).length>1};
}

const api={suggestMatches,parseAmazonText,detectReceiptVendor,parseRetailText,parseReceiptText,extractPdfText,extractImageText,barcode,matches,applyBarcode,receiptFile,duplicateReceipt,scanImage};root.MotorNoteCapture=api;if(typeof module!=="undefined")module.exports=api;
})(typeof globalThis!=="undefined"?globalThis:this);
