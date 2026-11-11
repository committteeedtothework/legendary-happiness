import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
const html = readFileSync("dist/DCSMCRAFT-Standalone.html"),
  out = process.env.DCSMCRAFT_TEST_ARTIFACTS || "test-results/titan-evidence";
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
async function bot(page) {
  await page.evaluate(() => {
    window.titanBot = setInterval(() => {
      const g = dcsmcraft,
        e = g.giganto,
        s = e.session;
      if (!e.active || !s || !g.running) return;
      const k = e.controls,
        p = s.avatar;
      if (s.stage === "traversal") {
        const route = [
            [0, 0, 78],
            [0, 5, 59],
            [12, 12, 43],
            [26, 20, 27],
            [32, 28, 9],
            [30, 36, -9],
            [22, 44, -25],
            [4, 52, -33],
            [-18, 60, -25],
            [-28, 68, -2],
            [-18, 76, 19],
            [-4, 84, 18],
            [0, 92, 0],
          ],
          gathering = s.route === 0 && s.rings < Math.min(360, s.config.rings),
          candidates = Array.from({ length: 36 }, (_, i) => {
            const row = Math.floor(i / 12),
              a = ((i % 12) / 12) * Math.PI * 2 + row * 0.12,
              r = 35 + row * 28;
            return { id: i, x: Math.sin(a) * r, z: Math.cos(a) * r };
          }).filter((r) => !s.ringPickups.includes(r.id)),
          ring = gathering
            ? candidates.sort(
                (a, b) =>
                  Math.hypot(a.x - p.x, a.z - p.z) -
                  Math.hypot(b.x - p.x, b.z - p.z),
              )[0]
            : null,
          q = ring ? [ring.x, 0, ring.z] : route[s.route + 1];
        if (s.config.climbMode === "armor" && !ring) {
          k.delete("Space");
          if (s.climb?.attached) {
            k.add("KeyW");
            k.add("ShiftLeft");
            return;
          }
          const contact = e.view.climbSurface?.guide?.[0];
          if (!contact) return;
          const b = s.boss,
            local = {
              x: contact.point.x + contact.normal.x * 1.5,
              z: contact.point.z + contact.normal.z * 1.5,
            },
            target = {
              x: b.x + local.x * Math.cos(b.yaw) + local.z * Math.sin(b.yaw),
              z: b.z + local.z * Math.cos(b.yaw) - local.x * Math.sin(b.yaw),
            },
            dx = target.x - p.x,
            dz = target.z - p.z;
          p.yaw = Math.atan2(-dx, -dz);
          k.add("KeyW");
          if (Math.hypot(dx, dz) > 6) k.add("ShiftLeft");
          else k.delete("ShiftLeft");
          return;
        }
        if (!q) return;
        const dx = q[0] - p.x,
          dz = q[2] - p.z,
          d = Math.hypot(dx, dz);
        if (d > 1) p.yaw = Math.atan2(-dx, -dz);
        if (d > 1.3) k.add("KeyW");
        else k.delete("KeyW");
        if (d > 4) k.add("ShiftLeft");
        else k.delete("ShiftLeft");
        if (p.onGround && !ring) {
          dispatchEvent(
            new KeyboardEvent("keydown", { code: "Space", bubbles: true }),
          );
          dispatchEvent(
            new KeyboardEvent("keyup", { code: "Space", bubbles: true }),
          );
        }
      } else if (s.stage === "combat") {
        k.delete("ShiftLeft");
        k.add("Mouse0");
        k.add("Mouse2");
        if (s.qte) {
          dispatchEvent(
            new KeyboardEvent("keydown", { code: "Space", bubbles: true }),
          );
          dispatchEvent(
            new KeyboardEvent("keyup", { code: "Space", bubbles: true }),
          );
          return;
        }
        const b = s.boss || { x: 0, z: 0, yaw: 0 },
          dx = b.x + Math.sin(b.yaw) * 5 - p.x,
          dz = b.z + Math.cos(b.yaw) * 5 - p.z,
          d = Math.hypot(dx, dz);
        if (d > 1) p.yaw = Math.atan2(-dx, -dz);
        if (d > 2) k.add("KeyW");
        else k.delete("KeyW");
        if (p.y < 56) k.add("Space");
        else k.delete("Space");
        if (p.y > 58) k.add("ControlLeft");
        else k.delete("ControlLeft");
        for (const code of ["KeyR", "KeyF", "KeyE"]) {
          dispatchEvent(new KeyboardEvent("keydown", { code, bubbles: true }));
          dispatchEvent(new KeyboardEvent("keyup", { code, bubbles: true }));
        }
      }
    }, 70);
  });
}
test("normal boost has arms back, idle holds position and deforming armor anchors survive pause and reload", async ({
  page,
}) => {
  test.setTimeout(240000);
  const evidence = await boot(page);
  await portal(page);
  const first = await page.evaluate(async () => {
    const g = dcsmcraft,
      e = g.giganto,
      s = e.session,
      v = e.view;
    g.running = false;
    e.input("skip");
    Object.assign(s.config, {
      music: false,
      graphicsQuality: "low",
      shadowQuality: "off",
      postProcessing: false,
    });
    g.renderer.gl.setPixelRatio(1);
    g.renderer.gl.setSize(800, 500, false);
    Object.assign(s.avatar, {
      x: 45,
      y: 0,
      z: 30,
      vx: 0,
      vy: 0,
      vz: 0,
      onGround: true,
      yaw: Math.PI,
    });
    e.controls.add("KeyW");
    e.controls.add("ShiftLeft");
    g.running = true;
    for (let i = 0; i < 90; i++) e.frame(1 / 60);
    const r = v.sonic,
      u = r.userData;
    const hands = ["L", "R"].map((side) => {
      const p = r.worldToLocal(
          u.bones["hand" + side].getWorldPosition(r.position.clone()),
        ),
        shoulder = r.worldToLocal(
          u.bones["arm" + side].getWorldPosition(r.position.clone()),
        );
      return { side, x: p.x, y: p.y, z: p.z, behind: shoulder.z - p.z };
    });
    const boost = { clip: u.currentClip, hands };
    // Capture a close side view using the existing renderer, then let the next
    // arena frame restore the normal camera. No test-only rendering in game code.
    v.camera.position.set(
      r.position.x + 6,
      r.position.y + 2.7,
      r.position.z + 4,
    );
    v.camera.lookAt(r.position.x, r.position.y + 1.8, r.position.z);
    g.renderer.gl.render(v.scene, v.camera);
    const image = g.renderer.gl.domElement.toDataURL("image/png");
    e.controls.clear();
    for (let i = 0; i < 150; i++) e.frame(1 / 60);
    const idle = { ...s.avatar };
    for (let i = 0; i < 90; i++) e.frame(1 / 60);
    const drift = Math.hypot(
      s.avatar.x - idle.x,
      s.avatar.y - idle.y,
      s.avatar.z - idle.z,
    );
    // Approach a real ankle, then use only the regular movement controls.
    const q = v.climbSurface.guide[0],
      b = s.boss,
      x = q.point.x + q.normal.x * 1.5,
      z = q.point.z + q.normal.z * 1.5;
    Object.assign(s.avatar, {
      x: b.x + x * Math.cos(b.yaw) + z * Math.sin(b.yaw),
      y: 0,
      z: b.z + z * Math.cos(b.yaw) - x * Math.sin(b.yaw),
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: Math.PI,
      onGround: true,
    });
    e.controls.add("KeyW");
    e.controls.add("ShiftLeft");
    for (let i = 0; i < 180 && s.avatar.y < 45; i++) e.frame(1 / 60);
    e.controls.clear();
    e.frame(1 / 60);
    if (!s.climb.attached) throw Error("Climber failed to grip");
    const triangle = s.climb.triangle,
      weights = { ...s.climb.barycentric },
      point = { ...s.climb.point };
    for (let i = 0; i < 90; i++) e.frame(1 / 60);
    const attached = {
      triangle: s.climb.triangle,
      weights: { ...s.climb.barycentric },
      motion: Math.hypot(
        s.climb.point.x - point.x,
        s.climb.point.y - point.y,
        s.climb.point.z - point.z,
      ),
      rigClip: v.boss.userData.currentClip,
      sonicClip: u.currentClip,
    };
    g.running = false;
    const time = s.time,
      p = { ...s.avatar };
    e.frame(0.5);
    const pauseFrozen =
      s.time === time && ["x", "y", "z"].every((k) => s.avatar[k] === p[k]);
    await g.save();
    return {
      id: g.id,
      boost,
      drift,
      triangle,
      weights,
      attached,
      pauseFrozen,
      avatar: { ...s.avatar },
      image,
    };
  });
  writeFileSync(
    out + "/normal-boost.png",
    Buffer.from(first.image.split(",")[1], "base64"),
  );
  delete first.image;
  expect(first.boost.clip).toBe("boost_run");
  for (const h of first.boost.hands) {
    expect(h.z).toBeLessThan(-0.2);
    expect(h.behind).toBeGreaterThan(0.6);
  }
  expect(first.drift).toBeLessThan(0.01);
  expect(first.attached.triangle).toBe(first.triangle);
  expect(first.attached.weights).toEqual(first.weights);
  expect(first.attached.motion).toBeGreaterThan(0.005);
  expect(first.attached.rigClip).toBe("climb_motion");
  expect(first.attached.sonicClip).toBe("wall_idle");
  expect(first.pauseFrozen).toBe(true);
  await page.evaluate(async (id) => {
    await dcsmcraft.loadWorld(id);
    dcsmcraft.pause();
  }, first.id);
  await page.waitForFunction(() => dcsmcraft.giganto.view.assetsReady);
  await page.locator("[data-titan=resume]").click();
  const last = await page.evaluate(() => {
    const g = dcsmcraft,
      e = g.giganto,
      s = e.session;
    g.running = false;
    const before = { ...s.avatar };
    g.running = true;
    e.frame(1 / 60);
    g.running = false;
    return {
      triangle: s.climb.triangle,
      weights: s.climb.barycentric,
      attached: s.climb.attached,
      gap: Math.hypot(
        s.avatar.x - before.x,
        s.avatar.y - before.y,
        s.avatar.z - before.z,
      ),
      clip: e.view.boss.userData.currentClip,
    };
  });
  expect(last.attached).toBe(true);
  expect(last.triangle).toBe(first.triangle);
  expect(last.weights).toEqual(first.weights);
  expect(last.gap).toBeLessThan(0.2);
  expect(last.clip).toBe("climb_motion");
  expect(evidence.errors).toEqual([]);
  expect(evidence.external).toEqual([]);
  writeFileSync(
    out + "/articulation-report.json",
    JSON.stringify({ first, last }, null, 2),
  );
});

