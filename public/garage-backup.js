(function(root){
"use strict";
const copy=x=>JSON.parse(JSON.stringify(x)),keys=["vehicles","logs","projects","inventory","inventoryLedger","vendorOrders","toolInventory","maintenancePlans","archivedMaintenance"];
const validData=v=>typeof v==="string"&&/^data:(?:image\/(?:jpeg|png|webp|gif|heic|heif)|application\/pdf|application\/octet-stream);base64,[A-Za-z0-9+/]+={0,2}$/i.test(v);
const attachments=s=>[...(s.logs||[]),...(s.projects||[])].flatMap(r=>{
 if(r.attachments==null)return [];
 if(!Array.isArray(r.attachments))throw Error("Invalid attachment collection.");
 return r.attachments;
});
function validateAttachment(a){
 if(!a||typeof a!=="object"||Array.isArray(a))throw Error("Invalid attachment record.");
 for(const field of ["dataUrl","data"]){
  const value=a[field];
  if(value!=null&&value!==""&&!validData(value))throw Error("Invalid inline attachment.");
 }
 if(a.dataUrl&&a.data&&a.dataUrl!==a.data)throw Error("Conflicting inline attachment data.");
 if(!a.dataUrl&&!a.data){
  const key=a.storageKey??a.id;
  if(!["string","number"].includes(typeof key)||!String(key).trim()||(typeof key==="number"&&!Number.isFinite(key)))throw Error("Missing attachment reference.");
 }
}
function validateAttachments(state){
 for(const a of attachments(state))validateAttachment(a);
}
async function portable(state,read){
 const out=copy(state);
 validateAttachments(out);
 for(const a of attachments(out)){
 const inline=a.dataUrl||a.data;
 const data=validData(inline)?inline:await read(a.storageKey||a.id);
 if(!validData(data))throw Error("Missing or unsupported attachment: "+(a.name||a.id||"unknown"));
 a.dataUrl=data;delete a.data;delete a.storageKey;
 }
 return out;
}
function candidate(base,input,audit){
 if(Array.isArray(input))input={logs:input};
 if(!input||typeof input!=="object"||Array.isArray(input))throw Error("Invalid backup.");
 if(input.schemaVersion!=null&&Number(input.schemaVersion)>Number(base.schemaVersion))throw Error("Backup requires a newer version.");
 const d=copy(input),out=copy(base);
 for(const [alias,key] of [["serviceLogs","logs"],["partsInventory","inventory"]])if(d[alias]!==undefined){if(d[key]!==undefined)throw Error("Conflicting collections.");d[key]=d[alias];}
 if(!keys.some(k=>d[k]!==undefined))throw Error("No recognized collections.");
 for(const k of keys)if(d[k]!==undefined){if(!Array.isArray(d[k]))throw Error("Invalid collection: "+k);out[k]=d[k];}
 if(d.maintenanceSetupVersion!==undefined){if(!Number.isInteger(d.maintenanceSetupVersion)||d.maintenanceSetupVersion<0)throw Error("Invalid setup version.");out.maintenanceSetupVersion=d.maintenanceSetupVersion;}
 if(d.inventory!==undefined&&d.inventoryLedger===undefined)out.inventoryLedger=[];
 if(d.inventoryLedger!==undefined&&d.inventory===undefined)throw Error("Ledger requires stock.");
 const ids=(rows,k)=>{const set=new Set();for(const r of rows){if(!r||typeof r!=="object"||r.id==null||String(r.id).trim()===""||set.has(String(r.id)))throw Error("Missing or duplicate "+k+" ID.");set.add(String(r.id));}return set;};
 const v=ids(out.vehicles,"vehicle");if(!v.size)throw Error("At least one vehicle is required.");
 for(const k of keys.filter(k=>!["vehicles","inventoryLedger"].includes(k)))ids(out[k],k);
 for(const r of [...out.logs,...out.projects,...out.maintenancePlans]){
 if(r.vehicleId==null||r.vehicleId===""){const n=String(r.vehicle||"").trim().toLowerCase(),matches=out.vehicles.filter(x=>n&&String(x.name||"").trim().toLowerCase()===n);if(matches.length===1)r.vehicleId=matches[0].id;}
 if(!v.has(String(r.vehicleId)))throw Error("Unknown vehicle on record "+r.id+".");
 }
 validateAttachments(out);
 for(const p of out.inventory){const q=Number(p.quantity),r=Number(p.reservedQuantity||0),c=Number(p.unitCost??0);if(![q,r,c].every(Number.isFinite)||q<0||r<0||r>q||c<0)throw Error("Invalid stock balance or cost.");}
 if(out.inventoryLedger.length){const issues=audit(out.inventoryLedger,out.inventory);if(issues.length)throw Error(issues.join("; "));}
 return out;
}
const api={portable,candidate,attachments,validData};root.MotorNoteBackup=api;if(typeof module!=="undefined")module.exports=api;
})(typeof globalThis!=="undefined"?globalThis:this);
