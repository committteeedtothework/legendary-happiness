import {wyvernPlatforms} from "../../src/wyvern-platforms.js";
import {wyvernPassages} from "../../src/wyvern-passages.js";
import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { resolve, extname } from "node:path";
const html = readFileSync("dist/DCSMCRAFT-Standalone.html"),
  out =
    process.env.DCSMCRAFT_WYVERN_ARTIFACTS ||
    "/workspace/artifacts/wyvern-reference";
mkdirSync(out, { recursive: true });
let server, origin;
test.use({ trace: "off" });
test.beforeAll(async () => {
  server = createServer((q, r) => {
    if (q.url.startsWith("/mobile/")) {
      try {
        const base = resolve("dist/mobile"),
          file = resolve(
            base,
            decodeURIComponent(q.url.slice(8)) || "index.html",
          );
        if (!file.startsWith(base + "/")) throw Error("path");
        const types = {
          ".html": "text/html",
          ".js": "application/javascript",
          ".json": "application/json",
          ".webmanifest": "application/manifest+json",
          ".glb": "model/gltf-binary",
          ".mp3": "audio/mpeg",
          ".css": "text/css",
        };
        r.setHeader(
          "Content-Type",
          types[extname(file)] || "application/octet-stream",
        );
        r.end(readFileSync(file));
      } catch {
        r.writeHead(404);
        r.end();
      }
      return;
    }
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
async function boot(page, path = "/wyvern.html") {
  const errors = [],
    external = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (/Shader Error|GL_INVALID|WebGLProgram/.test(m.text()))
      errors.push(m.text());
  });
  await page.route("**/*", (r) =>
    r
      .request()
      .url()
      .startsWith(origin + "/")
      ? r.continue()
      : (external.push(r.request().url()), r.abort()),
  );
  await page.addInitScript(() =>
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
        skin: "hero",
      }),
    ),
  );
  await page.goto(origin + path);
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.locator("[data-action=create]").click();
  await page.locator("[name=seed]").fill("WyvernRelease");
  await page.locator("[name=mode][value=creative]").check();
  await page.locator("[data-action=start-world]").click();
  await page.waitForFunction(() => dcsmcraft.running);
  await page.evaluate(() => {
    const g = dcsmcraft;
    g.pause();
    for (let x = 0; x < 10; x++)
      for (let z = 0; z < 10; z++) {
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
    });
    g.inventory.slots.fill(null);
    g.inventory.slots[0] = { id: "diamond_sword", count: 1, durability: 500 };
    g.giganto.record.portal = {
      id: "giganto:retained",
      x: 60,
      y: 200,
      z: 60,
      cell: "g:retained",
    };
    g.giganto.record.ledger = ["prior-giganto-win"];
    g.giganto.wyvern.record.portal = {
      id: "wyvern:browser",
      x: 4,
      y: 200,
      z: 4,
      cell: "w:browser",
    };
    g.giganto.overworld(0.01);
    if (g.touch?.mobile) g.touch.activate();
    g.resume();
  });
  if (path.startsWith("/mobile"))
    await page.locator('[data-touch="use"]').tap({ timeout: 15000 });
  else await page.keyboard.press("KeyE");
  await page.waitForFunction(
    () =>
      dcsmcraft.giganto.active &&
      !dcsmcraft.giganto.pending &&
      dcsmcraft.giganto.view?.assetsReady,
    null,
    { timeout: 90000 },
  );
  await freeze(page);
  return { errors, external };
}
async function freeze(page) {
  await page.evaluate(() => {
    dcsmcraft.running = false;
    document.exitPointerLock?.();
  });
  await page.waitForTimeout(150);
  await page.evaluate(() => {
    dcsmcraft.ui.play();
    dcsmcraft.pointerLockFallback = true;
    dcsmcraft.running = false;
  });
}
async function capture(page, name) {
  await page.evaluate(() => {
    const e = dcsmcraft.giganto;
    e.controls.clear();
    for (let i = 0; i < 8; i++) e.view.draw(e.session, 0.2);
    e.updateHUD();
    e.hud.hidden = false;
  });
  await page.screenshot({ path: `${out}/${name}.png` });
}
async function advance(page, kind) {
  return page.evaluate((kind) => {
    const g = dcsmcraft,
      e = g.giganto,
      s = e.session,
      draw = e.view.draw,
      hud = e.updateHUD;
    e.view.draw = () => {};
    e.updateHUD = () => {};
    g.ui.play();
    g.pointerLockFallback = true;
    g.running = false;
    let ticks = 0;
    const step = () => {
      g.running = true;
      g.elapsed += 1 / 60;
      e.frame(1 / 60);
      g.running = false;
      ticks++;
    };
    const walk = (target) => {
      for (let i = 0; i < 2400; i++) {
        const p = s.avatar,
          dx = target.x - p.x,
          dz = target.z - p.z;
        if (Math.hypot(dx, dz) < 0.7) return;
        p.yaw = Math.atan2(-dx, -dz);
        e.controls = new Set(["KeyW"]);
        step();
      }
      throw Error("Tower walk failed " + JSON.stringify(s.avatar));
    };
    try {
      if (kind === "traverse") {
        while (s.stage === "intro" && ticks < 500) step();
        walk({ x: -258, z: 180 });
        for (let i = 3; i <= 384; i += 3) {
          const u = i / 384,
            a = -u * Math.PI * 6;
          walk({ x: -300 + Math.cos(a) * 42, z: 180 + Math.sin(a) * 42 });
        }
        e.controls.clear();
        if (!e.input("homing")) throw Error("Tower launch rejected");
        while (s.wyvern.section === "boarding" && ticks < 10000) step();
        while (s.wyvern.section === "runway" && ticks < 18000) {
          for (let i = 0; i < 3; i++)
            if (s.wyvern.gate <= i && [560, 1275, 1990][i] - s.wyvern.rail < 15)
              e.input("homing");
          e.controls = new Set(["ShiftLeft"]);
          step();
        }
        s.avatar.yaw=Math.atan2(s.avatar.x,s.avatar.z);
        e.controls = new Set(["KeyW"]);
        while (s.stage === "traversal" && ticks < 18500) step();
        e.controls.clear();
        while (s.stage === "transform" && ticks < 20000) step();
      } else if (kind === "fight") {
        const stages = new Set(),
          phases = new Set();
        while (!["victory", "defeat"].includes(s.stage) && ticks < 60 * 420) {
          window.wyvernRefFrames ||= {};
          const shotAt = {
            phase: 9,
            "wyvern-counter": 2.8,
            "wyvern-mouth": 0.7,
            "wyvern-barrage": 0.8,
            finale: 6.9,
          };
          if (
            shotAt[s.stage] !== undefined &&
            s.stageTime >= shotAt[s.stage] &&
            !window.wyvernRefFrames[s.stage]
          )
            window.wyvernRefFrames[s.stage] = structuredClone(s);
          stages.add(s.stage);
          phases.add(s.phase);
          if (s.qte) {
            const u = (s.qte.age % 3) / 3;
            if (
              (s.qte.kind === "mash" && ticks % 6 === 0) ||
              (s.qte.kind === "timing" && u > 0.56 && u < 0.64)
            )
              e.input("hit");
          }
          if (s.stage === "combat" && s.wyvern.open > 0)
            for (const a of ["cyclone", "rush", "spin", "boom", "cross"])
              if (!s.strike && s.cooldowns[a] <= 0) e.input(a);
          const p = s.avatar,
            dx = -p.x,
            dz = p.z + 43,
            dy = 65 - p.y;
          p.yaw = s.wyvern.open>0?Math.PI:0;
          e.controls = new Set();
          const w=s.wyvern;
          if (!w.parryUsed && (w.missiles.some(m=>!m.reflected&&m.eta-m.age<0.1) ||
            (["claws","bite"].includes(w.mode)&&w.timer<0.1))) e.controls.add("Mouse2");
          if (s.wyvern.open > 0) e.controls.add("Mouse0");
          if (s.wyvern.open>0 && Math.abs(dx)>0.7) e.controls.add(dx>0?"KeyA":"KeyD");
          if (s.wyvern.open>0 && Math.abs(dz)>0.7) e.controls.add(dz>0?"KeyS":"KeyW");
          if (s.wyvern.open>0 && Math.abs(dy) > 1)
            e.controls.add(dy > 0 ? "Space" : "ControlLeft");
          if (s.wyvern.mode === "missiles" || Math.hypot(dx, dz) > 32) e.controls.add("ShiftLeft");
          step();
        }
        window.wyvernJourney = {
          stages: [...stages],
          phases: [...phases],
          ticks,
        };
      } else if (kind === "return") {
        e.controls = new Set(["KeyW"]);
        for (let i = 0; i < 150 && !e.closing; i++) step();
      }
      return {
        stage: s.stage,
        section: s.wyvern.section,
        rings: s.rings,
        hp: s.hp,
        maxHp: s.maxHp,
        ticks,
        journey: window.wyvernJourney,
        position: { ...s.avatar },
        portal: s.returnPortal,
      };
    } finally {
      e.controls.clear();
      e.view.draw = draw;
      e.updateHUD = hud;
      g.running = false;
    }
  }, kind);
}
test("Wyvern portal, physical tower/runway, saved fight, every phase and return preserve the original world and Giganto progress", async ({
  page,
}) => {
  test.setTimeout(240000);
  const ev = await boot(page);
  await capture(page, "wyvern-entrance");
  const route = await advance(page, "traverse");
  console.log("Wyvern traversal", route.stage, route.ticks);
  expect(route.stage).toBe("combat");
  expect(route.rings).toBeGreaterThan(80);
  await capture(page, "wyvern-combat");
  const saved = await page.evaluate(async () => {
    const g = dcsmcraft;
    g.running = false;
    await g.save();
    return {
      id: g.id,
      rings: g.giganto.session.rings,
      hp: g.giganto.session.hp,
      original: g.giganto.session.original,
    };
  });
  await page.evaluate(async (id) => {
    await dcsmcraft.loadWorld(id);
    dcsmcraft.running = false;
  }, saved.id);
  await page.waitForFunction(() => dcsmcraft.giganto.view?.assetsReady);
  await freeze(page);
  expect(
    await page.evaluate(() => ({
      rings: dcsmcraft.giganto.session.rings,
      hp: dcsmcraft.giganto.session.hp,
      titan: dcsmcraft.giganto.session.titan,
    })),
  ).toEqual({ rings: saved.rings, hp: saved.hp, titan: "wyvern" });
  const win = await advance(page, "fight");
  console.log("Wyvern fight", win.stage, win.ticks);
  expect(win.stage).toBe("victory");
  expect(win.journey.phases).toEqual([1, 2]);
  for (const st of [
    "phase",
    "wyvern-volley",
    "wyvern-slam",
    "wyvern-dive",
    "wyvern-mouth",
    "wyvern-hold",
    "wyvern-launch",
    "wyvern-barrage",
    "wyvern-missile",
    "finale",
  ])
    expect(win.journey.stages).toContain(st);
  expect(win.portal.crossed).toBe(false);
  await capture(page, "wyvern-victory");
  for (const name of [
    "phase",
    "wyvern-slam",
    "wyvern-barrage",
    "wyvern-mouth",
    "finale",
  ]) {
    const staged = await page.evaluate((name) => {
      const e = dcsmcraft.giganto,
        shot = window.wyvernRefFrames?.[name];
      if (!shot) return false;
      window.actualWyvernSession = e.record.session;
      e.record.session = structuredClone(shot);
      e.view.lastDrawn = false;
      return true;
    }, name);
    if (staged) {
      if (name === "wyvern-barrage") {
        const qte = await page.evaluate(() => {
          const e = dcsmcraft.giganto;
          e.updateHUD();
          const a = e.hud.querySelector(".qte-time"),
            b = e.hud.querySelector(".qte-effort");
          const scale = Number(b.style.transform.match(/scale\(([^)]+)/)[1]);
          return {
            contact:
              1 -
              (Number(b.getAttribute("r")) * scale) /
                Number(a.getAttribute("r")),
            key: e.hud.querySelector(".titan-qte-key").textContent,
          };
        });
        expect(qte.contact).toBeGreaterThan(0.54);
        expect(qte.contact).toBeLessThan(0.67);
        expect(qte.key).toBe("LMB");
        for (const [family, key] of [
          ["xbox", "X"],
          ["playstation", "□"],
          ["switch", "Y"],
        ]) {
          const glyph = await page.evaluate((family) => {
            const g = dcsmcraft;
            g.controller.lastDevice = "controller";
            g.controller.family = family;
            g.giganto.updateHUD();
            return g.giganto.hud.querySelector(".titan-qte-key").textContent;
          }, family);
          expect(glyph).toBe(key);
        }
        await page.evaluate(() => {
          dcsmcraft.controller.lastDevice = "keyboard";
          dcsmcraft.giganto.updateHUD();
        });
      }
      await capture(page, "reference-" + name);
      await page.evaluate(() => {
        const e = dcsmcraft.giganto;
        e.record.session = window.actualWyvernSession;
        e.view.lastDrawn = false;
        delete window.actualWyvernSession;
      });
    }
  }
  await page.evaluate(() => {
    const e = dcsmcraft.giganto;
    e.view.draw(e.session, 0);
  });
  await advance(page, "return");
  await page.waitForFunction(() => !dcsmcraft.giganto.active);
  await freeze(page);
  const returned = await page.evaluate(async () => {
    const g = dcsmcraft;
    await g.save();
    return {
      player: {
        x: g.player.x,
        y: g.player.y,
        z: g.player.z,
        health: g.player.health,
        hunger: g.player.hunger,
      },
      sword: g.inventory.slots[0],
      diamonds: g.inventory.slots
        .filter((s) => s?.id === "diamond")
        .reduce((a, s) => a + s.count, 0),
      ledger: g.giganto.record.ledger,
      portal: g.giganto.record.portal,
      wyvern: g.giganto.wyvern.record,
      shadows: g.renderer.gl.shadowMap.enabled,
    };
  });
  expect(returned.player).toEqual({
    x: 4.5,
    y: 200,
    z: 7,
    health: 17,
    hunger: 12,
  });
  expect(returned.sword).toEqual({
    id: "diamond_sword",
    count: 1,
    durability: 500,
  });
  expect(returned.diamonds).toBe(6);
  expect(returned.ledger).toEqual(["prior-giganto-win"]);
  expect(returned.portal.id).toBe("giganto:retained");
  expect(returned.wyvern.ledger).toHaveLength(1);
  expect(returned.wyvern.portal).toBeNull();
  expect(returned.wyvern.cooldownUntil).toBeGreaterThan(0);
  await page.evaluate(async (id) => {
    await dcsmcraft.loadWorld(id);
    dcsmcraft.running = false;
  }, saved.id);
  await freeze(page);
  expect(
    await page.evaluate(() => dcsmcraft.giganto.wyvern.record.ledger.length),
  ).toBe(1);
  expect(
    await page.evaluate(() =>
      dcsmcraft.inventory.slots
        .filter((s) => s?.id === "diamond")
        .reduce((a, s) => a + s.count, 0),
    ),
  ).toBe(6);
  expect(ev.errors).toEqual([]);
  expect(ev.external).toEqual([]);
  writeFileSync(
    out + "/journey-report.json",
    JSON.stringify(
      {
        htmlSHA256: createHash("sha256").update(html).digest("hex"),
        route,
        win,
        returned,
        errors: ev.errors,
      },
      null,
      2,
    ),
  );
});

