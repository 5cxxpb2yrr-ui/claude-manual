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
const api={barcode,matches,applyBarcode,receiptFile,duplicateReceipt,scanImage};root.MotorNoteCapture=api;if(typeof module!=="undefined")module.exports=api;
})(typeof globalThis!=="undefined"?globalThis:this);
