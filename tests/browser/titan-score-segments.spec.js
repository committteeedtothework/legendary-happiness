import { createHash } from "node:crypto";
import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
const html = readFileSync("dist/DCSMCRAFT-Standalone.html"),
  out = process.env.DCSMCRAFT_DETONATION_ARTIFACTS || "test-results/detonation";
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

test("native Undefeatable transport loops 0–120 and 121–EOF, switches immediately, pauses and retries without stale voices", async ({
  page,
}) => {
  test.setTimeout(150000);
  const ev = await boot(page);
  await portal(page);
  const initial = await page.evaluate(async () => {
    const g = dcsmcraft,
      e = g.giganto,
      s = e.session;
    g.running = false;
    window.nativeSegmentFrame = e.frame;
    e.frame = () => {};
    Object.assign(s, {
      stage: "combat",
      stageTime: 0,
      phase: 1,
      emerald: true,
    });
    Object.assign(s.config, {
      music: true,
      audio: true,
      masterVolume: 0.2,
      musicVolume: 0.6,
      effectsVolume: 0,
    });
    await g.audio.unlock();
    const score = e.audio.prepare(s);
    await score.prepare();
    const tap = g.audio.context.createGain(),
      analyser = g.audio.context.createAnalyser();
    analyser.fftSize = 2048;
    tap.connect(e.audio.master);
    tap.connect(analyser);
    score.output = tap;
    window.segmentProbe = { tap, analyser, pcm: new Float32Array(2048) };
    e.audio.frame(s, true);
    window.musicState = () => {
      const q = dcsmcraft.giganto.audio.score;
      q.snapshot(dcsmcraft.giganto.session);
      const p = window.segmentProbe;
      p.analyser.getFloatTimeDomainData(p.pcm);
      return {
        offset: dcsmcraft.giganto.session.battleMusic?.offset,
        sourceOffset: q.current?.offset,
        loop: q.current?.source.loop,
        loopStart: q.current?.source.loopStart,
        loopEnd: q.current?.source.loopEnd,
        duration: q.buffer.duration,
        starts: q.starts,
        section: q.current?.section,
        rms: Math.sqrt(p.pcm.reduce((n, v) => n + v * v, 0) / p.pcm.length),
      };
    };
    window.restoreCursor = (offset) => {
      const q = e.audio.score;
      q.stop();
      q.session = null;
      s.battleMusic = {
        section: s.phase === 1 ? "phaseOne" : "phaseTwo",
        track: "supplied",
        offset,
      };
      e.audio.frame(s, true);
    };
    return window.musicState();
  });
  expect(initial.sourceOffset).toBe(0);
  expect(initial.loopStart).toBe(0);
  expect(initial.loopEnd).toBe(120);
  expect(initial.loop).toBe(true);
  await page.evaluate(() => window.restoreCursor(119.8));
  await page.waitForTimeout(500);
  const loop1 = await page.evaluate(() => window.musicState());
  expect(loop1.offset).toBeGreaterThan(0.1);
  expect(loop1.offset).toBeLessThan(1.5);
  // This recording opens with silence; wrapping must retain those original bytes.
  const phase = await page.evaluate(() => {
    const e = dcsmcraft.giganto,
      s = e.session;
    Object.assign(s, { stage: "phase", phase: 2, stageTime: 0 });
    e.audio.frame(s, true);
    return window.musicState();
  });
  expect(phase.sourceOffset).toBe(121);
  expect(phase.section).toBe("transition");
  await page.waitForTimeout(150);
  const joined = await page.evaluate(() => {
    const e = dcsmcraft.giganto,
      s = e.session;
    Object.assign(s, { stage: "combat", stageTime: 0 });
    e.audio.frame(s, true);
    return window.musicState();
  });
  expect(joined.starts).toBe(phase.starts);
  expect(joined.rms).toBeGreaterThan(0.0001);
  expect(joined.offset).toBeGreaterThan(121.1);
  expect(joined.loopStart).toBe(121);
  expect(joined.loopEnd).toBe(joined.duration);
  await page.evaluate(() =>
    window.restoreCursor(dcsmcraft.giganto.audio.score.buffer.duration - 0.2),
  );
  await page.waitForTimeout(500);
  const loop2 = await page.evaluate(() => window.musicState());
  expect(loop2.offset).toBeGreaterThan(121.1);
  expect(loop2.offset).toBeLessThan(122.5);
  expect(loop2.rms).toBeGreaterThan(0.0001);
  const paused = await page.evaluate(() => {
    const e = dcsmcraft.giganto;
    e.audio.frame(e.session, false);
    return window.musicState();
  });
  await page.waitForTimeout(250);
  const resume = await page.evaluate(() => {
    const e = dcsmcraft.giganto;
    e.audio.frame(e.session, true);
    return window.musicState();
  });
  expect(resume.sourceOffset).toBeCloseTo(paused.offset, 5);
  const retry = await page.evaluate(() => {
    const e = dcsmcraft.giganto,
      s = e.session;
    s.attempt = (s.attempt || 0) + 1;
    s.stageTime = 0;
    e.audio.frame(s, true);
    return window.musicState();
  });
  expect(retry.sourceOffset).toBe(121);
  const returned = await page.evaluate(async () => {
    const e = dcsmcraft.giganto,
      q = e.audio.score;
    e.frame = window.nativeSegmentFrame;
    await e.exit(false);
    dcsmcraft.pause();
    return { active: e.active, disposed: q.disposed, voices: q.voices.size };
  });
  expect(returned).toEqual({ active: false, disposed: true, voices: 0 });
  expect(ev.errors).toEqual([]);
  expect(ev.external).toEqual([]);
  writeFileSync(
    out + "/segment-report.json",
    JSON.stringify(
      {
        htmlSHA256: createHash("sha256").update(html).digest("hex"),
        initial,
        loop1,
        phase,
        joined,
        loop2,
        paused,
        resume,
        retry,
        returned,
        errors: ev.errors,
      },
      null,
      2,
    ),
  );
});