test("Wyvern reload, pause, defeat/retry, interrupted return and repeated entry keep audio and rewards isolated", async ({
  page,
}) => {
  test.setTimeout(240000);
  const ev = await boot(page);
  await page.evaluate(() => {
    const g = dcsmcraft,
      e = g.giganto,
      s = e.session;
    Object.assign(s, {
      stage: "combat",
      checkpoint: "phase2",
      emerald: true,
      phase: 2,
      hp: s.maxHp * 0.42,
      rings: 180,
    });
    Object.assign(s.avatar, { x: 0, y: 65, z: -43, yaw:Math.PI, onGround: false });
    s.wyvern.yaw=Math.PI;s.wyvern.open = 8;
    s.cooldowns.boom = 3.5;
    s.wyvern.ringIds = ["field:1", "rail:3"];
    e.menu();
  });
  await expect(page.locator(".titan-settings")).toBeVisible();
  expect(await page.locator('[data-titan-config="climbMode"]').count()).toBe(0);
  expect(
    await page.locator('[data-titan-config="shadowQuality"]').count(),
  ).toBe(1);
  const paused = await page.evaluate(async () => {
    const g = dcsmcraft,
      e = g.giganto,
      t = e.session.time;
    g.running = false;
    e.frame(0.1);
    await g.save();
    return { id: g.id, time: e.session.time, t, hp: e.session.hp };
  });
  expect(paused.time).toBe(paused.t);
  await page.evaluate(async (id) => {
    await dcsmcraft.loadWorld(id);
    dcsmcraft.running = false;
  }, paused.id);
  await page.waitForFunction(() => dcsmcraft.giganto.view?.assetsReady);
  await freeze(page);
  expect(
    await page.evaluate(() => ({
      phase: dcsmcraft.giganto.session.phase,
      hp: dcsmcraft.giganto.session.hp,
      cd: dcsmcraft.giganto.session.cooldowns.boom,
      ids: dcsmcraft.giganto.session.wyvern.ringIds,
    })),
  ).toEqual({ phase: 2, hp: paused.hp, cd: 0, ids: ["field:1", "rail:3"] });
  await page.evaluate(() => {
    const g = dcsmcraft,
      e = g.giganto,
      s = e.session;
    s.rings = 0.001;
    s.config.drain = 3;
    g.running = true;
    e.frame(1 / 30);
    g.running = false;
  });
  expect(await page.evaluate(() => dcsmcraft.giganto.session.stage)).toBe(
    "defeat",
  );
  await page.evaluate(async () => {
    await dcsmcraft.giganto.button("retry");
    dcsmcraft.running = false;
  });
  await freeze(page);
  expect(
    await page.evaluate(() => ({
      stage: dcsmcraft.giganto.session.stage,
      phase: dcsmcraft.giganto.session.phase,
      rings: dcsmcraft.giganto.session.rings,
    })),
  ).toEqual({ stage: "combat", phase: 2, rings: 220 });
  const rollback = await page.evaluate(async () => {
    const g = dcsmcraft,
      e = g.giganto,
      save = g.save,
      inv = JSON.stringify(g.inventory.export());
    g.save = async () => {
      throw Error("test interrupted write");
    };
    const result = await e.exit();
    g.save = save;
    return {
      result,
      active: e.active,
      titan: e.session.titan,
      inventorySame: inv === JSON.stringify(g.inventory.export()),
      gLedger: e.wyvern.savedGigantoRecord.ledger,
      wLedger: e.record.ledger,
    };
  });
  expect(rollback).toEqual({
    result: false,
    active: true,
    titan: "wyvern",
    inventorySame: true,
    gLedger: ["prior-giganto-win"],
    wLedger: [],
  });
  await page.evaluate(async () => {
    await dcsmcraft.giganto.exit();
    dcsmcraft.running = false;
  });
  await freeze(page);
  expect(await page.evaluate(() => dcsmcraft.giganto.active)).toBe(false);
  expect(
    await page.evaluate(() => dcsmcraft.giganto.wyvern.record.ledger.length),
  ).toBe(0);
  // A second, independent portal entry exercises resource cleanup after a failed return.
  await page.evaluate(() => {
    const g = dcsmcraft,
      e = g.giganto;
    e.wyvern.record.cooldownUntil = 0;
    e.wyvern.record.portal = {
      id: "wyvern:second",
      x: 4,
      y: 200,
      z: 4,
      cell: "w:second",
    };
    e.overworld(0.01);
    g.resume();
  });
  await page.keyboard.press("KeyE");
  await page.waitForFunction(
    () =>
      dcsmcraft.giganto.active &&
      !dcsmcraft.giganto.pending &&
      dcsmcraft.giganto.view?.assetsReady,
  );
  await freeze(page);
  const rendered = await page.evaluate(() => {
    const e = dcsmcraft.giganto,
      s = e.session,
      gl = dcsmcraft.renderer.gl,
      old = {
        tone: gl.toneMapping,
        exposure: gl.toneMappingExposure,
        shadow: gl.shadowMap.enabled,
        target: gl.getRenderTarget(),
      };
    s.stage = "combat";
    s.emerald = true;
    Object.assign(s.avatar, { x: 0, y: 65, z: -43, yaw:Math.PI });
    const frames = [];
    for (const dt of [1 / 30, 1 / 60, 1 / 144]) {
      for (let i = 0; i < 12; i++) e.view.draw(s, dt);
      frames.push(e.view.sonic.scale.toArray());
    }
    const skyOffsets = [];
    for (const flightTime of [12, 48, 92]) {
      s.wyvern.flightTime = flightTime;
      e.view.draw(s, 0);
      const eye = e.view.camera.getWorldPosition(
        e.view.camera.position.clone(),
      );
      skyOffsets.push(
        e.view.environment.moon.position.clone().sub(eye).toArray(),
      );
    }
    return {
      frames,
      skyOffsets,
      stable:
        old.tone === gl.toneMapping &&
        old.exposure === gl.toneMappingExposure &&
        old.shadow === gl.shadowMap.enabled &&
        old.target === gl.getRenderTarget(),
      bones: e.view.boss.userData.mixer?.getRoot()?.name || e.view.boss.name,
    };
  });
  expect(rendered.stable).toBe(true);
  for (const d of rendered.skyOffsets)
    expect(d.map(Math.round)).toEqual([-900, 700, -1100]);
  for (const scale of rendered.frames)
    expect(scale.every(Number.isFinite)).toBe(true);
  await page.evaluate(async () => {
    await dcsmcraft.giganto.exit();
    dcsmcraft.running = false;
  });
  await freeze(page);
  // Enter the pre-existing Giganto portal after two Wyvern sessions.
  await page.evaluate(() => {
    const g = dcsmcraft,
      e = g.giganto;
    for (let x = 56; x < 66; x++)
      for (let z = 56; z < 66; z++) {
        g.world.set(x, 199, z, 3);
        for (let y = 200; y < 206; y++) g.world.set(x, y, z, 0);
      }
    Object.assign(g.player, { x: 60.5, y: 200, z: 63, yaw: 0, onGround: true });
    e.overworld(0.01);
    g.resume();
  });
  await page.keyboard.press("KeyE");
  await page.waitForFunction(
    () =>
      dcsmcraft.giganto.active &&
      !dcsmcraft.giganto.pending &&
      dcsmcraft.giganto.view?.assetsReady,
  );
  await freeze(page);
  expect(
    await page.evaluate(() => dcsmcraft.giganto.session.titan || "giganto"),
  ).toBe("giganto");
  await expect(page.locator(".titan-title")).toHaveText("GIGANTO");
  await page.evaluate(async () => {
    await dcsmcraft.giganto.exit();
    dcsmcraft.running = false;
  });
  expect(ev.errors).toEqual([]);
  expect(ev.external).toEqual([]);
  writeFileSync(
    out + "/reliability-report.json",
    JSON.stringify({ rollback, rendered, errors: ev.errors }, null, 2),
  );
});

