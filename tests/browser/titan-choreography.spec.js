import { createHash } from "node:crypto";
import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
const html = readFileSync("dist/DCSMCRAFT-Standalone.html"),
  out = process.env.DCSMCRAFT_CINEMA_ARTIFACTS || "test-results/choreography";
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

test("cinematic handoffs, new rig choreography and contact-energy shaders render from the exact standalone and pause without drift", async ({
  page,
}) => {
  test.setTimeout(300000);
  const ev = await boot(page);
  await portal(page);
  await page.setViewportSize({ width: 1280, height: 720 });
  const frames = [];
  for (const [name, stage, at] of [
    ["intro", "intro", 3.1],
    ["transform", "transform", 4.35],
    ["combat", "combat", 2],
    ["awakening", "phase", 2.2],
    ["grab-counter", "counter", 0.85],
    ["impact", "impact", 0.08],
    ["finisher", "finale", 3.65],
    ["aftermath", "victory", 1.5],
  ]) {
    const q = await page.evaluate(
      ({ name, stage, at }) => {
        const g = dcsmcraft,
          e = g.giganto,
          s = e.session,
          v = e.view;
        g.running = false;
        e.controls.clear();
        g.ui.play();
        Object.assign(s, {
          stage: ["counter", "impact"].includes(stage) ? "combat" : stage,
          stageTime: at,
          time: s.time + 2,
          emerald: stage !== "intro",
          won: stage === "victory",
          phase: ["phase", "finale", "victory"].includes(stage) ? 2 : 1,
          attack: "idle",
          action: "idle",
          actionTime: 0,
          strike: null,
          qte: null,
          counterScene: null,
          lock: true,
        });
        Object.assign(s.config, {
          graphicsQuality: "balanced",
          postProcessing: true,
          shadowQuality: "low",
          ambientOcclusion: "low",
          audio: false,
          music: false,
          dynamicSky: false,
          arenaWeather: "clear",
          motionBlur: false,
        });
        Object.assign(s.avatar, {
          x: 0,
          y: stage === "intro" ? 0.05 : stage === "transform" ? 94 : 57,
          z: stage === "intro" ? 78 : stage === "transform" ? 0 : 35,
          yaw: 0,
          pitch: 0,
          vx: 0,
          vy: 0,
          vz: 0,
          onGround: stage === "intro",
        });
        s.cinematicFrom = { ...s.avatar };
        if (stage === "counter")
          s.counterScene = {
            kind: "crunch",
            elapsed: at,
            from: { x: 0, y: 57, z: 35 },
            aim: {
              id: "torso",
              point: { x: 0, y: 58, z: 18 },
              normal: { x: 0, y: 0, z: 1 },
            },
            damage: 2300,
            serial: 17,
            landed: true,
            launched: true,
          };
        let maxStep = 0,
          prev = v.camera.position.clone();
        // Blend the incoming view without changing the fixed cinematic pose clock.
        for (let i = 0; i < 16; i++) {
          s.time += 1 / 8;
          v.draw(s, 1 / 8);
          maxStep = Math.max(maxStep, v.camera.position.distanceTo(prev));
          prev.copy(v.camera.position);
        }
        if (stage === "impact") {
          v.event(
            {
              type: "hit",
              kind: "finisher",
              point: { x: 0, y: 59, z: 22 },
              normal: { x: 0, y: 0, z: 1 },
              amount: 760,
              eventId: "native-flare",
            },
            s,
          );
          v.event(
            {
              type: "boom",
              point: { x: s.avatar.x, y: s.avatar.y + 1, z: s.avatar.z },
              normal: { x: 0, y: 0, z: -1 },
              serial: 200,
              eventId: "native-wave",
            },
            s,
          );
          s.projectiles = [
            {
              x: 0,
              y: 59,
              z: 28,
              vx: 0,
              vy: 0,
              vz: -150,
              life: 0.2,
              kind: "boom",
              serial: 200,
              contact: 1,
            },
          ];
          s.time += 0.04;
          v.draw(s, 1 / 60);
          v.draw(s, 0);
        }
        const before = {
          fov: v.camera.fov,
          camera: v.camera.position.toArray(),
          look: v.look.toArray(),
          stars: [...v.combatFlare.stars.instanceMatrix.array],
          bones: [...v.sonic.userData.bones.hip.quaternion.toArray()],
        };
        for (let i = 0; i < 5; i++) v.draw(s, 0);
        return {
          name,
          stage: s.stage,
          sonicClip: v.sonic.userData.currentClip,
          bossClip: v.boss.userData.currentClip,
          maxStep,
          fov: v.camera.fov,
          stars: v.combatFlare.stars.count,
          rings: v.combatFlare.rings.count,
          pauseDrift: Math.max(
            ...Object.values(before)
              .flat()
              .map((value, i) =>
                Math.abs(
                  value -
                    Object.values({
                      fov: v.camera.fov,
                      camera: v.camera.position.toArray(),
                      look: v.look.toArray(),
                      stars: [...v.combatFlare.stars.instanceMatrix.array],
                      bones: [
                        ...v.sonic.userData.bones.hip.quaternion.toArray(),
                      ],
                    }).flat()[i],
                ),
              ),
          ),
          bodyFrame: (() => {
            v.scene.updateMatrixWorld(true);
            return ["Head", "LeftFoot", "RightFoot"].map((name) =>
              v.sonic
                .getObjectByName(name)
                .getWorldPosition(v.sonic.position.clone())
                .project(v.camera)
                .toArray(),
            );
          })(),
          position: v.camera.position.toArray(),
          handoff: v.shotFlow.key,
          avatar: [s.avatar.x, s.avatar.y, s.avatar.z],
        };
      },
      { name, stage, at },
    );
    expect(q.pauseDrift).toBeLessThan(0.000001);
    expect(q.position.every(Number.isFinite)).toBe(true);
    expect(q.fov).toBeGreaterThan(40);
    expect(q.fov).toBeLessThan(80);
    if (name === "combat")
      for (const p of q.bodyFrame) {
        expect(Math.abs(p[0])).toBeLessThan(0.87);
        expect(Math.abs(p[1])).toBeLessThan(0.87);
      }
    frames.push(q);
    await page.screenshot({ path: out + "/" + name + ".png" });
  }
  expect(frames.find((f) => f.name === "transform").sonicClip).toBe(
    "transform",
  );
  expect(frames.find((f) => f.name === "awakening").bossClip).toBe("awakening");
  expect(frames.find((f) => f.name === "grab-counter").sonicClip).toBe(
    "counter_grab",
  );
  expect(frames.find((f) => f.name === "impact").stars).toBeGreaterThan(0);
  expect(ev.errors).toEqual([]);
  expect(ev.external).toEqual([]);
  writeFileSync(
    out + "/choreography-render-report.json",
    JSON.stringify(
      {
        htmlSHA256: createHash("sha256").update(html).digest("hex"),
        frames,
        errors: ev.errors,
      },
      null,
      2,
    ),
  );
});

