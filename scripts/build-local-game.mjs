import { build } from "esbuild";
import {
  readFile,
  writeFile,
  mkdir,
  copyFile,
  rm,
  readdir,
  stat,
} from "node:fs/promises";
import { resolve, basename, extname } from "node:path";
import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";

// Shared on-demand asset packaging for mobile and the offline desktop runtime.
export async function buildLocalGame(destination, { mobile = true } = {}) {
  const out = resolve(destination),
    version = JSON.parse(await readFile("package.json", "utf8")).version;
  await rm(out, { recursive: true, force: true });
  await mkdir(resolve(out, "assets"), { recursive: true });
  const modules = new Map(),
    copied = new Map(),
    hash = (b) => createHash("sha256").update(b).digest("hex");
  async function asset(path) {
    if (copied.has(path)) return copied.get(path);
    const data = await readFile(path),
      name =
        basename(path, extname(path)) +
        "." +
        hash(data).slice(0, 12) +
        extname(path),
      url = "./assets/" + name;
    await copyFile(path, resolve(out, url));
    copied.set(path, url);
    return url;
  }
  for (const [mode, key] of [
    ["overworld", "OVERWORLD_TRACKS"],
    ["creative", "CREATIVE_TRACKS"],
  ]) {
    const m = JSON.parse(
        await readFile(`public/audio/${mode}/manifest.json`, "utf8"),
      ),
      tracks = [];
    for (const t of m.tracks)
      tracks.push({
        id: t.id,
        title: t.title,
        artist: t.artist,
        duration: t.duration,
        src: await asset(`public/audio/${mode}/${t.file}`),
      });
    modules.set(
      "overworld-music-data.js",
      (modules.get("overworld-music-data.js") || "") +
        `export const ${key}=${JSON.stringify(tracks)};\n`,
    );
  }
  for (const [module, name, path, extra] of [
    [
      "devin-claim-audio-data.js",
      "DEVIN_CLAIM_MP3",
      "public/audio/devin-sword-claim.mp3",
      {},
    ],
    [
      "matthew-claim-audio-data.js",
      "MATTHEW_CLAIM_MP3",
      "public/audio/matthew-pistols-claim.mp3",
      {},
    ],
    [
      "menu-audio-data.js",
      "MENU_AUDIO_MP3",
      "public/audio/menu-console-source.mp3",
      {},
    ],
    [
      "giganto-score-data.js",
      "GIGANTO_SCORE",
      "public/audio/giganto/undefeatable.mp3",
      {},
    ],
    [
      "titan-boost-data.js",
      "TITAN_BOOST",
      "public/audio/giganto/power-boost.mp3",
      { loopStart: 3, loopEnd: 8.8 },
    ],
    [
      "titan-prelude-data.js",
      "TITAN_PRELUDE",
      "public/audio/giganto/titan-giganto.mp3",
      { id: "titan-giganto", title: "Titan GIGANTO", artist: "User-supplied" },
    ],
  ]) {
    let file = path;
    if (module === "titan-boost-data.js") {
      const names = await readdir("public/audio/giganto");
      file =
        "public/audio/giganto/" + names.find((n) => /boost.*\.mp3$/.test(n));
    }
    const url = await asset(file);
    modules.set(
      module,
      `export const ${name}=${JSON.stringify({ ...extra, url, src: url })};`,
    );
  }
  modules.set(
    "wyvern-music-data.js",
    `export const WYVERN_PRELUDE=${JSON.stringify({ id: "wyvern-prelude", title: "Titan WYVERN", artist: "User-supplied", src: await asset("public/audio/wyvern/titan-wyvern.mp3") })};
export const WYVERN_SCORE=${JSON.stringify({ url: await asset("public/audio/wyvern/break-through-it-all.mp3") })};`,
  );
  const models = {};
  for (const role of ["sonic", "giganto"])
    models[role] = { url: await asset(`public/models/titan/${role}.glb`) };
  modules.set(
    "titan-model-data.js",
    `export const TITAN_GLB_DATA=${JSON.stringify(models)};`,
  );
  modules.set(
    "wyvern-model-data.js",
    `export const WYVERN_GLB=${JSON.stringify({ url: await asset("public/models/wyvern/wyvern.glb") })};`,
  );
  const result = await build({
    entryPoints: ["src/main.js"],
    bundle: true,
    format: "iife",
    minify: true,
    write: false,
    target: ["safari16.4", "chrome110"],
    define: {
      __DCSMCRAFT_DEV__: "false",
      __DCSMCRAFT_MOBILE__: String(mobile),
    },
    loader: { ".css": "css" },
    outdir: out,
    plugins: [
      {
        name: "mobile-assets",
        setup(b) {
          b.onResolve({ filter: /-data\.js$/ }, (a) =>
            modules.has(basename(a.path))
              ? { path: basename(a.path), namespace: "mobile-assets" }
              : undefined,
          );
          b.onLoad({ filter: /.*/, namespace: "mobile-assets" }, (a) => ({
            contents: modules.get(a.path),
            loader: "js",
          }));
        },
      },
    ],
  });
  const js = result.outputFiles.find((f) => f.path.endsWith(".js")),
    css = result.outputFiles.find((f) => f.path.endsWith(".css"));
  const script = "app." + hash(js.contents).slice(0, 12) + ".js",
    style = "style." + hash(css.contents).slice(0, 12) + ".css";
  await writeFile(resolve(out, script), js.contents);
  await writeFile(resolve(out, style), css.contents);
  // Original opaque pixel icon; no external graphics tool or commercial artwork.
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    for (let k = 0; k < 8; k++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
    return n >>> 0;
  });
  function chunk(type, data) {
    const name = Buffer.from(type),
      body = Buffer.concat([name, data]);
    let crc = 0xffffffff;
    for (const v of body) crc = crcTable[(crc ^ v) & 255] ^ (crc >>> 8);
    const size = Buffer.alloc(4),
      tail = Buffer.alloc(4);
    size.writeUInt32BE(data.length);
    tail.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([size, body, tail]);
  }
  function icon(size) {
    const raw = Buffer.alloc((size * 4 + 1) * size);
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const u = Math.floor((x * 32) / size),
          v = Math.floor((y * 32) / size);
        let c = [32, 42, 31];
        if (u >= 5 && u < 27 && v >= 5 && v < 27)
          c = v < 12 ? [103, 157, 61] : [111, 77, 48];
        if (
          (u === 5 || u === 26 || v === 5 || v === 26) &&
          u >= 5 &&
          u <= 26 &&
          v >= 5 &&
          v <= 26
        )
          c = [13, 20, 13];
        if (v === 12 && u > 5 && u < 26) c = [67, 105, 39];
        if (v > 13 && v < 25 && u > 6 && u < 25 && (u * 7 + v * 11) % 13 < 3)
          c = [133, 97, 60];
        const D = ["1110", "1001", "1001", "1001", "1110"],
          C = ["1111", "1000", "1000", "1000", "1111"];
        if (v >= 15 && v < 25) {
          const row = Math.floor((v - 15) / 2);
          for (const [start, shape] of [
            [7, D],
            [17, C],
          ])
            if (
              u >= start &&
              u < start + 8 &&
              shape[row][Math.floor((u - start) / 2)] === "1"
            )
              c = [242, 241, 220];
        }
        const at = y * (size * 4 + 1) + 1 + x * 4;
        raw.set([...c, 255], at);
      }
    const header = Buffer.alloc(13);
    header.writeUInt32BE(size, 0);
    header.writeUInt32BE(size, 4);
    header[8] = 8;
    header[9] = 6;
    return Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk("IHDR", header),
      chunk("IDAT", deflateSync(raw)),
      chunk("IEND", Buffer.alloc(0)),
    ]);
  }
  for (const size of [180, 192, 512])
    await writeFile(resolve(out, `icon-${size}.png`), icon(size));
  const manifest = {
    id: "./",
    name: "DCSMCRAFT",
    short_name: "DCSMCRAFT",
    start_url: "./",
    scope: "./",
    display: "standalone",
    background_color: "#202a1f",
    theme_color: "#333333",
    icons: [192, 512].map((size) => ({
      src: `./icon-${size}.png`,
      sizes: `${size}x${size}`,
      type: "image/png",
      purpose: "any maskable",
    })),
  };
  await writeFile(
    resolve(out, "manifest.webmanifest"),
    JSON.stringify(manifest, null, 2),
  );
  let html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#333333"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"><meta name="apple-mobile-web-app-title" content="DCSMCRAFT"><meta name="description" content="DCSMCRAFT Mobile. A voxel sandbox with touch controls and offline play."><title>DCSMCRAFT</title><link rel="manifest" href="./manifest.webmanifest"><link rel="apple-touch-icon" href="./icon-180.png"><link rel="icon" href="./icon-192.png"><link rel="stylesheet" href="./${style}"></head><body><div id="app"><div id="mobile-loading" style="position:fixed;inset:0;display:grid;place-content:center;background:#202a1f;color:#eee;font:20px monospace">DCSMCRAFT<br><small>Loading…</small></div></div><script src="./${script}" defer></script></body></html>`;
  if (!mobile)
    html = html
      .replace(/<link rel="manifest"[^>]*>/g, "")
      .replace(/<meta name="apple-[^>]*>/g, "")
      .replace(
        "DCSMCRAFT Mobile. A voxel sandbox with touch controls and offline play.",
        "DCSMCRAFT desktop. Offline voxel sandbox.",
      );
  await writeFile(resolve(out, "index.html"), html);
  let notices = "DCSMCRAFT Mobile " + version + "\n\n";
  for (const f of [
    "LICENSE",
    "THIRD_PARTY.md",
    "TITAN-ASSETS.md",
    "public/models/wyvern/NOTICE.txt",
    "public/audio/DEVIN-CLAIM-NOTICE.txt",
    "public/audio/MATTHEW-CLAIM-NOTICE.txt",
    "public/audio/MENU-SOUNDS-NOTICE.txt",
    "public/audio/overworld/NOTICE.txt",
    "public/audio/creative/NOTICE.txt",
    "public/audio/giganto/NOTICE.txt",
    "public/audio/giganto/PRELUDE-NOTICE.txt",
    "public/audio/wyvern/NOTICE.txt",
    "public/audio/giganto/BOOST-NOTICE.txt",
    "public/THREE-LICENSE.txt",
    "public/fonts/frontiers/OFL.txt",
  ])
    notices += "\n\n" + f + "\n" + (await readFile(f, "utf8"));
  await writeFile(resolve(out, "NOTICES.txt"), notices);
  await writeFile(resolve(out, ".nojekyll"), "");
  const files = [];
  async function list(dir) {
    for (const name of await readdir(dir)) {
      if (name === ".nojekyll") continue;
      const p = resolve(dir, name),
        info = await stat(p);
      if (info.isDirectory()) await list(p);
      else {
        const bytes = await readFile(p);
        files.push({
          url: "./" + p.slice(out.length + 1),
          bytes: bytes.length,
          sha256: hash(bytes),
        });
      }
    }
  }
  await list(out);
  const id = hash(Buffer.from(JSON.stringify(files))).slice(0, 16),
    cache = "dcsmcraft-mobile-" + id;
  const core = files.filter((f) => !f.url.startsWith("./assets/"));
  await writeFile(
    resolve(out, "offline-manifest.json"),
    JSON.stringify({ version, id, cache, files }, null, 2),
  );
  const template = await readFile("scripts/mobile-service-worker.js", "utf8");
  await writeFile(
    resolve(out, "sw.js"),
    template
      .replace("__CACHE__", JSON.stringify(cache))
      .replace(
        "__CORE__",
        JSON.stringify([...core.map((f) => f.url), "./offline-manifest.json"]),
      )
      .replace(
        "__FILES__",
        JSON.stringify([...files.map((f) => f.url), "./offline-manifest.json"]),
      ),
  );
  console.log(
    JSON.stringify(
      {
        version,
        out,
        coreBytes: core.reduce((n, f) => n + f.bytes, 0),
        totalBytes: files.reduce((n, f) => n + f.bytes, 0),
        files: files.length,
        script,
        cache,
      },
      null,
      2,
    ),
  );
}
