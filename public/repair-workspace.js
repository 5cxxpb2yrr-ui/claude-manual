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
["wheel-brake-cylinder","Wheel Brake Cylinder","Brakes",["wheel brake cylinder","brake wheel cylinder"],["brake-fluid"]],
["brake-line","Brake Line","Brakes",["brake line","brake pipe"],[]],
["wheel","Wheel","Suspension",["rear wheel","front wheel","wheel assembly"],["wheel-nut"]],
["wheel-nut","Wheel Nut","Suspension",["wheel nut","wheel nuts","lug nut","lug nuts"],[]],
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
const TORQUE_RE=/(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)\s*(N\s*[·.*\-•×]*\s*m|kgf\s*[·.*\-•×]*\s*(?:m|cm)|ft\s*[·.*\-•×]*\s*(?:lbf?|lbs?)|in(?:ch)?\s*[·.*\-•×]*\s*(?:lbf?|lbs?))(?![a-z])/gi;
function normalizeTorqueUnit(raw){
 const u=raw.toLowerCase().replace(/[^a-z]/g,"");
 if(u.startsWith("kgf"))return u.endsWith("cm")?"kgf·cm":"kgf·m";
 if(u.startsWith("ft"))return "ft·lbf";
 if(u.startsWith("in"))return "in·lbf";
 return "N·m";
}
const TORQUE_TO_NM={"N·m":1,"kgf·cm":0.0980665,"kgf·m":9.80665,"ft·lbf":1.355817948,"in·lbf":0.112984829};
function stepContext(text,index){
 const before=text.slice(0,index);
 // Zero-width matching finds every numbered step even when several share one HTML paragraph.
 const numbered=/(?=(?:^|\s)\d{1,2}\.\s+[A-Z][A-Z0-9 /-]{3,})/g;
 const parentMatches=[...before.matchAll(numbered)];
 const parent=parentMatches[parentMatches.length-1];
 const parentStart=parent?parent.index+(before[parent.index]&&/\s/.test(before[parent.index])?1:0):Math.max(0,index-280);
 const after=text.slice(index);
 const nextNumbered=numbered.exec(after);
 const hardEnd=nextNumbered?index+nextNumbered.index:Math.min(text.length,index+500);
 const section=text.slice(parentStart,hardEnd);
 const substep=/(?:^|\s)([a-z]\)\s+)/gi;
 const sectionSubsteps=[...section.matchAll(substep)];
 const firstSubstep=sectionSubsteps[0];
 const titleEnd=firstSubstep?firstSubstep.index+firstSubstep[0].lastIndexOf(firstSubstep[1]):0;
 const parentTitle=titleEnd?text.slice(parentStart,parentStart+titleEnd).trim():"";
 const beforeTorque=section.slice(0,index-parentStart);
 const priorSubsteps=[...beforeTorque.matchAll(substep)];
 const activeSubstep=priorSubsteps[priorSubsteps.length-1];
 const segmentStart=activeSubstep?parentStart+activeSubstep.index+activeSubstep[0].lastIndexOf(activeSubstep[1]):parentStart;
 const remaining=text.slice(index,hardEnd);
 const nextSubstep=/(?:^|\s)[a-z]\)\s+/i.exec(remaining);
 const end=nextSubstep?index+nextSubstep.index:hardEnd;
 const segment=text.slice(segmentStart,end);
 return (parentTitle&&segmentStart!==parentStart?parentTitle+" ":"")+segment.replace(/\s+/g," ").trim();
}
function extractTorque(text){
 const source=String(text),out=[];TORQUE_RE.lastIndex=0;let m;
 while((m=TORQUE_RE.exec(source))){
  const lineStart=source.lastIndexOf("\n",m.index)+1,lineEnd=source.indexOf("\n",m.index);
  const line=source.slice(lineStart,lineEnd<0?source.length:lineEnd);
  out.push({value:Number(m[1].replace(/,/g,"")),unit:normalizeTorqueUnit(m[2]),matchIndex:m.index,context:line.trim().slice(0,360),nearbyContext:stepContext(source,m.index),lineIndex:source.slice(0,m.index).split("\n").length-1});
 }
 return out;
}
function groupTorque(torque,text,title){
 const groups=[];
 torque.forEach(item=>{
  let group=groups[groups.length-1];
  if(item.unit==="N·m"||!group||(group.lineIndex!==item.lineIndex&&group.stepContext!==item.nearbyContext)){
   group={id:"torque-"+groups.length,lineIndex:item.lineIndex,startIndex:item.matchIndex,context:item.context,nearbyContext:item.nearbyContext,stepContext:item.nearbyContext,values:[]};
   groups.push(group);
  }
  group.values.push({value:item.value,unit:item.unit});
 });
 return groups.map(group=>{
  const evidence=group.stepContext||group.nearbyContext||group.context;
  let association=null;
  // Toyota generator installation pages use HTML list items and explicit A/B labels.
  // Do not infer a fastener from surrounding unrelated steps.
  if(/\b(?:generator|alternator)\s*:\s*installation\b/i.test(title||"")){
   const line=group.context;
   const bolt=/\bfor bolt ([AB])\b/i.exec(line);
   const preceding=String(text||"").slice(0,group.startIndex).split("\n");
   const step=preceding.slice(0,-1).reverse().find(x=>/^\s*-\s/.test(x))||"";
   if(bolt)association={component:"Alternator",fastener:"Bolt "+bolt[1].toUpperCase(),evidence:line,associationSource:"Explicit factory torque label"};
   else if(/install the generator wire with the nut/i.test(line))association={component:"Alternator wire",fastener:"Nut",evidence:line,associationSource:"Explicit factory installation step"};
   else if(/adjusting bar.*tighten the nut/i.test(step))association={component:"Alternator adjusting bar",fastener:"Nut",evidence:step+" "+line,associationSource:"Explicit preceding factory installation step"};
  }
  else if(/install (?:the )?water pump assembly/i.test(evidence)&&/\bbolts?\b/i.test(evidence))
   association={component:"Water Pump Assembly",fastener:/\bnuts?\b/i.test(evidence)?"Bolts and nuts":"Bolts",evidence,associationSource:"Numbered installation step explicitly identifies the water pump assembly fasteners"};
  else if(/install (?:the )?(?:water )?pump pulley/i.test(evidence)&&/\bbolts?\b/i.test(evidence))
   association={component:"Water Pump Pulley",fastener:"Bolts",evidence,associationSource:"Numbered installation step explicitly identifies the water pump pulley fasteners"};
  else if(/wheel brake cylinder|brake wheel cylinder/i.test(evidence)&&/\bbolt\b/i.test(evidence))
   association={component:"Wheel Brake Cylinder",fastener:"Bolt",evidence,associationSource:"Procedure step explicitly identifies wheel brake cylinder bolt"};
  else if(/connect the brake line|brake line fitting|brake pipe/i.test(evidence))
   association={component:"Brake Line",fastener:"Brake line fitting",evidence,associationSource:"Procedure step explicitly identifies brake-line connection"};
  else if(/install (?:the )?(?:rear|front) wheel|wheel nuts?|lug nuts?/i.test(evidence))
   association={component:"Wheel",fastener:"Wheel nuts",evidence,associationSource:"Procedure step identifies wheel installation"};
  else if(/PULLEY WRENCH PIN SET/i.test(evidence)&&/\bV[- ]BELTS?\b/i.test(evidence))
   association={component:"Water Pump Pulley",fastener:"Pulley mounting fastener",evidence,associationSource:"Pulley holding tool and belt-installation sequence identify the pulley fastener"};
  else {
   const parts=matchParts(evidence).filter(p=>p.category!=="Consumable");
   const fastener=/\b(bolts?|nuts?|screws?|studs?|plugs?|clips?|pins?|clamps?|retainers?|fittings?)\b/i.exec(evidence);
   const component=parts.find(p=>p.category!=="Consumable");
   if(component&&fastener)association={component:component.name,fastener:fastener[1].replace(/s$/i,""),evidence,associationSource:"Identified from the same procedure step"};
  }
  const converted=group.values.map(v=>v.value*(TORQUE_TO_NM[v.unit]||1));
  const min=Math.min(...converted),max=Math.max(...converted);
  const consistent=converted.length<2||((max-min)/Math.max((max+min)/2,0.0001)<=0.05);
  return {...group,association,consistent,selectable:Boolean(association&&consistent),reviewReason:!consistent?"Conflicting unit conversions":!association?"Fastener/component is not identified in the procedure step":""};
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
const RELATED_PROCEDURE_LABELS=new Set(["testing and inspection","removal and installation","disassembly and reassembly","specifications"]);
function findRelatedProcedureLinks(html,baseUrl){
 const links=[],seen=new Set();
 const anchors=[...String(html||"").matchAll(/<a\b[^>]*>[\s\S]*?<\/a>/gi)];
 anchors.forEach(match=>{
  const tag=match[0],hrefMatch=/\bhref\s*=\s*["']([^"']+)["']/i.exec(tag);
  const label=strip(tag.replace(/<[^>]+>/g," ")).toLowerCase();
  if(!hrefMatch||!RELATED_PROCEDURE_LABELS.has(label))return;
  try{const url=new URL(hrefMatch[1],baseUrl);if(url.origin!==new URL(baseUrl).origin||!url.pathname.includes("/pages/")||seen.has(url.href))return;seen.add(url.href);links.push({label:strip(tag.replace(/<[^>]+>/g," ")),url:url.href,page:(/\/pages\/(\d+)(?:\.html)?$/i.exec(url.pathname)||[])[1]||""});}catch(_){}
 });
 return links;
}

function findScionSiblingSpecificationPages(tree,pageId){
 const wanted=String(pageId);let targetPath=null;
 function locate(node,path){
  for(const child of node.c||[]){
   const next=[...path,child];
   if(child.p!==undefined&&String(child.p)===wanted){targetPath=next;return true;}
   if(child.c&&locate(child,next))return true;
  }
  return false;
 }
 locate(tree,[]);
 if(!targetPath)return [];
 let component="";
 for(let i=targetPath.length-1;i>=0;i--){
  const name=String(targetPath[i].n||"").trim();
  const head=name.split(":")[0].trim();
  if(/^(removal and installation|disassembly and reassembly|removal|installation|testing and inspection|specifications|service and repair|key to diagrams)$/i.test(head))continue;
  const candidate=head.replace(/\b(?:assembly|unit|subassembly|remove|replace|install|overhaul|testing|inspection|service|repair|specifications)\b/gi," ").replace(/\s+/g," ").trim();
  if(candidate&&!/^(additional pages|part \d+|other variant|electrical|charging system)$/i.test(candidate)){
   component=candidate;break;
  }
 }
 if(!component)return [];
 const norm=value=>String(value||"").toLowerCase().replace(/[^a-z0-9]+/g," ").trim();
 const componentKey=norm(component),containers=[...targetPath.slice(0,-1).reverse(),tree];
 for(const container of containers){
  const matches=[];
  function collect(node,path){
   for(const child of node.c||[]){
    const next=[...path,String(child.n||"")];
    if(child.p!==undefined&&String(child.p)!==wanted&&/specifications?/i.test(child.n||"")&&norm(next.join(" ")).includes(componentKey)){
     matches.push({page:String(child.p),label:String(child.n),component,path:next});
    }
    if(child.c)collect(child,next);
   }
  }
  collect(container,[String(container.n||"")]);
  if(matches.length){
   matches.sort((a,b)=>{
    const exactA=norm(a.label)===norm(component+": Specifications")?0:1;
    const exactB=norm(b.label)===norm(component+": Specifications")?0:1;
    return exactA-exactB||a.page.localeCompare(b.page,undefined,{numeric:true});
   });
   return matches;
  }
 }
 return [];
}
async function findScionSiblingSpecificationLinks(pageUrl){
 if(!/scion-service-manual/i.test(pageUrl.pathname))return [];
 const match=/\/pages\/(\d+)\.html$/i.exec(pageUrl.pathname);
 if(!match)return [];
 try{
  const routeMatch=/^#\/v\/\d+\/(\d+)\//.exec(location.hash||"");
  const preferred=routeMatch&&Number(routeMatch[1])===1
   ?["scion-parts.json","scion-repair.json"]
   :["scion-repair.json","scion-parts.json"];
  const trees=await Promise.all(preferred.map(async filename=>{
   try{
    const response=await fetch("/api/navigation/"+filename,{credentials:"same-origin",cache:"no-store"});
    return response.ok?await response.json():null;
   }catch(_){return null;}
  }));
  const combined={c:trees.filter(Boolean)};
  return findScionSiblingSpecificationPages(combined,match[1]).map(page=>{
   const url=new URL(pageUrl.href);url.pathname=url.pathname.replace(/\/pages\/\d+\.html$/i,"/pages/"+page.page+".html");
   return {...page,url:url.href};
  });
 }catch(_){return [];}
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
return {procedureId,title,pageText:text,parts,tools:toolDetails.map(t=>t.id),toolDetails,toolReferences,torque,torqueSpecs:groupTorque(torque,text,title),warnings,requiresCalibration,requiredTools};
}
function torqueAssignmentOptions(facts){const components=(facts.parts||[]).filter(p=>p.category!=="Consumable"&&(p.relationship!=="mention"||p.confidence>=0.6)).map(p=>p.name);const text=facts.pageText||"";const fasteners=[];[["Bolt(s)",/\bbolts?\b/i],["Nut(s)",/\bnuts?\b/i],["Screw(s)",/\bscrews?\b/i],["Stud(s)",/\bstuds?\b/i],["Plug(s)",/\bplugs?\b/i]].forEach(([name,re])=>{if(re.test(text))fasteners.push(name);});if(/PULLEY WRENCH PIN SET/i.test(text)&&/\bV[- ]BELTS?\b/i.test(text))fasteners.push("Pulley mounting fastener");if(/\bfastener\b/i.test(text))fasteners.push("Other fastener");return {components:[...new Set(components)],fasteners};}function toRelationships(facts,minConfidence){
minConfidence=minConfidence===undefined?0.6:minConfidence;
const ids=rel=>facts.parts.filter(p=>p.relationship===rel&&p.confidence>=minConfidence).map(p=>p.id);
return {procedureId:facts.procedureId,requiredParts:ids("required"),recommendedParts:ids("recommended"),
serviceTargets:ids("target"),consumables:ids("consumable"),tools:[...new Set(facts.tools.concat(facts.requiredTools||[]))]};
}

// Read actual ordered-list boundaries before flattening the document.
// Only explicit factory procedure lists qualify, not index or parts lists.
function extractFactoryListSteps(html){
 const source=String(html||"").replace(/<(script|style|noscript)\b[\s\S]*?<\/\1>/gi,"");
 const tokens=/<\/?(?:ol|ul|li)\b[^>]*>/gi;
 const stack=[],items=[];let current=null,m;
 while((m=tokens.exec(source))){
  const tag=m[0],closing=/^<\//.test(tag),name=/^<\/?(\w+)/.exec(tag)[1].toLowerCase();
  if(name==="ol"||name==="ul"){
   if(!closing){
    const factory=name==="ol"&&/\bclass\s*=\s*["'][^"']*\bARABICNUM\b[^"']*["']/i.test(tag)&&!stack.length;
    stack.push({name,factory});
   }else{
    if(current&&stack.length===1&&stack[0].factory){items.push(source.slice(current.start,m.index));current=null;}
    stack.pop();
   }
   continue;
  }
  if(stack.length!==1||!stack[0].factory)continue;
  if(!closing){if(current)items.push(source.slice(current.start,m.index));current={start:tokens.lastIndex};}
  else if(current){items.push(source.slice(current.start,m.index));current=null;}
 }
 const steps=[];
 for(const item of items){
  const heading=/<span\b[^>]*class\s*=\s*["'][^"']*\bclsEmphBOLD\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i.exec(item);
  // Heading must begin the item; do not mistake an inline torque value for a step.
  if(!heading||htmlToText(item.slice(0,heading.index)).trim())continue;
  const title=htmlToText(heading[1]).replace(/\s+/g," ").trim();
  if(!/^(?:(?:TEMPORARILY\s+)?TIGHTEN|INSTALL|REMOVE|CHECK|INSPECT|DISCONNECT|CONNECT|ADJUST|LOOSEN|DRAIN|FILL|REPLACE|CLEAN|APPLY|SET|REPAIR|MEASURE|VERIFY|BLEED|REFILL|TORQUE|LUBRICATE|POSITION|SECURE|SUPPORT|LOWER|RAISE|ALIGN|SEPARATE|ATTACH|DETACH|PREPARE|RESET|INITIALIZE)\b/i.test(title))continue;
  const detail=htmlToText(item.slice(heading.index+heading[0].length));
  const number=steps.length+1;
  const safetyCritical=/\b(brake|airbag|srs|fuel|high pressure|spring|strut|suspension|steering|jack|support vehicle|lift vehicle|high voltage|hybrid battery|ev battery|coolant under pressure|hot coolant|flammable|fire|battery terminal|disconnect battery|torque.*wheel|wheel.*torque)\b/i.test(title+" "+detail);
  steps.push({id:"step-"+number+"-"+slugify(title),number,title,detail,instruction:title+(detail?"\n"+detail:""),safetyCritical,requiresPrevious:number>1});
 }
 // Never silently drop an unrecognized top-level factory step.
 return steps.length===items.length?steps:[];
}
function extractRepairSteps(text,html){
 const listSteps=extractFactoryListSteps(html);
 if(listSteps.length)return listSteps;
 const source=String(text||"");
 const heading=/\b(\d{1,2})\.\s+((?:INSTALL|REMOVE|CHECK|INSPECT|DISCONNECT|CONNECT|ADJUST|TIGHTEN|LOOSEN|DRAIN|FILL|REPLACE|CLEAN|APPLY|SET|REPAIR|MEASURE|VERIFY|BLEED|REFILL|TORQUE|LUBRICATE|POSITION|SECURE|SUPPORT|LOWER|RAISE|ALIGN|SEPARATE|ATTACH|DETACH|PREPARE|RESET|INITIALIZE)\b[A-Z0-9 /(),.&'-]{2,90}?)(?=\s+[a-z]\)\s+|\s+\d{1,2}\.\s+|\n|$)/g;
 const matches=[...source.matchAll(heading)],seen=new Set(),steps=[];
 matches.forEach((m,i)=>{
  const number=Number(m[1]),title=m[2].trim().replace(/\s+/g," "),id="step-"+number+"-"+slugify(title);
  if(seen.has(id))return;seen.add(id);
  const start=m.index+m[0].length,end=i+1<matches.length?matches[i+1].index:Math.min(source.length,start+1800);
  const detail=source.slice(start,end).replace(/^\s+/,"").replace(/\s+/g," ").trim().slice(0,1400);
  const safetyCritical=/\b(brake|airbag|srs|fuel|fuel line|high pressure|spring|strut|suspension|steering|jack|support vehicle|lift vehicle|high voltage|hybrid battery|ev battery|coolant under pressure|hot coolant|flammable|fire|battery terminal|disconnect battery|torque.*wheel|wheel.*torque)\b/i.test(title+" "+detail);
  const requiresPrevious=/\bafter (?:remov(?:e|al|ing)|install(?:ation)?|disconnect(?:ing)?|connect(?:ing)?|adjust(?:ment)?|bleed(?:ing)?|drain(?:ing)?|refill(?:ing)?)\b|\bonce (?:the|this|that)\b|\bbefore (?:install|connect|lower|start|operate|drive)\b|\bfollowing (?:the|this)\b/i.test(detail);
  steps.push({id,number,title,instruction:(title+(detail?" — "+detail:"")).trim(),detail,safetyCritical,requiresPrevious});
 });
 return steps;
}
function repairStepCanOpen(steps,states,index){
 const step=steps[index];if(!step)return false;
 if(!step.safetyCritical&&!step.requiresPrevious)return true;
 return steps.slice(0,index).every(previous=>states[previous.id]?.status==="done");
}
function repairProgress(steps,states){
 const done=steps.filter(x=>states[x.id]?.status==="done").length,skipped=steps.filter(x=>states[x.id]?.status==="skipped").length,safetySkipped=steps.filter(x=>x.safetyCritical&&states[x.id]?.status==="skipped").length;
 return {total:steps.length,done,skipped,remaining:steps.length-done-skipped,percent:steps.length?Math.round(done/steps.length*100):0,safetySkipped,canFinish:steps.length>0&&done+skipped===steps.length&&safetySkipped===0};
}
const Engine={CATALOG,TOOLS,htmlToText,extractFactoryListSteps,findRelatedProcedureLinks,findScionSiblingSpecificationPages,extractTorque,extractProcedure,extractRepairSteps,repairStepCanOpen,repairProgress,torqueAssignmentOptions,toRelationships,slugify};
root.LifeOSRepairEngine=Engine;if(typeof module!=="undefined"&&module.exports)module.exports=Engine;

if(typeof document!=="undefined"){
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const load=()=>{try{return JSON.parse(localStorage.getItem(STORE))||{};}catch(_){return {};}};
const loadProjects=()=>{try{const x=JSON.parse(localStorage.getItem("lifeos.repair.projects.v1"))||[];return Array.isArray(x)?x:[];}catch(_){return [];}};
const save=x=>{try{localStorage.setItem(STORE,JSON.stringify(x));}catch(e){alert("Could not save locally: "+e.message);}};
function mount(){
if(document.getElementById("repair-workspace"))return;
const style=document.createElement("style");
style.textContent=`#repair-workspace{position:fixed;inset:0;z-index:99999;background:#050910d9;display:none;align-items:flex-end;justify-content:center;padding:12px}#repair-workspace.open{display:flex}#repair-workspace .rw-panel{width:min(820px,100%);max-height:92dvh;overflow:auto;background:#111923;color:#edf4ff;border:1px solid #34465b;border-radius:20px;padding:18px;box-shadow:0 20px 80px #000b}#repair-workspace .rw-head{display:flex;justify-content:space-between;align-items:center;gap:12px}#repair-workspace h2{margin:0;font-size:20px}#repair-workspace .rw-procedure-title{margin:18px 0 12px;color:#f4f7fb;font-size:clamp(22px,4vw,30px);font-weight:900;line-height:1.15;letter-spacing:-.02em}#repair-workspace h3{font-size:14px;color:#ffb066;margin:16px 0 8px}#repair-workspace .muted{color:#9aacc1;font-size:12px}#repair-workspace .grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}#repair-workspace .item{border:1px solid #2c3d51;background:#172333;border-radius:12px;padding:10px;display:flex;gap:9px;font-size:13px}#repair-workspace .item input[type=checkbox]{appearance:auto;-webkit-appearance:checkbox;width:18px;height:18px;min-width:18px;flex:0 0 18px;margin:2px 4px 0 0;accent-color:#ff8a1f;cursor:pointer;pointer-events:auto;position:relative;z-index:1}#repair-workspace .item label{cursor:pointer;pointer-events:auto}#repair-workspace .item input[type=checkbox]:disabled{cursor:not-allowed;opacity:.45}#repair-workspace button{background:#223247;color:#f3f7ff;border:1px solid #3b526d;border-radius:10px;padding:9px 12px}#repair-workspace button.primary{background:#ff8a1f;color:#15191f;font-weight:800}#repair-workspace .line{padding:8px 0;border-bottom:1px solid #28394c;font-size:13px}#repair-workspace .cart{background:#0b121c;border:1px solid #293a4d;border-radius:12px;padding:12px}@media(max-width:540px){#repair-workspace{padding:0}#repair-workspace .rw-panel{border-radius:20px 20px 0 0;max-height:94dvh;padding:16px}#repair-workspace .grid{grid-template-columns:1fr}}`;
document.head.append(style);const modeStyle=document.createElement("style");modeStyle.textContent=`#repair-mode{position:fixed;inset:0;z-index:100001;background:#070d16;color:#edf4ff;display:none;overflow:auto;font-family:inherit}#repair-mode.open{display:block}#repair-mode .rm-top{position:sticky;top:0;z-index:2;background:#0b1420f2;border-bottom:1px solid #293b50;padding:14px max(16px,env(safe-area-inset-left)) 12px;backdrop-filter:blur(14px)}#repair-mode .rm-topline{display:flex;align-items:center;justify-content:space-between;gap:12px}#repair-mode .rm-muted{color:#9aacc1;font-size:12px}#repair-mode .rm-progress{height:5px;background:#26374b;border-radius:8px;overflow:hidden;margin-top:12px}#repair-mode .rm-progress span{display:block;height:100%;background:#ff9a2f}#repair-mode .rm-layout{max-width:1120px;margin:0 auto;padding:20px 18px 120px;display:grid;grid-template-columns:260px minmax(0,1fr);gap:20px}#repair-mode .rm-list,#repair-mode .rm-card{background:#111c2a;border:1px solid #2b3e54;border-radius:16px;padding:14px}#repair-mode .rm-step-link{display:block;width:100%;text-align:left;margin:5px 0;padding:10px;border-radius:10px;background:#142235;border:1px solid #293e55;color:#dce8f7}#repair-mode .rm-step-link[disabled]{opacity:.38}#repair-mode .rm-step-link.active{border-color:#ff9a2f;background:#2a2118}#repair-mode .rm-step-link.done{border-color:#286b52}#repair-mode .rm-card h1{font-size:clamp(22px,4vw,34px);line-height:1.15;margin:8px 0 18px}#repair-mode .rm-instruction{font-size:16px;line-height:1.65;white-space:pre-wrap;color:#e5edf8}#repair-mode .rm-chip{display:inline-block;border:1px solid #40546b;border-radius:99px;padding:4px 9px;font-size:11px;margin:0 5px 8px 0}#repair-mode .rm-chip.warn{border-color:#a74b35;color:#ffb3a1}#repair-mode textarea{width:100%;min-height:82px;margin-top:12px;background:#0b1420;color:#edf4ff;border:1px solid #3b526d;border-radius:10px;padding:10px;font:inherit;font-size:16px}#repair-mode button{cursor:pointer;background:#20334a;color:#f3f7ff;border:1px solid #405875;border-radius:10px;padding:10px 13px;font:inherit}#repair-mode button.primary{background:#ff9a2f;color:#14191f;border-color:#ff9a2f;font-weight:800}#repair-mode button:disabled{opacity:.35;cursor:not-allowed}#repair-mode .rm-actions{position:fixed;bottom:0;left:0;right:0;background:#0b1420f2;border-top:1px solid #293b50;padding:12px max(16px,env(safe-area-inset-right)) max(12px,env(safe-area-inset-bottom)) max(16px,env(safe-area-inset-left));display:flex;justify-content:center;gap:9px;flex-wrap:wrap;backdrop-filter:blur(14px)}#repair-mode .rm-actions button{min-width:104px}#repair-mode .rm-procedure-heading{padding:14px 18px 0}#repair-mode .rm-procedure-heading h1{margin:0;color:#f4f7fb;font-size:clamp(20px,3vw,28px);font-weight:900;line-height:1.2}#repair-mode .rm-quick-specs{margin:14px 18px 0;padding:12px 14px;border:1px solid #6b4828;border-radius:14px;background:linear-gradient(135deg,#1b2633,#101923)}#repair-mode .rm-quick-specs h2{margin:0 0 8px;color:#ffb066;font-size:11px;letter-spacing:.14em;font-weight:900}#repair-mode .rm-quick-specs .rm-spec{display:flex;flex-wrap:wrap;gap:5px 12px;padding:5px 0;color:#e5edf7;font-size:12px}#repair-mode .rm-quick-specs .rm-spec b{color:#ffcf91}#repair-mode .rm-quick-specs .rm-spec span{color:#aebdd0}@media(max-width:720px){#repair-mode .rm-layout{display:block;padding:14px 12px 130px}#repair-mode .rm-list{margin-bottom:12px}#repair-mode .rm-list details summary{cursor:pointer}#repair-mode .rm-step-link{display:inline-block;width:auto;margin:4px}#repair-mode .rm-actions{gap:6px}#repair-mode .rm-actions button{flex:1;min-width:0;padding:12px 8px}}`;document.head.append(modeStyle);const shell=document.createElement("div");shell.id="repair-workspace";
shell.innerHTML='<section class="rw-panel" role="dialog" aria-modal="true"><div class="rw-head"><div><h2>Repair Workspace</h2><div class="muted" id="rw-sub"></div></div><button id="rw-close">Close</button></div><div id="rw-content"></div></section>';
document.body.append(shell);shell.addEventListener("click",e=>{if(e.target===shell||e.target.id==="rw-close")shell.classList.remove("open");});
}
async function openWorkspace(options={}){
const frame=document.getElementById("fr");
if(!frame){alert("Open a manual procedure page first.");return;}
let doc,pageUrl,pageHtml;
try{
pageUrl=new URL(frame.getAttribute("src")||frame.src,location.href);
if(pageUrl.origin!==location.origin)throw new Error("The manual page is outside the preview origin.");
const response=await fetch(pageUrl.href,{credentials:"same-origin",cache:"no-store"});
if(!response.ok)throw new Error("Manual page request failed ("+response.status+").");
pageHtml=await response.text();
doc=new DOMParser().parseFromString(pageHtml,"text/html");
if(!doc.body)throw new Error("The manual page returned no readable content.");
}catch(error){alert("Could not open Repair Workspace: "+error.message);return;}
const linkedPages=findRelatedProcedureLinks(pageHtml,pageUrl.href),scionSpecPages=await findScionSiblingSpecificationLinks(pageUrl),relatedLinks=[...new Map([...linkedPages,...scionSpecPages].map(link=>[link.url,link])).values()];
const relatedResults=await Promise.all(relatedLinks.map(async link=>{try{const response=await fetch(link.url,{credentials:"same-origin",cache:"no-store"});if(!response.ok)return {...link,available:false};const html=await response.text();const parsed=new DOMParser().parseFromString(html,"text/html");return {...link,available:true,title:parsed.querySelector("h1")?.innerText||link.label,html};}catch(_){return {...link,available:false};}}));
const relatedPages=relatedResults.filter(x=>x.available);
const combinedHtml=pageHtml+"\\n"+relatedPages.map(x=>x.html).join("\\n");
mount();const title=doc.querySelector("h1")?.innerText||doc.title||"Manual procedure";
const facts=extractProcedure(combinedHtml,{title});
const key=location.hash.replace(/^#\/v\//,"").replace(/[^a-z0-9/_-]/gi,"-")||frame.src;
const all=load(),small=document.querySelector(".vwrap .ht small")?.innerText||"";
const vehicle=small.split("•").slice(1).join("•").trim()||"Selected vehicle";
const garageVehicleId=/scion/i.test(vehicle)?"scion-xb":/subaru|crosstrek/i.test(vehicle)?"subaru-crosstrek":null,garageProjects=loadProjects().filter(p=>garageVehicleId&&String(p.vehicleId)===garageVehicleId),cart=all[key]||{vehicle,procedure:title,items:[],tools:[]},selected=new Set((cart.items||[]).map(x=>x.id)),selectedTools=new Set(cart.tools||[]),savedTorque=new Map((cart.torqueSpecs||[]).map(x=>[x.id,x])),selectedTorque=new Set((cart.torqueSpecs||[]).map(x=>x.id));
const shell=document.getElementById("repair-workspace"),content=shell.querySelector("#rw-content");
const requestedProject=options.projectId&&garageProjects.find(p=>String(p.id)===String(options.projectId));
if(options.guided&&options.projectId&&(!requestedProject||(cart.projectId&&String(cart.projectId)!==String(options.projectId)))){
 alert("This procedure is not available for the requested Garage project, or its cart belongs to another project. Open the correct linked procedure.");
 return;
}
const returnToGarage=options.guided&&(options.repairId||requestedProject)?"/garage?"+new URLSearchParams({...garageVehicleId&&{vehicleId:garageVehicleId},...options.repairId?{repairId:String(options.repairId)}:{projectId:String(requestedProject.id)}}).toString():"";
shell.querySelector("#rw-sub").textContent=vehicle;
const visibleParts=facts.parts.filter(p=>p.relationship!== "mention" || p.confidence>=0.6);
const rows=visibleParts.map(p=>{
const evidence=(p.evidence||[]).slice(0,3).map(x=>esc(x.text)).join(" · ");
const oem=(p.oem||[]).map(x=>esc(x.manufacturer+" "+x.partNumber)).join(", ");
return '<label class="item"><input type="checkbox" data-part="'+esc(p.id)+'" '+(selected.has(p.id)?"checked":"")+'><span><b>'+esc(p.name)+'</b><br><span class="muted">'+esc(p.relationship)+' · '+Math.round(p.confidence*100)+'% confidence'+(oem?" · "+oem:"")+'</span><br><span class="muted">'+evidence+'</span></span></label>';
}).join("");
const toolRows=facts.toolDetails.map(t=>'<label class="item"><input type="checkbox" data-tool="'+esc(t.id)+'" '+(selectedTools.has(t.id)?"checked":"")+'><span>'+esc(t.name)+'</span></label>').join("");
const refs=facts.toolReferences.map(x=>'<div class="line">Manual tool reference: <b>'+esc(x.reference)+'</b></div>').join("");
const assignmentOptions=torqueAssignmentOptions(facts),pageComponents=assignmentOptions.components,pageFasteners=assignmentOptions.fasteners;const torque=(facts.torqueSpecs||[]).map(group=>{const saved=savedTorque.get(group.id),association=saved&&saved.association||group.association,manual=!group.association;const componentSelect=pageComponents.map(p=>'<option value="'+esc(p.name)+'" '+(association&&association.component===p.name?"selected":"")+'">'+esc(p.name)+'</option>').join("");const fastenerSelect=pageFasteners.map(x=>'<option value="'+esc(x)+'" '+(association&&association.fastener===x?"selected":"")+'">'+esc(x)+'</option>').join("");const enabled=group.consistent&&(group.selectable||Boolean(association&&association.component&&association.fastener));return '<div class="item"><div style="flex:1"><label><input type="checkbox" data-torque="'+esc(group.id)+'" '+(enabled&&selectedTorque.has(group.id)?"checked":"")+' '+(enabled?"":"disabled")+'> <b>'+esc(group.values.map(x=>x.value+" "+x.unit).join(" · "))+'</b></label><br><span class="muted">'+esc(association?association.component+" · "+association.fastener:"Unassigned torque") + '</span><br><span class="muted">'+esc(group.nearbyContext||group.context)+'</span><br><span class="muted">'+esc(group.consistent?(enabled?"Ready to add to cart":"Assign a component and fastener to enable selection"):"Not selectable: "+group.reviewReason)+'</span>'+(manual?'<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:8px"><label class="muted">Assign component<select data-torque-component="'+esc(group.id)+'" style="display:block;width:100%;padding:8px;background:#0b121c;color:#edf4ff;border:1px solid #3b526d;border-radius:8px"><option value="">Choose component…</option>'+componentSelect+'</select><input type="text" data-torque-component-custom="'+esc(group.id)+'" value="'+esc(association&&!pageComponents.includes(association.component)?association.component:"")+'" placeholder="Or enter component manually" style="display:block;width:100%;margin-top:6px;padding:8px;background:#0b121c;color:#edf4ff;border:1px solid #3b526d;border-radius:8px"></label><label class="muted">Fastener<select data-torque-fastener="'+esc(group.id)+'" style="display:block;width:100%;padding:8px;background:#0b121c;color:#edf4ff;border:1px solid #3b526d;border-radius:8px"><option value="">Choose fastener…</option>'+fastenerSelect+'</select><input type="text" data-torque-fastener-custom="'+esc(group.id)+'" value="'+esc(association&&!pageFasteners.includes(association.fastener)?association.fastener:"")+'" placeholder="Or enter fastener manually" style="display:block;width:100%;margin-top:6px;padding:8px;background:#0b121c;color:#edf4ff;border:1px solid #3b526d;border-radius:8px"></label></div>':"")+'</div></div>';}).join("");
const warnings=facts.warnings.map(x=>'<div class="line"><b>'+esc(x.type)+'</b> '+esc(x.text)+'</div>').join("");
const quickTorque=(facts.torqueSpecs||[]).map(group=>'<div class="line"><b>Torque:</b> '+esc(group.values.map(x=>x.value+" "+x.unit).join(" / "))+(group.association?' · '+esc(group.association.component)+' · '+esc(group.association.fastener):' · '+esc(group.nearbyContext||group.context||"Verify in manual"))+'</div>').join("");
const quickTools=facts.toolDetails.map(tool=>'<div class="line"><b>Tool:</b> '+esc(tool.name)+'</div>').join("")+refs;
const quickSpecs=(quickTorque||'<div class="muted">No torque specifications detected.</div>')+(quickTools||'<div class="muted">No special tools detected.</div>');
const relatedMarkup=relatedPages.length?'<section class="cart" aria-label="Related factory manual pages" style="margin:0 0 16px"><h3 style="margin-top:0">Related factory manual pages</h3>'+relatedPages.map(page=>'<div class="line"><a href="'+esc(page.url)+'" target="_blank" rel="noopener" style="color:#ffb066;text-decoration:underline">'+esc(page.label)+' · page '+esc(page.page)+'</a></div>').join("")+'</section>':"";
content.innerHTML='<h1 class="rw-procedure-title">'+esc(title)+'</h1><section class="cart" aria-label="Quick Specs" style="margin:0 0 16px;border-color:#ff9a3d"><h3 style="margin-top:0">QUICK SPECS</h3>'+quickSpecs+'</section>'+relatedMarkup+'<h3>Parts and service targets</h3><div class="muted">Required means the procedure explicitly calls for replacement. Service targets are components being worked on, not proof that a new part is needed. Review evidence before adding items to the cart.</div><div class="grid">'+(rows||'<div class="muted">No catalog matches found.</div>')+'</div><h3>Tools</h3><div class="grid">'+(toolRows||'<div class="muted">No catalog tool matches found.</div>')+'</div>'+refs+'<h3>Torque specifications · cart assignment</h3>'+(torque||'<div class="muted">No torque values detected.</div>')+'<h3>Warnings and notes</h3>'+(warnings||'<div class="muted">No explicit warning or note labels detected.</div>')+(facts.requiresCalibration?'<div class="line">EyeSight-related calibration language detected. Verify the exact calibration procedure and equipment requirements before returning the vehicle to service.</div>':"")+'<div style="margin:14px 0"><button type="button" id="rw-start-mode" class="primary" style="width:100%;padding:14px;font-size:15px">Start full-screen guided repair →</button><div class="muted" style="margin-top:6px">Step-by-step execution with saved progress. Manual instructions remain the source of truth.</div><div id="rw-mode-status" role="status" class="muted" style="color:#ffb3a1;margin-top:6px"></div></div><div class="cart"><h3>Repair cart</h3><label class="muted" style="display:block;margin:8px 0">Garage project<select id="rw-project" style="display:block;width:100%;padding:10px;margin-top:5px;background:#0b121c;color:#edf4ff;border:1px solid #3b526d;border-radius:8px"><option value="">Not linked to a project</option>'+garageProjects.map(p=>'<option value="'+esc(p.id)+'" '+(String(requestedProject?.id||cart.projectId||"")===String(p.id)?"selected":"")+' >'+esc(p.title||"Repair Project")+' · '+esc(p.status||"Planned")+'</option>').join("")+'</select></label><div style="display:flex;gap:8px;flex-wrap:wrap;margin:8px 0 12px"><button type="button" id="rw-create-project" class="primary">＋ Create new Garage project</button><button type="button" id="rw-refresh-projects">Refresh project list</button></div><div id="rw-lines"></div><p class="muted">Stored in this browser only. No account or server sync.</p><button class="primary" id="rw-save">Save cart</button> <button id="rw-export">Export JSON</button> <button id="rw-clear">Clear</button></div>';
const snapshot=()=>{
const items=Array.from(content.querySelectorAll("[data-part]:checked")).map(el=>facts.parts.find(p=>p.id===el.dataset.part)).filter(Boolean);
const tools=Array.from(content.querySelectorAll("[data-tool]:checked")).map(el=>el.dataset.tool);
const torqueSpecs=Array.from(content.querySelectorAll("[data-torque]:checked")).map(el=>{const group=(facts.torqueSpecs||[]).find(x=>x.id===el.dataset.torque);if(!group)return null;const component=content.querySelector('[data-torque-component="'+group.id+'"]')?.value||content.querySelector('[data-torque-component-custom="'+group.id+'"]')?.value?.trim(),fastener=content.querySelector('[data-torque-fastener="'+group.id+'"]')?.value||content.querySelector('[data-torque-fastener-custom="'+group.id+'"]')?.value?.trim();const association=group.association||((component&&fastener)?{component,fastener,evidence:"User-assigned in Repair Workspace",associationSource:"user"}:null);return {...group,association};}).filter(Boolean);
const lines=items.map(p=>'<div class="line">'+esc(p.name)+' · '+esc(p.relationship)+' · '+Math.round(p.confidence*100)+'%</div>').join("")+tools.map(t=>'<div class="line">Tool: '+esc(t)+'</div>').join("")+torqueSpecs.map(group=>'<div class="line">Torque: '+esc(group.values.map(x=>x.value+" "+x.unit).join(" · "))+'</div>').join("");
content.querySelector("#rw-lines").innerHTML=lines||'<div class="muted">Cart is empty.</div>';
const projectId=content.querySelector("#rw-project")?.value||"";const project=garageProjects.find(p=>String(p.id)===String(projectId));return {vehicle,vehicleId:garageVehicleId,projectId:projectId||null,projectTitle:project?.title||null,procedure:title,source:frame.src,relatedSources:relatedPages.map(page=>({label:page.label,url:page.url,page:page.page})),route:location.hash,updatedAt:new Date().toISOString(),items:items.map(p=>({id:p.id,name:p.name,relationship:p.relationship,confidence:p.confidence,oem:p.oem})),tools,torqueSpecs,torque:torqueSpecs.flatMap(group=>group.values.map(value=>({...value,context:group.context}))),warnings:facts.warnings};

};
const startRepairMode=()=>{
 const steps=extractRepairSteps(htmlToText(pageHtml),pageHtml);
 if(!steps.length){const status=content.querySelector("#rw-mode-status");status.textContent="No reliably numbered factory steps found on this page. Open the original procedure; guided repair will not invent a sequence.";return;}
 const sessionStore="lifeos.repair.sessions.v1";
 let sessions={};try{sessions=JSON.parse(localStorage.getItem(sessionStore))||{};}catch(_){}
 const sessionKey=key+"::"+facts.procedureId,prior=sessions[sessionKey]||{},states={};
 steps.forEach(step=>{states[step.id]=prior.states&&prior.states[step.id]||{status:"pending"};});
 let current=steps.findIndex(step=>step.id===prior.currentStepId);if(current<0)current=steps.findIndex(step=>states[step.id].status!=="done"&&states[step.id].status!=="skipped");if(current<0)current=0;
 const persist=()=>{if(all[key]?.execution?.status==="completed"&&JSON.stringify(states)===JSON.stringify(prior.states||{}))return;const updatedAt=new Date().toISOString(),execution={status:"in-progress",updatedAt,currentStepId:steps[current].id,steps:steps.map(step=>({id:step.id,number:step.number,title:step.title,safetyCritical:step.safetyCritical,requiresPrevious:step.requiresPrevious,...states[step.id]}))};sessions[sessionKey]={procedure:title,vehicle,source:frame.src,updatedAt,currentStepId:steps[current].id,states};try{localStorage.setItem(sessionStore,JSON.stringify(sessions));all[key]={...snapshot(),execution};save(all);}catch(error){alert("Repair progress could not be saved locally: "+error.message);}};
 let mode=document.getElementById("repair-mode");
 if(!mode){mode=document.createElement("section");mode.id="repair-mode";mode.setAttribute("role","dialog");mode.setAttribute("aria-modal","true");document.body.append(mode);}
 const progress=()=>repairProgress(steps,states);
 const render=()=>{
  const step=steps[current],p=progress(),locked=steps.map((x,i)=>!repairStepCanOpen(steps,states,i));
  const list=steps.map((x,i)=>'<button type="button" class="rm-step-link '+(i===current?"active ":"")+(states[x.id].status==="done"?"done":"")+'" data-step-index="'+i+'" '+(locked[i]?"disabled":"")+'><span class="rm-muted">STEP '+x.number+' · '+(states[x.id].status==="done"?"COMPLETE":states[x.id].status==="skipped"?"SKIPPED":"PENDING")+'</span><br>'+esc(x.title)+'</button>').join("");
  const status=states[step.id],safety=step.safetyCritical?'<span class="rm-chip warn">SAFETY-CRITICAL</span>':"",dependency=step.requiresPrevious?'<span class="rm-chip warn">DEPENDS ON PRIOR STEP</span>':"";
  const modeTorque=(facts.torqueSpecs||[]).map(group=>'<div class="rm-spec"><b>Torque:</b> '+esc(group.values.map(x=>x.value+" "+x.unit).join(" / "))+' <span>· '+esc(group.association?group.association.component+" · "+group.association.fastener:group.nearbyContext||group.context||"Verify in manual")+'</span></div>').join("");
  const modeTools=facts.toolDetails.map(tool=>'<div class="rm-spec"><b>Tool:</b> '+esc(tool.name)+'</div>').join("")+facts.toolReferences.map(x=>'<div class="rm-spec"><b>Manual reference:</b> '+esc(x.reference)+'</div>').join("");
  const modeQuickSpecs=(modeTorque||'<div class="rm-spec">No torque specifications detected.</div>')+(modeTools||'<div class="rm-spec">No special tools detected.</div>');
  mode.innerHTML='<header class="rm-top"><div class="rm-topline"><div><div class="rm-muted">MOTORNOTE · REPAIR MODE</div><b>'+esc(vehicle)+'</b><div class="rm-muted">'+p.done+' of '+p.total+' steps complete · '+p.percent+'%</div></div><button type="button" id="rm-exit">Exit</button></div><div class="rm-progress"><span style="width:'+p.percent+'%"></span></div></header><section class="rm-procedure-heading"><h1>'+esc(title)+'</h1></section><section class="rm-quick-specs" aria-label="Quick Specs"><h2>QUICK SPECS</h2>'+modeQuickSpecs+'</section><main class="rm-layout"><aside class="rm-list"><details open><summary><b>Procedure steps</b> <span class="rm-muted">('+p.done+'/'+p.total+')</span></summary>'+list+'</details><p class="rm-muted">Independent steps can be opened out of order. Safety-critical and dependent steps stay locked until every earlier step is complete.</p></aside><section class="rm-card"><div class="rm-muted">STEP '+step.number+' OF '+p.total+'</div>'+safety+dependency+'<h1>'+esc(step.title)+'</h1><div class="rm-instruction">'+esc(step.instruction)+'</div><div class="rm-muted" style="margin-top:14px">Status: '+esc(status.status.toUpperCase())+(status.skipReason?" · "+esc(status.skipReason):"")+'</div><label class="rm-muted" style="display:block;margin-top:18px">Skip reason (required to skip)<textarea id="rm-skip-reason" placeholder="Explain why this step is being skipped…">'+esc(status.skipReason||"")+'</textarea></label>'+(step.safetyCritical?'<p class="rm-muted" style="color:#ffb3a1">This step is safety-critical. Skipping it will block repair completion.</p>':"")+'<p class="rm-muted">Verify the instruction, warnings, and applicable specifications against the original factory manual before proceeding. <a href="'+esc(pageUrl.href)+'" target="_blank" rel="noopener" style="color:#ffb066;text-decoration:underline">Open factory page and diagrams ↗</a></p></section></main><footer class="rm-actions"><button type="button" id="rm-prev" '+(current===0?"disabled":"")+'>← Previous</button><button type="button" id="rm-skip">Skip with reason</button><button type="button" id="rm-complete" class="primary" '+(status.status==="done"?"disabled":"")+'>Mark complete ✓</button><button type="button" id="rm-next" '+(current===steps.length-1?"disabled":"")+'>Next →</button><button type="button" id="rm-finish" '+(p.canFinish?"":"disabled")+'>Finish repair</button></footer>';
  mode.querySelectorAll("[data-step-index]").forEach(button=>button.addEventListener("click",()=>{const index=Number(button.dataset.stepIndex);if(repairStepCanOpen(steps,states,index)){current=index;persist();render();}}));
  mode.querySelector("#rm-exit").onclick=()=>{mode.classList.remove("open");if(returnToGarage)location.assign(returnToGarage);};
  mode.querySelector("#rm-prev").onclick=()=>{for(let i=current-1;i>=0;i--){if(repairStepCanOpen(steps,states,i)){current=i;persist();render();return;}}};
  mode.querySelector("#rm-next").onclick=()=>{for(let i=current+1;i<steps.length;i++){if(repairStepCanOpen(steps,states,i)){current=i;break;}}persist();render();};
  mode.querySelector("#rm-complete").onclick=()=>{states[step.id]={status:"done",completedAt:new Date().toISOString()};for(let i=current+1;i<steps.length;i++){if(repairStepCanOpen(steps,states,i)){current=i;break;}}persist();render();};
  mode.querySelector("#rm-skip").onclick=()=>{const reason=mode.querySelector("#rm-skip-reason").value.trim();if(!reason){alert("Enter a reason before skipping this step.");return;}states[step.id]={status:"skipped",skipReason:reason,skippedAt:new Date().toISOString()};persist();render();};
  mode.querySelector("#rm-finish").onclick=()=>{const final=progress();if(!final.canFinish){alert("Complete every step. A skipped safety-critical step must be completed before this repair can be finalized.");return;}const completedAt=new Date().toISOString(),execution={status:"completed",completedAt,steps:steps.map(step=>({id:step.id,number:step.number,title:step.title,safetyCritical:step.safetyCritical,requiresPrevious:step.requiresPrevious,...states[step.id]}))};sessions[sessionKey]={...sessions[sessionKey],status:"completed",completedAt,states};try{localStorage.setItem(sessionStore,JSON.stringify(sessions));all[key]={...snapshot(),execution};save(all);}catch(error){alert("Could not save completion: "+error.message);return;}alert("Repair marked complete and saved to its repair cart on this device.");mode.classList.remove("open");if(returnToGarage)location.assign(returnToGarage);};
 };
 persist();render();mode.classList.add("open");
};
content.querySelector("#rw-start-mode").onclick=()=>{const status=content.querySelector("#rw-mode-status");status.textContent="";try{startRepairMode();}catch(error){status.textContent="Could not start guided repair: "+error.message;console.error(error);}};
snapshot();
const projectSelect=content.querySelector("#rw-project");
const refreshProjects=()=>{const selectedId=projectSelect.value,latest=loadProjects().filter(p=>garageVehicleId&&String(p.vehicleId)===garageVehicleId);projectSelect.innerHTML='<option value="">Not linked to a project</option>'+latest.map(p=>'<option value="'+esc(p.id)+'">'+esc(p.title||"Repair Project")+' · '+esc(p.status||"Planned")+'</option>').join("");if(latest.some(p=>String(p.id)===String(selectedId)))projectSelect.value=selectedId;};
content.querySelector("#rw-create-project").onclick=()=>{if(!garageVehicleId){alert("This manual page is not linked to a supported Garage vehicle.");return;}const cart=snapshot(),draftId="repair-draft-"+Date.now()+"-"+Math.random().toString(36).slice(2,8);cart.cartKey=key;all[key]=cart;save(all);try{localStorage.setItem("lifeos.repair.project-draft.v1",JSON.stringify({id:draftId,cart,createdAt:new Date().toISOString()}));}catch(error){alert("The repair cart could not be prepared for Garage. Check available browser storage and try again.");return;}const target="/garage?vehicleId="+encodeURIComponent(garageVehicleId)+"&newProject=1&repairDraft="+encodeURIComponent(draftId);window.location.assign(target);};
content.querySelector("#rw-refresh-projects").onclick=()=>{refreshProjects();snapshot();};
projectSelect.onchange=()=>snapshot();
content.addEventListener("change",e=>{if(e.target.matches("[data-torque-component],[data-torque-fastener],[data-torque-component-custom],[data-torque-fastener-custom]")){const id=e.target.dataset.torqueComponent||e.target.dataset.torqueFastener||e.target.dataset.torqueComponentCustom||e.target.dataset.torqueFastenerCustom,component=content.querySelector('[data-torque-component="'+id+'"]')?.value||content.querySelector('[data-torque-component-custom="'+id+'"]')?.value?.trim(),fastener=content.querySelector('[data-torque-fastener="'+id+'"]')?.value||content.querySelector('[data-torque-fastener-custom="'+id+'"]')?.value?.trim(),check=content.querySelector('[data-torque="'+id+'"]');if(check){check.disabled=!(component&&fastener);if(check.disabled)check.checked=false;const label=check.closest(".item"),status=label&&label.querySelector(".muted:last-child");if(status)status.textContent=check.disabled?"Assign a component and fastener to enable selection":"Manual assignment ready — review before adding to cart";}}if(e.target.matches("[data-part],[data-tool],[data-torque]"))snapshot();});
content.querySelector("#rw-save").onclick=()=>{all[key]=snapshot();save(all);alert("Repair cart saved on this device.");};
content.querySelector("#rw-export").onclick=()=>{const blob=new Blob([JSON.stringify(snapshot(),null,2)],{type:"application/json"}),url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="repair-cart.json";a.click();URL.revokeObjectURL(url);};
content.querySelector("#rw-clear").onclick=()=>{content.querySelectorAll("[data-part],[data-tool],[data-torque]").forEach(x=>x.checked=false);snapshot();};
shell.classList.add("open");
if(returnToGarage){const back=document.createElement("a");back.href=returnToGarage;back.textContent=options.repairId?"← Return to Garage repair record":"← Return to Garage project";back.style.cssText="display:block;color:#ffb066;padding:10px 0;text-decoration:underline";content.prepend(back);}
if(options.guided)content.querySelector("#rw-start-mode").click();
}
document.addEventListener("click",e=>{const b=e.target.closest("[data-repair-workspace]");if(b){e.preventDefault();openWorkspace();}});
function launchGuidedRepair(){
 const url=new URL(location.href);
 if(url.searchParams.get("guided")!=="1"||!/^#\/v\/\d+\/\d+\/\d+$/.test(location.hash)||!document.getElementById("fr"))return;
 const projectId=url.searchParams.get("projectId"),repairId=url.searchParams.get("repairId");
 url.searchParams.delete("guided");url.searchParams.delete("projectId");url.searchParams.delete("repairId");
 history.replaceState(history.state,"",url.pathname+url.search+url.hash);
 openWorkspace({guided:true,projectId,repairId}).catch(error=>alert("Could not start guided repair: "+error.message));
}
document.addEventListener("manual-viewer-ready",launchGuidedRepair);
launchGuidedRepair();
}
})(typeof globalThis!=="undefined"?globalThis:this);
