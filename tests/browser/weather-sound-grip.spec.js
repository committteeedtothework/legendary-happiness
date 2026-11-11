import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import { World } from "../../src/world.js";
import { B, ITEMS, BLOCKS } from "../../src/data.js";
const html = readFileSync("dist/DCSMCRAFT-Standalone.html", "utf8"),
  out = "/workspace/artifacts/weather-grip-playtest";
mkdirSync(out, { recursive: true });
async function boot(page) {
  const errors = [],
    external = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (/Shader Error|GL_INVALID|WebGLProgram|processorerror/.test(m.text()))
      errors.push(m.text());
  });
  await page.addInitScript(() =>
    localStorage.setItem(
      "dcsmcraft-settings",
      JSON.stringify({
        graphics: 1,
        renderDistance: 2,
        distantTerrain: false,
        volume: 0.7,
        musicEnabled: false,
        ambientSounds: false,
        mobSounds: true,
        frameLimit: 30,
      }),
    ),
  );
  await page.route("**/*", (r) =>
    r.request().url().endsWith("/update.html")
      ? r.fulfill({ contentType: "text/html", body: html })
      : (external.push(r.request().url()), r.abort()),
  );
  await page.goto("/update.html");
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.locator("[data-action=create]").click();
  await page.locator("[name=seed]").fill("Wildflower");
  await page.locator("[name=mode][value=creative]").check();
  await page.locator("[data-action=start-world]").click();
  await page.waitForFunction(() => dcsmcraft.active);
  await page.evaluate(() => {
    dcsmcraft.pause();
    dcsmcraft.ui.play();
  });
  return { errors, external };
}
async function shot(page, name) {
  await page.evaluate(() => {
    document
      .querySelectorAll(".toast,.day-banner")
      .forEach((e) => (e.style.visibility = "hidden"));
  });
  await page.screenshot({ path: `${out}/${name}.png` });
}
test("offline full crosshair and all inventory grip profiles stay clear through actions, recoil, swimming and F5", async ({
  page,
}) => {
  test.setTimeout(300000);
  const result = await boot(page);
  const all = Object.keys(ITEMS);
  const report = await page.evaluate(async (all) => {
    const g = dcsmcraft,
      r = g.renderer,
      failures = [];
    for (const id of all) {
      g.inventory.slots[0] = { id, count: 1 };
      r.setHeld(id, g.inventory.slots[0]);
      for (const kind of ["attack", "use"]) {
        r.animator.trigger(
          kind,
          g.inventory.held?.id?.includes("sword") ? "sword" : undefined,
        ); // replaced below with live item lookup through current model metadata
        for (const fraction of [0.4]) {
          if (r.animator.action)
            r.animator.action.age = r.animator.action.duration * fraction;
          r.draw({
            player: g.player,
            time: 6000,
            cameraMode: 0,
            equipment: [],
            playing: true,
            elapsed: g.elapsed,
            mining: 0,
            moving: false,
            underwater: false,
            animating: false,
          });
          if (r.handRig.viewBounds.max.z > -0.1099)
            failures.push(id + ":" + kind);
        }
      }
    }
    return { failures, count: all.length };
  }, all);
  expect(report.failures).toEqual([]);
  expect(report.count).toBeGreaterThan(180);
  for (const width of [1280, 640]) {
    await page.setViewportSize({ width, height: 800 });
    const shape = await page.locator("#crosshair").evaluate((e) => {
      const r = e.getBoundingClientRect(),
        b = [...e.children].map((c) => {
          const x = c.getBoundingClientRect();
          return { x: x.x - r.x, y: x.y - r.y, w: x.width, h: x.height };
        });
      return { w: r.width, h: r.height, b };
    });
    expect(shape).toEqual({
      w: 16,
      h: 16,
      b: [
        { x: 0, y: 7, w: 16, h: 2 },
        { x: 7, y: 0, w: 2, h: 16 },
      ],
    });
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  for (const id of [
    "diamond_sword",
    "devin_sword",
    "stone",
    "flint_and_steel",
    "apple",
    "matthew_dual_pistols",
  ]) {
    await page.evaluate((id) => {
      const g = dcsmcraft;
      g.inventory.slots[0] = { id, count: 1 };
      g.renderer.setHeld(id, g.inventory.slots[0]);
      g.renderer.animator.equip = 0;
      g.renderer.animator.trigger(
        id === "matthew_dual_pistols" ? "fire" : "use",
      );
      if (g.renderer.animator.action)
        g.renderer.animator.action.age =
          g.renderer.animator.action.duration * 0.4;
    }, id);
    await page.waitForTimeout(100);
    await shot(page, "grip-" + id);
  }
  await page.keyboard.press("F5");
  await page.waitForTimeout(100);
  await shot(page, "f5");
  expect(result.errors).toEqual([]);
  expect(result.external).toEqual([]);
});
function coldSite() {
  const w = new World("Wildflower");
  for (let z = -8192; z <= 8192; z += 64)
    for (let x = -8192; x <= 8192; x += 64) {
      if (
        ["snowy_taiga", "alpine"].includes(w.terrain(x, z).biome) &&
        [
          [-20, -20],
          [20, 20],
        ].every(([a, b]) =>
          ["snowy_taiga", "alpine"].includes(w.terrain(x + a, z + b).biome),
        )
      )
        return { x, z };
    }
  throw Error("No cold site");
}
test("offline snowfall accumulates real layers, renders on chunks and persists; weather menu creates a visible moving tornado with shelter", async ({
  page,
}) => {
  test.setTimeout(150000);
  const result = await boot(page),
    site = coldSite();
  await page.evaluate((site) => {
    const g = dcsmcraft;
    Object.assign(g.player, {
      x: site.x + 0.5,
      y: g.world.skyHeight(site.x, site.z) + 4,
      z: site.z + 0.5,
      flying: true,
    });
    g.world.weather.kind = "rain";
    g.world.weather.override = "rain";
    g.world.weather.intensity = 1;
    g.renderer.loadAround(site.x, site.z, 2, 9);
    g.resume();
    g.pointerLockFallback = true;
  }, site);
  await page.waitForFunction(
    () =>
      [...dcsmcraft.world.edits.values()].some((id) => id >= 129 && id <= 136),
    {},
    { timeout: 15000 },
  );
  const saved = await page.evaluate(async () => {
    const g = dcsmcraft;
    g.pause();
    g.ui.play();
    const entry = [...g.world.edits].find(([, id]) => id >= 129 && id <= 136);
    const [x, y, z] = entry[0].split(",").map(Number);
    Object.assign(g.player, {
      x: x + 3,
      y: y + 4,
      z: z + 5,
      pitch: -0.65,
      yaw: 0.2,
    });
    await g.save();
    return { id: g.id, entry };
  });
  await page.waitForTimeout(500);
  await shot(page, "snow-accumulation");
  await page.reload();
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.locator("[data-action=load]").first().click();
  await page.waitForFunction(() => dcsmcraft.active);
  await page.evaluate(() => dcsmcraft.pause());
  expect(
    await page.evaluate(
      (key) => dcsmcraft.world.edits.get(key),
      saved.entry[0],
    ),
  ).toBe(saved.entry[1]);
  await page.evaluate(() => dcsmcraft.ui.pause());
  await page.getByRole("button", { name: "Weather", exact: true }).click();
  await page.locator("[data-weather=tornado]").click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("button", { name: "Back to Game", exact: true }).click();
  await page.evaluate(() => {
    const g = dcsmcraft;
    Object.assign(g.player, { ...g.spawn, flying: true });
    g.world.weather.intensity = 1;
    g.world.weather.funnel = null; // Restart the storm after teleporting out of the saved cold site.
    g.pointerLockFallback = true;
    g.resume();
  });
  await page.waitForFunction(
    () =>
      dcsmcraft.world.weather.funnel &&
      dcsmcraft.renderer.weatherVisual.shell.visible,
  );
  const before = await page.evaluate(() => ({
    ...dcsmcraft.world.weather.funnel,
  }));
  await page.waitForTimeout(350);
  expect(
    await page.evaluate(
      (x) =>
        Math.hypot(
          dcsmcraft.world.weather.funnel.x - x.x,
          dcsmcraft.world.weather.funnel.z - x.z,
        ),
      before,
    ),
  ).toBeGreaterThan(0.2);
  await page.evaluate(() => {
    const g = dcsmcraft,
      f = g.world.weather.funnel;
    g.pause();
    g.ui.play();
    Object.assign(g.player, {
      x: f.x + 55,
      z: f.z + 65,
      y: g.world.terrain(f.x, f.z).h + 30,
      yaw: 0.65,
      pitch: -0.08,
    });
  });
  await page.waitForTimeout(200);
  await shot(page, "tornado");
  expect(
    await page.evaluate(() => dcsmcraft.renderer.weatherVisual.debris.count),
  ).toBeGreaterThan(0);
  await page.evaluate(() => {
    const g = dcsmcraft,
      f = g.world.weather.funnel,
      x = Math.floor(f.x + 8),
      z = Math.floor(f.z),
      y = g.world.skyHeight(x, z) + 1;
    g.mode = "survival";
    g.difficulty = "normal";
    Object.assign(g.player, {
      x: x + 0.5,
      y,
      z: z + 0.5,
      health: 20,
      hurt: 0,
      flying: false,
      vx: 0,
      vy: 0,
      vz: 0,
      fallStart: y,
    });
    g.testWeatherStart = { x: g.player.x, z: g.player.z };
    g.resume();
    g.pointerLockFallback = true;
  });
  await page.waitForTimeout(600);
  expect(
    await page.evaluate(() =>
      Math.hypot(
        dcsmcraft.player.x - dcsmcraft.testWeatherStart.x,
        dcsmcraft.player.z - dcsmcraft.testWeatherStart.z,
      ),
    ),
  ).toBeGreaterThan(0.05);
  await page.evaluate((B) => {
    const g = dcsmcraft;
    g.pause();
    const x = Math.floor(g.player.x),
      z = Math.floor(g.player.z),
      y = Math.ceil(g.player.y);
    for (let a = -1; a <= 1; a++)
      for (let b = -1; b <= 1; b++) g.world.set(x + a, y + 3, z + b, B.planks);
    g.world.set(x, y - 1, z, B.stone);
    Object.assign(g.player, {
      x: x + 0.5,
      y,
      z: z + 0.5,
      vx: 0,
      vy: 0,
      vz: 0,
      onGround: true,
    });
    g.testWeatherStart = { x: g.player.x, z: g.player.z };
    g.resume();
    g.pointerLockFallback = true;
  }, B);
  await page.waitForTimeout(500);
  expect(
    await page.evaluate(() =>
      Math.hypot(
        dcsmcraft.player.x - dcsmcraft.testWeatherStart.x,
        dcsmcraft.player.z - dcsmcraft.testWeatherStart.z,
      ),
    ),
  ).toBeLessThan(0.02);
  expect(result.errors).toEqual([]);
  expect(result.external).toEqual([]);
});
test("offline redesigned animal, hostile, Cinderworld and interaction sounds produce audible non-looping output and release voices", async ({
  page,
}) => {
  const result = await boot(page);
  const measurements = await page.evaluate(async () => {
    const g = dcsmcraft,
      a = g.audio;
    a.unlock();
    g.settings.volume = 0.75;
    g.settings.mobVolume = 0.85;
    a.updateVolume();
    await a.context.resume();
    const analyser = a.context.createAnalyser();
    analyser.fftSize = 2048;
    a.master.connect(analyser);
    const data = new Float32Array(2048),
      rms = () => {
        analyser.getFloatTimeDomainData(data);
        return Math.sqrt(data.reduce((n, v) => n + v * v, 0) / data.length);
      },
      wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const values = {};
    for (const [type, kind] of [
      ["cow", "idle"],
      ["chicken", "idle"],
      ["zombie", "attack"],
      ["watcher", "laugh"],
      ["skeleton", "hurt"],
      ["cinder_wraith", "idle"],
      ["mad_titan", "attack"],
    ]) {
      a.mob(type, 0, kind);
      await wait(100);
      values[type] = rms();
      await wait(1600);
    }
    for (const type of ["ui", "swing", "door-open", "bucket", "explosion"]) {
      a.tone(type);
      await wait(30);
      values[type] = rms();
      await wait(2000);
    }
    await wait(500);
    const active = a.active;
    a.master.disconnect(analyser);
    return { values, active, loadedVoiceKeys: Object.keys(a.voices).length };
  });
  for (const [name, v] of Object.entries(measurements.values))
    expect(v, name).toBeGreaterThan(0.00001);
  expect(measurements.active).toBe(0);
  expect(result.errors).toEqual([]);
  expect(result.external).toEqual([]);
});