test("playable portal → Sonic traversal → final Emerald → Super Sonic → both combat phases → victory → exactly-once reward and original-world return", async ({
  page,
}) => {
  test.setTimeout(650000);
  const evidence = await boot(page);
  const original = await page.evaluate(() => ({
    dimension: dcsmcraft.dimension,
    time: dcsmcraft.time,
    seed: dcsmcraft.world.seed,
  }));
  await portal(page);
  const entryTime = await page.evaluate(() => {
    dcsmcraft.giganto.session.config.music = true;
    dcsmcraft.giganto.session.config.musicVolume = 0.45;
    dcsmcraft.giganto.session.config.masterVolume = 0.03;
    return dcsmcraft.time;
  });
  await expect(page.locator("#titan-hud")).toBeVisible();
  expect(
    await page.evaluate(() => [
      dcsmcraft.giganto.view.sonic.userData.imported,
      dcsmcraft.giganto.view.boss.userData.imported,
    ]),
  ).toEqual([true, true]);
  expect(
    await page.locator("#hud").evaluate((n) => getComputedStyle(n).visibility),
  ).toBe("hidden");
  await page.screenshot({ path: out + "/intro.png" });
  await page.keyboard.press("Enter");
  await bot(page);
  try {
    await page.waitForFunction(() => dcsmcraft.giganto.session.emerald, null, {
      timeout: 210000,
    });
  } catch (error) {
    writeFileSync(
      out + "/failed-ascent-state.json",
      JSON.stringify(
        await page.evaluate(() => {
          const s = dcsmcraft.giganto.session;
          return {
            stage: s.stage,
            time: s.time,
            avatar: s.avatar,
            climb: s.climb,
            route: s.route,
            rings: s.rings,
            controls: [...dcsmcraft.giganto.controls],
          };
        }),
        null,
        2,
      ),
    );
    throw error;
  }
  await page.screenshot({ path: out + "/transformation.png" });
  await page.waitForFunction(
    () => dcsmcraft.giganto.audio.score?.state === "playing",
  );
  const openingMusic = await page.evaluate(() => ({
    section: dcsmcraft.giganto.audio.score.current.section,
    duration: dcsmcraft.giganto.audio.score.buffer.duration,
    channels: dcsmcraft.giganto.audio.score.buffer.numberOfChannels,
  }));
  expect(openingMusic.section).toBe("phaseOne");
  expect(openingMusic.duration).toBeGreaterThan(264);
  expect(openingMusic.channels).toBe(2);

  await page.waitForFunction(
    () => dcsmcraft.giganto.session.phase === 2,
    null,
    {
      timeout: 240000,
    },
  );
  await page.screenshot({ path: out + "/phase-two.png" });
  await page.waitForFunction(
    () =>
      dcsmcraft.giganto.session.stage === "combat" &&
      dcsmcraft.giganto.session.phase === 2,
  );
  await page.screenshot({ path: out + "/combat-camera.png" });
  await page.waitForFunction(
    () => dcsmcraft.giganto.session.stage === "victory",
    null,
    { timeout: 300000 },
  );
  await expect(page.locator("[data-titan=exit]")).toBeVisible();
  await page.screenshot({ path: out + "/victory.png" });
  await page.evaluate(() => clearInterval(window.titanBot));
  const before = await page.evaluate(() => {
    const g = dcsmcraft;
    return {
      hp: g.player.health,
      time: g.time,
      rings: g.giganto.session.rings,
      route: g.giganto.session.route,
      pickups: g.giganto.session.ringPickups.length,
      battleSeconds: g.giganto.session.time,
      hpMaximum: g.giganto.session.maxHp,
      geometry: g.renderer.gl.info.render.calls,
      music: {
        starts: g.giganto.audio.score?.starts,
        state: g.giganto.audio.score?.state,
        stopped: g.giganto.audio.score?.current === null,
      },
    };
  });
  expect(before.hp).toBe(17);
  expect(before.time).toBe(entryTime);
  expect(before.route).toBe(12);
  expect(before.pickups).toBeGreaterThanOrEqual(28);
  expect(before.hpMaximum).toBe(12000);
  expect(before.battleSeconds).toBeGreaterThan(90);
  expect(before.geometry).toBeLessThan(380);
  expect(before.music.starts).toBeGreaterThanOrEqual(3);
  expect(before.music.starts).toBeLessThanOrEqual(4);
  expect(before.music.stopped).toBe(true);
  await page.locator("[data-titan=exit]").click();
  await page.waitForFunction(
    () => !dcsmcraft.giganto.active && !dcsmcraft.giganto.closing,
  );
  const restored = await page.evaluate(async () => {
    const g = dcsmcraft;
    g.pause();
    await g.save();
    return {
      id: g.id,
      health: g.player.health,
      dimension: g.dimension,
      seed: g.world.seed,
      ledger: g.giganto.record.ledger,
      inventory: g.inventory.export(),
      duplicateExit: await g.giganto.exit(),
      cooldown: g.giganto.record.cooldownUntil - g.tickCount,
    };
  });
  expect(restored.health).toBe(17);
  expect(restored.dimension).toBe(original.dimension);
  expect(restored.seed).toBe(original.seed);
  expect(restored.ledger).toEqual(["browser-titan"]);
  expect(restored.duplicateExit).toBe(false);
  expect(restored.inventory.slots[0].enchantments.sharpness).toBe(2);
  expect(
    restored.inventory.slots
      .filter((q) => q?.id === "diamond")
      .reduce((n, q) => n + q.count, 0),
  ).toBe(6);
  expect(
    restored.inventory.slots
      .filter((q) => q?.id === "hellfire_ingot")
      .reduce((n, q) => n + q.count, 0),
  ).toBe(8);
  await page.evaluate(async (id) => {
    await dcsmcraft.loadWorld(id);
    dcsmcraft.pause();
  }, restored.id);
  expect(
    await page.evaluate(() => dcsmcraft.giganto.record.ledger.length),
  ).toBe(1);
  expect(evidence.errors).toEqual([]);
  expect(evidence.external).toEqual([]);
  writeFileSync(
    out + "/victory-report.json",
    JSON.stringify({ before, restored }, null, 2),
  );
});
test("arena saves resume fairly, pause freezes resources, and forfeit restores equipment without rewards", async ({
  page,
}) => {
  test.setTimeout(150000);
  const evidence = await boot(page);
  await portal(page);
  await page.keyboard.press("Enter");
  await page.evaluate(async () => {
    const g = dcsmcraft;
    g.pause();
    await g.save();
    window.arenaSaveId = g.id;
  });
  await page.evaluate(async () => {
    await dcsmcraft.loadWorld(window.arenaSaveId);
    dcsmcraft.pause();
  });
  expect(
    await page.evaluate(
      () =>
        dcsmcraft.giganto.active &&
        dcsmcraft.giganto.session.stage === "traversal",
    ),
  ).toBe(true);
  const paused = await page.evaluate(() => ({
    time: dcsmcraft.giganto.session.time,
    rings: dcsmcraft.giganto.session.rings,
  }));
  await page.waitForTimeout(200);
  expect(
    await page.evaluate(() => ({
      time: dcsmcraft.giganto.session.time,
      rings: dcsmcraft.giganto.session.rings,
    })),
  ).toEqual(paused);
  await page.locator("[data-titan=exit]").click();
  await page.waitForFunction(() => !dcsmcraft.giganto.active);
  expect(await page.evaluate(() => dcsmcraft.player.health)).toBe(17);
  expect(
    await page.evaluate(() => dcsmcraft.giganto.record.ledger.length),
  ).toBe(0);
  expect(evidence.errors).toEqual([]);
  expect(evidence.external).toEqual([]);
});

test("defeat retries the saved phase checkpoint; failed victory saves roll back rewards, and full inventories receive exactly one persistent overflow drop per reward", async ({
  page,
}) => {
  test.setTimeout(150000);
  const evidence = await boot(page);
  await portal(page, true);
  await page.evaluate(() => {
    const e = dcsmcraft.giganto,
      s = e.session;
    s.stage = "combat";
    s.emerald = true;
    s.phase = 2;
    s.checkpoint = "phase2";
    s.hp = s.maxHp / 2;
    s.rings = 0.0001;
    s.config.drain = 3;
  });
  await page.waitForFunction(
    () =>
      dcsmcraft.ui.screen === "titan-result" &&
      dcsmcraft.giganto.session.stage === "defeat",
  );
  await page.locator("[data-titan=retry]").click();
  expect(
    await page.evaluate(() => [
      dcsmcraft.giganto.session.phase,
      dcsmcraft.giganto.session.stage,
    ]),
  ).toEqual([2, "combat"]);
  await page.evaluate(() => {
    const g = dcsmcraft;
    g.giganto.session.stage = "victory";
    g.giganto.session.won = true;
    g.giganto.renderResultIfNeeded();
    window.realSave = g.store.save.bind(g.store);
    g.store.save = async () => {
      throw Error("simulated interrupted save");
    };
  });
  await page.locator("[data-titan=exit]").click();
  await page.waitForFunction(() => !dcsmcraft.giganto.closing);
  expect(
    await page.evaluate(() => ({
      active: dcsmcraft.giganto.active,
      ledger: dcsmcraft.giganto.record.ledger.length,
      drops: dcsmcraft.drops.filter((d) => d.uid?.startsWith("titan:")).length,
    })),
  ).toEqual({ active: true, ledger: 0, drops: 0 });
  await page.evaluate(() => (dcsmcraft.store.save = window.realSave));
  await page.locator("[data-titan=exit]").click();
  await page.waitForFunction(
    () => !dcsmcraft.giganto.active && !dcsmcraft.giganto.closing,
  );
  const result = await page.evaluate(async () => {
    const g = dcsmcraft;
    g.pause();
    await g.save();
    const id = g.id;
    await g.loadWorld(id);
    g.pause();
    return {
      ledger: g.giganto.record.ledger.length,
      items: g.drops
        .filter((d) => d.uid?.startsWith("titan:"))
        .map((d) => ({ id: d.id, count: d.count, uid: d.uid })),
      again: await g.giganto.exit(),
      health: g.player.health,
    };
  });
  expect(result.ledger).toBe(1);
  expect(result.items.map((q) => [q.id, q.count]).sort()).toEqual([
    ["diamond", 6],
    ["hellfire_ingot", 8],
  ]);
  expect(new Set(result.items.map((q) => q.uid)).size).toBe(2);
  expect(result.again).toBe(false);
  expect(result.health).toBe(17);
  expect(evidence.errors).toEqual([]);
  expect(evidence.external).toEqual([]);
  writeFileSync(out + "/recovery-report.json", JSON.stringify(result, null, 2));
});

test("portal settings and seeded natural placement validate every occupied cell, enforce single encounter/cooldown and reject co-op activation", async ({
  page,
}) => {
  test.setTimeout(120000);
  const evidence = await boot(page);
  const result = await page.evaluate(async () => {
    const g = dcsmcraft,
      e = g.giganto;
    g.dimension = "overworld";
    const originalTerrain = g.world.terrain.bind(g.world);
    g.world.terrain = (x, z) => ({ ...originalTerrain(x, z), h: 199 });
    for (let x = -40; x <= 100; x++)
      for (let z = -40; z <= 100; z++) {
        g.world.set(x, 199, z, 3);
        for (let y = 200; y < 205; y++) g.world.set(x, y, z, 0);
      }
    e.record.config.spawnChance = 1;
    const found = e.findPortal(true),
      p = e.record.portal;
    const duplicate = e.findPortal(true);
    g.player.x = p.x + 0.5;
    g.player.y = p.y;
    g.player.z = p.z + 2;
    g.player.onGround = true;
    g.running = true;
    e.overworld(0.01);
    g.world.set(p.x + 1, p.y + 2, p.z, 3);
    const blocked = await e.enter();
    g.world.set(p.x + 1, p.y + 2, p.z, 0);
    g.multiplayer.connected = true;
    const coop = await e.enter();
    g.multiplayer.connected = false;
    e.record.cooldownUntil = g.tickCount + 100;
    const cooldown = await e.enter();
    g.world.terrain = originalTerrain;
    return { found, duplicate, blocked, coop, cooldown, active: e.active };
  });
  expect(result).toEqual({
    found: true,
    duplicate: false,
    blocked: false,
    coop: false,
    cooldown: false,
    active: false,
  });
  await page.evaluate(() => dcsmcraft.pause());
  await page.locator("[data-action=titan-menu]").click();
  await expect(page.locator("[data-titan-config=drain]")).toBeVisible();
  await page.locator("[data-titan-config=drain]").fill("0");
  await page.locator("[data-titan-config=drain]").dispatchEvent("change");
  expect(await page.evaluate(() => dcsmcraft.giganto.record.config.drain)).toBe(
    0,
  );
  expect(evidence.errors).toEqual([]);
  expect(evidence.external).toEqual([]);
});

