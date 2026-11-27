import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Script } from "node:vm";

test("alternator search includes generator procedures and ranks service work above maps and DTCs", () => {
  const html = readFileSync(new URL("../public/manuals.html", import.meta.url), "utf8");
  assert.match(html, /termGroups=terms\.map\(t=>\/\^\(alternator\|alternators\)\$\/\.test\(t\)\?\["alternator","alternators","generator","generators"\]/);
  assert.match(html, /tumble generator valve/i);
  assert.match(html, /serviceProcedureBonus=.*?repair and diagnosis.*?removal\|installation\|inspection\|testing\|service and repair/s);
  assert.match(html, /mapPenalty=.*?map - electrical systems.*?700/s);
  assert.match(html, /dtcPenalty=.*?dtc .*?700/s);
  assert.match(html, /variantPenalty=.*?different variant.*?700/s);
  assert.match(html, /guides\[gi\]\.title\+" › "/);
});

test("manual explorer inline application script parses before boot", () => {
  const html = readFileSync(new URL("../public/manuals.html", import.meta.url), "utf8");
  const match = html.match(/<script>([\s\S]*?)<\/script>/);

  assert.ok(match, "manual explorer inline script should exist");
  assert.doesNotThrow(
    () => new Script(match[1], { filename: "public/manuals.html" }),
    "manual explorer inline script should be valid JavaScript",
  );
});


test("search groups duplicate navigation entries but preserves distinct procedures and variants", () => {
  const html = readFileSync(new URL("../public/manuals.html", import.meta.url), "utf8");
  const source = html.slice(html.indexOf("function searchDuplicateKey"), html.indexOf("function searchv"));
  const group = new Function(source + ";return groupSearchResults")();
  const vehicles = [{ guides: [{title:"Repair and Diagnosis"}] }, { guides: [{title:"Repair and Diagnosis"}, {title:"Parts and Labor"}] }];
  const path = ["Electrical","Charging Systems","Charging (1NZ-FE)","Generator"];
  const title = "Charging (1NZ-FE): Generator: Removal";
  const hit = (vi, gi, p, n=title, breadcrumb=path) => ({item:[vi,gi,{p,n,path:breadcrumb}],score:1});
  const groups = group([hit(1,0,1877),hit(1,0,7910),hit(1,0,1881,"Charging (1NZ-FE): Generator: Installation"),hit(1,0,999,title,[...path,"Other Variant"]),hit(0,0,1877),hit(1,1,110)],vehicles);
  assert.equal(groups.length,5);
  assert.equal(groups[0].primary.item[2].p,1877);
  assert.deepEqual(groups[0].alternates.map(h=>h.item[2].p),[7910]);
  assert.match(html, /<details class="search-duplicates">/);
  assert.match(html, /grouped=groupSearchResults\(pg,M.vehicles\)/);
});


test("parts and labor search matches stay in a collapsed final section regardless of score", () => {
 const html = readFileSync(new URL("../public/manuals.html", import.meta.url), "utf8");
 const source = html.slice(html.indexOf("function searchDuplicateKey"),html.indexOf("function searchv"));
 const {groupSearchResults,partitionSearchResults}=new Function(source+";return {groupSearchResults,partitionSearchResults}")();
 const vehicles=[{guides:[{title:"Repair and Diagnosis"},{title:"Labor Times"}]},{guides:[{title:"Repair and Diagnosis"},{title:"Parts and Labor"}]}];
 const hit=(vi,gi,p,score)=>({item:[vi,gi,{p,n:"Alternator",path:["Electrical"]}],score});
 const sections=partitionSearchResults(groupSearchResults([hit(1,1,110,900),hit(0,1,241,800),hit(1,0,1877,100),hit(1,0,7910,90),hit(0,0,6570,80)],vehicles),vehicles);
 assert.deepEqual(sections.primary.map(g=>g.primary.item[2].p),[1877,6570]);
 assert.deepEqual(sections.secondary.map(g=>g.primary.item[2].p),[110,241]);
 assert.equal(sections.primary[0].alternates.length,1);
 assert.match(html, /<details class="search-secondary"><summary>Parts &amp; Labor/);
 assert.match(html, /visible=primarySections.slice/);
});


test("search groups matching sibling pages in factory order, keeping vehicles and variants separate", () => {
 const html=readFileSync(new URL("../public/manuals.html",import.meta.url),"utf8");
 const source=html.slice(html.indexOf("function searchDuplicateKey"),html.indexOf("function searchv"));
 const {groupSearchResults,groupSearchSiblings}=new Function(source+";return {groupSearchResults,groupSearchSiblings}")();
 const vehicles=[{guides:[{title:"Repair and Diagnosis"}]},{guides:[{title:"Repair and Diagnosis"},{title:"Parts and Labor"}]}];
 const path=["Electrical","Charging","Generator"];
 const hit=(vi,gi,p,n,ix,score,pa=path)=>({item:[vi,gi,{p,n,path:pa,ix}],score});
 const groups=groupSearchSiblings(groupSearchResults([hit(1,0,1881,"Installation",[0,0,5],900),hit(1,0,1877,"Removal",[0,0,1],800),hit(1,0,7910,"Removal",[0,0,7],790),hit(1,0,1876,"Components",[0,0,0],100),hit(0,0,6570,"Removal",[0,0,0],90),hit(1,0,123,"Removal",[1,1,0],80,["Electrical","Other Variant","Generator"])],vehicles),vehicles);
 assert.equal(groups.length,3);
 assert.deepEqual(groups[0].pages.map(g=>g.primary.item[2].p),[1876,1877,1881]);
 assert.deepEqual(groups[0].pages[1].alternates.map(h=>h.item[2].p),[7910]);
 assert.equal(groups[1].vi,0);
 assert.equal(groups[2].path[1],"Other Variant");
 assert.match(html, /<details class="search-siblings"/);
 assert.match(html, /primarySections=groupSearchSiblings\(sections.primary/);
});

test("Garage return link is restricted to the same-origin Garage route",()=>{
 const html=readFileSync(new URL("../public/manuals.html",import.meta.url),"utf8");
 const source=html.slice(html.indexOf("function safeGarageBack("),html.indexOf("async function boot()"));
 const safe=new Function(source+";return safeGarageBack")(),origin="https://manual.example";
 for(const value of ["/garage","/garage?projectId=1#ignored",origin+"/garage","/garage.html"])assert.ok(["/garage","/garage.html"].includes(safe(value,origin)));
 for(const value of ["https://evil.example/garage","//evil.example/garage","javascript:alert(1)",origin+"/manuals",origin+"/garage/other","https://user:pass@manual.example/garage","",null])assert.equal(safe(value,origin),"",String(value));
 assert.match(html,/const back=safeGarageBack\(LS\("mx.back",""\)\)/);
});
