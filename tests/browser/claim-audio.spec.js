import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import { World } from "../../src/world.js";
import { relicSite } from "../../src/relic.js";
const html = readFileSync("dist/DCSMCRAFT-Standalone.html", "utf8");
const site = relicSite(new World("Wildflower"));

test("offline Devin Sword claim plays the actual supplied MP3 once after a full real extraction, obeys master mute and never replays on reload", async ({
  page,
}) => {
  test.setTimeout(120000);
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
        volume: 0.4,
        musicEnabled: false,
        ambientSounds: false,
        mobSounds: false,
        distantTerrain: false,
        frameLimit: 30,
      }),
    ),
  );
  await page.route("**/*", (r) =>
    r.request().url().endsWith("/claim-audio.html")
      ? r.fulfill({ contentType: "text/html", body: html })
      : (external.push(r.request().url()), r.abort()),
  );
  await page.goto("/claim-audio.html");
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.locator("[data-action=create]").click();
  await page.locator("[name=seed]").fill("Wildflower");
  await page.locator("[name=mode][value=creative]").check();
  await page.locator("[data-action=start-world]").click();
  await page.waitForFunction(() => dcsmcraft.running);
  await page.evaluate(async (s) => {
    const g = dcsmcraft;
    g.pause();
    g.entities = [];
    g.inventory.slots.fill(null);
    g.world.settlements["devin-temple"] = {
      created: [0, 1, 2],
      defeated: [0, 1, 2],
      attuned: true,
    };
    Object.assign(g.player, {
      x: s.x + 0.5,
      y: s.y + 1,
      z: s.z + 2.8,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: 0,
      pitch: Math.atan2(-1.12, 2.3),
      flying: true,
      health: 20,
    });
    g.renderer.loadAround(g.player.x, g.player.z, 2, 25);
    await g.audio.context.resume();
    await g.audio.claimFanfare.ready;
    window.claimMeter = g.audio.context.createAnalyser();
    claimMeter.fftSize = 2048;
    g.audio.compressor.connect(claimMeter);
    window.claimPeak = 0;
    window.claimRms = 0;
    window.claimProbe = setInterval(() => {
      const d = new Float32Array(2048);
      claimMeter.getFloatTimeDomainData(d);
      let sum = 0;
      for (const v of d) {
        claimPeak = Math.max(claimPeak, Math.abs(v));
        sum += v * v;
      }
      claimRms = Math.sqrt(sum / d.length);
    }, 8);
    g.resume();
    g.pointerLockFallback = true;
  }, site);
  expect(await page.evaluate(() => dcsmcraft.audio.claimFanfare.started)).toBe(
    0,
  );
  await page.mouse.move(640, 400);
  await page.evaluate(() => {
    dcsmcraft.player.yaw = 0;
    dcsmcraft.player.pitch = Math.atan2(-1.12, 2.3);
  });
  await page.waitForTimeout(100);
  await page.mouse.down();
  await page.waitForFunction(() => dcsmcraft.extraction?.progress > 0.05);
  expect(await page.evaluate(() => dcsmcraft.audio.claimFanfare.started)).toBe(
    0,
  );
  await page.waitForFunction(
    () =>
      dcsmcraft.world.relicClaimed &&
      dcsmcraft.audio.claimFanfare.started === 1,
    {},
    { timeout: 40000 },
  );
  await page.mouse.up();
  const sound = await page.evaluate(() => ({
    duration: dcsmcraft.audio.claimFanfare.source.buffer.duration,
    channels: dcsmcraft.audio.claimFanfare.source.buffer.numberOfChannels,
    loop: dcsmcraft.audio.claimFanfare.source.loop,
    swords: dcsmcraft.inventory.slots.filter((s) => s?.id === "devin_sword")
      .length,
    started: dcsmcraft.audio.claimFanfare.started,
  }));
  expect(sound.duration).toBeGreaterThan(5);
  expect(sound.duration).toBeLessThan(6);
  expect(sound.channels).toBe(2);
  expect(sound.loop).toBe(false);
  expect(sound.swords).toBe(1);
  await page.waitForFunction(() => claimPeak > 0.01);
  await page.evaluate(() => {
    dcsmcraft.settings.volume = 0;
    dcsmcraft.audio.updateVolume();
  });
  await expect.poll(() => page.evaluate(() => claimRms)).toBeLessThan(0.0001);
  await page.waitForFunction(
    () => !dcsmcraft.audio.claimFanfare.source,
    {},
    { timeout: 8000 },
  );
  expect(await page.evaluate(() => dcsmcraft.audio.claimFanfare.started)).toBe(
    1,
  );
  mkdirSync("/workspace/artifacts/claim-audio-playtest", { recursive: true });
  await page.screenshot({
    path: "/workspace/artifacts/claim-audio-playtest/claimed.png",
  });
  await page.evaluate(async () => {
    clearInterval(claimProbe);
    dcsmcraft.pause();
    await dcsmcraft.save();
  });
  await page.reload();
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.locator("[data-action=load]").first().click();
  await page.waitForFunction(() => dcsmcraft.active);
  expect(
    await page.evaluate(() => ({
      claimed: dcsmcraft.world.relicClaimed,
      starts: dcsmcraft.audio.claimFanfare.started,
      swords: dcsmcraft.inventory.slots.filter((s) => s?.id === "devin_sword")
        .length,
    })),
  ).toEqual({ claimed: true, starts: 0, swords: 1 });
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
