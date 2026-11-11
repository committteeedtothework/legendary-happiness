import { build } from "esbuild";
import { writeFile } from "node:fs/promises";
const result = await build({
  entryPoints: ["src/terrain-worker.js"],
  bundle: true,
  format: "iife",
  minify: true,
  write: false,
});
await writeFile(
  "src/worker-code.js",
  "// Generated from terrain-worker.js by scripts/build-worker.mjs.\nexport default " +
    JSON.stringify(result.outputFiles[0].text) +
    ";\n",
);
console.log("Embedded terrain worker generated.");
