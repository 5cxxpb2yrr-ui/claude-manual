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
const absolute = path => new URL(path, self.location.origin).href;

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
    if (!await validShellResponse(response,path)) throw new Error("Invalid Garage shell asset: " + path);
    await cache.put(absolute(path),response);
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
 if (!allowed.has(path) || (!shell && (path === "/garage" || url.search))) return;
 // Only a transport failure permits offline fallback. Never override HTTP auth/error responses.
 event.respondWith((async () => {
  try { return await fetch(request); }
  catch (error) {
   const cached = await (await caches.open(CACHE)).match(absolute(path));
   if (cached) return cached;
   throw error;
  }
 })());
});
