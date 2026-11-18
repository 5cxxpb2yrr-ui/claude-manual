(() => {
"use strict";
const STORE="lifeos.repair.carts.v1";
const CATALOG=[
["water-pump","Water pump",["water pump"]],["water-pump-gasket","Water pump gasket",["water pump gasket","water pump o-ring"]],
["thermostat","Thermostat",["thermostat"]],["radiator","Radiator",["radiator"]],["radiator-hose","Radiator hose",["radiator hose"]],
["drive-belt","Drive belt",["drive belt","serpentine belt"]],["valve-cover-gasket","Valve cover gasket",["valve cover gasket"]],
["oil-filter","Oil filter",["oil filter"]],["drain-plug-gasket","Drain plug gasket",["drain plug gasket","drain plug washer"]],
["spark-plug","Spark plug",["spark plug"]],["ignition-coil","Ignition coil",["ignition coil"]],["air-filter","Engine air filter",["air filter","air cleaner element"]],
["cabin-air-filter","Cabin air filter",["cabin air filter","cabin filter"]],["fuel-filter","Fuel filter",["fuel filter"]],
["fuel-injector","Fuel injector",["fuel injector","injector"]],["oxygen-sensor","Oxygen sensor",["oxygen sensor","o2 sensor"]],
["battery","Battery",["battery"]],["alternator","Alternator",["alternator"]],["starter","Starter motor",["starter motor"]],
["brake-pad","Brake pads",["brake pad"]],["brake-rotor","Brake rotor",["brake rotor","brake disc"]],
["brake-caliper","Brake caliper",["brake caliper","caliper"]],["wheel-bearing","Wheel bearing",["wheel bearing","hub bearing"]],
["strut","Strut assembly",["strut assembly","strut"]],["control-arm","Control arm",["control arm","lower arm"]],
["ball-joint","Ball joint",["ball joint"]],["tie-rod-end","Tie rod end",["tie rod end","tie rod"]],["cv-axle","CV axle",["cv axle","drive shaft"]],
["windshield","Windshield",["windshield"]],["eyesight-camera","EyeSight stereo camera",["eyesight camera","stereo camera","eyesight"]],
["wiper-blade","Wiper blade",["wiper blade"]],["ac-compressor","A/C compressor",["a/c compressor","ac compressor"]],
["coolant","Coolant",["coolant","antifreeze"]],["engine-oil","Engine oil",["engine oil"]],["brake-fluid","Brake fluid",["brake fluid"]],
["cvt-fluid","CVT fluid",["cvt fluid"]],["atf","Automatic transmission fluid",["automatic transmission fluid","transmission fluid"]],
["sealant","Gasket sealant (FIPG)",["sealant","fipg"]],["grease","Grease",["grease"]]
];
const TOOLS=[["torque-wrench","Torque wrench",/torque wrench/i],["jack-stands","Jack stands",/jack stands?|safety stands?/i],["flare-nut-wrench","Flare-nut wrench",/flare[- ]nut wrench|line wrench/i],["coolant-pressure-tester","Cooling-system pressure tester",/pressure tester/i],["brake-bleeder","Brake bleeder",/brake bleeder|pressure bleeder/i],["special-service-tool","Special service tool (SST)",/\bSST\b|special (service )?tool/i],["subaru-ssm4","Subaru Select Monitor 4 (SSM4)",/\bSSM\s?-?4\b|select monitor/i]];
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const load=()=>{try{return JSON.parse(localStorage.getItem(STORE))||{}}catch{return {}}};
const save=x=>{try{localStorage.setItem(STORE,JSON.stringify(x))}catch(e){alert("Could not save locally: "+e.message)}};
function extract(html,title){
 const d=new DOMParser().parseFromString(html,"text/html"), raw=d.body?.innerText||d.body?.textContent||"", lines=raw.split(/\n+/).map(x=>x.trim()).filter(Boolean), text=lines.join(" ");
 const parts=new Map();
 CATALOG.forEach(([id,name,aliases])=>aliases.forEach(alias=>{
  const pattern=alias.replace(/[.*+?^|()]/g,"\\$&"), re=new RegExp("(^|[^a-z0-9])"+pattern+"(?:s|es)?([^a-z0-9]|$)","i"), matches=lines.filter(line=>re.test(line));
  if(!matches.length)return;
  const evidence=matches.slice(0,5), joined=evidence.join(" "), consumable=["coolant","engine-oil","brake-fluid","cvt-fluid","atf","sealant","grease"].includes(id);
  const required=/replace|always replace|must be replaced|renew|install a new|new/i.test(joined)||new RegExp(pattern+"\\s+(replacement|removal|installation)","i").test(title);
  const recommended=/recommend|should also be replaced|at the same time|also replace|consider replacing/i.test(joined);
  const relationship=consumable?"consumable":required?"required":recommended?"recommended":"mention", confidence=required?.8:recommended?.68:consumable?.65:.35, old=parts.get(id);
  if(!old||confidence>old.confidence)parts.set(id,{id,name,relationship,confidence,evidence});
 }));
 const torque=[], re=/(\d+(?:\.\d+)?)\s*(N\s*[·.\-•]?\s*m|kgf\s*[·.\-•]?\s*(?:m|cm)|ft\s*[·.\-•]?\s*lbf?|in\s*[·.\-•]?\s*lbf?)/gi;
 lines.forEach(line=>{let m;while((m=re.exec(line)))torque.push({value:m[1],unit:m[2],context:line.slice(0,180)});re.lastIndex=0});
 return {parts:[...parts.values()].sort((a,b)=>({required:0,recommended:1,consumable:2,mention:3}[a.relationship]-{required:0,recommended:1,consumable:2,mention:3}[b.relationship])),torque,tools:TOOLS.filter(x=>x[2].test(text)).map(x=>({id:x[0],name:x[1]})),warnings:lines.filter(x=>/^(warning|caution|notice)\b/i.test(x)).slice(0,20),requiresCalibration:/eyesight|stereo camera/i.test(title+" "+text)&&/calibrat/i.test(text)};
}
function mount(){
 if(document.getElementById("repair-workspace"))return;
 const style=document.createElement("style");style.textContent="#repair-workspace{position:fixed;inset:0;z-index:99999;background:#050910c9;display:none;align-items:flex-end;justify-content:center;padding:12px}#repair-workspace.open{display:flex}#repair-workspace .rw-panel{width:min(760px,100%);max-height:92dvh;overflow:auto;background:#111923;color:#edf4ff;border:1px solid #34465b;border-radius:20px;padding:18px;box-shadow:0 20px 80px #000b}#repair-workspace .rw-head{display:flex;justify-content:space-between;align-items:center;gap:12px}#repair-workspace h2{margin:0;font-size:20px}#repair-workspace h3{font-size:14px;color:#ffb066;margin:16px 0 8px}#repair-workspace .muted{color:#9aacc1;font-size:12px}#repair-workspace .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}#repair-workspace .item{border:1px solid #2c3d51;background:#172333;border-radius:12px;padding:10px;display:flex;gap:9px;font-size:13px}#repair-workspace button{background:#223247;color:#f3f7ff;border:1px solid #3b526d;border-radius:10px;padding:9px 12px}#repair-workspace button.primary{background:#ff8a1f;color:#15191f;font-weight:800}#repair-workspace .line{padding:8px 0;border-bottom:1px solid #28394c;font-size:13px}#repair-workspace .cart{background:#0b121c;border:1px solid #293a4d;border-radius:12px;padding:12px}@media(max-width:540px){#repair-workspace{padding:0}#repair-workspace .rw-panel{border-radius:20px 20px 0 0;max-height:94dvh;padding:16px}#repair-workspace .grid{grid-template-columns:1fr}}";
 document.head.append(style);const root=document.createElement("div");root.id="repair-workspace";root.innerHTML='<section class="rw-panel" role="dialog" aria-modal="true"><div class="rw-head"><div><h2>Repair Workspace</h2><div class="muted" id="rw-sub"></div></div><button id="rw-close">Close</button></div><div id="rw-content"></div></section>';document.body.append(root);
 root.addEventListener("click",e=>{if(e.target===root||e.target.id==="rw-close")root.classList.remove("open")});
}
function open(){
 const frame=document.getElementById("fr"),doc=frame?.contentDocument;if(!doc?.body){alert("Manual page is not ready yet.");return}
 mount();const title=doc.querySelector("h1")?.innerText||doc.title||"Manual procedure",f=extract(doc.body.innerHTML,title),id=location.hash.replace(/^#\/v\//,""),all=load(),cart=all[id]||{vehicle:document.querySelector(".vwrap .ht small")?.innerText||"Selected vehicle",procedure:title,items:[],tools:[]};
 const chosen=new Set(cart.items.map(x=>x.id)),chosenTools=new Set(cart.tools),root=document.getElementById("repair-workspace"),content=root.querySelector("#rw-content");root.querySelector("#rw-sub").textContent=title+" · "+cart.vehicle;
 const rows=f.parts.map(p=>'<label class="item"><input type="checkbox" data-part="'+p.id+'" '+(chosen.has(p.id)?"checked":"")+'><span><b>'+esc(p.name)+'</b><br><span class="muted">'+esc(p.relationship)+' · '+Math.round(p.confidence*100)+'% confidence</span><br><span class="muted">'+esc(p.evidence[0]||"")+'</span></span></label>').join("");
 const toolRows=f.tools.map(t=>'<label class="item"><input type="checkbox" data-tool="'+t.id+'" '+(chosenTools.has(t.id)?"checked":"")+'><span>'+esc(t.name)+'</span></label>').join("");
 content.innerHTML='<h3>Parts detected</h3><div class="muted">Heuristic matches only. Confirm fitment, OEM numbers, and required quantities against the factory manual.</div><div class="grid">'+(rows||'<div class="muted">No catalog matches found.</div>')+'</div><h3>Tools</h3><div class="grid">'+(toolRows||'<div class="muted">No catalog tool matches found.</div>')+'</div><h3>Torque specifications</h3>'+(f.torque.map(t=>'<div class="line"><b>'+esc(t.value+" "+t.unit)+'</b> — '+esc(t.context)+'</div>').join("")||'<div class="muted">No torque values detected.</div>')+'<h3>Warnings and notices</h3>'+(f.warnings.map(w=>'<div class="line">'+esc(w)+'</div>').join("")||'<div class="muted">No explicit warning headings detected.</div>')+(f.requiresCalibration?'<div class="line">EyeSight-related calibration language detected. Verify required calibration and equipment in the factory procedure.</div>':"")+'<div class="cart"><h3>Repair cart</h3><div id="rw-lines"></div><p class="muted">Stored in this browser only. No account or server sync.</p><button class="primary" id="rw-save">Save cart</button> <button id="rw-export">Export JSON</button> <button id="rw-clear">Clear</button></div>';
 const snapshot=()=>{const items=[...content.querySelectorAll("[data-part]:checked")].map(el=>f.parts.find(p=>p.id===el.dataset.part)).filter(Boolean),tools=[...content.querySelectorAll("[data-tool]:checked")].map(el=>f.tools.find(t=>t.id===el.dataset.tool)).filter(Boolean);content.querySelector("#rw-lines").innerHTML=items.map(p=>'<div class="line">'+esc(p.name)+' · '+esc(p.relationship)+'</div>').join("")+tools.map(t=>'<div class="line">Tool: '+esc(t.name)+'</div>').join("")||'<div class="muted">Cart is empty.</div>';return {vehicle:cart.vehicle,procedure:title,source:location.href,items:items.map(({id,name,relationship,confidence})=>({id,name,relationship,confidence})),tools:tools.map(t=>t.id),torque:f.torque,warnings:f.warnings}};
 snapshot();content.querySelector("#rw-save").onclick=()=>{all[id]=snapshot();save(all);alert("Repair cart saved on this device.")};content.querySelector("#rw-export").onclick=()=>{const blob=new Blob([JSON.stringify(snapshot(),null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="repair-cart.json";a.click();URL.revokeObjectURL(a.href)};content.querySelector("#rw-clear").onclick=()=>{content.querySelectorAll("[data-part],[data-tool]").forEach(x=>x.checked=false);snapshot()};root.classList.add("open");
}
document.addEventListener("click",e=>{const b=e.target.closest("[data-repair-workspace]");if(b){e.preventDefault();open()}});
})();