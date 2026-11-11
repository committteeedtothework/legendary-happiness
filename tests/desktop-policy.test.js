import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import policy from "../desktop/electron/policy.cjs";
test("desktop protocol serves only files inside the bundled game", () => {
  const root = path.resolve("fixture/game");
  assert.equal(
    policy.localAssetPath("dcsmcraft://game/", root),
    path.join(root, "index.html"),
  );
  assert.equal(
    policy.localAssetPath("dcsmcraft://game/assets/a%20b.mp3", root),
    path.join(root, "assets/a b.mp3"),
  );
  for (const url of [
    "file:///etc/passwd",
    "https://game/assets/x",
    "dcsmcraft://other/x",
    "dcsmcraft://game/%2e%2e%2fprivate",
    "dcsmcraft://game/%5c..%5cprivate",
    "dcsmcraft://game/%00x",
    "dcsmcraft://game/%zz",
  ])
    assert.equal(policy.localAssetPath(url, root), null, url);
});
test("desktop allows game controls without granting camera, microphone or local shell capabilities", () => {
  for (const p of ["fullscreen", "pointerLock", "keyboardLock"])
    assert.ok(policy.allowedPermissions.has(p));
  for (const p of ["media", "geolocation", "notifications", "midiSysex"])
    assert.equal(policy.allowedPermissions.has(p), false);
});

import lifecycle from "../desktop/electron/lifecycle.cjs";
test("desktop close awaits a durable save and refuses to discard session-only worlds", async () => {
  let pauses = 0,
    saves = 0;
  const g = {
    active: true,
    world: {},
    pause() {
      pauses++;
    },
    async save() {
      saves++;
      return { status: "durable" };
    },
  };
  await lifecycle.saveBeforeClose(g);
  assert.equal(pauses, 1);
  assert.equal(saves, 1);
  for (const status of ["session-only", "failed"]) {
    g.save = async () => ({ status });
    await assert.rejects(
      lifecycle.saveBeforeClose(g),
      /only saved for this session/,
    );
  }
  g.save = async () => {
    throw Error("Disk full");
  };
  await assert.rejects(lifecycle.saveBeforeClose(g), /Disk full/);
  for (const game of [
    null,
    { active: false },
    { active: true, world: {}, multiplayer: { isGuest: true } },
  ])
    await lifecycle.saveBeforeClose(game);
});

import vm from "node:vm";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
test("the real desktop entrypoint initializes its sandbox and lifecycle imports before opening a window", () => {
  const require = createRequire(
    new URL("../desktop/electron/main.cjs", import.meta.url),
  );
  let sandbox = false,
    schemes = [];
  const app = {
    getPath: () => "/test/profile",
    setPath() {},
    setName() {},
    enableSandbox() {
      sandbox = true;
    },
    on() {},
    requestSingleInstanceLock: () => true,
    whenReady: () => new Promise(() => {}),
  };
  const source = readFileSync(
    new URL("../desktop/electron/main.cjs", import.meta.url),
    "utf8",
  );
  vm.runInNewContext(source, {
    require: (name) =>
      name === "electron"
        ? {
            app,
            protocol: {
              registerSchemesAsPrivileged(v) {
                schemes = v;
              },
            },
          }
        : require(name),
    process: { env: {} },
    __dirname: "/test/app",
  });
  assert.ok(sandbox);
  assert.equal(schemes[0].scheme, "dcsmcraft");
  assert.equal(schemes[0].privileges.secure, true);
});
