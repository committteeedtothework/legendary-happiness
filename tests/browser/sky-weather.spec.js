import { test, expect } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
const html = readFileSync("dist/DCSMCRAFT-Standalone.html", "utf8"),
  out = "/workspace/artifacts/sky-weather-playtest";
mkdirSync(out, { recursive: true });
async function boot(page) {
  const errors = [],
    external = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (/Shader Error|GL_INVALID|WebGLProgram/.test(m.text()))
      errors.push(m.text());
  });
  await page.addInitScript(() =>
    localStorage.setItem(
      "dcsmcraft-settings",
      JSON.stringify({
        renderDistance: 3,
        graphics: 2,
        clouds: true,
        fancyGraphics: true,
        musicEnabled: false,
        volume: 0,
        frameLimit: 30,
      }),
    ),
  );
  await page.route("**/*", (r) =>
    r.request().url().endsWith("/sky-weather.html")
      ? r.fulfill({ contentType: "text/html", body: html })
      : (external.push(r.request().url()), r.abort()),
  );
  await page.goto("/sky-weather.html");
  await page.waitForFunction(() => dcsmcraft?.initialized);
  await page.locator("[data-action=create]").click();
  await page.locator("[name=seed]").fill("Weather in place");
  await page.locator("[name=mode][value=creative]").check();
  await page.locator("[data-action=start-world]").click();
  await page.waitForFunction(() => dcsmcraft.running);
  await page.evaluate(() => {
    const g = dcsmcraft;
    g.entities = [];
    g.player.flying = true;
    let site;
    for (let z = -256; z <= 256 && !site; z += 128)
      for (let x = -256; x <= 256; x += 128) {
        const t = g.world.terrain(x + 0.5, z + 0.5);
        if (
          t.h < 115 &&
          !["alpine", "snowy_taiga", "desert", "badlands"].includes(t.biome)
        ) {
          site = { x: x + 0.5, y: Math.max(95, t.h + 12), z: z + 0.5 };
          break;
        }
      }
    Object.assign(g.player, site, { vx: 0, vy: 0, vz: 0, pitch: 0.7, yaw: 0 });
    g.time = 6000;
    Object.assign(g.world.weather, {
      kind: "rain",
      override: "rain",
      intensity: 1,
      nextStrike: 1e9,
      funnel: null,
    });
    g.renderer.weatherVisual.nextSample = 0;
    g.ui.root.querySelector("#toast").classList.remove("show");
    g.ui.root.querySelector("#cycle-banner").classList.remove("show");
  });
  await page.waitForFunction(
    () =>
      dcsmcraft.renderer.weatherVisual.rainFade.filter((x) => x > 0.8).length >
      120,
  );
  await page.evaluate(() => {
    dcsmcraft.pause();
    dcsmcraft.ui.play();
    dcsmcraft.time = 6000;
  });
  await page.waitForTimeout(150);
  return { errors, external };
}
test("sky directions and world precipitation stay fixed through movement, 128-block boundaries and F5 while sky time/wind advance independently", async ({
  page,
}) => {
  test.setTimeout(120000);
  const r = await boot(page);
  const result = await page.evaluate(async () => {
    const g = dcsmcraft,
      r = g.renderer,
      wait = () => new Promise((resolve) => setTimeout(resolve, 90)),
      capture = () => {
        r.sunOrb.updateWorldMatrix(true, false);
        r.moonOrb.updateWorldMatrix(true, false);
        const pos = r.sunOrb.matrixWorld.elements,
          moon = r.moonOrb.matrixWorld.elements,
          c = r.camera.position;
        return {
          sun: [pos[12] - c.x, pos[13] - c.y, pos[14] - c.z],
          moon: [moon[12] - c.x, moon[13] - c.y, moon[14] - c.z],
          cloud: [r.clouds.position.x, r.clouds.position.z],
          rain: Array.from(r.weatherVisual.rainPositions),
          fade: Array.from(r.weatherVisual.rainFade),
          clock: r.weatherVisual.clock,
        };
      },
      base = capture(),
      p = { x: g.player.x, y: g.player.y, z: g.player.z };
    Object.assign(g.player, { x: p.x + 0.2, y: p.y + 0.3, z: p.z + 0.2 });
    await wait();
    const step = capture();
    let stable = 0,
      drift = 0;
    for (let i = 0; i < r.weatherVisual.count; i++)
      if (base.fade[i * 2] > 0.8 && step.fade[i * 2] > 0.8) {
        stable++;
        for (let j = 0; j < 6; j++)
          drift = Math.max(
            drift,
            Math.abs(base.rain[i * 6 + j] - step.rain[i * 6 + j]),
          );
      }
    const snapshots = [base, step];
    const edge = Math.ceil(g.player.x / 128) * 128;
    g.player.x = edge - 0.1;
    await wait();
    snapshots.push(capture());
    g.player.x = edge + 0.1;
    await wait();
    snapshots.push(capture());
    for (const mode of [1, 2, 0]) {
      g.cameraMode = mode;
      await wait();
      snapshots.push(capture());
    }
    g.time = 7000;
    await wait();
    const later = capture();
    g.running = true;
    g.ui.play();
    await new Promise((resolve) => setTimeout(resolve, 500));
    const moving = capture();
    g.pause();
    g.ui.play();
    return { stable, drift, snapshots, later, moving };
  });
  expect(result.stable).toBeGreaterThan(30);
  expect(result.drift).toBe(0);
  for (const frame of result.snapshots) {
    for (const key of ["sun", "moon", "cloud"])
      for (let i = 0; i < frame[key].length; i++)
        expect(frame[key][i]).toBeCloseTo(result.snapshots[0][key][i], 7);
    expect(frame.clock).toBe(result.snapshots[0].clock);
  }
  expect(
    Math.abs(result.later.sun[0] - result.snapshots[0].sun[0]),
  ).toBeGreaterThan(1);
  expect(result.moving.clock).toBeGreaterThan(result.later.clock);
  expect(result.moving.cloud[0]).toBeGreaterThan(result.later.cloud[0]);
  await page.screenshot({ path: out + "/anchored-rain.png" });
  expect(r.errors).toEqual([]);
  expect(r.external).toEqual([]);
});
test("clouds are bright layered batches, blend into storm banks without cell jumps, and respect sky/weather graphics controls", async ({
  page,
}) => {
  test.setTimeout(120000);
  const r = await boot(page);
  await page.evaluate(() => {
    const g = dcsmcraft;
    Object.assign(g.world.weather, {
      kind: "clear",
      override: "clear",
      intensity: 0,
    });
    g.time = 6000;
    g.player.yaw = 0;
    g.player.pitch = 0.8;
  });
  await page.waitForFunction(() => dcsmcraft.renderer.clouds.cover < 0.005);
  const clear = await page.evaluate(() => {
    const c = dcsmcraft.renderer.clouds;
    return {
      count: c.mesh.count,
      color: c.mesh.material.color.toArray(),
      rebuilds: c.rebuilds,
      draws: c.children.length,
      depthWrite: c.mesh.material.depthWrite,
      transparent: c.mesh.material.transparent,
    };
  });
  expect(clear.color[0]).toBeGreaterThan(0.9);
  expect(clear.color[1]).toBeGreaterThan(0.9);
  expect(clear.draws).toBe(1);
  expect(clear.transparent).toBe(false);
  expect(clear.depthWrite).toBe(true);
  await page.screenshot({ path: out + "/clear-clouds.png" });
  await page.waitForTimeout(350);
  expect(
    await page.evaluate(() => dcsmcraft.renderer.clouds.rebuilds),
  ).toBeLessThanOrEqual(clear.rebuilds + 1);
  await page.evaluate(() =>
    Object.assign(dcsmcraft.world.weather, {
      kind: "thunder",
      override: "thunder",
      intensity: 1,
    }),
  );
  await page.waitForFunction(() => dcsmcraft.renderer.clouds.cover > 0.98);
  const storm = await page.evaluate(() => {
    const c = dcsmcraft.renderer.clouds;
    return { count: c.mesh.count, color: c.mesh.material.color.toArray() };
  });
  expect(storm.count).toBeGreaterThan(clear.count);
  expect(storm.color[0]).toBeLessThan(clear.color[0] * 0.7);
  expect(storm.count).toBeLessThanOrEqual(567);
  await page.screenshot({ path: out + "/storm-clouds.png" });
  await page.evaluate(() => {
    const g = dcsmcraft;
    g.settings.clouds = false;
    g.settings.sunMoon = false;
    g.settings.weatherEffects = false;
    g.renderer.applyGraphics();
  });
  await page.waitForFunction(() => {
    const r = dcsmcraft.renderer;
    return (
      !r.clouds.visible &&
      !r.sunOrb.visible &&
      !r.moonOrb.visible &&
      !r.weatherVisual.rain.visible
    );
  });
  await page.evaluate(() => {
    const g = dcsmcraft;
    g.settings.clouds = true;
    g.settings.sunMoon = true;
    g.settings.weatherEffects = true;
    g.settings.cloudHeight = 192;
    g.settings.fancyGraphics = false;
    g.renderer.applyGraphics();
  });
  await page.waitForFunction(
    () =>
      dcsmcraft.renderer.clouds.position.y === 32 &&
      dcsmcraft.renderer.clouds.mesh.count <= 162 &&
      dcsmcraft.renderer.clouds.visible,
  );
  await page.evaluate(() => {
    dcsmcraft.time = 18000;
    dcsmcraft.player.yaw = Math.PI;
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: out + "/night-clouds.png" });
  await page.evaluate(() =>
    dcsmcraft.travelDimension({ x: 0, y: 140, z: 0, axis: "x" }),
  );
  await page.waitForFunction(() => {
    const r = dcsmcraft.renderer;
    return (
      dcsmcraft.dimension === "cinderwild" &&
      !r.clouds.visible &&
      !r.sunOrb.visible &&
      !r.moonOrb.visible
    );
  });
  expect(r.errors).toEqual([]);
  expect(r.external).toEqual([]);
});
