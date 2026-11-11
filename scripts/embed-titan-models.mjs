import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const data = {};
for (const name of ["sonic", "giganto"]) {
  const b = await readFile(`public/models/titan/${name}.glb`);
  data[name] = {
    base64: b.toString("base64"),
    sha256: createHash("sha256").update(b).digest("hex"),
    bytes: b.length,
  };
}
const source =
  "// Generated offline from the validated user-supplied GLBs. See TITAN-ASSETS.md.\nexport const TITAN_GLB_DATA=" +
  JSON.stringify(data) +
  ";\n";
const file = "src/titan-model-data.js";
let old;
try {
  old = await readFile(file, "utf8");
} catch {}
if (old !== source) await writeFile(file, source);
console.log("Embedded two offline Titan models.");
