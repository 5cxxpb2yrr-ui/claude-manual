import { readFileSync, writeFileSync, mkdirSync, copyFileSync, readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const dependency = new URL("../node_modules/pdfjs-dist/", import.meta.url);
const version = "4.10.38";
const pins = {"pdfjs-dist":"4.10.38","tesseract.js":"6.0.1","tesseract.js-core":"6.0.0","@tesseract.js-data/eng":"1.0.0","tailwindcss":"4.1.17","@tailwindcss/cli":"4.1.17","alpinejs":"3.14.9"};
const pkg = name => new URL("../node_modules/" + name + "/", import.meta.url);
const installed = name => { try { return JSON.parse(readFileSync(new URL("package.json", pkg(name)), "utf8")).version; } catch { return ""; } };
if (Object.entries(pins).some(([name,v]) => installed(name) !== v)) {
 const result=spawnSync("npm",["install","--no-save","--package-lock=false","--ignore-scripts",...Object.entries(pins).map(([name,v])=>name+"@"+v)],{cwd:root,stdio:"inherit",shell:process.platform==="win32"});
 if(result.status!==0)throw Error("Receipt dependency installation failed");
}
for(const [name,v] of Object.entries(pins))if(installed(name)!==v)throw Error("Unexpected dependency version: "+name);
const files = {};
for (const [name, path] of [["pdf.mjs", "legacy/build/pdf.mjs"], ["pdf.worker.mjs", "legacy/build/pdf.worker.mjs"], ["LICENSE", "LICENSE"]]) {
  const content = readFileSync(new URL(path, dependency), "utf8");
  if (!content.length || (name.endsWith(".mjs") && content.length < 100000)) throw new Error("Incomplete PDF reader file: " + name);
  files[name] = content;
  console.log("Prepared", name, Buffer.byteLength(content), "bytes");
}
writeFileSync(new URL("../pdf-reader-data.mjs", import.meta.url), "// Generated; do not commit.\nexport const PDF_READER_FILES = " + JSON.stringify(files) + ";\n");

const dest=new URL("../public/receipt-ocr-v6/",import.meta.url);
mkdirSync(dest,{recursive:true});
const assets=[
["tesseract.js","dist/tesseract.min.js","tesseract.min.js"],
["tesseract.js","dist/worker.min.js","worker.min.js"],
["tesseract.js-core","tesseract-core-lstm.wasm.js","tesseract-core-lstm.wasm.js"],
["tesseract.js-core","tesseract-core-lstm.wasm","tesseract-core-lstm.wasm"],
["@tesseract.js-data/eng","4.0.0_best_int/eng.traineddata.gz","eng.traineddata.gz"]];
for(const [name,source,target] of assets){const output=new URL(target,dest);copyFileSync(new URL(source,pkg(name)),output);console.log("Prepared OCR",target,readFileSync(output).length,"bytes");}
for(const name of ["tesseract.js","tesseract.js-core","@tesseract.js-data/eng"]){const license=readdirSync(pkg(name)).find(x=>/^licen[cs]e(?:\.|$)/i.test(x));if(license)copyFileSync(new URL(license,pkg(name)),new URL(name.replace(/[^a-z0-9-]/gi,"-")+"-LICENSE.txt",dest));}

// Compile Garage utilities before deployment; no browser-side Tailwind compiler.
const ui=new URL("../public/garage-ui-v1/",import.meta.url);
mkdirSync(ui,{recursive:true});
const cssPath=fileURLToPath(new URL("garage.css",ui));
const cli=JSON.parse(readFileSync(new URL("package.json",pkg("@tailwindcss/cli")),"utf8")).bin;
const cssBuild=spawnSync(process.execPath,[fileURLToPath(new URL(typeof cli==="string"?cli:cli.tailwindcss,pkg("@tailwindcss/cli"))),"-i",fileURLToPath(new URL("../styles/garage.css",import.meta.url)),"-o",cssPath,"--minify"],{cwd:root,stdio:"inherit"});
if(cssBuild.status!==0)throw Error("Garage CSS compilation failed");
copyFileSync(new URL("dist/cdn.min.js",pkg("alpinejs")),new URL("alpine.min.js",ui));
for(const name of ["tailwindcss","alpinejs"]){const license=readdirSync(pkg(name)).find(x=>/^licen[cs]e(?:\.|$)/i.test(x));if(license)copyFileSync(new URL(license,pkg(name)),new URL(name+"-LICENSE.txt",ui));}
console.log("Garage UI bytes",readFileSync(cssPath).length,readFileSync(new URL("alpine.min.js",ui)).length);

// Version the offline shell from its actual built bytes, including the runtime and CSS.
const offlineTemplate=readFileSync(new URL("garage-sw.template.js",import.meta.url),"utf8");
const {createHash}=await import("node:crypto");
const shellHash=createHash("sha256").update(offlineTemplate);
for(const path of ["/garage","/garage-ui-v1/garage.css","/garage-ui-v1/alpine.min.js","/repair-workspace.js","/repair-planner.js","/inventory-engine.js","/repair-history.js","/garage-mission.js","/garage-backup.js","/inventory-demand.js","/inventory-purchasing.js","/inventory-capture.js","/inventory-prices.js"])shellHash.update(path).update(readFileSync(new URL("../public"+(path==="/garage"?"/garage.html":path),import.meta.url)));
writeFileSync(new URL("../public/garage-sw.js",import.meta.url),offlineTemplate.replace("__GARAGE_BUILD_HASH__",shellHash.digest("hex")));