test.describe("Wyvern mobile", () => {
  test.use({
    viewport: { width: 844, height: 390 },
    hasTouch: true,
    isMobile: true,
    deviceScaleFactor: 1,
    userAgent:
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile Safari/604.1",
  });
  test("the mobile asset build enters Wyvern and touch controls dispatch flight, combat, parry and pause", async ({
    page,
  }) => {
    test.setTimeout(180000);
    const ev = await boot(page, "/mobile/");
    await page.evaluate(() => {
      const g = dcsmcraft,
        e = g.giganto,
        s = e.session;
      Object.assign(s, { stage: "combat", emerald: true, stageTime: 10 });
      Object.assign(s.avatar, { x: 0, y: 65, z: -43, yaw:Math.PI, onGround: false });
      s.wyvern.open = 10;
      s.config.graphicsQuality = "low";
      s.config.shadowQuality = "off";
      s.config.postProcessing = false;
      s.config.drain = 0;
      window.wyvernTouchActions = [];
      const input = e.input.bind(e);
      e.input = (a) => {
        wyvernTouchActions.push(a);
        return input(a);
      };
      g.resume();
    });
    await expect(page.locator('[data-touch="boost"]')).toBeVisible();
    await page.locator('[data-touch="attack"]').tap();
    await page.locator('[data-touch="dodge"]').tap();
    await page.locator('[data-touch="actions"]').tap();
    await page.locator('[data-touch="boom"]').tap();
    expect(await page.evaluate(() => wyvernTouchActions)).toEqual(
      expect.arrayContaining(["hit", "dodge", "boom"]),
    );
    await page.locator('[data-touch="pause"]').tap();
    await expect(page.locator('[data-titan="resume"]')).toBeVisible();
    expect(await page.evaluate(() => dcsmcraft.running)).toBe(false);
    await page.screenshot({ path: out + "/wyvern-touch.png" });
    await page.evaluate(async () => {
      await dcsmcraft.giganto.exit();
      dcsmcraft.running = false;
    });
    expect(ev.errors).toEqual([]);
    expect(ev.external).toEqual([]);
  });
});

