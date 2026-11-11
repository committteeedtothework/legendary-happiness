import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const b = await readFile("public/audio/giganto/titan-giganto.mp3");
const data = {
  id: "titan-giganto",
  title: "Titan: GIGANTO",
  src: "data:audio/mpeg;base64," + b.toString("base64"),
  bytes: b.length,
  sha256: createHash("sha256").update(b).digest("hex"),
};
const text =
  "// User-supplied pre-fight recording; public/audio/giganto/PRELUDE-NOTICE.txt.\nexport const TITAN_PRELUDE=" +
  JSON.stringify(data) +
  ";\n";
let old;
try {
  old = await readFile("src/titan-prelude-data.js", "utf8");
} catch {}
if (old !== text) await writeFile("src/titan-prelude-data.js", text);
console.log("Embedded supplied Titan pre-fight recording.");
