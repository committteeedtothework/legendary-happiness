import { readFile, writeFile, mkdir, copyFile, cp } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
const zig =
  process.env.DCSMCRAFT_ZIG ||
  "/workspace/.cache/dcsmcraft-toolchain/node_modules/@oven/zig-linux-x64/zig";
if (!existsSync(zig))
  throw new Error(
    "Set DCSMCRAFT_ZIG to a Zig 0.12-compatible compiler. See desktop/README.md.",
  );
const html = await readFile("dist/DCSMCRAFT-Standalone.html", "utf8");
const bytes = Buffer.from(html, "utf8");
// Assemble the existing read-only HTML payload directly. Expanding 100 MB into
// C integer literals needlessly required tens of GB of compiler memory.
await mkdir(".desktop-cache", { recursive: true });
await writeFile(".desktop-cache/payload.bin", bytes);
const payloadAsm = (section) =>
  [
    section,
    ".globl embedded_html",
    "embedded_html:",
    '.incbin ".desktop-cache/payload.bin"',
    ".byte 0",
    ".text",
    "",
  ].join("\n");
await writeFile(
  "desktop/payload.hpp",
  `// Generated equivalent read-only payload; launcher source is unchanged.\nextern const unsigned char embedded_html[${bytes.length + 1}];\n#if defined(_WIN32)\n__asm__(${JSON.stringify(payloadAsm('.section .rdata,"dr"'))});\n#else\n__asm__(${JSON.stringify(payloadAsm(".section .rodata"))});\n#endif\n`,
);
await mkdir("dist/desktop", { recursive: true });
const env = {
  ...process.env,
  ZIG_GLOBAL_CACHE_DIR: resolve(".desktop-cache/global"),
  ZIG_LOCAL_CACHE_DIR: resolve(".desktop-cache/local"),
};
const args = [
  "cc",
  "desktop/launcher.c",
  "-std=c11",
  "-O2",
  "-target",
  "x86_64-windows-gnu",
  "-Wl,--subsystem,windows",
  "-luser32",
  "-lshell32",
  "-lole32",
  "-o",
  "dist/desktop/DCSMCRAFT.exe",
];
const result = spawnSync(zig, args, { stdio: "inherit", env });
if (result.status !== 0) process.exit(result.status || 1);
const local = spawnSync(
  "gcc",
  ["desktop/launcher.c", "-std=c11", "-O2", "-o", "dist/desktop/payload-check"],
  { stdio: "inherit" },
);
if (local.status !== 0) process.exit(local.status || 1);
await mkdir("/tmp/dcsmcraft desktop verification", { recursive: true });
const check = spawnSync(
  "dist/desktop/payload-check",
  ["--extract-only", "/tmp/dcsmcraft desktop verification/index.html"],
  { stdio: "inherit" },
);
if (check.status !== 0) process.exit(check.status || 1);
if (
  (await readFile("/tmp/dcsmcraft desktop verification/index.html", "utf8")) !==
  html
)
  throw new Error("Executable payload differs from standalone build");
await copyFile("desktop/README.md", "dist/desktop/START-HERE.txt");
await cp("desktop/licenses", "dist/desktop/licenses", { recursive: true });
console.log(
  "Windows x64 executable built; companion extraction verified byte-for-byte. Windows launch is not tested on this Linux host.",
);
