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
  assert.match(html, /visible=grouped.slice/);
});
