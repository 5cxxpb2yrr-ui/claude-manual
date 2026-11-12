// /m/<manual-id>/<vehicle folder>/... -> R2 key manuals/<manual-id>/<vehicle folder>/...
// Serving pages at their real paths keeps each page's relative ../style.css, ../images, ../icons links working.
const TYPES = { html: "text/html; charset=utf-8", css: "text/css", js: "text/javascript", svg: "image/svg+xml",
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", txt: "text/plain; charset=utf-8" };
export default {
  async fetch(req, env) {
    const u = new URL(req.url);
    if (u.pathname.startsWith("/m/")) {
      let key;
      try { key = "manuals/" + decodeURIComponent(u.pathname.slice(3)); } catch { return new Response("Bad path", { status: 400 }); }
      if (key.includes("..")) return new Response("Bad path", { status: 400 });
      const o = await env.MANUALS.get(key);
      if (!o) return new Response("Not found", { status: 404 });
      const h = new Headers(); o.writeHttpMetadata(h);
      const ext = key.split(".").pop().toLowerCase();
      if (!h.get("content-type") && TYPES[ext]) h.set("content-type", TYPES[ext]);
      h.set("etag", o.httpEtag); h.set("cache-control", "public, max-age=86400");
      return new Response(req.method === "HEAD" ? null : o.body, { headers: h });
    }
    return env.ASSETS.fetch(req);
  },
};
