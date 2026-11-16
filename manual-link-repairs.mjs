// Repairs for Scion manual links whose original target pages are not in the published corpus.
// Replacement targets are existing indexed pages with matching manual content/context.
export const SCION_PAGE_REPLACEMENTS = Object.freeze({
  610: 36,       // Headlamp Switch -> Parts and Labor > Sensors and Switches > Lighting
  726: 26,       // Blower Motor Switch -> Parts and Labor > Sensors and Switches > HVAC
  775: 1652,     // Wheel Bearing -> Repair and Diagnosis > Maintenance > Wheels and Tires
  1227: 81,      // Radiator Hose -> Parts and Labor > Maintenance > Hoses
  1228: 158,     // Radiator Cap -> Parts and Labor > Engine > Cooling System
  1230: 147,     // Water Pump Gasket -> Parts and Labor > Engine
  1231: 153,     // Fan Blade -> Parts and Labor > Cooling System
  1232: 159,     // Radiator Cooling Fan Motor -> Parts and Labor > Cooling System
  1233: 154,     // Fan Shroud -> Parts and Labor > Cooling System
  1234: 167,     // Thermostat Housing -> Parts and Labor > Cooling System
  1235: 129,     // Thermostat Gasket -> Parts and Labor > Engine
  1369: 99,      // Crankshaft -> Parts and Labor > Engine
  4238: 1667,    // General Maintenance -> existing Routine Service page
  4248: 1623,    // Drive Belt -> Repair and Diagnosis > Maintenance
  4274: 1636,    // Power Steering Fluid -> Repair and Diagnosis > Maintenance > Fluids
  4276: 1630,    // Brake Fluid -> Repair and Diagnosis > Maintenance > Fluids
  5972: 1613,    // Idle Speed -> Repair and Diagnosis > Maintenance
  6379: 1614,    // Fuel Pressure Release -> Fuel Filter maintenance procedure
  6735: 1631,    // Clutch Fluid -> Repair and Diagnosis > Maintenance > Fluids
});

export const SCION_UNAVAILABLE_PAGE_IDS = Object.freeze([
  1226, 1229, 1236,
  ...Array.from({ length: 30 }, (_, index) => 1265 + index),
  4266, 5970, 6056, 6759,
]);

const SCION_MANUAL_PREFIX =
  "manuals/scion-service-manual/2006 Scion xB L4-1.5L (1NZ-FE)/pages/";

export function resolveScionPageKey(key) {
  const match = key.match(
    /^(manuals\/scion-service-manual\/2006 Scion xB L4-1\.5L \(1NZ-FE\)\/pages\/)(\d+)\.html(?:\/.*)?$/,
  );
  if (!match) return null;

  const pageId = Number(match[2]);
  const replacement = SCION_PAGE_REPLACEMENTS[pageId];
  if (replacement) {
    return { kind: "redirect", pageId, key: `${SCION_MANUAL_PREFIX}${replacement}.html` };
  }
  if (SCION_UNAVAILABLE_PAGE_IDS.includes(pageId)) {
    return { kind: "unavailable", pageId };
  }

  const canonicalKey = `${match[1]}${pageId}.html`;
  return key === canonicalKey
    ? { kind: "unchanged", pageId, key: canonicalKey }
    : { kind: "canonical", pageId, key: canonicalKey };
}

export function resolveManualRootPath(manualRoot, value) {
  if (!value.startsWith("/") || value.startsWith("//")) return value;
  const suffix = value === "/" ? "index.html" : value.slice(1);
  return `/m/${manualRoot.slice("manuals/".length)}/${suffix}`;
}