test("reference-image visual fixture keeps Super Sonic readable in the foreground, fans lasers from animated emitters and restores the shared renderer", async ({
  page,
}) => {
  test.setTimeout(240000);
  const evidence = await boot(page);
  await portal(page);
  const report = await page.evaluate(() => {
    const g = dcsmcraft,
      e = g.giganto,
      s = e.session,
      r = g.renderer;
    // Art inspection fixture, separate from the physical traversal playthrough.
    g.running = false;
    s.stage = "combat";
    s.phase = 2;
    s.emerald = true;
    s.stageTime = 2;
    s.attack = "idle";
    Object.assign(s.avatar, {
      x: -12,
      y: 64,
      z: 45,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: 0,
      pitch: 0,
    });
    s.config.shadowQuality = "high";
    g.settings.graphics = 3;
    g.settings.maxPixelRatio = 1;
    r.applyGraphics();
    const mapping = r.gl.toneMapping,
      exposure = r.gl.toneMappingExposure;
    const frameTimes = [];
    for (let n = 0; n < 12; n++) {
      const start = performance.now();
      s.time += 1 / 60;
      e.view.draw(s, 1 / 60);
      r.gl.getContext().finish();
      if (n > 4) frameTimes.push(performance.now() - start);
    }
    frameTimes.sort((a, b) => a - b);
    return {
      renderer: r.gl.getContext().getParameter(r.gl.getContext().RENDERER),
      renderSize: [r.gl.domElement.width, r.gl.domElement.height],
      medianFrameMs: frameTimes[Math.floor(frameTimes.length * 0.5)],
      p95FrameMs: frameTimes[Math.floor(frameTimes.length * 0.95)],
      image: r.gl.domElement.toDataURL("image/png"),
      mappingRestored: r.gl.toneMapping === mapping,
      exposureRestored: r.gl.toneMappingExposure === exposure,
      lasers: e.view.backFan.count,
      corona: e.view.corona.count,
      padsVisible: e.view.arena.userData.platforms.visible,
      camera: e.view.camera.position.toArray(),
      drawCalls: r.gl.info.render.calls,
    };
  });
  writeFileSync(
    out + "/reference-composition.png",
    Buffer.from(report.image.split(",")[1], "base64"),
  );
  delete report.image;
  await page.screenshot({ path: out + "/reference-hud.png" });
  await page.setViewportSize({ width: 854, height: 480 });
  await page.screenshot({ path: out + "/compact-hud.png" });
  await page.setViewportSize({ width: 1280, height: 800 });
  expect(report.mappingRestored).toBe(true);
  expect(report.exposureRestored).toBe(true);
  expect(report.padsVisible).toBe(false);
  expect(report.lasers).toBe(30);
  expect(report.corona).toBe(48);
  expect(report.drawCalls).toBeLessThan(200);
  expect(evidence.errors).toEqual([]);
  expect(evidence.external).toEqual([]);
  writeFileSync(out + "/visual-report.json", JSON.stringify(report, null, 2));
});

test("every imported animation renders with embedded textures, finite rig transforms and bounded geometry; model contact sheets and software-render timing", async ({
  page,
}) => {
  test.setTimeout(180000);
  const evidence = await boot(page);
  await portal(page);
  const report = await page.evaluate(async () => {
    const g = dcsmcraft,
      v = g.giganto.view,
      gl = g.renderer.gl;
    g.running = false;
    const originalSize = { w: gl.domElement.width, h: gl.domElement.height },
      oldPixel = gl.getPixelRatio(),
      oldShadows = gl.shadowMap.enabled;
    gl.shadowMap.enabled = false;
    gl.setPixelRatio(1);
    gl.setSize(320, 320, false);
    const scene = new v.scene.constructor();
    scene.background = v.scene.background.clone();
    scene.add(v.light.clone());
    const hemi = v.scene.children.find((o) => o.isHemisphereLight);
    scene.add(hemi.clone());
    const results = {};
    for (const role of ["sonic", "giganto"]) {
      const root = role === "sonic" ? v.sonic : v.boss,
        u = root.userData,
        parent = root.parent;
      scene.add(root);
      root.position.set(0, 0, 0);
      root.rotation.set(0, 0, 0);
      const height = u.metadata.height,
        camera = v.camera.clone();
      camera.aspect = 1;
      camera.position.set(height * 0.32, height * 0.54, height * 1.7);
      camera.lookAt(0, height * 0.48, 0);
      camera.updateProjectionMatrix();
      const names = [...u.actions.keys()],
        canvas = document.createElement("canvas");
      canvas.width = 6 * 320;
      canvas.height = Math.ceil(names.length / 6) * 352;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#151f2d";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const clips = [],
        timings = [];
      const images = [];
      root.traverse((o) => {
        if (o.isMesh) {
          for (const m of Array.isArray(o.material) ? o.material : [o.material])
            for (const k of ["map", "normalMap", "emissiveMap"])
              if (m[k])
                images.push({
                  material: m.name,
                  kind: k,
                  width: m[k].image.width,
                  height: m[k].image.height,
                });
        }
      });
      for (let i = 0; i < names.length; i++) {
        const name = names[i],
          action = u.actions.get(name),
          clip = action.getClip();
        u.mixer.stopAllAction();
        action.reset().play().setEffectiveWeight(1).setEffectiveTimeScale(1);
        const gold =
          role === "sonic" &&
          [
            "transform",
            "fly",
            "parry",
            "super_quills",
            "counter",
            "sonic_boom",
            "brace_beam",
            "brace_grab",
            "counter_break",
            "finale_strike",
          ].includes(name);
        if (role === "sonic") {
          for (const [m, blue] of u.blueMaterials)
            m.material = gold ? u.superMaterial : blue;
          if (gold && name !== "super_quills")
            u.actions.get("super_quills").reset().play();
        }
        const samples = [];
        for (const fraction of [0.05, 0.5, 0.95]) {
          u.mixer.setTime(clip.duration * fraction);
          root.updateMatrixWorld(true);
          let finite = true,
            skins = 0;
          root.traverse((o) => {
            if (o.isSkinnedMesh) {
              o.skeleton.update();
              skins++;
              finite &&= o.skeleton.boneMatrices.every(Number.isFinite);
            }
          });
          gl.info.reset();
          const start = performance.now();
          gl.render(scene, camera);
          gl.getContext().finish();
          timings.push(performance.now() - start);
          samples.push({
            fraction,
            finite,
            skins,
            triangles: gl.info.render.triangles,
            calls: gl.info.render.calls,
          });
          if (fraction === 0.5) {
            ctx.drawImage(
              gl.domElement,
              (i % 6) * 320,
              Math.floor(i / 6) * 352,
              320,
              320,
            );
            ctx.fillStyle = "#ffffff";
            ctx.font = "16px monospace";
            ctx.fillText(
              name,
              (i % 6) * 320 + 8,
              Math.floor(i / 6) * 352 + 340,
            );
          }
        }
        clips.push({ name, duration: clip.duration, samples });
      }
      parent.add(root);
      u.mixer.stopAllAction();
      timings.sort((a, b) => a - b);
      results[role] = {
        clips,
        images,
        medianRenderMs: timings[Math.floor(timings.length * 0.5)],
        p95RenderMs: timings[Math.floor(timings.length * 0.95)],
        contactSheet: canvas.toDataURL("image/png"),
      };
    }
    gl.shadowMap.enabled = oldShadows;
    gl.setPixelRatio(oldPixel);
    gl.setSize(originalSize.w / oldPixel, originalSize.h / oldPixel, false);
    return results;
  });
  for (const role of ["sonic", "giganto"]) {
    const r = report[role];
    writeFileSync(
      out + "/" + role + "-all-clips.png",
      Buffer.from(r.contactSheet.split(",")[1], "base64"),
    );
    delete r.contactSheet;
    expect(r.images.length).toBeGreaterThan(0);
    expect(r.images.every((i) => i.width > 0 && i.height > 0)).toBe(true);
    expect(r.clips.length).toBe(role === "sonic" ? 48 : 36);
    for (const clip of r.clips)
      for (const sample of clip.samples) {
        expect(sample.finite, role + " " + clip.name).toBe(true);
        expect(sample.skins).toBeGreaterThan(0);
        expect(sample.triangles).toBeLessThan(role === "sonic" ? 30000 : 60000);
        expect(sample.calls).toBeLessThan(40);
      }
  }
  expect(evidence.errors).toEqual([]);
  expect(evidence.external).toEqual([]);
  writeFileSync(
    out + "/all-clips-report.json",
    JSON.stringify(report, null, 2),
  );
});

test("real supplied MP3 decodes locally, emits non-silent stereo, follows phase cues and pause, restores a long checkpoint and releases on exit", async ({
  page,
}) => {
  test.setTimeout(150000);
  const evidence = await boot(page);
  await portal(page);
  await page.evaluate(() => {
    const g = dcsmcraft,
      e = g.giganto;
    e.session.config.masterVolume = 0.05;
    e.session.config.music = true;
    e.session.config.musicVolume = 0.45;
    g.audio.unlock();
    // Controlled audio fixture: hold simulation still and drive the real audio
    // module with actual session states. The first case is the natural fight.
    e.realFrame = e.frame;
    e.frame = () => {};
    e.session.stage = "combat";
    e.session.stageTime = 1;
    e.session.emerald = true;
    e.audio.frame(e.session, true);
  });
  await page.waitForFunction(() => !!dcsmcraft.giganto.audio.score?.buffer);
  await page.evaluate(() =>
    dcsmcraft.giganto.audio.frame(dcsmcraft.giganto.session, true),
  );
  const decoded = await page.evaluate(() => {
    const e = dcsmcraft.giganto,
      a = e.audio.score,
      c = dcsmcraft.audio.context;
    const analyser = c.createAnalyser();
    analyser.fftSize = 2048;
    a.current.gain.connect(analyser);
    window.scoreAnalyser = analyser;
    return {
      duration: a.buffer.duration,
      sampleRate: a.buffer.sampleRate,
      channels: a.buffer.numberOfChannels,
      bytes: a.buffer.length * a.buffer.numberOfChannels * 4,
      section: a.current.section,
      offset: a.current.offset,
      starts: a.starts,
    };
  });
  expect(decoded.section).toBe("phaseOne");
  expect(decoded.offset).toBeGreaterThanOrEqual(1);
  expect(decoded.offset).toBeLessThan(20);
  expect(decoded.channels).toBe(2);
  await page.waitForFunction(() => {
    const data = new Float32Array(2048);
    scoreAnalyser.getFloatTimeDomainData(data);
    return data.some((x) => Math.abs(x) > 0.0001);
  });
  const levels = await page.evaluate(() => {
    const d = new Float32Array(2048);
    scoreAnalyser.getFloatTimeDomainData(d);
    scoreAnalyser.disconnect();
    return Math.sqrt(d.reduce((a, x) => a + x * x, 0) / d.length);
  });
  expect(levels).toBeGreaterThan(0.0001);
  const cues = await page.evaluate(() => {
    const e = dcsmcraft.giganto,
      s = e.session,
      a = e.audio.score;
    a.update(s, false, e.audio.settings(s));
    const paused = a.current === null;
    const pausedOffset = s.battleMusic.offset;
    a.update(s, true, e.audio.settings(s));
    const resumed = a.current.offset;
    s.phase = 2;
    s.stage = "phase";
    s.stageTime = 0;
    a.update(s, true, e.audio.settings(s));
    const pickup = a.current.offset;
    s.stage = "combat";
    s.stageTime = 0;
    a.update(s, true, e.audio.settings(s));
    const chorus = a.current.offset;
    s.stage = "finale";
    s.stageTime = 0;
    a.update(s, true, e.audio.settings(s));
    const finale = a.current.offset;
    s.config.music = false;
    a.update(s, true, e.audio.settings(s));
    const muted = a.current === null;
    s.config.music = true;
    s.stage = "combat";
    s.stageTime = 450.4;
    s.phase = 2;
    s.emerald = true;
    s.checkpoint = "phase2";
    return { paused, pausedOffset, resumed, pickup, chorus, finale, muted };
  });
  expect(cues.paused).toBe(true);
  expect(cues.resumed).toBe(cues.pausedOffset);
  expect(cues.resumed).toBeGreaterThanOrEqual(1);
  expect(cues.pickup).toBe(121);
  expect(cues.chorus).toBe(121);
  expect(cues.finale).toBe(237);
  expect(cues.muted).toBe(true);
  const id = await page.evaluate(async () => {
    const g = dcsmcraft;
    g.pause();
    await g.save();
    g.giganto.frame = g.giganto.realFrame;
    return g.id;
  });
  await page.evaluate(async (id) => {
    await dcsmcraft.loadWorld(id);
    dcsmcraft.pause();
  }, id);
  await page.waitForFunction(() => dcsmcraft.giganto.view?.assetsReady);
  expect(await page.evaluate(() => dcsmcraft.giganto.session.stageTime)).toBe(
    450.4,
  );
  await page.evaluate(() => {
    const e = dcsmcraft.giganto;
    e.audio.frame(e.session, true);
  });
  await page.waitForFunction(() => !!dcsmcraft.giganto.audio.score?.buffer);
  const restored = await page.evaluate(async () => {
    const g = dcsmcraft,
      e = g.giganto;
    e.audio.frame(e.session, true);
    const score = e.audio.score;
    const offset = score.current.offset;
    await e.exit(false);
    g.pause();
    return {
      offset,
      disposed: score.disposed,
      bufferReleased: score.buffer === null,
      voices: score.voices.size,
      active: e.active,
      ledger: e.record.ledger.length,
    };
  });
  expect(restored.offset).toBeGreaterThanOrEqual(121);
  expect(restored.offset).toBeLessThan(264.96);
  expect(restored.disposed).toBe(true);
  expect(restored.bufferReleased).toBe(true);
  expect(restored.voices).toBe(0);
  expect(restored.active).toBe(false);
  expect(restored.ledger).toBe(0);
  expect(evidence.errors).toEqual([]);
  expect(evidence.external).toEqual([]);
  writeFileSync(
    out + "/music-report.json",
    JSON.stringify({ decoded, rms: levels, cues, restored }, null, 2),
  );
});

