import { build, transform } from "esbuild";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
const target = resolve(process.argv[2] || "dist/DCSMCRAFT-Standalone.html");
const bundle = await build({
  entryPoints: ["src/main.js"],
  define: { __DCSMCRAFT_DEV__: "false" },
  bundle: true,
  format: "iife",
  minify: true,
  write: false,
  loader: { ".css": "empty" },
});
const css = await Promise.all(
  [
    "src/style.css",
    "src/pixel-ui.css",
    "src/stand-ui.css",
    "src/giganto.css",
    "src/controller.css",
    "src/save-status.css",
    "src/java-menus.css",
    "src/touch.css",
    "src/wyvern.css",
  ].map((path) => readFile(path, "utf8")),
);
const style = await transform(css.join("\n"), {
  loader: "css",
  minify: true,
});
const icon = Buffer.from(await readFile("public/icon.svg")).toString("base64");
const license =
  (await readFile("LICENSE", "utf8")) +
  "\nBarlow Condensed font (SIL Open Font License):\n" +
  (await readFile("public/fonts/frontiers/OFL.txt", "utf8")) +
  "\nThree.js:\n" +
  (await readFile("public/THREE-LICENSE.txt", "utf8")) +
  "\nUser-supplied Devin claim audio:\n" +
  (await readFile("public/audio/DEVIN-CLAIM-NOTICE.txt", "utf8")) +
  "\nUser-supplied Matthew claim audio:\n" +
  (await readFile("public/audio/MATTHEW-CLAIM-NOTICE.txt", "utf8")) +
  "\nUser-supplied console menu audio:\n" +
  (await readFile("public/audio/MENU-SOUNDS-NOTICE.txt", "utf8")) +
  "\nUser-supplied Overworld soundtrack:\n" +
  (await readFile("public/audio/overworld/NOTICE.txt", "utf8")) +
  "\nUser-supplied Creative soundtrack:\n" +
  (await readFile("public/audio/creative/NOTICE.txt", "utf8")) +
  "\nSupplied texture pack:\n" +
  (await readFile("public/SUPPLIED-ASSETS-NOTICE.txt", "utf8")) +
  "\nSupplied Sketchfab Titan models and modifications:\n" +
  (await readFile("TITAN-ASSETS.md", "utf8")) +
  "\nUser-supplied Giganto battle music:\n" +
  (await readFile("public/audio/giganto/NOTICE.txt", "utf8")) +
  "\nUser-supplied pre-fight recording:\n" +
  (await readFile("public/audio/giganto/PRELUDE-NOTICE.txt", "utf8")) +
  "\nUser-supplied Sonic power-boost effect:\n" +
  (await readFile("public/audio/giganto/BOOST-NOTICE.txt", "utf8")) +
  "\nUser-supplied Wyvern music:\n" +
  (await readFile("public/audio/wyvern/NOTICE.txt", "utf8"));
const js = bundle.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const html = `<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#333333"><meta name="description" content="DCSMCRAFT Standalone Edition. Download, open in a desktop browser, and share this single HTML file. No server, install, account, or ChatGPT required."><title>DCSMCRAFT — Standalone Edition</title><link rel="icon" href="data:image/svg+xml;base64,${icon}"><!--\n${license}\n--><style>${style.code}</style></head><body><div id="app"></div><script data-dcsmcraft-bundle>${js}</script></body></html>`;
await mkdir(resolve(target, ".."), { recursive: true });
await writeFile(target, html);
console.log(
  `Standalone HTML: ${target} (${Buffer.byteLength(html).toLocaleString()} bytes; all assets embedded)`,
);
