import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const exports = [];
for (const [name, file, title, id] of [
  ["WYVERN_PRELUDE", "titan-wyvern.mp3", "Titan WYVERN", "wyvern-prelude"],
  ["WYVERN_SCORE", "break-through-it-all.mp3", "Break Through It All", "wyvern-battle"],
]) {
  const bytes = await readFile(`public/audio/wyvern/${file}`);
  exports.push(`export const ${name}=${JSON.stringify({
    id, title, artist: "User-supplied", bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
    src: `data:audio/mpeg;base64,${bytes.toString("base64")}`,
  })};`);
}
const path = "src/wyvern-music-data.js";
const content = "// Generated from supplied recordings. See WYVERN-MUSIC.md.\n" + exports.join("\n") + "\n";
let previous;
try { previous = await readFile(path, "utf8"); } catch {}
if (previous !== content) await writeFile(path, content);
console.log("Embedded supplied Wyvern music.");