for (const path of ["/wyvern.html", "/mobile/index.html"]) {
  test.describe(`Wyvern soundtrack ${path}`, () => {
  test.use({hasTouch:true});
  test(`Wyvern supplied music uses exact phase loops, pauses, retries and releases on exit: ${path}`, async ({page}) => {
    const {errors,external} = await boot(page,path);
    await page.evaluate(async () => {
      const g=dcsmcraft,e=g.giganto,s=e.session;
      // Hold the simulation still while exercising the real audio clock.
      e.frame = () => {};
      g.audio.unlock();
      await g.audio.context.resume();
      Object.assign(s.config,{audio:true,music:true,masterVolume:0.02,musicVolume:0.5});
      s.stage="traversal";
      e.audio.frame(s,true);
    });
    await page.waitForFunction(() => dcsmcraft.giganto.audio.prelude?.player.state === "playing",null,{timeout:30000});
    const pre=await page.evaluate(() => {
      const a=dcsmcraft.giganto.audio,p=a.prelude.player;
      return {id:p.currentTrack.id,loop:p.media.loop,time:p.media.currentTime};
    });
    expect(pre.id).toBe("wyvern-prelude"); expect(pre.loop).toBe(true);
    await page.waitForFunction(() => dcsmcraft.giganto.audio.score?.buffer,null,{timeout:60000});
    const result=await page.evaluate(async () => {
      const e=dcsmcraft.giganto,s=e.session,a=e.audio,ctx=dcsmcraft.audio.context;
      Object.assign(s,{stage:"combat",stageTime:0,phase:1,emerald:true});
      a.frame(s,true);
      const p1={offset:a.score.current.offset,lo:a.score.current.source.loopStart,hi:a.score.current.source.loopEnd};
      const preStopped=a.prelude.player.media===null;
      const starts=a.score.starts;
      s.stage="wyvern-counter";a.frame(s,true);
      const same=a.score.starts===starts;
      // Start just before the boundary to exercise the real browser loop.
      a.score.stop();a.score.transport.offset=102.96;a.score.transport.when=ctx.currentTime;
      a.frame(s,true);const edgeStarts=a.score.starts;
      await new Promise(r=>setTimeout(r,160));a.score.snapshot(s);
      const wrapped=s.battleMusic.offset;
      const loopContinuous=a.score.starts===edgeStarts && a.score.current.source.loop;
      a.pause(s);const saved=s.battleMusic.offset;
      const paused=a.score.current===null;
      await new Promise(r=>setTimeout(r,120));
      a.frame(s,true);const resumed=a.score.current.offset;
      Object.assign(s,{stage:"phase",stageTime:0,phase:2});a.frame(s,true);
      const p2={offset:a.score.current.offset,lo:a.score.current.source.loopStart,hi:a.score.current.source.loopEnd};
      s.stage="combat";a.frame(s,true);const count=a.score.starts;
      s.stage="wyvern-mouth";a.frame(s,true);const qteContinuous=count===a.score.starts;
      s.attempt=(s.attempt||0)+1;s.stage="combat";s.stageTime=0;a.frame(s,true);
      const retry=a.score.current.offset;
      a.score.snapshot(s);const track=s.battleMusic.track;
      const score=a.score,prelude=a.prelude;a.silence();
      return {p1,preStopped,same,wrapped,loopContinuous,paused,saved,resumed,p2,qteContinuous,retry,track,
        disposed:score.disposed,voices:score.voices.size,media:prelude.player.media,
        master:a.master,context:ctx.state};
    });
    expect(result.p1).toEqual({offset:0,lo:0,hi:103});
    expect(result.p2).toEqual({offset:104,lo:104,hi:249});
    expect(result.preStopped&&result.same&&result.loopContinuous&&result.paused&&result.qteContinuous&&result.disposed).toBe(true);
    expect(result.wrapped).toBeGreaterThanOrEqual(0);expect(result.wrapped).toBeLessThan(1);
    expect(Math.abs(result.saved-result.resumed)).toBeLessThan(0.03);
    expect(result.retry).toBe(104);expect(result.track).toBe("titan:wyvern-battle-v1");
    expect(result.voices).toBe(0);expect(result.media).toBe(null);expect(result.master).toBe(null);
    expect(errors).toEqual([]);expect(external).toEqual([]);
  });
  });
}

