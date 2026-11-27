import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const html=readFileSync(new URL("../public/garage.html",import.meta.url),"utf8");
test("primary and secondary navigation covers all existing destinations",()=>{
 const ids=[...html.matchAll(/\{ id: '([^']+)', label: '[^']+', icon:/g)].map(m=>m[1]);
 const primary=html.match(/primaryTabIds: \[([^\]]+)\]/)[1].match(/'[^']+'/g).map(x=>x.slice(1,-1));
 const groups=html.slice(html.indexOf("get groupedMoreTabs(){"),html.indexOf("openCaptureDestination(kind){"));
 const secondary=[...groups.matchAll(/ids:\[([^\]]+)\]/g)].flatMap(m=>JSON.parse("["+m[1]+"]"));
 assert.deepEqual(primary,["dashboard","projects","inventory"]);assert.deepEqual([...primary,...secondary].sort(),ids.sort());
});
test("capture delegates to existing forms and detail sections retain controls",()=>{
 for(const action of ["this.openNewRepairModal()","this.modals.newProject=true","this.openNewPartModal()","this.modals.updateMileage=true","this.modals.smartSearch=true"])assert.ok(html.slice(html.indexOf("openCaptureDestination(kind){"),html.indexOf("get moreTabActive() {")).includes(action));
 for(const heading of ["Project workspace","Parts & procurement","Supplier purchasing","Receipts & project evidence","Actual expenses"])assert.ok(html.includes('<summary class="text-sm font-bold text-white">'+heading+'</summary>'));
 assert.match(html,/saveProjectWorkspace\(selectedProject\)/);assert.match(html,/openProjectCompletion\(selectedProject\)/);
});
test("mobile details support safe areas and zoom",()=>{
 assert.doesNotMatch(html,/user-scalable=no|maximum-scale=1\.0/);assert.match(html,/\.garage-detail-panel\{[^}]*100dvh/);assert.match(html,/env\(safe-area-inset-bottom\)/);assert.match(html,/\[x-cloak\]\{display:none!important\}/);
});

test("Specs use collapsed details and Service Manuals has one header shortcut and modal",()=>{
 const profile=html.slice(html.indexOf("<!-- 12. VEHICLE SPECS"),html.indexOf("<!-- 13. DATABASE HEALTH"));
 assert.match(profile,/<details[^>]*data-vehicle-spec-summary>/);assert.match(profile,/<details[^>]*data-common-specs>/);assert.match(profile,/<details[^>]*data-spec-category>/);
 assert.match(profile,/@click="openServiceManuals\(\)"/);assert.match(profile,/@click="openEditVehicleModal\(\)"/);
 assert.doesNotMatch(profile,/x-model="manualQuery"/);assert.equal((html.match(/x-model="manualQuery"/g)||[]).length,1);
 assert.match(html,/<dialog x-ref="serviceManualsDialog"[^>]*aria-label="Vehicle service manuals"/);
 assert.match(html,/openServiceManuals\(\)\{this\.\$refs\.serviceManualsDialog\.showModal\(\);\}/);
});

test("V20.1 shared navigation preserves secondary destinations and capture routes",()=>{
 const nav=html.slice(html.indexOf('<nav class="mn-nav'),html.indexOf('</nav>',html.indexOf('<nav class="mn-nav')));
 for(const label of ["Home","Projects","Capture","Inventory","Manuals"])assert.ok(nav.includes('<span>'+label+'</span>'));
 assert.match(html,/else if\(h==="capture"\)\{this.modals.captureMenu=true/);
 assert.match(html,/aria-label="More" :aria-expanded="modals.navMenu"/);
 assert.match(html,/missionGroup=group.name;\$refs.missionDialog.showModal\(\)/);
 assert.match(html,/\$refs.missionDialog.close\(\);openGarageMission\(item\)/);
 const manual=readFileSync(new URL("../public/manuals.html",import.meta.url),"utf8");
 for(const route of ["/garage","/garage#projects","/garage#capture","/garage#inventory"])assert.ok(manual.includes('["'+route+'",'));
 assert.match(manual,/\["#\/","Manuals","book"\]/);
 assert.match(manual,/id="cf"/);assert.match(manual,/id="cr"/);
});
