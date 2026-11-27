import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const html=readFileSync(new URL("../public/garage.html",import.meta.url),"utf8");
const links=JSON.parse(html.slice(html.indexOf("commonSpecLinks: ")+17,html.indexOf(",\n\n\t\t\t\t\t// Service Manuals",html.indexOf("commonSpecLinks: "))));
test("Specs chips target verified current corpus IDs and maintain distinct labels",()=>{
 const expected={"scion-xb":[381,381,381,381,381,381,381,3368,2818,6108,385,8750],"subaru-crosstrek":[510,614,619,12028]};
 for(const [id,pages] of Object.entries(expected)){
  assert.deepEqual(links[id].map(l=>l.page),pages);
  assert.equal(new Set(links[id].map(l=>l.label)).size,pages.length);
  assert.ok(links[id].every(l=>l.heading&&l.evidence));
 }
});
test("Specs chips use a native nearly full-screen modal with a sandboxed document",()=>{
 assert.match(html,/<template x-for="l in specLinks" :key="l.label">\s*<button type="button" @click="openSpecPreview\(l\)"/);
 assert.match(html,/<dialog x-ref="specPreviewDialog"/);
 assert.match(html,/<iframe class="spec-preview-frame"[^>]*sandbox="allow-same-origin"/);
 assert.match(html,/heading!==state.heading\|\|!text.includes\(state.evidence.toLowerCase\(\)\)/);
 assert.match(html,/this\.\$refs\.specPreviewDialog\.showModal\(\)/);
});
