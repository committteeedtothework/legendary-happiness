import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const b = await readFile("public/audio/giganto/undefeatable.mp3");
const content =
  "// Generated from the user-supplied recording. See GIGANTO-MUSIC.md.\nexport const GIGANTO_SCORE=" +
  JSON.stringify({
    base64: b.toString("base64"),
    bytes: b.length,
    sha256: createHash("sha256").update(b).digest("hex"),
  }) +
  ";\n";
let previous;
try {
  previous = await readFile("src/giganto-score-data.js", "utf8");
} catch {}
if (previous !== content) await writeFile("src/giganto-score-data.js", content);
console.log("Embedded supplied Giganto score.");
