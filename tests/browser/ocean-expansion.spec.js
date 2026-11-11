import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import { World } from "../../src/world.js";
import { infernalSite } from "../../src/infernal-world.js";
import { B } from "../../src/data.js";
const html = readFileSync("dist/DCSMCRAFT-Standalone.html", "utf8");
const out = "/workspace/artifacts/ocean-expansion-playtest";
mkdirSync(out, { recursive: true });
async function boot(page, mode = "survival") {
  const errors = [],
    external = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (/Shader Error|GL_INVALID|WebGLProgram/.test(m.text()))
      errors.push(m.text());
  });
  await page.addInitScript(() => {
    if (!localStorage.getItem("dcsmcraft-settings"))
      localStorage.setItem(
        "dcsmcraft-settings",
        JSON.stringify({
          graphics: 1,
          renderDistance: 3,
          distantTerrain: true,
          volume: 0,
          musicEnabled: false,
          frameLimit: 30,
        }),
      );
  });
  await page.route("**/*", (r) =>
    r.request().url().endsWith("/oceans.html")
      ? r.fulfill({ contentType: "text/html", body: html })
      : (external.push(r.request().url()), r.abort()),
  );
  await page.goto("/oceans.html");
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.locator("[data-action=create]").click();
  await page.locator("[name=seed]").fill("Wildflower");
  await page.locator(`[name=mode][value=${mode}]`).check();
  await page.locator("[data-action=start-world]").click();
  await page.waitForFunction(() => dcsmcraft.running);
  await page.evaluate(() => {
    dcsmcraft.pause();
    dcsmcraft.entities = [];
    dcsmcraft.ui.play();
    dcsmcraft.pointerLockFallback = true;
    document
      .querySelectorAll("#toast,#cycle-banner")
      .forEach((e) => (e.style.visibility = "hidden"));
  });
  return { errors, external };
}
test("offline new world crafts and launches a boat with real clicks, crosses an ocean, steers, saves/reloads aboard and dismounts", async ({
  page,
}) => {
  test.setTimeout(150000);
  const result = await boot(page);
  await page.evaluate(() => {
    const g = dcsmcraft;
    g.inventory.slots.fill(null);
    g.inventory.slots[0] = { id: "planks", count: 5 };
    g.openInventory("table");
  });
  await page.locator("#recipe-search").fill("Oak Boat");
  await page.locator(".recipe-card:visible").first().click();
  await page.locator("[data-action=craft]").click();
  await page.locator('[data-ref=inventory][data-index="0"]').click();
  expect(await page.evaluate(() => dcsmcraft.inventory.slots[0])).toEqual({
    id: "oak_boat",
    count: 1,
  });
  await page.locator("[data-action=close-inv]").click();
  await page.evaluate((B) => {
    const g = dcsmcraft;
    g.pause();
    g.ui.play();
    g.entities = [];
    for (let z = 5; z <= 8; z++) g.world.set(4128, 63, z, B.planks);
    Object.assign(g.player, {
      x: 4128.5,
      y: 64.01,
      z: 6.5,
      yaw: 0,
      pitch: -0.8,
      vx: 0,
      vy: 0,
      vz: 0,
      onGround: true,
      flying: false,
      fallStart: 64.01,
    });
    g.renderer.loadAround(g.player.x, g.player.z, 3, 30);
    g.resume();
    g.pointerLockFallback = true;
  }, B);
  await page.waitForTimeout(300);
  await page.mouse.click(640, 400, { button: "right" });
  await page.waitForFunction(() =>
    dcsmcraft.entities.some((e) => e.type === "boat"),
  );
  expect(await page.evaluate(() => dcsmcraft.inventory.held)).toBeNull();
  await page.evaluate(() => {
    const g = dcsmcraft,
      b = g.entities.find((e) => e.type === "boat"),
      dx = b.x - g.player.x,
      dz = b.z - g.player.z;
    g.player.yaw = Math.atan2(-dx, -dz);
    g.player.pitch = Math.atan2(
      b.y + 0.25 - g.player.y - 1.62,
      Math.hypot(dx, dz),
    );
  });
  await page.mouse.click(640, 400, { button: "right" });
  await page.waitForFunction(() => !!dcsmcraft.player.boatId);
  const start = await page.evaluate(() => ({
    ...dcsmcraft.entities.find((e) => e.type === "boat"),
  }));
  await page.keyboard.down("w");
  await page.waitForTimeout(2200);
  await page.keyboard.up("w");
  const moved = await page.evaluate(() => ({
    ...dcsmcraft.entities.find((e) => e.type === "boat"),
  }));
  expect(Math.hypot(moved.x - start.x, moved.z - start.z)).toBeGreaterThan(8);
  await page.keyboard.down("a");
  await page.waitForTimeout(700);
  await page.keyboard.up("a");
  expect(
    await page.evaluate(
      () => dcsmcraft.entities.find((e) => e.type === "boat").yaw,
    ),
  ).toBeGreaterThan(0.6);
  await page.keyboard.press("F5");
  await page.waitForTimeout(150);
  await page.screenshot({ path: out + "/ocean-boat-f5.png" });
  expect(
    await page.evaluate(() =>
      dcsmcraft.renderer.playerModel.userData.legs.every(
        (leg) => Math.abs(leg.rotation.x - 1.3) < 0.01,
      ),
    ),
  ).toBe(true);
  expect(
    await page.evaluate(() =>
      [...dcsmcraft.renderer.mobMeshes.values()].some(
        (m) => m.userData.oars?.length === 2,
      ),
    ),
  ).toBe(true);
  await page.evaluate(async () => {
    dcsmcraft.pause();
    await dcsmcraft.save();
  });
  await page.reload();
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.locator("[data-action=load]").first().click();
  await page.waitForFunction(
    () => dcsmcraft.active && !!dcsmcraft.player.boatId,
  );
  expect(
    await page.evaluate(
      () => dcsmcraft.entities.filter((e) => e.type === "boat").length,
    ),
  ).toBe(1);
  await page.evaluate(() => {
    dcsmcraft.resume();
    dcsmcraft.pointerLockFallback = true;
  });
  await page.keyboard.press("ShiftLeft");
  await page.waitForFunction(
    () => !dcsmcraft.player.boatId,
    {},
    { timeout: 10000 },
  );
  expect(await page.evaluate(() => dcsmcraft.player.health)).toBe(20);
  expect(result.errors).toEqual([]);
  expect(result.external).toEqual([]);
});

