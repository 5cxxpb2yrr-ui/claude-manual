import { resolveManualRootPath, resolveScionPageKey } from "./manual-link-repairs.mjs";
import { PDF_READER_FILES } from "./pdf-reader-data.mjs";

const OCR_TYPES={"tesseract.min.js":"text/javascript","worker.min.js":"text/javascript","tesseract-core-lstm.wasm.js":"text/javascript","tesseract-core-lstm.wasm":"application/wasm","eng.traineddata.gz":"application/octet-stream"};
export async function serveGarageUi(request,env){
 const name=new URL(request.url).pathname.slice("/garage-ui-v1/".length),types={"garage.css":"text/css; charset=utf-8","alpine.min.js":"text/javascript; charset=utf-8","tailwindcss-LICENSE.txt":"text/plain; charset=utf-8","alpinejs-LICENSE.txt":"text/plain; charset=utf-8"};
 if(!Object.hasOwn(types,name))return new Response("Not found",{status:404});
 if(!["GET","HEAD"].includes(request.method))return new Response("Method not allowed",{status:405});
 const response=await env.ASSETS.fetch(new Request(request.url,{method:request.method,headers:{Accept:"*/*"}}));
 if(!response.ok||/text\/html/i.test(response.headers.get("content-type")||""))return new Response("Garage UI asset unavailable",{status:503,headers:{"cache-control":"no-store"}});
 const headers=new Headers(response.headers);headers.set("content-type",types[name]);headers.set("x-content-type-options","nosniff");headers.set("cache-control","no-cache");
 return new Response(request.method==="HEAD"?null:response.body,{status:200,headers});
}
export async function serveReceiptOcr(request,env){
 const name=new URL(request.url).pathname.slice("/receipt-ocr-v6/".length);
 if(!Object.hasOwn(OCR_TYPES,name))return new Response("Not found",{status:404});
 if(!["GET","HEAD"].includes(request.method))return new Response("Method not allowed",{status:405});
 const response=await env.ASSETS.fetch(new Request(request.url,{method:request.method,headers:{"Accept":"*/*"}}));
 if(!response.ok||/text\/html/i.test(response.headers.get("content-type")||""))return new Response("OCR asset unavailable",{status:503,headers:{"content-type":"text/plain","cache-control":"no-store"}});
 const headers=new Headers(response.headers);headers.set("content-type",OCR_TYPES[name]);headers.set("x-content-type-options","nosniff");
 return new Response(request.method==="HEAD"?null:response.body,{status:200,headers});
}
export function servePdfReader(request, files = PDF_READER_FILES) {
  const path = new URL(request.url).pathname;
  const name = path.split("/").pop();
  if (!["pdf.mjs", "pdf.worker.mjs", "LICENSE"].includes(name)) return new Response("Not found", { status: 404 });
  if (!["GET", "HEAD"].includes(request.method)) return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD" } });
  const body = files[name];
  if (typeof body !== "string" || !body.length) return new Response("PDF reader unavailable; build assets first", { status: 503, headers: { "content-type": "text/plain", "cache-control": "no-store" } });
  return new Response(request.method === "HEAD" ? null : body, { headers: { "content-type": name === "LICENSE" ? "text/plain; charset=utf-8" : "text/javascript; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" } });
}


// /m/<manual-id>/<vehicle folder>/... -> R2 key manuals/<manual-id>/<vehicle folder>/...
// Pages retain their real paths so relative stylesheets, images and icons continue to work.
const TYPES = {
  html: "text/html; charset=utf-8",
  css: "text/css",
  js: "text/javascript",
  svg: "image/svg+xml",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  txt: "text/plain; charset=utf-8",
};
// Manual documents are reference material, not trusted application code.
export const MANUAL_DOCUMENT_CSP = "sandbox allow-same-origin; script-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
const NAVIGATION_FILES = new Set([
  "scion-repair.json",
  "scion-parts.json",
  "subaru-repair.json",
  "subaru-labor.json",
]);

async function serveNavigationIndex(request, env, filename) {
  if (!NAVIGATION_FILES.has(filename)) {
    return new Response("Not found", { status: 404 });
  }

  const object = await env.MANUALS.get(`index/navigation/${filename}`);
  if (object) {
    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("content-type", "application/json; charset=utf-8");
    headers.set("cache-control", "public, max-age=300");
    return new Response(request.method === "HEAD" ? null : object.body, { headers });
  }

  // Keep the current app usable until the breadcrumb-generated indexes have
  // completed their first full-site publish to R2.
  return env.ASSETS.fetch(new Request(new URL(`/data/${filename}`, request.url), request));
}

