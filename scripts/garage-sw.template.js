// Generated from this template during the existing build.
"use strict";
const VERSION = "__GARAGE_BUILD_HASH__";
const PREFIX = "motornote-garage-shell-";
const CACHE = PREFIX + VERSION;
const ASSETS = [
  "/garage",
  "/garage-ui-v1/garage.css",
  "/garage-ui-v1/alpine.min.js",
  "/repair-workspace.js",
  "/repair-planner.js",
  "/inventory-engine.js",
  "/repair-history.js",
  "/garage-mission.js",
  "/garage-backup.js",
  "/inventory-demand.js",
  "/inventory-purchasing.js",
  "/inventory-capture.js",
  "/inventory-prices.js"
];
const allowed = new Set(ASSETS);
const DIGESTS = __GARAGE_ASSET_DIGESTS__;
const OFFLINE_QUERY = "?garage-offline=" + VERSION;
const absolute = path => new URL(path, self.location.origin).href;

async function verifiedBytes(response,path) {
 const bytes=await response.clone().arrayBuffer();
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes)),b=>b.toString(16).padStart(2,"0")).join("");
 return digest===DIGESTS[path];
}
function pinnedDocument(html) {
 for(const path of ASSETS.slice(1)) {
  const attr=path.endsWith(".css")?"href":"src",original=attr+'="'+path+'"';
  if(html.split(original).length!==2)throw Error("Garage shell reference mismatch: "+path);
  html=html.replace(original,attr+'="'+path+OFFLINE_QUERY+'"');
 }
 return html;
}
async function validShellResponse(response, path) {
 if (!response.ok || response.redirected || response.status !== 200) return false;
 const type = response.headers.get("content-type") || "";
 if (path === "/garage") return /text\/html/i.test(type) && (await response.clone().text()).includes("garageApp()");
 if (path.endsWith(".css")) return /text\/css/i.test(type);
 return /(?:javascript|ecmascript)/i.test(type);
}
self.addEventListener("install", event => {
 event.waitUntil((async () => {
  const cache = await caches.open(CACHE);
  try {
   for (const path of ASSETS) {
    const response = await fetch(absolute(path), {cache:"reload",credentials:"same-origin",redirect:"error"});
    if (!await validShellResponse(response,path) || !await verifiedBytes(response,path)) throw new Error("Invalid Garage shell asset: " + path);
    if(path==="/garage"){
     const headers=new Headers(response.headers);
     for(const name of ["content-length","content-encoding","etag","last-modified"])headers.delete(name);
     headers.set("cache-control","no-store");
     const html=pinnedDocument(await response.text());
     await cache.put(absolute(path),new Response(html,{status:200,headers}));
    }else await cache.put(absolute(path)+OFFLINE_QUERY,response);
   }
  } catch (error) { await caches.delete(CACHE); throw error; }
 })());
});
self.addEventListener("activate", event => {
 event.waitUntil((async () => {
  for (const key of await caches.keys()) if (key.startsWith(PREFIX) && key !== CACHE) await caches.delete(key);
  await self.clients.claim();
 })());
});
self.addEventListener("fetch", event => {
 const request = event.request, url = new URL(request.url);
 if (request.method !== "GET" || url.origin !== self.location.origin || request.headers.has("range")) return;
 const shell = request.mode === "navigate" && (url.pathname === "/garage" || url.pathname === "/garage.html");
 const path = shell ? "/garage" : url.pathname;
 if (!allowed.has(path)) return;
 // Only the offline document uses pinned URLs. Never mix a live document's
 // scripts with a previous build, even when connectivity changes mid-load.
 if(!shell){
  if(path==="/garage" || !url.searchParams.has("garage-offline"))return;
  event.respondWith((async()=>{
   if(url.search!==OFFLINE_QUERY)return new Response("Offline Garage version unavailable",{status:503});
   const cached=await (await caches.open(CACHE)).match(absolute(path)+OFFLINE_QUERY);
   return cached||new Response("Offline Garage asset unavailable",{status:503});
  })());
  return;
 }
 // Only a transport failure permits offline document fallback; HTTP auth/error
 // responses and login redirects always remain authoritative.
 event.respondWith((async () => {
  try { return await fetch(request); }
  catch (error) {
   const cached = await (await caches.open(CACHE)).match(absolute(path));
   if (cached) return cached;
   throw error;
  }
 })());
});
