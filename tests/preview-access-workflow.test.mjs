import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {spawnSync} from "node:child_process";
const workflow=readFileSync(new URL("../.github/workflows/deploy-cloudflare.yml",import.meta.url),"utf8");
const step=workflow.slice(workflow.indexOf("      - name: Deploy isolated preview Worker for preview-branch"));
const guard=step.slice(step.indexOf("          ACCESS_HEADERS=()"),step.indexOf('          BRANCH='));
function run(id,secret,required){
 const r=spawnSync("bash",["-c",guard+'\nprintf "headers=%s\\n" "${#ACCESS_HEADERS[@]}"'],{encoding:"utf8",env:{...process.env,MOTORNOTE_ACCESS_CLIENT_ID:id,MOTORNOTE_ACCESS_CLIENT_SECRET:secret,MOTORNOTE_PREVIEW_ACCESS_REQUIRED:required}});
 return {status:r.status,stdout:r.stdout,stderr:r.stderr};
}
test("preview Access credential gate supports transition and fails closed when required",()=>{
 for(const [id,secret,required,status,headers] of [["","","",0,0],["","","false",0,0],["fixture-id","fixture-secret","true",0,4],["fixture-id","fixture-secret","false",0,4],["fixture-id","","false",1,null],["","fixture-secret","false",1,null],["","","true",1,null],["","","invalid",1,null]]){
 const r=run(id,secret,required);assert.equal(r.status,status,JSON.stringify(r));if(headers!==null)assert.ok(r.stdout.includes("headers="+headers));assert.doesNotMatch(r.stdout+r.stderr,/fixture-id|fixture-secret/);
 }
});
test("preview credentials stay scoped and all asset checks retain exact verification",()=>{
 assert.ok(step.includes("CF-Access-Client-Id"));assert.ok(step.includes("CF-Access-Client-Secret"));
 assert.equal((step.match(/curl "\$\{ACCESS_HEADERS\[@\]\}"/g)||[]).length,3);
 assert.doesNotMatch(step,/curl[^\n]*(?:--location(?:\s|$)| -L(?:\s|$))/);
 assert.match(step,/cmp -s \/tmp\/pdf-asset/);assert.match(step,/cmp "\/tmp\/ocr-asset"/);assert.match(step,/cmp \/tmp\/ui-asset/);
 assert.match(step,/anonymous-check=\$GITHUB_SHA/);
 assert.doesNotMatch(workflow.slice(0,workflow.indexOf("  deploy-preview:")),/MOTORNOTE_ACCESS_CLIENT_/);
});
