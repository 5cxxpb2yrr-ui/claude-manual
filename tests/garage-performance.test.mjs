import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,existsSync} from "node:fs";
import {serveGarageUi} from "../worker.js";
const html=readFileSync(new URL("../public/garage.html",import.meta.url),"utf8");
test("Garage loads same-origin CSS and Alpine without runtime CDN compiler",()=>{
 assert.match(html,/href="\/garage-ui-v1\/garage\.css"/);assert.match(html,/src="\/garage-ui-v1\/alpine\.min\.js"/);
 assert.doesNotMatch(html,/@tailwindcss\/browser|cdn\.jsdelivr\.net\/npm\/alpinejs|fonts\.googleapis\.com/);
});
test("all fourteen tabs mount only on demand; maintenance modals remain outside tab root",()=>{
 const tabs=[...html.matchAll(/<template x-if="currentTab === '([^']+)'"><div[^>]+data-garage-tab="\1">/g)].map(x=>x[1]);
 assert.equal(tabs.length,14);assert.equal(new Set(tabs).size,14);
 assert.doesNotMatch(html,/x-show="currentTab === '/);
 assert.match(html,/<\/div><\/template>\s*<!-- MAINTENANCE PLAN MODAL -->\s*<div x-show="modals\.maintenancePlan"/);
});
test("Garage asset handler rejects SPA fallback and supplies strict CSS and JS types",async()=>{
 const req=name=>new Request("https://example.test/garage-ui-v1/"+name);
 const env={ASSETS:{fetch:async()=>new Response("<html>",{headers:{"content-type":"text/html"}})}};
 assert.equal((await serveGarageUi(req("garage.css"),env)).status,503);
 assert.equal((await serveGarageUi(req("unknown"),env)).status,404);
 env.ASSETS.fetch=async()=>new Response("asset",{headers:{"content-type":"application/octet-stream"}});
 for(const [name,type] of [["garage.css","text/css"],["alpine.min.js","text/javascript"]]){
 const res=await serveGarageUi(req(name),env);assert.equal(res.status,200);assert.ok(res.headers.get("content-type").startsWith(type));assert.equal(await res.text(),"asset");
 }
});
test("compiled assets contain generated utility rules when build has run",()=>{
 const path=new URL("../public/garage-ui-v1/garage.css",import.meta.url);if(!existsSync(path))return;
 const css=readFileSync(path,"utf8");assert.ok(css.length>10000);
 for(const name of [".bg-amber-500",".grid-cols-2",".fixed"])assert.ok(css.includes(name));
});