test("Wyvern real abilities, vertical Cyloop and spine remain stable through frozen draws and retry",async({page})=>{
  const ev=await boot(page);const samples=[];
  for(const move of ["hit","homing","boom","rush","loop","cross","shot","stomp","spin","cyclone"]){
    const sample=await page.evaluate(move=>{
      const g=dcsmcraft,e=g.giganto,s=e.session,v=e.view;
      Object.assign(s,{stage:"combat",phase:1,time:30,stageTime:30,emerald:true,qte:null,
        action:"idle",actionTime:0,strike:null,queuedMove:null,projectiles:[],counter:0,
        cyloopHold:0,cyloopCharge:2,energy:100,combo:0,comboTime:0,phantom:0});
      Object.assign(s.config,{audio:false,music:false,graphicsQuality:"low",postProcessing:false,shadowQuality:"off"});
      Object.assign(s.wyvern,{yaw:Math.PI,open:100,mode:"open",timer:99,missiles:[],lasers:[],loopExtended:false,counterUsed:false});
      Object.assign(s.avatar,{x:0,y:65,z:-43,yaw:Math.PI,pitch:0,vx:0,vy:0,vz:0,onGround:false});
      for(const key of Object.keys(s.cooldowns))s.cooldowns[key]=0;
      e.controls.clear();const draw=v.draw,hud=e.updateHUD;v.draw=()=>{};e.updateHUD=()=>{};
      let accepted;
      try{
        accepted=e.input(move);
        const frames=move==="loop"?100:move==="homing"?20:move==="shot"?34:move==="stomp"?28:move==="spin"?25:move==="cyclone"?38:12;
        for(let i=0;i<frames;i++){g.running=true;g.elapsed+=1/60;e.frame(1/60);g.running=false;}
      }finally{v.draw=draw;e.updateHUD=hud;g.running=false;}
      for(let i=0;i<6;i++)v.draw(s,1/60);
      e.updateHUD();e.hud.hidden=false;
      const tail=v.boss.userData.tail.map(n=>n.quaternion.clone());
      for(let i=0;i<20;i++)v.draw(s,0);
      const drift=Math.max(...v.boss.userData.tail.map((n,i)=>n.quaternion.angleTo(tail[i])));
      return {move,accepted,clip:v.sonic.userData.currentClip,drift,cyloop:v.cyloop.visible,
        radius:v.cyloop.scale.x,rigScale:v.sonic.scale.toArray(),
        pools:Object.fromEntries(Object.entries(v.abilityProjectiles.pools).map(([k,m])=>[k,m.count])),
        finite:Object.values(v.sonic.userData.bones).every(b=>b.quaternion.toArray().every(Number.isFinite))};
    },move);
    expect(sample.accepted).toBe(true);expect(sample.drift).toBeLessThan(1e-6);expect(sample.finite).toBe(true);
    expect(new Set(sample.rigScale).size).toBe(1);samples.push(sample);
    if(["loop","shot","cross"].includes(move))await page.screenshot({path:out+"/wyvern-"+move+"-refined.png"});
  }
  const loop=samples.find(s=>s.move==="loop");expect(loop.cyloop).toBe(true);expect(loop.radius).toBeCloseTo(18*1.65/48);
  expect(ev.errors).toEqual([]);expect(ev.external).toEqual([]);
  writeFileSync(out+"/wyvern-ability-report.json",JSON.stringify({samples,errors:ev.errors},null,2));
});

test('Wyvern timed flick parry, larger missiles, speed camera and terrain stay readable in the real renderer',async({page})=>{
 const ev=await boot(page);
 const result=await page.evaluate(()=>{
  const g=dcsmcraft,e=g.giganto,s=e.session,v=e.view;
  Object.assign(s,{stage:'combat',emerald:true,rings:400,action:'idle',actionTime:0,strike:null,qte:null,parryHeld:false,parryAge:0});
  Object.assign(s.config,{drain:0,graphicsQuality:'balanced',postProcessing:true,shadowQuality:'low',audio:false,music:false});
  g.settings.graphics=3;g.renderer.applyGraphics();
  Object.assign(s.avatar,{x:0,y:65,z:-43,vx:0,vy:0,vz:0,yaw:0,pitch:0,onGround:false});
  Object.assign(s.wyvern,{yaw:Math.PI,open:0,mode:'missiles',timer:100,flightTime:8,missiles:[{id:1,age:0.99,eta:1,reflected:false,from:{x:46.2,y:102.3,z:-75.9},target:{x:0,y:66.8,z:-43}}]});
  for(let i=0;i<8;i++)v.draw(s,0.2);
  const draw=v.draw,hud=e.updateHUD;e.updateHUD=()=>{};const events=[];
  try{e.controls=new Set(['Mouse2']);for(let i=0;i<9;i++){g.running=true;g.elapsed+=1/60;e.frame(1/60);events.push(...s.events);g.running=false;}}finally{v.draw=draw;e.updateHUD=hud;e.controls.clear();}
  v.draw(s,1/60);e.updateHUD();e.hud.hidden=false;
  const finger=v.sonic.userData.wyvernFlick;
  return {maxHp:s.maxHp,slow:s.wyvern.timeScale,finger: finger.visible,flickAge:s.wyvern.flickAge,
    parries:events.filter(x=>x.type==='parry').length,reflected:s.wyvern.missiles[0]?.reflected,
    parts:v.missiles.meshes.map(m=>({name:m.name,count:m.count})),
    finite:Object.values(v.sonic.userData.bones).every(b=>b.quaternion.toArray().every(Number.isFinite)),
    ground:v.ground.map(m=>({width:m.geometry.parameters.width,count:m.geometry.attributes.position.count}))};
 });
 expect(result.maxHp).toBe(220000);expect(result.slow).toBe(0.22);expect(result.finger).toBe(true);expect(result.reflected).toBe(true);expect(result.parries).toBe(1);expect(result.finite).toBe(true);
 expect(result.parts).toHaveLength(4);expect(result.parts.every(p=>p.count===1)).toBe(true);expect(result.ground.every(g=>g.width===6400)).toBe(true);
 await page.screenshot({path:out+'/wyvern-flick-parry.png'});
 await page.evaluate(()=>{const e=dcsmcraft.giganto,s=e.session;Object.assign(s.wyvern,{flickAge:1,parrySlow:0,timeScale:1,flightTime:35});s.parryHeld=false;s.action='idle';s.actionTime=0;s.boosting=true;s.avatar.vz=-60;s.wyvern.missiles=[{id:3,age:1.45,eta:2.8,from:{x:46.2,y:102.3,z:-75.9},target:{x:0,y:66.8,z:-43},reflected:false}];for(let i=0;i<8;i++)e.view.draw(s,0.2);e.updateHUD();});
 await page.screenshot({path:out+'/wyvern-flight-missile.png'});
 expect(ev.errors).toEqual([]);expect(ev.external).toEqual([]);
 writeFileSync(out+'/wyvern-speed-render.json',JSON.stringify(result,null,2));
});

