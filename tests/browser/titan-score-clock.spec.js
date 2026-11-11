import { createHash } from "node:crypto";
import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
const html = readFileSync("dist/DCSMCRAFT-Standalone.html"),
  out = process.env.DCSMCRAFT_SCORE_ARTIFACTS || "test-results/score-direction";
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

test("audio-driven protected movies retain the chorus through a real frame hitch and emit finishing contacts once", async ({
  page,
}) => {
  test.setTimeout(150000);
  const evidence = await boot(page);
  await portal(page);
  await page.evaluate(() => {
    const g = dcsmcraft,
      e = g.giganto,
      s = e.session;
    g.running = false;
    g.ui.play();
    g.audio.unlock();
    e.baseFrame = e.frame;
    e.frame = () => {};
    e.controls.clear();
    Object.assign(s.config, {
      masterVolume: 0.02,
      graphicsQuality: "low",
      sceneryDetail: "off",
      shadowQuality: "off",
      postProcessing: false,
      particles: false,
      music: true,
      musicVolume: 0.45,
      drain: 0,
    });
    Object.assign(s, {
      stage: "phase",
      phase: 2,
      stageTime: 0,
      emerald: true,
      attack: "idle",
      qte: null,
      counterScene: null,
    });
    e.audio.frame(s, false);
  });
  await page.waitForFunction(() => !!dcsmcraft.giganto.audio.score?.buffer);
  await page.evaluate(() => {
    const g = dcsmcraft,
      e = g.giganto,
      s = e.session;
    window.clockSamples = [];
    window.cueContacts = [];
    window.voiceEvents = [];
    const score = e.audio.score,
      originalUpdate = score.update;
    score.update = function (s, playing, settings) {
      const before = {
        starts: this.starts,
        stage: s.stage,
        time: s.stageTime,
        lastStage: this.lastStage,
        lastTime: this.lastStageTime,
        section: this.current?.section,
        sourceOffset: this.current?.offset,
        when: this.current?.when,
        now: this.context.currentTime,
        playing,
      };
      const result = originalUpdate.call(this, s, playing, settings);
      if (this.starts !== before.starts)
        voiceEvents.push({
          ...before,
          after: this.current?.section,
          offset: this.current?.offset,
        });
      return result;
    };
    e.baseEvent = e.audio.event;
    e.audio.event = function (v) {
      const a = this.score;
      if (v.type === "cinematic-cue" && a?.current?.section === "finale")
        cueContacts.push({
          cue: v.cue,
          id: v.eventId,
          age: v.age || 0,
          time:
            a.current.offset +
            Math.max(0, a.context.currentTime - a.current.when) -
            a.cues.finale.start,
        });
      return e.baseEvent.call(this, v);
    };
    e.frame = function (dt) {
      const audioBefore = this.audio.score?.context.currentTime || 0;
      e.baseFrame.call(this, dt);
      const a = this.audio.score,
        s = this.session;
      if (s?.stage === "phase" && a?.current?.section === "transition") {
        const clock =
          a.current.offset +
          Math.max(0, a.context.currentTime - a.current.when) -
          a.cues.transition.start;
        clockSamples.push({
          time: s.stageTime,
          clock,
          error: s.stageTime - clock,
          renderElapsed: Math.max(0, a.context.currentTime - audioBefore),
        });
      }
    };
    e.audio.frame(s, true);
    g.running = true;
  });
  await page.waitForFunction(
    () =>
      dcsmcraft.giganto.session.stage === "phase" &&
      dcsmcraft.giganto.session.stageTime > 3.7,
  );
  const hitch = await page.evaluate(() => {
    const e = dcsmcraft.giganto,
      start = performance.now(),
      before = e.session.stageTime;
    while (performance.now() - start < 350) {}
    return { before, blockedMs: performance.now() - start };
  });
  await page.waitForFunction(
    () => dcsmcraft.giganto.session.stage === "combat",
  );
  const phase = await page.evaluate(() => {
    const g = dcsmcraft,
      e = g.giganto,
      a = e.audio.score;
    g.running = false;
    e.audio.pause(e.session);
    return {
      starts: a.starts,
      samples: clockSamples.length,
      covered: clockSamples.at(-1).clock - clockSamples[0].clock,
      maxLead: Math.max(...clockSamples.map((v) => v.error)),
      maxError: Math.max(...clockSamples.map((v) => Math.abs(v.error))),
      maxDrift: Math.max(
        ...clockSamples.map((v) =>
          Math.max(0, Math.abs(v.error) - v.renderElapsed),
        ),
      ),
      maxRenderElapsed: Math.max(...clockSamples.map((v) => v.renderElapsed)),
      section: a.plan.section,
      position: e.session.battleMusic.offset,
      voiceEvents,
    };
  });
  writeFileSync(
    out + "/clock-interim.json",
    JSON.stringify({ hitch, phase }, null, 2),
  );
  expect(phase.starts).toBe(1);
  // Coverage is measured on the audio clock, not a host-dependent render FPS.
  expect(phase.samples).toBeGreaterThan(5);
  expect(phase.covered).toBeGreaterThan(3);
  expect(phase.maxLead).toBeLessThan(0.04);
  // A software GPU can block the main thread while audio continues.
  // Reject transport drift beyond that measured frame cost, not GPU latency.
  expect(phase.maxDrift).toBeLessThan(0.04);
  expect(phase.section).toBe("phaseTwo");
  await page.evaluate(() => {
    const g = dcsmcraft,
      e = g.giganto,
      s = e.session;
    Object.assign(s, {
      stage: "finale",
      stageTime: 0,
      finaleCues: 0,
      won: false,
      cinematicFrom: { ...s.avatar },
    });
    e.audio.frame(s, true);
    g.running = true;
  });
  await page.waitForFunction(
    () => dcsmcraft.giganto.session.stage === "victory",
    null,
    { timeout: 15000 },
  );
  const finale = await page.evaluate(async () => {
    const e = dcsmcraft.giganto,
      contacts = [...cueContacts],
      stopped = e.audio.score.current === null;
    e.frame = e.baseFrame;
    e.audio.event = e.baseEvent;
    e.session.returnPortal.crossed = true;
    e.session.returnPortal.fade = 0.45;
    await e.exit();
    return { contacts, stopped, active: e.active, score: e.audio.score };
  });
  expect(finale.contacts.map((v) => v.cue)).toEqual([
    "charge",
    "launch",
    "contact",
    "rupture",
    "detonate",
  ]);
  expect(new Set(finale.contacts.map((v) => v.id)).size).toBe(5);
  for (const [i, at] of [0.35, 1.9, 3.6, 4.8, 5.45].entries())
    expect(
      Math.abs(finale.contacts[i].time - finale.contacts[i].age - at),
    ).toBeLessThan(0.04);
  expect(finale.stopped).toBe(false);
  expect(finale.active).toBe(false);
  expect(finale.score).toBe(null);
  expect(evidence.errors).toEqual([]);
  expect(evidence.external).toEqual([]);
  writeFileSync(
    out + "/clock-report.json",
    JSON.stringify(
      {
        htmlSHA256: createHash("sha256").update(html).digest("hex"),
        hitch,
        phase,
        finale,
        errors: evidence.errors,
      },
      null,
      2,
    ),
  );
});
