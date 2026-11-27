import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createHash,webcrypto} from "node:crypto";
import {runInNewContext} from "node:vm";
const source=readFileSync(new URL("../scripts/garage-sw.template.js",import.meta.url),"utf8");
const paths=JSON.parse(source.match(/const ASSETS = (\[[\s\S]*?\]);/)[1]);
const version="a".repeat(64),origin="https://example.test",query="?garage-offline="+version;
const html="<html>garageApp()"+paths.slice(1).map(p=>p.endsWith(".css")?'<link href="'+p+'">':'<script src="'+p+'"></script>').join("")+"</html>";
const body=Object.fromEntries(paths.map(p=>[p,p==="/garage"?html:"fixture:"+p]));
const digests=Object.fromEntries(paths.map(p=>[p,createHash("sha256").update(body[p]).digest("hex")]));
function harness(){
 const handlers={},stores=new Map(),requests=[];
 let offline=false,denied=false,corrupt=false;
 const caches={async open(key){if(!stores.has(key))stores.set(key,new Map());const store=stores.get(key);return {async put(key,res){store.set(key,res.clone());},async match(key){return store.get(key)?.clone();}}},async keys(){return [...stores.keys()]},async delete(key){return stores.delete(key)}};
 const self={location:{origin},clients:{async claim(){}},addEventListener(name,fn){handlers[name]=fn}};
 const fetch=async input=>{const url=new URL(typeof input==="string"?input:input.url);requests.push(url.href);if(offline)throw Error("network unavailable");if(denied)return new Response("Denied",{status:403});const path=url.pathname;return new Response(corrupt&&path==="/inventory-engine.js"?"changed bytes":body[path],{headers:{"content-type":path==="/garage"?"text/html":path.endsWith(".css")?"text/css":"text/javascript"}});};
 runInNewContext(source.replace("__GARAGE_BUILD_HASH__",version).replace("__GARAGE_ASSET_DIGESTS__",JSON.stringify(digests)),{self,caches,fetch,crypto:webcrypto,URL,Headers,Response,Uint8Array});
 const lifecycle=name=>{let promise;handlers[name]({waitUntil(p){promise=p}});return promise;};
 const request=(path,mode="cors",method="GET")=>{let result;handlers.fetch({request:{url:origin+path,mode,method,headers:new Headers()},respondWith(p){result=p}});return result;};
 return {stores,requests,lifecycle,request,offline(v){offline=v},denied(v){denied=v},corrupt(v){corrupt=v}};
}
test("offline shell is pinned to one verified build and never mixes live resources",async()=>{
 const h=harness();await h.lifecycle("install");await h.lifecycle("activate");
 h.offline(true);
 const page=await h.request("/garage?project=1","navigate");
 const cachedHtml=await page.text();
 for(const path of paths.slice(1)){assert.ok(cachedHtml.includes(path+query));assert.equal(await (await h.request(path+query)).text(),body[path]);assert.equal(h.request(path),undefined);}
 assert.equal((await h.request(paths[1]+"?garage-offline=old")).status,503);
 assert.equal(h.request("/m/protected/pages/1.html","navigate"),undefined);
 assert.equal(h.request("/api/navigation/scion-repair.json"),undefined);
 assert.equal(h.request("/garage","navigate","POST"),undefined);
 h.offline(false);h.denied(true);
 assert.equal((await h.request("/garage","navigate")).status,403);
});
test("mixed or corrupt build bytes fail installation and remove incomplete cache",async()=>{
 const h=harness();h.corrupt(true);await assert.rejects(h.lifecycle("install"),/Invalid Garage shell asset/);assert.equal(h.stores.size,0);
});