test('terrain pursuit keeps Sonic in world space, permits steering, renders smooth quills and starts boost audio in the input frame',async({page})=>{
 const ev=await boot(page);
 const result=await page.evaluate(()=>{
  const g=dcsmcraft,e=g.giganto,s=e.session,v=e.view;
  Object.assign(s,{stage:'combat',emerald:true,rings:400,qte:null,strike:null,action:'idle',actionTime:0});
  Object.assign(s.config,{drain:0,audio:false,music:false,graphicsQuality:'balanced',postProcessing:false,shadowQuality:'low'});
  g.settings.graphics=3;g.renderer.applyGraphics();
  Object.assign(s.wyvern,{yaw:Math.PI,routeDistance:1800,flightTime:30,mode:'missiles',open:0,timer:100,missiles:[],lasers:[]});
  Object.assign(s.avatar,{x:0,y:260,z:400,vx:0,vy:0,vz:0,yaw:0,pitch:0,onGround:false});
  const world=()=>v.flightRoot.localToWorld(v.sonic.position.clone().set(s.avatar.x,s.avatar.y,s.avatar.z)).toArray();
  v.draw(s,0);const before=world(),distanceBefore=Math.hypot(s.avatar.x,s.avatar.y-66,s.avatar.z);
  const draw=v.draw,hud=e.updateHUD;v.draw=()=>{};e.updateHUD=()=>{};
  const step=(keys,n)=>{e.controls=new Set(keys);for(let i=0;i<n;i++){g.running=true;g.elapsed+=1/60;e.frame(1/60);g.running=false;}};
  step([],120);v.draw=draw;v.draw(s,0);const after=world(),far=Math.hypot(s.avatar.x,s.avatar.y-66,s.avatar.z);v.draw=()=>{};
  step(['ShiftLeft'],180);const close=Math.hypot(s.avatar.x,s.avatar.y-66,s.avatar.z);
  step(['KeyD','Space'],12);const steering={x:s.avatar.vx,y:s.avatar.vy};
  v.draw=draw;e.updateHUD=hud;e.controls.clear();
  // Render an actual reachable combat checkpoint in the canyon for inspection.
  Object.assign(s.avatar,{x:6,y:65,z:-46,vx:0,vy:0,vz:0});s.wyvern.open=8;s.wyvern.mode='open';
  for(let i=0;i<8;i++)v.draw(s,0.2);e.updateHUD();e.hud.hidden=false;
  return {before,after,distanceBefore,far,close,steering,health:s.maxHp,
   quillMorphs:v.sonic.userData.quillMorphs.map(m=>m.morphTargetInfluences[0]),
   bossScale:v.boss.userData.scale,route:s.wyvern.routeDistance};
 });
 expect(Math.hypot(...result.before.map((n,i)=>n-result.after[i]))).toBeLessThan(0.05);expect(result.far).toBeGreaterThan(result.distanceBefore+30);expect(result.close).toBeLessThan(result.far-70);expect(result.steering.x).toBeGreaterThan(0);expect(result.steering.y).toBeGreaterThan(0);expect(result.health).toBe(220000);expect(result.quillMorphs.length).toBeGreaterThan(0);expect(result.quillMorphs.every(n=>n>0.98)).toBe(true);
 await page.screenshot({path:out+'/canyon-pursuit.png'});
 const audio=await page.evaluate(async()=>{
  const g=dcsmcraft,e=g.giganto,s=e.session;g.audio.unlock();await g.audio.context.resume();Object.assign(s.config,{audio:true,music:false,masterVolume:0.02,effectsVolume:0.3});
  s.stage='traversal';s.emerald=false;s.wyvern.section='tower';s.boosting=false;s.avatar.onGround=true;s.avatar.vx=s.avatar.vz=0;
  e.audio.frame(s,true);await e.audio.boost.prepare();const boost=e.audio.boost,buffer=boost.buffer;boost.stop(true);const starts=[];
  const original=AudioBufferSourceNode.prototype.start;AudioBufferSourceNode.prototype.start=function(...a){if(this.buffer===buffer)starts.push(a);return original.apply(this,a);};
  const draw=e.view.draw,hud=e.updateHUD;e.view.draw=()=>{};e.updateHUD=()=>{};
  try{e.controls=new Set(['KeyW','ShiftLeft']);g.running=true;e.frame(1/60);g.running=false;}
  finally{AudioBufferSourceNode.prototype.start=original;e.view.draw=draw;e.updateHUD=hud;e.controls.clear();}
  const current=g.audio.context.currentTime,active=!!boost.voice;e.audio.pause(s);return {starts,current,active,paused:boost.voice===null};
 });
 expect(audio.active).toBe(true);expect(audio.paused).toBe(true);expect(audio.starts).toHaveLength(1);expect(audio.starts[0][0]).toBeLessThanOrEqual(audio.current);expect(audio.starts[0][1]).toBeCloseTo(0.425);
 expect(ev.errors).toEqual([]);expect(ev.external).toEqual([]);writeFileSync(out+'/pursuit-controls-audio.json',JSON.stringify({result,audio},null,2));
});

