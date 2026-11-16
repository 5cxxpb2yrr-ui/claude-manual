# Scion manual broken-link repair report

This report records the 56 distinct missing Scion page IDs found by reconciling the navigation JSON with the published R2 HTML corpus.

## Verified replacements

Each destination below is an existing page ID in the Scion navigation JSON and physical corpus. Replacements preserve the topic rather than inventing replacement manual content.

| Missing page | Existing destination | Reason |
|---:|---:|---|
| 610 | 36 | Headlamp Switch parts entry |
| 726 | 26 | Blower Motor Switch parts entry |
| 775 | 1652 | Wheel Bearing maintenance entry |
| 1227 | 81 | Radiator Hose parts entry |
| 1228 | 158 | Radiator Cap parts entry |
| 1230 | 147 | Water Pump Gasket parts entry |
| 1231 | 153 | Fan Blade parts entry |
| 1232 | 159 | Radiator Cooling Fan Motor parts entry |
| 1233 | 154 | Fan Shroud parts entry |
| 1234 | 167 | Thermostat Housing parts entry |
| 1235 | 129 | Thermostat Gasket parts entry |
| 1369 | 99 | Crankshaft parts entry |
| 4238 | 1667 | Existing Routine Service page contains the general maintenance content |
| 4248 | 1623 | Drive Belt maintenance entry |
| 4274 | 1636 | Power Steering Fluid maintenance entry |
| 4276 | 1630 | Brake Fluid maintenance entry |
| 5972 | 1613 | Idle Speed maintenance entry |
| 6379 | 1614 | Fuel Pressure Release procedure under Fuel Filter maintenance |
| 6735 | 1631 | Clutch Fluid maintenance entry |

## References left non-clickable

These references have no safe one-to-one destination in the indexed corpus. The Worker removes the dead link target while preserving the surrounding text or image.

| Source page | Missing target(s) | Treatment |
|---:|---|---|
| 148 (Images / Engine) | 1265–1294 | Keep image content; remove links to absent image-detail pages |
| 170 (Images / Cooling System) | 1226, 1229, 1236 | Keep image content; remove links where the component label cannot be verified |
| 1729 (Outside Vehicle) | 4266 | Keep “fluids” text; no generic Fluids page exists |
| 1617 (Ignition Timing: Testing and Inspection) | 5970 | Keep text; this is a missing parent/category page, not a distinct procedure page |
| 1621 (Tune-up and Engine Performance Checks: Service Precautions) | 6056 | Keep “fuel filters” text; no equivalent Fuel Filter procedure page exists |
| 1649 (Service Reminder Indicators: Service Precautions) | 6759 | Keep text; the missing target is a category parent with multiple child topics |

Total disposition: 19 redirects and 37 non-clickable references.

## Additional routing corrections

- Legacy Scion links that append breadcrumb text after `.html` are normalized. Both slash-suffixed and comma-suffixed variants are handled.
- Root-relative manual paths such as `/style.css` and `/` are routed to the current vehicle folder in R2. App assets under `/assets/` are left alone.
- The `nfo.html` link on the mirror's About page is made non-clickable because that file is not included in this corpus.
- The existing 4283 → 1620 valve-clearance compatibility alias is preserved.

## Validation

The new Node test suite covers all 56 audited IDs, all 19 replacements, all 37 unavailable targets, both legacy suffix formats, and root-relative manual asset paths. Run with `npm test`.

The validator that produced the earlier CI log is not present in this repository's current `main` tree, so this branch does not claim to modify that separate validator. The Worker-side path handling corrects the actual serving behavior for the root-relative references.