test("pre-fight recording plays during physical ring collection, collected rings survive reload and the original HUD returns after the trial", async ({
  page,
}) => {
  test.setTimeout(150000);
  const evidence = await boot(page);
  await portal(page);
  await page.evaluate(() => {
    const g = dcsmcraft,
      e = g.giganto;
    e.session.config.masterVolume = 0.04;
    e.session.config.music = true;
    e.session.config.musicVolume = 0.45;
    g.audio.unlock();
    e.session.stage = "traversal";
    Object.assign(e.session.avatar, {
      x: 0,
      y: 0.1,
      z: 41,
      yaw: 0,
      pitch: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      onGround: true,
    });
  });
  await page.keyboard.press("KeyA");
  await page.waitForFunction(
    () => dcsmcraft.giganto.audio.prelude?.player.state === "playing",
  );
  const pre = await page.evaluate(() => {
    const p = dcsmcraft.giganto.audio.prelude.player;
    return {
      duration: p.media.duration,
      time: p.media.currentTime,
      loop: p.media.loop,
      title: p.currentTrack.title,
    };
  });
  expect(pre.duration).toBeGreaterThan(245);
  expect(pre.title).toBe("Titan: GIGANTO");
  expect(pre.loop).toBe(true);
  await page.keyboard.down("KeyW");
  await page.waitForFunction(() =>
    dcsmcraft.giganto.session.ringPickups.includes(0),
  );
  await page.keyboard.up("KeyW");
  await page.screenshot({ path: out + "/ring-preparation-hud.png" });
  const id = await page.evaluate(async () => {
    const g = dcsmcraft;
    g.pause();
    await g.save();
    return g.id;
  });
  await page.evaluate(async (id) => {
    await dcsmcraft.loadWorld(id);
    dcsmcraft.pause();
  }, id);
  await page.waitForFunction(() => dcsmcraft.giganto.view?.assetsReady);
  const saved = await page.evaluate(() => ({
    rings: dcsmcraft.giganto.session.rings,
    pickups: dcsmcraft.giganto.session.ringPickups,
    route: dcsmcraft.giganto.session.route,
  }));
  expect(saved.rings).toBe(90);
  expect(saved.pickups).toEqual([0]);
  expect(saved.route).toBe(0);
  await page.evaluate(() => {
    const g = dcsmcraft,
      s = g.giganto.session;
    s.stage = "transform";
    s.emerald = true;
    s.rings = 125;
    g.giganto.input("skip");
    g.resume();
  });
  await page.waitForFunction(
    () => dcsmcraft.giganto.audio.score?.state === "playing",
  );
  const fight = await page.evaluate(() => ({
    rings: dcsmcraft.giganto.session.rings,
    preReleased: !dcsmcraft.giganto.audio.prelude?.player.media,
    phase: dcsmcraft.giganto.audio.score.current.section,
  }));
  expect(fight.rings).toBeLessThanOrEqual(125);
  expect(fight.rings).toBeGreaterThan(120);
  expect(fight.preReleased).toBe(true);
  expect(fight.phase).toBe("phaseOne");
  await page.evaluate(async () => {
    await dcsmcraft.giganto.exit(false);
    dcsmcraft.pause();
  });
  const restored = await page.evaluate(() => ({
    active: dcsmcraft.giganto.active,
    skin: dcsmcraft.settings.skin,
    health: dcsmcraft.player.health,
    hud: getComputedStyle(document.querySelector("#hud")).visibility,
    scope: document.querySelector("#app").classList.contains("titan-active"),
    scoreGone: !dcsmcraft.giganto.audio.score,
    preGone: !dcsmcraft.giganto.audio.prelude,
  }));
  expect(restored.active).toBe(false);
  expect(restored.health).toBe(17);
  expect(restored.hud).toBe("visible");
  expect(restored.scope).toBe(false);
  expect(restored.scoreGone).toBe(true);
  expect(restored.preGone).toBe(true);
  expect(evidence.errors).toEqual([]);
  expect(evidence.external).toEqual([]);
  writeFileSync(
    out + "/prelude-rings-report.json",
    JSON.stringify({ pre, saved, fight, restored }, null, 2),
  );
});

test("arena-only cyan HUD, live damage tuning, dynamic shadows, controllable attacks and cutscene skips restore the original renderer and player", async ({
  page,
}) => {
  test.setTimeout(240000);
  const evidence = await boot(page);
  await portal(page);
  const initial = await page.evaluate(() => {
    const g = dcsmcraft,
      e = g.giganto,
      s = e.session;
    g.running = false;
    s.stage = "combat";
    s.emerald = true;
    s.idle = 999;
    s.config.drain = 0;
    Object.assign(s.avatar, {
      x: 0,
      y: 57,
      z: 5,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: 0.4,
    });
    const hp = s.hp;
    e.input("hit");
    return { hp, after: s.hp, pending: !!s.strike };
  });
  expect(initial.after).toBe(initial.hp);
  expect(initial.pending).toBe(true);
  const moved = await page.evaluate(() => {
    const e = dcsmcraft.giganto,
      s = e.session,
      p = { ...s.avatar };
    e.controls.add("KeyD");
    e.controls.add("Space");
    for (let i = 0; i < 8; i++) {
      dcsmcraft.running = true;
      e.frame(1 / 60);
    }
    dcsmcraft.running = false;
    e.controls.clear();
    return {
      x: s.avatar.x - p.x,
      y: s.avatar.y - p.y,
      yaw: s.avatar.yaw,
      hp: s.hp,
    };
  });
  expect(moved.x).toBeGreaterThan(0.2);
  expect(moved.y).toBeGreaterThan(0.2);
  expect(moved.yaw).toBe(0.4);
  expect(moved.hp).toBeLessThan(initial.hp);
  await page.evaluate(() => {
    dcsmcraft.giganto.pauseMenu();
  });
  await page.locator("[data-titan=menu]").click();
  await page.locator(".titan-tuning summary").click();
  await page.locator("[data-titan-damage=basic]").fill("49");
  await page.locator("[data-titan-damage=basic]").dispatchEvent("change");
  await page.locator("[data-titan-config=shadowQuality]").selectOption("high");
  expect(
    await page.evaluate(() => dcsmcraft.giganto.session.config.damage.basic),
  ).toBe(49);
  const render = await page.evaluate(() => {
    const g = dcsmcraft,
      e = g.giganto,
      s = e.session,
      r = g.renderer.gl;
    const old = {
      enabled: r.shadowMap.enabled,
      type: r.shadowMap.type,
      mapping: r.toneMapping,
      exposure: r.toneMappingExposure,
    };
    g.settings.graphics = 3;
    g.settings.maxPixelRatio = 1;
    g.renderer.applyGraphics();
    s.stage = "combat";
    s.emerald = true;
    s.rings = 35;
    s.phase = 2;
    s.attack = "swing";
    s.attackTime = 0.9;
    s.avatar.x = -18;
    s.avatar.y = 61;
    s.avatar.z = 36;
    for (let i = 0; i < 8; i++) {
      s.time += 1 / 60;
      e.view.draw(s, 1 / 60);
    }
    e.updateHUD();
    r.getContext().finish();
    const result = {
      mapSize: e.view.light.shadow.map?.width,
      projection: e.view.light.shadow.camera.projectionMatrix.elements.every(
        Number.isFinite,
      ),
      shadowRestored:
        r.shadowMap.enabled === old.enabled && r.shadowMap.type === old.type,
      mappingRestored:
        r.toneMapping === old.mapping && r.toneMappingExposure === old.exposure,
      shadowCasting: 0,
      calls: r.info.render.calls,
      warning: e.view.warning.visible,
      critical: e.hud.classList.contains("critical-rings"),
    };
    e.view.boss.traverse((o) => {
      if (o.isMesh && o.castShadow) result.shadowCasting++;
    });
    s.config.shadowQuality = "off";
    s.config.postProcessing = false;
    g.settings.graphics = 1;
    e.view.draw(s, 1 / 60);
    result.off =
      !e.view.light.castShadow && r.shadowMap.enabled === old.enabled;
    return result;
  });
  expect(render.mapSize).toBe(2048);
  expect(render.shadowCasting).toBeGreaterThan(0);
  expect(render.projection).toBe(true);
  expect(render.shadowRestored).toBe(true);
  expect(render.mappingRestored).toBe(true);
  expect(render.off).toBe(true);
  expect(render.warning).toBe(true);
  expect(render.critical).toBe(true);
  expect(render.calls).toBeLessThan(230);
  await page.locator("[data-titan=back]").click();
  await page.evaluate(() => {
    dcsmcraft.ui.play();
    dcsmcraft.running = false;
  });
  await page.screenshot({ path: out + "/cyan-combat-hud.png" });
  await page.setViewportSize({ width: 640, height: 480 });
  await page.screenshot({ path: out + "/cyan-compact-hud.png" });
  const skip = await page.evaluate(() => {
    const g = dcsmcraft,
      e = g.giganto,
      s = e.session;
    g.running = false;
    const stages = [];
    for (const stage of ["intro", "transform", "phase"]) {
      s.stage = stage;
      s.stageTime = 1;
      e.input("skip");
      stages.push({
        from: stage,
        to: s.stage,
        qte: s.qte,
        action: s.action,
        pending: !!s.strike,
      });
      e.view.draw(s, 1 / 60);
    }
    return stages;
  });
  expect(skip.map((x) => x.to)).toEqual(["traversal", "combat", "combat"]);
  expect(skip.every((x) => x.qte === null && !x.pending)).toBe(true);
  await page.evaluate(async () => {
    await dcsmcraft.giganto.exit(false);
  });
  expect(
    await page.locator("#hud").evaluate((n) => getComputedStyle(n).visibility),
  ).toBe("visible");
  expect(await page.evaluate(() => dcsmcraft.player.health)).toBe(17);
  expect(evidence.errors).toEqual([]);
  expect(evidence.external).toEqual([]);
  writeFileSync(
    out + "/polish-report.json",
    JSON.stringify({ initial, moved, render, skip }, null, 2),
  );
});

