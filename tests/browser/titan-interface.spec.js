import { createHash } from "node:crypto";
import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
const html = readFileSync("dist/DCSMCRAFT-Standalone.html"),
  out = process.env.DCSMCRAFT_UI_ARTIFACTS || "test-results/frontiers-ui";
mkdirSync(out, { recursive: true });
let server, origin;
test.use({ trace: "off" });
test.beforeAll(async () => {
  server = createServer((q, r) => {
    r.setHeader("Content-Type", "text/html");
    r.end(html);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  origin = `http://127.0.0.1:${server.address().port}`;
});
test.afterAll(async () => {
  server?.closeAllConnections();
  if (server) await new Promise((r) => server.close(r));
});
async function boot(page) {
  const errors = [],
    external = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (/Shader Error|GL_INVALID|WebGLProgram/.test(m.text()))
      errors.push(m.text());
  });
  await page.addInitScript(
    () =>
      localStorage.getItem("dcsmcraft-settings") ||
      localStorage.setItem(
        "dcsmcraft-settings",
        JSON.stringify({
          graphics: 1,
          renderDistance: 2,
          distantTerrain: false,
          volume: 0,
          musicEnabled: false,
          ambientSounds: false,
          frameLimit: 30,
          skin: "explorer",
        }),
      ),
  );
  await page.route("**/*", (r) =>
    r
      .request()
      .url()
      .startsWith(origin + "/")
      ? r.continue()
      : (external.push(r.request().url()), r.abort()),
  );
  await page.goto(origin + "/titan.html");
  await page.waitForFunction(() => dcsmcraft?.initialized);
  await page.locator("[data-action=create]").click();
  await page.locator("[name=seed]").fill("Wildflower");
  await page.locator("[name=mode][value=creative]").check();
  await page.locator("[name=difficulty]").selectOption("peaceful");
  await page.locator("[data-action=start-world]").click();
  await page.waitForFunction(
    () => dcsmcraft.running && dcsmcraft.ui.screen === "play",
  );
  await page.evaluate(() => {
    const g = dcsmcraft;
    g.pause();
    g.ui.play();
    g.entities = [];
    g.inventory.slots.fill(null);
    g.world.set(0, 199, 0, 3);
    g.inventory.selected = 0;
    Object.assign(g.player, {
      x: 0.5,
      y: 200,
      z: 0.5,
      yaw: 0,
      pitch: 0,
      vy: 0,
      onGround: true,
      health: 20,
    });
  });
  return { errors, external };
}

async function portal(page, full = false) {
  await page.evaluate((full) => {
    const g = dcsmcraft;
    if (full)
      g.inventory.slots = Array.from({ length: 36 }, () => ({
        id: "stone",
        count: 64,
      }));
    for (let x = 0; x <= 10; x++)
      for (let z = 0; z <= 10; z++) {
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
      health: 17,
      hunger: 12,
      saturation: 3,
    });
    g.inventory.slots[0] = {
      id: "diamond_sword",
      count: 1,
      durability: 500,
      enchantments: { sharpness: 2 },
    };
    g.giganto.record.config.spawnChance = 0;
    g.giganto.record.portal = {
      id: "browser-titan",
      cell: "0,0",
      x: 4,
      y: 200,
      z: 4,
    };
    g.giganto.overworld(0.01);
    g.running = true;
    g.pointerLockFallback = true;
  }, full);
  await page.keyboard.press("KeyE");
  await page.waitForFunction(
    () =>
      dcsmcraft.giganto.active &&
      !dcsmcraft.giganto.pending &&
      dcsmcraft.giganto.view?.assetsReady,
  );
}

