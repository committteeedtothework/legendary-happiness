import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const b = await readFile("public/models/wyvern/wyvern.glb"),
  text =
    "// Generated from the credited supplied Wyvern; see WYVERN.md.\nexport const WYVERN_GLB=" +
    JSON.stringify({
      base64: b.toString("base64"),
      bytes: b.length,
      sha256: createHash("sha256").update(b).digest("hex"),
    }) +
    ";\n";
let old;
try {
  old = await readFile("src/wyvern-model-data.js", "utf8");
} catch {}
if (old !== text) await writeFile("src/wyvern-model-data.js", text);
console.log("Embedded animated Wyvern.");
