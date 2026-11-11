import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { B, MOB_INFO } from "../../src/data.js";
import { World } from "../../src/world.js";
const baseline = JSON.parse(
  readFileSync("tests/fixtures/v050-classic.json", "utf8"),
);
let html;
test.beforeAll(() => {
  execFileSync(process.execPath, [
    "scripts/build-standalone.mjs",
    "/tmp/dcsmcraft-renewal-tested.html",
  ]);
  html = readFileSync("/tmp/dcsmcraft-renewal-tested.html", "utf8");
});
async function create(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (
      ["error", "warning"].includes(m.type()) &&
      /Shader Error|WebGLProgram|GL_INVALID|texSubImage|texture.*incomplete/i.test(
        m.text(),
      )
    )
      errors.push(m.text());
  });
  await page.addInitScript(() => {
    if (!localStorage.getItem("dcsmcraft-settings"))
      localStorage.setItem(
        "dcsmcraft-settings",
        JSON.stringify({ renderDistance: 2, graphics: 2 }),
      );
  });
  await page.route("**/*", (r) =>
    r.request().url().endsWith("/renewal.html")
      ? r.fulfill({ contentType: "text/html", body: html })
      : r.abort(),
  );
  await page.goto("/renewal.html");
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.locator("[data-action=create]").first().click();
  await page.locator("[name=seed]").fill("Wildflower");
  await page.locator("[name=mode][value=creative]").check();
  await page.locator("[data-action=start-world]").click();
  await page.waitForFunction(() => dcsmcraft.running);
  await page.evaluate(() => {
    dcsmcraft.pause();
    dcsmcraft.ui.play();
    dcsmcraft.pointerLockFallback = true;
  });
  return errors;
}
test("organized graphics controls apply to actual rendering and retain the existing menu style", async ({
  page,
}) => {
  const errors = await create(page);
  await page.evaluate(() => dcsmcraft.ui.videoSettings());
  await expect(page.locator(".video-group")).toHaveCount(4);
  await expect(
    page.getByRole("heading", { name: "Lighting", exact: true }),
  ).toBeVisible();
  for (const key of ["brightness", "entityDistance", "biomeBlend"])
    await page
      .locator(`[data-setting=${key}]`)
      .fill(
        key === "brightness" ? "0.8" : key === "entityDistance" ? "0.5" : "4",
      );
  await page.locator("[data-preference=particles]").selectOption("minimal");
  await page.locator("[data-preference=frameLimit]").selectOption("30");
  for (const key of ["viewBobbing", "sunMoon", "entityShadows", "biomeColors"])
    await page.locator(`[data-graphics=${key}]`).click();
  for (const level of [0, 1, 4, 2, 4, 0, 4]) {
    await page.locator("[data-setting=mipmapLevels]").fill(String(level));
    await page.waitForTimeout(150);
    await page.waitForFunction(
      () =>
        !!dcsmcraft.renderer.gl.properties.get(dcsmcraft.renderer.atlas.texture)
          .__webglTexture,
    );
    const actual = await page.evaluate(() => {
      const r = dcsmcraft.renderer,
        g = r.gl.getContext(),
        old = g.getParameter(g.TEXTURE_BINDING_2D);
      g.bindTexture(
        g.TEXTURE_2D,
        r.gl.properties.get(r.atlas.texture).__webglTexture,
      );
      const levels = g.getTexParameter(
        g.TEXTURE_2D,
        g.TEXTURE_IMMUTABLE_LEVELS,
      );
      g.bindTexture(g.TEXTURE_2D, old);
      return {
        levels,
        error: g.getError(),
        declared: r.atlas.texture.mipmaps.length,
      };
    });
    expect(actual).toEqual({
      levels: level + 1,
      error: 0,
      declared: level ? level + 1 : 0,
    });
  }
  await page.evaluate(() => document.querySelector("#overlay").scrollTo(0, 0));
  await page.screenshot({
    path: "/workspace/artifacts/DCSMCRAFT-v1.0.0-video-settings.png",
    fullPage: true,
  });
  const result = await page.evaluate(async (B) => {
    const g = dcsmcraft,
      r = g.renderer;
    g.ui.play();
    await new Promise((resolve) => setTimeout(resolve, 250));
    const before = r.effects.length;
    r.breakParticles(0, 200, 0, B.stone);
    const noParticles = r.effects.length === before;
    await g.save();
    return {
      noParticles,
      sun: r.sunOrb.visible,
      shadows: g.settings.entityShadows,
      mips: r.atlas.texture.mipmaps.length,
      brightness: g.settings.brightness,
      colors: r.appliedColors,
      blend: r.appliedBlend,
      font: getComputedStyle(document.querySelector("#hotbar")).fontFamily,
    };
  }, B);
  expect(result).toMatchObject({
    noParticles: true,
    sun: false,
    shadows: false,
    mips: 5,
    brightness: 0.8,
    colors: false,
    blend: 4,
  });
  await page.reload();
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  expect(
    await page.evaluate(() => [
      dcsmcraft.settings.particles,
      dcsmcraft.settings.frameLimit,
      dcsmcraft.settings.viewBobbing,
      dcsmcraft.settings.entityDistance,
    ]),
  ).toEqual(["minimal", 30, false, 0.5]);
  expect(errors).toEqual([]);
});
test("Classic preserves every original block pixel; pack switches update live terrain, hand and icons", async ({
  page,
}) => {
  const errors = await create(page);
  await page.evaluate(() => dcsmcraft.ui.videoSettings());
  await page.locator("[data-preference=texturePack]").selectOption("classic");
  const classic = await page.evaluate(() => {
    const r = dcsmcraft.renderer,
      c = r.atlas.canvas.getContext("2d");
    let hash = 2166136261;
    for (let tile = 0; tile < 58 * 3; tile++)
      for (const byte of c.getImageData(
        (tile % 16) * 16,
        Math.floor(tile / 16) * 16,
        16,
        16,
      ).data) {
        hash ^= byte;
        hash = Math.imul(hash, 16777619);
      }
    return hash >>> 0;
  });
  expect(classic).toBe(baseline.first58BlocksAtlasFNV);
  const original = await page.evaluate(() =>
    dcsmcraft.renderer.atlas.canvas.toDataURL(),
  );
  writeFileSync(
    "/workspace/artifacts/DCSMCRAFT-Classic-Atlas.png",
    Buffer.from(original.split(",")[1], "base64"),
  );
  await page.evaluate(() => dcsmcraft.ui.play());
  await page.waitForTimeout(600);
  await page.screenshot({
    path: "/workspace/artifacts/DCSMCRAFT-v1.0.0-classic.png",
  });
  await page.evaluate(() => dcsmcraft.ui.videoSettings());
  await page.locator("[data-preference=texturePack]").selectOption("renewed");
  expect(
    await page.evaluate(() => dcsmcraft.renderer.atlas.canvas.toDataURL()),
  ).not.toBe(original);
  await page.evaluate(() => dcsmcraft.ui.play());
  await page.waitForTimeout(600);
  const map = await page.evaluate(() => {
    const r = dcsmcraft.renderer;
    return {
      terrain: r.material.map === r.atlas.texture,
      held: r.heldMesh.children.some(
        (m) => m.material?.map === r.atlas.texture,
      ),
      pack: r.appliedPack,
    };
  });
  expect(map).toEqual({ terrain: true, held: true, pack: "renewed" });
  await page.screenshot({
    path: "/workspace/artifacts/DCSMCRAFT-v1.0.0-renewed.png",
  });
  expect(errors).toEqual([]);
});
function locations(names) {
  const w = new World("Wildflower"),
    found = {};
  for (let z = -2048; z <= 2048; z += 32)
    for (let x = -2048; x <= 2048; x += 32) {
      const t = w.terrain(x, z);
      if (names.includes(t.biome) && t.h > 65 && !t.village && !found[t.biome])
        found[t.biome] = { x, z, h: t.h, biome: t.biome };
    }
  return names.map((n) => found[n]);
}
for (const names of [
  ["pine_forest", "birch_woodland", "badlands"],
  ["savanna", "snowy_taiga", "marsh"],
])
  test(`new biome terrain is playable and renders: ${names.join(", ")}`, async ({
    page,
  }) => {
    const errors = await create(page);
    for (const site of locations(names)) {
      expect(site).toBeTruthy();
      await page.evaluate((p) => {
        const g = dcsmcraft;
        g.entities = [];
        Object.assign(g.player, {
          x: p.x + 0.5,
          y: p.h + 13,
          z: p.z + 0.5,
          yaw: 0.6,
          pitch: -0.45,
          flying: true,
          vx: 0,
          vy: 0,
          vz: 0,
        });
        g.ui.play();
        g.running = true;
        g.pointerLockFallback = true;
      }, site);
      await page.waitForFunction(
        (p) =>
          dcsmcraft.renderer.meshes.has(
            `${Math.floor(p.x / 16)},${Math.floor(p.z / 16)}`,
          ),
        site,
      );
      await page.waitForTimeout(600);
      await page.evaluate(() => dcsmcraft.pause());
      const actual = await page.evaluate(
        (p) => ({
          biome: dcsmcraft.world.terrain(p.x, p.z).biome,
          id: dcsmcraft.world.get(p.x, p.h, p.z),
          colliding: dcsmcraft.world.solid(p.x, p.h, p.z),
        }),
        site,
      );
      expect(actual.biome).toBe(site.biome);
      expect(actual.colliding).toBe(true);
      await page.evaluate(() => dcsmcraft.ui.play());
      await page.screenshot({
        path: `/workspace/artifacts/DCSMCRAFT-v1.0.0-${site.biome}.png`,
      });
    }
    expect(errors).toEqual([]);
  });
