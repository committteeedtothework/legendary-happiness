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

const audio=await readFile("public/audio/verity/master-of-humanity.mp3");
const audioText="// User-supplied Lord Verity recording; see public/audio/verity/NOTICE.txt.\nexport const VERITY_AUDIO="+JSON.stringify({src:"data:audio/mpeg;base64,"+audio.toString("base64"),bytes:audio.length,duration:140.852245,sha256:createHash("sha256").update(audio).digest("hex")})+";\n";
let oldAudio;try{oldAudio=await readFile("src/verity-audio-data.js","utf8");}catch{}
if(oldAudio!==audioText)await writeFile("src/verity-audio-data.js",audioText);
console.log("Embedded user-supplied Lord Verity song.");
