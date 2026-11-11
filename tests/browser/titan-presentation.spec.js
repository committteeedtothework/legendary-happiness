import { createHash } from "node:crypto";
import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
const html = readFileSync("dist/DCSMCRAFT-Standalone.html"),
  out =
    process.env.DCSMCRAFT_PRESENTATION_ARTIFACTS || "test-results/presentation";
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

test("capture actual arena presentation and verify isolated quality controls", async ({
  page,
}) => {
  test.setTimeout(240000);
  const evidence = await boot(page);
  await portal(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  const views = [
    ["approach", "traversal", 1, 0],
    ["battle", "combat", 1, 0],
    ["phase-two", "combat", 2, 0],
    ["transformation", "transform", 1, 2.6],
  ];
  const report = [];
  for (const [name, stage, phase, stageTime] of views) {
    const data = await page.evaluate(
      ({ stage, phase, stageTime }) => {
        const g = dcsmcraft,
          e = g.giganto,
          s = e.session,
          v = e.view,
          gl = g.renderer.gl;
        g.running = false;
        e.controls.clear();
        s.stage = stage;
        s.phase = phase;
        s.stageTime = stageTime;
        s.time = 26;
        s.emerald = stage !== "traversal";
        s.attack = "idle";
        s.strike = null;
        s.action = "idle";
        s.qte = null;
        s.counterScene = null;
        s.rings = 285;
        Object.assign(s.config, {
          graphicsQuality: "high",
          shadowQuality: "high",
          postProcessing: true,
          particles: true,
          music: false,
        });
        Object.assign(s.avatar, {
          x: stage === "traversal" ? 0 : -12,
          y: stage === "traversal" ? 0 : 64,
          z: stage === "traversal" ? 78 : 45,
          vx: 0,
          vy: 0,
          vz: 0,
          yaw: 0,
          pitch: 0,
          onGround: stage === "traversal",
        });
        gl.setPixelRatio(1);
        gl.setSize(1280, 720, false);
        const old = {
          mapping: gl.toneMapping,
          exposure: gl.toneMappingExposure,
          shadow: gl.shadowMap.enabled,
        };
        v.camReady = false;
        for (let i = 0; i < 6; i++) {
          v.draw(s, 1 / 15);
          e.updateHUD();
        }
        gl.getContext().finish();
        return {
          stage,
          phase,
          calls: gl.info.render.calls,
          triangles: gl.info.render.triangles,
          camera: v.camera.position.toArray(),
          rendererRestored:
            old.mapping === gl.toneMapping &&
            old.exposure === gl.toneMappingExposure &&
            old.shadow === gl.shadowMap.enabled,
        };
      },
      { stage, phase, stageTime },
    );
    await page.screenshot({ path: out + "/" + name + ".png" });
    expect(data.rendererRestored).toBe(true);
    report.push(data);
  }
  const contact = await page.evaluate(() => {
    const g = dcsmcraft,
      e = g.giganto,
      s = e.session,
      v = e.view;
    g.running = false;
    e.controls.clear();
    s.stage = "combat";
    s.stageTime = 0;
    s.phase = 1;
    s.emerald = true;
    s.attack = "idle";
    s.idle = 999;
    s.strike = null;
    s.action = "idle";
    s.actionTime = 0;
    s.counterScene = null;
    s.qte = null;
    s.counter = 0;
    s.config.drain = 0;
    Object.assign(s.avatar, {
      x: 0,
      y: 57,
      z: 5,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: 0,
      pitch: 0,
      onGround: false,
    });
    v.camReady = false;
    e.accumulator = 0;
    e.input("hit");
    g.running = true;
    for (let i = 0; i < 11; i++) e.frame(1 / 60);
    g.running = false;
    const gl = g.renderer.gl,
      ctx = gl.getContext(),
      a = new Uint8Array(1280 * 720 * 4),
      b = new Uint8Array(a.length);
    s.config.impactEffects = false;
    v.draw(s, 0);
    ctx.readPixels(0, 0, 1280, 720, ctx.RGBA, ctx.UNSIGNED_BYTE, a);
    s.config.impactEffects = true;
    v.draw(s, 0);
    ctx.readPixels(0, 0, 1280, 720, ctx.RGBA, ctx.UNSIGNED_BYTE, b);
    let changed = 0;
    for (let i = 0; i < a.length; i += 4)
      if (
        Math.abs(a[i] - b[i]) +
          Math.abs(a[i + 1] - b[i + 1]) +
          Math.abs(a[i + 2] - b[i + 2]) >
        20
      )
        changed++;
    return {
      changedPixels: changed,
      sparks: v.impacts?.mesh.count || 0,
      damage: s.maxHp - s.hp,
      screen: v.damageScreen,
    };
  });
  await page.screenshot({ path: out + "/contact.png" });
  // The baseline predates contact sparks; final builds must produce the batch.
  if (process.env.DCSMCRAFT_PRESENTATION_FINAL) {
    expect(contact.sparks).toBeGreaterThan(0);
    expect(contact.changedPixels).toBeGreaterThan(20);
  }
  const quality = await page.evaluate(() => {
    const g = dcsmcraft,
      e = g.giganto,
      s = e.session,
      v = e.view,
      gl = g.renderer.gl,
      world = JSON.stringify(g.settings),
      results = [];
    for (const q of ["low", "balanced", "high"]) {
      Object.assign(s.config, {
        graphicsQuality: q,
        renderScale: 0.7,
        ambientOcclusion: "high",
        postProcessing: true,
        sceneryDetail: "low",
        impactEffects: false,
        atmosphere: false,
      });
      const before = {
        mapping: gl.toneMapping,
        exposure: gl.toneMappingExposure,
        shadow: gl.shadowMap.enabled,
      };
      v.draw(s, 1 / 60);
      results.push({
        q,
        width: v.composer.readBuffer.width,
        ao: v.aoActive,
        grass: v.arena.userData.blades.count,
        sparks: v.impacts.mesh.count,
        restored:
          gl.toneMapping === before.mapping &&
          gl.toneMappingExposure === before.exposure &&
          gl.shadowMap.enabled === before.shadow,
      });
    }
    return { results, worldUnchanged: world === JSON.stringify(g.settings) };
  });
  if (process.env.DCSMCRAFT_PRESENTATION_FINAL) {
    expect(quality.worldUnchanged).toBe(true);
    for (const q of quality.results) {
      expect(q.width).toBe(896);
      expect(q.grass).toBe(3200);
      expect(q.sparks).toBe(0);
      expect(q.restored).toBe(true);
    }
    expect(quality.results[0].ao).toBe(false);
  }
  await page.setViewportSize({ width: 640, height: 480 });
  await page.evaluate(() => {
    const g = dcsmcraft,
      v = g.giganto.view;
    g.renderer.gl.setSize(640, 480, false);
    v.draw(g.giganto.session, 0);
    g.giganto.updateHUD();
  });
  await page.screenshot({ path: out + "/compact.png" });
  const compact = await page.locator(".titan-abilities").evaluate((n) => {
    const r = n.getBoundingClientRect();
    return {
      left: r.left,
      right: r.right,
      bottom: r.bottom,
      viewport: innerWidth,
    };
  });
  expect(compact.left).toBeGreaterThanOrEqual(0);
  expect(compact.right).toBeLessThanOrEqual(640);
  expect(compact.bottom).toBeLessThanOrEqual(480);
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.evaluate(() => {
    const g = dcsmcraft;
    g.giganto.record.config = JSON.parse(
      JSON.stringify(g.giganto.session.config),
    );
    g.pause();
  });
  await page.locator("[data-titan=menu]").click();
  await page.locator("[data-titan-config=sceneryDetail]").selectOption("off");
  for (const key of [
    "cinematicCamera",
    "cinematicBars",
    "atmosphere",
    "impactEffects",
  ])
    await page.locator("[data-titan-config=" + key + "]").uncheck();
  for (const [key, value] of [
    ["renderScale", "0.8"],
    ["exposure", "1.1"],
    ["bloomIntensity", "0"],
  ])
    await page.locator("[data-titan-config=" + key + "]").evaluate((n, v) => {
      n.value = v;
      n.dispatchEvent(new Event("change", { bubbles: true }));
    }, value);
  await page.locator(".titan-settings").evaluate((n) => (n.scrollTop = 0));
  const menuReadability = await page
    .locator(".titan-settings")
    .evaluate((n) => {
      const label = n.querySelector("label"),
        rgb = getComputedStyle(label)
          .color.match(/[\d.]+/g)
          .slice(0, 3)
          .map(Number),
        linear = rgb.map((c) => {
          c /= 255;
          return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
        }),
        luminance =
          linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722,
        title = n.querySelector("h2").getBoundingClientRect(),
        panel = n.getBoundingClientRect();
      return {
        luminance,
        titleTop: title.top,
        panelBottom: panel.bottom,
        height: innerHeight,
      };
    });
  expect(menuReadability.luminance).toBeGreaterThan(0.7);
  expect(menuReadability.titleTop).toBeGreaterThanOrEqual(0);
  expect(menuReadability.panelBottom).toBeLessThanOrEqual(
    menuReadability.height,
  );
  await page.screenshot({ path: out + "/settings.png" });
  const saved = await page.evaluate(async () => {
    const g = dcsmcraft;
    await g.save();
    return {
      id: g.id,
      world: JSON.stringify(g.settings),
      config: g.giganto.session.config,
    };
  });
  expect(saved.config.renderScale).toBe(0.8);
  expect(saved.config.sceneryDetail).toBe("off");
  expect(saved.config.cinematicCamera).toBe(false);
  await page.evaluate(async (id) => {
    await dcsmcraft.loadWorld(id);
    dcsmcraft.pause();
  }, saved.id);
  await page.waitForFunction(() => dcsmcraft.giganto.view.assetsReady);
  const restored = await page.evaluate(async () => {
    const g = dcsmcraft,
      e = g.giganto,
      c = JSON.parse(JSON.stringify(e.session.config));
    e.view.draw(e.session, 0);
    const before = {
      foliage: e.view.arena.userData.blades.visible,
      scale: e.view.composer.readBuffer.width / g.renderer.gl.domElement.width,
    };
    await e.exit(false);
    return {
      config: c,
      world: JSON.stringify(g.settings),
      foliage: before.foliage,
      scale: before.scale,
      active: e.active,
      hud: getComputedStyle(document.querySelector("#hud")).visibility,
    };
  });
  expect(restored.config.renderScale).toBe(0.8);
  expect(restored.config.cinematicCamera).toBe(false);
  expect(restored.config.cinematicBars).toBe(false);
  expect(restored.foliage).toBe(false);
  expect(restored.scale).toBeCloseTo(0.8, 2);
  expect(restored.world).toBe(saved.world);
  expect(restored.active).toBe(false);
  expect(restored.hud).toBe("visible");
  expect(evidence.errors).toEqual([]);
  expect(evidence.external).toEqual([]);
  writeFileSync(
    out + "/presentation-report.json",
    JSON.stringify(
      {
        htmlSHA256: createHash("sha256").update(html).digest("hex"),
        views: report,
        contact,
        quality,
        compact,
        restored,
        errors: evidence.errors,
      },
      null,
      2,
    ),
  );
});
