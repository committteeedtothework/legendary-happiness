import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import { B, SPAWN_EGG_TYPES, makeStack } from "../../src/data.js";
import { World } from "../../src/world.js";
import { mineshaftSite } from "../../src/cave-update.js";
const html = readFileSync("dist/DCSMCRAFT-Standalone.html", "utf8");
const site = mineshaftSite(new World("Wildflower"), 0, 0);
mkdirSync("/workspace/artifacts/cave-update-playtest", { recursive: true });
async function create(page, mode = "creative") {
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
        renderDistance: 2,
        graphics: 1,
        volume: 0.1,
        ambientVolume: 0.3,
        mobVolume: 0.3,
        musicEnabled: false,
      }),
    ),
  );
  await page.route("**/*", (r) =>
    r.request().url().endsWith("/caves.html")
      ? r.fulfill({ contentType: "text/html", body: html })
      : r.abort(),
  );
  await page.goto("/caves.html");
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.locator("[data-action=create]").first().click();
  await expect(page.locator(".form-note")).toContainText("Cave Update");
  await page.locator("[name=seed]").fill("Wildflower");
  await page.locator(`[name=mode][value=${mode}]`).check();
  await page.locator("[data-action=start-world]").click();
  await page.waitForFunction(() => dcsmcraft.running);
  await page.evaluate(() => dcsmcraft.pause());
  return errors;
}
async function render(page, path) {
  await page.waitForFunction(() => dcsmcraft.renderer.meshes.size >= 9);
  await page.waitForTimeout(500);
  await page.screenshot({
    path: "/workspace/artifacts/cave-update-playtest/" + path,
  });
  expect(
    await page.evaluate(() => dcsmcraft.renderer.gl.getContext().getError()),
  ).toBe(0);
}
test("offline Creative catalog provides real passive/hostile eggs; actual use spawns supported creatures and Survival refuses eggs", async ({
  page,
}) => {
  const errors = await create(page);
  await page.evaluate(() => {
    dcsmcraft.openInventory("personal");
  });
  await page.locator("#creative-search").fill("spawn egg");
  await expect(page.locator(".creative-slot:visible")).toHaveCount(
    SPAWN_EGG_TYPES.length,
  );
  await page.locator("#creative-search").fill("cow spawn egg");
  await page.keyboard.down("Shift");
  await page.locator(".creative-slot:visible").click();
  await page.keyboard.up("Shift");
  expect(
    await page.evaluate(() =>
      dcsmcraft.inventory.slots.some((s) => s?.id === "cow_spawn_egg"),
    ),
  ).toBe(true);
  await page.evaluate((B) => {
    const g = dcsmcraft;
    g.closeInventory();
    g.pause();
    g.entities = [];
    for (let x = -12; x <= 12; x++)
      for (let z = -12; z <= 12; z++) {
        g.world.set(x, 199, z, B.stone);
        for (let y = 200; y < 205; y++) g.world.set(x, y, z, B.air);
      }
    Object.assign(g.player, {
      x: 0.5,
      y: 200,
      z: 3.5,
      yaw: 0,
      pitch: 0.65,
      health: 20,
      flying: false,
      vx: 0,
      vy: 0,
      vz: 0,
    });
    g.renderer.loadAround(0.5, 3.5, 2, 9);
    g.ui.play();
    g.running = false;
  }, B);
  for (const [type, x] of [
    ["cow", -2],
    ["zombie", 2],
    ["watcher", 0],
    ["villager", 4],
  ]) {
    const spawned = await page.evaluate(
      ({ type, x, B }) => {
        const g = dcsmcraft;
        g.inventory.slots[0] = { id: type + "_spawn_egg", count: 64 };
        g.inventory.selected = 0;
        g.target = {
          x,
          y: 199,
          z: 0,
          id: B.stone,
          normal: { x: 0, y: 1, z: 0 },
        };
        g.lastPlace = -100;
        g.use();
        const e = g.entities.find((e) => e.type === type);
        return {
          type: e?.type,
          count: g.inventory.held.count,
          profession: e?.profession,
        };
      },
      { type, x, B },
    );
    expect(spawned.type).toBe(type);
    expect(spawned.count).toBe(64);
    if (type === "villager") expect(spawned.profession).toBe("farmer");
  }
  await render(page, "creative-eggs.png");
  expect(
    await page.evaluate((B) => {
      const g = dcsmcraft;
      const n = g.entities.length;
      g.mode = "survival";
      g.inventory.slots[0] = { id: "pig_spawn_egg", count: 64 };
      g.target = {
        x: 1,
        y: 199,
        z: 2,
        id: B.stone,
        normal: { x: 0, y: 1, z: 0 },
      };
      g.lastPlace = -100;
      g.use();
      return g.entities.length === n;
    }, B),
  ).toBe(true);
  expect(errors).toEqual([]);
});
test("offline natural abandoned mineshaft renders, chest loot transfers and remains empty after persistent reload", async ({
  page,
}) => {
  const errors = await create(page);
  const initial = await page.evaluate(
    ({ site, B }) => {
      const g = dcsmcraft;
      g.entities = [];
      g.world.ensure(Math.floor(site.x / 16), Math.floor(site.z / 16));
      Object.assign(g.player, {
        x: site.x + 8.5,
        y: site.y,
        z: site.z + 0.5,
        yaw: -Math.PI / 2,
        pitch: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        health: 20,
        flying: false,
        fallStart: site.y,
      });
      g.renderer.loadAround(g.player.x, g.player.z, 2, 9);
      g.ui.play();
      g.running = false;
      const key = `${site.x + 12},${site.y},${site.z + 1}`;
      return {
        version: g.world.generationVersion,
        id: g.world.get(site.x + 12, site.y, site.z + 1),
        loot: g.world.containers[key]?.slots.filter(Boolean),
        key,
      };
    },
    { site, B },
  );
  expect(initial.version).toBe(12);
  expect(initial.id).toBe(B.chest);
  expect(initial.loot.length).toBeGreaterThan(3);
  await render(page, "natural-mineshaft.png");
  await page.evaluate(
    ({ site, B }) => {
      const g = dcsmcraft;
      g.target = {
        x: site.x + 12,
        y: site.y,
        z: site.z + 1,
        id: B.chest,
        normal: { x: -1, y: 0, z: 0 },
      };
      g.lastPlace = -100;
      g.use();
    },
    { site, B },
  );
  await expect(page.locator(".inventory-title h2")).toHaveText("Chest");
  const filled = page.locator("[data-ref=container] .item-icon");
  const count = await page.locator("[data-ref=container]").count();
  expect(count).toBe(27);
  for (let i = 0; i < 27; i++)
    await page
      .locator(`[data-ref=container][data-index="${i}"]`)
      .click({ modifiers: ["Shift"] });
  expect(
    await page.evaluate(() => dcsmcraft.ui.container.slots.every((s) => !s)),
  ).toBe(true);
  const id = await page.evaluate(async () => {
    const g = dcsmcraft;
    g.closeInventory();
    g.pause();
    await g.save();
    return g.id;
  });
  await page.reload();
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.evaluate((id) => dcsmcraft.loadWorld(id), id);
  await page.waitForFunction(() => dcsmcraft.active);
  await page.evaluate(() => dcsmcraft.pause());
  expect(
    await page.evaluate(
      (key) => ({
        empty: dcsmcraft.world.containers[key].slots.every((s) => !s),
        bread: dcsmcraft.inventory.slots
          .filter((s) => s?.id === "bread")
          .reduce((n, s) => n + s.count, 0),
      }),
      initial.key,
    ),
  ).toEqual({ empty: true, bread: 3 });
  expect(errors).toEqual([]);
});
test("daylight cave spawning, rare natural Watcher laughter and invulnerability, and cave/night WebAudio run in the offline build", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors = await create(page, "survival");
  await page.evaluate((B) => {
    const g = dcsmcraft;
    g.entities = [];
    g.drops = [];
    g.difficulty = "normal";
    for (let x = -38; x <= 38; x++)
      for (let z = -38; z <= 38; z++) {
        g.world.set(x, -1, z, B.stone);
        g.world.set(x, 6, z, B.stone);
        for (let y = 0; y < 6; y++) g.world.set(x, y, z, B.air);
      }
    Object.assign(g.player, {
      x: 0.5,
      y: 0,
      z: 0.5,
      yaw: 0,
      pitch: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      health: 20,
      flying: false,
      fallStart: 0,
    });
    g.time = 6000;
    g.tickCount = 99;
    g.renderer.loadAround(0.5, 0.5, 2, 25);
    g.ui.play();
    g.running = true;
    g.pointerLockFallback = true;
    g.watcherLaughs = 0;
    const voice = g.audio.voice.bind(g.audio);
    g.audio.voice = (game, e, kind) => {
      if (e.type === "watcher" && kind === "laugh") g.watcherLaughs++;
      return voice(game, e, kind);
    };
  }, B);
  await page.waitForFunction(() => dcsmcraft.entities.some((e) => e.caveSpawn));
  expect(
    await page.evaluate(() => ({
      day: dcsmcraft.time < 12000,
      underground: dcsmcraft.player.y < 1,
      cave: dcsmcraft.entities.filter((e) => e.caveSpawn).length,
    })),
  ).toMatchObject({ day: true, underground: true });
  // Accelerate the saved rarity timer, while the actual simulation chooses chance and valid spawn positions.
  for (let i = 0; i < 80; i++) {
    if (
      await page.evaluate(() =>
        dcsmcraft.entities.some((e) => e.type === "watcher" && e.hp > 0),
      )
    )
      break;
    await page.evaluate(() => {
      const g = dcsmcraft;
      g.entities = g.entities.filter((e) => e.type === "watcher");
      g.world.settlements["cave-watcher"] ??= { checks: 0, nextCheck: 0 };
      g.world.settlements["cave-watcher"].nextCheck = g.tickCount;
    });
    await page.waitForTimeout(70);
  }
  await page.waitForFunction(() =>
    dcsmcraft.entities.some((e) => e.type === "watcher" && e.hp > 0),
  );
  await page.evaluate(() => {
    const g = dcsmcraft,
      e = g.entities.find((e) => e.type === "watcher" && e.hp > 0);
    g.entities = [e];
    const dx = e.x - g.player.x,
      dz = e.z - g.player.z;
    g.player.yaw = Math.atan2(-dx, -dz);
    g.player.pitch = -Math.atan2(
      e.y + 2.4 - g.player.y - 1.62,
      Math.hypot(dx, dz),
    );
  });
  await page.waitForFunction(() => dcsmcraft.watcherLaughs === 1);
  await page.evaluate(() => {
    dcsmcraft.pause();
    dcsmcraft.ui.play();
  });
  await render(page, "watcher-staring.png");
  const hits = await page.evaluate((stack) => {
    const g = dcsmcraft,
      e = g.entities.find((e) => e.type === "watcher");
    Object.assign(g.player, {
      x: e.x,
      y: e.y,
      z: e.z + 2.5,
      yaw: 0,
      pitch: -0.25,
    });
    g.target = null;
    g.inventory.selected = 0;
    g.inventory.slots[0] = stack;
    g.lastAttack = g.elapsed - 2;
    if (g.targetEntity()?.id !== e.id || !g.tryAttack())
      throw Error("Watcher melee target missed");
    g.inventory.slots[0] = { id: "matthew_dual_pistols", count: 1 };
    g.player.matthewShotTick = 0;
    g.lastAttack = -100;
    if (!g.firePistols()) throw Error("Pistol did not fire");
    const trace = g.pistolTraces.at(-1);
    if (!trace || Math.hypot(trace.to.x - e.x, trace.to.z - e.z) > 1)
      throw Error("Bullet did not intersect Watcher");
    return { hp: e.hp, playerHealth: g.player.health, laughs: g.watcherLaughs };
  }, makeStack("hellfire_sword"));
  expect(hits.hp).toBe(1000);
  expect(hits.playerHealth).toBe(20);
  expect(hits.laughs).toBe(1);
  const audio = await page.evaluate(() => {
    const g = dcsmcraft;
    g.running = true;
    g.audio.unlock();
    g.audio.nextAmbienceMix = -100;
    g.audio.ambient(g);
    const cave = { ...g.audio.soundscape.targets };
    g.player.y = g.world.terrain(g.player.x, g.player.z).h + 3;
    g.time = 18000;
    g.audio.nextAmbienceMix = -100;
    g.audio.ambient(g);
    return {
      cave,
      night: g.audio.soundscape.targets,
      context: g.audio.context.state,
    };
  });
  expect(audio.cave.cave).toBeGreaterThan(0);
  expect(audio.night.eerie).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
