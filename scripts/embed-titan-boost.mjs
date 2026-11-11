import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const b = await readFile("public/audio/giganto/sonic-power-boost.mp3");
const data = {
  src: "data:audio/mpeg;base64," + b.toString("base64"),
  bytes: b.length,
  sha256: createHash("sha256").update(b).digest("hex"),
  loopStart: 3,
  loopEnd: 8.8,
};
const text =
  "// User-supplied effect; public/audio/giganto/BOOST-NOTICE.txt.\nexport const TITAN_BOOST=" +
  JSON.stringify(data) +
  ";\n";
let old;
try {
  old = await readFile("src/titan-boost-data.js", "utf8");
} catch {}
if (old !== text) await writeFile("src/titan-boost-data.js", text);
console.log("Embedded supplied Sonic power-boost recording.");
