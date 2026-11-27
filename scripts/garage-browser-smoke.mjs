import assert from "node:assert/strict";
import {createServer} from "node:http";
import {readFile,mkdir,writeFile} from "node:fs/promises";
import {resolve,extname,sep} from "node:path";
import {createRequire} from "node:module";
const require=createRequire(import.meta.url);
const {chromium,webkit}=require("../.browser-tests/node_modules/playwright");
const root=resolve("public"),types={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".json":"application/json",".svg":"image/svg+xml"};
const server=createServer(async(req,res)=>{
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
async function run(name,launcher){
 const browser=await launcher.launch({headless:true}),context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:name==="webkit",hasTouch:true,acceptDownloads:true}),page=await context.newPage(),errors=[],dialogs=[],external=[];
 page.setDefaultTimeout(15000);
 page.on("pageerror",e=>errors.push(e.message));page.on("dialog",async d=>{dialogs.push(d.message());await d.accept();});
 await page.route("**/*",route=>{const url=route.request().url();if(url.startsWith(origin+"/")||url.startsWith("data:")||url.startsWith("blob:"))return route.continue();external.push(url);return route.abort();});
 try{
 await context.addInitScript(({state,cart})=>{if(!sessionStorage.getItem("fixture-seeded")){localStorage.setItem("motornote_pro_app_state",JSON.stringify(state));localStorage.setItem("lifeos.repair.project-draft.v1",JSON.stringify({id:"fixture-draft",cart}));sessionStorage.setItem("fixture-seeded","1");}},{state:fixture,cart});
 await page.goto(origin+"/garage?newProject=1&repairDraft=fixture-draft");await saved(page);await tab(page,"projects");
 await page.locator('[x-model="newProjectForm.title"]').fill("Fixture cart import");
 await page.locator('button[\\@click="saveNewProject()"]').click();
 await page.waitForFunction(sel=>window.Alpine.$data(document.querySelector(sel)).projects.some(p=>p.title==="Fixture cart import"),selector);await saved(page);
 assert.deepEqual(await app(page,a=>{const p=a.projects.find(p=>p.title==="Fixture cart import");return {part:p.partRequirements[0]?.partNumber,source:p.procedures[0]?.sourcePath,linked:Object.values(JSON.parse(localStorage.getItem("lifeos.repair.carts.v1")||"{}")).some(c=>c.projectId===p.id)};}),{part:"FIX-1",source:cart.source,linked:true});
 console.log(name,"manual-cart handoff passed");
 // Synthetic plan avoids R2 calls; actual app methods, UI and IndexedDB remain in use.
 const ids=await app(page,async(a,plan)=>{a.modals.projectDetail=false;a.newProjectForm={title:plan.title,category:"Repair",description:plan.scope,budget:100,priority:"Medium",dueDate:""};await a.saveNewProject(plan);const p=a.projects.find(p=>p.title===plan.title);p.partRequirements[0].partNumber="FIX-1";p.partRequirements[0].unit="each";if(!await a.saveToStorage())throw Error("Fixture plan save failed");a.modals.projectDetail=false;return {p:p.id,r:p.partRequirements[0].id};},plan);
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
 await app(page,async(a,id)=>{await a.addProjectAttachments(a.projects.find(x=>x.id===id),{target:{files:[new File(["fixture pdf bytes"],"fixture.pdf",{type:"application/pdf"})],value:""}});},ids.p);await saved(page);
 await page.reload();await saved(page);await balance(page,0,0);
 await page.waitForFunction(({sel,id})=>!!window.Alpine.$data(document.querySelector(sel)).projects.find(p=>p.id===id)?.attachments[0]?.data,{sel:selector,id:ids.p});
 const backup=await app(page,a=>a.portableGarageState());const payload="data:application/pdf;base64,Zml4dHVyZSBwZGYgYnl0ZXM=";
 assert.equal(backup.projects.find(p=>p.id===ids.p).attachments[0].dataUrl,payload);
 assert.equal(await app(page,(a,b)=>a.recoverGarageState(b),backup),true);await saved(page);
 await page.reload();await saved(page);await balance(page,0,0);
 assert.equal(await app(page,(a,id)=>a.logs.filter(l=>l.projectId===id).length,ids.p),1);
 assert.equal(await app(page,a=>window.MotorNoteInventoryEngine.audit(a.inventoryLedger,a.inventory).length),0);
 assert.equal(await app(page,(a,id)=>a.projects.find(p=>p.id===id).attachments[0].dataUrl,ids.p),payload);
 console.log(name,"reload, attachment backup and restore passed");
 // Already-open Garage must be able to save a local transaction without network.
 await context.setOffline(true);
 const offlineSaved=await app(page,async a=>{a.openNewPartModal();Object.assign(a.newPartForm,{description:"Offline fixture",partNumber:"OFFLINE-1",quantity:1,unitCost:3,vehicleCompatibility:"Universal"});return await a.saveNewPart();});
 assert.equal(offlineSaved,true);await saved(page);
 await context.setOffline(false);await page.reload();await saved(page);
 assert.equal(await app(page,a=>a.inventory.find(p=>p.partNumber==="OFFLINE-1")?.quantity),1);
 console.log(name,"offline local save and subsequent reload passed");
 assert.deepEqual(external,[],"Unexpected external requests");assert.deepEqual(errors,[],"Browser runtime errors");
 }catch(e){await mkdir("browser-diagnostics",{recursive:true});await page.screenshot({path:"browser-diagnostics/"+name+".png",fullPage:true}).catch(()=>{});await writeFile("browser-diagnostics/"+name+".json",JSON.stringify({error:String(e),errors,dialogs,external,url:page.url()},null,2));throw e;}
 finally{await context.close();await browser.close();}
}
try{const failures=[];for(const [name,launcher] of [["chromium",chromium],["webkit",webkit]]){try{await run(name,launcher)}catch(e){console.error(name,e);failures.push(name);}}if(failures.length)throw Error("Failed browsers: "+failures.join(", "));}finally{server.close();}
