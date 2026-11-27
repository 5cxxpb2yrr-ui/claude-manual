import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile,mkdir,writeFile} from "node:fs/promises";
import {resolve,extname,sep} from "node:path";
import {createRequire} from "node:module";
import {MANUAL_DOCUMENT_CSP} from "../worker.js";
const require=createRequire(import.meta.url);
const {chromium,webkit}=require("../.browser-tests/node_modules/playwright");
const root=resolve("public"),types={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json",".svg":"image/svg+xml"};
let networkBlocked=false,blockedRequests=0;
const manualSandbox=(await readFile(resolve(root,"manuals.html"),"utf8")).match(/<iframe class="pg"[^>]*sandbox="([^"]+)"/)?.[1];
assert.equal(manualSandbox,"allow-same-origin");
const isolationPath="/m/isolation-fixture/pages/";
const server=createServer(async(req,res)=>{
 if(networkBlocked){blockedRequests++;req.socket.destroy();return;}
 if(req.url==="/m/scion-service-manual/2006%20Scion%20xB%20Standard/pages/381.html"){
  res.writeHead(200,{"Content-Type":types[".html"],"Content-Security-Policy":MANUAL_DOCUMENT_CSP,"Cache-Control":"no-store"}).end('<h1>Quick Lookups: Fluids</h1><p>FLUID CAPACITIES</p><table><tr><td>Engine Oil</td><td>Fixture</td></tr><tr><td>Engine Coolant</td><td>Fixture</td></tr></table>');return;
 }
 if(req.url==="/m/scion-service-manual/2006%20Scion%20xB%20Standard/pages/3368.html"){
  res.writeHead(200,{"Content-Type":types[".html"],"Content-Security-Policy":MANUAL_DOCUMENT_CSP,"Cache-Control":"no-store"}).end('<h1>Unrelated fixture</h1>');return;
 }
 if(req.url==="/__manual-isolation"){
  res.writeHead(200,{"Content-Type":types[".html"]}).end('<iframe id="manual" sandbox="'+manualSandbox+'" src="'+isolationPath+'1.html"></iframe>');return;
 }
 if(req.url===isolationPath+"1.html"||req.url===isolationPath+"2.html"){
  res.writeHead(200,{"Content-Type":types[".html"],"Content-Security-Policy":MANUAL_DOCUMENT_CSP,"Cache-Control":"no-store"}).end('<h1>Fixture manual</h1><script>window.manualScriptExecuted=true;localStorage.setItem("manual-script-ran","yes")</script><a href="2.html">Next diagram</a>');return;
 }
 try{const url=new URL(req.url,"http://localhost"),p=resolve(root,"."+decodeURIComponent(url.pathname==="/garage"?"/garage.html":url.pathname));if(!p.startsWith(root+sep)){res.writeHead(404).end();return;}res.writeHead(200,{"Content-Type":types[extname(p)]||"application/octet-stream","Cache-Control":"no-store"}).end(await readFile(p));}
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
 }finally{await ctx.close();}
}
async function run(name,launcher){
 const browser=await launcher.launch({headless:true}),context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:name==="webkit",hasTouch:true,acceptDownloads:true}),page=await context.newPage(),errors=[],dialogs=[],external=[];
 page.setDefaultTimeout(15000);
 const runtimeDetails=[],consoleDetails=[];
 let phase="startup";
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
  const response=await page.goto(origin+"/garage");
  assert.equal(response?.status(),200,"Cold navigation must return a successful cached document");
  assert.equal(await page.evaluate(()=>!!navigator.serviceWorker.controller),true,"Cold navigation must be service-worker controlled");
  if(name==="chromium")assert.equal(response.fromServiceWorker(),true,"Chromium cold response must come from the service worker");
  await saved(page);
  const pinned=await page.evaluate(()=>[...document.querySelectorAll('script[src],link[rel="stylesheet"][href]')].map(el=>new URL(el.src||el.href,location.href).searchParams.get("garage-offline")));
  assert.equal(pinned.length,12,"All essential Garage resources must be version pinned");
  assert.ok(pinned.every(version=>/^[a-f0-9]{64}$/.test(version||"")&&version===pinned[0]),"Offline document must load a single coherent version");
  assert.equal(await app(page,a=>a.inventory.find(p=>p.partNumber==="OFFLINE-1")?.quantity),1);
  assert.equal(await app(page,(a,id)=>a.projects.find(p=>p.id===id).attachments[0].dataUrl,ids.p),payload);
  assert.equal(await app(page,async a=>{a.openNewPartModal();Object.assign(a.newPartForm,{description:"Cold offline fixture",partNumber:"COLD-OFFLINE-1",quantity:1,unitCost:4,vehicleCompatibility:"Universal"});return await a.saveNewPart();}),true);
  await saved(page);await page.reload();await saved(page);
  assert.equal(await app(page,a=>a.inventory.find(p=>p.partNumber==="COLD-OFFLINE-1")?.quantity),1);
  assert.ok(blockedRequests>blockedBefore,"Actual origin transport failure verified");
 } finally {networkBlocked=false;}
 await page.reload();await saved(page);
 assert.equal(await app(page,a=>a.inventory.find(p=>p.partNumber==="COLD-OFFLINE-1")?.quantity),1);
 console.log(name,"offline cold startup, attachment access and durable save passed");
 phase="specification preview";
 await app(page,a=>{a.activeVehicleId="scion-xb";a.currentTab="profile";});await tab(page,"profile");
 const beforeTabs=context.pages().length;
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

 assert.deepEqual(external,[],"Unexpected external requests");assert.deepEqual(errors,[],"Browser runtime errors");assert.deepEqual(runtimeDetails,[],"Browser runtime diagnostics");
 await verifyManualIsolation(browser,name);
 }catch(e){await mkdir("browser-diagnostics",{recursive:true});await page.screenshot({path:"browser-diagnostics/"+name+".png",fullPage:true}).catch(()=>{});await writeFile("browser-diagnostics/"+name+".json",JSON.stringify({error:String(e),errors,runtimeDetails,consoleDetails,dialogs,external,url:page.url(),state:await app(page,a=>({saveState:a.saveState,lastSaveError:a.lastSaveError,projects:a.projects.map(p=>({id:p.id,title:p.title,attachments:(p.attachments||[]).map(x=>({id:x.id,storageKey:x.storageKey,name:x.name,hydrated:!!x.data}))}))})).catch(()=>null)},null,2));throw e;}
 finally{await context.close();await browser.close();}
}
try{const failures=[];for(const [name,launcher] of [["chromium",chromium],["webkit",webkit]]){try{await run(name,launcher)}catch(e){console.error(name,e);failures.push(name);}}if(failures.length)throw Error("Failed browsers: "+failures.join(", "));}finally{server.close();}
