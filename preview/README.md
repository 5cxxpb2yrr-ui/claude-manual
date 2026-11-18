# Isolated Manual Explorer preview

This Worker serves the feature-branch versions of /garage, /garage.html, /manuals.html, and /repair-workspace.js from this repository. All other application assets and all /m/* manual requests are proxied to the existing claude-manual Worker.

- Preview Worker: branch-specific feat-compact-repair-engine-integration-claude-manual
- Source branch: feat/compact-repair-engine-integration
- Garage and Manual Explorer share a same-origin, browser-local project/cart link.
- Garage remains the owner of vehicle and project records; Manual Explorer stores procedure carts and associates them with Garage project IDs.
- No new account, backend database, R2 writes, or duplicate manual corpus are introduced.
- This is a public workers.dev preview unless Cloudflare Access is configured separately.

The preview is deliberately separate from the production Worker. It is a lightweight proxy so the feature branch can be exercised against the existing manual corpus without changing production assets.
