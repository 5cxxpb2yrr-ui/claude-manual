import test from "node:test";
import assert from "node:assert/strict";
import {serveReceiptOcr} from "../worker.js";
const req=name=>new Request("https://example.com/receipt-ocr-v6/"+name);
test("OCR delivery rejects SPA fallback and unlisted assets",async()=>{
 const env={ASSETS:{fetch:async()=>new Response("<html>fallback</html>",{headers:{"content-type":"text/html"}})}};
 assert.equal((await serveReceiptOcr(req("worker.min.js"),env)).status,503);
 assert.equal((await serveReceiptOcr(req("private.json"),env)).status,404);
});
test("OCR route preserves bytes and explicit MIME",async()=>{
 const bytes=new Uint8Array([0,97,115,109,255]);
 const env={ASSETS:{fetch:async()=>new Response(bytes,{headers:{"content-type":"application/octet-stream"}})}};
 for(const [file,type] of [["tesseract-core-lstm.wasm","application/wasm"],["worker.min.js","text/javascript"],["eng.traineddata.gz","application/octet-stream"]]){
 const r=await serveReceiptOcr(req(file),env);assert.equal(r.status,200);assert.equal(r.headers.get("content-type"),type);assert.deepEqual(new Uint8Array(await r.arrayBuffer()),bytes);}
});
