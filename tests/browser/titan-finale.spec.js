import { createHash } from "node:crypto";
import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
const html = readFileSync("dist/DCSMCRAFT-Standalone.html"),
  out = process.env.DCSMCRAFT_FINALE_ARTIFACTS || "test-results/finale";
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

test("reference arena, cinematic QTE and continuous chest-piercing defeat render in the game", async ({
  page,
}) => {
  test.setTimeout(300000);
  const evidence = await boot(page);
  await portal(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  const shots = [];
  for (const [name, stage, t] of [
    ["reference", "combat", 0],
    ["beam-qte", "combat", 0],
    ["pullback", "finale", 1.9],
    ["entry", "finale", 3.65],
    ["through-chest", "finale", 4.1],
    ["exit", "finale", 4.8],
    ["defeat", "finale", 6.85],
  ]) {
    const state = await page.evaluate(
      ({ name, stage, t }) => {
        const g = dcsmcraft,
          e = g.giganto,
          s = e.session,
          v = e.view;
        g.running = false;
        e.controls.clear();
        Object.assign(s.config, {
          graphicsQuality: "high",
          shadowQuality: "high",
          postProcessing: true,
          music: false,
          dynamicSky: false,
          arenaWeather: "clear",
          cinematics: true,
        });
        Object.assign(s, {
          stage,
          stageTime: Math.max(0, t - 1 / 60),
          time: 35,
          phase: name === "beam-qte" ? 2 : 1,
          emerald: true,
          idle: 999,
          attack: "idle",
          qte: null,
          counterScene: null,
          cinematicFrom: { x: -12, y: 64, z: 60 },
        });
        Object.assign(s.avatar, {
          x: -12,
          y: 64,
          z: 60,
          vx: 0,
          vy: 0,
          vz: 0,
          onGround: false,
          yaw: 0,
          pitch: 0,
        });
        if (name === "beam-qte") {
          s.attack = "beam";
          s.attackTime = 1.9;
          s.qte = { kind: "beam", left: 2.8, need: 12, hits: 5 };
        }
        g.renderer.gl.setPixelRatio(1);
        g.renderer.gl.setSize(1280, 720, false);
        v.camReady = false;
        if (stage === "finale") {
          g.running = true;
          e.frame(1 / 60);
          g.running = false;
        }
        for (let i = 0; i < 4; i++) {
          v.draw(s, 1 / 30);
          e.updateHUD();
        }
        g.renderer.gl.getContext().finish();
        return {
          stage: s.stage,
          position: { ...s.avatar },
          radius: v.finale.uniforms.radius.value,
          bossTilt: v.boss.rotation.x,
          opacity: v.boss.userData.materials.map((m) => m.opacity),
          mandatory: s.config.mandatoryCinematics,
          skip: e.input("skip"),
          hole: v.finale.hole.visible,
          calls: g.renderer.gl.info.render.calls,
        };
      },
      { name, stage, t },
    );
    shots.push({ name, ...state });
    await page.screenshot({ path: out + "/" + name + ".png" });
    expect(state.skip).toBe(false);
    expect(state.opacity.every((v) => v === 1)).toBe(true);
  }
  expect(shots.find((x) => x.name === "exit").position.z).toBeLessThan(-65);
  expect(shots.find((x) => x.name === "exit").radius).toBeGreaterThan(7);
  expect(shots.find((x) => x.name === "defeat").bossTilt).toBeLessThan(-0.6);
  expect(evidence.errors).toEqual([]);
  expect(evidence.external).toEqual([]);
  writeFileSync(
    out + "/finale-report.json",
    JSON.stringify(
      {
        htmlSHA256: createHash("sha256").update(html).digest("hex"),
        shots,
        errors: evidence.errors,
      },
      null,
      2,
    ),
  );
});

test("mandatory movies, live QTE inputs, mid-breach reload and natural victory restore the world exactly once", async ({
  page,
}) => {
  test.setTimeout(220000);
  const evidence = await boot(page);
  await portal(page);
  const movieChecks = await page.evaluate(() => {
    const g = dcsmcraft,
      e = g.giganto,
      s = e.session,
      results = [];
    Object.assign(s.config, {
      music: false,
      audio: false,
      dynamicSky: false,
      drain: 0,
      graphicsQuality: "low",
      postProcessing: false,
    });
    const advance = (n) => {
      g.running = true;
      g.ui.play();
      // Advance the native simulation/audio/HUD without rendering every catch-up
      // step on software WebGL. The separate visual case and full encounter
      // regression render the real animation path.
      const draw = e.view.draw;
      e.view.draw = () => {};
      try {
        for (let i = 0; i < n; i++) e.frame(1 / 60);
      } finally {
        e.view.draw = draw;
      }
      e.view.draw(s, 0);
      g.running = false;
    };
    for (const [stage, seconds, next] of [
      ["intro", 4.5, "traversal"],
      ["transform", 6, "combat"],
      ["phase", 4, "combat"],
    ]) {
      Object.assign(s, {
        stage,
        stageTime: 0,
        emerald: stage !== "intro",
        qte: null,
        counterScene: null,
        cinematicFrom: { ...s.avatar },
      });
      g.running = true;
      e.key("Enter");
      const skip = e.input("skip"),
        unchanged = s.stage === stage && s.stageTime === 0;
      advance(Math.ceil((seconds + 0.1) * 60));
      results.push({ stage, skip, unchanged, next: s.stage, expected: next });
    }
    Object.assign(s, {
      stage: "combat",
      stageTime: 0,
      emerald: true,
      idle: 999,
      attack: "beam",
      attackTime: 1.9,
      qte: { kind: "beam", left: 4.5, need: 12, hits: 0 },
      counterScene: null,
    });
    e.updateHUD();
    const before = document
      .querySelector("#titan-hud")
      .style.getPropertyValue("--qte-effort");
    for (let i = 0; i < 12; i++) {
      e.input("jump");
      advance(4);
    }
    const counter = !!s.counterScene,
      skipCounter = e.input("skip");
    advance(170);
    results.push({ counter, skipCounter, finished: !s.counterScene, before });
    Object.assign(s, {
      stage: "finale",
      stageTime: 0,
      won: false,
      cinematicFrom: { ...s.avatar },
      qte: null,
      counterScene: null,
    });
    advance(240);
    return results;
  });
  for (const r of movieChecks.slice(0, 3)) {
    expect(r.skip).toBe(false);
    expect(r.unchanged).toBe(true);
    expect(r.next).toBe(r.expected);
  }
  expect(movieChecks[3]).toMatchObject({
    counter: true,
    skipCounter: false,
    finished: true,
    before: "100",
  });
  await page.evaluate(async () => {
    dcsmcraft.pause();
    await dcsmcraft.save();
    window.finalSave = dcsmcraft.id;
  });
  await page.evaluate(async () => {
    await dcsmcraft.loadWorld(window.finalSave);
    dcsmcraft.pause();
  });
  await page.waitForFunction(() => dcsmcraft.giganto.view?.assetsReady);
  const resumed = await page.evaluate(() => {
    const g = dcsmcraft,
      e = g.giganto,
      s = e.session;
    const before = {
      stage: s.stage,
      time: s.stageTime,
      position: { ...s.avatar },
    };
    e.view.draw(s, 0);
    e.updateHUD();
    const radius = e.view.finale.uniforms.radius.value;
    g.running = true;
    g.ui.play();
    e.key("Enter");
    const skip = e.input("skip");
    const draw = e.view.draw;
    e.view.draw = () => {};
    try {
      for (let i = 0; i < 190; i++) e.frame(1 / 60);
    } finally {
      e.view.draw = draw;
    }
    e.view.draw(s, 0);
    g.running = false;
    return { before, radius, skip, stage: s.stage, won: s.won };
  });
  expect(resumed.before.stage).toBe("finale");
  expect(resumed.before.time).toBeCloseTo(4, 1);
  expect(resumed.radius).toBeGreaterThan(1);
  expect(resumed.skip).toBe(false);
  expect(resumed.stage).toBe("victory");
  expect(resumed.won).toBe(true);
  await page.locator("[data-titan=exit]").click();
  await page.waitForFunction(
    () => !dcsmcraft.giganto.active && !dcsmcraft.giganto.closing,
  );
  const returned = await page.evaluate(async () => {
    const g = dcsmcraft;
    g.pause();
    await g.save();
    return {
      health: g.player.health,
      ledger: g.giganto.record.ledger,
      duplicate: await g.giganto.exit(),
      hud: document.querySelector("#app").classList.contains("titan-active"),
    };
  });
  expect(returned).toEqual({
    health: 17,
    ledger: ["browser-titan"],
    duplicate: false,
    hud: false,
  });
  expect(evidence.errors).toEqual([]);
  expect(evidence.external).toEqual([]);
  writeFileSync(
    out + "/mandatory-report.json",
    JSON.stringify({ movieChecks, resumed, returned }, null, 2),
  );
});