test("offline real portal enters spaced procedural Cinderworld structures; a Creative flier egg attacks in Survival and a clicked fireball returns damage", async ({
  page,
}) => {
  test.setTimeout(180000);
  const result = await boot(page, "creative");
  await page.evaluate((B) => {
    const g = dcsmcraft,
      f = { x: 8, y: 180, z: 8, axis: "x" };
    for (let u = 0; u < 4; u++)
      for (let v = 0; v < 5; v++)
        g.world.set(
          f.x + u,
          f.y + v,
          f.z,
          u === 0 || u === 3 || v === 0 || v === 4 ? B.obsidian : B.air,
        );
    g.inventory.slots[0] = { id: "flint_and_steel", count: 1, durability: 64 };
    g.inventory.selected = 0;
    g.target = {
      x: 8,
      y: 181,
      z: 8,
      id: B.obsidian,
      normal: { x: 1, y: 0, z: 0 },
    };
    g.lastPlace = -10;
    g.use();
    g.travelDimension(f);
    g.pause();
    g.ui.play();
  }, B);
  expect(
    await page.evaluate(() => ({
      dimension: dcsmcraft.dimension,
      gen: dcsmcraft.world.generationVersion,
    })),
  ).toEqual({ dimension: "cinderwild", gen: 14 });
  const w = new World("Wildflower", {}, "cinderwild"),
    found = new Map();
  for (let z = -2; z <= 2; z++)
    for (let x = -2; x <= 2; x++) {
      const s = infernalSite(w, x, z);
      found.set(s.kind, s);
    }
  for (const s of found.values()) {
    await page.evaluate((s) => {
      const g = dcsmcraft;
      g.settings.renderDistance = 6;
      g.renderer.applyGraphics();
      Object.assign(g.player, {
        x: s.x + 48,
        y: s.y + s.height * 0.65,
        z: s.z + 65,
        yaw: 0.63,
        pitch: -0.23,
        flying: true,
        vy: 0,
      });
      g.renderer.loadAround(g.player.x, g.player.z, 6, 150);
    }, s);
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${out}/${s.kind}.png` });
  }
  const s = found.get("citadel");
  await page.evaluate(
    ({ s, B }) => {
      const g = dcsmcraft;
      const offset = (x, z) =>
        s.rotation === 1
          ? [-z, x]
          : s.rotation === 2
            ? [-x, -z]
            : s.rotation === 3
              ? [z, -x]
              : [x, z];
      const [ex, ez] = offset(0, 10),
        [px, pz] = offset(0, 24),
        [ax, az] = offset(0, 15);
      g.entities = [];
      g.drops = [];
      g.world.settlements[s.id] = {
        created: [0, 1, 2, 3, 4, 5],
        defeated: [],
        site: s,
      };
      Object.assign(g.player, {
        x: s.x + ax + 0.5,
        y: s.y + 1.01,
        z: s.z + az + 0.5,
        yaw: 0,
        pitch: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        onGround: true,
        flying: false,
        fallStart: s.y + 1.01,
      });
      g.inventory.slots[0] = { id: "ember_ray_spawn_egg", count: 1 };
      g.target = {
        x: s.x + ex,
        y: s.y,
        z: s.z + ez,
        id: B.cinder_bricks,
        normal: { x: 0, y: 1, z: 0 },
      };
      g.use();
      g.player.x = s.x + px + 0.5;
      g.player.z = s.z + pz + 0.5;
      const e = g.entities.find((e) => e.type === "ember_ray");
      if (!e) throw Error("Flier egg failed");
      e.y = s.y + 8;
      e.home = { x: e.x, y: e.y, z: e.z };
      g.entities = [e];
      g.mode = "survival";
      g.difficulty = "easy";
      g.inventory.slots[0] = null;
      g.inventory.equipment = [
        null,
        { id: "hellfire_chestplate", count: 1, durability: 500 },
        null,
        null,
      ];
      g.resume();
      g.pointerLockFallback = true;
    },
    { s, B },
  );
  await page.mouse.move(640, 400);
  await page.evaluate(() => {
    dcsmcraft.settings.renderDistance = 2;
    dcsmcraft.settings.distantTerrain = false;
    dcsmcraft.renderer.applyGraphics();
  });
  await page.waitForFunction(
    () => {
      const g = dcsmcraft,
        e = g.entities.find((e) => e.type === "ember_ray");
      if (e) {
        const dx = e.x - g.player.x,
          dz = e.z - g.player.z;
        g.player.yaw = Math.atan2(-dx, -dz);
        g.player.pitch = Math.atan2(
          e.y + 0.8 - g.player.y - 1.62,
          Math.hypot(dx, dz),
        );
      }
      return g.hostileProjectiles.some(
        (q) =>
          q.fireball &&
          !q.reflected &&
          Math.hypot(
            q.x - g.player.x,
            q.y - g.player.y - 1.62,
            q.z - g.player.z,
          ) < 3.3,
      );
    },
    {},
    { timeout: 15000 },
  );
  await page.mouse.down();
  await page.mouse.up();
  await page.waitForFunction(
    () => dcsmcraft.hostileProjectiles.some((q) => q.fireball && q.reflected),
    {},
    { timeout: 10000 },
  );
  await page.screenshot({ path: out + "/returned-fireball.png" });
  await page.waitForFunction(
    () => dcsmcraft.entities.some((e) => e.type === "ember_ray" && e.hp < 24),
    {},
    { timeout: 10000 },
  );
  expect(result.errors).toEqual([]);
  expect(result.external).toEqual([]);
});

test("offline connected Cinderworld naturally builds a denser mixed threat and attacks a Survival player", async ({
  page,
}) => {
  test.setTimeout(120000);
  const result = await boot(page, "creative");
  await page.evaluate((B) => {
    const g = dcsmcraft,
      f = { x: 8, y: 180, z: 8, axis: "x" };
    for (let u = 0; u < 4; u++)
      for (let v = 0; v < 5; v++)
        g.world.set(
          f.x + u,
          f.y + v,
          f.z,
          u === 0 || u === 3 || v === 0 || v === 4 ? B.obsidian : B.air,
        );
    g.inventory.slots[0] = { id: "flint_and_steel", count: 1, durability: 64 };
    g.target = {
      x: 8,
      y: 181,
      z: 8,
      id: B.obsidian,
      normal: { x: 1, y: 0, z: 0 },
    };
    g.lastPlace = -10;
    g.use();
    g.travelDimension(f);
    g.pause();
    g.ui.play();
    const t = g.world.terrain(64, 64);
    Object.assign(g.player, {
      x: 64.5,
      y: t.h + 1,
      z: 64.5,
      vx: 0,
      vy: 0,
      vz: 0,
      flying: false,
      health: 20,
      yaw: 0.6,
      pitch: 0,
    });
    g.entities = [];
    g.tickCount = 0;
    g.hostileProjectiles = [];
    g.renderer.loadAround(64, 64, 3, 30);
    g.resume();
    g.pointerLockFallback = true;
  }, B);
  await page.waitForFunction(
    () =>
      dcsmcraft.entities.filter(
        (e) =>
          e.hp > 0 &&
          [
            "dread_knight",
            "soul_reaver",
            "magma_maw",
            "emberling",
            "basalt_crawler",
            "cinder_wraith",
            "ember_ray",
            "cinder_roc",
          ].includes(e.type),
      ).length >= 18,
    {},
    { timeout: 65000 },
  );
  const before = await page.evaluate(() => {
    dcsmcraft.pause();
    dcsmcraft.ui.play();
    const types = dcsmcraft.entities.filter((e) => e.hp > 0).map((e) => e.type);
    return {
      types: [...new Set(types)],
      count: types.length,
      generation: dcsmcraft.world.generationVersion,
    };
  });
  expect(before.generation).toBe(14);
  expect(before.types.length).toBeGreaterThanOrEqual(6);
  expect(
    before.types.some((t) => t === "ember_ray" || t === "cinder_roc"),
  ).toBe(true);
  await page.screenshot({ path: out + "/denser-cinderworld.png" });
  await page.evaluate(() => {
    dcsmcraft.mode = "survival";
    dcsmcraft.resume();
    dcsmcraft.pointerLockFallback = true;
  });
  await page.waitForFunction(
    () => dcsmcraft.player.health < 20,
    {},
    { timeout: 20000 },
  );
  expect(result.errors).toEqual([]);
  expect(result.external).toEqual([]);
});
