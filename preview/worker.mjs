const UPSTREAM = "https://claude-manual.phillipstg.workers.dev";
const SOURCE = "https://raw.githubusercontent.com/5cxxpb2yrr-ui/claude-manual/feat/compact-repair-engine-integration/public";
const OVERRIDES = {
  "/garage": { file: "garage.html", type: "text/html; charset=utf-8" },
  "/garage.html": { file: "garage.html", type: "text/html; charset=utf-8" },
  "/garage.css": { file: "garage.css", type: "text/css; charset=utf-8" },
  "/garage-overrides.css": { file: "garage-overrides.css", type: "text/css; charset=utf-8" },
  "/manuals.css": { file: "manuals.css", type: "text/css; charset=utf-8" },
  "/manuals": { file: "manuals.html", type: "text/html; charset=utf-8" },
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
      let source;
      try {
        source = await fetch(`${SOURCE}/${override.file}`, {
          cf: { cacheTtl: 60, cacheEverything: true }
        });
      } catch {
        source = null;
      }

      // GitHub's raw host can intermittently fail from edge runtimes. Fall
      // back to the authenticated-free Contents API for the same branch file.
      let body = source?.ok ? source.body : null;
      if (!body) {
        try {
          const apiUrl = new URL(
            `https://api.github.com/repos/5cxxpb2yrr-ui/claude-manual/contents/public/${override.file}`
          );
          apiUrl.searchParams.set("ref", "feat/compact-repair-engine-integration");
          const apiResponse = await fetch(apiUrl, {
            headers: { accept: "application/vnd.github+json", "user-agent": "claude-manual-preview" },
            cf: { cacheTtl: 60, cacheEverything: true }
          });
          if (apiResponse.ok) {
            const file = await apiResponse.json();
            if (file.encoding === "base64" && typeof file.content === "string") {
              const binary = atob(file.content.replace(/\\s/g, ""));
              const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
              body = new Response(bytes).body;
            }
          }
        } catch {
          body = null;
        }
      }

      if (!body) {
        return new Response("Preview source unavailable", {
          status: 502,
          headers: { "cache-control": "no-store", "x-lifeos-preview-source": "unavailable" }
        });
      }
      const headers = new Headers(source?.ok ? source.headers : undefined);
      headers.set("content-type", override.type);
      headers.set("cache-control", "public, max-age=15, stale-while-revalidate=60");
      headers.set("x-robots-tag", "noindex, nofollow");
      headers.set("x-lifeos-preview", "claude-manual-feature-branch");
      return new Response(request.method === "HEAD" ? null : body, {
        status: 200,
        headers
      });
    }

    const target = new URL(url.pathname + url.search, UPSTREAM);
    const upstreamRequest = new Request(target, request);
    let response = await fetch(upstreamRequest);

    // Some manual bundles publish shared Phoenix assets at the manual root,
    // rather than repeating them inside each vehicle folder. Try that
    // canonical location only when the vehicle-local asset is missing.
    if (response.status === 404) {
      const assetPath = url.pathname.match(/^\/m\/([^/]+)\/[^/]+\/assets\/(.+)$/);
      if (assetPath) {
        const fallback = new URL(
          `/m/${assetPath[1]}/assets/${assetPath[2]}${url.search}`,
          UPSTREAM
        );
        const fallbackResponse = await fetch(new Request(fallback, request));
        if (fallbackResponse.status !== 404) response = fallbackResponse;
      }
    }

    const headers = new Headers(response.headers);
    headers.set("x-lifeos-preview", "claude-manual-feature-branch");
    headers.set("x-robots-tag", "noindex, nofollow");

    if (url.pathname.startsWith("/m/") &&
        (headers.get("content-type") || "").includes("text/html") &&
        request.method !== "HEAD") {
      const html = (await response.text()).replaceAll(UPSTREAM, url.origin);
      headers.delete("content-length");
      headers.set("cache-control", "no-store");
      const manualRoot = url.pathname.split("/").slice(0, 4).join("/");
      const htmlResponse = new Response(html, {
        status: response.status,
        statusText: response.statusText,
        headers
      });
      return new HTMLRewriter()
        .on("script[src], link[href], img[src], source[src]", {
          element(element) {
            for (const attribute of ["src", "href"]) {
              const value = element.getAttribute(attribute);
              if (value && /^(?:\/|\.\/)?assets\//.test(value)) {
                element.setAttribute(attribute, manualRoot + "/" + value.replace(/^(?:\/|\.\/)?/, ""));
              }
            }
          }
        })
        .transform(htmlResponse);
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers
    });
  }
};
