import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
const out = "/workspace/artifacts/gameplay-polish";
mkdirSync(out, { recursive: true });
async function boot(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (/Shader Error|GL_INVALID|WebGLProgram/.test(m.text()))
      errors.push(m.text());
  });
  await page.addInitScript(() =>
    localStorage.setItem(
      "dcsmcraft-settings",
      JSON.stringify({
        graphics: 1,
        renderDistance: 3,
        volume: 0,
        musicEnabled: false,
        ambientSounds: false,
        frameLimit: 30,
      }),
    ),
  );
  await page.goto("/");
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
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
    g.entities = [];
    g.ui.play();
  });
  await page.waitForFunction(() => !document.pointerLockElement);
  return errors;
}

test("camera changes are quiet, both views share one current-frame swing, block arms stay straight and crit stars render without leaks", async ({
  page,
}) => {
  const errors = await boot(page);
  const initial = await page.locator("#toast").textContent();
  expect(initial).not.toContain("Hold left-click");
  await page.evaluate(() => {
    dcsmcraft.ui.toast("");
    document.querySelector("#toast").classList.remove("show");
    dcsmcraft.cameraMode = 0;
  });
  for (const mode of [1, 2, 0]) {
    await page.keyboard.press("F5");
    expect(await page.evaluate(() => dcsmcraft.cameraMode)).toBe(mode);
    await expect(page.locator("#toast")).not.toHaveClass(/show/);
  }
  const report = await page.evaluate(async () => {
    const g = dcsmcraft,
      { B } = await import("/src/data.js");
    g.ui.screen = "test";
    g.running = false;
    g.inventory.slots[0] = { id: "stone", count: 64 };
    g.inventory.selected = 0;
    g.renderer.setHeld("stone");
    const r = g.renderer;
    for (let x = -5; x < 6; x++)
      for (let z = -5; z < 6; z++) {
        g.world.set(x, 199, z, B.stone);
        for (let y = 200; y < 205; y++) g.world.set(x, y, z, B.air);
      }
    Object.assign(g.player, {
      x: 0.5,
      y: 200,
      z: 0.5,
      yaw: 0,
      pitch: 0,
      onGround: true,
      inWater: false,
      vy: 0,
      health: 20,
      hurt: 0,
      standData: {},
    });
    const rates = [];
    for (const fps of [30, 60, 144]) {
      r.animator = new r.animator.constructor();
      r.action("attack");
      let calls = 0;
      const step = r.animator.step.bind(r.animator);
      r.animator.step = (...args) => {
        calls++;
        return step(...args);
      };
      let t = 50;
      const views = [];
      for (const mode of [0, 1, 2]) {
        r.lastTime = t;
        t += 1 / fps;
        r.draw({
          player: g.player,
          cameraMode: mode,
          game: g,
          playing: true,
          animating: true,
          elapsed: t,
        });
        const action = r.animator.action;
        const p = action.age / action.duration,
          expected =
            1.2 * Math.sin(Math.sqrt(p) * Math.PI) -
            Math.sin(p * Math.PI) * 0.7 * 0.45;
        views.push({
          mode,
          age: action.age,
          arm: mode ? r.playerModel.userData.arms[1].rotation.x : null,
          expected,
          elbows: mode
            ? r.playerModel.userData.forearms.map((a) => a.rotation.x)
            : null,
        });
      }
      rates.push({ fps, calls, views });
    }
    // Pause is a frozen animation/effect frame, including when a crit is visible.
    const before = r.animator.action.age;
    r.draw({
      player: g.player,
      cameraMode: 1,
      game: g,
      playing: true,
      animating: false,
      elapsed: 51,
    });
    return { rates, pausedAge: [before, r.animator.action.age] };
  });
  for (const rate of report.rates) {
    expect(rate.calls).toBe(3);
    for (let i = 0; i < 3; i++) {
      const v = rate.views[i];
      expect(v.age).toBeCloseTo((i + 1) / rate.fps, 8);
      if (v.mode) {
        expect(v.arm).toBeCloseTo(v.expected, 8);
        expect(v.elbows.every((x) => x === 0)).toBe(true);
      }
    }
  }
  expect(report.pausedAge[0]).toBe(report.pausedAge[1]);
  await page.evaluate(async () => {
    const g = dcsmcraft,
      r = g.renderer,
      { createEntity, hitEntity } = await import("/src/simulation.js");
    g.cameraMode = 1;
    g.inventory.slots[0] = { id: "iron_sword", count: 1 };
    r.setHeld("iron_sword");
    const e = createEntity(g, "cow", 1.7, -1.5);
    Object.assign(e, { x: 1.7, y: 200, z: -1.5, hp: 100 });
    g.entities = [e];
    g.player.onGround = false;
    g.player.vy = -1;
    g.lastAttack = -10;
    g.settings.particles = "all";
    r.syncEntities(g.entities, [], g.elapsed, 0);
    hitEntity(g, e);
    r.action("attack");
    r.animator.action.age = 0.08;
    r.draw({
      player: g.player,
      cameraMode: 1,
      game: g,
      playing: true,
      animating: true,
      elapsed: r.lastTime + 1 / 60,
    });
    g.ui.play();
    document.querySelector("#cycle-banner").classList.remove("show");
    document.querySelector("#toast").classList.remove("show");
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: out + "/third-person-critical.png" });
  const effects = await page.evaluate(() => ({
    stars: dcsmcraft.renderer.effects.filter((e) => e.critical).length,
    age: dcsmcraft.renderer.animator.action.age,
  }));
  expect(effects.stars).toBe(16);
  await page.evaluate(() => {
    const g = dcsmcraft,
      r = g.renderer;
    g.ui.screen = "test";
    let t = 100;
    for (let i = 0; i < 12; i++) {
      r.lastTime = t;
      t += 0.05;
      r.draw({
        player: g.player,
        cameraMode: 1,
        game: g,
        playing: true,
        animating: true,
        elapsed: t,
      });
    }
  });
  expect(
    await page.evaluate(
      () => dcsmcraft.renderer.effects.filter((e) => e.critical).length,
    ),
  ).toBe(0);
  writeFileSync(
    out + "/animation-and-effects.json",
    JSON.stringify({ ...report, effects, errors }, null, 2),
  );
  expect(errors).toEqual([]);
});

