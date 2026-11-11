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

test("High arena graphics, textured rupture, full-body explosion and the frozen night aftermath render without shader errors", async ({
  page,
}) => {
  test.setTimeout(360000);
  const ev = await boot(page);
  await portal(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  const shots = [];
  for (const [name, t] of [
    ["combat", -1],
    ["chest", 4.85],
    ["burst", 5.52],
    ["shattering", 5.95],
    ["cleared", 6.6],
  ]) {
    const result = await page.evaluate(
      ({ name, t }) => {
        const g = dcsmcraft,
          e = g.giganto,
          s = e.session,
          v = e.view;
        g.running = false;
        e.controls.clear();
        Object.assign(s.config, {
          graphicsQuality: "high",
          shadowQuality: "high",
          ambientOcclusion: "high",
          postProcessing: true,
          antialiasing: true,
          dynamicSky: false,
          arenaWeather: "clear",
          music: false,
          audio: false,
          renderScale: 1,
        });
        Object.assign(s, {
          stage: t < 0 ? "combat" : "finale",
          stageTime: Math.max(0, t - 1 / 60),
          time: 35,
          emerald: true,
          won: false,
          idle: 999,
          attack: "idle",
          qte: null,
          counterScene: null,
          cinematicFrom: { x: -12, y: 64, z: 60 },
        });
        delete s.defeatSky;
        Object.assign(s.avatar, {
          x: -12,
          y: 64,
          z: 60,
          vx: 0,
          vy: 0,
          vz: 0,
          yaw: 0,
          pitch: 0.1,
        });
        g.renderer.gl.setPixelRatio(1);
        g.renderer.gl.setSize(1280, 720, false);
        v.camReady = false;
        if (t >= 0) {
          g.running = true;
          e.frame(1 / 60);
          g.running = false;
        }
        v.draw(s, 0.3);
        for (let i = 0; i < 2; i++) v.draw(s, 1 / 30);
        e.updateHUD();
        g.renderer.gl.getContext().finish();
        return {
          name,
          visible: v.boss.visible,
          rupture: v.finale.uniforms.rupture.value,
          plates: v.detonation.plates.count,
          smoke: v.detonation.smoke.count,
          aa: v.smaa.enabled,
          shadow: v.light.shadow.map.width,
          texture: v.arena.userData.textures.find(
            (t) => t.userData.titanSurface === "rock",
          ).image.width,
        };
      },
      { name, t },
    );
    if (name === "combat") {
      await page.waitForTimeout(150);
      result.aaChangesPixels = await page.evaluate(() => {
        const g = dcsmcraft,
          e = g.giganto,
          s = e.session,
          v = e.view,
          gl = g.renderer.gl;
        s.config.antialiasing = false;
        v.draw(s, 0);
        gl.getContext().finish();
        const off = gl.domElement.toDataURL();
        s.config.antialiasing = true;
        v.draw(s, 0);
        gl.getContext().finish();
        return off !== gl.domElement.toDataURL();
      });
      expect(result.aaChangesPixels).toBe(true);
    }
    shots.push(result);
    await page.screenshot({ path: out + "/" + name + ".png" });
  }
  expect(shots[0]).toMatchObject({ aa: true, shadow: 4096, texture: 1024 });
  expect(shots.find((x) => x.name === "shattering").plates).toBe(256);
  expect(shots.find((x) => x.name === "cleared").visible).toBe(false);
  const night = await page.evaluate(() => {
    const g = dcsmcraft,
      e = g.giganto,
      s = e.session,
      v = e.view;
    Object.assign(s, {
      stage: "finale",
      stageTime: 7 - 1 / 60,
      time: 140,
      phase: 2,
      phaseStartedAt: 120,
      won: false,
      attack: "idle",
      qte: null,
      counterScene: null,
    });
    delete s.defeatSky;
    Object.assign(s.config, {
      dynamicSky: true,
      arenaWeather: "storm",
      arenaDayLength: 240,
    });
    g.running = true;
    e.frame(1 / 60);
    g.running = false;
    v.draw(s, 0);
    const first = structuredClone(v.atmosphere.state);
    s.time += 300;
    s.stageTime += 300;
    s.returnPortal.age += 300;
    v.draw(s, 0);
    e.updateHUD();
    return {
      first,
      after: structuredClone(v.atmosphere.state),
      saved: s.defeatSky,
      body: v.boss.visible,
    };
  });
  expect(night.after).toEqual(night.first);
  expect(night.first.day).toBeLessThan(0.1);
  expect(night.first.weather).toBe(1);
  expect(night.body).toBe(false);
  await page.screenshot({ path: out + "/night-aftermath.png" });
  expect(ev.errors).toEqual([]);
  expect(ev.external).toEqual([]);
  writeFileSync(
    out + "/ending-render-report.json",
    JSON.stringify(
      {
        htmlSHA256: createHash("sha256").update(html).digest("hex"),
        shots,
        night,
        errors: ev.errors,
      },
      null,
      2,
    ),
  );
});
test("real supplied victory passage continues after the cutscene, pauses mid-release and ends without replay", async ({
  page,
}) => {
  test.setTimeout(180000);
  const ev = await boot(page);
  await portal(page);
  await page.evaluate(async () => {
    const g = dcsmcraft,
      e = g.giganto,
      s = e.session;
    g.running = false;
    e.controls.clear();
    Object.assign(s, {
      stage: "finale",
      stageTime: 4,
      emerald: true,
      won: false,
      attack: "idle",
      qte: null,
      counterScene: null,
      cinematicFrom: { ...s.avatar },
    });
    Object.assign(s.config, {
      music: true,
      audio: true,
      masterVolume: 0.2,
      musicVolume: 0.6,
      effectsVolume: 0.2,
      graphicsQuality: "low",
      shadowQuality: "off",
      postProcessing: false,
    });
    await g.audio.unlock();
    e.audio.frame(s, true);
    await e.audio.score.prepare();
    const score = e.audio.score;
    score.stop();
    const ctx = g.audio.context,
      tap = ctx.createGain(),
      analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    tap.connect(e.audio.master);
    tap.connect(analyser);
    score.output = tap;
    window.musicProbe = {
      tap,
      analyser,
      pcm: new Float32Array(2048),
      samples: [],
      draw: e.view.draw,
    };
    e.view.draw = () => {};
    g.ui.play();
    g.running = true;
    e.audio.frame(s, true);
    window.probeTimer = setInterval(() => {
      const p = window.musicProbe;
      p.analyser.getFloatTimeDomainData(p.pcm);
      p.samples.push({
        stage: e.session.stage,
        t: e.session.stageTime,
        rms: Math.sqrt(p.pcm.reduce((n, v) => n + v * v, 0) / p.pcm.length),
        gain: score.current?.gain.gain.value ?? 0,
        offset: e.session.battleMusic?.offset,
        source: score.current?.offset,
        state: score.state,
        liveScore: e.audio.score === score,
        context: ctx.state,
      });
    }, 40);
  });
  await page.waitForFunction(
    () =>
      dcsmcraft.giganto.session.stage === "victory" &&
      dcsmcraft.giganto.session.stageTime > 19.7,
    null,
    { timeout: 45000 },
  );
  await page.keyboard.press("Escape");
  const pause = await page.evaluate(() => ({
    time: dcsmcraft.giganto.session.stageTime,
    offset: dcsmcraft.giganto.session.battleMusic.offset,
  }));
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => dcsmcraft.giganto.session.stageTime)).toBe(
    pause.time,
  );
  await page.locator("[data-titan=resume]").click();
  await page.waitForFunction(
    () => dcsmcraft.giganto.audio.score.state === "ended",
  );
  await page.waitForTimeout(180);
  const report = await page.evaluate(() => {
    clearInterval(window.probeTimer);
    const g = dcsmcraft,
      e = g.giganto,
      p = window.musicProbe;
    g.running = false;
    e.view.draw = p.draw;
    e.view.draw(e.session, 0);
    p.tap.disconnect();
    p.analyser.disconnect();
    return {
      samples: p.samples,
      starts: e.audio.score.starts,
      state: e.audio.score.state,
      voices: e.audio.score.voices.size,
      stage: e.session.stage,
    };
  });
  writeFileSync(
    out + "/ending-audio-report.json",
    JSON.stringify({ pause, ...report }, null, 2),
  );
  const early = report.samples.filter(
      (x) => x.stage === "victory" && x.t > 1 && x.t < 5,
    ),
    late = report.samples.filter((x) => x.stage === "victory" && x.t > 20.7);
  expect(early.length).toBeGreaterThan(2);
  expect(late.length).toBeGreaterThan(1);
  const max = (a) => Math.max(...a.map((x) => x.rms));
  expect(max(early)).toBeGreaterThan(0.0001);
  expect(max(late)).toBeLessThan(max(early) * 0.15);
  // The supplied recording has trailing silence; verify the actual native gain
  // envelope independently rather than requiring invented audio in that tail.
  expect(Math.max(...late.map((x) => x.gain))).toBeLessThan(
    Math.max(...early.map((x) => x.gain)) * 0.15,
  );
  expect(report.voices).toBe(0);
  expect(report.stage).toBe("victory");
  expect(report.state).toBe("ended");
  expect(report.starts).toBe(2);
  expect(ev.errors).toEqual([]);
  expect(ev.external).toEqual([]);
  writeFileSync(
    out + "/ending-audio-report.json",
    JSON.stringify({ pause, ...report }, null, 2),
  );
});
