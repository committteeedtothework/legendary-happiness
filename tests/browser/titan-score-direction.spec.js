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

test("local soundtrack selection, editable cues, prelude/checkpoint recovery and missing-file cleanup work in the actual standalone", async ({
  page,
}) => {
  test.setTimeout(240000);
  const evidence = await boot(page);
  await portal(page);
  await page.evaluate(() => {
    const g = dcsmcraft,
      e = g.giganto,
      s = e.session;
    e.liveFrame = e.frame;
    e.frame = () => {};
    g.running = false;
    g.audio.unlock();
    Object.assign(s.config, {
      masterVolume: 0.05,
      music: true,
      musicVolume: 0.45,
    });
    e.record.config = JSON.parse(JSON.stringify(s.config));
    s.stage = "traversal";
    e.audio.frame(s, true);
  });
  await page.waitForFunction(
    () => dcsmcraft.giganto.audio.prelude?.player.media?.readyState > 0,
  );
  const saved = await page.evaluate(async () => {
    const g = dcsmcraft,
      e = g.giganto;
    e.audio.prelude.player.media.currentTime = 41.5;
    e.audio.pause(e.session);
    await g.save();
    return { id: g.id, offset: e.session.preludeMusic.offset };
  });
  expect(saved.offset).toBeCloseTo(41.5, 1);
  await page.evaluate(async (id) => {
    await dcsmcraft.loadWorld(id);
    dcsmcraft.pause();
    dcsmcraft.giganto.audio.frame(dcsmcraft.giganto.session, true);
  }, saved.id);
  await page.waitForFunction(
    () => dcsmcraft.giganto.audio.prelude?.player.media?.currentTime >= 41.4,
  );
  const prelude = await page.evaluate(() => {
    const e = dcsmcraft.giganto;
    e.audio.pause(e.session);
    return e.audio.prelude.player.media.currentTime;
  });
  expect(prelude).toBeLessThan(44);
  await page.evaluate(() => dcsmcraft.giganto.menu());
  await page.locator(".titan-score-controls > summary").click();
  await page.locator("[data-titan-track]").setInputFiles({
    name: "Local battle.mp3",
    mimeType: "audio/mpeg",
    buffer: readFileSync("public/audio/giganto/titan-giganto.mp3"),
  });
  await page.waitForFunction(
    () => dcsmcraft.giganto.record.config.battleTrack?.name === "Local battle",
  );
  await page.waitForFunction(() => !!dcsmcraft.giganto.audio.score?.buffer);
  await page.waitForFunction(() => !dcsmcraft.giganto.importingTrack);
  const local = await page.evaluate(async () => {
    const e = dcsmcraft.giganto,
      s = e.session;
    s.stage = "combat";
    s.stageTime = 3;
    s.emerald = true;
    e.audio.frame(s, true);
    const id = s.config.battleTrack.id;
    const record = await e.audio.musicLibrary.library.get(id);
    return {
      id,
      duration: e.audio.score.buffer.duration,
      bytes: record.blob.size,
      track: e.audio.score.trackId,
      preludeReleased: !e.audio.prelude.player.media,
    };
  });
  expect(local.track).toBe(local.id);
  expect(local.bytes).toBe(4093287);
  expect(local.duration).toBeGreaterThan(240);
  expect(local.preludeReleased).toBe(true);
  await page.evaluate(async () => {
    const g = dcsmcraft,
      e = g.giganto;
    e.audio.pause(e.session);
    await g.save();
    await g.loadWorld(g.id);
    g.pause();
    e.audio.frame(e.session, true);
  });
  await page.waitForFunction(() => !!dcsmcraft.giganto.audio.score?.buffer);
  const restored = await page.evaluate(() => {
    const e = dcsmcraft.giganto;
    e.audio.frame(e.session, true);
    const q = {
      track: e.audio.score.trackId,
      offset: e.audio.score.current.offset,
    };
    e.audio.pause(e.session);
    return q;
  });
  expect(restored.track).toBe(local.id);
  expect(restored.offset).toBeGreaterThanOrEqual(3);
  expect(restored.offset).toBeLessThan(8);
  await page.evaluate(() => dcsmcraft.giganto.menu());
  await page.locator(".titan-score-controls > summary").click();
  await page.locator(".titan-score-controls details > summary").click();
  await page.locator('[data-titan-cue="phaseOne.loopEnd"]').fill("900");
  await page.locator('[data-titan="apply-cues"]').click();
  expect(
    await page.evaluate(() => dcsmcraft.giganto.session.config.scoreCues),
  ).toBe(null);
  for (const [path, value] of Object.entries({
    "phaseOne.start": 0,
    "phaseOne.loopStart": 1,
    "phaseOne.loopEnd": 8,
    "phaseTwo.start": 6,
    "phaseTwo.loopStart": 4,
    "phaseTwo.loopEnd": 10,
    "finale.start": 2,
  }))
    await page.locator('[data-titan-cue="' + path + '"]').fill(String(value));
  await page.locator('[data-titan="apply-cues"]').click();
  const cues = await page.evaluate(
    () => dcsmcraft.giganto.session.config.scoreCues,
  );
  expect(cues.phaseOne.loopEnd).toBe(8);
  expect(cues.transition.start).toBe(6);
  await page.locator(".titan-score-controls > summary").click();
  await page.locator(".titan-score-controls details > summary").click();
  await page.locator(".titan-score-controls").scrollIntoViewIfNeeded();
  await page.screenshot({ path: out + "/music-settings.png" });
  const missing = await page.evaluate(async () => {
    const e = dcsmcraft.giganto,
      s = e.session;
    s.config.battleTrack = {
      id: "titan:missing-local",
      name: "Missing",
      duration: 245,
    };
    e.record.config = JSON.parse(JSON.stringify(s.config));
    e.audio.prepare(s);
    await e.audio.score.ready;
    e.audio.frame(s, false);
    return {
      failed: e.audio.score.failed,
      error: e.audio.score.error,
      current: !!e.audio.score.current,
    };
  });
  expect(missing.failed).toBe(true);
  expect(missing.error).toContain("missing");
  expect(missing.current).toBe(false);
  await page.evaluate(() => dcsmcraft.giganto.menu());
  await page.locator(".titan-score-controls > summary").click();
  await page.locator('[data-titan="reset-track"]').click();
  await page.locator(".titan-score-controls > summary").click();
  await page.locator(".titan-score-controls details > summary").click();
  await page.locator('[data-titan="reset-cues"]').click();
  await page.waitForFunction(() => !!dcsmcraft.giganto.audio.score?.buffer);
  const result = await page.evaluate(async () => {
    const e = dcsmcraft.giganto;
    const q = {
      track: e.audio.score.trackId,
      finale: e.audio.score.cues.finale.start,
    };
    await e.exit(false);
    e.frame = e.liveFrame;
    return {
      ...q,
      active: e.active,
      score: e.audio.score,
      prelude: e.audio.prelude,
    };
  });
  expect(result.track).toBe("supplied");
  expect(result.finale).toBe(237);
  expect(result.active).toBe(false);
  expect(result.score).toBe(null);
  expect(result.prelude).toBe(null);
  expect(evidence.errors).toEqual([]);
  expect(evidence.external).toEqual([]);
  writeFileSync(
    out + "/score-direction-report.json",
    JSON.stringify(
      {
        htmlSHA256: createHash("sha256").update(html).digest("hex"),
        prelude,
        local,
        restored,
        cues,
        missing,
        result,
        errors: evidence.errors,
      },
      null,
      2,
    ),
  );
});