test("creature models batch static parts, smooth motion without changing physics and release distant meshes", async ({
  page,
}) => {
  const errors = await create(page);
  const result = await page.evaluate((B) => {
    const g = dcsmcraft,
      r = g.renderer;
    for (let x = -4; x <= 18; x++)
      for (let z = -12; z <= 10; z++) g.world.set(x, 199, z, B.grass);
    g.entities = [];
    r.camera.position.set(0, 202, 0);
    const types = [
      "cow",
      "grazer",
      "woolling",
      "chicken",
      "rabbit",
      "villager",
      "shade",
    ];
    const es = types.map((type, i) => ({
      id: `model${i}`,
      type,
      profession: "farmer",
      x: i * 2,
      y: 200,
      z: -6,
      hp: 20,
      age: 100,
      yaw: Math.PI - 0.01,
      attack: 0,
      hurt: 0,
      onGround: true,
    }));
    r.syncEntities(es, [], 0);
    const counts = {},
      heights = {};
    r.scene.updateMatrixWorld(true);
    for (const e of es) {
      let n = 0;
      r.mobMeshes.get(e.id).traverse((m) => {
        if (m.isMesh) {
          n++;
          m.geometry.computeBoundingBox();
          const box = m.geometry.boundingBox,
            a = m.matrixWorld.elements;
          for (const x of [box.min.x, box.max.x])
            for (const y of [box.min.y, box.max.y])
              for (const z of [box.min.z, box.max.z])
                heights[e.type] = Math.max(
                  heights[e.type] || 0,
                  a[1] * x + a[5] * y + a[9] * z + a[13] - e.y,
                );
        }
      });
      counts[e.type] = n;
    }
    const e = es[0],
      m = r.mobMeshes.get(e.id),
      before = m.position.x;
    e.x += 1;
    e.yaw = -Math.PI + 0.01;
    r.syncEntities(es, [], 0.016, 0.016);
    const smooth = m.position.x > before && m.position.x < e.x,
      authoritative = e.x === 1;
    const paused = m.position.clone();
    r.syncEntities(es, [], 0.016, 0);
    const frozen = m.position.equals(paused);
    const geometry = r.mobMeshes.get(es[1].id).userData.legs[0].children[0]
      .geometry;
    let disposed = false;
    geometry.addEventListener("dispose", () => (disposed = true));
    es[1].x = 10000;
    r.syncEntities(es, [], 0.032, 0.016);
    g.entities = es.filter((e) => e.x < 100);
    g.player.x = 0;
    g.player.y = 200;
    g.player.z = 4;
    g.player.yaw = 0;
    g.player.pitch = 0;
    g.ui.play();
    return {
      counts,
      heights,
      smooth,
      authoritative,
      frozen,
      disposed,
      culled: !r.mobMeshes.has(es[1].id),
    };
  }, B);
  for (const [type, count] of Object.entries(result.counts))
    expect(count, type).toBeLessThan(baseline.meshes[type]);
  for (const [type, height] of Object.entries(result.heights))
    expect(height, type).toBeLessThanOrEqual(
      (MOB_INFO[type]?.height || 1.95) + 0.001,
    );
  expect(result).toMatchObject({
    smooth: true,
    authoritative: true,
    frozen: true,
    disposed: false,
    culled: true,
  });
  await page.waitForTimeout(700);
  await page.screenshot({
    path: "/workspace/artifacts/DCSMCRAFT-v1.0.0-models.png",
  });
  expect(errors).toEqual([]);
});
test("new footsteps and voiced creature samples play, attenuate and remain bounded", async ({
  page,
}) => {
  const errors = await create(page);
  const sounds = await page.evaluate(async () => {
    const g = dcsmcraft,
      a = g.audio,
      c = a.context;
    g.settings.ambientSounds = false;
    a.silenceAmbient();
    g.settings.volume = 1;
    a.updateVolume();
    await c.resume();
    const analyser = c.createAnalyser();
    analyser.fftSize = 2048;
    a.master.connect(analyser);
    const rms = () => {
      const d = new Float32Array(2048);
      analyser.getFloatTimeDomainData(d);
      return Math.sqrt(d.reduce((s, v) => s + v * v, 0) / d.length);
    };
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    await wait(1500);
    a.tone("step", "pine_log");
    await wait(60);
    const step = rms();
    await wait(450);
    a.mob("cow", 0);
    await wait(120);
    const near = rms();
    await wait(1000);
    a.mob("cow", 28);
    await wait(120);
    const far = rms();
    await wait(1000);
    g.settings.mobSounds = false;
    a.mob("cow", 0);
    await wait(120);
    const mute = rms();
    a.master.disconnect(analyser);
    return { step, near, far, mute, variants: a.voices.cow.length };
  });
  expect(sounds.step).toBeGreaterThan(0.0001);
  expect(sounds.near).toBeGreaterThan(0.001);
  expect(sounds.far).toBeLessThan(sounds.near * 0.15);
  expect(sounds.mute).toBeLessThan(0.00003);
  expect(sounds.variants).toBe(3);
  expect(errors).toEqual([]);
});
