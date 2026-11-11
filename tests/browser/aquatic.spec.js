import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import { B } from "../../src/data.js";
const html = readFileSync("dist/DCSMCRAFT-Standalone.html", "utf8"),
  out = "/workspace/artifacts/aquatic-playtest";
mkdirSync(out, { recursive: true });
async function boot(page) {
  const errors = [],
    external = [];
  page.on("pageerror", (e) => errors.push(e.stack || e.message));
  page.on("console", (m) => {
    if (/Shader Error|GL_INVALID|WebGLProgram/.test(m.text()))
      errors.push(m.text());
  });
  await page.addInitScript(() =>
    localStorage.setItem(
      "dcsmcraft-settings",
      JSON.stringify({
        renderDistance: 2,
        graphics: 1,
        frameLimit: 30,
        distantTerrain: false,
        volume: 0,
      }),
    ),
  );
  await page.route("**/*", (r) =>
    r.request().url().endsWith("/aquatic.html")
      ? r.fulfill({ contentType: "text/html", body: html })
      : (external.push(r.request().url()), r.abort()),
  );
  await page.goto("/aquatic.html");
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.locator("[data-action=create]").click();
  await page.locator("[name=seed]").fill("Aquatic");
  await page.locator("[name=mode][value=creative]").check();
  await page.locator("[data-action=start-world]").click();
  await page.waitForFunction(() => dcsmcraft.running);
  return { errors, external };
}
async function aim(page, x, y, z) {
  await page.mouse.move(640, 400);
  await page.evaluate(
    ({ x, y, z }) => {
      const g = dcsmcraft,
        p = g.player;
      p.yaw = Math.atan2(p.x - x, p.z - z);
      p.pitch = Math.atan2(y - p.y - 1.62, Math.hypot(x - p.x, z - p.z));
      g.pointerLockFallback = true;
    },
    { x, y, z },
  );
  await page.waitForTimeout(120);
}
async function tank(page) {
  await page.evaluate((B) => {
    const g = dcsmcraft;
    g.pause();
    g.entities = [];
    g.drops = [];
    for (let z = -5; z <= 8; z++)
      for (let x = -5; x <= 8; x++) {
        g.world.set(x, 199, z, B.stone);
        for (let y = 200; y <= 205; y++)
          g.world.set(
            x,
            y,
            z,
            x === -5 || z === -5 || x === 8 || z === 8 ? B.glass : B.water,
          );
      }
    Object.assign(g.player, {
      x: 0.5,
      y: 201,
      z: 3.5,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: 0,
      pitch: 0,
      flying: true,
      health: 20,
    });
    g.inventory.slots.fill(null);
    g.renderer.loadAround(0.5, 3.5, 2, 20);
    g.resume();
    g.pointerLockFallback = true;
  }, B);
  await page.waitForTimeout(250);
}
test("offline Aquatic world: new ocean biomes, sea models, creative catalog, journal, swimming, save/reload and no external requests", async ({
  page,
}) => {
  test.setTimeout(120000);
  const r = await boot(page);
  await page.evaluate(() => {
    const g = dcsmcraft;
    g.pause();
    Object.assign(g.player, {
      x: 1600.5,
      y: 65,
      z: 1600.5,
      flying: true,
      vx: 0,
      vy: 0,
      vz: 0,
    });
    g.renderer.loadAround(1600, 1600, 2, 20);
    g.ui.play();
  });
  await page.waitForTimeout(2000);
  expect(
    await page.evaluate(() => dcsmcraft.world.terrain(1600, 1600).biome),
  ).toBe("deep_lukewarm_ocean");
  await page.screenshot({ path: out + "/ocean-coast.png" });
  await tank(page);
  await page.evaluate(() => {
    const g = dcsmcraft;
    g.pause();
    g.entities = [
      "cod",
      "salmon",
      "tropical_fish",
      "pufferfish",
      "squid",
      "dolphin",
      "turtle",
      "drowned",
    ].map((type, i) => ({
      id: "sea-" + i,
      type,
      x: -3 + (i % 4) * 2,
      y: 200.5 + Math.floor(i / 4) * 2,
      z: -1,
      hp: 20,
      yaw: 0,
      age: 0,
      vx: 0,
      vy: 0,
      vz: 0,
    }));
    g.ui.play();
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: out + "/sea-life.png" });
  expect(
    await page.evaluate(() => dcsmcraft.renderer.aquaticVisuals.root.visible),
  ).toBe(true);
  await page.evaluate(() => {
    const g = dcsmcraft;
    g.openInventory("personal");
  });
  await page.locator("#creative-search").fill("trident");
  await expect(
    page.locator(".creative-slot:visible").filter({ has: page.locator("img") }),
  ).toHaveCount(1);
  await page.screenshot({ path: out + "/creative-trident.png" });
  await page.evaluate(() => {
    dcsmcraft.ui.aquaticGuide();
  });
  await expect(page.locator("h2")).toHaveText("Aquatic Voyages");
  await page.screenshot({ path: out + "/ocean-journal.png" });
  await page.evaluate(async () => {
    const g = dcsmcraft;
    g.world.aquatic ||= { growth: {}, projectiles: [], achievements: {} };
    g.world.aquatic.achievements.browser_ocean = 1;
    g.inventory.slots[0] = {
      id: "treasure_map",
      count: 1,
      mapTarget: { x: -71, y: 58, z: 93 },
    };
    await g.save();
    window.oceanWorldId = g.worldId || g.id;
  });
  const info = await page.evaluate(() => ({
    id: dcsmcraft.id,
    gen: dcsmcraft.world.generationVersion,
  }));
  expect(info.gen).toBe(16);
  await page.reload();
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.locator("[data-action=worlds]").click();
  await page.locator("[data-action=load]").first().click();
  await page.waitForFunction(() => dcsmcraft.active);
  expect(
    await page.evaluate(() => dcsmcraft.inventory.slots[0].mapTarget),
  ).toEqual({ x: -71, y: 58, z: 93 });
  expect(
    await page.evaluate(
      () => dcsmcraft.world.aquatic.achievements.browser_ocean,
    ),
  ).toBe(1);
  expect(r.external).toEqual([]);
  expect(r.errors).toEqual([]);
});
test("offline real inputs: charged trident returns, fishing casts/reels and brewing menu accepts only valid ingredients", async ({
  page,
}) => {
  test.setTimeout(120000);
  const r = await boot(page);
  await tank(page);
  await page.evaluate(() => {
    const g = dcsmcraft;
    g.entities = [
      {
        id: "bucket-cod",
        waterGoal: { x: 0.5, y: 202.4, z: 1.2 },
        type: "cod",
        x: 0.5,
        y: 202.4,
        z: 1.2,
        hp: 3,
        yaw: 0,
        age: 0,
        dir: 0,
        turn: 0,
        vx: 0,
        vy: 0,
        vz: 0,
      },
    ];
    g.inventory.slots[0] = { id: "water_bucket", count: 1 };
    g.inventory.selected = 0;
    g.ui.updateHotbar();
  });
  await aim(page, 0.5, 202.55, 1.2);
  await expect
    .poll(() => page.evaluate(() => dcsmcraft.targetEntity()?.type), {
      timeout: 5000,
    })
    .toBe("cod");
  await page.mouse.click(640, 400, { button: "right" });
  await page.waitForFunction(
    () => dcsmcraft.inventory.held?.id === "cod_bucket",
  );
  await aim(page, 0.5, 202.6, -3);
  await page.waitForTimeout(250);
  await page.mouse.click(640, 400, { button: "right" });
  await page.waitForFunction(() => dcsmcraft.inventory.held?.id === "bucket");
  expect(
    await page.evaluate(
      () =>
        dcsmcraft.entities.filter((e) => e.type === "cod" && e.hp > 0).length,
    ),
  ).toBe(1);
  await page.evaluate(() => (dcsmcraft.entities = []));
  await page.evaluate(() => {
    dcsmcraft.inventory.slots[0] = {
      id: "trident",
      count: 1,
      durability: 250,
      enchantments: { loyalty: 3 },
    };
    dcsmcraft.inventory.selected = 0;
    dcsmcraft.ui.updateHotbar();
  });
  await aim(page, 0.5, 202.6, -3);
  await page.mouse.down({ button: "right" });
  await page.waitForTimeout(700);
  expect(await page.evaluate(() => !!dcsmcraft.tridentCharge)).toBe(true);
  await page.mouse.up({ button: "right" });
  await page.waitForFunction(
    () =>
      dcsmcraft.inventory.slots[0]?.id === "trident" &&
      !dcsmcraft.world.aquatic.projectiles.length,
    {},
    { timeout: 15000 },
  );
  expect(
    await page.evaluate(() => dcsmcraft.inventory.slots[0].durability),
  ).toBe(250); // Creative copy keeps the original.
  await page.evaluate(() => {
    dcsmcraft.mode = "survival";
    dcsmcraft.player.flying = false;
    dcsmcraft.player.vy = 0;
    dcsmcraft.inventory.slots[0] = {
      id: "fishing_rod",
      count: 1,
      durability: 64,
    };
    dcsmcraft.inventory.selected = 0;
    dcsmcraft.player.y = 205.9;
  });
  await aim(page, 0.5, 205, -2);
  await page.mouse.click(640, 400, { button: "right" });
  await page.waitForFunction(() => !!dcsmcraft.player.fishing);
  await page.evaluate(() => {
    dcsmcraft.player.fishing.bite = dcsmcraft.tickCount;
  });
  await page.waitForTimeout(250);
  await page.mouse.click(640, 400, { button: "right" });
  await page.waitForFunction(() => !dcsmcraft.player.fishing);
  await page.waitForTimeout(250);
  expect(
    await page.evaluate(() => !!dcsmcraft.world.aquatic.achievements.fishing),
  ).toBe(true);
  await page.evaluate((B) => {
    const g = dcsmcraft;
    g.pause();
    g.mode = "creative";
    g.player.flying = true;
    Object.assign(g.player, { x: 0.5, y: 206, z: 3.5, vx: 0, vy: 0, vz: 0 });
    g.world.set(0, 206, 0, B.brewing_stand);
    g.inventory.slots[0] = null;
    g.resume();
    g.pointerLockFallback = true;
  }, B);
  await aim(page, 0.5, 206.5, 0.5);
  await page.mouse.click(640, 400, { button: "right" });
  await page.waitForFunction(() => dcsmcraft.ui.invType === "brewing_stand");
  await expect(page.locator("[data-ref=container]")).toHaveCount(5);
  const slots = await page
    .locator("[data-ref=container]")
    .evaluateAll((nodes) =>
      nodes.map((n) => {
        const r = n.getBoundingClientRect();
        return { x: r.x, y: r.y, w: r.width, h: r.height };
      }),
    );
  expect(
    slots.every(
      (s) => s.w >= 44 && s.h >= 44 && Math.abs(s.y - slots[0].y) < 1,
    ),
  ).toBe(true);
  expect(slots[4].x - slots[0].x).toBeGreaterThan(200);

  await page.evaluate(() => {
    const g = dcsmcraft;
    g.inventory.cursor = { id: "diamond", count: 1 };
    g.ui.refreshInventory();
  });
  await page.locator('[data-ref=container][data-index="0"]').click();
  expect(await page.evaluate(() => dcsmcraft.ui.container.slots[0])).toBeNull();
  await page.screenshot({ path: out + "/brewing.png" });
  expect(r.external).toEqual([]);
  expect(r.errors).toEqual([]);
});