test('curled jump and physical post-parry homing render without duplicate rigs, energy meters or camera jumps',async({page})=>{
 const ev=await boot(page);
 const jump=await page.evaluate(()=>{
  const g=dcsmcraft,e=g.giganto,s=e.session,v=e.view;
  Object.assign(s,{stage:'traversal',emerald:false,jumpAge:99,strike:null,qte:null,action:'idle',actionTime:0});
  Object.assign(s.wyvern,{section:'tower',air:0,yaw:0});Object.assign(s.avatar,{x:0,y:0,z:150,vx:0,vy:0,vz:0,onGround:true});
  Object.assign(s.config,{drain:0,graphicsQuality:'balanced',shadowQuality:'medium',postProcessing:true,audio:false,music:false});g.settings.graphics=3;g.renderer.applyGraphics();
  const draw=v.draw,hud=e.updateHUD;v.draw=()=>{};e.updateHUD=()=>{};e.input('jump');
  for(let i=0;i<18;i++){g.running=true;e.frame(1/60);g.running=false;}
  v.draw=draw;e.updateHUD=hud;for(let i=0;i<12;i++)v.draw(s,1/60);e.updateHUD();e.hud.hidden=false;
  return {visible:v.jumpBall.group.visible,hiddenRig:!v.sonic.userData.model.visible,scale:v.jumpBall.group.scale.toArray(),height:s.avatar.y,shadow:v.light.shadow.mapSize.x};
 });
 expect(jump.visible).toBe(true);expect(jump.hiddenRig).toBe(true);expect(jump.height).toBeGreaterThan(1);expect(new Set(jump.scale).size).toBe(1);expect(jump.shadow).toBe(2048);
 await page.screenshot({path:out+'/sonic-curled-jump.png'});
 const homing=await page.evaluate(()=>{
  const g=dcsmcraft,e=g.giganto,s=e.session,v=e.view;
  Object.assign(s,{stage:'combat',emerald:true,rings:400,strike:null,qte:null,action:'idle',actionTime:0,parryHeld:false,parryAge:0});Object.assign(s.config,{graphicsQuality:'low',shadowQuality:'off',postProcessing:false});
  Object.assign(s.avatar,{x:0,y:100,z:600,vx:0,vy:0,vz:0,yaw:0,pitch:0,onGround:false});
  Object.assign(s.wyvern,{yaw:Math.PI,flightTime:20,routeDistance:1000,open:0,mode:'missiles',timer:100,missiles:[{id:1,age:0.99,eta:1,reflected:false,from:{x:40,y:110,z:0},target:{x:0,y:101.8,z:600}}]});
  const draw=v.draw,hud=e.updateHUD;v.draw=()=>{};e.updateHUD=()=>{};
  e.controls=new Set(['Mouse2']);g.running=true;e.frame(1/60);g.running=false;e.controls.clear();
  const initial={...s.avatar},phase=s.strike?.homing?.phase;let hits=0,launches=0,maxStep=0;
  for(let i=0;i<60;i++){const p={...s.avatar};g.running=true;e.frame(1/60);g.running=false;maxStep=Math.max(maxStep,Math.hypot(s.avatar.x-p.x,s.avatar.y-p.y,s.avatar.z-p.z));hits+=s.events.filter(e=>e.type==='hit'&&e.kind==='homing').length;launches+=s.events.filter(e=>e.type==='homing').length;}
  v.draw=draw;e.updateHUD=hud;for(let i=0;i<30;i++)v.draw(s,1/60);e.updateHUD();e.hud.hidden=false;
  window.homingEvidence={initial,phase,hits,launches,maxStep};
  return {...homingEvidence,mode:s.wyvern.mode,ball:v.jumpBall.group.visible,rig:v.sonic.userData.model.visible,color:v.jumpBall.core.material.color.getHexString(),camera:v.camera.position.toArray(),energyNodes:e.hud.querySelectorAll('#titan-energy,#titan-boost,.titan-energy-track').length};
 });
 expect(homing.initial.z).toBeGreaterThan(590);expect(homing.phase).toBe('windup');expect(homing.mode).toBe('open');expect(homing.ball).toBe(true);expect(homing.rig).toBe(false);expect(homing.color).toBe('ffd331');expect(homing.camera.every(Number.isFinite)).toBe(true);expect(homing.energyNodes).toBe(0);expect(homing.maxStep).toBeLessThan(25);
 await page.screenshot({path:out+'/wyvern-parry-homing.png'});
 const hit=await page.evaluate(()=>{const g=dcsmcraft,e=g.giganto,s=e.session,v=e.view;const draw=v.draw,hud=e.updateHUD;v.draw=()=>{};e.updateHUD=()=>{};const hp=s.hp,accepted=e.input('hit');let followups=0;for(let i=0;i<180;i++){g.running=true;e.frame(1/60);g.running=false;homingEvidence.hits+=s.events.filter(e=>e.type==='hit'&&e.kind==='homing').length;homingEvidence.launches+=s.events.filter(e=>e.type==='homing').length;followups+=s.events.filter(e=>e.type==='hit'&&e.kind!=='homing').length;}v.draw=draw;e.updateHUD=hud;return {accepted,damage:hp-s.hp,followups,...homingEvidence};});
 expect(hit.hits).toBe(1);expect(hit.launches).toBe(1);expect(hit.accepted).toBe(true);expect(hit.followups).toBeGreaterThan(0);expect(hit.damage).toBeGreaterThan(0);expect(ev.errors).toEqual([]);expect(ev.external).toEqual([]);
 writeFileSync(out+'/counter-jump-render.json',JSON.stringify({jump,homing,hit},null,2));
});

