import { createServer } from "node:http";
import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import { B } from "../../src/data.js";
import { MENU_CUES } from "../../src/menu-audio.js";
const html = readFileSync("dist/DCSMCRAFT-Standalone.html");
let server, origin;
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
const out =
  process.env.DCSMCRAFT_PERFORMANCE_ARTIFACTS ||
  "/workspace/artifacts/performance-menu-playtest";
mkdirSync(out, { recursive: true });
async function boot(page) {
  const errors = [],
    external = [];
  page.on("pageerror", (e) => errors.push(e.stack || e.message));
  page.on("console", (m) => {
    if (/Shader Error|GL_INVALID|WebGLProgram/.test(m.text()))
      errors.push(m.text());
  });
  await page.addInitScript(() => {
    if (!localStorage.getItem("dcsmcraft-settings"))
      localStorage.setItem(
        "dcsmcraft-settings",
        JSON.stringify({
          graphics: 1,
          renderDistance: 2,
          distantTerrain: false,
          volume: 0.5,
          musicEnabled: false,
          ambientSounds: false,
          mobSounds: false,
          frameLimit: 30,
        }),
      );
  });
  await page.route("**/*", (r) =>
    r
      .request()
      .url()
      .startsWith(origin + "/")
      ? r.continue()
      : (external.push(r.request().url()), r.abort()),
  );
  await page.goto(origin + "/performance-menu.html");
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.locator("[data-action=create]").click();
  await page.locator("[name=mode][value=creative]").check();
  await page.locator("[name=seed]").fill("Performance controls");
  await page.locator("[data-action=start-world]").click();
  await page.waitForFunction(() => dcsmcraft.active);
  await page.evaluate(() => dcsmcraft.pause());
  return { errors, external };
}
async function video(page) {
  await page.getByRole("button", { name: "Options...", exact: true }).click();
  await page
    .getByRole("button", { name: "Video Settings...", exact: true })
    .click();
}
test("offline graphics presets and advanced options apply immediately, preserve controls/worlds, avoid redundant resizing and persist through reload", async ({
  page,
}) => {
  test.setTimeout(150000);
  const r = await boot(page);
  await video(page);
  const original = await page.evaluate(() => {
    const g = dcsmcraft;
    return {
      seed: g.world.seed,
      gen: g.world.generationVersion,
      edits: JSON.stringify(g.world.exportEdits()),
      inventory: JSON.stringify(g.inventory.export()),
      FOV: g.settings.FOV,
      sensitivity: g.settings.sensitivity,
      volume: g.settings.volume,
      skin: g.settings.skin,
    };
  });
  for (const [name, level] of [
    ["Fast", 1],
    ["Detailed", 4],
    ["Balanced", 3],
  ]) {
    await page.getByRole("button", { name, exact: true }).click();
    expect(await page.evaluate(() => dcsmcraft.settings.graphics)).toBe(level);
    const state = await page.evaluate(() => ({
      FOV: dcsmcraft.settings.FOV,
      sensitivity: dcsmcraft.settings.sensitivity,
      volume: dcsmcraft.settings.volume,
      skin: dcsmcraft.settings.skin,
    }));
    expect(state).toEqual({
      FOV: original.FOV,
      sensitivity: original.sensitivity,
      volume: original.volume,
      skin: original.skin,
    });
  }
  await page.locator("[data-preference=shadowResolution]").selectOption("512");
  await page.locator("[data-preference=shadowDistance]").selectOption("32");
  await page.locator("[data-preference=shadowFilter]").selectOption("hard");
  await page.locator("[data-graphics=shadows]").click();
  await page.waitForFunction(
    () => dcsmcraft.renderer.sun.shadow.map?.width === 512,
  );
  expect(
    await page.evaluate(() => ({
      span:
        dcsmcraft.renderer.sun.shadow.camera.right -
        dcsmcraft.renderer.sun.shadow.camera.left,
      type: dcsmcraft.renderer.gl.shadowMap.type,
    })),
  ).toEqual({ span: 32, type: 0 });
  await page.locator("[data-graphics=shadows]").click();
  expect(
    await page.evaluate(() => dcsmcraft.renderer.sun.shadow.map === null),
  ).toBe(true);
  await page.locator("[data-preference=anisotropy]").selectOption("2");
  await page.locator("[data-preference=maxPixelRatio]").selectOption("1");
  await page.locator("[data-preference=localLightCount]").selectOption("0");
  await page.locator("[data-preference=distantDetail]").selectOption("8");
  await page.locator("[data-preference=menuFrameLimit]").selectOption("15");
  expect(
    await page.evaluate(() =>
      dcsmcraft.renderer.localLights.every((l) => !l.visible),
    ),
  ).toBe(true);
  expect(
    await page.evaluate(() => dcsmcraft.renderer.appliedDistantDetail),
  ).toBe(8);
  await page.evaluate(() => {
    const gl = dcsmcraft.renderer.gl,
      old = gl.setSize.bind(gl);
    gl.testResizeCount = 0;
    gl.setSize = (...a) => {
      gl.testResizeCount++;
      return old(...a);
    };
  });
  await page.locator("[data-setting=brightness]").focus();
  await page.keyboard.press("Home");
  await page.locator("[data-graphics=clouds]").click();
  expect(await page.evaluate(() => dcsmcraft.renderer.gl.testResizeCount)).toBe(
    0,
  );
  await page.screenshot({ path: out + "/video-settings.png", fullPage: true });
  expect(
    await page.evaluate(() => ({
      seed: dcsmcraft.world.seed,
      gen: dcsmcraft.world.generationVersion,
      edits: JSON.stringify(dcsmcraft.world.exportEdits()),
      inventory: JSON.stringify(dcsmcraft.inventory.export()),
    })),
  ).toEqual({
    seed: original.seed,
    gen: original.gen,
    edits: original.edits,
    inventory: original.inventory,
  });
  await page.reload();
  await page.waitForFunction(() => dcsmcraft?.initialized);
  expect(
    await page.evaluate(() => ({
      menu: dcsmcraft.settings.menuFrameLimit,
      pixel: dcsmcraft.settings.maxPixelRatio,
      shadow: dcsmcraft.settings.shadowResolution,
      coverage: dcsmcraft.settings.shadowDistance,
      filter: dcsmcraft.settings.shadowFilter,
      lights: dcsmcraft.settings.localLightCount,
      lod: dcsmcraft.settings.distantDetail,
      anisotropy: dcsmcraft.settings.anisotropy,
    })),
  ).toEqual({
    menu: 15,
    pixel: 1,
    shadow: 512,
    coverage: 32,
    filter: "hard",
    lights: 0,
    lod: 8,
    anisotropy: 2,
  });
  expect(r.errors).toEqual([]);
  expect(r.external).toEqual([]);
});
test("supplied MP3 decodes offline and actual hover/click/back/slider events use the four user-labeled cues; menu mute leaves world sounds available", async ({
  page,
}) => {
  test.setTimeout(120000);
  const r = await boot(page);
  await page.waitForFunction(() => dcsmcraft.audio.menuAudio?.buffer);
  const cues = await page.evaluate((windows) => {
    const buffer = dcsmcraft.audio.menuAudio.buffer,
      data = buffer.getChannelData(0),
      rate = buffer.sampleRate;
    return windows.map((c) => {
      const a = data.slice(
        Math.floor(c.offset * rate),
        Math.floor((c.offset + c.duration) * rate),
      );
      return {
        peak: a.reduce((m, x) => Math.max(m, Math.abs(x)), 0),
        rms: Math.sqrt(a.reduce((n, x) => n + x * x, 0) / a.length),
      };
    });
  }, MENU_CUES);
  expect(cues).toHaveLength(4);
  for (const c of cues) {
    expect(c.peak).toBeGreaterThan(0.01);
    expect(c.rms).toBeGreaterThan(0.001);
  }
  await page.evaluate(() => {
    const audio = dcsmcraft.audio.menuAudio,
      play = audio.playCue.bind(audio);
    audio.testCues = [];
    audio.playCue = async (id) => {
      const ok = await play(id);
      if (ok) audio.testCues.push(id);
      return ok;
    };
  });
  async function clear() {
    await page.mouse.move(1, 1);
    await page.waitForTimeout(350);
    await page.evaluate(() => {
      dcsmcraft.audio.menuAudio.stop();
      dcsmcraft.audio.menuAudio.testCues = [];
    });
  }
  await clear();
  await page.getByRole("button", { name: "Options...", exact: true }).hover();
  await expect
    .poll(() => page.evaluate(() => dcsmcraft.audio.menuAudio.testCues))
    .toContain(1);
  await page.getByRole("button", { name: "Options...", exact: true }).click();
  await expect
    .poll(() => page.evaluate(() => dcsmcraft.audio.menuAudio.testCues))
    .toContain(0);
  await clear();
  await page.locator('[data-action="sound-settings"]').click();
  await page.locator("[data-setting=menuVolume]").focus();
  await page.keyboard.press("End");
  await expect
    .poll(() => page.evaluate(() => dcsmcraft.audio.menuAudio.testCues))
    .toContain(3);
  await clear();
  await page.locator(".settings-dialog > [data-action=back]").click();
  await expect
    .poll(() => page.evaluate(() => dcsmcraft.audio.menuAudio.testCues))
    .toContain(2);
  await page.locator(".settings-dialog > [data-action=back]").click();
  await clear();
  // Measure real DSP output from the same bus without making a second audible path.
  const signal = await page.evaluate(async () => {
    const a = dcsmcraft.audio,
      c = a.context,
      analyser = c.createAnalyser(),
      sink = c.createGain();
    sink.gain.value = 0;
    a.menuAudio.bus.connect(analyser);
    analyser.connect(sink);
    sink.connect(c.destination);
    analyser.fftSize = 256;
    a.menuAudio.stop();
    await a.menu("hover");
    const d = new Float32Array(256);
    let peak = 0;
    for (let i = 0; i < 15; i++) {
      await new Promise((resolve) => setTimeout(resolve, 12));
      analyser.getFloatTimeDomainData(d);
      peak = Math.max(
        peak,
        Math.sqrt(d.reduce((n, x) => n + x * x, 0) / d.length),
      );
    }
    a.menuAudio.bus.disconnect(analyser);
    analyser.disconnect();
    sink.disconnect();
    return peak;
  });
  expect(signal).toBeGreaterThan(0.0001);
  await page.getByRole("button", { name: "Options...", exact: true }).click();
  await page.locator('[data-action="sound-settings"]').click();
  await page.locator("[data-audio=menuSounds]").click();
  await page.locator(".settings-dialog > [data-action=back]").click();
  await clear();
  await page
    .getByRole("button", { name: "Video Settings...", exact: true })
    .hover();
  await page
    .getByRole("button", { name: "Video Settings...", exact: true })
    .click();
  expect(await page.evaluate(() => dcsmcraft.audio.menuAudio.testCues)).toEqual(
    [],
  );
  expect(await page.evaluate(() => dcsmcraft.audio.menuAudio.active.size)).toBe(
    0,
  );
  const worldSound = await page.evaluate(() => {
    const n = dcsmcraft.audio.played;
    dcsmcraft.audio.tone("pickup");
    return dcsmcraft.audio.played > n;
  });
  expect(worldSound).toBe(true);
  await page.reload();
  await page.waitForFunction(() => dcsmcraft?.initialized);
  expect(await page.evaluate(() => dcsmcraft.settings.menuSounds)).toBe(false);
  expect(await page.evaluate(() => dcsmcraft.settings.menuVolume)).toBe(1);
  expect(r.errors).toEqual([]);
  expect(r.external).toEqual([]);
});
test("drop and animated-block distances change visuals without removing items, containers or collisions; nearby edits still rebuild settled terrain", async ({
  page,
}) => {
  test.setTimeout(120000);
  const r = await boot(page);
  await page.evaluate((B) => {
    const g = dcsmcraft;
    g.ui.videoSettings();
    Object.assign(g.player, { x: 0.5, y: 200, z: 0.5 });
    g.settings.renderDistance = 4;
    g.settings.blockEntityDistance = 16;
    g.settings.droppedItemDistance = 0.25;
    g.world.set(2, 199, 2, B.stone);
    g.world.set(30, 199, 2, B.stone);
    g.world.set(2, 200, 2, B.chest);
    g.world.set(30, 200, 2, B.chest);
    g.world.containers["30,200,2"] = {
      type: "chest",
      slots: [{ id: "diamond", count: 4 }],
    };
    g.renderer.worldAnimations.setChunk("distance-test", [
      { x: 2, y: 200, z: 2, id: B.chest },
      { x: 30, y: 200, z: 2, id: B.chest },
    ]);
    g.drops = [
      {
        uid: "near-drop",
        id: "diamond",
        count: 1,
        x: 3,
        y: 200,
        z: 3,
        vy: 0,
        age: 0,
        delay: 10,
      },
      {
        uid: "far-drop",
        id: "diamond",
        count: 1,
        x: 30,
        y: 200,
        z: 2,
        vy: 0,
        age: 0,
        delay: 10,
      },
    ];
    g.renderer.camera.position.set(g.player.x, 201.62, g.player.z);
    g.renderer.syncEntities([], g.drops, 0);
    g.renderer.worldAnimations.update(g, 1 / 60, 0);
  }, B);
  const low = await page.evaluate(() => ({
    near: dcsmcraft.renderer.dropMeshes.has("near-drop"),
    far: dcsmcraft.renderer.dropMeshes.has("far-drop"),
    prop: dcsmcraft.renderer.worldAnimations.models.get("30,200,2").visible,
    items: dcsmcraft.drops.length,
    loot: dcsmcraft.world.containers["30,200,2"].slots[0].count,
    solid: dcsmcraft.world.solid(30, 200, 2),
  }));
  expect(low).toEqual({
    near: true,
    far: false,
    prop: false,
    items: 2,
    loot: 4,
    solid: true,
  });
  await page.evaluate(() => {
    const g = dcsmcraft;
    g.settings.droppedItemDistance = 1;
    g.settings.blockEntityDistance = 64;
    g.renderer.syncEntities([], g.drops, 0);
    g.renderer.worldAnimations.update(g, 1 / 60, 0);
  });
  expect(
    await page.evaluate(() => dcsmcraft.renderer.dropMeshes.has("far-drop")),
  ).toBe(true);
  expect(
    await page.evaluate(
      () => dcsmcraft.renderer.worldAnimations.models.get("30,200,2").visible,
    ),
  ).toBe(true);
  await page.evaluate(() => {
    dcsmcraft.settings.renderDistance = 2;
    dcsmcraft.settings.distantTerrain = false;
  });
  await page.waitForFunction(() => dcsmcraft.renderer.streamSettled, {
    timeout: 45000,
  });
  const edit = await page.evaluate((B) => {
    const g = dcsmcraft,
      r = g.renderer,
      before = g.world.meshRevision;
    g.world.set(15, 200, 2, B.brick);
    r.loadAround(g.player.x, g.player.z, 2);
    return {
      changed: g.world.meshRevision > before,
      visibleRevision: r.meshes.get("0,0")?.userData.revision,
      realRevision: g.world.revisions.get("0,0"),
      block: g.world.get(15, 200, 2),
    };
  }, B);
  expect(edit.changed).toBe(true);
  expect(edit.block).toBe(B.brick);
  // Mesh uploads are frame-budgeted; collisions update immediately, then the
  // installed mesh must converge on the latest authoritative chunk revision.
  await page.waitForFunction(
    () => {
      const g = dcsmcraft;
      return (
        g.renderer.meshes.get("0,0")?.userData.revision ===
        g.world.revisions.get("0,0")
      );
    },
    null,
    { timeout: 15000 },
  );
  expect(r.errors).toEqual([]);
  expect(r.external).toEqual([]);
});