test("Cyloop physically circles the Titan with a blue closed trail; aimed swats launch Sonic and the exact boost recording plays only while boosting", async ({
  page,
}) => {
  test.setTimeout(180000);
  const evidence = await boot(page);
  await portal(page);
  await page.evaluate(() => {
    const g = dcsmcraft,
      e = g.giganto,
      s = e.session;
    g.running = false;
    e.session.config.music = false;
    e.session.config.masterVolume = 0.4;
    s.stage = "combat";
    s.emerald = true;
    s.idle = 999;
    s.config.drain = 0;
    s.iframes = 0;
    s.attack = "idle";
    s.strike = null;
    s.action = "idle";
    Object.assign(s.avatar, { x: 0, y: 57, z: 5, vx: 0, vy: 0, vz: 0 });
    window.circleAngles = [Math.atan2(s.avatar.x, s.avatar.z + 7.5)];
    window.circlePositions = [];
    window.collectCircle = true;
    const record = () => {
      const a = e.session?.strike;
      if (
        window.collectCircle &&
        a?.move === "loop" &&
        a.elapsed >= 0.35 &&
        a.elapsed <= 2.75
      ) {
        window.circleAngles.push(Math.atan2(s.avatar.x, s.avatar.z + 7.5));
        window.circlePositions.push([s.avatar.x, s.avatar.y, s.avatar.z]);
      }
      if (window.collectCircle) requestAnimationFrame(record);
    };
    requestAnimationFrame(record);
    e.input("loop");
    g.running = true;
  });
  await page.waitForFunction(
    () =>
      dcsmcraft.giganto.session.strike?.elapsed > 1 &&
      dcsmcraft.giganto.session.strike?.elapsed < 2.4,
  );
  const mid = await page.evaluate(() => {
    const g = dcsmcraft,
      e = g.giganto,
      s = e.session;
    g.running = false;
    e.view.draw(s, 1 / 60);
    e.updateHUD();
    return {
      position: { ...s.avatar },
      elapsed: s.strike.elapsed,
      blue: e.view.aura.material.uniforms.auraColor.value.getHexString(),
      trail: e.view.cyloop.geometry.drawRange.count,
      total: e.view.cyloop.geometry.index.count,
      rig: e.view.sonic.position.toArray(),
    };
  });
  expect(mid.blue).toBe("228dff");
  expect(mid.trail).toBeGreaterThan(0);
  expect(mid.trail).toBeLessThan(mid.total);
  expect(Math.abs(mid.rig[1] - mid.position.y - 0.12)).toBeLessThan(0.2);
  await page.screenshot({ path: out + "/physical-cyloop.png" });
  await page.evaluate(() => (dcsmcraft.running = true));
  await page.waitForFunction(() => !dcsmcraft.giganto.session.strike);
  const circle = await page.evaluate(() => {
    const g = dcsmcraft,
      e = g.giganto,
      s = e.session;
    g.running = false;
    window.collectCircle = false;
    e.view.draw(s, 1 / 60);
    circleAngles.push(Math.atan2(s.avatar.x, s.avatar.z + 7.5));
    let angle = 0;
    for (let i = 1; i < circleAngles.length; i++)
      angle += Math.atan2(
        Math.sin(circleAngles[i] - circleAngles[i - 1]),
        Math.cos(circleAngles[i] - circleAngles[i - 1]),
      );
    return {
      angle,
      samples: circleAngles.length,
      hp: s.hp,
      position: { ...s.avatar },
      trail: e.view.cyloop.geometry.drawRange.count,
      total: e.view.cyloop.geometry.index.count,
    };
  });
  expect(circle.angle).toBeGreaterThan(6.2);
  expect(circle.hp).toBe(11815);
  expect(circle.trail).toBe(circle.total);
  expect(
    Math.abs(Math.hypot(circle.position.x, circle.position.z + 7.5) - 48),
  ).toBeLessThan(0.2);
  const closureDrift = await page.evaluate(() => {
    const g = dcsmcraft,
      e = g.giganto,
      p = e.session.avatar,
      from = { ...p };
    e.controls.clear();
    g.running = true;
    for (let i = 0; i < 90; i++) e.frame(1 / 60);
    g.running = false;
    return Math.hypot(p.x - from.x, p.y - from.y, p.z - from.z);
  });
  expect(closureDrift).toBeLessThan(0.01);
  await page.screenshot({ path: out + "/closed-cyloop.png" });
  await page.evaluate(() => {
    const g = dcsmcraft,
      s = g.giganto.session;
    // Test the swat independently at close range; Cyloop intentionally no
    // longer returns its user to this earlier contact position.
    Object.assign(s.avatar, { x: 0, y: 57, z: 5, vx: 0, vy: 0, vz: 0 });
    s.attack = "swat";
    s.swatSide = "L";
    s.attackTime = 0;
    s.attackAim = { x: s.avatar.x, y: s.avatar.y, z: s.avatar.z };
    s.hitDone = false;
    s.iframes = 0;
    s.parryHeld = false;
    g.giganto.controls.clear();
    window.swatStart = { ...s.avatar };
    window.swatRings = s.rings;
    g.running = true;
  });
  await page.waitForFunction(() => !!dcsmcraft.giganto.session.knockback);
  const hitTime = await page.evaluate(() => dcsmcraft.giganto.session.time);
  await page.waitForFunction(
    (t) => dcsmcraft.giganto.session.time > t + 0.45,
    hitTime,
  );
  const swat = await page.evaluate(() => {
    dcsmcraft.running = false;
    const s = dcsmcraft.giganto.session;
    return {
      travel: s.avatar.z - swatStart.z,
      ringsLost: swatRings - s.rings,
      velocity: s.knockback,
      health: dcsmcraft.player.health,
    };
  });
  expect(swat.travel).toBeGreaterThan(12);
  expect(swat.ringsLost).toBe(14);
  expect(swat.health).toBe(17);
  await page.screenshot({ path: out + "/swat-launch.png" });
  await page.evaluate(() => {
    dcsmcraft.giganto.session.attack = "idle";
    dcsmcraft.giganto.session.idle = 999;
    dcsmcraft.running = true;
  });
  await page.waitForFunction(() => !dcsmcraft.giganto.session.knockback);
  await page.keyboard.down("KeyW");
  await page.keyboard.down("ShiftLeft");
  await page.waitForFunction(() => !!dcsmcraft.giganto.audio.boost?.voice);
  const sample = await page.evaluate(async () => {
    const a = dcsmcraft.giganto.audio.boost,
      analyser = dcsmcraft.audio.context.createAnalyser();
    analyser.fftSize = 2048;
    a.voice.gain.connect(analyser);
    const buffer = new Float32Array(2048);
    let rms = 0;
    for (let i = 0; i < 35; i++) {
      analyser.getFloatTimeDomainData(buffer);
      rms = Math.max(
        rms,
        Math.sqrt(buffer.reduce((sum, x) => sum + x * x, 0) / buffer.length),
      );
      await new Promise((r) => setTimeout(r, 20));
    }
    a.voice.gain.disconnect(analyser);
    analyser.disconnect();
    return {
      duration: a.buffer.duration,
      loop: a.voice.source.loop,
      start: a.voice.source.loopStart,
      end: a.voice.source.loopEnd,
      starts: a.starts,
      rms,
    };
  });
  expect(sample.duration).toBeGreaterThan(8.8);
  expect(sample.loop).toBe(true);
  expect(sample.start).toBe(3);
  expect(sample.end).toBe(8.8);
  expect(sample.starts).toBe(1);
  expect(sample.rms).toBeGreaterThan(0.0001);
  await page.keyboard.up("ShiftLeft");
  await page.keyboard.up("KeyW");
  await page.waitForFunction(
    () =>
      !dcsmcraft.giganto.audio.boost.voice &&
      dcsmcraft.giganto.audio.boost.voices.size === 0,
  );
  await page.keyboard.down("KeyW");
  await page.keyboard.down("ShiftLeft");
  await page.waitForFunction(() => !!dcsmcraft.giganto.audio.boost.voice);
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !dcsmcraft.giganto.audio.boost.voice);
  const restored = await page.evaluate(async () => {
    const g = dcsmcraft,
      e = g.giganto,
      ref = e.audio.boost;
    await e.exit();
    return {
      active: e.active,
      disposed: ref.disposed,
      buffer: ref.buffer,
      voices: ref.voices.size,
      health: g.player.health,
      hud: getComputedStyle(document.querySelector("#hud")).visibility,
    };
  });
  expect(restored).toEqual({
    active: false,
    disposed: true,
    buffer: null,
    voices: 0,
    health: 17,
    hud: "visible",
  });
  expect(evidence.errors).toEqual([]);
  expect(evidence.external).toEqual([]);
  writeFileSync(
    out + "/cyloop-swat-boost-report.json",
    JSON.stringify({ mid, circle, swat, sample, restored }, null, 2),
  );
});

test("battle settings, homing/Cross Slash, paused effects, hidden-tab suspension and repeated arena return preserve the overworld", async ({
  page,
}) => {
  test.setTimeout(240000);
  const evidence = await boot(page);
  const world = await page.evaluate(() => JSON.stringify(dcsmcraft.settings));
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.evaluate(() => {
      dcsmcraft.giganto.record.cooldownUntil = 0;
      dcsmcraft.giganto.record.portal = null;
      dcsmcraft.running = true;
    });
    await portal(page);
    await page.evaluate(() => {
      const g = dcsmcraft,
        e = g.giganto,
        s = e.session;
      g.running = false;
      Object.assign(s, {
        stage: "combat",
        emerald: true,
        idle: 999,
        rings: 400,
        iframes: 0,
      });
      s.config.drain = 0;
      Object.assign(s.avatar, { x: 0, y: 57, z: 25, vx: 0, vy: 0, vz: 0 });
      e.pauseMenu();
    });
    await page.locator("[data-titan=menu]").click();
    for (const [key, value] of [
      ["graphicsQuality", "balanced"],
      ["shadowQuality", "low"],
    ])
      await page.locator(`[data-titan-config=${key}]`).selectOption(value);
    for (const [key, value] of [
      ["masterVolume", 0.12],
      ["musicVolume", 0.33],
      ["effectsVolume", 0.35],
      ["cameraFov", 74],
    ]) {
      await page.locator(`[data-titan-config=${key}]`).evaluate((e, v) => {
        e.value = v;
        e.dispatchEvent(new Event("change", { bubbles: true }));
      }, value);
    }
    await page.locator("[data-titan-config=motionBlur]").check();
    await page.locator("[data-titan-config=speedTrails]").uncheck();
    await page.locator("[data-titan-config=music]").uncheck();
    expect(await page.evaluate(() => JSON.stringify(dcsmcraft.settings))).toBe(
      world,
    );
    await page.screenshot({ path: out + `/isolated-settings-${attempt}.png` });
    await page.locator("[data-titan=back]").click();
    await page.locator("[data-titan=resume]").click();
    await page.keyboard.press("KeyX");
    await page.waitForFunction(() => dcsmcraft.giganto.session.combo === 1);
    const afterHoming = await page.evaluate(() => dcsmcraft.giganto.session.hp);
    await page.waitForFunction(() => !dcsmcraft.giganto.session.strike);
    await page.keyboard.press("KeyC");
    await page.waitForFunction(() => dcsmcraft.giganto.session.combo === 3);
    expect(
      afterHoming - (await page.evaluate(() => dcsmcraft.giganto.session.hp)),
    ).toBe(250);
    const visibility = await page.evaluate(() => {
      const g = dcsmcraft,
        e = g.giganto,
        s = e.session,
        v = e.view;
      g.running = false;
      s.strike = null;
      s.action = "idle";
      s.parryHeld = false;
      s.actionTime = 0;
      s.config.particles = false;
      s.config.shadowQuality = "off";
      s.config.postProcessing = false;
      Object.assign(s.avatar, {
        x: 0,
        y: 57,
        z: 5,
        vx: 0,
        vy: 0,
        vz: 0,
        yaw: Math.PI,
      });
      v.hitStop = 0;
      for (let i = 0; i < 20; i++) v.draw(s, 1 / 60);
      const center = v.sonic.position.clone();
      center.y += 2;
      center.project(v.camera);
      const gl = g.renderer.gl.getContext(),
        x = Math.max(
          0,
          Math.min(
            gl.drawingBufferWidth - 64,
            Math.floor((center.x * 0.5 + 0.5) * gl.drawingBufferWidth) - 32,
          ),
        ),
        y = Math.max(
          0,
          Math.min(
            gl.drawingBufferHeight - 64,
            Math.floor((center.y * 0.5 + 0.5) * gl.drawingBufferHeight) - 32,
          ),
        );
      const read = () => {
        const p = new Uint8Array(64 * 64 * 4);
        gl.readPixels(x, y, 64, 64, gl.RGBA, gl.UNSIGNED_BYTE, p);
        return p;
      };
      const shown = read();
      v.sonic.visible = false;
      v.draw(s, 0);
      const hidden = read();
      v.sonic.visible = true;
      v.draw(s, 0);
      let changed = 0;
      for (let i = 0; i < shown.length; i += 4)
        if (
          Math.abs(shown[i] - hidden[i]) +
            Math.abs(shown[i + 1] - hidden[i + 1]) +
            Math.abs(shown[i + 2] - hidden[i + 2]) >
          12
        )
          changed++;
      g.running = true;
      return {
        changed,
        inFrame: Math.abs(center.x) < 1 && Math.abs(center.y) < 1,
        camera: v.camera.position.toArray(),
      };
    });
    expect(visibility.inFrame).toBe(true);
    expect(visibility.changed).toBeGreaterThan(30);
    await page.screenshot({ path: out + `/reverse-yaw-camera-${attempt}.png` });
    await page.keyboard.press("Escape");
    const paused = await page.evaluate(() => {
      const e = dcsmcraft.giganto;
      return {
        time: e.session.time,
        rings: e.session.rings,
        foley: e.audio.foley?.voices.size || 0,
        tones: e.audio.tones.size,
      };
    });
    await page.waitForTimeout(250);
    expect(await page.evaluate(() => dcsmcraft.giganto.session.time)).toBe(
      paused.time,
    );
    expect(paused.foley).toBe(0);
    expect(paused.tones).toBe(0);
    await page.locator("[data-titan=resume]").click();
    await page.evaluate(() => dispatchEvent(new Event("blur")));
    await expect(page.locator("[data-titan=resume]")).toBeVisible();
    await page.locator("[data-titan=exit]").click();
    await page.waitForFunction(() => !dcsmcraft.giganto.active);
    const result = await page.evaluate(() => ({
      settings: JSON.stringify(dcsmcraft.settings),
      master: dcsmcraft.audio.master.gain.value,
      audioGone:
        !dcsmcraft.giganto.audio.master &&
        !dcsmcraft.giganto.audio.score &&
        !dcsmcraft.giganto.audio.boost,
      ledger: dcsmcraft.giganto.record.ledger.length,
      hud: getComputedStyle(document.querySelector("#hud")).visibility,
    }));
    expect(result.settings).toBe(world);
    expect(result.master).toBe(0);
    expect(result.audioGone).toBe(true);
    expect(result.ledger).toBe(0);
    expect(result.hud).toBe("visible");
  }
  expect(evidence.errors).toEqual([]);
  expect(evidence.external).toEqual([]);
});

