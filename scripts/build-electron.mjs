import {
  readFile,
  writeFile,
  mkdir,
  copyFile,
  rm,
  readdir,
  link,
  rename,
  chmod,
} from "node:fs/promises";
import { existsSync, createReadStream } from "node:fs";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { createPackage } from "@electron/asar";
import extract from "extract-zip";
import { buildLocalGame } from "./build-local-game.mjs";
const cache = resolve(
  process.env.DCSMCRAFT_ELECTRON_CACHE || ".desktop-cache/electron",
);
const config = JSON.parse(
  await readFile("desktop/electron/runtime.json", "utf8"),
);
const platforms = process.argv.includes("--linux-only")
  ? ["linux-x64"]
  : process.platform === "win32"
    ? ["win32-x64"]
    : ["linux-x64", "win32-x64"];
const digest = async (file) => {
  const h = createHash("sha256");
  for await (const bytes of createReadStream(file)) h.update(bytes);
  return h.digest("hex");
};
async function runtime(platform) {
  const target = join(cache, "electron-" + platform),
    marker = join(target, ".verified-runtime.json"),
    expected = config.runtimes[platform].sha256;
  let verified;
  try {
    verified = JSON.parse(await readFile(marker, "utf8"));
  } catch {}
  if (verified?.version === config.version && verified.sha256 === expected)
    return target;
  const name = `electron-v${config.version}-${platform}.zip`,
    file = join(cache, name);
  await mkdir(cache, { recursive: true });
  const download = spawnSync(
    "curl",
    [
      "--fail",
      "--location",
      "--retry",
      "2",
      "--output",
      file,
      `https://github.com/electron/electron/releases/download/v${config.version}/${name}`,
    ],
    { stdio: "inherit" },
  );
  if (download.status !== 0) throw Error("Electron runtime download failed");
  if ((await digest(file)) !== expected)
    throw Error("Electron runtime checksum mismatch");
  await rm(target, { recursive: true, force: true });
  await extract(file, { dir: target });
  await rm(file);
  if (platform === "linux-x64")
    for (const n of ["electron", "chrome_crashpad_handler", "chrome-sandbox"])
      await chmod(join(target, n), 0o755);
  await writeFile(
    marker,
    JSON.stringify({ version: config.version, sha256: expected }),
  );
  return target;
}
async function linkTree(source, target) {
  await mkdir(target, { recursive: true });
  for (const e of await readdir(source, { withFileTypes: true })) {
    if (e.name === ".verified-runtime.json") continue;
    const a = join(source, e.name),
      b = join(target, e.name);
    if (e.isDirectory()) await linkTree(a, b);
    else {
      try {
        await link(a, b);
      } catch {
        await copyFile(a, b);
      }
    }
  }
}
const appDir = resolve(".desktop-cache/electron-app");
await mkdir(appDir, { recursive: true });
for (const n of [
  "main.cjs",
  "preload.cjs",
  "policy.cjs",
  "lifecycle.cjs",
  "fullscreen.cjs",
  "package.json",
])
  await copyFile("desktop/electron/" + n, join(appDir, n));
const version = JSON.parse(await readFile("package.json", "utf8")).version;
const pkg = JSON.parse(await readFile(join(appDir, "package.json"), "utf8"));
pkg.version = version;
await writeFile(join(appDir, "package.json"), JSON.stringify(pkg, null, 2));
await buildLocalGame(join(appDir, "game"), { mobile: false });
const asar = resolve(".desktop-cache/dcsmcraft-app.asar");
await rm(asar, { force: true });
await createPackage(appDir, asar);
for (const platform of platforms) {
  const source = await runtime(platform),
    out = resolve(
      "dist/electron/" +
        (platform.startsWith("linux") ? "linux-unpacked" : "win-unpacked"),
    );
  await rm(out, { recursive: true, force: true });
  await linkTree(source, out);
  await rm(join(out, "resources/default_app.asar"), { force: true });
  await link(asar, join(out, "resources/app.asar"));
  if (platform === "win32-x64")
    await rename(join(out, "electron.exe"), join(out, "DCSMCRAFT.exe"));
  console.log("Bundled desktop runtime: " + out);
}
await writeFile(
  resolve("dist/electron/build.json"),
  JSON.stringify(
    {
      version,
      electronVersion: config.version,
      asarSHA256: await digest(asar),
      platforms,
    },
    null,
    2,
  ),
);
if (
  !process.argv.includes("--unpacked-only") &&
  platforms.includes("win32-x64")
) {
  // Interrupted builds may leave a newer but incomplete or obsolete 7z file.
  // Never trust only its timestamp when producing a release executable.
  await rm(resolve(`dist/desktop-app/${pkg.name}-${version}-x64.nsis.7z`), {force:true});
  const builder = spawnSync(
    process.execPath,
    [
      "node_modules/electron-builder/cli.js",
      "--win",
      "portable",
      "--x64",
      "--prepackaged",
      "dist/electron/win-unpacked",
      "--config",
      "scripts/electron-builder.config.cjs",
      "--publish",
      "never",
    ],
    {
      stdio: "inherit",
      env: {
        ...process.env,
        ELECTRON_BUILDER_CACHE: resolve(".desktop-cache/builder"),
        CSC_IDENTITY_AUTO_DISCOVERY: "false",
      },
    },
  );
  if (builder.status !== 0) process.exit(builder.status || 1);
}
