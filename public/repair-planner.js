/* MotorNote Repair Intelligence V1: local, evidence-first proposal resolver. */
(function(root){
"use strict";
const norm=s=>String(s||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
const stop=new Set("i need to my the a an on in for of and with replace replacement replacing change changing repair fix install remove inspect check service subaru scion crosstrek xb vehicle car both".split(" "));
const action=/\b(removal|installation|inspection|replacement|testing|service and repair|components|disassembly|reassembly|assembly|specifications)\b/i;
const configs={"subaru-crosstrek":{vi:0,name:"2019 Subaru Crosstrek",tree:"subaru-repair.json",manual:"subaru-service-manual",folder:"2019 Subaru Crosstrek Limited"},"scion-xb":{vi:1,name:"2006 Scion xB",tree:"scion-repair.json",manual:"scion-service-manual",folder:"2006 Scion xB Standard"}};
function resolveSections(tree,scope){
 let query=norm(scope).replace(/\b(upstream|downstream)\b/g,m=>m==="upstream"?"front":"rear").replace(/\b(o2|oxygen sensors)\b/g,"oxygen sensor").replace(/\b(alternators?)\b/g,"generator").replace(/\b(a f|air fuel ratio)\b/g,"front oxygen");
 const words=query.split(" ").filter(w=>w&&!stop.has(w)).map(w=>w.replace(/s$/,""));
 if(!words.length)return [];
 const sections=new Map();
 function walk(n,path){for(const c of n.c||[]){if(c.p===undefined){walk(c,[...path,c.n]);continue;}
 if(!path.length||!action.test(c.n)||/different variant|other variant|map -|diagnostic trouble|connector end view|wiring diagram/i.test([...path,c.n].join(" ")))continue;
 const component=path.at(-1),cn=norm(component),leaf=norm(c.n);
 const corpus=cn.replace(/s\b/g,""),matches=words.filter(w=>corpus.includes(w));
 if(!matches.length||matches.length<Math.min(2,words.length))continue;
 if(/\b(front|upstream)\b/.test(query)&&/\brear\b/.test(cn)||/\b(rear|downstream)\b/.test(query)&&/\bfront\b/.test(cn))continue;
 if(/tumble generator/i.test(component))continue;
 const key=JSON.stringify(path.map(norm)),score=matches.length*10+(words.every(w=>corpus.includes(w))?20:0)+(leaf.includes("removal")||leaf.includes("installation")?2:0);
 let g=sections.get(key);if(!g){g={component,path,score,pages:[]};sections.set(key,g);}
 g.score=Math.max(g.score,score);if(!g.pages.some(p=>norm(p.title)===leaf))g.pages.push({page:c.p,title:c.n});
 }}
 walk(tree,[]);
 // Keep distinct components, choose the most complete highest-scoring path for each.
 const distinct=new Map();
 for(const g of [...sections.values()].sort((a,b)=>b.score-a.score||b.pages.length-a.pages.length)){const k=norm(g.component);if(!distinct.has(k))distinct.set(k,g);}
 return [...distinct.values()].filter(g=>g.score>=Math.max(...[...distinct.values()].map(x=>x.score))-4).slice(0,6);
}
function mainHtml(html){const i=String(html).search(/<div\b[^>]*class=["'][^"']*\bmain\b[^"']*["']/i);return i>=0?html.slice(i):html;}
function supportingLinks(html){
 const found=[];
 for(const m of mainHtml(html).matchAll(/<a\b[^>]*href=["'](?:\.\.\/)?(?:pages\/)?(\d+)\.html["'][^>]*>([\s\S]*?)<\/a>/gi)){
  const label=m[2].replace(/<[^>]*>/g," ").replace(/&gt;/g,">").trim();
  if(/battery|under cover|undercover|belt|precaution|lifting|lift point|installation|removal/i.test(label)&&!found.some(x=>x.page===+m[1]))found.push({page:+m[1],title:label});
 }
 return found;
}
async function generate({vehicleId,scope,fetcher=root.fetch,engine=root.LifeOSRepairEngine}){
 const cfg=configs[vehicleId];if(!cfg)throw Error("No supported factory manual for this vehicle.");
 if(!engine)throw Error("Repair extraction engine is unavailable.");
 const text=String(scope||"").trim();if(!text)throw Error("Describe the repair first.");
 const get=async path=>{const r=await fetcher(path,{credentials:"same-origin"});if(!r.ok)throw Error("Source unavailable: "+path);return r;};
 const tree=await(await get("/api/navigation/"+cfg.tree)).json(),sections=resolveSections(tree,text);
 if(!sections.length)throw Error("No matching component sections. Try a specific component name, such as oxygen sensor or alternator.");
 const pages=new Map(),unavailable=[];
 const read=async(p,role,component)=>{
  if(pages.has(p.page))return;
  const url="/m/"+[cfg.manual,cfg.folder,"pages",p.page+".html"].map(encodeURIComponent).join("/");
  const route="#/v/"+cfg.vi+"/0/"+p.page;
  try{const html=mainHtml(await(await get(url)).text()),facts=engine.extractProcedure(html);
   if(!facts.title||facts.title==="Manual procedure")throw Error("Missing factory title");
   pages.set(p.page,{id:"factory-"+cfg.vi+"-"+p.page,page:p.page,title:facts.title,component,role,route,sourcePath:route.slice(1),sourceLabel:"Factory manual #"+p.page,url,facts,links:supportingLinks(html)});
  }catch(e){unavailable.push({page:p.page,title:p.title,reason:e.message});}
 };
 for(const section of sections)for(const p of section.pages.filter(p=>!/disassembly|reassembly|:\s*assembly$/i.test(p.title)).slice(0,8))await read(p,"component",section.component);
 const refs=[...new Map([...pages.values()].flatMap(p=>p.links).map(p=>[p.page,p])).values()].filter(p=>!pages.has(p.page)).slice(0,12);
 for(const p of refs)await read(p,"support","Supporting procedure");
 if(!pages.size)throw Error("No factory procedure could be loaded. No plan was generated.");
 const docs=[...pages.values()],parts=[],tools=new Map(),warnings=[],specs=[];
 const replacement=/\b(replac\w*|chang\w*|new)\b/i.test(text);
 if(replacement)for(const section of sections)parts.push({name:section.component,relationship:"candidate",source:"User scope; confirm diagnosis and VIN fitment",quantity:1});
 for(const p of docs){
  for(const item of p.facts.parts||[]){if(!["required","consumable"].includes(item.relationship)||p.role==="support")continue;if(!parts.some(x=>norm(x.name)===norm(item.name)))parts.push({name:item.name,relationship:item.relationship,source:p.sourceLabel,quantity:1});}
  const source=p.facts.pageText||"";
  const addPart=(name)=>{if(!parts.some(x=>norm(x.name)===norm(name)))parts.push({name,relationship:"consumable",source:p.sourceLabel,quantity:1});};
  const addTool=(name)=>{if(!tools.has(name))tools.set(name,{name,source:"Suggested from "+p.sourceLabel});};
  if(/spray-type lubricant/i.test(source))addPart("Spray-type lubricant"+(/004301003/.test(source)?" (004301003 or equivalent)":""));
  if(/anti-seize compound/i.test(source))addPart("Anti-seize compound"+(/NEVER-SEEZ NSN/i.test(source)?" (NEVER-SEEZ NSN, JET LUBE SS-30 or equivalent)":""));
  if(/oxygen.*sensor.*removal/i.test(p.title))addTool("Oxygen sensor socket (verify fit)");
  if(/lift up the vehicle/i.test(source))addTool("Vehicle lift or rated jack stands");
  if(/disconnect.*(?:ground terminal|negative battery terminal)/i.test(source))addTool("Battery terminal wrench");
  if(/remove the bolts and clips/i.test(source))addTool("Trim clip removal tool and ratchet");
  if(/measure the resistance/i.test(source))addTool("Digital multimeter");
  if(p.facts.torqueSpecs?.length)addTool("Torque wrench (appropriate range)");
  for(const t of p.facts.toolDetails||[])if(!tools.has(t.id))tools.set(t.id,{name:t.name,source:p.sourceLabel});
  for(const t of p.facts.toolReferences||[])if(!tools.has(t.reference))tools.set(t.reference,{name:t.reference,source:p.sourceLabel});
  for(const w of p.facts.warnings||[])warnings.push({text:w.text,source:p.sourceLabel});
  for(const t of p.facts.torqueSpecs||[])specs.push({text:t.values.map(v=>v.value+" "+v.unit).join(" / ")+(t.association?" · "+t.association.component+" · "+t.association.fastener:" · Verify fastener in source"),source:p.sourceLabel,page:p.page,context:t.context});
 }
 if(sections.some(s=>/oxygen.*sensor/i.test(s.component)))tools.set("OBD-II",{name:"OBD-II diagnostic scanner",source:"Suggested diagnostic verification"});
 const tasks=[{name:"Confirm diagnosis, repair scope and part fitment",source:"Preparation"},{name:"Review factory precautions and prepare tools",source:"Preparation"},...docs.filter(p=>/inspection|removal|installation|replacement|service and repair/i.test(p.title)).map(p=>({name:"Review / perform: "+p.title,source:p.sourceLabel,route:p.route})),{name:"Verify completed work and record results",source:"Verification"}];
 return {vehicleId,scope:text,title:sections.map(s=>s.component).join(" + ")+(replacement?" Replacement":" Repair"),sections:sections.map(s=>s.component),documents:docs.map(p=>({id:p.id,title:p.title,sourceLabel:p.sourceLabel,sourcePath:p.sourcePath,route:p.route,role:p.role,specs:specs.filter(s=>s.page===p.page).map(s=>s.text)})),parts,tools:[...tools.values()],warnings,specs,tasks,unavailable,limitations:["Candidate parts are not confirmed failures or verified part numbers.","Review factory diagrams, fastener assignments and procedure dependencies before work.","No prices or tool ownership verified."]};
}
// Phase templates organize evidence; they do not replace factory instructions.
function buildGuidedPhases(plan){
 if(!plan||!Array.isArray(plan.documents)||!plan.documents.length)return [];
 const docs=plan.documents,component=docs.filter(d=>d.role==="component"),support=docs.filter(d=>d.role==="support");
 const match=(arr,re)=>arr.filter(d=>re.test(d.title));
 const phase=(id,title,detail,refs,critical=false)=>({id,title,detail,critical,documents:[...new Map(refs.map(d=>[d.id,d])).values()]});
 const phases=[phase("scope","Confirm repair scope","Confirm the diagnosis, selected components and VIN-specific fitment. Do not buy or replace parts based on search matches alone.",match(component,/inspection|testing/i),true),
 phase("readiness","Prepare parts and equipment","Verify all required parts and tools are available. Read all applicable warnings and supporting procedures before starting.",docs,true)];
 const oxygen=plan.vehicleId==="subaru-crosstrek"&&plan.sections?.length&&plan.sections.every(n=>/oxygen.*sensor/i.test(n));
 const battery=match(support,/note: battery/i),access=match(support,/under cover.*removal/i),close=match(support,/under cover.*installation/i);
 const remove=match(component,/: removal$/i),install=match(component,/: installation$/i),inspect=match(component,/: inspection$/i);
 if(oxygen&&battery.length&&access.length&&close.length&&remove.length===plan.sections.length&&install.length===plan.sections.length&&inspect.length===plan.sections.length){
  phases.push(phase("isolate","Isolate and support vehicle","Record diagnostic data before disconnecting power. Let the exhaust cool. Follow the factory battery precautions and safely support the vehicle.",[...battery,...remove],true),
  phase("access","Gain access","Follow the Crosstrek front under cover removal procedure. Never work beneath a vehicle supported only by a jack.",access,true),
  phase("remove","Remove selected sensors","Follow the selected sensor removal pages. Shared preparation has already been covered; verify each factory instruction and connector location.",remove,true),
  phase("inspect","Inspect sensors and connections","Use the inspection procedures to check damage and applicable resistance values. A resistance test alone does not prove sensor function.",inspect),
  phase("install","Install selected sensors","Follow each installation procedure. Verify thread compound instructions, torque and harness routing. Defer shared undercover and battery reconnection until both selected sensors are installed.",install,true),
  phase("reassemble","Restore access and power","Follow undercover installation and applicable battery reconnection and initialization instructions. Confirm the vehicle is safely lowered.",[...close,...battery],true));
 }else{
  // Unverified job sequences must not be presented as a prescribed factory order.
  phases.push(phase("manual-work","Perform verified factory procedure","Use these linked component and support documents to establish the correct procedure sequence for this repair. Confirm dependencies, variants and fastener assignments in the manual; this plan does not infer a safe disassembly or installation order.",docs,true));
 }
 phases.push(phase("verify","Verify repair and record outcome","Perform appropriate post-repair checks. Record results, installed parts, mileage and actual costs in the Garage project; marking this phase complete does not create a service record.",[...battery,...inspect],true));
 return phases;
}
const api={resolveSections,supportingLinks,generate,buildGuidedPhases};root.MotorNoteRepairPlanner=api;if(typeof module!=="undefined")module.exports=api;
})(typeof globalThis!=="undefined"?globalThis:this);
