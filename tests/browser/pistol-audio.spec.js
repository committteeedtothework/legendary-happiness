import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const html = readFileSync("dist/DCSMCRAFT-Standalone.html", "utf8");
test("standalone real pistol shots alternate original audio, remain bounded during a burst, clean up, and obey master mute", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() =>
    localStorage.setItem(
      "dcsmcraft-settings",
      JSON.stringify({
        renderDistance: 2,
        graphics: 1,
        ambientSounds: false,
        musicEnabled: false,
        mobSounds: false,
        volume: 0.65,
      }),
    ),
  );
  await page.route("**/*", (r) =>
    r.request().url().endsWith("/pistol-audio.html")
      ? r.fulfill({ contentType: "text/html", body: html })
      : r.abort(),
  );
  await page.goto("/pistol-audio.html");
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.locator("[data-action=create]").first().click();
  await page.locator("[name=seed]").fill("Wildflower");
  await page.locator("[name=mode][value=creative]").check();
  await page.locator("[data-action=start-world]").click();
  await page.waitForFunction(() => dcsmcraft.running);
  await page.evaluate(async () => {
    const g = dcsmcraft;
    g.pause();
    g.entities = [];
    g.inventory.slots[0] = { id: "matthew_dual_pistols", count: 1 };
    g.inventory.selected = 0;
    Object.assign(g.player, {
      y: 200,
      flying: true,
      pitch: 0,
      yaw: 0,
      matthewHand: 0,
    });
    const a = g.audio;
    await a.context.resume();
    a.silenceAmbient();
    a.music.silence();
    window.shotSounds = [];
    const sample = a.sample.bind(a);
    a.sample = (...args) => {
      if (args[0].startsWith("pistol_"))
        shotSounds.push({
          family: args[0],
          pan: args[4],
          hand: g.player.matthewHand,
        });
      return sample(...args);
    };
    const analyser = a.context.createAnalyser();
    analyser.fftSize = 2048;
    a.compressor.connect(analyser);
    window.soundMeter = { peak: 0 };
    const data = new Float32Array(2048);
    window.soundInterval = setInterval(() => {
      analyser.getFloatTimeDomainData(data);
      for (const x of data)
        soundMeter.peak = Math.max(soundMeter.peak, Math.abs(x));
    }, 8);
    g.ui.play();
    g.running = true;
    g.pointerLockFallback = true;
  });
  await page.waitForTimeout(500);
  await page.evaluate(() => (soundMeter.peak = 0));
  await page.mouse.move(640, 400);
  await page.mouse.down();
  await page.waitForTimeout(1400);
  await page.mouse.up();
  await page.waitForTimeout(700);
  const result = await page.evaluate(() => ({
    sounds: shotSounds,
    peak: soundMeter.peak,
    active: dcsmcraft.audio.active,
    buffers: ["pistol_black", "pistol_silver"].map(
      (k) => dcsmcraft.audio.bank[k].length,
    ),
  }));
  expect(result.sounds.length).toBeGreaterThanOrEqual(4);
  expect(result.sounds.length).toBeLessThanOrEqual(12);
  result.sounds.forEach((s, i) =>
    expect(s).toEqual({
      family: i % 2 ? "pistol_black" : "pistol_silver",
      pan: i % 2 ? -0.12 : 0.12,
      hand: i % 2 ? 0 : 1,
    }),
  );
  expect(result.peak).toBeGreaterThan(0.015);
  expect(result.peak).toBeLessThan(0.8);
  expect(result.active).toBe(0);
  expect(result.buffers).toEqual([4, 4]);
  await page.evaluate(() => {
    dcsmcraft.settings.volume = 0;
    dcsmcraft.audio.updateVolume();
  });
  await page.waitForTimeout(250);
  await page.evaluate(() => (soundMeter.peak = 0));
  await page.mouse.click(640, 400);
  await page.waitForTimeout(300);
  const muted = await page.evaluate(() => ({
    peak: soundMeter.peak,
    count: shotSounds.length,
  }));
  expect(muted.peak).toBeLessThan(0.0001);
  expect(muted.count).toBe(result.sounds.length);
  const rendered = await page.evaluate(async () => {
    const g = dcsmcraft,
      c = new OfflineAudioContext(2, 48000 * 3, 48000),
      a = new g.audio.constructor({ volume: 0.65 });
    a.context = c;
    a.bank = g.audio.bank;
    a.master = c.createGain();
    a.master.gain.value = 0.65;
    a.master.connect(c.destination);
    for (let i = 0; i < 12; i++)
      a.sample(
        i % 2 ? "pistol_black" : "pistol_silver",
        0.34,
        1,
        i * 0.2,
        i % 2 ? -0.12 : 0.12,
      );
    const b = await c.startRendering();
    let peak = 0,
      energy = 0,
      tail = 0;
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch);
      for (let i = 0; i < d.length; i++) {
        peak = Math.max(peak, Math.abs(d[i]));
        energy += d[i] * d[i];
        if (i > 48000 * 2.7) tail += d[i] * d[i];
      }
    }
    clearInterval(soundInterval);
    return {
      peak,
      rms: Math.sqrt(energy / (b.length * 2)),
      tail,
      active: a.active,
    };
  });
  expect(rendered.peak).toBeLessThan(0.5);
  expect(rendered.rms).toBeGreaterThan(0.01);
  expect(rendered.tail).toBe(0);
  expect(rendered.active).toBe(0);
  expect(
    await page.evaluate(() => dcsmcraft.renderer.gl.getContext().getError()),
  ).toBe(0);
  console.log(
    "pistol audio metrics",
    JSON.stringify({
      livePeak: result.peak,
      shots: result.sounds.length,
      mutedPeak: muted.peak,
      offline: rendered,
    }),
  );
  expect(errors).toEqual([]);
});
