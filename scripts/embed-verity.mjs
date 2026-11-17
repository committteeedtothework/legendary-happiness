import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const b = await readFile("public/models/verity/lord-verity.glb");
const text =
  "// Original rigged reference recreation; see LORD-VERITY.md.\nexport const VERITY_GLB=" +
  JSON.stringify({
    base64: b.toString("base64"),
    bytes: b.length,
    sha256: createHash("sha256").update(b).digest("hex"),
  }) +
  ";\n";
let old;
try {
  old = await readFile("src/verity-model-data.js", "utf8");
} catch {}
if (old !== text) await writeFile("src/verity-model-data.js", text);
console.log("Embedded rigged Lord Verity model.");