test("stomp animation plants both feet at the visible shockwave, and its ground hit remains avoidable", async ({
  page,
}) => {
  test.setTimeout(150000);
  const evidence = await boot(page);
  await portal(page);
  const report = await page.evaluate(() => {
    const g = dcsmcraft,
      e = g.giganto,
      s = e.session,
      v = e.view;
    g.running = false;
    s.stage = "combat";
    s.emerald = true;
    s.config.drain = 0;
    s.config.shadowQuality = "off";
    s.config.graphicsQuality = "low";
    s.config.postProcessing = false;
    s.idle = 999;
    s.rings = 400;
    s.iframes = 0;
    Object.assign(s.avatar, {
      x: 0,
      y: 0.05,
      z: 25,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: 0,
    });
    const plants = [];
    for (const side of ["L", "R"]) {
      s.attack = "stomp";
      s.swatSide = side;
      s.attackTime = 1.95;
      v.hitStop = 0;
      for (let i = 0; i < 12; i++) v.draw(s, 1 / 60);
      const ankle = v.boss.userData.model.getObjectByName(
        side === "L" ? "Foot_L_092" : "Foot_R_098",
      );
      const p = ankle.getWorldPosition(v.sonic.position.clone());
      plants.push({
        side,
        y: p.y,
        horizontal: Math.hypot(
          p.x - v.stompWave.position.x,
          p.z - v.stompWave.position.z,
        ),
        wave: v.stompWave.visible,
        radius: v.stompWave.scale.x,
      });
    }
    s.attack = "stomp";
    s.attackTime = 1.95;
    s.hitDone = false;
    s.stompReleased = false;
    s.released = true;
    for (let i = 0; i < 50; i++) {
      g.running = true;
      e.frame(1 / 60);
    }
    g.running = false;
    return { plants, rings: s.rings };
  });
  for (const q of report.plants) {
    expect(Math.abs(q.y - 1.48)).toBeLessThan(0.2);
    expect(q.horizontal).toBeLessThan(0.2);
    expect(q.wave).toBe(true);
    expect(q.radius).toBeGreaterThan(1);
  }
  expect(report.rings).toBe(386);
  await page.screenshot({ path: out + "/stomp-ground-contact.png" });
  expect(evidence.errors).toEqual([]);
  expect(evidence.external).toEqual([]);
  writeFileSync(
    out + "/stomp-contact-report.json",
    JSON.stringify(report, null, 2),
  );
});

test("Giganto turns and takes planted steps; Wild Rush zigzags physically and a saved moving boss resumes safely", async ({
  page,
}) => {
  test.setTimeout(180000);
  const evidence = await boot(page);
  await portal(page);
  await page.evaluate(() => dcsmcraft.giganto.pauseMenu());
  await page.locator("[data-titan=menu]").click();
  await page.locator("[data-titan-config=bossMobility]").uncheck();
  expect(
    await page.evaluate(() => dcsmcraft.giganto.session.config.bossMobility),
  ).toBe(false);
  await page.locator("[data-titan-config=bossMobility]").check();
  await page.locator("[data-titan=back]").click();
  await page.locator("[data-titan=resume]").click();
  const report = await page.evaluate(async () => {
    const g = dcsmcraft,
      e = g.giganto,
      s = e.session,
      v = e.view;
    g.running = false;
    Object.assign(s, {
      stage: "combat",
      emerald: true,
      idle: 0,
      sequence: 3,
      rings: 400,
    });
    Object.assign(s.config, {
      drain: 0,
      shadowQuality: "off",
      graphicsQuality: "low",
      postProcessing: false,
      music: false,
    });
    Object.assign(s.avatar, { x: 50, y: 57, z: 35, vx: 0, vy: 0, vz: 0 });
    let footsteps = 0,
      maxFootError = 0,
      maxRootError = 0,
      attacksInStep = 0;
    const event = e.audio.event.bind(e.audio);
    e.audio.event = (q) => {
      if (q.type === "footstep") footsteps++;
      event(q);
    };
    const vector = v.sonic.position.clone(),
      start = { ...s.boss };
    for (let i = 0; i < 200; i++) {
      if (s.boss.walk && i % 9 === 0) v.hitStop = 0.055;
      g.running = true;
      e.frame(1 / 60);
      maxRootError = Math.max(
        maxRootError,
        Math.hypot(v.boss.position.x - s.boss.x, v.boss.position.z - s.boss.z),
        Math.abs(v.boss.rotation.y - s.boss.yaw),
      );
      if (s.boss.walk) {
        if (s.attack !== "idle") attacksInStep++;
        // World foot targets are independently reconstructed from saved step anchors.
        for (const side of ["L", "R"]) {
          const w = s.boss.walk,
            t = Math.max(0, Math.min(1, (w.elapsed - 0.45) / 2.4)),
            u = Math.max(
              0,
              Math.min(1, (t - (side === "L" ? 0.04 : 0.5)) / 0.44),
            ),
            a = u * u * (3 - 2 * u),
            x = (side === "L" ? 1 : -1) * 4.84,
            z = -6.02;
          const p = (q) => ({
              x: q.x + x * Math.cos(q.yaw) + z * Math.sin(q.yaw),
              z: q.z + z * Math.cos(q.yaw) - x * Math.sin(q.yaw),
            }),
            from = p(w.from),
            to = p(w.to);
          const foot = v.boss.userData.footBindings
            .get(side)
            .foot.getWorldPosition(vector);
          maxFootError = Math.max(
            maxFootError,
            Math.hypot(
              foot.x - from.x - (to.x - from.x) * a,
              foot.y - 1.48 - Math.sin(u * Math.PI) * 6,
              foot.z - from.z - (to.z - from.z) * a,
            ),
          );
        }
      }
    }
    g.running = false;
    e.audio.event = event;
    const walking = {
      footsteps,
      maxFootError,
      maxRootError,
      attacksInStep,
      distance: Math.hypot(s.boss.x - start.x, s.boss.z - start.z),
      yaw: s.boss.yaw,
      steps: s.boss.steps,
      position: { x: s.boss.x, z: s.boss.z },
    };
    s.idle = 999;
    s.attack = "idle";
    s.iframes = 2;
    s.action = "idle";
    s.actionTime = 0;
    const b = s.boss;
    Object.assign(s.avatar, {
      x: b.x + Math.sin(b.yaw) * 9,
      y: 57,
      z: b.z + Math.cos(b.yaw) * 9,
      vx: 0,
      vy: 0,
      vz: 0,
    });
    g.running = true;
    dispatchEvent(
      new KeyboardEvent("keydown", { code: "KeyF", bubbles: true }),
    );
    dispatchEvent(new KeyboardEvent("keyup", { code: "KeyF", bubbles: true }));
    const before = s.hp,
      xz = [];
    let meshCount = 0;
    v.sonic.traverse((o) => {
      if (o.isMesh) meshCount++;
    });
    for (let i = 0; i < 60; i++) {
      e.frame(1 / 60);
      const x = s.avatar.x - b.x,
        z = s.avatar.z - b.z;
      xz.push(x * Math.cos(b.yaw) - z * Math.sin(b.yaw));
    }
    g.running = false;
    let afterMeshes = 0;
    v.sonic.traverse((o) => {
      if (o.isMesh) afterMeshes++;
    });
    const rush = {
      damage: before - s.hp,
      min: Math.min(...xz.slice(0, 38)),
      max: Math.max(...xz.slice(0, 38)),
      meshCount,
      afterMeshes,
      scale: v.sonic.scale.toArray(),
      worldScale: s.config.colossalScale ? 1.6 : 1,
    };
    await g.save();
    return { walking, rush };
  });
  expect(report.walking.footsteps).toBe(2);
  expect(report.walking.maxFootError).toBeLessThan(0.2);
  expect(report.walking.maxRootError).toBeLessThan(0.001);
  expect(report.walking.attacksInStep).toBe(0);
  expect(report.walking.distance).toBeGreaterThan(7.9);
  expect(Math.abs(report.walking.yaw)).toBeGreaterThan(0.1);
  expect(report.rush.damage).toBe(285);
  expect(report.rush.min).toBeLessThan(-1);
  expect(report.rush.max).toBeGreaterThan(1);
  expect(report.rush.meshCount).toBe(report.rush.afterMeshes);
  // The arena converts canonical units to metres while Sonic retains his size.
  expect(report.rush.scale.map((v) => v * report.rush.worldScale)).toEqual([
    1, 1, 1,
  ]);
  await page.screenshot({ path: out + "/moving-titan-rush.png" });
  await page.reload();
  await page.waitForFunction(() => dcsmcraft?.initialized);
  await page.locator("[data-action=worlds]").click();
  await page.locator("[data-action=load]").first().click();
  await page.waitForFunction(
    () => dcsmcraft.giganto.active && dcsmcraft.giganto.view.assetsReady,
  );
  const restored = await page.evaluate(() => {
    const e = dcsmcraft.giganto;
    dcsmcraft.running = false;
    return {
      boss: e.session.boss,
      attack: e.session.attack,
      stage: e.session.stage,
    };
  });
  expect(restored.stage).toBe("combat");
  expect(restored.attack).toBe("idle");
  expect(restored.boss.walk).toBeNull();
  expect(restored.boss.x).toBeCloseTo(report.walking.position.x, 5);
  expect(restored.boss.z).toBeCloseTo(report.walking.position.z, 5);
  expect(evidence.errors).toEqual([]);
  expect(evidence.external).toEqual([]);
  writeFileSync(
    out + "/mobility-rush-report.json",
    JSON.stringify({ report, restored }, null, 2),
  );
});