test("a native grab counter survives save/reload, lands once with its new clip and releases control smoothly", async ({
  page,
}) => {
  test.setTimeout(180000);
  const ev = await boot(page);
  await portal(page);
  const saved = await page.evaluate(async () => {
    const g = dcsmcraft,
      e = g.giganto,
      s = e.session;
    g.running = false;
    e.controls.clear();
    g.ui.play();
    Object.assign(s, {
      stage: "combat",
      phase: 2,
      emerald: true,
      hp: 24000,
      stageTime: 20,
      time: 20,
      attack: "crunch",
      attackTime: 2,
      qte: { kind: "crunch", left: 3, hits: 8, need: 8 },
      idle: 999,
    });
    Object.assign(s.config, {
      audio: false,
      music: false,
      graphicsQuality: "low",
      postProcessing: false,
      shadowQuality: "off",
    });
    Object.assign(s.avatar, {
      x: 0,
      y: 57,
      z: 25,
      onGround: false,
      vx: 0,
      vy: 0,
      vz: 0,
    });
    g.running = true;
    e.frame(1 / 60);
    g.running = false;
    const draw = e.view.draw;
    e.view.draw = () => {};
    for (let i = 0; i < 22; i++) {
      g.running = true;
      e.frame(1 / 60);
      g.running = false;
    }
    e.view.draw = draw;
    e.view.draw(s, 0.3);
    await g.save();
    return {
      id: g.id,
      hp: s.hp,
      time: s.counterScene.elapsed,
      landed: s.counterScene.landed,
      original: JSON.stringify(s.original),
    };
  });
  expect(saved.landed).toBe(false);
  expect(saved.hp).toBe(24000);
  await page.evaluate(async (id) => {
    await dcsmcraft.loadWorld(id);
    dcsmcraft.pause();
  }, saved.id);
  await page.waitForFunction(() => dcsmcraft.giganto.view?.assetsReady);
  const completed = await page.evaluate(() => {
    const g = dcsmcraft,
      e = g.giganto,
      s = e.session;
    g.ui.play();
    g.running = false;
    const draw = e.view.draw;
    e.view.draw = () => {};
    let hits = 0;
    for (let i = 0; i < 100; i++) {
      g.running = true;
      e.frame(1 / 60);
      g.running = false;
      hits += s.events.filter(
        (x) => x.type === "hit" && x.kind === "struggle",
      ).length;
    }
    e.view.draw = draw;
    e.view.draw(s, 0.3);
    return {
      hp: s.hp,
      hits,
      counter: s.counterScene,
      original: JSON.stringify(s.original),
      canDodge: e.input("dodge"),
      flow: e.view.shotFlow.key,
    };
  });
  expect(completed.hp).toBe(21700);
  expect(completed.hits).toBe(1);
  expect(completed.counter).toBe(null);
  expect(completed.original).toBe(saved.original);
  expect(completed.canDodge).toBe(true);
  expect(completed.flow).toBe("gameplay");
  expect(ev.errors).toEqual([]);
  expect(ev.external).toEqual([]);
  writeFileSync(
    out + "/counter-reload-report.json",
    JSON.stringify(
      {
        htmlSHA256: createHash("sha256").update(html).digest("hex"),
        saved,
        completed,
        errors: ev.errors,
      },
      null,
      2,
    ),
  );
});