function rewriteManualHtml(response, request, manualRoot, currentKey) {
  const requestUrl = new URL(request.url);
  const publicRoot = `/m/${manualRoot.slice("manuals/".length)}`;

  return new HTMLRewriter()
    .on("a[href], link[href], script[src], img[src], source[src], iframe[src], form[action]", {
      element(element) {
        const attributes = ["href", "src", "action"];
        for (const attribute of attributes) {
          const original = element.getAttribute(attribute);
          if (!original) continue;

          // The mirror does not include the original announcement file.
          // Keep the explanatory text, but do not expose a dead link.
          if (
            attribute === "href" &&
            currentKey.endsWith("/about.html") &&
            original === "nfo.html"
          ) {
            element.removeAttribute("href");
            element.setAttribute("aria-disabled", "true");
            element.setAttribute("title", "The original announcement is not included in this mirror.");
            continue;
          }

          // Some mirrored pages use root-relative paths for files that live
          // inside the vehicle folder. Route those paths through the R2 Worker.
          const rootRelative = resolveManualRootPath(manualRoot, original);
          if (rootRelative !== original) {
            element.setAttribute(attribute, rootRelative);
            continue;
          }

          let target;
          try {
            target = new URL(original, requestUrl);
          } catch {
            continue;
          }
          if (target.origin !== requestUrl.origin || !target.pathname.startsWith("/m/")) continue;

          let targetKey;
          try {
            targetKey = "manuals/" + decodeURIComponent(target.pathname.slice(3));
          } catch {
            continue;
          }

          const repair = resolveScionPageKey(targetKey);
          if (!repair) continue;

          if (repair.kind === "unavailable") {
            element.removeAttribute(attribute);
            element.setAttribute("aria-disabled", "true");
            element.setAttribute(
              "title",
              `Referenced Scion manual page ${repair.pageId} is not included in this corpus.`,
            );
            continue;
          }

          if (repair.kind === "redirect" || repair.kind === "canonical") {
            target.pathname = `/m/${repair.key.slice("manuals/".length)}`;
            element.setAttribute(attribute, target.toString());
          }
        }
      },
    })
    .transform(response);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname.startsWith("/garage-ui-v1/")) return serveGarageUi(request,env);
    if (url.pathname.startsWith("/receipt-ocr-v6/")) return serveReceiptOcr(request,env);
    if (url.pathname.startsWith("/api/receipt-pdf/4.10.38/") || url.pathname.startsWith("/vendor/pdfjs/")) {
      return servePdfReader(request);
    }

    if ((url.pathname.startsWith("/api/navigation/") || url.pathname.startsWith("/m/")) && !["GET", "HEAD"].includes(request.method)) {
      return new Response("Method not allowed", { status: 405, headers: { Allow: "GET, HEAD", "cache-control": "no-store" } });
    }

    if (url.pathname.startsWith("/api/navigation/")) {
      const filename = url.pathname.slice("/api/navigation/".length);
      return serveNavigationIndex(request, env, filename);
    }

    if (!url.pathname.startsWith("/m/")) {
      return env.ASSETS.fetch(request);
    }

    let key;
    try {
      key = "manuals/" + decodeURIComponent(url.pathname.slice(3));
    } catch {
      return new Response("Bad path", { status: 400 });
    }
    if (key.includes("..")) return new Response("Bad path", { status: 400 });

    // Keep the existing valve-clearance compatibility alias.
    const valveClearanceAlias =
      "manuals/scion-service-manual/2006 Scion xB L4-1.5L (1NZ-FE)/pages/4283.html";
    if (key === valveClearanceAlias) {
      const target = new URL(request.url);
      target.pathname = target.pathname.replace(/pages\/4283\.html$/, "pages/1620.html");
      return Response.redirect(target.toString(), 302);
    }

    // Repair known Scion cross-references before looking up the R2 object.
    // This also strips legacy breadcrumb suffixes appended after .html.
    const repair = resolveScionPageKey(key);
    if (repair?.kind === "redirect") {
      const target = new URL(request.url);
      target.pathname = `/m/${repair.key.slice("manuals/".length)}`;
      return Response.redirect(target.toString(), 302);
    }
    if (repair?.kind === "unavailable") {
      return new Response(
        `This Scion manual reference points to page ${repair.pageId}, which is not included in the published corpus.`,
        { status: 404, headers: { "content-type": "text/plain; charset=utf-8" } },
      );
    }
    if (repair?.kind === "canonical") key = repair.key;

    const object = await env.MANUALS.get(key);
    if (!object) {
      return new Response("Not found", { status: 404 });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    const extension = key.split(".").pop().toLowerCase();
    if (!headers.get("content-type") && TYPES[extension]) {
      headers.set("content-type", TYPES[extension]);
    }
    headers.set("etag", object.httpEtag);
    headers.set("x-content-type-options", "nosniff");
    if (extension === "html" || extension === "htm" || /(?:text\/html|application\/xhtml\+xml)/i.test(headers.get("content-type") || "")) {
      headers.set("content-security-policy", MANUAL_DOCUMENT_CSP);
    }
    // Manual HTML can link to pages replaced during a corpus publish; do not retain stale page documents.
    headers.set("cache-control", headers.has("content-security-policy") ? "no-store" : "public, max-age=86400");

    const response = new Response(request.method === "HEAD" ? null : object.body, { headers });
    if (extension === "html" && request.method !== "HEAD") {
      const manualRoot = key.split("/").slice(0, 3).join("/");
      return rewriteManualHtml(response, request, manualRoot, key);
    }
    return response;
  },
};
