import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { B } from "../../src/data.js";
let html;
test.beforeAll(() => {
  execFileSync(process.execPath, [
    "scripts/build-standalone.mjs",
    "/tmp/dcsmcraft-progression-tested.html",
  ]);
  html = readFileSync("/tmp/dcsmcraft-progression-tested.html", "utf8");
});
async function create(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && /Shader Error|WebGLProgram/.test(m.text()))
      errors.push(m.text());
  });
  await page.addInitScript(() => {
    if (!localStorage.getItem("dcsmcraft-settings"))
      localStorage.setItem(
        "dcsmcraft-settings",
        JSON.stringify({ renderDistance: 2, graphics: 1 }),
      );
  });
  await page.route("**/*", (r) =>
    r.request().url().endsWith("/progression.html")
      ? r.fulfill({ contentType: "text/html", body: html })
      : r.abort(),
  );
  await page.goto("/progression.html");
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
async function load(page) {
  await page.reload();
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.locator("[data-action=load]").first().click();
  await page.waitForFunction(() => dcsmcraft.running);
  await page.evaluate(() => dcsmcraft.pause());
}
test("independent AO, real sun shadows, clouds and sound controls survive reload", async ({
  page,
}) => {
  const errors = await create(page);
  await page.evaluate(() => dcsmcraft.ui.settings());
  await page.locator("[data-setting=ambientVolume]").fill("0.35");
  await page.locator("[data-setting=mobVolume]").fill("0.45");
  for (const k of ["ambientSounds", "mobSounds"])
    await page.locator(`[data-audio=${k}]`).click();
  await page.locator("[data-action=video-settings]").click();
  await page.locator("[data-graphics=fancyGraphics]").click();
  await page.locator("[data-graphics=ambientOcclusion]").click();
  await expect(
    page.locator("[data-graphics=ambientOcclusion]"),
  ).toHaveAttribute("aria-pressed", "false");
  await page.locator("[data-graphics=ambientOcclusion]").click();
  await page.locator("[data-graphics=shadows]").click();
  await expect(page.locator("[data-graphics=shadows]")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.locator("[data-setting=graphics]").fill("1");
  await page.locator("[data-graphics=clouds]").click();
  await page.locator("[data-graphics=clouds]").click();
  await page.screenshot({
    path: "/workspace/artifacts/DCSMCRAFT-v1.0.0-graphics.png",
  });
  await page.evaluate(async () => {
    const g = dcsmcraft;
    g.ui.play();
    await new Promise((r) => setTimeout(r, 750));
    await g.save();
  });
  const result = await page.evaluate(() => {
    const g = dcsmcraft,
      r = g.renderer;
    return {
      fancy: g.settings.fancyGraphics,
      ao: r.appliedAO,
      shadows: r.gl.shadowMap.enabled,
      cast: r.sun.castShadow,
      map: !!r.sun.shadow.map,
      clouds: r.clouds.visible,
      ambient: g.settings.ambientSounds,
      voices: g.settings.mobSounds,
    };
  });
  await page.screenshot({
    path: "/workspace/artifacts/DCSMCRAFT-v1.0.0-shadows.png",
  });
  expect(result).toEqual({
    fancy: false,
    ao: true,
    shadows: true,
    cast: true,
    map: true,
    clouds: true,
    ambient: false,
    voices: false,
  });
  await load(page);
  expect(
    await page.evaluate(() => [
      dcsmcraft.settings.ambientVolume,
      dcsmcraft.settings.mobVolume,
      dcsmcraft.settings.shadows,
      dcsmcraft.settings.ambientOcclusion,
    ]),
  ).toEqual([0.35, 0.45, true, true]);
  expect(errors).toEqual([]);
});
test("armor slots, damage reduction and actual enchanting-table UI preserve equipment metadata", async ({
  page,
}) => {
  const errors = await create(page);
  await page.evaluate(() => {
    const g = dcsmcraft;
    g.mode = "survival";
    g.entities = [];
    g.inventory.slots = Array(36).fill(null);
    ["helmet", "chestplate", "leggings", "boots"].forEach(
      (s, i) =>
        (g.inventory.slots[i] = { id: `iron_${s}`, count: 1, durability: 200 }),
    );
    g.inventory.slots[4] = { id: "iron_spear", count: 1, durability: 250 };
    g.inventory.slots[5] = { id: "lapis_lazuli", count: 12 };
    g.player.xp = 50;
    g.openInventory("personal");
  });
  for (let i = 0; i < 4; i++)
    await page
      .locator(`[data-ref=inventory][data-index="${i}"]`)
      .click({ modifiers: ["Shift"] });
  await expect(page.locator("#equipment-points")).toHaveText("15 armor points");
  await page.screenshot({
    path: "/workspace/artifacts/DCSMCRAFT-v1.0.0-equipment.png",
  });
  const damage = await page.evaluate((B) => {
    const g = dcsmcraft;
    g.player.health = 20;
    g.player.hurt = 0;
    g.damage(10, "melee");
    g.closeCraft();
    g.ui.play();
    g.world.set(8, 200, 6, B.enchanting_table);
    g.target = { x: 8, y: 200, z: 6, id: B.enchanting_table };
    g.lastPlace = -10;
    g.use();
    return 20 - g.player.health;
  }, B);
  expect(damage).toBeCloseTo(6);
  await expect(
    page.getByRole("heading", { name: "Enchant Equipment" }),
  ).toBeVisible();
  await page.locator('[data-action=enchant-select][data-index="4"]').click();
  await expect(page.locator("[data-enchantment=protection]")).toBeDisabled();
  await page.locator("[data-enchantment=sharpness]").click();
  await page.locator("[data-enchantment=unbreaking]").click();
  await expect(page.locator(".enchant-selected img")).toHaveClass(
    "enchanted-item",
  );
  await page.screenshot({
    path: "/workspace/artifacts/DCSMCRAFT-v1.0.0-enchanting.png",
  });
  await page.locator("[data-action=close-inv]").last().click();
  const saved = await page.evaluate(async () => {
    const g = dcsmcraft;
    g.pause();
    await g.save();
    return {
      xp: g.player.xp,
      lapis: g.inventory.slots[5].count,
      enchants: g.inventory.slots[4].enchantments,
      armor: g.inventory.equipment,
    };
  });
  expect(saved.xp).toBe(40);
  expect(saved.lapis).toBe(10);
  expect(saved.enchants).toEqual({ sharpness: 1, unbreaking: 1 });
  await load(page);
  expect(await page.evaluate(() => dcsmcraft.inventory.equipment)).toEqual(
    saved.armor,
  );
  expect(
    await page.evaluate(() => dcsmcraft.inventory.slots[4].enchantments),
  ).toEqual(saved.enchants);
  expect(errors).toEqual([]);
});
test("planted Devin Sword requires a real uninterrupted 30-second hold and is claimed once across reload", async ({
  page,
}) => {
  const errors = await create(page);
  const site = await page.evaluate(() => {
    dcsmcraft.openJournal();
    return dcsmcraft.world.relicPlan;
  });
  expect(site).toBeTruthy();
  await expect(page.locator(".relic-coordinates")).toContainText(`X ${site.x}`);
  await page.evaluate((p) => {
    const g = dcsmcraft;
    g.entities = [];
    g.mode = "survival";
    g.difficulty = "peaceful";
    g.inventory.slots = Array(36).fill(null);
    Object.assign(g.player, {
      x: p.x + 0.5,
      y: p.y,
      z: p.z + 2.8,
      yaw: 0,
      pitch: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      health: 20,
      food: 20,
      hurt: 0,
      flying: false,
      onGround: true,
    });
    g.ui.play();
    g.running = true;
    g.pointerLockFallback = true;
  }, site);
  await page.waitForFunction(
    (B) => dcsmcraft.target?.id === B.devin_relic_blade,
    B,
  );
  await page.screenshot({
    path: "/workspace/artifacts/DCSMCRAFT-v1.0.0-planted-sword.png",
  });
  const mouse = async (type) =>
    page.evaluate(
      (type) =>
        dcsmcraft.renderer.gl.domElement.dispatchEvent(
          new MouseEvent(type, { button: 0, bubbles: true }),
        ),
      type,
    );
  await mouse("mousedown");
  await page.waitForFunction(() => dcsmcraft.extraction?.progress > 0.025);
  await mouse("mouseup");
  expect(await page.evaluate(() => dcsmcraft.extraction)).toBeNull();
  const start = Date.now();
  await mouse("mousedown");
  await page.waitForFunction(
    () => dcsmcraft.inventory.slots.some((s) => s?.id === "devin_sword"),
    null,
    { timeout: 45000, polling: 250 },
  );
  expect(Date.now() - start).toBeGreaterThanOrEqual(30000);
  await mouse("mouseup");
  const claim = await page.evaluate(async (p) => {
    const g = dcsmcraft;
    g.pause();
    await g.save();
    return {
      claimed: g.world.relicClaimed,
      base: g.world.get(p.x, p.y, p.z),
      blade: g.world.get(p.x, p.y + 1, p.z),
      swords: g.inventory.slots.filter((s) => s?.id === "devin_sword"),
    };
  }, site);
  expect(claim.claimed).toBe(true);
  expect(claim.base).toBe(B.air);
  expect(claim.blade).toBe(B.air);
  expect(claim.swords).toHaveLength(1);
  expect(claim.swords[0].origin).toBeTruthy();
  await load(page);
  expect(
    await page.evaluate(
      (p) => ({
        claimed: dcsmcraft.world.relicClaimed,
        base: dcsmcraft.world.get(p.x, p.y, p.z),
        swords: dcsmcraft.inventory.slots.filter(
          (s) => s?.id === "devin_sword",
        ),
      }),
      site,
    ),
  ).toEqual({ claimed: true, base: B.air, swords: claim.swords });
  await page.evaluate(() => {
    dcsmcraft.ui.play();
    dcsmcraft.renderer.animator.equip = 0;
  });
  await page.waitForTimeout(600);
  await page.screenshot({
    path: "/workspace/artifacts/DCSMCRAFT-v1.0.0-devin-sword.png",
  });
  expect(errors).toEqual([]);
});
test("spear clicks reach beyond swords and Devin pulse spares animals and respects its saved cooldown", async ({
  page,
}) => {
  const errors = await create(page);
  await page.evaluate((B) => {
    const g = dcsmcraft;
    g.entities = [];
    g.difficulty = "peaceful";
    for (let x = 5; x <= 11; x++)
      for (let z = 1; z <= 10; z++) g.world.set(x, 199, z, B.stone);
    Object.assign(g.player, {
      x: 8.5,
      y: 200,
      z: 8.5,
      yaw: 0,
      pitch: 0,
      flying: true,
      onGround: true,
      health: 10,
    });
    g.inventory.slots[0] = { id: "iron_spear", count: 1, durability: 250 };
    g.inventory.selected = 0;
    g.entities = [
      {
        id: "target",
        type: "shade",
        x: 8.5,
        y: 200,
        z: 4.7,
        hp: 40,
        speed: 0,
        age: 0,
        turn: 100,
        dir: 0,
        onGround: true,
      },
    ];
    g.target = null;
    g.lastAttack = -10;
    g.renderer.gl.domElement.dispatchEvent(
      new MouseEvent("mousedown", { button: 0, bubbles: true }),
    );
    window.dispatchEvent(new MouseEvent("mouseup"));
  }, B);
  expect(await page.evaluate(() => dcsmcraft.entities[0].hp)).toBe(33);
  const pulse = await page.evaluate(() => {
    const g = dcsmcraft;
    g.inventory.slots[0] = { id: "devin_sword", count: 1 };
    g.lastPlace = -10;
    g.target = null;
    g.entities[0].x = 8.5;
    g.entities[0].z = 6.5;
    g.entities.push({
      id: "friend",
      type: "cow",
      x: 10,
      y: 200,
      z: 6.5,
      hp: 20,
      speed: 0,
    });
    g.renderer.gl.domElement.dispatchEvent(
      new MouseEvent("mousedown", { button: 2, bubbles: true }),
    );
    const hp = g.entities[0].hp;
    g.lastPlace = -10;
    g.use();
    return {
      hp,
      again: g.entities[0].hp,
      friend: g.entities[1].hp,
      cooldown: g.player.devinReadyTick - g.tickCount,
      effect: g.renderer.effects.some((e) => e.pulse),
    };
  });
  expect(pulse.effect).toBe(true);
  expect(pulse.hp).toBe(25);
  expect(pulse.again).toBe(25);
  expect(pulse.friend).toBe(20);
  expect(pulse.cooldown).toBe(200);
  await page.evaluate(() => dcsmcraft.save());
  await load(page);
  expect(
    await page.evaluate(
      () => dcsmcraft.player.devinReadyTick > dcsmcraft.tickCount,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
test("ambient layers and every creature voice produce audio; pause and category mute silence them", async ({
  page,
}) => {
  const errors = await create(page);
  const result = await page.evaluate(async () => {
    const g = dcsmcraft,
      a = g.audio,
      c = a.context;
    g.entities = [];
    g.drops = [];
    g.ui.play();
    g.running = true;
    g.player.flying = true;
    g.player.y = 200;
    g.settings.volume = 1;
    g.settings.ambientVolume = 1;
    g.settings.mobVolume = 1;
    a.updateVolume();
    a.nextBird = Infinity;
    const analyser = c.createAnalyser();
    analyser.fftSize = 2048;
    a.master.connect(analyser);
    const rms = () => {
      const d = new Float32Array(analyser.fftSize);
      analyser.getFloatTimeDomainData(d);
      return Math.sqrt(d.reduce((s, v) => s + v * v, 0) / d.length);
    };
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    await c.resume();
    await wait(1100);
    const ambient = rms();
    g.time = 14000;
    a.nextAmbienceMix = 0;
    a.ambient(g);
    const night = a.soundscape.layers.night.target;
    g.pause();
    await wait(1800);
    const paused = rms();
    const voices = [];
    for (const t of [
      "cow",
      "woolling",
      "grazer",
      "chicken",
      "rabbit",
      "villager",
      "shade",
      "stalker",
      "emberling",
    ]) {
      a.mob(t, 0, "hurt", 0.4);
      await wait(70);
      voices.push({ type: t, rms: rms() });
      await wait(850);
    }
    g.settings.mobSounds = false;
    const before = a.played;
    a.mob("cow");
    const muted = a.played === before;
    g.settings.mobSounds = true;
    g.settings.mobVolume = 0;
    a.mob("shade");
    const volumeMuted = a.played === before;
    g.settings.mobVolume = 1;
    g.settings.volume = 0;
    a.updateVolume();
    a.mob("shade");
    await wait(250);
    const masterMuted = rms();
    analyser.disconnect();
    a.master.disconnect(analyser);
    return { ambient, night, paused, voices, muted, volumeMuted, masterMuted };
  });
  expect(result.ambient).toBeGreaterThan(0.0001);
  expect(result.night).toBeGreaterThan(0);
  expect(result.paused).toBeLessThan(0.00003);
  for (const v of result.voices) expect(v.rms, v.type).toBeGreaterThan(0.0001);
  expect(result.muted).toBe(true);
  expect(result.volumeMuted).toBe(true);
  expect(result.masterMuted).toBeLessThan(0.00003);
  expect(errors).toEqual([]);
});
test("null preferences recover; death drops enchanted armor once and respawn cannot duplicate it", async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem("dcsmcraft-settings"))
      localStorage.setItem("dcsmcraft-settings", "null");
  });
  const errors = await create(page);
  expect(await page.evaluate(() => dcsmcraft.settings.ambientOcclusion)).toBe(
    true,
  );
  const death = await page.evaluate(() => {
    const g = dcsmcraft;
    g.mode = "survival";
    g.entities = [];
    g.drops = [];
    g.inventory.slots = Array(36).fill(null);
    g.inventory.equipment[1] = {
      id: "diamond_chestplate",
      count: 1,
      durability: 400,
      enchantments: { protection: 2 },
    };
    g.player.hurt = 0;
    g.player.health = 1;
    g.damage(1000, "void");
    g.damage(1000, "void");
    return {
      armor: g.inventory.equipment,
      drops: g.drops.filter((d) => d.id === "diamond_chestplate"),
    };
  });
  expect(death.armor.every((s) => !s)).toBe(true);
  expect(death.drops).toHaveLength(1);
  expect(death.drops[0].enchantments).toEqual({ protection: 2 });
  await page.locator("[data-action=respawn]").click();
  await page.evaluate(async () => {
    dcsmcraft.pause();
    await dcsmcraft.save();
  });
  await load(page);
  expect(
    await page.evaluate(() => dcsmcraft.inventory.equipment.every((s) => !s)),
  ).toBe(true);
  expect(errors).toEqual([]);
});