test("cinematic counters survive pause/reload without duplicate damage; the beat-timed finisher contacts, collapses and returns safely", async ({
  page,
}) => {
  test.setTimeout(240000);
  const evidence = await boot(page);
  await portal(page);
  const prepared = await page.evaluate(async () => {
    const g = dcsmcraft,
      e = g.giganto,
      s = e.session;
    g.running = false;
    Object.assign(s, {
      stage: "combat",
      phase: 2,
      emerald: true,
      idle: 999,
      rings: 400,
      iframes: 0,
      attack: "beam",
      attackTime: 1.79,
    });
    Object.assign(s.avatar, { x: 0, y: 57, z: 5, vx: 0, vy: 0, vz: 0 });
    s.attackAim = { ...s.avatar };
    Object.assign(s.config, {
      drain: 0,
      music: false,
      masterVolume: 0.04,
      cinematics: true,
      graphicsQuality: "low",
      shadowQuality: "off",
      postProcessing: false,
    });
    g.renderer.gl.setPixelRatio(1);
    g.renderer.gl.setSize(640, 400, false);
    g.running = true;
    e.frame(1 / 60);
    if (!s.qte) throw Error("beam struggle did not start");
    for (let n = 0; n < 12; n++) e.frame(1 / 60);
    const brace = e.view.sonic.userData.currentClip;
    while (s.qte) {
      dispatchEvent(
        new KeyboardEvent("keydown", { code: "Space", bubbles: true }),
      );
      dispatchEvent(
        new KeyboardEvent("keyup", { code: "Space", bubbles: true }),
      );
      for (let n = 0; n < 5; n++) e.frame(1 / 60);
    }
    while (s.counterScene && s.counterScene.elapsed < 0.4) e.frame(1 / 60);
    g.running = false;
    await g.save();
    return {
      id: g.id,
      hp: s.hp,
      rings: s.rings,
      time: s.time,
      brace,
      counter: s.counterScene?.elapsed,
    };
  });
  expect(prepared.brace).toBe("brace_beam");
  expect(prepared.hp).toBe(12000);
  expect(prepared.counter).toBeGreaterThanOrEqual(0.4);
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-titan=resume]")).toBeVisible();
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => dcsmcraft.giganto.session.time)).toBe(
    prepared.time,
  );
  await page.evaluate(async (id) => {
    await dcsmcraft.loadWorld(id);
    dcsmcraft.pause();
  }, prepared.id);
  await page.waitForFunction(() => dcsmcraft.giganto.view.assetsReady);
  await page.locator("[data-titan=resume]").click();
  const report = await page.evaluate(() => {
    const g = dcsmcraft,
      e = g.giganto,
      s = e.session,
      v = e.view;
    g.running = false;
    window.cinematicEvents = [];
    const old = e.audio.event.bind(e.audio);
    e.audio.event = (q) => {
      cinematicEvents.push({ ...q });
      old(q);
    };
    g.renderer.gl.setPixelRatio(1);
    g.renderer.gl.setSize(640, 400, false);
    v.draw(s, 0);
    let reflected = v.beam.visible && !!s.counterScene;
    s.counterScene.elapsed = 0.84;
    e.audio.pause(s);
    const beforeVoices = e.audio.foley?.serial || 0;
    let firstResumeSound = false;
    g.running = true;
    let contactError = 99;
    for (let n = 0; n < 110; n++) {
      e.frame(1 / 60);
      if (n === 0)
        firstResumeSound = (e.audio.foley?.serial || 0) > beforeVoices;
      reflected ||= v.beam.visible && !!s.counterScene;
      const h = s.events.find((q) => q.type === "hit");
      if (h) {
        const f = v.sonic.userData.model
          .getObjectByName("LeftFoot")
          .getWorldPosition(v.sonic.position.clone());
        contactError = Math.hypot(
          f.x - h.point.x,
          f.y - h.point.y,
          f.z - h.point.z,
        );
      }
    }
    const counter = {
      hp: s.hp,
      rings: s.rings,
      scene: s.counterScene,
      contactError,
      reflected,
      firstResumeSound,
      hitEvents: cinematicEvents.filter((q) => q.type === "hit").length,
      unlocked: !e.hud.classList.contains("cinematic"),
    };
    s.qte = { kind: "crunch", left: 2, hits: 8, need: 8 };
    e.frame(1 / 60);
    e.input("skip");
    e.frame(1 / 60);
    const afterSkip = s.hp;
    s.hp = 1;
    s.qte = { kind: "beam", left: 2, hits: 8, need: 8 };
    e.frame(1 / 60);
    e.input("skip");
    if (s.stage !== "finale") throw Error("counter did not reach finisher");
    const images = {},
      finale = { contactError: 99, feet: [], cues: [], meshCount: 0 };
    for (let n = 0; n < 425 && s.stage !== "victory"; n++) {
      e.frame(1 / 60);
      for (const q of s.events)
        if (q.type === "cinematic-cue" && q.cinematic === "finale") {
          finale.cues.push({ cue: q.cue, age: q.age });
          if (q.cue === "contact") {
            const p = v.sonic.userData.model
              .getObjectByName("RightFoot")
              .getWorldPosition(v.sonic.position.clone());
            finale.contactError = Math.hypot(
              p.x - q.point.x,
              p.y - q.point.y,
              p.z - q.point.z,
            );
            images.contact = g.renderer.gl.domElement.toDataURL("image/png");
          }
        }
      if (Math.abs(s.stageTime - 6) < 0.008 && s.stage === "finale") {
        for (const side of ["L", "R"])
          finale.feet.push(
            v.boss.userData.footBindings
              .get(side)
              .foot.getWorldPosition(v.sonic.position.clone()).y,
          );
        images.collapse = g.renderer.gl.domElement.toDataURL("image/png");
      }
    }
    v.sonic.traverse((o) => {
      if (o.isMesh) finale.meshCount++;
    });
    return {
      counter,
      afterSkip,
      finale,
      images,
      stage: s.stage,
      voices: e.audio.foley?.voices.size || 0,
    };
  });
  expect(report.counter.hp).toBe(11700);
  expect(report.counter.hitEvents).toBe(1);
  expect(report.counter.scene).toBeNull();
  expect(report.counter.unlocked).toBe(true);
  expect(report.counter.reflected).toBe(true);
  expect(report.counter.firstResumeSound).toBe(true);
  expect(report.counter.contactError).toBeLessThan(0.3);
  expect(report.counter.rings).toBe(prepared.rings);
  expect(report.afterSkip).toBe(11400);
  expect(report.stage).toBe("victory");
  expect(report.finale.cues.map((q) => q.cue)).toEqual([
    "charge",
    "launch",
    "contact",
    "rupture",
  ]);
  expect(report.finale.contactError).toBeLessThan(0.3);
  expect(report.finale.feet).toHaveLength(2);
  expect(report.finale.feet.every((y) => Math.abs(y - 1.48) < 0.2)).toBe(true);
  expect(report.finale.meshCount).toBe(1);
  expect(report.voices).toBe(0);
  for (const [name, data] of Object.entries(report.images))
    writeFileSync(
      out + "/cinematic-" + name + ".png",
      Buffer.from(data.split(",")[1], "base64"),
    );
  delete report.images;
  await page.locator("[data-titan=exit]").click();
  await page.waitForFunction(
    () => !dcsmcraft.giganto.active && !dcsmcraft.giganto.closing,
  );
  expect(await page.evaluate(() => dcsmcraft.player.health)).toBe(17);
  expect(
    await page.evaluate(() => dcsmcraft.giganto.record.ledger.length),
  ).toBe(1);
  expect(evidence.errors).toEqual([]);
  expect(evidence.external).toEqual([]);
  writeFileSync(
    out + "/cinematic-report.json",
    JSON.stringify({ prepared, report }, null, 2),
  );
});

test("armor wall run stays on the visible moving Titan, survives reload and reaches the final Emerald without floating platforms", async ({
  page,
}) => {
  test.setTimeout(180000);
  const evidence = await boot(page);
  await portal(page);
  const first = await page.evaluate(async () => {
    const g = dcsmcraft,
      e = g.giganto,
      s = e.session;
    g.running = false;
    e.input("skip");
    s.config.music = false;
    s.config.graphicsQuality = "low";
    s.config.shadowQuality = "off";
    s.config.postProcessing = false;
    const q = e.view.climbSurface.guide[0],
      local = {
        x: q.point.x + q.normal.x * 1.5,
        y: 0.05,
        z: q.point.z + q.normal.z * 1.5,
      };
    Object.assign(s.avatar, local, { yaw: Math.PI, vx: 0, vy: 0, vz: 0 });
    g.renderer.gl.setPixelRatio(1);
    g.renderer.gl.setSize(640, 400, false);
    e.controls.add("KeyW");
    e.controls.add("ShiftLeft");
    const images = {};
    g.running = true;
    for (
      let i = 0;
      i < 180 && s.stage === "traversal" && s.avatar.y < 45;
      i++
    ) {
      e.frame(1 / 60);
      if (i === 25)
        images.foot = g.renderer.gl.domElement.toDataURL("image/png");
    }
    g.running = false;
    e.controls.clear();
    await g.save();
    return {
      id: g.id,
      y: s.avatar.y,
      route: s.route,
      attached: s.climb.attached,
      clip: e.view.sonic.userData.currentClip,
      platforms: e.view.arena.userData.platforms.visible,
      guide: e.view.armorBeacons.visible,
      triangles: e.view.climbSurface.triangles,
      images,
    };
  });
  for (const [n, data] of Object.entries(first.images))
    writeFileSync(
      out + "/armor-" + n + ".png",
      Buffer.from(data.split(",")[1], "base64"),
    );
  delete first.images;
  expect(first.attached).toBe(true);
  expect(first.y).toBeGreaterThan(25);
  expect(first.platforms).toBe(false);
  expect(first.guide).toBe(true);
  expect(["wall_run", "wall_idle"]).toContain(first.clip);
  await page.evaluate(async (id) => {
    await dcsmcraft.loadWorld(id);
    dcsmcraft.pause();
  }, first.id);
  await page.waitForFunction(() => dcsmcraft.giganto.view.assetsReady);
  await page.locator("[data-titan=resume]").click();
  const last = await page.evaluate(() => {
    const g = dcsmcraft,
      e = g.giganto,
      s = e.session;
    g.running = false;
    g.renderer.gl.setPixelRatio(1);
    g.renderer.gl.setSize(640, 400, false);
    e.controls.add("KeyW");
    e.controls.add("ShiftLeft");
    g.running = true;
    let high = null;
    for (let i = 0; i < 420 && s.stage === "traversal"; i++) {
      e.frame(1 / 60);
      if (s.avatar.y > 75 && !high)
        high = g.renderer.gl.domElement.toDataURL("image/png");
    }
    g.running = false;
    e.controls.clear();
    return {
      stage: s.stage,
      emerald: s.emerald,
      route: s.route,
      rings: s.rings,
      high,
    };
  });
  if (last.high)
    writeFileSync(
      out + "/armor-crown.png",
      Buffer.from(last.high.split(",")[1], "base64"),
    );
  delete last.high;
  expect(last.emerald).toBe(true);
  expect(["transform", "combat"]).toContain(last.stage);
  expect(last.route).toBe(12);
  expect(evidence.errors).toEqual([]);
  expect(evidence.external).toEqual([]);
  writeFileSync(
    out + "/armor-ascent-report.json",
    JSON.stringify({ first, last }, null, 2),
  );
});

test("arena contact shading changes real pixels, scales quality and restores shared rendering state", async ({
  page,
}) => {
  test.setTimeout(180000);
  const evidence = await boot(page);
  await portal(page);
  const report = await page.evaluate(() => {
    const g = dcsmcraft,
      e = g.giganto,
      s = e.session,
      v = e.view,
      gl = g.renderer.gl;
    g.running = false;
    s.stage = "combat";
    s.emerald = true;
    s.attack = "idle";
    s.stageTime = 3;
    Object.assign(s.avatar, { x: -12, y: 5, z: 30, vx: 0, vy: 0, vz: 0 });
    Object.assign(s.config, {
      graphicsQuality: "balanced",
      shadowQuality: "off",
      postProcessing: true,
      motionBlur: false,
      music: false,
      cameraShake: 0,
    });
    gl.setPixelRatio(1);
    gl.setSize(640, 400, false);
    const state = () => ({
      tone: gl.toneMapping,
      exposure: gl.toneMappingExposure,
      shadow: gl.shadowMap.enabled,
      target: gl.getRenderTarget(),
      auto: gl.autoClear,
    });
    const before = state(),
      frames = {},
      timings = {};
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 400;
    const ctx = canvas.getContext("2d");
    const capture = (quality) => {
      s.config.ambientOcclusion = quality;
      let elapsed = [];
      for (let i = 0; i < 4; i++) {
        const a = performance.now();
        v.draw(s, 0);
        gl.getContext().finish();
        elapsed.push(performance.now() - a);
      }
      ctx.drawImage(gl.domElement, 0, 0);
      const pixels = Array.from(ctx.getImageData(0, 0, 640, 400).data);
      frames[quality] = {
        pixels,
        image: gl.domElement.toDataURL(),
        active: v.aoActive,
        size: [v.aoPass.width, v.aoPass.height],
        calls: gl.info.render.calls,
      };
      timings[quality] = elapsed.slice(1);
    };
    capture("off");
    capture("low");
    capture("high");
    capture("off");
    let changed = 0,
      total = 0;
    const a = frames.off.pixels,
      b = frames.low.pixels;
    for (let i = 0; i < a.length; i += 4) {
      const d =
        Math.abs(a[i] - b[i]) +
        Math.abs(a[i + 1] - b[i + 1]) +
        Math.abs(a[i + 2] - b[i + 2]);
      if (d > 3) changed++;
      total += d;
    }
    const after = state(),
      restored = Object.keys(before).every((k) => before[k] === after[k]);
    const details = Object.fromEntries(
      Object.entries(frames).map(([k, f]) => [
        k,
        { active: f.active, size: f.size, calls: f.calls, image: f.image },
      ]),
    );
    gl.setSize(480, 300, false);
    s.config.ambientOcclusion = "high";
    v.draw(s, 0);
    const resized = [v.aoPass.width, v.aoPass.height];
    s.config.graphicsQuality = "low";
    v.draw(s, 0);
    return {
      changed,
      total,
      restored,
      frames: details,
      timings,
      resized,
      lowQualityContactDisk: v.contactShadow.visible,
      lowQualityBypass: !v.aoActive,
    };
  });
  for (const [n, f] of Object.entries(report.frames)) {
    writeFileSync(
      out + "/contact-" + n + ".png",
      Buffer.from(f.image.split(",")[1], "base64"),
    );
    delete f.image;
  }
  expect(report.changed).toBeGreaterThan(50);
  expect(report.restored).toBe(true);
  expect(report.frames.off.active).toBe(false);
  expect(report.frames.low.active).toBe(true);
  expect(report.frames.high.active).toBe(true);
  expect(report.frames.low.size).toEqual([320, 200]);
  expect(report.frames.high.size).toEqual([480, 300]);
  expect(report.resized).toEqual([360, 225]);
  expect(report.lowQualityContactDisk).toBe(true);
  expect(evidence.errors).toEqual([]);
  expect(evidence.external).toEqual([]);
  writeFileSync(
    out + "/contact-shading-report.json",
    JSON.stringify(report, null, 2),
  );
});

