import test from "node:test";
import assert from "node:assert/strict";
import worker from "../worker.js";

test("navigation API serves the generated R2 index", async () => {
  const payload = JSON.stringify({ c: [{ n: "Electrical", c: [] }] });
  let requestedKey = "";
  const env = {
    MANUALS: {
      get: async (key) => {
        requestedKey = key;
        const response = new Response(payload, {
          headers: { "content-type": "application/json" },
        });
        return {
          body: response.body,
          writeHttpMetadata(headers) {
            headers.set("content-type", "application/json");
          },
        };
      },
    },
    ASSETS: {
      fetch: async () => new Response("unexpected fallback", { status: 500 }),
    },
  };

  const response = await worker.fetch(
    new Request("https://manual.example/api/navigation/scion-repair.json"),
    env,
  );

  assert.equal(requestedKey, "index/navigation/scion-repair.json");
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type"), /application\/json/);
  assert.deepEqual(await response.json(), { c: [{ n: "Electrical", c: [] }] });
});

test("navigation API falls back to the bundled tree before the first R2 publish", async () => {
  let fallbackUrl = "";
  const env = {
    MANUALS: { get: async () => null },
    ASSETS: {
      fetch: async (request) => {
        fallbackUrl = new URL(request.url).pathname;
        return new Response('{"c":[]}', {
          headers: { "content-type": "application/json" },
        });
      },
    },
  };

  const response = await worker.fetch(
    new Request("https://manual.example/api/navigation/scion-repair.json"),
    env,
  );

  assert.equal(fallbackUrl, "/data/scion-repair.json");
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { c: [] });
});

test("navigation API does not expose arbitrary R2 keys", async () => {
  let readCount = 0;
  const env = {
    MANUALS: { get: async () => { readCount += 1; return null; } },
    ASSETS: { fetch: async () => new Response("unexpected", { status: 500 }) },
  };

  const response = await worker.fetch(
    new Request("https://manual.example/api/navigation/secrets.json"),
    env,
  );

  assert.equal(response.status, 404);
  assert.equal(readCount, 0);
});

test("manual content and navigation endpoints reject non-read methods before touching storage",async()=>{
 let reads=0;
 const env={MANUALS:{get:async()=>{reads++;return null}},ASSETS:{fetch:async()=>{reads++;return new Response("unexpected")}}};
 for(const path of ["/api/navigation/scion-repair.json","/m/scion-service-manual/example/pages/1.html"]){
  for(const method of ["POST","PUT","PATCH","DELETE"]){
   const response=await worker.fetch(new Request("https://manual.example"+path,{method}),env);
   assert.equal(response.status,405);
   assert.equal(response.headers.get("Allow"),"GET, HEAD");
  }
 }
 assert.equal(reads,0);
});
