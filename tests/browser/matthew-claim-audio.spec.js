import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { B } from "../../src/data.js";
const html = readFileSync("dist/DCSMCRAFT-Standalone.html", "utf8");
test("offline Matthew altar claim plays the supplied MP3 once, rejects full inventory, obeys Master mute and never replays after reload", async ({
  page,
}) => {
  test.setTimeout(90000);
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
        renderDistance: 2,
        graphics: 1,
        distantTerrain: false,
        volume: 0.4,
        musicEnabled: false,
        ambientSounds: false,
        mobSounds: false,
        frameLimit: 30,
      }),
    ),
  );
  await page.route("**/*", (r) =>
    r.request().url().endsWith("/pistol-claim.html")
      ? r.fulfill({ contentType: "text/html", body: html })
      : (external.push(r.request().url()), r.abort()),
  );
  await page.goto("/pistol-claim.html");
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.locator("[data-action=create]").click();
  await page.locator("[name=seed]").fill("Wildflower");
  await page.locator("[name=mode][value=creative]").check();
  await page.locator("[data-action=start-world]").click();
  await page.waitForFunction(() => dcsmcraft.running);
  await page.evaluate(async (B) => {
    const g = dcsmcraft;
    g.pause();
    g.entities = [];
    g.drops = [];
    g.ui.play();
    for (let x = -4; x <= 4; x++)
      for (let z = -3; z <= 5; z++) {
        g.world.set(x, 199, z, B.stone);
        for (let y = 200; y <= 204; y++) g.world.set(x, y, z, B.air);
      }
    g.world.set(0, 201, 0, B.matthew_altar);
    g.world.settlements["matthew-incursion"] = {
      x: 0,
      y: 200,
      z: 0,
      phase: "ready",
      age: 180,
      created: [0, 1, 2, 3],
      defeated: [0, 1, 2, 3],
    };
    g.inventory.slots = Array.from({ length: 36 }, () => ({
      id: "stone",
      count: 64,
    }));
    g.inventory.selected = 0;
    Object.assign(g.player, {
      x: 0.5,
      y: 200,
      z: 3.5,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: 0,
      pitch: Math.atan2(-0.12, 3),
      flying: true,
      health: 20,
    });
    g.renderer.loadAround(0.5, 3.5, 2, 25);
    await g.audio.context.resume();
    await g.audio.pistolClaimFanfare.ready;
    const meter = g.audio.context.createAnalyser();
    meter.fftSize = 2048;
    g.audio.compressor.connect(meter);
    window.pistolClaimPeak = 0;
    window.pistolClaimRms = 0;
    window.pistolClaimProbe = setInterval(() => {
      const d = new Float32Array(2048);
      meter.getFloatTimeDomainData(d);
      let sum = 0;
      for (const v of d) {
        pistolClaimPeak = Math.max(pistolClaimPeak, Math.abs(v));
        sum += v * v;
      }
      pistolClaimRms = Math.sqrt(sum / d.length);
    }, 8);
    g.resume();
    g.pointerLockFallback = true;
  }, B);
  await page.mouse.move(640, 400);
  await page.evaluate(() => {
    dcsmcraft.player.yaw = 0;
    dcsmcraft.player.pitch = Math.atan2(-0.12, 3);
  });
  await page.waitForTimeout(150);
  expect(
    await page.evaluate(() => dcsmcraft.audio.pistolClaimFanfare.started),
  ).toBe(0);
  await page.mouse.click(640, 400, { button: "right" });
  expect(
    await page.evaluate(
      () => dcsmcraft.world.settlements["matthew-incursion"].phase,
    ),
  ).toBe("ready");
  expect(
    await page.evaluate(() => dcsmcraft.audio.pistolClaimFanfare.started),
  ).toBe(0);
  await page.evaluate(() => (dcsmcraft.inventory.slots[0] = null));
  await page.waitForTimeout(200);
  await page.mouse.click(640, 400, { button: "right" });
  await page.waitForFunction(
    () => dcsmcraft.audio.pistolClaimFanfare.started === 1,
  );
  const playing = await page.evaluate(() => ({
    phase: dcsmcraft.world.settlements["matthew-incursion"].phase,
    duration: dcsmcraft.audio.pistolClaimFanfare.source?.buffer.duration,
    channels:
      dcsmcraft.audio.pistolClaimFanfare.source?.buffer.numberOfChannels,
    loop: dcsmcraft.audio.pistolClaimFanfare.source?.loop,
    swords: dcsmcraft.audio.claimFanfare.started,
  }));
  expect(playing.phase).toBe("claimed");
  expect(playing.duration).toBeGreaterThan(1.8);
  expect(playing.duration).toBeLessThan(2.2);
  expect(playing.channels).toBe(2);
  expect(playing.loop).toBe(false);
  expect(playing.swords).toBe(0);
  await page.waitForFunction(() => pistolClaimPeak > 0.01);
  await page.evaluate(() => {
    dcsmcraft.settings.volume = 0;
    dcsmcraft.audio.updateVolume();
  });
  await expect
    .poll(() => page.evaluate(() => pistolClaimRms))
    .toBeLessThan(0.0001);
  await page.waitForFunction(() => !dcsmcraft.audio.pistolClaimFanfare.source);
  await page.mouse.click(640, 400, { button: "right" });
  expect(
    await page.evaluate(() => dcsmcraft.audio.pistolClaimFanfare.started),
  ).toBe(1);
  await page.evaluate(async () => {
    clearInterval(pistolClaimProbe);
    dcsmcraft.pause();
    await dcsmcraft.save();
  });
  await page.reload();
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.locator("[data-action=load]").first().click();
  await page.waitForFunction(() => dcsmcraft.active);
  expect(
    await page.evaluate(() => ({
      phase: dcsmcraft.world.settlements["matthew-incursion"].phase,
      starts: dcsmcraft.audio.pistolClaimFanfare.started,
      weapons: dcsmcraft.inventory.slots.filter(
        (s) => s?.id === "matthew_dual_pistols",
      ).length,
    })),
  ).toEqual({ phase: "claimed", starts: 0, weapons: 1 });
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