test("animal sounds play through real Web Audio with baby pitch, silent mute, ended-node cleanup and quiet loot collection", async ({
  page,
}) => {
  const errors = await boot(page);
  const report = await page.evaluate(async () => {
    const g = dcsmcraft,
      { ANIMAL_CALLS } = await import("/src/animal-voices.js"),
      { createEntity, damageEntity, tickSurvival } =
        await import("/src/simulation.js"),
      { B } = await import("/src/data.js");
    Object.assign(g.settings, { volume: 1, mobVolume: 1, mobSounds: true });
    g.audio.unlock();
    await g.audio.context.resume();
    g.audio.silenceAmbient();
    const sampled = [],
      original = g.audio.sample.bind(g.audio);
    g.audio.sample = (...args) => {
      sampled.push({ name: args[0], pitch: args[2] });
      return original(...args);
    };
    const pending = [];
    let generated = 0;
    for (const type of Object.keys(ANIMAL_CALLS)) {
      const start = performance.now();
      const buffers = g.audio.voices[type],
        v = buffers[0];
      generated += v.length;
      const e = {
        type,
        x: g.player.x,
        y: g.player.y,
        z: g.player.z,
        baby: type === "cow",
      };
      g.audio.voice(g, e, "idle");
      pending.push({
        type,
        seconds: v.duration,
        synthesisMs: performance.now() - start,
      });
      await new Promise((r) => setTimeout(r, 85));
    }
    const count = sampled.length;
    g.settings.mobSounds = false;
    g.audio.voice(g, { type: "cow", ...g.player }, "idle");
    const muted = sampled.length === count;
    await new Promise((r) => setTimeout(r, 2000));
    const voicesEnded =
      g.audio.active === 0 && g.audio.positionedVoices.size === 0;
    g.settings.volume = 0;
    g.audio.updateVolume();
    g.ui.toast("");
    document.querySelector("#toast").classList.remove("show");
    const { x, y, z } = g.player;
    g.drops = [
      { id: "stone", count: 64, x, y: y + 0.5, z, age: 0, delay: 0, vy: 0 },
    ];
    g.inventory.slots.fill(null);
    g.tickCount = 1;
    tickSurvival(g);
    const collected = g.inventory.slots
      .filter((s) => s?.id === "stone")
      .reduce((n, s) => n + s.count, 0);
    const e = createEntity(g, "cow", x + 1, z);
    e.y = y;
    damageEntity(g, e, 1000);
    const toast = document.querySelector("#toast").textContent;
    return {
      sampled,
      pending,
      generated,
      muted,
      voicesEnded,
      collected,
      toast,
      errors: [],
    };
  });
  expect(report.sampled.length).toBeGreaterThanOrEqual(20);
  expect(report.sampled.find((s) => s.name === "cow").pitch).toBeGreaterThan(
    1.3,
  );
  expect(report.muted).toBe(true);
  expect(report.voicesEnded).toBe(true);
  expect(report.collected).toBe(64);
  expect(report.toast).toBe("");
  expect(errors).toEqual([]);
  writeFileSync(
    out + "/audio-and-loot.json",
    JSON.stringify({ ...report, errors }, null, 2),
  );
});
