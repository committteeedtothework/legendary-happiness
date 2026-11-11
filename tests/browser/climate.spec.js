import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { World } from "../../src/world.js";
import { villageAt } from "../../src/villages.js";
import { B } from "../../src/data.js";
let html;
test.beforeAll(() => {
  execFileSync(process.execPath, [
    "scripts/build-standalone.mjs",
    "/tmp/dcsmcraft-climate-tested.html",
  ]);
  html = readFileSync("/tmp/dcsmcraft-climate-tested.html", "utf8");
});
async function create(page, standalone = true) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (
      /Shader Error|WebGLProgram|GL_INVALID|texSubImage|processorerror/i.test(
        m.text(),
      )
    )
      errors.push(m.text());
  });
  await page.addInitScript(() => {
    if (!localStorage.getItem("dcsmcraft-settings"))
      localStorage.setItem(
        "dcsmcraft-settings",
        JSON.stringify({ renderDistance: 2, graphics: 2 }),
      );
  });
  if (standalone)
    await page.route("**/*", (r) =>
      r.request().url().endsWith("/climate.html")
        ? r.fulfill({ contentType: "text/html", body: html })
        : r.abort(),
    );
  await page.goto(standalone ? "/climate.html" : "/");
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.locator("[data-action=create]").first().click();
  await page.locator("[name=seed]").fill("Wildflower");
  await page.locator("[name=mode][value=creative]").check();
  await page.locator("[data-action=start-world]").click();
  await page.waitForFunction(() => dcsmcraft.running);
  await page.evaluate(() => {
    const g = dcsmcraft;
    g.pause();
    g.ui.play();
    g.pointerLockFallback = true;
    g.running = true;
    g.entities = [];
    g.ui.root.querySelector("#cycle-banner").classList.remove("show");
  });
  return errors;
}
function biomeSites() {
  const w = new World("Wildflower"),
    found = {};
  for (let z = -1600; z <= 1600; z += 32)
    for (let x = -1600; x <= 1600; x += 32) {
      const t = w.terrain(x, z);
      if (
        ["meadow", "alpine", "desert"].includes(t.biome) &&
        t.h > 65 &&
        t.h < 115 &&
        !t.village &&
        // Test the climate at the player centre as well as the block corner.
        // New foothills can put an integer sample directly on an alpine edge.
        w.terrain(x + 0.5, z + 0.5).biome === t.biome &&
        !found[t.biome]
      )
        found[t.biome] = { x, z, h: t.h, biome: t.biome };
      if (Object.keys(found).length === 3) return found;
    }
  return found;
}
async function place(page, site) {
  await page.evaluate((p) => {
    const g = dcsmcraft;
    Object.assign(g.player, {
      x: p.x + 0.5,
      y: p.h + 6,
      z: p.z + 0.5,
      yaw: 0.5,
      pitch: -0.2,
      flying: true,
      vx: 0,
      vy: 0,
      vz: 0,
    });
    g.running = true;
    g.ui.play();
    g.pointerLockFallback = true;
    g.audio.nextAmbienceMix = 0;
  }, site);
}
test("standalone ambience uses a live non-looping worklet, reacts to water and shelter, and mutes cleanly", async ({
  page,
}) => {
  const errors = await create(page);
  const s = biomeSites().meadow;
  expect(s).toBeTruthy();
  await place(page, s);
  await page.evaluate(() => {
    const g = dcsmcraft;
    g.settings.volume = 1;
    g.settings.ambientVolume = 1;
    g.settings.mobSounds = false;
    g.audio.updateVolume();
    g.audio.nextBird = Infinity;
  });
  await expect
    .poll(() => page.evaluate(() => dcsmcraft.audio.soundscape.mode))
    .toBe("worklet");
  const result = await page.evaluate(async (B) => {
    const g = dcsmcraft,
      a = g.audio,
      c = a.context,
      an = c.createAnalyser();
    an.fftSize = 2048;
    a.master.connect(an);
    await c.resume();
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const rms = () => {
      const d = new Float32Array(2048);
      an.getFloatTimeDomainData(d);
      return Math.sqrt(d.reduce((s, v) => s + v * v, 0) / d.length);
    };
    await wait(1200);
    const wind = rms();
    const before = { ...a.soundscape.targets };
    const wx = Math.floor(g.player.x),
      wy = Math.floor(g.player.y),
      wz = Math.floor(g.player.z);
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++)
        g.world.set(wx + dx, wy, wz + dz, B.water);
    g.player.inWater = true;
    a.nextAmbienceMix = 0;
    a.ambient(g);
    await wait(1200);
    const water = rms(),
      waterTarget = a.soundscape.layers.water.target;
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++) g.world.set(wx + dx, wy, wz + dz, B.air);
    g.world.weather.kind = "rain";
    g.world.weather.intensity = 1;
    g.player.inWater = false;
    a.nextAmbienceMix = 0;
    a.ambient(g);
    const open = a.soundscape.layers.rain.target;
    g.world.set(
      Math.floor(g.player.x),
      Math.floor(g.player.y) + 3,
      Math.floor(g.player.z),
      B.planks,
    );
    a.nextAmbienceMix = 0;
    a.ambient(g);
    const covered = a.soundscape.layers.rain.target;
    g.pause();
    await wait(1500);
    const muted = rms();
    a.master.disconnect(an);
    return {
      wind,
      water,
      waterTarget,
      open,
      covered,
      muted,
      mode: a.soundscape.mode,
      sources: a.soundscape.sources.size,
      before,
    };
  }, B);
  expect(result.wind).toBeGreaterThan(0.0001);
  expect(result.water).toBeGreaterThan(0.0001);
  expect(result.waterTarget).toBe(0.5);
  expect(result.open).toBeGreaterThan(result.covered * 4);
  expect(result.muted).toBeLessThan(0.00003);
  expect(result.mode).toBe("worklet");
  expect(result.sources).toBe(0);
  expect(errors).toEqual([]);
});
test("music menu toggle and volume create audible original pieces, mute independently and survive reload", async ({
  page,
}) => {
  const errors = await create(page);
  await page.evaluate(() => {
    dcsmcraft.pause();
    dcsmcraft.settings.ambientSounds = false;
    dcsmcraft.settings.mobSounds = false;
    dcsmcraft.ui.settings();
  });
  await page.locator("[data-audio=musicEnabled]").click();
  await expect(page.locator("[data-audio=musicEnabled]")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.locator("[data-setting=musicVolume]").fill("0.7");
  await page.evaluate(() => {
    const g = dcsmcraft;
    g.settings.volume = 1;
    g.audio.updateVolume();
    g.ui.play();
    g.pointerLockFallback = true;
    g.running = true;
    g.player.flying = true;
    g.player.y += 5;
  });
  await expect
    .poll(() => page.evaluate(() => dcsmcraft.audio.music.scheduled))
    .toBeGreaterThan(1);
  const loud = await page.evaluate(async () => {
    const a = dcsmcraft.audio,
      c = a.context,
      an = c.createAnalyser();
    an.fftSize = 2048;
    a.master.connect(an);
    await new Promise((r) => setTimeout(r, 250));
    const data = new Float32Array(2048);
    an.getFloatTimeDomainData(data);
    a.master.disconnect(an);
    return Math.sqrt(data.reduce((s, v) => s + v * v, 0) / data.length);
  });
  expect(loud).toBeGreaterThan(0.0001);
  await page.evaluate(() => {
    dcsmcraft.pause();
    dcsmcraft.ui.settings();
  });
  await page.locator("[data-audio=musicEnabled]").click();
  await expect(page.locator("[data-audio=musicEnabled]")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  await page.evaluate(() => {
    dcsmcraft.ui.play();
    dcsmcraft.running = true;
    dcsmcraft.pointerLockFallback = true;
  });
  await expect
    .poll(() => page.evaluate(() => dcsmcraft.audio.music.output.gain.value))
    .toBe(0);
  await page.reload();
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  expect(
    await page.evaluate(() => [
      dcsmcraft.settings.musicEnabled,
      dcsmcraft.settings.musicVolume,
    ]),
  ).toEqual([false, 0.7]);
  expect(errors).toEqual([]);
});
test("Creative weather controls produce rain snow and dry deserts, respect roofs and persist storms", async ({
  page,
}) => {
  const errors = await create(page),
    sites = biomeSites();
  await place(page, sites.meadow);
  await page.evaluate(() => {
    dcsmcraft.pause();
    dcsmcraft.ui.pause();
  });
  await page.getByRole("button", { name: "Weather", exact: true }).click();
  await page.locator("[data-weather=rain]").click();
  await expect(page.locator("[data-weather=rain]")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("button", { name: "Back to Game", exact: true }).click();
  await page.evaluate(() => {
    dcsmcraft.world.weather.intensity = 1;
  });
  await expect
    .poll(() =>
      page.evaluate(() => dcsmcraft.renderer.weatherVisual.rain.visible),
    )
    .toBe(true);
  await page.screenshot({
    path: "/workspace/artifacts/DCSMCRAFT-v1.0.0-rain.png",
  });
  await place(page, sites.alpine);
  await expect
    .poll(() =>
      page.evaluate(() => dcsmcraft.renderer.weatherVisual.snow.visible),
    )
    .toBe(true);
  await expect
    .poll(() =>
      page.evaluate(() => dcsmcraft.renderer.weatherVisual.rain.visible),
    )
    .toBe(false); // Rain fades out as snow fades in.
  await page.screenshot({
    path: "/workspace/artifacts/DCSMCRAFT-v1.0.0-snow.png",
  });
  await place(page, sites.desert);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          !dcsmcraft.renderer.weatherVisual.rain.visible &&
          !dcsmcraft.renderer.weatherVisual.snow.visible,
      ),
    )
    .toBe(true);
  await place(page, sites.meadow);
  const saved = await page.evaluate(async (B) => {
    const g = dcsmcraft;
    g.world.weather.kind = "thunder";
    g.world.weather.override = "thunder";
    g.world.weather.intensity = 1;
    g.world.weather.strike = {
      x: g.player.x + 18,
      y: g.player.y - 5,
      z: g.player.z - 24,
      tick: g.world.tick,
      seed: 41,
    };
    const x = Math.floor(g.player.x),
      z = Math.floor(g.player.z);
    g.world.set(x, Math.floor(g.player.y) + 3, z, B.planks);
    g.renderer.weatherVisual.nextSample = 0;
    g.pause();
    g.ui.play();
    await g.save();
    return { id: g.id, weather: g.world.weather };
  }, B);
  await page.waitForTimeout(150);
  expect(
    await page.evaluate(() => dcsmcraft.renderer.weatherVisual.view.exposed),
  ).toBe(false);
  await page.screenshot({
    path: "/workspace/artifacts/DCSMCRAFT-v1.0.0-thunder.png",
  });
  await page.evaluate(() => {
    dcsmcraft.ui.videoSettings();
  });
  for (const key of ["weatherEffects", "lightningFlashes"])
    await page.locator(`[data-graphics=${key}]`).click();
  expect(
    await page.evaluate(() => [
      dcsmcraft.settings.weatherEffects,
      dcsmcraft.settings.lightningFlashes,
    ]),
  ).toEqual([false, false]);
  await page.reload();
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.evaluate((id) => dcsmcraft.loadWorld(id), saved.id);
  await page.waitForFunction(() => dcsmcraft.active);
  expect(
    await page.evaluate(() => [
      dcsmcraft.world.weather.kind,
      dcsmcraft.world.weather.override,
    ]),
  ).toEqual(["thunder", "thunder"]);
  expect(errors).toEqual([]);
});
test("24-chunk graphics option builds batched horizon tiles with zero GPU errors and keeps voxel memory bounded", async ({
  page,
}) => {
  const errors = await create(page);
  await page.evaluate(() => {
    const g = dcsmcraft;
    g.pause();
    g.ui.videoSettings();
  });
  await page.locator("[data-setting=renderDistance]").fill("24");
  await page.evaluate(() => {
    const g = dcsmcraft;
    g.player.y += 25;
    g.player.flying = true;
    g.player.pitch = -0.2;
    g.ui.play();
    g.running = true;
    g.pointerLockFallback = true;
    g.time = 6000;
  });
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            [...dcsmcraft.renderer.meshes.values()].filter(
              (g) => g.userData.horizon,
            ).length,
        ),
      { timeout: 45000 },
    )
    .toBeGreaterThan(18);
  const result = await page.evaluate(() => {
    const g = dcsmcraft,
      r = g.renderer;
    const far = [...r.meshes].filter(([, m]) => m.userData.horizon);
    return {
      range: g.settings.renderDistance,
      far: far.length,
      groups: far.every(([, m]) => m.children.length <= 2),
      mainChunks: g.world.chunks.size,
      glError: r.gl.getContext().getError(),
      coverageMatches: [...r.meshes]
        .filter(([, m]) => !m.userData.horizon)
        .every(([key]) => {
          const [x, z] = key.split(",").map(Number),
            origin = r.horizonOrigin.value;
          return r.horizonMaskData[x - origin.x + (z - origin.y) * 32] === 255;
        }),
      vertices: far.reduce(
        (n, [, m]) =>
          n +
          m.children.reduce(
            (s, x) => s + x.geometry.attributes.position.count,
            0,
          ),
        0,
      ),
    };
  });
  expect(result.range).toBe(24);
  expect(result.groups).toBe(true);
  expect(result.mainChunks).toBeLessThan(180);
  expect(result.glError).toBe(0);
  expect(result.coverageMatches).toBe(true);
  expect(result.vertices).toBeGreaterThan(0);
  await page.screenshot({
    path: "/workspace/artifacts/DCSMCRAFT-v1.0.0-horizon.png",
  });
  expect(errors).toEqual([]);
});
function villageSites() {
  const w = new World("Wildflower"),
    found = {};
  for (let z = -15; z <= 15; z++)
    for (let x = -15; x <= 15; x++) {
      const v = villageAt(w, x, z);
      if (v && !found[v.style]) found[v.style] = v;
    }
  return found;
}
test("real biome-specific settlements render regional homes, clothed residents, loot and linked doors", async ({
  page,
}) => {
  const errors = await create(page, false),
    sites = villageSites();
  for (const style of ["desert", "snow", "marsh"]) {
    const v = sites[style];
    expect(v, style).toBeTruthy();
    await page.evaluate((v) => {
      const g = dcsmcraft;
      g.pause();
      Object.assign(g.player, {
        x: v.x + 3,
        y: v.y + 30,
        z: v.z + 15,
        yaw: 0.12,
        pitch: -1.1,
        flying: true,
        vx: 0,
        vy: 0,
        vz: 0,
      });
      g.settings.renderDistance = 4;
      g.time = 6000;
      g.world.weather.intensity = 0;
      g.world.weather.kind = "clear";
      g.ui.play();
      g.pointerLockFallback = true;
      g.running = true;
    }, v);
    await expect
      .poll(
        () =>
          page.evaluate(
            (id) =>
              dcsmcraft.entities.filter(
                (e) => e.type === "villager" && e.village.id === id,
              ).length,
            v.id,
          ),
        { timeout: 20000 },
      )
      .toBe(8);
    const data = await page.evaluate(async (v) => {
      const g = dcsmcraft,
        { doorAt } = await import("/src/doors.js"),
        h = v.houses[0],
        floor = h.floor;
      return {
        style: g.entities.find(
          (e) => e.type === "villager" && e.village.id === v.id,
        ).style,
        door: !!doorAt(g.world, h.doorX, floor + 1, h.doorZ),
        bed: g.world.get(h.x + 1, floor + 1, h.z + 1),
        floor,
      };
    }, v);
    expect(data).toMatchObject({
      style,
      door: true,
      bed: B.bed,
      floor: v.houses[0].floor,
    });
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: `/workspace/artifacts/DCSMCRAFT-v1.0.0-village-${style}.png`,
    });
  }
  expect(errors).toEqual([]);
});
test("resuming before asynchronous native pointer-lock exit completes leaves the game playable", async ({
  page,
}) => {
  const errors = await create(page);
  await page.evaluate(() => {
    const g = dcsmcraft;
    g.pause();
    g.resume();
  });
  await page.waitForTimeout(700);
  expect(
    await page.evaluate(
      () => dcsmcraft.running && dcsmcraft.ui.screen === "play",
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
