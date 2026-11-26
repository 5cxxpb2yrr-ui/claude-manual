import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const dependency = new URL("../node_modules/pdfjs-dist/", import.meta.url);
const version = "4.10.38";
let installed = "";
try { installed = JSON.parse(readFileSync(new URL("package.json", dependency), "utf8")).version; } catch {}
if (installed !== version) {
  const result = spawnSync("npm", ["install", "--no-save", "--package-lock=false", "--ignore-scripts", "pdfjs-dist@" + version], { cwd: root, stdio: "inherit", shell: process.platform === "win32" });
  if (result.status !== 0) throw new Error("PDF reader dependency installation failed");
}
const files = {};
for (const [name, path] of [["pdf.mjs", "legacy/build/pdf.mjs"], ["pdf.worker.mjs", "legacy/build/pdf.worker.mjs"], ["LICENSE", "LICENSE"]]) {
  const content = readFileSync(new URL(path, dependency), "utf8");
  if (!content.length || (name.endsWith(".mjs") && content.length < 100000)) throw new Error("Incomplete PDF reader file: " + name);
  files[name] = content;
  console.log("Prepared", name, Buffer.byteLength(content), "bytes");
}
writeFileSync(new URL("../pdf-reader-data.mjs", import.meta.url), "// Generated; do not commit.\nexport const PDF_READER_FILES = " + JSON.stringify(files) + ";\n");
