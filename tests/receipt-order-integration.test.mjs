import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const load=name=>{const module={exports:{}};new Function("module",readFileSync(new URL("../public/"+name+".js",import.meta.url),"utf8"))(module);return module.exports;};
const capture=load("inventory-capture"),purchase=load("inventory-purchasing");
// Synthetic receipt fixture: no personal order identifiers.
const text="Order placed November 25, 2026 Order # 111-1234567-7654321 Arriving Friday WIX 57055XP Oil Filter Sold by: Amazon.com $9.17 Item(s) Subtotal: $9.17 Shipping & Handling: $0.00 Subscribe & Save: -$0.46 Estimated tax to be collected: $0.61 Grand Total: $9.32";
test("Amazon extraction preserves receipt amounts through review, save and receiving",()=>{
 const parsed=capture.parseAmazonText(text);
 assert.equal(parsed.lines[0].partNumber,"57055XP");
 assert.equal(parsed.lines[0].vehicleCompatibility,"Not verified");
 assert.deepEqual(parsed.receiptTotals,{subtotal:9.17,shipping:0,discount:-0.46,tax:0.61,total:9.32});
 const draft={...parsed,receiptSource:{name:"fixture.pdf",sha256:"synthetic"}};
 const order={...purchase.validateDraft(draft),id:"fixture"};
 assert.equal(order.status,"Ordered");
 assert.equal(order.lines[0].receivedQuantity,0);
 assert.deepEqual(order.receiptTotals,parsed.receiptTotals);
 assert.throws(()=>purchase.validateDraft(draft,[order]),/already recorded/);
 assert.throws(()=>purchase.validateDraft({...draft,orderNumber:"different"},[order]),/receipt file/);
 const received=purchase.receive(order,[],{"line-1":1},"2026-11-26");
 assert.equal(received.order.status,"Received");
 assert.equal(received.inventory[0].quantity,1);
 assert.equal(received.inventory[0].unitCost,9.17);
 assert.deepEqual(received.order.receiptTotals,parsed.receiptTotals);
 assert.throws(()=>purchase.receive(received.order,received.inventory,{"line-1":1}),/not open/);
});
test("receipt totals require attached evidence and reject invalid numeric amounts",()=>{
 const parsed=capture.parseAmazonText(text);
 assert.equal(purchase.validateDraft(parsed).receiptTotals,undefined);
 assert.throws(()=>purchase.validateDraft({...parsed,receiptSource:{name:"fixture.pdf"},receiptTotals:{total:NaN}}),/Invalid extracted receipt amount/);
});
