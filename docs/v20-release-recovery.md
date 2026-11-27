# MotorNote V20 release recovery plan

## Immutable recovery references (verified November 27, 2026)

- Current tested V9 baseline: `df94e628e8282eba0f880f09422696786c88ea6a`, Actions [46025649193](https://github.com/5cxxpb2yrr-ui/claude-manual/actions/runs/46025649193), uploaded Worker version `53acd743-c5af-4596-9d61-a720738c9175`. Both browser engines passed same-origin V9 HTML rollback and return with identical persisted collections and attachment bytes.
- Earlier V9 recovery candidate: `4a2d43c5cdc8e6e98c72e03a57871a0ace4a5334`, Actions [46008549997](https://github.com/5cxxpb2yrr-ui/claude-manual/actions/runs/46008549997), uploaded Worker version `1bf443b0-9f28-4ecc-b37f-4747d59a8606`. The application source difference is Garage Specs layout; runtime modules are unchanged.
- Pre-V20 production Worker version: `0db4a53d-ab1c-441d-bdd6-ea1826a03e0f` (last observed at 100% traffic on November 26 UTC). Recheck live deployment and version availability immediately before any change.

## Data safety

Application schema V7 and V9 share IndexedDB version 4, but V7 cannot safely save V9 records. Its startup serialization drops inventoryLedger, vendorOrders and toolInventory, strips inline data fields, and cannot hydrate V9 ArrayBuffer attachment rows. Never direct a browser containing V9 data to V7 as routine rollback.

The initial V9 recovery test passed using the pinned older Garage HTML with unchanged shared runtime modules on the same origin and database. The expanded test independently builds the recovery source and switches the entire static asset directory and service worker on that same test origin. It checks coherent version-pinned offline startup and all persisted collections and attachment bytes on recovery and return. The expanded test requires green CI before it can be considered verified. It does not perform an actual Cloudflare traffic rollback.

## Before release

1. Export portable backups with attachments from each device/origin that holds data; retain them privately off-browser. Verify the file and record counts before proceeding.
2. Resolve Access and public R2 protection; verify authenticated and unauthenticated paths and preserve the original manual corpus. Do not publish until this is resolved.
3. Confirm the exact release SHA, green CI, pinned V9 recovery version availability, physical iPhone acceptance and rollback compatibility. Obtain explicit approval for merge and production publication separately.
4. Keep the database schema at V9 for this release. Keep the recovery versions and source refs available; do not delete branches as part of release.

## If a release fails

Stop writes and export the latest readable V9 data before recovery. Recheck deployment history and select the known compatible V9 recovery version (not V7). A Worker rollback requires explicit authorization. Use the same production origin and do not clear browser storage. Check startup, service-worker version and asset coherence, data counts, ledger audit, purchase orders, tools, attachment access and a controlled save/reload. If the issue affects shared V9 persistence or migration itself, do not blindly switch versions: preserve current state and backups and use a reviewed forward recovery fix.

No production traffic changes or access changes are authorized by this document. A code rollback does not restore IndexedDB or R2 content.
