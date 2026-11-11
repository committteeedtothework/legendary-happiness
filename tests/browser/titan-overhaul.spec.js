import { createHash } from "node:crypto";
import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
const html = readFileSync("dist/DCSMCRAFT-Standalone.html"),
  out = process.env.DCSMCRAFT_OVERHAUL_ARTIFACTS || "test-results/overhaul";
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

test("arena scale, cycle, transformation and graphics render in the actual game", async ({
  page,
}) => {
  test.setTimeout(300000);
  const evidence = await boot(page);
  await portal(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  const report = [];
  for (const [name, stage, time, movie, phase] of [
    ["approach", "traversal", 0, 0, 1],
    ["sunset", "combat", 77, 0, 1],
    ["night", "combat", 145, 0, 2],
    ["dawn", "combat", 205, 0, 2],
    ["emeralds", "transform", 35, 2.7, 1],
    ["super", "transform", 35, 4.5, 1],
  ]) {
    const view = await page.evaluate(
      ({ stage, time, movie, phase }) => {
        const g = dcsmcraft,
          e = g.giganto,
          s = e.session,
          v = e.view,
          gl = g.renderer.gl;
        g.running = false;
        e.controls.clear();
        Object.assign(s, {
          stage,
          time,
          stageTime: movie,
          phase,
          emerald: stage !== "traversal",
          attack: "idle",
          qte: null,
          counterScene: null,
        });
        Object.assign(s.config, {
          graphicsQuality: "high",
          shadowQuality: "high",
          postProcessing: true,
          music: false,
          arenaWeather: "clear",
          dynamicSky: true,
          particles: true,
        });
        Object.assign(s.avatar, {
          x: stage === "traversal" ? 0 : stage === "transform" ? 0 : -12,
          y: stage === "traversal" ? 0.05 : stage === "transform" ? 93.56 : 64,
          z: stage === "traversal" ? 78 : stage === "transform" ? 0.5 : 45,
          vx: 0,
          vy: 0,
          vz: 0,
          onGround: stage === "traversal",
        });
        gl.setPixelRatio(1);
        gl.setSize(1280, 720, false);
        v.camReady = false;
        const before = {
          mapping: gl.toneMapping,
          exposure: gl.toneMappingExposure,
          shadow: gl.shadowMap.enabled,
        };
        for (let i = 0; i < 6; i++) {
          v.draw(s, 1 / 30);
          e.updateHUD();
        }
        gl.getContext().finish();
        return {
          day: v.atmosphere.state.day,
          phase: v.atmosphere.state.phase,
          weather: v.atmosphere.state.weather,
          gems: v.transformation.group.visible
            ? v.transformation.gems.length
            : 0,
          gold: v.sonic.userData.super,
          sonicScale: v.sonic.scale.toArray(),
          sceneScale: v.scene.scale.toArray(),
          calls: gl.info.render.calls,
          restored:
            before.mapping === gl.toneMapping &&
            before.exposure === gl.toneMappingExposure &&
            before.shadow === gl.shadowMap.enabled,
        };
      },
      { stage, time, movie, phase },
    );
    report.push({ name, ...view });
    await page.screenshot({ path: out + "/" + name + ".png" });
    expect(view.restored).toBe(true);
    expect(view.sceneScale).toEqual([1, 1, 1]);
  }
  expect(report.find((x) => x.name === "night").day).toBeLessThan(0.05);
  expect(report.find((x) => x.name === "emeralds").gems).toBe(7);
  expect(report.find((x) => x.name === "emeralds").gold).toBe(false);
  expect(report.find((x) => x.name === "super").gold).toBe(true);
  for (const [width, height] of [
    [640, 480],
    [1920, 1080],
  ]) {
    await page.setViewportSize({ width, height });
    await page.evaluate(() => {
      const e = dcsmcraft.giganto,
        s = e.session;
      s.stage = "combat";
      s.stageTime = 0;
      s.time = 77;
      s.attack = "idle";
      dcsmcraft.renderer.gl.setSize(innerWidth, innerHeight, false);
      e.view.camReady = false;
      e.view.draw(s, 1 / 30);
      e.updateHUD();
    });
    for (const selector of [
      ".titan-top",
      ".titan-resources",
      ".titan-abilities",
      ".titan-speedometer",
    ]) {
      const box = await page.locator("#titan-hud " + selector).boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width + 1);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(height + 1);
    }
    if (width === 640) {
      const target = await page
          .locator("#titan-hud .titan-target-state")
          .boundingBox(),
        moves = await page.locator("#titan-hud .titan-abilities").boundingBox();
      expect(target.y + target.height).toBeLessThan(moves.y);
    }
    await page.screenshot({ path: out + `/hud-${width}.png` });
  }
  expect(evidence.errors).toEqual([]);
  expect(evidence.external).toEqual([]);
  writeFileSync(
    out + "/overhaul-report.json",
    JSON.stringify(
      {
        htmlSHA256: createHash("sha256").update(html).digest("hex"),
        views: report,
        errors: evidence.errors,
      },
      null,
      2,
    ),
  );
});

