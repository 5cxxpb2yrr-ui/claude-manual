import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const garageUrl = new URL("../public/garage.html", import.meta.url);
const garage = await readFile(garageUrl, "utf8");
const scheduleBlock = garage.match(/schedules:\s*\[([\s\S]*?)\n\s*\],\s*\n\s*logs:/)?.[1];

assert.ok(scheduleBlock, "Garage must define a maintenance schedule");

const schedules = [...scheduleBlock.matchAll(
  /\{\s*id:\s*'([^']+)'(?:,\s*vehicleId:\s*'([^']+)')?,\s*serviceName:\s*'([^']+)',\s*intervalMiles:\s*(\d+),\s*intervalDays:\s*(\d+),\s*terms:\s*\[([^\]]*)\](?:,\s*knowledgeBaseId:\s*'([^']+)')?\s*\}/g,
)].map((match) => ({
  id: match[1],
  vehicleId: match[2] || null,
  serviceName: match[3],
  intervalMiles: Number(match[4]),
  intervalDays: Number(match[5]),
  knowledgeBaseId: match[7] || null,
}));

const knowledgeBaseIds = new Set(
  [...garage.matchAll(/\bid:\s*'(kb-[^']+)'/g)].map((match) => match[1]),
);

test("every maintenance schedule is scoped to a vehicle", () => {
  assert.equal(schedules.length, 18);
  assert.ok(schedules.every((item) => item.vehicleId));
  assert.equal(schedules.filter((item) => item.vehicleId === "scion-xb").length, 6);
  assert.equal(schedules.filter((item) => item.vehicleId === "subaru-crosstrek").length, 12);
});

test("Subaru schedule uses the audited factory intervals", () => {
  const subaru = schedules.filter((item) => item.vehicleId === "subaru-crosstrek");
  const byId = Object.fromEntries(subaru.map((item) => [item.id, item]));

  assert.deepEqual(
    [byId.subaru_oil.intervalMiles, byId.subaru_oil.intervalDays],
    [6000, 183],
  );
  assert.deepEqual(
    [byId.subaru_tires.intervalMiles, byId.subaru_tires.intervalDays],
    [7500, 365],
  );
  assert.deepEqual(
    [byId.subaru_brake_fluid.intervalMiles, byId.subaru_brake_fluid.intervalDays],
    [30000, 913],
  );
  assert.deepEqual(
    [byId.subaru_cvt_inspection.intervalMiles, byId.subaru_cvt_inspection.intervalDays],
    [30000, 913],
  );
  assert.deepEqual(
    [byId.subaru_spark_plugs.intervalMiles, byId.subaru_spark_plugs.intervalDays],
    [60000, 1826],
  );
});

test("schedule procedure references resolve to Knowledge Base entries", () => {
  const linked = schedules.filter((item) => item.knowledgeBaseId);
  assert.equal(linked.length, 15);
  for (const item of linked) {
    assert.ok(
      knowledgeBaseIds.has(item.knowledgeBaseId),
      `${item.id} points to missing Knowledge Base procedure ${item.knowledgeBaseId}`,
    );
  }
  assert.ok(
    schedules.filter((item) => item.vehicleId === "subaru-crosstrek")
      .every((item) => item.knowledgeBaseId),
    "Every Subaru scheduled item must open its matching procedure",
  );
});

test("predictive maintenance filters schedules by vehicle and exposes the procedure action", () => {
  assert.match(
    garage,
    /this\.schedules\.filter\(sch => !sch\.vehicleId \|\| sch\.vehicleId === vehicle\.id\)/,
  );
  assert.match(
    garage,
    /openKnowledgeBaseProcedure\(nextScheduledMaintenance\.knowledgeBaseId\)/,
  );
  assert.match(garage, /openKnowledgeBaseProcedure\(id\)/);
});
