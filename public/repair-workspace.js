(function (root) {
"use strict";
const STORE="lifeos.repair.carts.v1";
const CATALOG=[
["water-pump","Water Pump","Cooling",["water pump"],["water-pump-gasket","thermostat","coolant"]],
["water-pump-gasket","Water Pump Gasket","Cooling",["water pump gasket","water pump o-ring"],[]],
["thermostat","Thermostat","Cooling",["thermostat"],["thermostat-gasket","coolant"]],
["thermostat-gasket","Thermostat Gasket","Cooling",["thermostat gasket"],[]],
["radiator","Radiator","Cooling",["radiator"],["radiator-hose","coolant"]],
["radiator-hose","Radiator Hose","Cooling",["radiator hose"],[]],
["drive-belt","Drive Belt","Engine",["drive belt","serpentine belt","v-ribbed belt","generator v belt"],["belt-tensioner"]],
["belt-tensioner","Belt Tensioner","Engine",["belt tensioner","drive belt tensioner"],[]],
["timing-chain","Timing Chain","Engine",["timing chain"],["timing-chain-tensioner"]],
["timing-chain-tensioner","Timing Chain Tensioner","Engine",["chain tensioner","timing chain tensioner"],[]],
["valve-cover-gasket","Valve Cover Gasket","Engine",["valve cover gasket","cylinder head cover gasket"],[]],
["oil-filter","Oil Filter","Engine",["oil filter"],["drain-plug-gasket","engine-oil"]],
["drain-plug-gasket","Drain Plug Gasket","Engine",["drain plug gasket","drain plug washer","oil drain plug gasket"],[]],
["spark-plug","Spark Plug","Engine",["spark plug"],["ignition-coil"]],
["ignition-coil","Ignition Coil","Electrical",["ignition coil"],[]],
["air-filter","Engine Air Filter","Engine",["air filter","air cleaner element"],[]],
["cabin-air-filter","Cabin Air Filter","HVAC",["cabin air filter","cabin filter","a/c filter"],[]],
["fuel-filter","Fuel Filter","Fuel",["fuel filter"],[]],
["fuel-injector","Fuel Injector","Fuel",["fuel injector","injector"],["injector-o-ring"]],
["injector-o-ring","Injector O-Ring","Fuel",["injector o-ring","injector seal"],[]],
["fuel-pump","Fuel Pump","Fuel",["fuel pump"],[]],
["oxygen-sensor","Oxygen Sensor","Emissions",["oxygen sensor","o2 sensor","air fuel ratio sensor","a/f sensor"],[]],
["mass-airflow-sensor","Mass Airflow Sensor","Fuel",["mass air flow","maf sensor","mass airflow sensor"],[]],
["battery","Battery","Electrical",["battery"],[]],
["alternator","Alternator","Electrical",["alternator","generator"],[]],
["starter","Starter Motor","Electrical",["starter motor","starter"],[]],
["brake-pad","Brake Pads","Brakes",["brake pad","disc brake pad"],["brake-rotor","brake-fluid","caliper-hardware"]],
["brake-rotor","Brake Rotor","Brakes",["brake rotor","brake disc","disc rotor"],[]],
["brake-caliper","Brake Caliper","Brakes",["brake caliper","caliper"],["brake-fluid"]],
["caliper-hardware","Caliper Hardware Kit","Brakes",["caliper hardware","pad clip","anti-rattle"],[]],
["wheel-bearing","Wheel Bearing","Suspension",["wheel bearing","hub bearing","hub unit","hub assembly"],["axle-nut"]],
["axle-nut","Axle Nut","Suspension",["axle nut","axle shaft nut","lock nut"],[]],
["strut","Strut Assembly","Suspension",["strut assembly","strut","shock absorber"],["strut-mount"]],
["strut-mount","Strut Mount","Suspension",["strut mount","strut bearing"],[]],
["control-arm","Control Arm","Suspension",["control arm","lower arm"],["ball-joint"]],
["ball-joint","Ball Joint","Suspension",["ball joint"],[]],
["tie-rod-end","Tie Rod End","Steering",["tie rod end","tie rod"],[]],
["cv-axle","CV Axle","Drivetrain",["cv axle","drive shaft","driveshaft","axle shaft"],["axle-nut"]],
["transmission-pan-gasket","Transmission Pan Gasket","Transmission",["transmission pan gasket","oil pan gasket","pan gasket"],[]],
["transmission-filter","Transmission Filter","Transmission",["transmission filter","oil strainer","cvt filter"],[]],
["windshield","Windshield","Body",["windshield","front windshield glass"],["eyesight-camera"]],
["eyesight-camera","EyeSight Stereo Camera","Electronics",["eyesight camera","stereo camera","eyesight"],[]],
["wiper-blade","Wiper Blade","Body",["wiper blade"],[]],
["ac-compressor","A/C Compressor","HVAC",["a/c compressor","ac compressor"],[]],
["gasket","Gasket / Seal","Service Part",["gasket","o-ring","seal"],[]],
["coolant","Coolant","Consumable",["coolant","antifreeze"],[]],
["engine-oil","Engine Oil","Consumable",["engine oil"],[]],
["brake-fluid","Brake Fluid","Consumable",["brake fluid"],[]],
["cvt-fluid","CVT Fluid","Consumable",["cvt fluid"],[]],
["atf","Automatic Transmission Fluid","Consumable",["atf","automatic transmission fluid","transmission fluid"],[]],
["sealant","Gasket Sealant (FIPG)","Consumable",["sealant","fipg","formed in place gasket"],[]],
["thread-locker","Thread Locker","Consumable",["thread locker","thread-locking","threadlock"],[]],
["grease","Grease","Consumable",["grease","lithium grease"],[]]
].map(x=>({id:x[0],name:x[1],category:x[2],aliases:x[3],related:x[4]}));
const TOOLS=[
{id:"pulley-holder",name:"Pulley holder",re:/pulley holder/i},
{id:"torque-wrench",name:"Torque wrench",re:/torque wrench/i},
{id:"jack-stands",name:"Jack stands",re:/jack stands?|safety stands?/i},
{id:"flare-nut-wrench",name:"Flare-nut wrench",re:/flare[- ]nut wrench|line wrench/i},
{id:"coolant-pressure-tester",name:"Cooling-system pressure tester",re:/pressure tester/i},
{id:"brake-bleeder",name:"Brake bleeder",re:/brake bleeder|pressure bleeder/i},
{id:"oil-filter-wrench",name:"Oil filter wrench",re:/oil filter wrench/i},
{id:"special-service-tool",name:"Special service tool (SST)",re:/\bSST\b|special (service )?tool/i},
{id:"subaru-ssm4",name:"Subaru Select Monitor 4 (SSM4)",re:/\bSSM\s?-?4\b|select monitor/i}
];
const escapeRegex=s=>s.replace(/[.*+?^$()|[\]\\]/g,"\\$&");
const slugify=s=>s.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"");
function htmlToText(html){
return String(html||"").replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi," ")
.replace(/<br\s*\/?>|<\/(p|div|h[1-6]|tr|ul|ol|table|section|article)>|<\/li>/gi,"\n")
.replace(/<li\b[^>]*>/gi,"- ").replace(/<[^>]+>/g," ")
.replace(/&nbsp;|&#160;/gi," ").replace(/&lt;/gi,"<").replace(/&gt;/gi,">")
.replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'").replace(/&amp;/gi,"&")
.replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)))
.replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16)))
.replace(/[ \t]+/g," ").replace(/ *\n */g,"\n").replace(/\n+/g,"\n").trim();
}
const strip=s=>htmlToText(s).replace(/\n/g," ").trim();
function matchParts(line){
const candidates=[];CATALOG.forEach(p=>p.aliases.forEach(a=>candidates.push({part:p,alias:a})));
candidates.sort((a,b)=>b.alias.length-a.alias.length);
let work=String(line).toLowerCase();const found=new Map();
candidates.forEach(x=>{
const re=new RegExp("(^|[^a-z0-9])("+escapeRegex(x.alias)+")(?=$|[^a-z0-9])","gi");
if(re.test(work)){found.set(x.part.id,x.part);work=work.replace(re,m=>" ".repeat(m.length));}
});
return [...found.values()];
}
const TORQUE_RE=/(\d+(?:\.\d+)?)\s*(N\s*[·.\-•]?\s*m|kgf\s*[·.\-•]?\s*(?:m|cm)|ft\s*[·.\-•]?\s*(?:lbf?|lbs?)|in\s*[·.\-•]?\s*(?:lbf?|lbs?))(?![a-z])/gi;
function normalizeTorqueUnit(raw){
const u=raw.toLowerCase().replace(/[^a-z]/g,"");
if(u.startsWith("kgf"))return u.endsWith("cm")?"kgf·cm":"kgf·m";
if(u.startsWith("ft"))return "ft·lbf";if(u.startsWith("in"))return "in·lbf";return "N·m";
}
const TORQUE_TO_NM={"N·m":1,"kgf·cm":0.0980665,"kgf·m":9.80665,"ft·lbf":1.355817948,"in·lbf":0.112984829};
function extractTorque(text){
const lines=String(text).split("\n"),out=[];
lines.forEach((line,lineIndex)=>{TORQUE_RE.lastIndex=0;let m;
while((m=TORQUE_RE.exec(line))){
const start=Math.max(0,lineIndex-2),end=Math.min(lines.length,lineIndex+3);
out.push({value:Number(m[1]),unit:normalizeTorqueUnit(m[2]),context:line.trim().slice(0,180),nearbyContext:lines.slice(start,end).join(" ").replace(/\\s+/g," ").trim().slice(0,420),lineIndex});
}
});return out;
}
function groupTorque(torque){
const groups=new Map();
torque.forEach(item=>{
const key=item.lineIndex+":"+item.context;
if(!groups.has(key)){
const evidence=item.nearbyContext||item.context,nearbyParts=matchParts(evidence),fastener=/\b(bolt|bolts|nut|nuts|screw|screws|stud|studs|plug|fastener)\b/i.test(evidence);
const waterPumpPulley=/PULLEY WRENCH PIN SET/i.test(evidence)&&/\bV[- ]BELTS?\b/i.test(evidence);
const association=waterPumpPulley?{component:"Water Pump Pulley",fastener:"Pulley mounting fastener",evidence,associationSource:"OEM procedure sequence: pulley wrench pin set followed by V-belt installation"}:nearbyParts.length===1&&fastener?{component:nearbyParts[0].name,fastener:"Fastener identified in nearby manual context",evidence}:null;
groups.set(key,{id:"torque-"+groups.size,context:item.context,nearbyContext:item.nearbyContext,association,values:[]});
}
groups.get(key).values.push({value:item.value,unit:item.unit});
});
return [...groups.values()].map(group=>{
const converted=group.values.map(v=>v.value*(TORQUE_TO_NM[v.unit]||1));
const min=Math.min(...converted),max=Math.max(...converted);
const consistent=converted.length<2||((max-min)/Math.max((max+min)/2,0.0001)<=0.05);
return {...group,consistent,selectable:Boolean(group.association&&consistent),reviewReason:!consistent?"Conflicting unit conversions":!group.association?"Fastener/component is not identified on the torque line":""};
});
}
function extractWarnings(lines){
const out=[];
for(let i=0;i<lines.length;i++){
const match=/^\s*(WARNING|CAUTION|NOTICE|NOTE)\s*:\s*(.*)$/i.exec(lines[i]);
if(!match)continue;
const label=match[1].toUpperCase(),parts=[match[2].trim()];
for(let j=i+1;j<Math.min(lines.length,i+5);j++){
const line=lines[j].trim();
if(!line||/^\s*(WARNING|CAUTION|NOTICE|NOTE)\s*:/i.test(line)||/^(REMOVAL|INSTALLATION|INSPECTION|ADJUSTMENT|PREPARATION|DISASSEMBLY|REASSEMBLY|REPAIR|SERVICE|NOTICE|CAUTION|WARNING|NOTE)(?:\b|\s*:)/i.test(line))break;
parts.push(line);
}
const message=parts.filter(Boolean).join(" ").trim();
if(message)out.push({type:label,text:message});
}
return out.slice(0,30);
}
const REQUIRED=/\b(always replace|must be replaced|replace(?:d|ment)?|renew|install a new|discard and replace|do not reuse)\b/i;
const RECOMMENDED=/\b(recommend\w*|should (?:also )?be replaced|at the same time|also replace|consider replacing)\b/i;
const ACTION=/\b(fill|refill|drain|apply|add|bleed|use|coat|pour|lubricate)\b/i;
const TARGET_ACTION=/\b(remove|install|disconnect|inspect|measure|adjust|clean|check)\b/i;
const PRIORITY={required:5,recommended:4,target:3,consumable:2,mention:1};
function requiredCueForPart(line,part){
return part.aliases.some(alias=>{
const partPattern="(^|[^a-z0-9])"+escapeRegex(alias)+"(?=$|[^a-z0-9])";
const before=new RegExp("\\b(always replace|must be replaced|replace(?:d|ment)?|renew|install a new|discard and replace|do not reuse)\\b[^.;,]{0,14}"+partPattern,"i");
const after=new RegExp(partPattern+"[^.;,]{0,14}\\b(must be replaced|should be replaced|is replaced|was replaced)\\b","i");
return before.test(line)||after.test(line);
});
}
function extractProcedure(html,context){
context=context||{};const h1=/<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html),tt=/<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html);
const title=context.title||strip(h1?h1[1]:tt?tt[1]:"")||"Manual procedure";
const text=htmlToText(html),lines=text.split("\n").map(x=>x.trim()).filter(Boolean),procedureId=context.id||slugify(title);
const titleParts=matchParts(title),titleIds=new Set(titleParts.map(p=>p.id)),actionTitle=/\b(replacement|replace|removal|remove|installation|install|service and repair)\b/i.test(title);
const acc=new Map();
function add(part,rel,base,evidence,oem){
const old=acc.get(part.id);if(!old){acc.set(part.id,{part,relationship:rel,base,evidence:[evidence],oem:(oem||[]).slice()});return;}
old.evidence.push(evidence);(oem||[]).forEach(o=>{if(!old.oem.some(x=>x.partNumber===o.partNumber))old.oem.push(o);});
if((PRIORITY[rel]||0)>(PRIORITY[old.relationship]||0)||(rel===old.relationship&&base>old.base)){old.relationship=rel;old.base=base;}
}
titleParts.forEach(part=>{
if(part.category==="Consumable")return;
if(actionTitle)add(part,/\breplacement|replace\b/i.test(title)?"required":"target",/\breplacement|replace\b/i.test(title)?0.93:0.88,{text:title,cue:"title"},[]);
});
lines.forEach(line=>{
const oem=[];(line.match(/\b\d{5}-\d{5}\b/g)||[]).forEach(n=>oem.push({manufacturer:"Toyota",partNumber:n}));
(line.match(/\b\d{5}[A-Z]{2}\d{3,4}[A-Z]?\b/g)||[]).forEach(n=>oem.push({manufacturer:"Subaru",partNumber:n}));
matchParts(line).forEach(part=>{
const ev=cue=>({text:line.slice(0,180),cue});
if(part.category==="Consumable")add(part,"consumable",ACTION.test(line)?0.86:0.62,ev("consumable"),oem);
else if(RECOMMENDED.test(line))add(part,"recommended",0.72,ev("recommended"),oem);
else if(requiredCueForPart(line,part))add(part,"required",0.84,ev("required"),oem);
else if(titleIds.has(part.id)&&TARGET_ACTION.test(line))add(part,"target",0.86,ev("target"),oem);
else add(part,"mention",0.35,ev("mention"),oem);
});
});
const parts=[...acc.values()].map(a=>({id:a.part.id,name:a.part.name,category:a.part.category,relationship:a.relationship,
confidence:Math.min(0.99,Math.round((a.base+0.03*(a.evidence.length-1))*100)/100),
evidence:a.evidence.slice(0,12),oem:a.oem,relatedParts:a.part.related}))
.sort((a,b)=>(PRIORITY[b.relationship]||0)-(PRIORITY[a.relationship]||0)||b.confidence-a.confidence);
const toolDetails=TOOLS.filter(t=>t.re.test(text)).map(t=>({id:t.id,name:t.name}));
const toolReferences=[];let m;const sst=/\bSST\s+([A-Z0-9-]+(?:\s*\([^)]*\))?)/gi;
while((m=sst.exec(text)))toolReferences.push({tool:"special-service-tool",reference:m[1].trim()});
const oil=/OIL FILTER WRENCH\s*\(([^)]+)\)/gi;while((m=oil.exec(text)))toolReferences.push({tool:"oil-filter-wrench",reference:m[1].trim()});
const warnings=extractWarnings(lines);
const isEyesight=/eyesight|stereo camera/i.test(title+" "+text),requiresCalibration=isEyesight&&/\bcalibrat/i.test(text);
const requiredTools=requiresCalibration&&(/\bSSM\s?-?4\b|select monitor/i.test(text))?["subaru-ssm4"]:[];
const torque=extractTorque(text);
return {procedureId,title,parts,tools:toolDetails.map(t=>t.id),toolDetails,toolReferences,torque,torqueSpecs:groupTorque(torque),warnings,requiresCalibration,requiredTools};
}
function toRelationships(facts,minConfidence){
minConfidence=minConfidence===undefined?0.6:minConfidence;
const ids=rel=>facts.parts.filter(p=>p.relationship===rel&&p.confidence>=minConfidence).map(p=>p.id);
return {procedureId:facts.procedureId,requiredParts:ids("required"),recommendedParts:ids("recommended"),
serviceTargets:ids("target"),consumables:ids("consumable"),tools:[...new Set(facts.tools.concat(facts.requiredTools||[]))]};
}
const Engine={CATALOG,TOOLS,htmlToText,extractTorque,extractProcedure,toRelationships,slugify};
root.LifeOSRepairEngine=Engine;if(typeof module!=="undefined"&&module.exports)module.exports=Engine;

