import { createRequire } from "node:module";
import { mkdirSync, writeFileSync, mkdtempSync, readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(join(root, "package.json"));
const { _electron } = require("playwright");
const cache = mkdtempSync(join(tmpdir(), "dcsmcraft-desktop-verification-")),
  out = resolve(
    process.env.DCSMCRAFT_DESKTOP_ARTIFACTS || "test-results/desktop",
  );
mkdirSync(out, { recursive: true });
mkdirSync(cache + "/electron-test-cache", { recursive: true });
const errors = [],
  external = [],
  samples = [];
async function launch() {
  const app = await _electron.launch({
    executablePath: resolve(
      root,
      process.platform === "win32"
        ? "dist/electron/win-unpacked/DCSMCRAFT.exe"
        : "dist/electron/linux-unpacked/electron",
    ),
    args: [
      "--no-sandbox",
      "--disable-background-networking",
      "--proxy-server=http://127.0.0.1:9",
      "--ozone-platform=headless",
      "--use-angle=swiftshader",
      "--enable-unsafe-swiftshader",
    ],
    env: {
      ...process.env,
      XDG_CACHE_HOME: cache + "/electron-test-cache",
      XDG_CONFIG_HOME: cache + "/electron-test-config",
      DCSMCRAFT_USER_DATA: cache + "/desktop-verified-profile",
    },
    timeout: 30000,
  });
  const page = await app.firstWindow();
  await page.setViewportSize({ width: 1280, height: 800 });
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (/Shader Error|GL_INVALID|WebGLProgram/.test(m.text()))
      errors.push(m.text());
  });
  page.on("request", (r) => {
    if (/^https?:|^wss?:/.test(r.url())) external.push(r.url());
  });
  await page.waitForFunction(() => window.dcsmcraft?.initialized, null, {
    timeout: 60000,
  });
  return { app, page };
}
let { app, page } = await launch();
let saved;
let achievementMenu;
try {
  if ((await page.locator("[data-action=quit-desktop]").count()) !== 1)
    throw Error("Desktop quit control missing");
  await page.screenshot({ path: out + "/desktop-title.png" });
  await page.evaluate(() => {
    Object.assign(dcsmcraft.settings, {
      graphics: 1,
      renderDistance: 4,
      volume: 0,
      musicEnabled: false,
      ambientSounds: false,
      frameLimit: 30,
    });
    dcsmcraft.renderer.applyGraphics();
  });
  await page.locator("[data-action=create]").click();
  await page.locator("[name=seed]").fill("Wildflower");
  await page.locator("[name=mode][value=creative]").check();
  await page.locator("[name=difficulty]").selectOption("peaceful");
  await page.locator("[data-action=start-world]").click();
  await page.waitForFunction(() => dcsmcraft.running, null, { timeout: 60000 });
  await page.evaluate(()=>{dcsmcraft.pause();dcsmcraft.ui.achievements();});
  achievementMenu=await page.evaluate(()=>({cards:document.querySelectorAll(".achievement-card").length,version:dcsmcraft.player.achievements.version}));
  if(achievementMenu.cards!==64 || achievementMenu.version!==1)throw Error("Achievement menu missing from native package");
  await page.screenshot({path:out+"/desktop-achievements.png"});
  await page.evaluate(() => {
    const g = dcsmcraft;
    g.pause();
    g.ui.play();
    g.entities = [];
    g.settings.renderDistance = 8;
    g.renderer.applyGraphics();
  });
  const start = await page.evaluate(() => ({
    x: dcsmcraft.player.x,
    z: dcsmcraft.player.z,
  }));
  for (let i = 0; i < 12; i++) {
    await page.evaluate(
      ({ x, z }) => {
        const g = dcsmcraft;
        g.player.x = x;
        g.player.z = z;
        g.player.y = 115;
        g.player.yaw = -1;
        g.player.pitch = -0.2;
      },
      { x: start.x + i * 12, z: start.z + (i % 3) * 6 },
    );
    await page.waitForTimeout(120);
    samples.push(
      await page.evaluate(() => {
        const r = dcsmcraft.renderer;
        return {
          meshes: r.meshes.size,
          previews: [...r.meshes.values()].filter((m) => m.userData.preview)
            .length,
          jobs: r.jobs.size,
          ready: r.readyMeshes.length,
          mask: [...new Set(r.horizonMaskData)].sort(),
          cache: r.workerCacheStats,
          uploads: { ...r.streamStats },
        };
      }),
    );
  }
  await page.screenshot({ path: out + "/desktop-streaming.png" });
  const durations = await page.evaluate(async () => {
    const values = [];
    let last = performance.now();
    for (let i = 0; i < 40; i++) {
      await new Promise(requestAnimationFrame);
      const now = performance.now();
      values.push(now - last);
      last = now;
    }
    return values;
  });
  await page.evaluate(async () => {
    const g = dcsmcraft,
      x = Math.floor(g.player.x / 16) * 16 + 15,
      z = Math.floor(g.player.z);
    g.world.set(x, 180, z, 3);
    g.world.set(x + 1, 180, z, 3);
    g.__desktopEdit = { x, y: 180, z, id: g.id };
    await g.save();
  });
  saved = await page.evaluate(() => {
    const g = dcsmcraft,
      e = g.__desktopEdit;
    g.world.set(e.x, 182, e.z, 4);
    return e;
  });
  const native = await page.evaluate(() => ({
    nodeIntegration: typeof window.require,
    isolated: !window.process,
    origin: location.origin,
    desktopBridge: typeof window.dcsmcraftDesktop?.quit,
    workers: dcsmcraft.renderer.workers.length,
    fallback: dcsmcraft.renderer.workerFallback,
  }));
  if (errors.length || external.length)
    throw Error(JSON.stringify({ errors, external }));
  if (
    samples.some(
      (s) =>
        s.jobs > 4 || s.ready > 4 || s.mask.some((n) => n !== 0 && n !== 255),
    )
  )
    throw Error("Invalid streaming queues/coverage");
  await app.close();
  ({ app, page } = await launch());
  await page.evaluate(async (id) => {
    await dcsmcraft.loadWorld(id);
    dcsmcraft.pause();
  }, saved.id);
  const restored = await page.evaluate(
    ({ x, y, z }) => [
      dcsmcraft.world.get(x, y, z),
      dcsmcraft.world.get(x + 1, y, z),
      dcsmcraft.world.get(x, 182, z),
    ],
    saved,
  );
  if (await page.evaluate(()=>dcsmcraft.player.achievements?.version)!==1)throw Error("Achievement ledger lost on desktop restart");
  if (restored.join(",") !== "3,3,4") throw Error("Persistent seam edits lost");
  await page.screenshot({ path: out + "/desktop-reloaded.png" });
  const exportPath = join(cache, "world-backup.json");
  await app.evaluate(({ BrowserWindow }, file) => {
    globalThis.__backupState = "pending";
    BrowserWindow.getAllWindows()[0].webContents.session.once(
      "will-download",
      (_event, item) => {
        item.setSavePath(file);
        item.once("done", (_event, state) => {
          globalThis.__backupState = state;
        });
      },
    );
  }, exportPath);
  await page.evaluate(() => dcsmcraft.ui.exportWorld(dcsmcraft.id));
  for (
    let i = 0;
    i < 100 &&
    (await app.evaluate(() => globalThis.__backupState)) === "pending";
    i++
  )
    await page.waitForTimeout(100);
  if ((await app.evaluate(() => globalThis.__backupState)) !== "completed")
    throw Error("Native backup download failed");
  const backup = JSON.parse(readFileSync(exportPath, "utf8"));
  if (backup.format !== 1 || backup.edits[`${saved.x},182,${saved.z}`] !== 4)
    throw Error("Export lost current edits");
  if(backup.player.achievements?.version!==1)throw Error("Export lost achievement ledger");
  const originalCount = await page.evaluate(
    async () => (await dcsmcraft.store.list()).length,
  );
  await page.evaluate(() => dcsmcraft.ui.worlds());
  await page.locator("#import-world").setInputFiles(exportPath);
  await page.waitForFunction(
    async (count) => (await dcsmcraft.store.list()).length === count + 1,
    originalCount,
  );
  const imported = await page.evaluate(async (original) => {
    const g = dcsmcraft,
      worlds = await g.store.list(),
      copy = worlds.find((w) => w.id !== original.id && w.name === "New World");
    const { data } = await g.store.load(copy.id);
    return {
      id: copy.id,
      seed: data.seed,
      achievementVersion: data.player.achievements?.version,
      edit: data.edits[`${original.x},182,${original.z}`],
    };
  }, saved);
  if (
    imported.achievementVersion !== 1 ||
    imported.edit !== 4 ||
    imported.id === saved.id ||
    imported.seed !== "Wildflower"
  )
    throw Error("Import did not preserve world as a separate copy");

  const titans = [];
  for (const titan of ["giganto", "wyvern"]) {
    await page.evaluate((titan) => {
      const g = dcsmcraft;
      g.pause();
      g.ui.play();
      for (let x = 0; x < 10; x++)
        for (let z = 0; z < 10; z++) {
          g.world.set(x, 199, z, 3);
          for (let y = 200; y < 206; y++) g.world.set(x, y, z, 0);
        }
      Object.assign(g.player, {
        x: 4.5,
        y: 200,
        z: 7,
        yaw: 0,
        pitch: 0,
        onGround: true,
        health: 20,
      });
      g.giganto.record.portal = null;
      g.giganto.wyvern.record.portal = null;
      const record =
        titan === "wyvern" ? g.giganto.wyvern.record : g.giganto.record;
      record.config.enabled = true;
      record.cooldownUntil = 0;
      record.portal = {
        id: titan + ":desktop",
        x: 4,
        y: 200,
        z: 4,
        cell: "desktop:test",
      };
      g.giganto.overworld(0.01);
      g.resume();
    }, titan);
    await page.keyboard.press("KeyE");
    await page.waitForFunction(
      () =>
        dcsmcraft.giganto.active &&
        !dcsmcraft.giganto.pending &&
        dcsmcraft.giganto.view?.assetsReady,
      null,
      { timeout: 90000 },
    );
    const rig = await page.evaluate(() => {
      const e = dcsmcraft.giganto;
      dcsmcraft.running = false;
      let skins = 0;
      e.view.scene.traverse((o) => {
        if (o.isSkinnedMesh) skins++;
      });
      return {
        stage: e.session.stage,
        titan: e.session.titan || "giganto",
        skins,
      };
    });
    if (rig.skins < 1) throw Error("Native Titan did not load rigged models");
    if (!await page.evaluate(()=>dcsmcraft.player.achievements?.unlocked.titan_portal))throw Error("Actual portal entry did not award Titan Signals");
    titans.push(rig);
    await page.screenshot({ path: out + "/desktop-" + titan + ".png" });
    if (!(await page.evaluate(() => dcsmcraft.giganto.exit())))
      throw Error("Native arena exit failed");
  }
  if (errors.length || external.length)
    throw Error(JSON.stringify({ errors, external }));

  writeFileSync(
    out + "/electron-report.json",
    JSON.stringify(
      {
        runtime: "Electron 45.3.0 " + process.platform,
        nativeWindowsExecutionTested: process.platform === "win32",
        httpNetworkBlocked: true,
        native,
        achievementMenu,
        titans,
        saved,
        restored,
        backupImport: { download: true, imported },
        samples,
        frameIntervalsMs: durations,
        errors,
        external,
      },
      null,
      2,
    ),
  );
  await page.evaluate(() => {
    dcsmcraft.pause();
    dcsmcraft.ui.title();
  });
  await page.waitForFunction(() => !document.pointerLockElement);
  const closed = app.waitForEvent("close", { timeout: 30000 });
  await page.locator("[data-action=quit-desktop]").click();
  await closed;
  console.log(
    "Desktop offline creation, travel, seams, save-on-close, relaunch, export/import and Quit passed.",
  );
} finally {
  await app.close();
}
