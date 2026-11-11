import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
const html = readFileSync("dist/DCSMCRAFT-Standalone.html", "utf8"),
  out = "/workspace/artifacts/tornado-performance";
mkdirSync(out, { recursive: true });
test("offline tornado is bounded through all particle settings, respects toggles, and never streams remote NPC/drop terrain", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors = [],
    external = [];
  page.on("pageerror", (e) => errors.push(e.stack || e.message));
  page.on("console", (m) => {
    if (/Shader Error|GL_INVALID|WebGLProgram/.test(m.text()))
      errors.push(m.text());
  });
  await page.addInitScript(() =>
    localStorage.setItem(
      "dcsmcraft-settings",
      JSON.stringify({
        graphics: 1,
        renderDistance: 2,
        distantTerrain: false,
        volume: 0,
        frameLimit: 0,
        particles: "all",
      }),
    ),
  );
  await page.route("**/*", (r) =>
    r.request().url().endsWith("/tornado-performance.html")
      ? r.fulfill({ contentType: "text/html", body: html })
      : (external.push(r.request().url()), r.abort()),
  );
  await page.goto("/tornado-performance.html");
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.locator("[data-action=create]").click();
  await page.locator("[name=seed]").fill("Wildflower");
  await page.locator("[name=mode][value=creative]").check();
  await page.locator("[data-action=start-world]").click();
  await page.waitForFunction(() => dcsmcraft.active);
  await page.evaluate(() => dcsmcraft.pause());
  await page.getByRole("button", { name: "Weather", exact: true }).click();
  await page.locator("[data-weather=tornado]").click();
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.getByRole("button", { name: "Back to Game", exact: true }).click();
  await page.evaluate(() => {
    const g = dcsmcraft,
      p = g.player,
      x = Math.floor(p.x - 20),
      z = Math.floor(p.z - 20),
      h = g.world.terrain(x, z).h;
    g.entities = Array.from({ length: 96 }, (_, i) => ({
      id: "saved-" + i,
      type: "villager",
      hp: 20,
      persistent: true,
      x: 10000 + i * 32,
      y: 201,
      z: 10000,
      age: 9,
      dir: 0,
      turn: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      hurt: 0,
      attack: 0,
    }));
    g.drops = Array.from({ length: 48 }, (_, i) => ({
      uid: "saved-drop-" + i,
      id: "diamond",
      count: 1,
      x: -10000 - i * 32,
      y: 201,
      z: 10000,
      age: 5,
      delay: 0,
      vy: 0,
    }));
    Object.assign(g.world.weather, {
      intensity: 1,
      nextStrike: 1e9,
      funnel: {
        x: x + 0.5,
        z: z + 0.5,
        age: 0,
        seed: 123,
        heading: 0,
        drift: 0,
      },
    });
    Object.assign(p, {
      y: h + 21,
      flying: true,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: Math.atan2(p.x - x, p.z - z),
      pitch: 0,
    });
    const original = g.world.ensure.bind(g.world);
    window.remoteWeatherLoads = 0;
    g.world.ensure = (cx, cz) => {
      if (Math.abs(cx) > 300 || Math.abs(cz) > 300) window.remoteWeatherLoads++;
      return original(cx, cz);
    };
    g.resume();
    g.pointerLockFallback = true;
  });
  await page.waitForFunction(
    () => dcsmcraft.renderer.weatherVisual.shell.visible,
  );
  const initial = await page.evaluate(() => ({
    funnel:
      dcsmcraft.renderer.weatherVisual.funnel.geometry.attributes.position
        .version,
    buffer:
      dcsmcraft.renderer.weatherVisual.funnel.geometry.attributes.position.array
        .length,
  }));
  const timings = await page.evaluate(
    () =>
      new Promise((resolve) => {
        const times = [];
        let previous = performance.now(),
          start = previous;
        function frame(now) {
          times.push(now - previous);
          previous = now;
          if (now - start < 2200) requestAnimationFrame(frame);
          else {
            times.sort((a, b) => a - b);
            resolve({
              samples: times.length,
              p50FrameMs: times[Math.floor(times.length * 0.5)],
              p95FrameMs: times[Math.floor(times.length * 0.95)],
            });
          }
        }
        requestAnimationFrame(frame);
      }),
  );
  expect(await page.evaluate(() => window.remoteWeatherLoads)).toBe(0);
  expect(
    await page.evaluate(() =>
      dcsmcraft.drops
        .filter((d) => d.uid?.startsWith("saved-drop"))
        .every((d) => d.age === 5 && d.count === 1),
    ),
  ).toBe(true);
  for (const [setting, points, debris] of [
    ["all", 512, 48],
    ["decreased", 256, 20],
    ["minimal", 96, 8],
  ]) {
    await page.evaluate((s) => (dcsmcraft.settings.particles = s), setting);
    await page.waitForFunction(
      (n) => dcsmcraft.renderer.weatherVisual.stats.funnelParticles === n,
      points,
    );
    expect(
      await page.evaluate(() => dcsmcraft.renderer.weatherVisual.debris.count),
    ).toBe(debris);
    expect(
      await page.evaluate(
        () => dcsmcraft.renderer.weatherVisual.stats.roofQueries,
      ),
    ).toBeLessThanOrEqual(32);
    await page.screenshot({ path: `${out}/${setting}.png` });
  }
  expect(
    await page.evaluate(
      () =>
        dcsmcraft.renderer.weatherVisual.funnel.geometry.attributes.position
          .version,
    ),
  ).toBe(initial.funnel);
  await page.evaluate(() => {
    dcsmcraft.settings.weatherEffects = false;
  });
  await page.waitForFunction(
    () => !dcsmcraft.renderer.weatherVisual.shell.visible,
  );
  expect(
    await page.evaluate(() => dcsmcraft.renderer.weatherVisual.debris.count),
  ).toBe(0);
  await page.evaluate(() => {
    dcsmcraft.settings.weatherEffects = true;
    dcsmcraft.settings.lightningFlashes = false;
    dcsmcraft.world.weather.strike = {
      x: dcsmcraft.player.x,
      y: dcsmcraft.player.y,
      z: dcsmcraft.player.z,
      tick: dcsmcraft.world.tick,
    };
  });
  await page.waitForTimeout(80);
  expect(
    await page.evaluate(() => dcsmcraft.renderer.weatherVisual.bolt.visible),
  ).toBe(false);
  const saved = await page.evaluate(async () => {
    const g = dcsmcraft;
    g.pause();
    await g.save();
    return { id: g.id, funnel: { ...g.world.weather.funnel } };
  });
  await page.reload();
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.locator("[data-action=load]").first().click();
  await page.waitForFunction(() => dcsmcraft.active);
  await page.evaluate(() => dcsmcraft.pause());
  expect(await page.evaluate(() => dcsmcraft.world.weather.kind)).toBe(
    "tornado",
  );
  expect(await page.evaluate(() => window.remoteWeatherLoads || 0)).toBe(0);
  writeFileSync(
    `${out}/browser.json`,
    JSON.stringify(
      {
        scope:
          "Actual standalone Chromium/SwiftShader storm at 1280x800; uncapped, 2.2 seconds. Not a hardware FPS guarantee.",
        ...timings,
        shaderErrors: errors,
        externalRequests: external,
        remoteWeatherTerrainLoads: 0,
        staticFunnelBuffer: true,
        particleBudgets: { all: 512, decreased: 256, minimal: 96 },
        savedWorld: saved.id,
      },
      null,
      2,
    ),
  );
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