test("native guard, ring wave, carried grab, arena settings and repeated returns stay isolated", async ({
  page,
}) => {
  test.setTimeout(300000);
  const evidence = await boot(page);
  const original = await page.evaluate(() =>
    JSON.stringify(dcsmcraft.settings),
  );
  await portal(page);
  const result = await page.evaluate(() => {
    const g = dcsmcraft,
      e = g.giganto,
      s = e.session,
      v = e.view;
    g.running = true;
    e.controls.clear();
    Object.assign(s, {
      stage: "combat",
      stageTime: 0,
      emerald: true,
      idle: 999,
      rings: 400,
      iframes: 0,
      attack: "idle",
    });
    Object.assign(s.config, {
      music: false,
      drain: 0,
      graphicsQuality: "low",
      bossMobility: false,
    });
    Object.assign(s.avatar, { x: 0, y: 57, z: 5, vx: 0, vy: 0, vz: 0 });
    Object.assign(s.tactics, {
      pressure: 2,
      chain: 6,
      guard: 0,
      guardCooldown: 0,
    });
    e.frame(1 / 60);
    const guard = s.tactics.guard;
    e.controls.add("KeyD");
    const x = s.avatar.x;
    for (let i = 0; i < 12; i++) e.frame(1 / 60);
    e.controls.clear();
    const moved = Math.abs(s.avatar.x - x);
    s.tactics.guard = 0;
    s.tactics.chain = 0;
    s.attack = "pulse";
    s.attackTime = 1.8;
    s.hitDone = false;
    s.iframes = 0;
    s.rings = 400;
    Object.assign(s.avatar, { x: 0, y: 57, z: 50, vx: 0, vy: 0, vz: 0 });
    s.attackAim = { ...s.avatar };
    for (let i = 0; i < 50; i++) e.frame(1 / 60);
    const pulse = { rings: s.rings, active: v.pulseWave.visible };
    s.attack = "crunch";
    s.qte = {
      kind: "crunch",
      left: 4.2,
      need: 11,
      hits: 0,
      from: { ...s.avatar },
    };
    const from = { ...s.avatar };
    e.frame(1 / 60);
    const first = Math.hypot(s.avatar.y - from.y, s.avatar.z - from.z);
    for (let i = 0; i < 45; i++) e.frame(1 / 60);
    const grab = { first, y: s.avatar.y, z: s.avatar.z };
    g.running = false;
    v.draw(s, 0);
    e.updateHUD();
    const time = s.time,
      position = { ...s.avatar };
    e.frame(0.5);
    return {
      guard,
      moved,
      pulse,
      grab,
      paused: s.time === time && s.avatar.y === position.y,
    };
  });
  expect(result.guard).toBeGreaterThan(1);
  expect(result.moved).toBeGreaterThan(0.1);
  expect(result.pulse.rings).toBeLessThan(400);
  expect(result.grab.first).toBeLessThan(0.3);
  expect(result.grab.y).toBeGreaterThan(79);
  expect(result.paused).toBe(true);
  await page.screenshot({ path: out + "/grab.png" });
  expect(
    await page
      .locator("#titan-hud .titan-abilities")
      .evaluate((n) => getComputedStyle(n).visibility),
  ).toBe("hidden");
  await page.evaluate(() => dcsmcraft.giganto.pauseMenu());
  await page.locator("[data-titan=menu]").click();
  await page.locator("[data-titan-config=arenaWeather]").selectOption("storm");
  await page.locator("[data-titan-config=dynamicSky]").uncheck();
  await page.locator("[data-titan-config=groundEffects]").uncheck();
  await page.locator("[data-titan-config=liveReflections]").uncheck();
  expect(
    await page.evaluate(() => dcsmcraft.giganto.session.config.arenaWeather),
  ).toBe("storm");
  expect(await page.evaluate(() => JSON.stringify(dcsmcraft.settings))).toBe(
    original,
  );
  await page.locator("[data-titan=back]").click();
  await page.locator("[data-titan=exit]").click();
  await page.waitForFunction(
    () => !dcsmcraft.giganto.active && dcsmcraft.ui.screen === "play",
  );
  expect(await page.evaluate(() => JSON.stringify(dcsmcraft.settings))).toBe(
    original,
  );
  await page.evaluate(() => {
    dcsmcraft.giganto.record.cooldownUntil = 0;
  });
  await portal(page);
  await page.evaluate(() => dcsmcraft.giganto.pauseMenu());
  await page.locator("[data-titan=exit]").click();
  await page.waitForFunction(() => !dcsmcraft.giganto.active);
  expect(await page.evaluate(() => JSON.stringify(dcsmcraft.settings))).toBe(
    original,
  );
  expect(evidence.errors).toEqual([]);
  expect(evidence.external).toEqual([]);
  writeFileSync(
    out + "/native-combat-report.json",
    JSON.stringify(
      {
        htmlSHA256: createHash("sha256").update(html).digest("hex"),
        ...result,
        errors: evidence.errors,
      },
      null,
      2,
    ),
  );
});