test('free traversal retains Sonic heading, dispatches the base moveset, climbs the enlarged tower and respects stone underpasses',async({page})=>{
 const ev=await boot(page);
 const movement=await page.evaluate(()=>{
  const g=dcsmcraft,e=g.giganto,s=e.session,v=e.view;
  Object.assign(s,{stage:'traversal',emerald:false,strike:null,qte:null,action:'idle',actionTime:0});Object.assign(s.wyvern,{section:'tower',yaw:0,tower:0});
  Object.assign(s.avatar,{x:0,y:0.05,z:150,yaw:0,pitch:0,onGround:true,vx:0,vy:0,vz:0});Object.assign(s.config,{drain:0,audio:false,music:false,graphicsQuality:'low',postProcessing:false,shadowQuality:'off'});
  const draw=v.draw,hud=e.updateHUD;v.draw=()=>{};e.updateHUD=()=>{};
  const step=(keys,n)=>{e.controls=new Set(keys);for(let i=0;i<n;i++){g.running=true;e.frame(1/60);g.running=false;}};
  step(['KeyD'],25);const heading=s.avatar.facingYaw;step([],100);const stopped=s.avatar.facingYaw;
  s.avatar.yaw+=0.7;step([],1);const looked=s.avatar.facingYaw;
  const actions={};actions.jump=e.input('jump');step([],10);actions.double=e.input('jump');actions.homing=e.input('homing');actions.stomp=e.input('stomp');step([],120);actions.slide=e.input('shot');step([],50);actions.roll=e.input('spin');actions.attack=e.input('hit');
  // Boost directly up the playable wall, without a cinematic position assignment.
  Object.assign(s.avatar,{x:-263,y:0.05,z:180,yaw:Math.PI/2,vx:0,vy:0,vz:0,onGround:true});s.traversalKit=null;step(['KeyW','ShiftLeft'],90);const wallHeight=s.avatar.y;
  v.draw=draw;e.updateHUD=hud;e.controls.clear();v.lastDrawn=false;for(let i=0;i<8;i++)v.draw(s,0.15);e.updateHUD();e.hud.hidden=false;
  return {heading,stopped,looked,actions,wallHeight,hp:s.hp,maxHp:s.maxHp,bodyScale:v.sonic.scale.toArray(),bounds:v.tower.children[0].geometry.parameters,archesAnchored:v.passages.parent===v.scene};
 });
 expect(Math.abs(movement.heading-movement.stopped)).toBeLessThan(1e-7);expect(movement.looked-movement.stopped).toBeCloseTo(0.7);expect(Object.values(movement.actions).every(Boolean)).toBe(true);expect(movement.wallHeight).toBeGreaterThan(35);expect(movement.bounds.height).toBe(200);expect(movement.archesAnchored).toBe(true);expect(movement.hp).toBe(movement.maxHp);expect(new Set(movement.bodyScale).size).toBe(1);
 await page.screenshot({path:out+'/tower-free-traversal.png'});
 const tunnel=await page.evaluate(async(distance)=>{
  const g=dcsmcraft,e=g.giganto,s=e.session,v=e.view;
  // The first roof is rendered from the same world-space box used by physics.
  const a=v.passages.instanceMatrix.array,roof={x:a[2*16+12],y:a[2*16+13]-28,z:a[2*16+14]};
  Object.assign(s,{stage:'combat',emerald:true,strike:null,qte:null,action:'idle',actionTime:0});Object.assign(s.wyvern,{yaw:Math.PI,flightTime:6,open:0,mode:'missiles',timer:100,missiles:[],lasers:[]});
  const draw=v.draw,hud=e.updateHUD;v.draw=()=>{};e.updateHUD=()=>{};
  const best={d:0,route:distance};s.wyvern.routeDistance=distance;
  Object.assign(s.avatar,{x:100,y:190,z:0,vx:0,vy:0,vz:0,onGround:false});v.draw=draw;v.draw(s,0);const frameY=v.flightRoot.position.y;v.draw=()=>{};s.avatar.y=roof.y-frameY-10;
  e.controls=new Set(['Space']);for(let i=0;i<30;i++){g.running=true;e.frame(1/60);g.running=false;}
  // Pursuit moves in world space, so inspect the actual rendered world position.
  v.draw=draw;e.updateHUD=hud;e.controls.clear();v.lastDrawn=false;v.draw(s,0.1);e.updateHUD();e.hud.hidden=false;
  const world=v.sonic.getWorldPosition(v.sonic.position.clone());return {roof,world:world.toArray(),best,finite:v.camera.position.toArray().every(Number.isFinite)};
 },wyvernPassages().arches[0].distance);
 expect(tunnel.finite).toBe(true);expect(tunnel.best.d).toBeLessThan(25);expect(tunnel.world[1]+3.5).toBeLessThanOrEqual(tunnel.roof.y+0.03);
 await page.screenshot({path:out+'/wyvern-stone-passage.png'});
 expect(ev.errors).toEqual([]);expect(ev.external).toEqual([]);writeFileSync(out+'/freedom-render.json',JSON.stringify({movement,tunnel},null,2));
});

test('boosted controller jumps stay curled and fast tower and trail contacts remain solid',async({page})=>{
 const ev=await boot(page);
 const result=await page.evaluate(()=>{
  const g=dcsmcraft,e=g.giganto,s=e.session,v=e.view,c=g.controller;
  window.footingPad={id:'Xbox Wireless Controller',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:18},()=>({value:0,pressed:false}))};Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>[footingPad]});
  g.settings.controller={...g.settings.controller,moveCurve:'precise',deadzone:0.12,lookDeadzone:0.22,lookSmoothing:0.05};
  Object.assign(s,{stage:'traversal',emerald:false,action:'idle',actionTime:0,qte:null,strike:null});Object.assign(s.wyvern,{section:'tower',tower:0,yaw:0});Object.assign(s.config,{drain:0,audio:false,music:false,graphicsQuality:'low',postProcessing:false,shadowQuality:'off'});Object.assign(s.avatar,{x:0,y:0.05,z:150,vx:0,vy:0,vz:0,yaw:0,pitch:0,onGround:true});
  const draw=v.draw,hud=e.updateHUD;v.draw=()=>{};e.updateHUD=()=>{};e.controls.clear();const step=n=>{for(let i=0;i<n;i++){g.running=true;e.frame(1/60);g.running=false;}};
  c.frame(1/60);footingPad.axes[0]=0.4;footingPad.buttons[7]={value:1,pressed:true};c.frame(1/60);step(30);const partial=Math.abs(s.avatar.vx);
  footingPad.axes[0]=1;c.frame(1/60);step(30);const full=Math.abs(s.avatar.vx);
  footingPad.buttons[0]={value:1,pressed:true};c.frame(1/60);step(18);v.draw=draw;for(let i=0;i<12;i++)v.draw(s,1/60);v.lastDrawn=false;v.draw(s,0);const jump={boosting:s.boosting,ball:v.jumpBall.group.visible,model:v.sonic.userData.model.visible,clip:v.sonic.userData.currentClip,y:s.avatar.y};
  footingPad.buttons[0]={value:0,pressed:false};footingPad.buttons[7]={value:0,pressed:false};footingPad.axes[0]=0;c.frame(1/60);e.updateHUD=hud;e.updateHUD();e.hud.hidden=false;
  return {partial,full,jump};
 });
 expect(result.partial).toBeGreaterThan(0);expect(result.full).toBeGreaterThan(result.partial*2);expect(result.jump.boosting).toBe(true);expect(result.jump.ball).toBe(true);expect(result.jump.model).toBe(false);expect(result.jump.y).toBeGreaterThan(1);
 await page.screenshot({path:out+'/boosted-controller-jump.png'});
 const floors=await page.evaluate((points)=>{
  const g=dcsmcraft,e=g.giganto,s=e.session,v=e.view;
  const draw=v.draw,hud=e.updateHUD;v.draw=()=>{};e.updateHUD=()=>{};g.controller.clear();e.controls.clear();const results=[];
  for(const q of points){Object.assign(s,{stage:'traversal',emerald:false,jumpAge:99,action:'idle',actionTime:0});s.traversalKit=null;s.wyvern.section='tower';Object.assign(s.avatar,{x:q.x,y:q.y+12,z:q.z,vx:0,vy:-200,vz:0,onGround:false});for(let i=0;i<20&&!s.avatar.onGround;i++){g.running=true;e.frame(1/60);g.running=false;}results.push({kind:q.kind,y:s.avatar.y,expected:q.y,ground:s.avatar.onGround,section:s.wyvern.section});}
  v.draw=draw;e.updateHUD=hud;return results;
 },wyvernPlatforms().triangles.filter(t=>t.depth===0.28&&((t.kind==='tower'&&t.a.t===180)||(t.kind==='road'&&t.a.t===700))).slice(0,4).map(t=>({x:(t.a.x+t.b.x+t.c.x)/3,y:(t.a.y+t.b.y+t.c.y)/3,z:(t.a.z+t.b.z+t.c.z)/3,kind:t.kind})));
 expect(floors.length).toBeGreaterThanOrEqual(2);for(const f of floors){expect(f.ground).toBe(true);expect(f.y).toBeCloseTo(f.expected+0.05,2);}expect(ev.errors).toEqual([]);expect(ev.external).toEqual([]);writeFileSync(out+'/footing-controller-results.json',JSON.stringify({result,floors},null,2));
});