if(typeof document!=="undefined"){
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const load=()=>{try{return JSON.parse(localStorage.getItem(STORE))||{};}catch(_){return {};}};
const save=x=>{try{localStorage.setItem(STORE,JSON.stringify(x));}catch(e){alert("Could not save locally: "+e.message);}};
function mount(){
if(document.getElementById("repair-workspace"))return;
const style=document.createElement("style");
style.textContent="#repair-workspace{position:fixed;inset:0;z-index:99999;background:#050910d9;display:none;align-items:flex-end;justify-content:center;padding:12px}#repair-workspace.open{display:flex}#repair-workspace .rw-panel{width:min(820px,100%);max-height:92dvh;overflow:auto;background:#111923;color:#edf4ff;border:1px solid #34465b;border-radius:20px;padding:18px;box-shadow:0 20px 80px #000b}#repair-workspace .rw-head{display:flex;justify-content:space-between;align-items:center;gap:12px}#repair-workspace h2{margin:0;font-size:20px}#repair-workspace h3{font-size:14px;color:#ffb066;margin:16px 0 8px}#repair-workspace .muted{color:#9aacc1;font-size:12px}#repair-workspace .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}#repair-workspace .item{border:1px solid #2c3d51;background:#172333;border-radius:12px;padding:10px;display:flex;gap:9px;font-size:13px}#repair-workspace button{background:#223247;color:#f3f7ff;border:1px solid #3b526d;border-radius:10px;padding:9px 12px}#repair-workspace button.primary{background:#ff8a1f;color:#15191f;font-weight:800}#repair-workspace .line{padding:8px 0;border-bottom:1px solid #28394c;font-size:13px}#repair-workspace .cart{background:#0b121c;border:1px solid #293a4d;border-radius:12px;padding:12px}@media(max-width:540px){#repair-workspace{padding:0}#repair-workspace .rw-panel{border-radius:20px 20px 0 0;max-height:94dvh;padding:16px}#repair-workspace .grid{grid-template-columns:1fr}}";
document.head.append(style);const shell=document.createElement("div");shell.id="repair-workspace";
shell.innerHTML='<section class="rw-panel" role="dialog" aria-modal="true"><div class="rw-head"><div><h2>Repair Workspace</h2><div class="muted" id="rw-sub"></div></div><button id="rw-close">Close</button></div><div id="rw-content"></div></section>';
document.body.append(shell);shell.addEventListener("click",e=>{if(e.target===shell||e.target.id==="rw-close")shell.classList.remove("open");});
}
function openWorkspace(){
const frame=document.getElementById("fr"),doc=frame&&frame.contentDocument;
if(!doc||!doc.body){alert("Manual page is not ready yet.");return;}
mount();const title=doc.querySelector("h1")?.innerText||doc.title||"Manual procedure";
const facts=extractProcedure(doc.documentElement.outerHTML,{title});
const key=location.hash.replace(/^#\/v\//,"").replace(/[^a-z0-9/_-]/gi,"-")||frame.src;
const all=load(),small=document.querySelector(".vwrap .ht small")?.innerText||"";
const vehicle=small.split("•").slice(1).join("•").trim()||"Selected vehicle";
const cart=all[key]||{vehicle,procedure:title,items:[],tools:[]},selected=new Set((cart.items||[]).map(x=>x.id)),selectedTools=new Set(cart.tools||[]),savedTorque=new Map((cart.torqueSpecs||[]).map(x=>[x.id,x])),selectedTorque=new Set((cart.torqueSpecs||[]).map(x=>x.id));
const shell=document.getElementById("repair-workspace"),content=shell.querySelector("#rw-content");
shell.querySelector("#rw-sub").textContent=title+" · "+vehicle;
const visibleParts=facts.parts.filter(p=>p.relationship!== "mention" || p.confidence>=0.6);
const rows=visibleParts.map(p=>{
const evidence=(p.evidence||[]).slice(0,3).map(x=>esc(x.text)).join(" · ");
const oem=(p.oem||[]).map(x=>esc(x.manufacturer+" "+x.partNumber)).join(", ");
return '<label class="item"><input type="checkbox" data-part="'+esc(p.id)+'" '+(selected.has(p.id)?"checked":"")+'><span><b>'+esc(p.name)+'</b><br><span class="muted">'+esc(p.relationship)+' · '+Math.round(p.confidence*100)+'% confidence'+(oem?" · "+oem:"")+'</span><br><span class="muted">'+evidence+'</span></span></label>';
}).join("");
const toolRows=facts.toolDetails.map(t=>'<label class="item"><input type="checkbox" data-tool="'+esc(t.id)+'" '+(selectedTools.has(t.id)?"checked":"")+'><span>'+esc(t.name)+'</span></label>').join("");
const refs=facts.toolReferences.map(x=>'<div class="line">Manual tool reference: <b>'+esc(x.reference)+'</b></div>').join("");
const componentOptions=CATALOG.filter(p=>p.category!=="Consumable").map(p=>'<option value="'+esc(p.name)+'">'+esc(p.name)+'</option>').join("");const fastenerOptions=["Bolt(s)","Nut","Screw(s)","Stud(s)","Plug","Pulley mounting fastener","Other fastener"].map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join("");const torque=(facts.torqueSpecs||[]).map(group=>{const saved=savedTorque.get(group.id),association=saved&&saved.association||group.association,manual=!group.association;const componentSelect=CATALOG.filter(p=>p.category!=="Consumable").map(p=>'<option value="'+esc(p.name)+'" '+(association&&association.component===p.name?"selected":"")+'">'+esc(p.name)+'</option>').join("");const fastenerSelect=["Bolt(s)","Nut","Screw(s)","Stud(s)","Plug","Pulley mounting fastener","Other fastener"].map(x=>'<option value="'+esc(x)+'" '+(association&&association.fastener===x?"selected":"")+'">'+esc(x)+'</option>').join("");const enabled=group.consistent&&(group.selectable||Boolean(association&&association.component&&association.fastener));return '<div class="item"><div style="flex:1"><label><input type="checkbox" data-torque="'+esc(group.id)+'" '+(enabled&&selectedTorque.has(group.id)?"checked":"")+' '+(enabled?"":"disabled")+'> <b>'+esc(group.values.map(x=>x.value+" "+x.unit).join(" · "))+'</b></label><br><span class="muted">'+esc(association?association.component+" · "+association.fastener:"Unassigned torque") + '</span><br><span class="muted">'+esc(group.nearbyContext||group.context)+'</span><br><span class="muted">'+esc(group.consistent?(enabled?"Ready to add to cart":"Assign a component and fastener to enable selection"):"Not selectable: "+group.reviewReason)+'</span>'+(manual?'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px"><label class="muted">Assign component<select data-torque-component="'+esc(group.id)+'" style="display:block;width:100%;padding:8px;background:#0b121c;color:#edf4ff;border:1px solid #3b526d;border-radius:8px"><option value="">Choose component…</option>'+componentSelect+'</select></label><label class="muted">Fastener<select data-torque-fastener="'+esc(group.id)+'" style="display:block;width:100%;padding:8px;background:#0b121c;color:#edf4ff;border:1px solid #3b526d;border-radius:8px"><option value="">Choose fastener…</option>'+fastenerSelect+'</select></label></div>':"")+'</div></div>';}).join("");
const warnings=facts.warnings.map(x=>'<div class="line"><b>'+esc(x.type)+'</b> '+esc(x.text)+'</div>').join("");
content.innerHTML='<h3>Parts and service targets</h3><div class="muted">Required means the procedure explicitly calls for replacement. Service targets are components being worked on, not proof that a new part is needed. Review evidence before adding items to the cart.</div><div class="grid">'+(rows||'<div class="muted">No catalog matches found.</div>')+'</div><h3>Tools</h3><div class="grid">'+(toolRows||'<div class="muted">No catalog tool matches found.</div>')+'</div>'+refs+'<h3>Torque specifications</h3>'+(torque||'<div class="muted">No torque values detected.</div>')+'<h3>Warnings and notes</h3>'+(warnings||'<div class="muted">No explicit warning or note labels detected.</div>')+(facts.requiresCalibration?'<div class="line">EyeSight-related calibration language detected. Verify the exact calibration procedure and equipment requirements before returning the vehicle to service.</div>':"")+'<div class="cart"><h3>Repair cart</h3><div id="rw-lines"></div><p class="muted">Stored in this browser only. No account or server sync.</p><button class="primary" id="rw-save">Save cart</button> <button id="rw-export">Export JSON</button> <button id="rw-clear">Clear</button></div>';
const snapshot=()=>{
const items=Array.from(content.querySelectorAll("[data-part]:checked")).map(el=>facts.parts.find(p=>p.id===el.dataset.part)).filter(Boolean);
const tools=Array.from(content.querySelectorAll("[data-tool]:checked")).map(el=>el.dataset.tool);
const torqueSpecs=Array.from(content.querySelectorAll("[data-torque]:checked")).map(el=>{const group=(facts.torqueSpecs||[]).find(x=>x.id===el.dataset.torque);if(!group)return null;const component=content.querySelector('[data-torque-component="'+group.id+'"]')?.value,fastener=content.querySelector('[data-torque-fastener="'+group.id+'"]')?.value;const association=group.association||((component&&fastener)?{component,fastener,evidence:"User-assigned in Repair Workspace",associationSource:"user"}:null);return {...group,association};}).filter(Boolean);
const lines=items.map(p=>'<div class="line">'+esc(p.name)+' · '+esc(p.relationship)+' · '+Math.round(p.confidence*100)+'%</div>').join("")+tools.map(t=>'<div class="line">Tool: '+esc(t)+'</div>').join("")+torqueSpecs.map(group=>'<div class="line">Torque: '+esc(group.values.map(x=>x.value+" "+x.unit).join(" · "))+'</div>').join("");
content.querySelector("#rw-lines").innerHTML=lines||'<div class="muted">Cart is empty.</div>';
return {vehicle,procedure:title,source:frame.src,items:items.map(p=>({id:p.id,name:p.name,relationship:p.relationship,confidence:p.confidence,oem:p.oem})),tools,torqueSpecs,torque:torqueSpecs.flatMap(group=>group.values.map(value=>({...value,context:group.context}))),warnings:facts.warnings};
};
snapshot();
content.addEventListener("change",e=>{if(e.target.matches("[data-torque-component],[data-torque-fastener]")){const id=e.target.dataset.torqueComponent||e.target.dataset.torqueFastener,component=content.querySelector('[data-torque-component="'+id+'"]')?.value,fastener=content.querySelector('[data-torque-fastener="'+id+'"]')?.value,check=content.querySelector('[data-torque="'+id+'"]');if(check){check.disabled=!(component&&fastener);if(check.disabled)check.checked=false;const label=check.closest(".item"),status=label&&label.querySelector(".muted:last-child");if(status)status.textContent=check.disabled?"Assign a component and fastener to enable selection":"Manual assignment ready — review before adding to cart";}}if(e.target.matches("[data-part],[data-tool],[data-torque]"))snapshot();});
content.querySelector("#rw-save").onclick=()=>{all[key]=snapshot();save(all);alert("Repair cart saved on this device.");};
content.querySelector("#rw-export").onclick=()=>{const blob=new Blob([JSON.stringify(snapshot(),null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="repair-cart.json";a.click();URL.revokeObjectURL(url);};
content.querySelector("#rw-clear").onclick=()=>{content.querySelectorAll("[data-part],[data-tool],[data-torque]").forEach(x=>x.checked=false);snapshot();};
shell.classList.add("open");
}
document.addEventListener("click",e=>{const b=e.target.closest("[data-repair-workspace]");if(b){e.preventDefault();openWorkspace();}});
}
})(typeof globalThis!=="undefined"?globalThis:this);
