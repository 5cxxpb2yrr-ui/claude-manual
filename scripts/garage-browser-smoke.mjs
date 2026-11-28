import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile,mkdir,writeFile} from "node:fs/promises";
import {resolve,extname,sep} from "node:path";
import {createRequire} from "node:module";
import {execFileSync} from "node:child_process";
import {MANUAL_DOCUMENT_CSP} from "../worker.js";
const require=createRequire(import.meta.url);
const {chromium,webkit}=require("../.browser-tests/node_modules/playwright");
const root=resolve("public"),types={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json",".svg":"image/svg+xml"};
let networkBlocked=false,blockedRequests=0,rollbackMode=false;
const blockedPaths=[];
const rollbackCommit="4a2d43c5cdc8e6e98c72e03a57871a0ace4a5334";
assert.ok(process.env.MOTORNOTE_RECOVERY_ROOT,"Build the pinned recovery fixture and set MOTORNOTE_RECOVERY_ROOT before running browser smoke");
const rollbackRoot=resolve(process.env.MOTORNOTE_RECOVERY_ROOT,"public");
const rollbackHtml=await readFile(resolve(rollbackRoot,"garage.html"),"utf8");
assert.equal(rollbackHtml,execFileSync("git",["show",rollbackCommit+":public/garage.html"],{encoding:"utf8",maxBuffer:8*1024*1024}));
assert.match(rollbackHtml,/appSchemaVersion: 9/);
assert.doesNotMatch(rollbackHtml,/data-common-specs/);
const shellVersion=async dir=>{
 const source=await readFile(resolve(dir,"garage-sw.js"),"utf8");
 const hash=source.match(/const VERSION = "([a-f0-9]{64})";/)?.[1];
 assert.ok(hash,"Expected generated Garage service worker");
 return hash;
};
const currentShell=await shellVersion(root),recoveryShell=await shellVersion(rollbackRoot);
assert.notEqual(currentShell,recoveryShell,"Recovery must use its own built assets");
const manualSandbox=(await readFile(resolve(root,"manuals.html"),"utf8")).match(/<iframe class="pg"[^>]*sandbox="([^"]+)"/)?.[1];
assert.equal(manualSandbox,"allow-same-origin");
const isolationPath="/m/isolation-fixture/pages/";
const server=createServer(async(req,res)=>{
 // Avoid reusing connections across simulated connectivity transitions.
 // A graceful TCP FIN before any HTTP response is still a transport
 // failure (not an HTTP 503, which the production worker must not mask).
 if(networkBlocked){
  blockedRequests++;blockedPaths.push(req.url);
  req.socket.end();
  return;
 }
 res.shouldKeepAlive=false;
 res.setHeader("Connection","close");
 if(req.url==="/m/scion-service-manual/2006%20Scion%20xB%20Standard/pages/381.html"){
  res.writeHead(200,{"Content-Type":types[".html"],"Content-Security-Policy":MANUAL_DOCUMENT_CSP,"Cache-Control":"no-store"}).end('<h1>Quick Lookups: Fluids</h1><p>FLUID CAPACITIES</p><table><tr><td>Engine Oil</td><td>Fixture</td></tr><tr><td>Engine Coolant</td><td>Fixture</td></tr></table>');return;
 }
 if(req.url==="/m/scion-service-manual/2006%20Scion%20xB%20Standard/pages/3368.html"){
  res.writeHead(200,{"Content-Type":types[".html"],"Content-Security-Policy":MANUAL_DOCUMENT_CSP,"Cache-Control":"no-store"}).end('<h1>Unrelated fixture</h1>');return;
 }
 if(req.url==="/api/navigation/scion-repair.json"){
  res.writeHead(200,{"Content-Type":types[".json"]}).end(JSON.stringify({c:[{n:"Fixture",c:[{p:381,n:"Quick Lookups: Fluids"},{p:999001,n:"Wide fixture"},{p:999002,n:"Narrow fixture"}]}]}));return;
 }
 if(req.url==="/api/navigation/scion-parts.json"){res.writeHead(200,{"Content-Type":types[".json"]}).end('{"c":[]}');return;}
 if(/\/pages\/99900[12]\.html$/.test(req.url)){
  const wide=req.url.endsWith("999001.html");res.writeHead(200,{"Content-Type":types[".html"],"Content-Security-Policy":MANUAL_DOCUMENT_CSP}).end('<div class="main"><h1>'+ (wide?'Wide fixture':'Narrow fixture')+'</h1><div style="width:'+(wide?'960px':'150px')+'">Fixture content</div></div>');return;
 }
 // Same-origin inert document for observing activation without starting Garage
 // or registering/updating its worker while the replacement is activating.
 if(req.url?.startsWith("/__garage-activation?")){
  res.writeHead(200,{"Content-Type":types[".html"],"Cache-Control":"no-store"}).end('<!doctype html><title>Garage activation probe</title>');return;
 }
 if(req.url==="/__manual-isolation"){
  res.writeHead(200,{"Content-Type":types[".html"]}).end('<iframe id="manual" sandbox="'+manualSandbox+'" src="'+isolationPath+'1.html"></iframe>');return;
 }
 if(req.url===isolationPath+"1.html"||req.url===isolationPath+"2.html"){
  res.writeHead(200,{"Content-Type":types[".html"],"Content-Security-Policy":MANUAL_DOCUMENT_CSP,"Cache-Control":"no-store"}).end('<h1>Fixture manual</h1><script>window.manualScriptExecuted=true;localStorage.setItem("manual-script-ran","yes")</script><a href="2.html">Next diagram</a>');return;
 }
 try{const url=new URL(req.url,"http://localhost"),assetRoot=rollbackMode?rollbackRoot:root,p=resolve(assetRoot,"."+decodeURIComponent(url.pathname==="/garage"?"/garage.html":url.pathname));if(!p.startsWith(assetRoot+sep)){res.writeHead(404).end();return;}const bytes=await readFile(p);res.writeHead(200,{"Content-Type":types[extname(p)]||"application/octet-stream","Cache-Control":"no-store",...(rollbackMode?{"X-Test-Recovery-Commit":rollbackCommit}:{})}).end(bytes);}
 catch{if(!res.headersSent)res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,"127.0.0.1",r));
const origin="http://127.0.0.1:"+server.address().port;
const fixture={schemaVersion:9,maintenanceSetupVersion:2,vehicles:[{id:"scion-xb",name:"2006 Scion xB",odometer:100000,engine:"1NZ-FE",oilType:"5W-30",oilCapacity:"3.9 qts",sparkPlugs:"Test",oilFilter:"Test",vin:""}],logs:[],projects:[],inventory:[],inventoryLedger:[],vendorOrders:[],toolInventory:[],maintenancePlans:[],archivedMaintenance:[]};
const cart={procedure:"Fixture manual procedure",source:"/m/fixture/pages/1.html",route:"#/v/0/0/1",vehicle:"2006 Scion xB",cartKey:"fixture-cart",items:[{name:"Fixture filter",oem:"FIX-1",relationship:"required"}],tools:[],torqueSpecs:[],warnings:[]};
const plan={title:"Fixture guided repair",scope:"Synthetic test only",vehicleId:"scion-xb",sections:["Fixture"],documents:[{id:"doc-1",title:"Fixture: Installation",role:"component",sourceLabel:"Fixture source",sourcePath:cart.source,route:cart.route}],parts:[{name:"Fixture filter",quantity:2,relationship:"required",source:"Fixture source"}],tools:[],warnings:[],unavailable:[],tasks:[]};
const selector="[x-data='garageApp()']";
const app=(page,fn,arg)=>page.evaluate(async({source,arg,selector})=>await (0,eval)("("+source+")")(window.Alpine.$data(document.querySelector(selector)),arg),{source:fn.toString(),arg,selector});
const saved=page=>page.waitForFunction(sel=>{const a=window.Alpine?.$data(document.querySelector(sel));return a?.lastSavedAt&&a.saveState==="saved"&&!a.backupBusy&&!a.startupReadFailed&&!a.vendorBusy&&!a.guidedSaving&&!a.readinessSaving&&!a.inventorySaving;},selector);
const tab=(page,name)=>page.locator('[data-garage-tab="'+name+'"]').waitFor({state:"visible"});
const balance=async(page,q,r)=>assert.deepEqual(await app(page,a=>{const p=a.inventory.find(x=>x.partNumber==="FIX-1");return p?[p.quantity,p.reservedQuantity]:[0,0];}),[q,r]);
async function verifyManualIsolation(browser,name){
 const ctx=await browser.newContext();
 try{
  const p=await ctx.newPage();
  await p.goto(origin+"/__manual-isolation");
  const frame=p.frameLocator("#manual");
  await frame.getByRole("heading",{name:"Fixture manual"}).waitFor();
  assert.equal(await p.evaluate(()=>document.getElementById("manual").contentDocument.querySelector("h1").textContent),"Fixture manual","Parent must retain manual DOM access");
  assert.equal(await p.evaluate(()=>localStorage.getItem("manual-script-ran")),null);
  await frame.getByRole("link",{name:"Next diagram"}).click();
  await p.waitForFunction(()=>document.getElementById("manual").contentWindow.location.pathname.endsWith("/2.html"));
  assert.equal(await p.evaluate(()=>localStorage.getItem("manual-script-ran")),null);
  await p.goto(origin+isolationPath+"1.html");
  assert.equal(await p.evaluate(()=>window.manualScriptExecuted||false),false,"Direct manual page must not run scripts");
  assert.equal(await p.evaluate(()=>localStorage.getItem("manual-script-ran")),null);
  console.log(name,"manual content isolation and same-origin navigation passed");
  await p.setViewportSize({width:390,height:844});
  await p.goto(origin+"/manuals.html#/");
 await p.locator('#tabs a').first().waitFor({state:"visible"});
 assert.deepEqual(await p.locator('#tabs a span').allTextContents(),["Home","Projects","Capture","Inventory","Manuals"]);
 await p.locator('#tabs').getByRole("link",{name:"Capture",exact:true}).click();
 await p.getByRole("dialog",{name:"Capture menu"}).waitFor({state:"visible"});
 await p.getByRole("button",{name:"Close capture"}).click();
 await p.getByRole("button",{name:/^Execute:/}).click();
 await p.getByRole("dialog",{name:"Mission Control items"}).waitFor({state:"visible"});
 await p.getByRole("button",{name:"Close mission items"}).click();
 await p.getByRole("dialog",{name:"Mission Control items"}).waitFor({state:"hidden"});
 console.log(name,"shared navigation, cross-workspace capture and mission tiles passed");
 await p.goto(origin+"/manuals.html#/v/1/0/999001");
  const zoom=p.locator("#zoomlevel");
  await p.waitForFunction(()=>document.querySelector("#fr")?.style.visibility==="visible"&&document.querySelector("#zoomlevel")?.textContent.startsWith("Fit "));
  const fit=Number((await zoom.textContent()).match(/(\d+)%/)[1]);assert.ok(fit>20&&fit<60,"Wide page must fit mobile width");
  await p.getByRole("button",{name:"Zoom in",exact:true}).click();
  assert.equal(await zoom.textContent(),(fit+10)+"%");
  await p.getByRole("button",{name:"Fit page to width"}).click();assert.equal(await zoom.textContent(),"Fit "+fit+"%");
  await p.getByRole("link",{name:"Next",exact:true}).click();
  await p.waitForFunction(()=>document.querySelector("#fr")?.style.visibility==="visible"&&document.querySelector("#zoomlevel")?.textContent==="Fit 100%");
  console.log(name,"manual default fit-width, incremental zoom, reset and next-page fit passed");
 }finally{await ctx.close();}
}
async function run(name,launcher){
 const browser=await launcher.launch({headless:true}),context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:name==="webkit",hasTouch:true,acceptDownloads:true}),page=await context.newPage(),errors=[],dialogs=[],external=[];
 page.setDefaultTimeout(15000);
 const runtimeDetails=[],consoleDetails=[];
 let phase="startup";
 // WebKit can intermittently reject navigation during service-worker
 // transport transitions. Retry only the exact engine navigation error,
 // never assertions, saves, lifecycle waits or runtime exceptions.
 const navigationRetries=[];
 const navigate=async(label,action)=>{
  for(let attempt=1;attempt<=3;attempt++){
   try{return await action();}
   catch(error){
    if(name!=="webkit"||!/^page\.(?:goto|reload): WebKit encountered an internal error(?:\n|$)/.test(error.message)||attempt===3)throw error;
    const detail={phase,label,attempt,message:error.message,url:page.url(),networkBlocked,rollbackMode};
    navigationRetries.push(detail);
    console.warn(name,"navigation retry",JSON.stringify(detail));
    await new Promise(resolve=>setTimeout(resolve,250*attempt));
   }
  }
 };

 page.on("pageerror",e=>{errors.push(e.message);const detail={phase,url:page.url(),name:e.name,message:e.message,stack:e.stack};runtimeDetails.push(detail);console.error(name,"pageerror",JSON.stringify(detail));});
 page.on("console",msg=>{if(["error","warning"].includes(msg.type())){const detail={phase,type:msg.type(),text:msg.text(),location:msg.location()};consoleDetails.push(detail);console.error(name,"browser console",JSON.stringify(detail));}});
 await page.exposeBinding("__garageRuntimeDiagnostic",(_source,detail)=>{runtimeDetails.push({phase,...detail});console.error(name,"browser diagnostic",JSON.stringify({phase,...detail}));});
 await context.addInitScript(()=>{const describe=value=>{try{return {name:value?.name,message:value?.message,stack:value?.stack,text:String(value),properties:JSON.stringify(value,Object.getOwnPropertyNames(value??{}))};}catch{return {text:String(value)};}};
 window.addEventListener("error",event=>{void window.__garageRuntimeDiagnostic({kind:"error",message:event.message,filename:event.filename,line:event.lineno,column:event.colno,error:describe(event.error)}).catch(()=>{});});
 window.addEventListener("unhandledrejection",event=>{void window.__garageRuntimeDiagnostic({kind:"unhandledrejection",reason:describe(event.reason)}).catch(()=>{});});
 });page.on("dialog",async d=>{dialogs.push(d.message());await d.accept();});
 await page.route("**/*",route=>{const url=route.request().url();if(url.startsWith(origin+"/")||url.startsWith("data:")||url.startsWith("blob:"))return route.continue();external.push(url);return route.abort();});
 try{
 await context.addInitScript(({state,cart,origin})=>{if(location.origin!==origin)return;if(!sessionStorage.getItem("fixture-seeded")){localStorage.setItem("motornote_pro_app_state",JSON.stringify(state));localStorage.setItem("lifeos.repair.project-draft.v1",JSON.stringify({id:"fixture-draft",cart}));sessionStorage.setItem("fixture-seeded","1");}},{state:fixture,cart,origin});
 await page.goto(origin+"/garage?newProject=1&repairDraft=fixture-draft");await saved(page);await tab(page,"projects");
 assert.deepEqual(await page.locator('nav[aria-label="MotorNote navigation"] span').allTextContents(),["Home","Projects","Capture","Inventory","Manuals"]);
 await page.locator('[x-model="newProjectForm.title"]').fill("Fixture cart import");
 await page.locator('button[\\@click="saveNewProject()"]').click();
 await page.waitForFunction(sel=>window.Alpine.$data(document.querySelector(sel)).projects.some(p=>p.title==="Fixture cart import"),selector);await saved(page);
 const detail=page.getByRole("dialog",{name:"Project detail",exact:true});
 await detail.getByRole("heading",{name:"Fixture cart import",exact:true}).waitFor({state:"visible"});
 assert.deepEqual(await app(page,a=>{const p=a.projects.find(p=>p.title==="Fixture cart import");return {part:p.partRequirements[0]?.partNumber,source:p.procedures[0]?.sourcePath,linked:Object.values(JSON.parse(localStorage.getItem("lifeos.repair.carts.v1")||"{}")).some(c=>c.projectId===p.id)};}),{part:"FIX-1",source:cart.source,linked:true});
 await detail.getByRole("button",{name:"Close project",exact:true}).click();await detail.waitFor({state:"hidden"});
 console.log(name,"manual-cart handoff passed");
 phase="order and receiving";
 // Synthetic plan avoids R2 calls; actual app methods, UI and IndexedDB remain in use.
 const ids=await app(page,async(a,plan)=>{a.newProjectForm={title:plan.title,category:"Repair",description:plan.scope,budget:100,priority:"Medium",dueDate:""};await a.saveNewProject(plan);const p=a.projects.find(p=>p.title===plan.title);p.partRequirements[0].partNumber="FIX-1";p.partRequirements[0].unit="each";if(!await a.saveToStorage())throw Error("Fixture plan save failed");return {p:p.id,r:p.partRequirements[0].id};},plan);
 await detail.getByRole("heading",{name:plan.title,exact:true}).waitFor({state:"visible"});
 assert.equal(await detail.getByRole("button",{name:"Overview",exact:true}).getAttribute("aria-pressed"),"true");
 for(const [label,key,heading] of [["Work","work","Project workspace"],["Parts","parts","Parts & procurement"],["Manual","manual","Browse vehicle manuals"],["Records","records","Receipts & project evidence"]]){
  await detail.getByRole("button",{name:label,exact:true}).click();
  await detail.locator('[data-project-view="'+key+'"]').waitFor({state:"visible"});
  assert.equal(await detail.locator('[data-project-view]:visible').count(),1);
  assert.equal(await detail.locator('[data-project-view="'+key+'"]').getByText(heading,{exact:false}).first().isVisible(),true);
  assert.equal(await detail.getByRole("button",{name:"Save Project Workspace"}).isVisible(),true);
 }
 await detail.getByRole("button",{name:"Overview",exact:true}).click();
 await detail.locator('[data-project-view="overview"]').waitFor({state:"visible"});
 assert.equal(await detail.getByRole("button",{name:/Open guided preparation/}).isVisible(),true);
 console.log(name,"project workspace views preserve guided repair and save controls");
 await detail.getByRole("button",{name:"Close project",exact:true}).click();await detail.waitFor({state:"hidden"});
 await page.locator("nav").getByRole("button",{name:/Inventory/}).click();await tab(page,"inventory");assert.equal(await page.locator("[data-garage-tab]").count(),1);
 await app(page,a=>a.openVendorDraft());
 for(const [model,value] of [["vendorDraft.vendor","Fixture supplier"],["vendorDraft.orderNumber","TEST-001"],["line.description","Fixture filter"],["line.partNumber","FIX-1"],["line.quantity","2"],["line.unitCost","8"]])await page.locator('[x-model="'+model+'"]').fill(value);
 await page.locator('[x-model="line.vehicleCompatibility"]').selectOption("2006 Scion xB");
 await page.locator('[x-model="line.demandKey"]').selectOption("project:"+ids.p+":"+ids.r);
 await page.getByRole("button",{name:"Record order (no stock added)"}).click();
 await page.waitForFunction(sel=>window.Alpine.$data(document.querySelector(sel)).vendorOrders.length===1,selector);await saved(page);await balance(page,0,0);
 await page.locator("summary").filter({hasText:"Fixture supplier · TEST-001"}).click();
 for(const status of ["Partially received","Received"]){
 await page.getByRole("button",{name:"Receive items",exact:true}).click();await page.locator('[x-model="vendorReceiveAmounts[line.id]"]').fill("1");await page.getByRole("button",{name:"Confirm received & update stock"}).click();
 await page.waitForFunction(({sel,status})=>window.Alpine.$data(document.querySelector(sel)).vendorOrders[0].status===status,{sel:selector,status});await saved(page);await balance(page,status==="Received"?2:1,0);
 }
 console.log(name,"order and partial receiving passed");
 phase="guided execution";
 await app(page,async(a,ids)=>{const p=a.projects.find(x=>x.id===ids.p),stock=a.inventory.find(x=>x.partNumber==="FIX-1");if(!await a.linkProjectReceipt(p,ids.r,stock.id))throw Error("link failed");if(!await a.reserveProjectPart(p,ids.r))throw Error("reserve failed");a.openProjectDetail(p);a.openProjectGuided(p);},ids);await balance(page,2,2);
 const complete=()=>page.getByRole("button",{name:"Confirm phase complete →"}).click();
 await complete();await page.getByText("Unified preparation checklist",{exact:true}).waitFor();
 const readiness=page.locator('[x-show="modals.projectGuided"]').locator('input[type="checkbox"][\\@change*="setProjectReadiness"]');
 for(let i=0;i<await readiness.count();i++){await readiness.nth(i).check();await saved(page);}
 await complete();await page.getByRole("heading",{name:"Perform verified factory procedure",exact:true}).waitFor();await page.getByText("Phase resources & installation",{exact:true}).click();
 await page.locator('[x-model="guidedDraft.installId"]').selectOption(ids.r);await page.locator('[x-model="guidedDraft.installQty"]').fill("2");await page.getByRole("button",{name:"Record installed & consume reservation"}).click();
 await page.waitForFunction(sel=>window.Alpine.$data(document.querySelector(sel)).inventory.find(x=>x.partNumber==="FIX-1")?.quantity===0,selector);await saved(page);await balance(page,0,0);
 await complete();await page.getByRole("heading",{name:"Verify repair and record outcome",exact:true}).waitFor();await complete();await page.getByText("Final inspection recorded",{exact:true}).waitFor();
 await page.getByRole("button",{name:"Record completed service →"}).click();await page.locator('[x-model="projectCompletionForm.verified"]').check();await page.getByRole("button",{name:"Confirm completion & create service record"}).click();
 await page.waitForFunction(({sel,id})=>window.Alpine.$data(document.querySelector(sel)).logs.some(l=>l.projectId===id),{sel:selector,id:ids.p});await saved(page);
 const log=await app(page,(a,id)=>JSON.parse(JSON.stringify(a.logs.find(l=>l.projectId===id))),ids.p);assert.equal(log.materialConsumedValue,16);assert.equal(log.installedParts[0].quantity,2);assert.equal(log.guidedExecution.status,"completed");
 console.log(name,"guided execution and history passed");
 phase="attachment upload";
 const uploaded=await app(page,async(a,id)=>{
 const p=a.projects.find(x=>x.id===id);
 const ok=await a.addProjectAttachments(p,{target:{files:[new File(["fixture pdf bytes"],"fixture.pdf",{type:"application/pdf"})],value:""}});
 const att=p.attachments?.[0],blob=att?.storageKey?await a.readGarageAttachment(att.storageKey):null;
 return {ok,count:p.attachments?.length||0,storedBytes:blob?.size||0,storageKey:att?.storageKey||null};
 },ids.p);
 assert.equal(uploaded.ok,true,"Attachment metadata save");assert.equal(uploaded.count,1,"Attachment reference created");assert.equal(uploaded.storedBytes,17,"Committed attachment bytes readable");await saved(page);
 console.log(name,"attachment committed and read back",uploaded.storedBytes);
 await page.reload();await saved(page);await balance(page,0,0);
 phase="attachment reload";
 const hydrated=await app(page,async(a,id)=>{const att=a.projects.find(p=>p.id===id)?.attachments?.[0];const blob=att?.storageKey?await a.readGarageAttachment(att.storageKey):null;return {present:!!att,hydrated:!!att?.data,bytes:blob?.size||0};},ids.p);
 assert.deepEqual(hydrated,{present:true,hydrated:true,bytes:17},"Attachment reload and hydration");
 phase="backup restore";
 const backup=await app(page,a=>a.portableGarageState());const payload="data:application/pdf;base64,Zml4dHVyZSBwZGYgYnl0ZXM=";
 assert.equal(backup.projects.find(p=>p.id===ids.p).attachments[0].dataUrl,payload);
 assert.equal(await app(page,(a,b)=>a.recoverGarageState(b),backup),true);await saved(page);
 await page.reload();await saved(page);await balance(page,0,0);
 assert.equal(await app(page,(a,id)=>a.logs.filter(l=>l.projectId===id).length,ids.p),1);
 assert.equal(await app(page,a=>window.MotorNoteInventoryEngine.audit(a.inventoryLedger,a.inventory).length),0);
 assert.equal(await app(page,(a,id)=>a.projects.find(p=>p.id===id).attachments[0].dataUrl,ids.p),payload);
 console.log(name,"reload, attachment backup and restore passed");
 phase="service history import";
 // Use synthetic records only; never commit personal service histories.
 await app(page,async a=>{a.vehicles.push({id:"subaru-crosstrek",name:"2019 Subaru Crosstrek",odometer:80000});if(!await a.saveToStorage())throw Error("Second vehicle fixture failed");});
 const historyFixture={records:[
 {vehicle:"xB",date:"2024-01-15",mileage:71000,services:["Oil and filter changed"],cost:25},
 {vehicle:"xB",date:"2024-01-15",mileage:71000,services:["Oil and filter changed"],cost:25},
 {vehicle:"Crosstrek",date:"2024-02-15",mileage:72000,services:["Tires rotated"]},
 {vehicle:"Crosstrek",date:"2024-03-15",mileage:73000,services:["Oil leak checked"],reviewRequired:true},
 {vehicle:"xB",date:"2024-04-15",kind:"administrative",services:["Registration issued"]}
 ]};
 const untouched=async()=>await app(page,a=>{const s=a.getPersistableState();delete s.logs;delete s.savedAt;return s;});
 const beforeHistory=await untouched();
 const initialLogCount=await app(page,a=>a.logs.length);
 await app(page,a=>{a.modals.serviceImport=true;});
 const importer=page.getByRole("dialog",{name:"Import Service History"});
 await importer.waitFor({state:"visible"});
 const uploadHistory=async()=>{await importer.locator('input[type="file"]').setInputFiles({name:"fixture-history.json",mimeType:"application/json",buffer:Buffer.from(JSON.stringify(historyFixture))});await page.waitForFunction(sel=>window.Alpine.$data(document.querySelector(sel)).serviceImportRows.length===4,selector);};
 await uploadHistory();
 assert.deepEqual(await app(page,a=>a.serviceImportRows.map(r=>[r.selected,r.duplicate,r.review])),[[true,false,false],[false,true,false],[true,false,false],[false,false,true]]);
 await importer.getByRole("button",{name:"Merge selected service records"}).click();
 await page.waitForFunction(sel=>window.Alpine.$data(document.querySelector(sel)).serviceImportSummary.startsWith("2 service records imported"),selector);
 await saved(page);
 assert.equal(await app(page,a=>a.logs.length),initialLogCount+2);
 assert.deepEqual(await untouched(),beforeHistory,"Import must preserve all non-log collections");
 assert.equal(await app(page,a=>a.logs.find(l=>l.importedHistory&&l.vehicleId==="subaru-crosstrek").cost),null);
 assert.equal(await app(page,async a=>{const tx=a.garageDB.transaction("backups","readonly");return await new Promise((resolve,reject)=>{const q=tx.objectStore("backups").getAll();q.onsuccess=()=>resolve(q.result.some(b=>b.reason==="pre-service-history-import"&&b.state.logs.length===a.logs.length-2));q.onerror=()=>reject(q.error);});}),true,"Pre-import safety snapshot");
 await uploadHistory();
 assert.equal(await app(page,a=>a.serviceImportRows.filter(r=>r.selected).length),0,"Repeat import must not select duplicates");
 await importer.getByRole("button",{name:"Close",exact:true}).click();
 await page.reload();await saved(page);
 assert.equal(await app(page,a=>a.logs.filter(l=>l.importedHistory).length),2);
 assert.deepEqual(await untouched(),beforeHistory,"Reload preserves non-log collections");
 assert.equal(await app(page,(a,id)=>a.projects.find(p=>p.id===id).attachments[0].dataUrl,ids.p),payload);
 console.log(name,"service history import, duplicate prevention, safety snapshot and persistence passed");

 phase="consumable capture and refill";
 await tab(page,"dashboard");
 await page.getByRole("button",{name:"Capture",exact:true}).click();
 await page.getByRole("button",{name:/Report low \/ empty consumable/}).click();
 const consumable=page.getByRole("dialog",{name:"Consumable replenishment"});
 await consumable.getByRole("textbox",{name:"Consumable name"}).fill("Fixture washer fluid");
 await consumable.locator('[x-model="consumableDraft.level"]').selectOption("empty");
 await consumable.getByRole("button",{name:"Save report",exact:true}).click();
 await consumable.waitFor({state:"hidden"});await saved(page);
 assert.equal(await app(page,a=>window.MotorNoteConsumables.readVehicles(a.vehicles).length),1);
 const reportId=await app(page,a=>window.MotorNoteConsumables.readVehicles(a.vehicles)[0].id);
 assert.ok(await page.getByRole("region",{name:"Consumables needing attention"}).isVisible());
 await app(page,(a,id)=>a.openConsumable(id),reportId);
 await consumable.getByRole("button",{name:"Review / record purchase"}).click();await consumable.waitFor({state:"hidden"});
 assert.equal(await app(page,a=>a.vendorDraft.lines[0].consumableReportId),reportId);
 await app(page,async a=>{Object.assign(a.vendorDraft,{vendor:"Fixture consumables",orderNumber:"FLUID-ORDER"});Object.assign(a.vendorDraft.lines[0],{partNumber:"FLUID-FIXTURE",quantity:3,unitCost:3,vehicleCompatibility:"Universal",unit:"each"});await a.saveVendorDraft();if(a.vendorDraft)throw Error(a.vendorError||"Linked order save failed");});
 await saved(page);
 const linkedState=async()=>app(page,(a,id)=>window.MotorNoteConsumables.project({reports:window.MotorNoteConsumables.readVehicles(a.vehicles),inventory:a.inventory,orders:a.vendorOrders,vehicles:a.vehicles}).find(r=>r.id===id),reportId);
 assert.equal((await linkedState()).state,"waiting");
 await app(page,(a,id)=>a.openConsumable(id),reportId);
 await consumable.getByRole("button",{name:"Review / record purchase"}).click();await consumable.waitFor({state:"hidden"});
 assert.equal(await app(page,a=>a.vendorDraft),null,"Existing incoming purchase must not create a second draft");
 await app(page,async a=>{const o=a.vendorOrders.find(o=>o.orderNumber==="FLUID-ORDER");a.openVendorReceive(o);a.vendorReceiveAmounts[o.lines[0].id]=2;await a.confirmVendorReceive(o);if(a.vendorError)throw Error(a.vendorError);});
 await saved(page);
 assert.equal((await linkedState()).state,"refill");
 assert.equal(await app(page,a=>a.vendorOrders.find(o=>o.orderNumber==="FLUID-ORDER").status),"Partially received");
 assert.equal(await app(page,a=>window.MotorNoteConsumables.readVehicles(a.vehicles)[0].inventoryId),await app(page,a=>String(a.inventory.find(p=>p.partNumber==="FLUID-FIXTURE").id)));
 console.log(name,"linked consumable order, duplicate purchase prevention and partial receipt handoff passed");
 assert.equal(await app(page,a=>window.MotorNoteConsumables.readVehicles(a.vehicles).length),1);
 await app(page,(a,id)=>a.openConsumable(id),reportId);
 await consumable.locator('[x-model="consumableQuantity"]').fill("1");
 await consumable.getByRole("button",{name:"Confirm actual refill"}).click();await consumable.waitFor({state:"hidden"});await saved(page);
 assert.equal(await app(page,a=>a.inventory.find(p=>p.partNumber==="FLUID-FIXTURE").quantity),1);
 assert.equal(await app(page,a=>window.MotorNoteConsumables.readVehicles(a.vehicles)[0].status),"resolved");
 assert.equal(await app(page,a=>window.MotorNoteInventoryEngine.audit(a.inventoryLedger,a.inventory).length),0);
 await page.reload();await saved(page);
 assert.equal(await app(page,a=>window.MotorNoteConsumables.readVehicles(a.vehicles)[0].consumedQuantity),1);
 await context.setOffline(true);
 await app(page,async a=>{a.openConsumable();Object.assign(a.consumableDraft,{scope:"garage",name:"Fixture shop rags",level:"low"});if(!await a.saveConsumableReport())throw Error("Offline consumable save failed");});
 await context.setOffline(false);await page.reload();await saved(page);
 assert.equal(await app(page,a=>window.MotorNoteConsumables.readVehicles(a.vehicles).filter(r=>r.scope==="garage"&&r.status==="open").length),1);
 console.log(name,"consumable capture, stock deduction, ledger integrity and offline persistence passed");
 
 phase="unified shopping";
 await app(page,async a=>{
 a.openNewPartModal();Object.assign(a.newPartForm,{description:"Fixture shop rags",partNumber:"RAGS-FIXTURE",quantity:1,unitCost:3,vehicleCompatibility:"Universal",unit:"pack"});if(!await a.saveNewPart())throw Error(a.inventoryError||"Rags fixture failed");
 const p=a.inventory.find(p=>p.partNumber==="RAGS-FIXTURE");a.startStorageEdit(p.id);Object.assign(a.storageDraft,{minimum:2,target:5,reason:"Fixture reorder settings"});if(!await a.saveStorageEdit())throw Error(a.storageError);
 const r=window.MotorNoteConsumables.readVehicles(a.vehicles).find(r=>r.scope==="garage");a.openConsumable(r.id);Object.assign(a.consumableDraft,{inventoryId:String(p.id),targetQuantity:"6"});if(!await a.saveConsumableReport())throw Error(a.consumableError);
 a.currentTab="inventory";a.inventoryView="shopping";
 });
 await saved(page);
 const ragsItem=async()=>app(page,a=>a.inventoryShoppingList.items.find(i=>i.partNumber==="RAGS-FIXTURE"));
 const initial=await ragsItem();assert.equal(initial.required,6);assert.equal(initial.quantity,5);assert.equal(initial.sources.length,1);
 await page.locator("div[x-show=\"inventoryView==='shopping'\"]").getByText("Fixture shop rags",{exact:true}).waitFor({state:"visible"});
 await app(page,a=>a.openVendorDraft(a.inventoryShoppingList.items.find(i=>i.partNumber==="RAGS-FIXTURE")));
 assert.equal(await app(page,a=>a.vendorDraft.lines[0].inventoryId),initial.stockId);
 await app(page,async a=>{Object.assign(a.vendorDraft,{vendor:"Fixture supplies",orderNumber:"RAGS-ORDER"});Object.assign(a.vendorDraft.lines[0],{quantity:6,unitCost:3});await a.saveVendorDraft();});
 assert.match(await app(page,a=>a.vendorError),/exceeds remaining stock target/);
 await app(page,async a=>{a.vendorDraft.lines[0].quantity=3;await a.saveVendorDraft();if(a.vendorDraft)throw Error(a.vendorError);});await saved(page);
 assert.equal((await ragsItem()).quantity,2);
 await page.reload();await saved(page);assert.equal((await ragsItem()).incoming,3);
 console.log(name,"unified shopping target deduplication, stale quantity rejection and incoming coverage passed");
 
 // Already-open Garage must be able to save a local transaction without network.
 phase="offline transaction";
 await context.setOffline(true);
 const offlineSaved=await app(page,async a=>{a.openNewPartModal();Object.assign(a.newPartForm,{description:"Offline fixture",partNumber:"OFFLINE-1",quantity:1,unitCost:3,vehicleCompatibility:"Universal"});return await a.saveNewPart();});
 assert.equal(offlineSaved,true);await saved(page);
 phase="reconnection and reload";
 await context.setOffline(false);await page.reload();await saved(page);
 assert.equal(await app(page,a=>a.inventory.find(p=>p.partNumber==="OFFLINE-1")?.quantity),1);
 console.log(name,"offline local save and subsequent reload passed");
 phase="offline cold startup";
 await page.waitForFunction(()=>!!navigator.serviceWorker.controller);
 // Prove that the next document is not an already-open in-memory app.
 await page.goto("about:blank");
 // Playwright WebKit's offline emulation can reject even literal service-worker
 // responses (microsoft/playwright#42775). Test actual origin transport failure
 // in both engines; the already-open offline transaction test above still uses
 // setOffline(true). No app requests can succeed against this server here.
 const blockedBefore=blockedRequests;
 networkBlocked=true;
 try {
  await assert.rejects(fetch(origin+"/garage",{cache:"no-store"}),"Origin must be unreachable");
  const coldPath="/garage?offline-cold=1";
  const response=await page.goto(origin+coldPath);
  assert.equal(response?.status(),200,"Cold navigation must return a successful cached document");
  assert.equal(await page.evaluate(()=>!!navigator.serviceWorker.controller),true,"Cold navigation must be service-worker controlled");
  if(name==="chromium")assert.equal(response.fromServiceWorker(),true,"Chromium cold response must come from the service worker");
  await saved(page);
  const pinned=await page.evaluate(()=>[...document.querySelectorAll('script[src],link[rel="stylesheet"][href]')].map(el=>new URL(el.src||el.href,location.href).searchParams.get("garage-offline")));
  assert.equal(pinned.length,13,"All essential Garage resources must be version pinned");
  assert.ok(pinned.every(version=>/^[a-f0-9]{64}$/.test(version||"")&&version===pinned[0]),"Offline document must load a single coherent version");
  assert.equal(await app(page,a=>a.inventory.find(p=>p.partNumber==="OFFLINE-1")?.quantity),1);
  assert.equal(await app(page,(a,id)=>a.projects.find(p=>p.id===id).attachments[0].dataUrl,ids.p),payload);
  assert.equal(await app(page,async a=>{a.openNewPartModal();Object.assign(a.newPartForm,{description:"Cold offline fixture",partNumber:"COLD-OFFLINE-1",quantity:1,unitCost:4,vehicleCompatibility:"Universal"});return await a.saveNewPart();}),true);
  await saved(page);
  const beforeReload=await page.evaluate(()=>performance.timeOrigin);
  const reloadBlockedStart=blockedPaths.length;
  const reloadResponse=await navigate("offline durable save reload",()=>page.reload());
  assert.equal(reloadResponse?.status(),200,"Offline reload must return cached HTML");
  assert.equal(await page.evaluate(()=>!!navigator.serviceWorker.controller),true,"Offline reload must remain controlled");
  assert.ok(blockedPaths.slice(reloadBlockedStart).includes(coldPath),"Offline reload must attempt the unavailable origin");
  if(name==="chromium")assert.equal(reloadResponse.fromServiceWorker(),true,"Offline reload must come from the service worker");
  assert.notEqual(await page.evaluate(()=>performance.timeOrigin),beforeReload,"Offline reload must replace the document");
  await saved(page);
  assert.deepEqual(await page.evaluate(()=>[...document.querySelectorAll('script[src],link[rel="stylesheet"][href]')].map(el=>new URL(el.src||el.href,location.href).searchParams.get("garage-offline"))),pinned,"Reload must preserve the coherent cached shell");
  assert.equal(await app(page,a=>a.inventory.find(p=>p.partNumber==="COLD-OFFLINE-1")?.quantity),1);
  assert.ok(blockedRequests>blockedBefore,"Actual origin transport failure verified");
 } finally {networkBlocked=false;}
 await page.reload();await saved(page);
 assert.equal(await app(page,a=>a.inventory.find(p=>p.partNumber==="COLD-OFFLINE-1")?.quantity),1);
 console.log(name,"offline cold startup, attachment access and durable save passed");
 phase="specification preview";
 await app(page,a=>{a.activeVehicleId="scion-xb";a.currentTab="profile";});await tab(page,"profile");
 const beforeTabs=context.pages().length;
 const common=page.locator("[data-common-specs]");
 assert.equal(await common.getAttribute("open"),null);
 assert.equal(await page.locator("[data-vehicle-spec-summary]").getAttribute("open"),null);
 await page.getByRole("button",{name:"Service manuals",exact:true}).click();
 const library=page.getByRole("dialog",{name:"Vehicle service manuals"});
 await library.waitFor({state:"visible"});
 assert.match(await library.getByRole("link",{name:"Open Library"}).getAttribute("href"),/#\/veh\/1$/);
 assert.match(await library.getByRole("link",{name:"Repair and Diagnosis"}).getAttribute("href"),/#\/t\/1\/0\/$/);
 await library.getByRole("button",{name:"Close service manuals"}).click();await library.waitFor({state:"hidden"});
 assert.equal(context.pages().length,beforeTabs);
 await common.locator(":scope > summary").click();
 const engine=common.locator("[data-spec-category]").first();
 assert.equal(await engine.getAttribute("open"),null);
 await engine.locator(":scope > summary").click();
 await engine.getByText("Engine oil type",{exact:true}).waitFor({state:"visible"});
 await engine.locator(":scope > summary").click();
 assert.equal(await engine.getAttribute("open"),null);
 await page.locator("[data-spec-reference-chips]").getByRole("button",{name:"Fluids & capacities",exact:true}).click();
 const specDialog=page.getByRole("dialog",{name:"Factory manual specification"});
 await specDialog.waitFor({state:"visible"});
 await page.waitForFunction(()=>document.querySelector(".spec-preview-frame")?.style.visibility==="visible");
 assert.equal(await page.evaluate(()=>document.querySelector(".spec-preview-frame").contentDocument.querySelector("h1").textContent),"Quick Lookups: Fluids");
 assert.equal(context.pages().length,beforeTabs);
 const box=await specDialog.boundingBox();assert.ok(box.height>=844*.85&&box.width>=390*.9);
 await specDialog.getByRole("button",{name:"Close factory manual"}).click();await specDialog.waitFor({state:"hidden"});await tab(page,"profile");
 await page.locator("[data-spec-reference-chips]").getByRole("button",{name:"Spark plug",exact:true}).click();
 await specDialog.getByRole("alert").waitFor({state:"visible"});
 assert.equal(await page.evaluate(()=>document.querySelector(".spec-preview-frame").style.visibility),"hidden");
 await specDialog.getByRole("button",{name:"Close factory manual"}).click();await specDialog.waitFor({state:"hidden"});await tab(page,"profile");
 assert.equal(await page.locator("[data-spec-reference-chips] button").count(),6);
 assert.equal(await app(page,a=>a.specVal({k:"brakeFluid"})),"DOT 3");
 assert.equal(await app(page,a=>a.specVal({k:"oilType",legacy:"oilType"})),"5W-30");
 await page.getByRole("button",{name:"Quick specs for selected vehicle"}).click();
 const quick=page.getByRole("dialog",{name:"Vehicle quick reference"});
 await quick.waitFor({state:"visible"});await quick.getByText("DOT 3",{exact:true}).waitFor();
 await quick.getByRole("button",{name:"Close ✕"}).click();await quick.waitFor({state:"hidden"});await tab(page,"profile");
 console.log(name,"verified Specs modal opens in place and rejects mismatched documents; quick reference shares safe defaults");

 phase="schema-compatible rollback";
 // Switch the complete independently built static shell on the same origin,
 // including the service worker, CSS and runtime modules, without touching production.
 // This simulates a deployment switch; it is not a Cloudflare traffic rollback.
 const newAttachment=await app(page,async(a,id)=>{
  const p=a.projects.find(x=>x.id===id);
  if(!await a.addProjectAttachments(p,{target:{files:[new File(["rollback bytes"],"rollback.pdf",{type:"application/pdf"})],value:""}}))throw Error("Rollback fixture attachment failed");
  a.toolInventory.push({id:"rollback-tool",name:"Fixture torque wrench",notes:"Recovery test"});
  if(!await a.saveToStorage("Rollback fixture"))throw Error("Rollback fixture save failed");
  const attachment=p.attachments.find(att=>att.name==="rollback.pdf");
  if(!attachment?.storageKey)throw Error("New rollback attachment reference missing");
  const stored=await a.readGarageAttachment(attachment.storageKey);
  if(!stored||await stored.text()!=="rollback bytes")throw Error("New rollback attachment bytes do not match");
  return attachment.storageKey;
 },ids.p);
 await saved(page);
 const snapshot=async()=>app(page,async(a,key)=>{
  const stored=await a.loadGarageState();
  delete stored.savedAt;
  const attachment=await a.readGarageAttachment(key);
  return {stored,bytes:attachment?Array.from(new Uint8Array(await attachment.arrayBuffer())):null};
 },newAttachment);
 const beforeRollback=await snapshot();
 assert.equal(beforeRollback.stored.schemaVersion,9);
 assert.equal(beforeRollback.stored.vehicles.flatMap(v=>v.motorNoteConsumablesV1||[]).length,2,"Both consumable reports must survive rollback");
 assert.ok(beforeRollback.stored.inventoryLedger.length>0);
 assert.equal(beforeRollback.stored.vendorOrders.length,3);
 assert.ok(beforeRollback.stored.toolInventory.some(t=>t.id==="rollback-tool"));
 assert.deepEqual(beforeRollback.bytes,Array.from(Buffer.from("rollback bytes")),"Newly uploaded rollback fixture must have exact committed bytes");
 const prefix="motornote-garage-shell-";
 // The browser predicate is asynchronous (CacheStorage and registration APIs).
 // Resolve it explicitly before deciding whether to continue polling. A
 // Promise itself is truthy, even when its eventual value is false.
 const waitForLifecycle=async(label,predicate,arg)=>{
  const deadline=Date.now()+45000;
  do{
   if(await page.evaluate(predicate,arg)===true)return;
   await new Promise(resolve=>setTimeout(resolve,100));
  }while(Date.now()<deadline);
  const detail=await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration(),c=navigator.serviceWorker.controller;return {controller:c?.state??null,active:r?.active?.state??null,waiting:r?.waiting?.state??null,installing:r?.installing?.state??null,caches:await caches.keys()};});
  throw Error("Timed out waiting for "+label+": "+JSON.stringify(detail));
 };
 const awaitInstalled=async version=>{
  await page.evaluate(async()=>{const r=await navigator.serviceWorker.getRegistration();if(!r)throw Error("No Garage registration");await r.update();});
  await waitForLifecycle("installed "+version,async({prefix,version})=>{
   const r=await navigator.serviceWorker.getRegistration(),keys=(await caches.keys()).filter(k=>k.startsWith(prefix)),key=prefix+version;
   if(!keys.includes(key))return false;
   const cache=await caches.open(key),html=await cache.match(location.origin+"/garage");
   return !!html&&(r?.waiting?.state==="installed"||(keys.length===1&&r?.active?.state==="activated"));
  },{prefix,version});
 };
 const activate=async(version,url)=>{
  // Release the previous Garage document before observing the replacement.
  // Do not run Garage startup (including another registration/update) until
  // activation has finished. The inert probe shares the origin and scope.
  await page.goto("about:blank");
  const probe=await page.goto(origin+"/__garage-activation?version="+version);
  assert.equal(probe?.status(),200,"Activation probe must be served by the fixture");
  const fullyActivated=async({prefix,version})=>{
   const keys=(await caches.keys()).filter(k=>k.startsWith(prefix));
   const registration=await navigator.serviceWorker.getRegistration(),controller=navigator.serviceWorker.controller;
   // Cache cleanup happens during activate, before the lifecycle is complete.
   // Require the document to be controlled by the fully activated registration.
   return !!controller&&controller===registration?.active&&controller.state==="activated"&&!registration.waiting&&!registration.installing&&keys.length===1&&keys[0]===prefix+version;
  };
  await waitForLifecycle("activated on inert probe "+version,fullyActivated,{prefix,version});
  const response=await page.goto(url);
  assert.equal(response?.status(),200,"Garage must load after activation");
  await saved(page);
  await waitForLifecycle("activated Garage controller "+version,fullyActivated,{prefix,version});
 };
 const checkOfflineShell=async(version,url)=>{
  // Use a previously unvisited URL to rule out WebKit's reuse of the online navigation.
  const cold=new URL(url);
  cold.searchParams.set("offline-probe",version);
  const blockedStart=blockedPaths.length;
  // Activation already released the previous document. Navigate from the
  // verified controller to a never-visited URL without another blank round-trip.
  // Earlier cold-start checks still exercise blank-to-offline navigation.
  networkBlocked=true;
  try{
   await assert.rejects(fetch(origin+"/garage",{cache:"no-store"}));
   const response=await page.goto(cold.href);assert.equal(response?.status(),200);await saved(page);
   const diagnostic=await page.evaluate(async()=>({
    pinned:[...document.querySelectorAll('script[src],link[rel="stylesheet"][href]')].map(el=>new URL(el.src||el.href,location.href).searchParams.get("garage-offline")),
    caches:(await caches.keys()).filter(k=>k.startsWith("motornote-garage-shell-")),
    controlled:!!navigator.serviceWorker.controller,
    activeController:await (async()=>{const r=await navigator.serviceWorker.getRegistration(),c=navigator.serviceWorker.controller;return !!c&&c===r?.active&&c.state==="activated"&&!r.waiting&&!r.installing})(),
    url:location.href
   }));
   const attempted=blockedPaths.slice(blockedStart);
   console.log(name,"offline recovery probe",JSON.stringify({expected:version,...diagnostic,attempted}));
   assert.ok(attempted.includes(cold.pathname+cold.search),"Fresh offline navigation must attempt the blocked origin");
   assert.equal(diagnostic.controlled,true);
   assert.equal(diagnostic.activeController,true,"Offline probe must use the fully activated controller");
   assert.deepEqual(diagnostic.caches,[prefix+version]);
   const expectedAssets=version===recoveryShell?12:13;
   assert.equal(diagnostic.pinned.length,expectedAssets);
   assert.deepEqual(diagnostic.pinned,Array(expectedAssets).fill(version),"Offline resources must all use the selected build");
   if(name==="chromium")assert.equal(response.fromServiceWorker(),true);
   assert.deepEqual(await snapshot(),beforeRollback,"Offline startup must preserve the full V9 state");
  }finally{networkBlocked=false;}
 };
 try{
  rollbackMode=true;
  const url=origin+"/garage?recovery-fixture=1#specs";
  const response=await page.goto(url);
  assert.equal(response?.headers()["x-test-recovery-commit"],rollbackCommit,"Must actually load pinned V9 recovery HTML");
  await saved(page);
  assert.equal(await page.locator("[data-common-specs]").count(),0);
  assert.deepEqual(await snapshot(),beforeRollback,"Recovery build startup save must preserve every collection and attachment byte");
  assert.equal(await app(page,a=>window.MotorNoteInventoryEngine.audit(a.inventoryLedger,a.inventory).length),0);
  await awaitInstalled(recoveryShell);await activate(recoveryShell,url);
  await checkOfflineShell(recoveryShell,url);
 }finally{rollbackMode=false;}
 const currentUrl=origin+"/garage?recovery-fixture=return#specs";
 const returnResponse=await navigate("return from recovery build",()=>page.goto(currentUrl));
 assert.equal(returnResponse?.status(),200,"Return navigation must load a successful document");
 assert.equal(returnResponse?.headers()["x-test-recovery-commit"],undefined,"Return must not load recovery fixture");
 await saved(page);await tab(page,"profile");
 await awaitInstalled(currentShell);await activate(currentShell,currentUrl);
 assert.equal(await page.locator("[data-common-specs]").count(),1);
 assert.deepEqual(await snapshot(),beforeRollback,"Returning to current release must preserve the V9 data");
 await checkOfflineShell(currentShell,currentUrl);
 console.log(name,"same-origin V9 full asset and offline shell rollback and return preserved all persisted collections and attachment bytes");
 console.log(name,"navigation retry summary",JSON.stringify(navigationRetries));

 assert.deepEqual(external,[],"Unexpected external requests");assert.deepEqual(errors,[],"Browser runtime errors");assert.deepEqual(runtimeDetails,[],"Browser runtime diagnostics");
 await verifyManualIsolation(browser,name);
 }catch(e){await mkdir("browser-diagnostics",{recursive:true});await page.screenshot({path:"browser-diagnostics/"+name+".png",fullPage:true}).catch(()=>{});await writeFile("browser-diagnostics/"+name+".json",JSON.stringify({error:String(e),errors,runtimeDetails,consoleDetails,navigationRetries,dialogs,external,url:page.url(),state:await app(page,a=>({saveState:a.saveState,lastSaveError:a.lastSaveError,projects:a.projects.map(p=>({id:p.id,title:p.title,attachments:(p.attachments||[]).map(x=>({id:x.id,storageKey:x.storageKey,name:x.name,hydrated:!!x.data}))}))})).catch(()=>null)},null,2));throw e;}
 finally{await context.close();await browser.close();}
}
try{const failures=[];for(const [name,launcher] of [["chromium",chromium],["webkit",webkit]]){try{await run(name,launcher)}catch(e){console.error(name,e);failures.push(name);}}if(failures.length)throw Error("Failed browsers: "+failures.join(", "));}finally{server.close();}
