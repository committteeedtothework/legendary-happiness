import { createHash } from "node:crypto";
import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
const html = readFileSync("dist/DCSMCRAFT-Standalone.html"),
  out = process.env.DCSMCRAFT_HIGHLANDS_ARTIFACTS || "test-results/highlands";
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

test("native highland foliage, distant landmarks and quality settings remain finite, batched and frozen while paused", async ({
  page,
}) => {
  test.setTimeout(150000);
  const ev = await boot(page);
  await portal(page);
  const state = await page.evaluate(() => {
    const g = dcsmcraft,
      e = g.giganto,
      s = e.session,
      v = e.view;
    g.pause();
    g.ui.play();
    g.running = false;
    Object.assign(s, {
      stage: "traversal",
      emerald: false,
      time: 35,
      stageTime: 8,
      phase: 1,
    });
    Object.assign(s.config, {
      graphicsQuality: "balanced",
      sceneryDetail: "auto",
      postProcessing: false,
      shadowQuality: "low",
      audio: false,
      music: false,
      dynamicSky: false,
      arenaWeather: "clear",
      climbMode: "ruins",
    });
    Object.assign(s.avatar, {
      x: 26,
      y: 20,
      z: 27,
      yaw: Math.PI * 1.4,
      pitch: -0.06,
      vx: 0,
      vy: 0,
      vz: 0,
    });
    s.route = 3;
    v.camReady = false;
    v.shotFlow = {};
    v.draw(s, 1 / 60);
    e.updateHUD();
    const u = v.arena.userData,
      sample = {
        cards: u.crowns.geometry.userData.leafCards,
        alphaToCoverage: u.crowns.material.alphaToCoverage,
        shrubs: u.shrubs.count,
        grass: u.slopeGrass.count,
        branches: u.trunks.geometry.attributes.position.count,
        meshes: 0,
      };
    v.arena.traverse((o) => {
      if (o.isMesh) sample.meshes++;
    });
    const t = u.anim.map((x) => x.value),
      pos = v.camera.position.toArray();
    v.draw(s, 0);
    v.draw(s, 0);
    sample.pauseDrift = Math.max(
      ...pos.map((value, i) =>
        Math.abs(value - v.camera.position.toArray()[i]),
      ),
      ...t.map((value, i) => Math.abs(value - u.anim[i].value)),
    );
    return sample;
  });
  expect(state.cards).toBeGreaterThan(30);
  expect(state.alphaToCoverage).toBe(false);
  expect(state.shrubs).toBe(420);
  expect(state.grass).toBe(4500);
  expect(state.branches).toBeGreaterThan(100);
  expect(state.meshes).toBeLessThan(40);
  expect(state.pauseDrift).toBeLessThan(0.000001);
  await page.screenshot({ path: out + "/highland-woodland.png" });
  const qualities = await page.evaluate(() => {
    const e = dcsmcraft.giganto,
      s = e.session,
      v = e.view,
      u = v.arena.userData,
      results = [];
    for (const detail of ["low", "high", "off", "auto"]) {
      s.config.sceneryDetail = detail;
      v.draw(s, 0);
      results.push({
        detail,
        shrubs: u.shrubs.count,
        grass: u.slopeGrass.count,
        visible: u.shrubs.visible && u.slopeGrass.visible,
      });
    }
    return results;
  });
  expect(qualities[0].grass).toBe(2200);
  expect(qualities[1].grass).toBe(9000);
  expect(qualities[2].visible).toBe(false);
  expect(qualities[3].visible).toBe(true);
  await page.screenshot({ path: out + "/highland-meadow.png" });
  expect(ev.errors).toEqual([]);
  expect(ev.external).toEqual([]);
  writeFileSync(
    out + "/landscape-report.json",
    JSON.stringify(
      {
        htmlSHA256: createHash("sha256").update(html).digest("hex"),
        state,
        qualities,
        ...ev,
      },
      null,
      2,
    ),
  );
});

