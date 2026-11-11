import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { World } from "../../src/world.js";
import { B } from "../../src/data.js";
const html = readFileSync("dist/DCSMCRAFT-Standalone.html"),
  out = "/workspace/artifacts/living-world-playtest";
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
async function boot(page, mode = "creative") {
  const errors = [],
    external = [];
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
        distantTerrain: false,
        volume: 0,
        musicEnabled: false,
        frameLimit: 30,
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
  await page.goto(origin + "/living-world.html");
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.locator("[data-action=create]").click();
  await page.locator("[name=seed]").fill("Wildflower");
  await page.locator(`[name=mode][value=${mode}]`).check();
  await page.locator("[data-action=start-world]").click();
  await page.waitForFunction(() => dcsmcraft.running);
  return { errors, external };
}
async function look(page, x, y, z) {
  await page.mouse.move(640, 400);
  await page.evaluate(
    ({ x, y, z }) => {
      const g = dcsmcraft,
        p = g.player,
        dx = x - p.x,
        dz = z - p.z;
      p.yaw = Math.atan2(-dx, -dz);
      p.pitch = Math.atan2(y - p.y - 1.62, Math.hypot(dx, dz));
      g.pointerLockFallback = true;
    },
    { x, y, z },
  );
  await page.waitForTimeout(120);
}
async function shot(page, name) {
  await page.evaluate(() => (dcsmcraft.ui.overlay.style.visibility = "hidden"));
  await page.screenshot({ path: `${out}/${name}.png` });
  await page.evaluate(() => (dcsmcraft.ui.overlay.style.visibility = ""));
}

