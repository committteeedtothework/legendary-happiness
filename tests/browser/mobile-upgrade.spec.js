import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { readFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve, extname } from "node:path";
import { B } from "../../src/data.js";
const out =
  process.env.DCSMCRAFT_MOBILE_ARTIFACTS || "test-results/mobile-upgrade";
mkdirSync(out, { recursive: true });
const previous = process.env.DCSMCRAFT_PREVIOUS_MOBILE;
const current = resolve("dist/mobile");
const releaseVersion=JSON.parse(readFileSync("package.json")).version;
const previousVersion=previous?JSON.parse(readFileSync(resolve(previous,"offline-manifest.json"))).version:null;
let server,
  origin,
  updated = false;
test.beforeAll(async () => {
  if (!previous) return;
  server = createServer((q, r) => {
    try {
      const path =
        decodeURIComponent(new URL(q.url, "http://localhost").pathname).replace(
          /^\/mobile\/?/,
          "",
        ) || "index.html";
      if (path.includes("..")) throw Error("Invalid path");
      let file = resolve(updated ? current : previous, path);
      if (!existsSync(file) && path.startsWith("assets/"))
        file = resolve(current, path);
      const bytes = readFileSync(file);
      r.setHeader("Cache-Control", "no-store");
      r.setHeader(
        "Content-Type",
        {
          ".html": "text/html",
          ".js": "application/javascript",
          ".json": "application/json",
          ".css": "text/css",
          ".webmanifest": "application/manifest+json",
          ".png": "image/png",
          ".mp3": "audio/mpeg",
          ".glb": "model/gltf-binary",
        }[extname(file)] || "text/plain",
      );
      r.end(bytes);
    } catch {
      r.writeHead(404);
      r.end();
    }
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  origin = "http://127.0.0.1:" + server.address().port;
});
test.afterAll(async () => {
  if (server) {
    server.closeAllConnections();
    await new Promise((r) => server.close(r));
  }
});
test.use({
  viewport: { width: 844, height: 390 },
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 1,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile Safari/604.1",
});
test("existing Home Screen install upgrades from the previous live build without losing worlds or cached shared audio", async ({
  page: initialPage,
  context,
}) => {
  let page = initialPage;
  page.setDefaultTimeout(20000);
  test.skip(
    !previous,
    "Set DCSMCRAFT_PREVIOUS_MOBILE to a hash-verified previous deployment directory.",
  );
  test.setTimeout(180000);
  const errors = [];
  console.log("Upgrade: booting previous build");
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin + "/mobile/");
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  console.log("Upgrade: previous build initialized");
  expect(
    await page.evaluate(
      async () => (await dcsmcraft.mobileApp.manifest).version,
    ),
  ).toBe(previousVersion);
  await page.locator('[data-action="create"]').tap();
  await page.locator('[name="difficulty"]').selectOption("peaceful");
  await page.locator('[data-action="start-world"]').tap();
  await page.waitForFunction(
    () =>
      dcsmcraft.active && dcsmcraft.running && dcsmcraft.ui.screen === "play",
  );
  await page.waitForTimeout(400);
  console.log("Upgrade: world created");
  const saved = await page.evaluate(async (B) => {
    const g = dcsmcraft;
    g.pause();
    g.player.xp = 47;
    g.inventory.slots[0] = { id: "stone", count: 43 };
    g.world.set(2, 200, 2, B.gold_block);
    await g.save();
    g.pause();
    return { id: g.id, block: g.world.get(2, 200, 2), xp: g.player.xp };
  }, B);
  await page.locator('[data-action="quit"]').tap();
  await page.waitForFunction(() => !dcsmcraft.active);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
  console.log("Upgrade: previous world saved");
  const shared = await page.evaluate(async () => {
    const old = await dcsmcraft.mobileApp.manifest;
    const f = old.files
      .filter((f) => f.url.endsWith(".mp3"))
      .sort((a, b) => a.bytes - b.bytes)[0];
    const r = await fetch(f.url);
    if (!r.ok) throw Error("Missing shared audio");
    await (await caches.open(old.cache)).put(f.url, r);
    return { cache: old.cache, url: f.url };
  });
  console.log("Upgrade: requesting worker update");
  await page.evaluate(()=>{dcsmcraft.settings.verityMusic="youtube";delete dcsmcraft.settings.verityAudioVersion;dcsmcraft.ui.saveSettings();});
  updated = true;
  await page.evaluate(async () => {
    const r = await dcsmcraft.mobileApp.registration;
    await r.update();
  });
  console.log("Upgrade: registration update returned");
  // Closing and reopening a Home Screen app releases the old worker naturally.
  const expected = JSON.parse(
    readFileSync(current + "/offline-manifest.json"),
  ).cache;
  await page.waitForFunction(
    async (expected) => (await caches.keys()).includes(expected),
    expected,
  );
  console.log(
    "Upgrade: new cache found",
    await page.evaluate(() => caches.keys()),
  );
  await page.close();
  await new Promise((r) => setTimeout(r, 300));
  page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(origin + "/mobile/");
  await page.waitForFunction(() => window.dcsmcraft?.initialized);

  console.log("Upgrade: reopened build initialized");
  const installed = await page.evaluate(async (shared) => {
    const m = await dcsmcraft.mobileApp.manifest;
    return {
      version: m.version,
      id: m.id,
      caches: await caches.keys(),
      sharedAudio: !!(await (await caches.open(m.cache)).match(shared.url)),
    };
  }, shared);
  expect(installed.version).toBe(releaseVersion);
  expect(await page.evaluate(()=>dcsmcraft.settings.verityMusic)).toBe("supplied");
  expect(installed.caches).not.toContain(shared.cache);
  expect(installed.sharedAudio).toBe(true);
  await page.evaluate((id) => dcsmcraft.loadWorld(id), saved.id);
  await page.waitForFunction(() => dcsmcraft.active);
  const loaded = await page.evaluate(() => ({
    xp: dcsmcraft.player.xp,
    block: dcsmcraft.world.get(2, 200, 2),
    stack: dcsmcraft.inventory.slots[0],
  }));
  expect(loaded.xp).toBe(saved.xp);
  expect(loaded.block).toBe(saved.block);
  expect(loaded.stack.id).toBe("stone");
  expect(loaded.stack.count).toBe(43);
  console.log("Upgrade: saved world loaded");
  await context.setOffline(true);
  await page.reload();
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.evaluate((id) => dcsmcraft.loadWorld(id), saved.id);
  expect(await page.evaluate(() => dcsmcraft.player.xp)).toBe(47);
  await page.screenshot({ path: out + "/upgraded-world-offline.png" });
  await context.setOffline(false);
  expect(errors).toEqual([]);
  writeFileSync(
    out + "/pwa-upgrade.json",
    JSON.stringify(
      {
        from: previousVersion,
        to: installed.version,
        installed,
        saved,
        loaded,
        offlineReload: true,
        errors,
        physicalIOSVerified: false,
      },
      null,
      2,
    ),
  );
});