test("actual ability cameras track Sonic through consecutive moves and a full Cyloop; buffered specials launch without releasing held attack", async ({
  page,
}) => {
  test.setTimeout(180000);
  const ev = await boot(page);
  await portal(page);
  const samples = [];
  for (const action of [
    "hit",
    "homing",
    "boom",
    "cross",
    "shot",
    "rush",
    "spin",
    "cyclone",
    "stomp",
    "loop",
  ]) {
    const result = await page.evaluate((action) => {
      const g = dcsmcraft,
        e = g.giganto,
        s = e.session,
        v = e.view;
      g.running = false;
      g.ui.play();
      e.controls.clear();
      Object.assign(s, {
        stage: "combat",
        emerald: true,
        phase: 1,
        hp: s.maxHp,
        rings: 400,
        idle: 999,
        attack: "idle",
        attackTime: 0,
        strike: null,
        queuedMove: null,
        energy: 100,
        action: "idle",
        actionTime: 0,
        counterScene: null,
        qte: null,
        knockback: null,
        dodge: 0,
        stagger: 0,
        projectiles: [],
      });
      Object.assign(s.config, {
        graphicsQuality: "low",
        sceneryDetail: "low",
        shadowQuality: "off",
        postProcessing: false,
        audio: false,
        music: false,
        moveCamera: true,
        drain: 0,
        bossMobility: false,
        adaptiveBoss: false,
      });
      Object.assign(s.avatar, {
        x: 0,
        y: 57,
        z: 5,
        yaw: 0,
        pitch: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        onGround: false,
      });
      for (const k of Object.keys(s.cooldowns)) s.cooldowns[k] = 0;
      s.boss.x = s.boss.z = s.boss.yaw = 0;
      s.boss.walk = null;
      v.camReady = false;
      v.shotFlow = {};
      v.cameraFollow = {};
      const accepted = e.input(action),
        render = g.renderer.gl.render;
      let outside = 0,
        seen = 0,
        maxCenter = 0,
        finite = true;
      const positions = [];
      try {
        g.renderer.gl.render = () => {};
        const n =
          action === "loop"
            ? 185
            : action === "cyclone"
              ? 65
              : action === "shot"
                ? 40
                : action === "hit"
                  ? 60
                  : 20;
        for (let i = 0; i < n; i++) {
          g.running = true;
          e.frame(1 / 60);
          g.running = false;
          if (s.strike || action === "hit") {
            const focus = v.sonic.position.clone();
            focus.y += 1.8 / 2.8;
            focus.project(v.camera);
            maxCenter = Math.max(
              maxCenter,
              Math.abs(focus.x),
              Math.abs(focus.y),
            );
            if (Math.abs(focus.x) > 1 || Math.abs(focus.y) > 1 || focus.z > 1)
              outside++;
            seen++;
          }
          finite &&= v.camera.position.toArray().every(Number.isFinite);
          if (i % 12 === 0) positions.push(v.camera.position.toArray());
        }
      } finally {
        g.renderer.gl.render = render;
        g.running = false;
      }
      v.draw(s, 0);
      e.updateHUD();
      return {
        action,
        accepted,
        seen,
        outside,
        maxCenter,
        finite,
        positions,
        afterDistance: Math.hypot(
          v.camera.position.x - s.avatar.x,
          v.camera.position.y - s.avatar.y,
          v.camera.position.z - s.avatar.z,
        ),
        move: v.shotFlow.key,
        hp: s.maxHp,
        scale: v.sonic.scale.toArray(),
      };
    }, action);
    expect(result.accepted, action).toBe(true);
    expect(result.finite).toBe(true);
    expect(result.seen).toBeGreaterThan(0);
    expect(result.outside, action).toBe(0);
    expect(result.hp).toBe(120000);
    if (action === "hit") expect(result.afterDistance).toBeLessThan(12);
    samples.push(result);
    if (["cross", "rush", "loop"].includes(action))
      await page.screenshot({ path: out + "/move-" + action + ".png" });
  }
  const chain = await page.evaluate(() => {
    const g = dcsmcraft,
      e = g.giganto,
      s = e.session,
      v = e.view;
    Object.assign(s, {
      strike: null,
      queuedMove: null,
      action: "idle",
      actionTime: 0,
      energy: 100,
      idle: 999,
    });
    Object.assign(s.avatar, { x: 0, y: 57, z: 5, vx: 0, vy: 0, vz: 0 });
    for (const k of Object.keys(s.cooldowns)) s.cooldowns[k] = 0;
    e.controls.clear();
    e.input("hit");
    const render = g.renderer.gl.render;
    const kinds = [];
    let queued;
    try {
      g.renderer.gl.render = () => {};
      for (let i = 0; i < 30; i++) {
        if (i === 7) queued = e.input("boom");
        e.controls.add("Mouse0");
        g.running = true;
        e.frame(1 / 60);
        g.running = false;
        for (const q of s.events)
          if (q.type === "attack-start") kinds.push(q.kind);
      }
    } finally {
      g.renderer.gl.render = render;
      e.controls.clear();
      g.running = false;
    }
    v.draw(s, 0);
    return {
      queued,
      kinds,
      current: s.strike?.move,
      energy: s.energy,
      cooldown: s.cooldowns.boom,
    };
  });
  expect(chain.queued).toBe(true);
  expect(chain.current).toBe("boom");
  expect(chain.cooldown).toBeGreaterThan(0);
  expect(chain.energy).toBeLessThan(100);
  expect(ev.errors).toEqual([]);
  expect(ev.external).toEqual([]);
  writeFileSync(
    out + "/move-camera-report.json",
    JSON.stringify(
      {
        htmlSHA256: createHash("sha256").update(html).digest("hex"),
        samples,
        chain,
        ...ev,
      },
      null,
      2,
    ),
  );
});