test("offline live props: real chest clicks and transfers, blocked lids, original instant doors, burning furnace, book/disc motion, pack changes and removal safety", async ({
  page,
}) => {
  test.setTimeout(120000);
  const result = await boot(page, "survival");
  await page.evaluate((B) => {
    const g = dcsmcraft;
    g.pause();
    g.entities = [];
    g.ui.play();
    for (let x = -4; x <= 12; x++)
      for (let z = -3; z <= 7; z++) {
        g.world.set(x, 199, z, B.stone);
        for (let y = 200; y <= 204; y++) g.world.set(x, y, z, B.air);
      }
    for (const [x, id] of [
      [0, B.chest],
      [3, B.furnace],
      [6, B.enchanting_table],
      [9, B.jukebox],
    ])
      g.world.set(x, 200, 0, id);
    g.world.set(0, 200, 4, B.oak_door);
    g.world.set(0, 201, 4, B.oak_door + 1);
    g.world.containers["0,200,0"] = {
      type: "chest",
      slots: [{ id: "diamond", count: 3 }, ...Array(26).fill(null)],
    };
    g.inventory.slots.fill(null);
    g.inventory.slots[0] = { id: "flint_and_steel", count: 1, durability: 64 };
    g.inventory.selected = 0;
    Object.assign(g.player, {
      x: 0.5,
      y: 200,
      z: 3,
      vx: 0,
      vy: 0,
      vz: 0,
      health: 20,
      onGround: true,
      flying: false,
    });
    g.renderer.loadAround(0.5, 3, 3, 30);
    g.resume();
    g.pointerLockFallback = true;
    document
      .querySelectorAll("#toast,#cycle-banner")
      .forEach((e) => (e.style.visibility = "hidden"));
  }, B);
  await look(page, 0.5, 200.45, 0.5);
  await page.mouse.click(640, 400, { button: "right" });
  await page.waitForFunction(
    () =>
      dcsmcraft.ui.screen === "inventory" && dcsmcraft.ui.invType === "chest",
  );
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          dcsmcraft.renderer.worldAnimations.models.get("0,200,0")?.userData
            .openness,
      ),
    )
    .toBeGreaterThan(0.9);
  expect(await page.evaluate((B) => dcsmcraft.world.get(0, 201, 0), B)).toBe(
    B.air,
  );
  await page.evaluate(() => {
    Object.assign(dcsmcraft.player, { z: -2.5, yaw: Math.PI, pitch: -0.4 });
  });
  await page.waitForTimeout(120);
  await shot(page, "chest-open");
  await page.evaluate(() => {
    Object.assign(dcsmcraft.player, {
      z: 3,
      yaw: 0,
      pitch: Math.atan2(-1.17, 2.5),
    });
  });
  await page
    .locator('[data-ref=container][data-index="0"]')
    .click({ modifiers: ["Shift"] });
  expect(
    await page.evaluate(
      () => dcsmcraft.inventory.slots.find((s) => s?.id === "diamond")?.count,
    ),
  ).toBe(3);
  await page.locator("[data-action=close-inv]").click();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          dcsmcraft.renderer.worldAnimations.models.get("0,200,0")?.userData
            .openness,
      ),
    )
    .toBeLessThan(0.01);
  await page.evaluate((B) => dcsmcraft.world.set(0, 201, 0, B.stone), B);
  await look(page, 0.5, 200.45, 0.5);
  await page.mouse.click(640, 400, { button: "right" });
  expect(await page.evaluate(() => dcsmcraft.ui.screen)).toBe("play");
  expect(await page.evaluate(() => dcsmcraft.inventory.held.durability)).toBe(
    64,
  );
  await page.evaluate((B) => dcsmcraft.world.set(0, 201, 0, B.air), B);
  await look(page, 0.5, 200.45, 0.5);
  await page.mouse.click(640, 400, { button: "right" });
  await page.waitForFunction(() => dcsmcraft.ui.screen === "inventory");
  await page.evaluate((B) => {
    delete dcsmcraft.world.containers["0,200,0"];
    dcsmcraft.world.set(0, 200, 0, B.air);
  }, B);
  await page.waitForFunction(() => dcsmcraft.ui.screen === "play");
  expect(
    await page.evaluate(
      () => dcsmcraft.inventory.slots.find((s) => s?.id === "diamond")?.count,
    ),
  ).toBe(3);
  await page.waitForFunction(
    () => !dcsmcraft.renderer.worldAnimations.models.has("0,200,0"),
  );
  await page.evaluate(() => {
    const g = dcsmcraft;
    g.pause();
    g.ui.play();
    g.inventory.slots[0] = null;
    Object.assign(g.player, { x: 0.5, y: 200, z: 6.5, vx: 0, vy: 0, vz: 0 });
    g.resume();
    g.pointerLockFallback = true;
  });
  await look(page, 0.5, 201.1, 4.08);
  await page.mouse.click(640, 400, { button: "right" });
  await expect
    .poll(() => page.evaluate(() => dcsmcraft.world.get(0, 200, 4)))
    .toBe(B.oak_door + 2);
  expect(
    await page.evaluate(() =>
      dcsmcraft.renderer.worldAnimations.models.has("0,200,4"),
    ),
  ).toBe(false);
  await shot(page, "door-open");
  await page.waitForTimeout(600);
  expect(await page.evaluate(() => dcsmcraft.world.get(0, 200, 4))).toBe(
    B.oak_door + 2,
  );
  await look(page, 0.09, 201, 4.5);
  await page.mouse.click(640, 400, { button: "right" });
  await expect
    .poll(() => page.evaluate(() => dcsmcraft.world.get(0, 200, 4)))
    .toBe(B.oak_door);
  await page.evaluate(() => {
    const g = dcsmcraft;
    g.pause();
    g.ui.play();
    g.world.containers["3,200,0"] = {
      type: "furnace",
      slots: [{ id: "raw_iron", count: 1 }, { id: "coal", count: 1 }, null],
      burn: 100,
      fuelMax: 1600,
      progress: 0,
      xp: 0,
    };
    g.world.containers["9,200,0"] = {
      type: "jukebox",
      slots: [{ id: "music_disc_amber", count: 1 }],
    };
    Object.assign(g.player, {
      x: 5,
      y: 200.5,
      z: -4,
      yaw: Math.PI,
      pitch: -0.3,
      flying: true,
    });
    g.mode = "creative";
    g.resume();
    g.pointerLockFallback = true;
  });
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          dcsmcraft.renderer.worldAnimations.models.get("3,200,0")?.userData
            .fire.visible,
      ),
    )
    .toBe(true);
  expect(
    await page.evaluate(
      () =>
        dcsmcraft.renderer.worldAnimations.models.get("9,200,0").userData.disc
          .visible,
    ),
  ).toBe(true);
  const before = await page.evaluate(
    () =>
      dcsmcraft.renderer.worldAnimations.models.get("6,200,0").userData.book
        .position.y,
  );
  await page.waitForTimeout(300);
  expect(
    await page.evaluate(
      () =>
        dcsmcraft.renderer.worldAnimations.models.get("6,200,0").userData.book
          .position.y,
    ),
  ).not.toBe(before);
  await shot(page, "workstations");
  for (const pack of ["classic", "supplied", "renewed"]) {
    await page.evaluate((pack) => {
      dcsmcraft.settings.texturePack = pack;
      dcsmcraft.renderer.applyGraphics();
    }, pack);
    await page.waitForTimeout(100);
    expect(
      await page.evaluate(() => dcsmcraft.renderer.gl.getContext().getError()),
    ).toBe(0);
  }
  await page.evaluate(() => {
    dcsmcraft.settings.mipmapLevels = 0;
    dcsmcraft.renderer.applyGraphics();
    return dcsmcraft.save();
  });
  await page.reload();
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.locator("[data-action=load]").first().click();
  await page.waitForFunction(
    () => dcsmcraft.running && dcsmcraft.ui.screen === "play",
  );
  expect(
    await page.evaluate(
      () => dcsmcraft.inventory.slots.find((s) => s?.id === "diamond")?.count,
    ),
  ).toBe(3);
  expect(result.errors).toEqual([]);
  expect(result.external).toEqual([]);
});