async function stageCombat(page) {
  await page.evaluate(async () => {
    const g = dcsmcraft,
      e = g.giganto,
      s = e.session;
    g.running = false;
    g.ui.play();
    e.controls.clear();
    Object.assign(s, {
      stage: "combat",
      stageTime: 2,
      time: 40,
      emerald: true,
      phase: 2,
      hp: s.maxHp / 2,
      rings: 38,
      energy: 72,
      combo: 14,
      phantom: 2,
      attack: "idle",
      action: "idle",
      strike: null,
      qte: null,
      counterScene: null,
      idle: 999,
    });
    Object.assign(s.config, {
      graphicsQuality: "low",
      postProcessing: false,
      shadowQuality: "off",
      audio: false,
      music: false,
      drain: 0,
    });
    Object.assign(s.avatar, {
      x: 0,
      y: 57,
      z: 35,
      yaw: 0,
      pitch: 0,
      vx: 12,
      vy: 0,
      vz: 0,
      onGround: false,
    });
    e.view.shotFlow = {};
    e.view.camReady = false;
    e.view.draw(s, 1 / 30);
    e.updateHUD();
    await document.fonts.ready;
  });
}
test("Frontiers arena HUD uses local type and live counters, fits four resolutions and presents help, lock-on and timed inputs without blocking combat", async ({
  page,
}) => {
  test.setTimeout(180000);
  const ev = await boot(page);
  await portal(page);
  await stageCombat(page);
  await expect(page.locator("#titan-rings")).toHaveText("038");
  await expect(page.locator("#titan-ring-capacity")).toHaveText("/400");
  await expect(page.locator(".titan-health")).toHaveAttribute(
    "aria-valuenow",
    "50",
  );
  await expect(page.locator(".titan-boost")).toHaveAttribute(
    "aria-valuenow",
    "72",
  );
  const layouts = [];
  for (const [name, width, height] of [
    ["combat", 1280, 720],
    ["wide", 1920, 1080],
    ["compact", 640, 360],
    ["portrait", 480, 800],
  ]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => {
      const e = dcsmcraft.giganto;
      e.view.draw(e.session, 0);
      e.updateHUD();
    });
    const layout = await page.evaluate(() => {
      const q = (s) => document.querySelector(s),
        box = (s) => {
          const r = q(s).getBoundingClientRect();
          return {
            x: r.x,
            y: r.y,
            width: r.width,
            height: r.height,
            right: r.right,
            bottom: r.bottom,
          };
        };
      return {
        font: document.fonts.check("800 24px DCSFrontiers"),
        family: getComputedStyle(q("#titan-rings")).fontFamily,
        boxes: Object.fromEntries(
          [
            ".titan-resources",
            ".titan-top",
            ".titan-objective",
            ".titan-stats",
            ".titan-speedometer",
            ".titan-abilities",
            ".titan-controls",
          ].map((s) => [s, box("#titan-hud " + s)]),
        ),
        pageWidth: document.documentElement.scrollWidth,
      };
    });
    expect(layout.font).toBe(true);
    expect(layout.family).toContain("DCSFrontiers");
    expect(layout.pageWidth).toBe(width);
    for (const b of Object.values(layout.boxes)) {
      expect(b.x).toBeGreaterThanOrEqual(0);
      expect(b.y).toBeGreaterThanOrEqual(0);
      expect(b.right).toBeLessThanOrEqual(width + 1);
      expect(b.bottom).toBeLessThanOrEqual(height + 1);
    }
    const a = layout.boxes[".titan-abilities"],
      l = layout.boxes[".titan-stats"],
      r = layout.boxes[".titan-speedometer"];
    expect(a.x).toBeGreaterThan(l.right);
    expect(a.right).toBeLessThan(r.x);
    layouts.push({ name, width, height, ...layout });
    await page.screenshot({ path: out + "/" + name + ".png" });
  }
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.evaluate(() => {
    dcsmcraft.running = true;
    dcsmcraft.pointerLockFallback = true;
  });
  await page.keyboard.press("KeyH");
  await expect(page.locator("#titan-help")).toBeVisible();
  await page.evaluate(() => {
    dcsmcraft.running = false;
  });
  await page.screenshot({ path: out + "/controls-overlay.png" });
  await page.evaluate(() => {
    dcsmcraft.running = true;
  });
  await page.keyboard.press("KeyH");
  await expect(page.locator("#titan-help")).toBeHidden();
  await page.evaluate(() => {
    const g = dcsmcraft,
      e = g.giganto,
      s = e.session;
    g.running = false;
    s.lock = false;
    e.updateHUD();
  });
  await expect(page.locator("#titan-target-state")).toHaveText("TAB · Lock on");
  await page.evaluate(() => {
    const e = dcsmcraft.giganto,
      s = e.session;
    s.qte = { kind: "beam", hits: 3, need: 8, left: 2.4 };
    e.updateHUD();
  });
  await expect(page.locator("#titan-qte")).toBeVisible();
  await expect(page.locator(".titan-qte-key")).toHaveText("SPACE");
  expect(
    await page.locator("#titan-qte progress").evaluate((n) => n.value),
  ).toBe(0.375);
  await expect(page.locator(".titan-abilities")).toHaveCSS(
    "visibility",
    "hidden",
  );
  await page.screenshot({ path: out + "/beam-qte.png" });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => {
    const e = dcsmcraft.giganto;
    e.session.qte = null;
    e.session.stage = "phase";
    e.updateHUD();
  });
  const motion = await page.locator("#titan-hud").evaluate((n) => ({
    bars: getComputedStyle(n, "::before").transitionDuration,
    health: getComputedStyle(n.querySelector(".titan-health i"))
      .transitionDuration,
  }));
  expect(motion).toEqual({ bars: "0s", health: "0s" });
  expect(ev.errors).toEqual([]);
  expect(ev.external).toEqual([]);
  writeFileSync(
    out + "/hud-report.json",
    JSON.stringify(
      {
        htmlSHA256: createHash("sha256").update(html).digest("hex"),
        layouts,
        motion,
        errors: ev.errors,
        external: ev.external,
      },
      null,
      2,
    ),
  );
});

