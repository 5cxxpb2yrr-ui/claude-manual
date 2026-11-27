import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const load=name=>{const m={exports:{}};new Function("module",readFileSync(new URL("../public/"+name+".js",import.meta.url),"utf8"))(m);return m.exports;};
const capture=load("inventory-capture"),purchase=load("inventory-purchasing");
// Synthetic examples of the supported explicit line grammar, not retailer-verified originals.
const receipt=vendor=>[vendor,"Store # 0042","Receipt # ABC-123","Date: 11/26/2026","SKU: 00123 Oil filter","Qty 2 @ $8.00 = $16.00","Part # AB-7 Drain gasket","Qty 1 @ $2.00 = $2.00","Subtotal $18.00","Tax $1.26","Total $19.26"].join("\n");
test("recognized retailer layouts reconcile explicit quantities and keep SKU separate from manufacturer identity",()=>{
 for(const vendor of ["AutoZone","O'Reilly Auto Parts","Advance Auto Parts","NAPA Auto Parts"]){
 const r=capture.parseReceiptText(receipt(vendor));assert.equal(r.vendor,vendor);assert.equal(r.orderNumber,"store-0042-2026-11-26-ABC-123");assert.equal(r.lines.length,2);assert.equal(r.lines[0].quantity,2);assert.equal(r.lines[0].partNumber,"");assert.equal(r.lines[0].retailerItemCode,"00123");assert.equal(r.lines[0].vehicleCompatibility,"Not verified");assert.equal(r.receiptTotals.total,19.26);
 const order=purchase.validateDraft(r);assert.equal(order.status,"Ordered");assert.equal(order.lines[0].retailerItemCode,"00123");
 }
});
test("ambiguous, unreconciled and unsupported receipts never create guessed item rows",()=>{
 const s=receipt("AutoZone");
 for(const bad of [s.replace("Qty 2 @ $8.00 = $16.00","$16.00"),s.replace("Subtotal $18.00","Subtotal $19.00"),s.replace("11/26/2026","02/30/2026"),s.replace("Store # 0042",""),s+"\nCORE CHARGE $5.00",s.replace("AutoZone","Other Shop"),s+"\nQty 1 @ $1.00 = $1.00"])assert.throws(()=>capture.parseReceiptText(bad));
});
test("Amazon dispatch retains existing single-item behavior",()=>{
 const s="Order placed November 25, 2026 Order # 111-1234567-7654321 Arriving Friday WIX 57055XP Oil Filter Sold by: Amazon.com $9.17 Item(s) Subtotal: $9.17 Grand Total: $9.17";
 assert.equal(capture.parseReceiptText(s).lines[0].partNumber,"57055XP");
});