const coldWorld = new World("Wildflower");
let cold;
for (let z = -1536; z <= 1536 && !cold; z += 64)
  for (let x = -1536; x <= 1536 && !cold; x += 64) {
    const t = coldWorld.terrain(x, z);
    if (
      ["snowy_taiga", "alpine"].includes(t.biome) &&
      t.h > 70 &&
      t.h < 125 &&
      [
        [32, 0],
        [-32, 0],
        [0, 32],
        [0, -32],
      ].every(([dx, dz]) =>
        ["snowy_taiga", "alpine"].includes(
          coldWorld.terrain(x + dx, z + dz).biome,
        ),
      )
    )
      cold = { x, z, y: t.h + 1 };
  }

test("offline icy wildlife naturally includes snow leopards and polar bears; Creative eggs spawn them and their models/saves stay valid", async ({
  page,
}) => {
  test.setTimeout(120000);
  expect(cold).toBeTruthy();
  const result = await boot(page);
  await page.evaluate((cold) => {
    const g = dcsmcraft;
    g.pause();
    g.entities = [];
    g.inventory.slots.fill(null);
    Object.assign(g.player, {
      x: cold.x + 0.5,
      y: cold.y,
      z: cold.z + 0.5,
      vx: 0,
      vy: 0,
      vz: 0,
      flying: false,
    });
    g.tickCount = 119;
    g.ui.play();
    g.renderer.loadAround(g.player.x, g.player.z, 3, 30);
    g.resume();
    g.pointerLockFallback = true;
  }, cold);
  await page.waitForFunction(
    () =>
      dcsmcraft.entities.filter((e) => e.hp > 0).length >= 10 &&
      dcsmcraft.entities.some((e) => e.type === "snow_leopard") &&
      dcsmcraft.entities.some((e) => e.type === "polar_bear"),
    {},
    { timeout: 50000 },
  );
  await page.evaluate(() => {
    dcsmcraft.pause();
    dcsmcraft.openInventory("personal");
  });
  for (const name of ["Snow Leopard Spawn Egg", "Polar Bear Spawn Egg"]) {
    await page.locator("#creative-search").fill(name);
    await expect(page.locator(".creative-slot:visible")).toHaveCount(1);
    await page
      .locator(".creative-slot:visible")
      .click({ modifiers: ["Shift"] });
  }
  await page.locator("[data-action=close-inv]").click();
  await page.evaluate(() => {
    const g = dcsmcraft;
    g.pause();
    g.ui.play();
    let chosen;
    for (let dz = -10; dz <= 10 && !chosen; dz++)
      for (let dx = -10; dx <= 10 && !chosen; dx++) {
        const x = Math.floor(g.player.x) + dx,
          z = Math.floor(g.player.z) + dz,
          t = g.world.terrain(x, z);
        if (
          Array.from({ length: 6 }, (_, i) =>
            g.world.get(x, t.h + 1 + i, z),
          ).every((id) => id === 0) &&
          [-1, 0, 1].every((dx) =>
            [-1, 0, 1].every(
              (dz) =>
                g.world.get(x + dx, t.h + 1, z + dz) === 0 &&
                g.world.get(x + dx, t.h + 2, z + dz) === 0,
            ),
          ) &&
          g.entities.every((e) => Math.hypot(e.x - x - 0.5, e.z - z - 0.5) > 2)
        )
          chosen = { x, z, y: t.h };
      }
    if (!chosen) throw Error("No clear natural floor for egg");
    Object.assign(g.player, {
      x: chosen.x + 0.5,
      y: chosen.y + 3,
      z: chosen.z + 0.5,
      flying: true,
      vx: 0,
      vy: 0,
      vz: 0,
    });
    g.inventory.selected = g.inventory.slots.findIndex(
      (s) => s?.id === "polar_bear_spawn_egg",
    );
    g.resume();
    g.pointerLockFallback = true;
  });
  await page.mouse.move(640, 400);
  await page.evaluate(() => {
    dcsmcraft.player.pitch = -1.55;
    dcsmcraft.player.yaw = 0;
  });
  await page.waitForTimeout(120);
  await page.mouse.click(640, 400, { button: "right" });
  await page.waitForFunction(() =>
    dcsmcraft.entities.some((e) => e.type === "polar_bear" && e.creativeSpawn),
  );
  const poses = [];
  for (const type of ["snow_leopard", "polar_bear"]) {
    await page.evaluate((type) => {
      const g = dcsmcraft;
      g.pause();
      g.ui.play();
      const e = g.entities.find((e) => e.type === type);
      Object.assign(g.player, {
        x: e.x + 2,
        y: e.y + 0.4,
        z: e.z + 3,
        flying: true,
        yaw: 0.59,
        pitch: -0.3,
      });
      g.renderer.loadAround(g.player.x, g.player.z, 3, 20);
    }, type);
    await page.waitForTimeout(250);
    await page.screenshot({ path: `${out}/${type}.png` });
    poses.push(
      await page.evaluate((type) => {
        const e = dcsmcraft.entities.find((e) => e.type === type),
          m = dcsmcraft.renderer.mobMeshes.get(e.id);
        return {
          type,
          legs: m.userData.legs.length,
          style: m.userData.overworldStyle,
          error: dcsmcraft.renderer.gl.getContext().getError(),
        };
      }, type),
    );
  }
  expect(poses.every((p) => p.legs === 4 && p.style && p.error === 0)).toBe(
    true,
  );
  const before = await page.evaluate(async () => {
    await dcsmcraft.save();
    return dcsmcraft.entities
      .filter((e) => ["snow_leopard", "polar_bear"].includes(e.type))
      .map((e) => ({ id: e.id, type: e.type, hp: e.hp }));
  });
  await page.reload();
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.locator("[data-action=load]").first().click();
  await page.waitForFunction(
    () => dcsmcraft.running && dcsmcraft.ui.screen === "play",
  );
  expect(
    await page.evaluate(() =>
      dcsmcraft.entities
        .filter((e) => ["snow_leopard", "polar_bear"].includes(e.type))
        .map((e) => ({ id: e.id, type: e.type, hp: e.hp })),
    ),
  ).toEqual(before);
  expect(result.errors).toEqual([]);
  expect(result.external).toEqual([]);
});
