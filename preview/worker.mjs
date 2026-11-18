const UPSTREAM = "https://claude-manual.phillipstg.workers.dev";
const SOURCE = "https://raw.githubusercontent.com/5cxxpb2yrr-ui/claude-manual/feat/compact-repair-engine-integration/public";
const OVERRIDES = {
  "/manuals.html": { file: "manuals.html", type: "text/html; charset=utf-8" },
  "/repair-workspace.js": { file: "repair-workspace.js", type: "text/javascript; charset=utf-8" }
};

export default {
  async fetch(request) {
    const url = new URL(request.url);
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Preview is read-only", { status: 405, headers: { "allow": "GET, HEAD" } });
    }
    const override = OVERRIDES[url.pathname];

    if (override && (request.method === "GET" || request.method === "HEAD")) {
      const source = await fetch(`${SOURCE}/${override.file}`, {
        cf: { cacheTtl: 0, cacheEverything: false }
      });
      if (!source.ok) return new Response("Preview source unavailable", { status: 502 });
      const headers = new Headers(source.headers);
      headers.set("content-type", override.type);
      headers.set("cache-control", "no-store");
      headers.set("x-robots-tag", "noindex, nofollow");
      headers.set("x-lifeos-preview", "claude-manual-feature-branch");
    headers.set("x-robots-tag", "noindex, nofollow");
      return new Response(request.method === "HEAD" ? null : source.body, {
        status: source.status,
        headers
      });
    }

    const target = new URL(url.pathname + url.search, UPSTREAM);
    const upstreamRequest = new Request(target, request);
    const response = await fetch(upstreamRequest);
    const headers = new Headers(response.headers);
    headers.set("x-lifeos-preview", "claude-manual-feature-branch");

    if (url.pathname.startsWith("/m/") &&
        (headers.get("content-type") || "").includes("text/html") &&
        request.method !== "HEAD") {
      const html = (await response.text()).replaceAll(UPSTREAM, url.origin);
      headers.delete("content-length");
      headers.set("cache-control", "no-store");
      return new Response(html, {
        status: response.status,
        statusText: response.statusText,
        headers
      });
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }
};
