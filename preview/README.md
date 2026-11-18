# Isolated Manual Explorer preview

This Worker serves the feature-branch versions of `/manuals.html` and `/repair-workspace.js` from this repository. All other application assets and all `/m/*` manual requests are proxied to the existing `claude-manual` Worker.

- Preview Worker: `claude-manual-preview`
- Source branch: `feat/compact-repair-engine-integration`
- Upstream app and read-only manual corpus: existing `claude-manual` Worker and `motornote-manual-site` R2 binding
- No R2 writes, new bucket, database, or account are introduced.
- This is a public workers.dev preview unless Cloudflare Access is configured separately.

The preview is deliberately separate from the production Worker. It is a lightweight proxy so the feature branch can be exercised in the real viewer without copying the manual corpus or changing production assets.