test("arena pause and options support keyboard tabs, every setting group, saved values and a clean return to the original world interface", async ({
  page,
}) => {
  test.setTimeout(180000);
  const ev = await boot(page);
  await portal(page);
  await stageCombat(page);
  // Menu interaction coverage keeps the already-rendered 3D backdrop frozen.
  // Native combat/render tests exercise the real draw path separately.
  await page.evaluate(() => {
    dcsmcraft.giganto.view.draw = () => {};
  });
  const before = await page.evaluate(() => ({
    settings: JSON.stringify(dcsmcraft.settings),
    original: dcsmcraft.giganto.session.original,
    time: dcsmcraft.giganto.session.time,
  }));
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-titan=resume]")).toBeFocused();
  await page.screenshot({ path: out + "/pause.png" });
  await page.keyboard.press("ArrowDown");
  await expect(page.locator("[data-titan=menu]")).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("[data-titan-tab=graphics]")).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await page
    .locator("[data-titan-config=graphicsQuality]")
    .selectOption("high");
  await page.locator("[data-titan-config=shadowQuality]").selectOption("off");
  await page.locator("[data-titan-config=antialiasing]").uncheck();
  await page.screenshot({ path: out + "/graphics.png" });
  await page.locator("[data-titan-tab=graphics]").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("[data-titan-tab=sound]")).toBeFocused();
  await expect(page.locator("[data-titan-panel=sound]")).toBeVisible();
  await page.locator("[data-titan-config=music]").uncheck();
  await page.locator("[data-titan-config=masterVolume]").evaluate((n) => {
    n.value = ".36";
    n.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.locator("[data-titan-config=masterVolume]").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("[data-titan-config=masterVolume]")).toHaveValue(
    "0.37",
  );
  await page.locator(".titan-score-controls > summary").click();
  await page.locator(".titan-score-controls details > summary").click();
  await page.locator("[data-titan=reset-cues]").click();
  await expect(page.locator("[data-titan-panel=sound]")).toBeVisible();
  await page.screenshot({ path: out + "/sound.png" });
  await page.locator("[data-titan-tab=camera]").click();
  await page.locator("[data-titan-config=moveCamera]").uncheck();
  await page.locator("[data-titan-config=cameraFov]").evaluate((n) => {
    n.value = "73";
    n.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.locator("[data-titan-tab=battle]").click();
  await page.locator("[data-titan-config=bossPower]").evaluate((n) => {
    n.value = "1.4";
    n.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.locator("[data-titan-config=strictParry]").check();
  await page.locator("[data-titan-tab=controls]").click();
  await expect(page.locator(".titan-control-sheet")).toContainText(
    "Homing Shot",
  );
  await page.screenshot({ path: out + "/options-controls.png" });
  await page.keyboard.press("Home");
  await expect(page.locator("[data-titan-tab=graphics]")).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator("[data-titan-tab=controls]")).toBeFocused();
  const paused = await page.evaluate(() => ({
    time: dcsmcraft.giganto.session.time,
    settings: JSON.stringify(dcsmcraft.settings),
    cfg: dcsmcraft.giganto.session.config,
    held: [...dcsmcraft.giganto.controls],
  }));
  expect(paused.time).toBe(before.time);
  expect(paused.settings).toBe(before.settings);
  expect(paused.held).toEqual([]);
  expect(paused.cfg).toMatchObject({
    graphicsQuality: "high",
    shadowQuality: "off",
    antialiasing: false,
    music: false,
    moveCamera: false,
    bossPower: 1.4,
    masterVolume: 0.37,
    cameraFov: 73,
    strictParry: true,
  });
  await page.setViewportSize({ width: 480, height: 800 });
  await page.locator("[data-titan-tab=graphics]").click();
  await page.screenshot({ path: out + "/options-portrait.png" });
  expect(
    await page
      .locator(".titan-menu-surface")
      .evaluate((n) => n.scrollWidth <= innerWidth),
  ).toBe(true);
  await page.locator("[data-titan=back]").click();
  await expect(page.locator("[data-titan=resume]")).toBeVisible();
  await page.locator("[data-titan=menu]").click();
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-titan=resume]")).toBeVisible();
  await page.locator("[data-titan=quit]").click();
  await page.waitForFunction(
    () => dcsmcraft.ui.screen === "title" && !dcsmcraft.active,
  );
  await page.evaluate(async () => {
    await dcsmcraft.loadWorld(dcsmcraft.id);
  });
  await page.waitForFunction(
    () => dcsmcraft.giganto.view?.assetsReady && dcsmcraft.running,
  );
  const loaded = await page.evaluate(() => dcsmcraft.giganto.session.config);
  expect(loaded).toMatchObject({
    masterVolume: 0.37,
    cameraFov: 73,
    strictParry: true,
    music: false,
  });
  await page.keyboard.press("Escape");
  await page.locator("[data-titan=exit]").click();
  await page.waitForFunction(
    () => !dcsmcraft.giganto.active && !dcsmcraft.giganto.closing,
  );
  const restored = await page.evaluate(() => ({
    settings: JSON.stringify(dcsmcraft.settings),
    health: dcsmcraft.player.health,
    inventory: dcsmcraft.inventory.export(),
    active: document.querySelector("#app").classList.contains("titan-active"),
    menu: !!document.querySelector(".titan-menu-surface"),
  }));
  expect(restored.settings).toBe(before.settings);
  expect(restored.health).toBe(before.original.player.health);
  expect(restored.inventory).toEqual(before.original.inventory);
  expect(restored.active).toBe(false);
  expect(restored.menu).toBe(false);
  expect(ev.errors).toEqual([]);
  expect(ev.external).toEqual([]);
  writeFileSync(
    out + "/menu-report.json",
    JSON.stringify(
      {
        htmlSHA256: createHash("sha256").update(html).digest("hex"),
        paused,
        loaded,
        restored,
        errors: ev.errors,
      },
      null,
      2,
    ),
  );
});