test("Homing Shot charges, fires six guided spheres on V, pauses cleanly and preserves cooldowns across reload; late jumps enter correctly", async ({
  page,
}) => {
  test.setTimeout(180000);
  const evidence = await boot(page);
  await portal(page);
  const setup = await page.evaluate(() => {
    const g = dcsmcraft,
      e = g.giganto,
      s = e.session,
      v = e.view;
    g.running = false;
    e.input("skip");
    Object.assign(s.config, {
      graphicsQuality: "low",
      shadowQuality: "off",
      postProcessing: false,
      music: false,
      masterVolume: 0.03,
      musicVolume: 0,
      cameraShake: 0,
    });
    g.renderer.gl.setPixelRatio(1);
    g.renderer.gl.setSize(640, 400, false);
    s.config.climbMode = "ruins";
    s.time = 200;
    s.avatar.onGround = false;
    s.avatar.vy = 12;
    s.avatar.y = 6;
    s.avatar.vx = s.avatar.vz = 0;
    v.draw(s, 1 / 60);
    const jump = {
      clip: v.sonic.userData.currentClip,
      time: v.sonic.userData.body.time,
    };
    s.time += 0.2;
    v.draw(s, 0.2);
    jump.advanced = v.sonic.userData.body.time;
    s.stage = "combat";
    s.emerald = true;
    s.stageTime = 3;
    s.idle = 999;
    s.rings = 400;
    s.attack = "idle";
    s.lock = true;
    s.action = "idle";
    s.actionTime = 0;
    s.strike = null;
    Object.assign(s.avatar, {
      x: 0,
      y: 57,
      z: 45,
      vx: 0,
      vy: 0,
      vz: 0,
      onGround: false,
      yaw: 0,
    });
    for (let i = 0; i < 24; i++) v.draw(s, 1 / 60);
    window.volleyEvents = [];
    const event = e.audio.event.bind(e.audio);
    e.audio.event = (x) => {
      window.volleyEvents.push(x);
      event(x);
    };
    g.running = true;
    dispatchEvent(
      new KeyboardEvent("keydown", { code: "KeyV", bubbles: true }),
    );
    dispatchEvent(new KeyboardEvent("keyup", { code: "KeyV", bubbles: true }));
    for (let i = 0; i < 18; i++) e.frame(1 / 60);
    g.running = false;
    const charge = g.renderer.gl.domElement.toDataURL();
    g.running = true;
    g.pause();
    const paused = { time: s.time, rings: s.rings };
    for (let i = 0; i < 8; i++) e.frame(1 / 60);
    return {
      jump,
      charge,
      action: s.action,
      clip: v.sonic.userData.currentClip,
      projectiles: s.projectiles.length,
      pausedFrozen: s.time === paused.time && s.rings === paused.rings,
      voices: e.audio.foley?.voices.size || 0,
      worldSettings: JSON.stringify(g.settings),
    };
  });
  writeFileSync(
    out + "/homing-shot-charge.png",
    Buffer.from(setup.charge.split(",")[1], "base64"),
  );
  delete setup.charge;
  expect(setup.jump.clip).toBe("jump");
  expect(setup.jump.time).toBe(0);
  expect(setup.jump.advanced).toBeCloseTo(0.2, 5);
  expect(setup.action).toBe("shot");
  expect(setup.clip).toBe("homing_shot");
  expect(setup.projectiles).toBe(0);
  expect(setup.pausedFrozen).toBe(true);
  expect(setup.voices).toBe(0);
  await page.locator("[data-titan=resume]").click();
  const volley = await page.evaluate(async () => {
    const g = dcsmcraft,
      e = g.giganto,
      s = e.session;
    g.running = false;
    g.running = true;
    let image = null,
      maxProjectiles = 0,
      voices = 0;
    for (let i = 0; i < 150; i++) {
      e.frame(1 / 60);
      maxProjectiles = Math.max(maxProjectiles, s.projectiles.length);
      voices = Math.max(voices, e.audio.foley?.voices.size || 0);
      if (i === 20) image = g.renderer.gl.domElement.toDataURL();
    }
    g.running = false;
    await g.save();
    return {
      id: g.id,
      hp: s.hp,
      damage: s.maxHp - s.hp,
      releases: window.volleyEvents.filter((e) => e.type === "shot").length,
      hits: window.volleyEvents.filter(
        (e) => e.type === "hit" && e.kind === "shot",
      ).length,
      maxProjectiles,
      voices,
      remaining: s.projectiles.length,
      cooldown: s.cooldowns.shot,
      meshScale: e.view.sonic.scale.toArray(),
      worldScale: s.config.colossalScale ? 1.6 : 1,
      image,
    };
  });
  writeFileSync(
    out + "/homing-shot-volley.png",
    Buffer.from(volley.image.split(",")[1], "base64"),
  );
  delete volley.image;
  expect(volley.releases).toBe(6);
  expect(volley.hits).toBe(6);
  expect(volley.damage).toBe(270);
  expect(volley.maxProjectiles).toBeGreaterThan(1);
  expect(volley.maxProjectiles).toBeLessThanOrEqual(8);
  expect(volley.voices).toBeGreaterThan(0);
  expect(volley.remaining).toBe(0);
  expect(volley.meshScale.map((v) => v * volley.worldScale)).toEqual([1, 1, 1]);
  expect(volley.cooldown).toBeGreaterThan(4);
  await page.evaluate(async (id) => {
    await dcsmcraft.loadWorld(id);
    dcsmcraft.pause();
  }, volley.id);
  await page.waitForFunction(() => dcsmcraft.giganto.view?.assetsReady);
  const restored = await page.evaluate(() => {
    const e = dcsmcraft.giganto;
    dcsmcraft.running = false;
    return {
      hp: e.session.hp,
      cooldown: e.session.cooldowns.shot,
      projectiles: e.session.projectiles.length,
      strike: e.session.strike,
    };
  });
  expect(restored.hp).toBe(volley.hp);
  expect(restored.cooldown).toBeCloseTo(volley.cooldown, 1);
  expect(restored.projectiles).toBe(0);
  expect(restored.strike).toBeNull();
  await page.locator("[data-titan=exit]").click();
  await page.waitForFunction(() => !dcsmcraft.giganto.active);
  expect(await page.evaluate(() => JSON.stringify(dcsmcraft.settings))).toBe(
    setup.worldSettings,
  );
  expect(evidence.errors).toEqual([]);
  expect(evidence.external).toEqual([]);
  writeFileSync(
    out + "/homing-shot-report.json",
    JSON.stringify({ setup, volley, restored }, null, 2),
  );
});

test("double sweep displays both warnings, releases each hand once, pauses safely and recovers without a hand snap", async ({
  page,
}) => {
  test.setTimeout(180000);
  const evidence = await boot(page);
  await portal(page);
  const report = await page.evaluate(() => {
    const g = dcsmcraft,
      e = g.giganto,
      s = e.session,
      v = e.view;
    g.running = false;
    e.input("skip");
    Object.assign(s.config, {
      graphicsQuality: "low",
      shadowQuality: "off",
      postProcessing: false,
      music: false,
      cameraShake: 0,
    });
    s.stage = "combat";
    s.emerald = true;
    s.phase = 1;
    s.idle = 999;
    s.attack = "sweep";
    s.attackTime = 0;
    s.released = false;
    s.sweepFollowup = false;
    s.sweepConsumed = 0;
    s.sweepDamaged = false;
    s.rings = 400;
    s.iframes = 0;
    Object.assign(s.avatar, {
      x: 0,
      y: 57,
      z: 55,
      vx: 0,
      vy: 0,
      vz: 0,
      onGround: false,
    });
    g.renderer.gl.setPixelRatio(1);
    g.renderer.gl.setSize(640, 400, false);
    const events = [],
      event = e.audio.event.bind(e.audio);
    e.audio.event = (x) => {
      events.push(x);
      event(x);
    };
    let left = null,
      right = null,
      leftState,
      rightState,
      maxRecoveryGap = 0,
      lastHands = null,
      previousAttack = "sweep";
    g.running = true;
    for (let i = 0; i < 245; i++) {
      e.frame(1 / 60);
      const hands = ["L", "R"].map((side) =>
        v.boss.userData.bones["hand" + side]
          .getWorldPosition(v.dummy.position)
          .toArray(),
      );
      if (previousAttack === "sweep" && s.attack === "idle" && lastHands)
        maxRecoveryGap = Math.max(
          ...hands.map((h, k) =>
            Math.hypot(...h.map((x, j) => x - lastHands[k][j])),
          ),
        );
      previousAttack = s.attack;
      lastHands = hands;
      if (i === 112) {
        left = g.renderer.gl.domElement.toDataURL();
        leftState = {
          first: v.warning.visible,
          second: v.warningSecond.visible,
          clip: v.boss.userData.currentClip,
          tell: e.hud.querySelector("#titan-tell").textContent,
        };
      }
      if (i === 166) {
        right = g.renderer.gl.domElement.toDataURL();
        rightState = {
          first: v.warning.visible,
          second: v.warningSecond.visible,
          tell: e.hud.querySelector("#titan-tell").textContent,
        };
      }
    }
    g.running = false;
    const paused = { time: s.time, clock: s.attackTime };
    for (let i = 0; i < 5; i++) e.frame(1 / 60);
    return {
      left,
      right,
      leftState,
      rightState,
      maxRecoveryGap,
      first: events.filter((x) => x.type === "boss-release").length,
      second: events.filter((x) => x.type === "boss-followup").length,
      spacing:
        events.find((x) => x.type === "boss-followup").at -
        events.find((x) => x.type === "boss-release").at,
      stage: s.stage,
      attack: s.attack,
      rings: s.rings,
      pauseFrozen: s.time === paused.time && s.attackTime === paused.clock,
    };
  });
  for (const n of ["left", "right"]) {
    writeFileSync(
      out + "/double-sweep-" + n + ".png",
      Buffer.from(report[n].split(",")[1], "base64"),
    );
    delete report[n];
  }
  expect(report.first).toBe(1);
  expect(report.second).toBe(1);
  expect(report.spacing).toBeCloseTo(0.9, 1);
  expect(report.leftState).toMatchObject({
    first: true,
    second: true,
    clip: "double_sweep",
  });
  expect(report.rightState).toMatchObject({ first: false, second: true });
  expect(report.maxRecoveryGap).toBeLessThan(0.5);
  expect(report.attack).toBe("idle");
  expect(report.rings).toBeGreaterThan(390);
  expect(report.pauseFrozen).toBe(true);
  expect(evidence.errors).toEqual([]);
  expect(evidence.external).toEqual([]);
  writeFileSync(
    out + "/double-sweep-report.json",
    JSON.stringify(report, null, 2),
  );
});
