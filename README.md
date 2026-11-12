# LifeOS Manual Explorer (B) — Worker + R2

Reads the manuals already in R2 bucket `motornote-manual-site` at `manuals/<manual-id>/<vehicle folder>/pages/N.html`.
Page indexes (drill-down trees) ship with the app in `public/data/`, so no catalog file is needed.yay. 

## Deploy as a NEW Worker (does not touch the existing lifeos-manual-explorer)
1. Put these files at the root of a new branch/repo.
2. Cloudflare > Workers & Pages > Create > import the repo. Worker name: `lifeos-manual-explorer-b`.
3. Build command: leave empty (or `npm run build`). Deploy command: `npx wrangler deploy`. Root directory: `/`.
4. Open the new URL. Header should read "R2 connected". `/m/...` serves objects from the bucket.

## Add a vehicle
1. `python tools/build_tree.py INDEX.html "Guide title" > public/data/<name>.json`
2. Add an entry to `public/data/manifest.json` (manual id + vehicle folder exactly as in R2).

## Notes
- Pages are served from `/m/...` at their real paths so their own CSS/images load.
- Protect the site with Cloudflare Access; /m/ exposes everything under `manuals/`.
