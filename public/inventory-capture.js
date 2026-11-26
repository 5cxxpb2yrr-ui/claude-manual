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
 for(let n=1;n<=doc.numPages;n++){const page=await doc.getPage(n),content=await page.getTextContent(),embedded=content.items.map(item=>item.str||"").join(" ");
 if(embedded.trim().length>=30){pages.push(embedded);continue;}
 if(++scans>5)throw Error("Scanned receipt limit is five pages. Split the file or paste text manually.");
 progress("Reading scanned page "+n+" of "+doc.numPages);
 const view=page.getViewport({scale:1}),scale=Math.min(2.5,2600/Math.max(view.width,view.height),Math.sqrt(5000000/(view.width*view.height))),viewport=page.getViewport({scale});
 const canvas=root.document.createElement("canvas");canvas.width=Math.ceil(viewport.width);canvas.height=Math.ceil(viewport.height);
 try{await page.render({canvasContext:canvas.getContext("2d"),viewport}).promise;if(!ocr)ocr=await createReceiptOcr(progress);const result=await ocr.read(canvas);pages.push(result.text||embedded);}finally{canvas.width=0;canvas.height=0;}}
 const text=pages.join("\n");if(!text.trim())throw Error("No readable receipt text.");return text;
 }finally{try{if(ocr)await ocr.close();}finally{await task.destroy();}}
}
const api={parseAmazonText,extractPdfText,extractImageText,barcode,matches,applyBarcode,receiptFile,duplicateReceipt,scanImage};root.MotorNoteCapture=api;if(typeof module!=="undefined")module.exports=api;
})(typeof globalThis!=="undefined"?globalThis:this);
