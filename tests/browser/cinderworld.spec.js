import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { World } from "../../src/world.js";
import { B, MOB_INFO } from "../../src/data.js";
import { cinderSite } from "../../src/cinderworld.js";
let html;
test.beforeAll(() => {
  execFileSync(process.execPath, [
    "scripts/build-standalone.mjs",
    "/tmp/dcsmcraft-cinderworld-tested.html",
  ]);
  html = readFileSync("/tmp/dcsmcraft-cinderworld-tested.html", "utf8");
});
async function create(page, standalone = true) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (
      /Shader Error|WebGLProgram|GL_INVALID|texSubImage|processorerror/i.test(
        m.text(),
      )
    )
      errors.push(m.text());
  });
  await page.addInitScript(() => {
    if (!localStorage.getItem("dcsmcraft-settings"))
      localStorage.setItem(
        "dcsmcraft-settings",
        JSON.stringify({ renderDistance: 2, graphics: 2 }),
      );
  });
  if (standalone)
    await page.route("**/*", (r) =>
      r.request().url().endsWith("/cinderworld.html")
        ? r.fulfill({ contentType: "text/html", body: html })
        : r.abort(),
    );
  await page.goto(standalone ? "/cinderworld.html" : "/");
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.locator("[data-action=create]").first().click();
  await page.locator("[name=seed]").fill("Wildflower");
  await page.locator("[name=mode][value=creative]").check();
  await page.locator("[data-action=start-world]").click();
  await page.waitForFunction(() => dcsmcraft.running);
  await page.evaluate(() => {
    const g = dcsmcraft;
    g.pause();
    // These scenarios retain generator-10 terrain; generator 11 has dedicated coverage.
    const World = g.world.constructor;
    g.world = new World(g.world.seed, {}, "overworld", 10);
    g.renderer.setWorld(g.world);
    g.realms = {
      cinderwild: {
        world: new World(g.world.seed, {}, "cinderwild", 10),
        entities: [],
        drops: [],
      },
    };
    g.ui.play();
    g.running = true;
    g.pointerLockFallback = true;
    g.entities = [];
    g.ui.root.querySelector("#cycle-banner").classList.remove("show");
  });
  return errors;
}
function sites() {
  const w = new World("Wildflower", {}, "cinderwild", 10),
    found = {};
  for (let z = -5; z <= 5; z++)
    for (let x = -5; x <= 5; x++) {
      const s = cinderSite(w, x, z);
      if (s && !found[s.kind]) found[s.kind] = s;
    }
  return found;
}
test("new Cinderworld renders explorable bastions shrines and waystations, original creatures and persistent loot", async ({
  page,
}) => {
  const errors = await create(page, false),
    found = sites();
  for (const kind of ["bastion", "shrine", "waystation"]) {
    const s = found[kind];
    await page.evaluate(async (s) => {
      const g = dcsmcraft,
        { selectRealm } = await import("/src/realms.js"),
        { createEntity } = await import("/src/simulation.js");
      g.pause();
      if (g.dimension !== "cinderwild") selectRealm(g, "cinderwild");
      Object.assign(g.player, {
        x: s.x + 3,
        y: s.y + 25,
        z: s.z + 26,
        yaw: 0,
        pitch: -0.55,
        flying: true,
        vx: 0,
        vy: 0,
        vz: 0,
      });
      g.entities = [
        "ash_deer",
        "cinderback",
        "basalt_crawler",
        "cinder_wraith",
      ].map((type, i) => createEntity(g, type, s.x - 5 + i * 3, s.z + 5));
      g.settings.renderDistance = 3;
      g.ui.play();
      g.pointerLockFallback = true;
      g.running = true;
    }, s);
    await expect
      .poll(
        () =>
          page.evaluate(
            (s) =>
              [...dcsmcraft.renderer.meshes.keys()].filter((k) => {
                const [x, z] = k.split(",").map(Number);
                return (
                  Math.hypot(
                    x - Math.floor(s.x / 16),
                    z - Math.floor(s.z / 16),
                  ) < 3
                );
              }).length,
            s,
          ),
        { timeout: 30000 },
      )
      .toBeGreaterThan(12);
    const result = await page.evaluate((s) => {
      const g = dcsmcraft;
      g.world.get(
        s.x + (s.kind === "bastion" ? 0 : 3),
        s.y + (s.kind === "bastion" ? 2 : 1),
        s.z + (s.kind === "bastion" ? -2 : 0),
      );
      const chests = Object.entries(g.world.containers).filter(([key]) => {
        const [x, , z] = key.split(",").map(Number);
        return Math.hypot(x - s.x, z - s.z) < 16;
      });
      return {
        generation: g.world.generationVersion,
        loot: chests.map(([, c]) => c.slots.filter(Boolean).map((s) => s.id)),
        models: [...g.renderer.mobMeshes.keys()].length,
        gl: g.renderer.gl.getContext().getError(),
      };
    }, s);
    expect(result.generation).toBe(10);
    expect(result.loot.length).toBeGreaterThan(0);
    expect(result.loot[0].length).toBeGreaterThan(2);
    expect(result.gl).toBe(0);
    await page.screenshot({
      path: `/workspace/artifacts/DCSMCRAFT-v1.0.0-cinder-${kind}.png`,
    });
  }
  await page.evaluate(() => {
    dcsmcraft.pause();
    dcsmcraft.ui.pause();
  });
  await page
    .getByRole("button", { name: "Cinderworld Expedition", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Cinderworld Expedition", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".dialog")).toContainText("Hellfire alloy");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  expect(errors).toEqual([]);
});
test("actual Cinderworld ore drops smelt into ingots and the alloy and Hellfire pickaxe craft through the UI", async ({
  page,
}) => {
  const errors = await create(page, false);
  const result = await page.evaluate(async (B) => {
    const g = dcsmcraft,
      { selectRealm } = await import("/src/realms.js"),
      { tickSurvival, interactContainer } = await import("/src/simulation.js"),
      { makeStack } = await import("/src/data.js");
    g.pause();
    selectRealm(g, "cinderwild");
    g.mode = "survival";
    g.difficulty = "peaceful";
    g.entities = [];
    g.inventory.slots = Array(36).fill(null);
    g.inventory.slots[0] = makeStack("diamond_pickaxe");
    const veins = [],
      brimVeins = [];
    for (let cz = -1; cz <= 1; cz++)
      for (let cx = -1; cx <= 1; cx++) {
        const c = g.world.ensure(cx, cz);
        for (let y = 15; y <= 70; y++)
          for (let z = 0; z < 16; z++)
            for (let x = 0; x < 16; x++)
              if (
                c.data[(y + 64) * 256 + z * 16 + x] === B.hellfire_ore &&
                veins.length < 4
              )
                veins.push({
                  x: cx * 16 + x,
                  y,
                  z: cz * 16 + z,
                  id: B.hellfire_ore,
                });
      }
    for (let cz = -1; cz <= 1; cz++)
      for (let cx = -1; cx <= 1; cx++) {
        const c = g.world.ensure(cx, cz);
        for (let y = 15; y <= 70; y++)
          for (let z = 0; z < 16; z++)
            for (let x = 0; x < 16; x++)
              if (
                c.data[(y + 64) * 256 + z * 16 + x] === B.brimstone_ore &&
                brimVeins.length < 3
              )
                brimVeins.push({
                  x: cx * 16 + x,
                  y,
                  z: cz * 16 + z,
                  id: B.brimstone_ore,
                });
      }
    for (const ore of [...veins, ...brimVeins]) {
      g.breakBlock(ore);
      g.player.x = ore.x + 0.5;
      g.player.y = ore.y;
      g.player.z = ore.z + 0.5;
      for (let i = 0; i < 12; i++) tickSurvival(g);
    }
    const raw = g.inventory.slots.find((s) => s?.id === "raw_hellfire");
    if (raw?.count !== 4) throw new Error("Exclusive ore drops not collected");
    g.inventory.slots[g.inventory.slots.indexOf(raw)] = null;
    Object.assign(g.player, { x: 8.5, y: 181, z: 8.5, vx: 0, vy: 0, vz: 0 });
    g.world.set(8, 180, 8, B.furnace);
    g.world.set(8, 180, 7, B.crafting_table);
    const f = interactContainer(g.world, { x: 8, y: 180, z: 8, id: B.furnace });
    const brim = g.inventory.slots.findIndex((s) => s?.id === "brimstone");
    g.inventory.consume(brim, 1);
    f.slots = [raw, makeStack("brimstone"), null];
    for (let i = 0; i < 800; i++) tickSurvival(g);
    g.inventory.add(f.slots[2]);
    f.slots[2] = null;
    g.inventory.add(makeStack("stick", 2));
    g.openInventory("personal");
    return {
      veins: veins.length,
      ingots: g.inventory.slots.find((s) => s?.id === "hellfire_ingot")?.count,
    };
  }, B);
  expect(result).toEqual({ veins: 4, ingots: 4 });
  await page
    .locator('[data-action=recipe][data-name="hellfire alloy"]')
    .click();
  await page.locator(".output-slot").click({ modifiers: ["Shift"] });
  await page
    .locator('[data-action=recipe][data-name="hellfire alloy"]')
    .click();
  await page.locator(".output-slot").click({ modifiers: ["Shift"] });
  await page.evaluate(() => {
    const g = dcsmcraft;
    g.closeInventory();
    g.openInventory("table");
  });
  await page
    .locator('[data-action=recipe][data-name="hellfire pickaxe"]')
    .click();
  await page.locator(".output-slot").click({ modifiers: ["Shift"] });
  const crafted = await page.evaluate(() =>
    dcsmcraft.inventory.slots.find((s) => s?.id === "hellfire_pickaxe"),
  );
  expect(crafted.durability).toBe(2031);
  expect(crafted.count).toBe(1);
  expect(errors).toEqual([]);
});
test("standalone temple seal requires all three real Guardians and preserves their defeat and the enchanted sword across saves", async ({
  page,
}) => {
  test.setTimeout(240000);
  const errors = await create(page);
  const site = await page.evaluate(() => {
    dcsmcraft.openJournal();
    return dcsmcraft.world.relicPlan;
  });
  expect(site.temple).toBe(true);
  await expect(page.locator(".relic-journal")).toContainText("0 / 3 Guardians");
  await page.evaluate((p) => {
    const g = dcsmcraft;
    g.mode = "survival";
    g.difficulty = "normal";
    g.entities = [];
    g.inventory.slots = Array(36).fill(null);
    g.inventory.slots[0] = { id: "hellfire_sword", count: 1, durability: 2031 };
    g.inventory.equipment = ["helmet", "chestplate", "leggings", "boots"].map(
      (slot, i) => ({
        id: "hellfire_" + slot,
        count: 1,
        durability: [450, 650, 610, 530][i],
      }),
    );
    Object.assign(g.player, {
      x: p.x + 0.5,
      y: p.y,
      z: p.z + 3,
      yaw: 0,
      pitch: 0,
      flying: false,
      vx: 0,
      vy: 0,
      vz: 0,
      health: 20,
      food: 20,
      saturation: 20,
    });
    g.ui.play();
    g.running = true;
    g.pointerLockFallback = true;
  }, site);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          dcsmcraft.entities.filter((e) => e.type === "devin_guardian").length,
      ),
    )
    .toBe(3);
  await page.mouse.down();
  await page.waitForTimeout(400);
  await page.mouse.up();
  expect(await page.evaluate(() => dcsmcraft.extraction)).toBeNull();
  await page.screenshot({
    path: "/workspace/artifacts/DCSMCRAFT-v1.0.0-temple-guardians.png",
  });
  const ids = await page.evaluate(() =>
    dcsmcraft.entities
      .filter((e) => e.type === "devin_guardian")
      .map((e) => e.id),
  );
  // Reposition the encounter in a clear courtyard for deterministic input tests;
  // production mouse listeners, reach, cooldown, armor and damage stay active.
  for (const id of ids)
    for (let n = 0; n < 40; n++) {
      await page.waitForFunction(
        () => dcsmcraft.elapsed - (dcsmcraft.lastAttack ?? -10) > 0.65,
      );
      const hit = await page.evaluate(
        ({ id, site }) => {
          const g = dcsmcraft,
            e = g.entities.find((e) => e.id === id && e.hp > 0);
          if (!e) return null;
          for (const [i, other] of g.entities
            .filter(
              (v) => v.type === "devin_guardian" && v.id !== id && v.hp > 0,
            )
            .entries())
            Object.assign(other, {
              x: site.x - 7 + i * 3,
              y: site.y,
              z: site.z - 7,
              vx: 0,
              vy: 0,
              vz: 0,
            });
          Object.assign(e, {
            x: site.x + 4,
            y: site.y,
            z: site.z + 4,
            vx: 0,
            vy: 0,
            vz: 0,
          });
          Object.assign(g.player, {
            x: e.x,
            y: e.y,
            z: e.z + 2.45,
            yaw: 0,
            pitch: Math.atan2(-0.47, 2.45),
            vx: 0,
            vy: 0,
            vz: 0,
            health: 20,
          });
          g.target = g.world.raycast(
            { x: g.player.x, y: g.player.y + 1.62, z: g.player.z },
            g.direction(),
            4.5,
          );
          const before = e.hp,
            canvas = g.renderer.gl.domElement;
          canvas.dispatchEvent(
            new MouseEvent("mousedown", { button: 0, bubbles: true }),
          );
          window.dispatchEvent(
            new MouseEvent("mouseup", { button: 0, bubbles: true }),
          );
          return {
            before,
            after: e.hp,
            running: g.running,
            target: g.targetEntity()?.id,
          };
        },
        { id, site },
      );
      if (!hit) break;
      expect(hit.after, JSON.stringify(hit)).toBeLessThan(hit.before);
    }
  await expect
    .poll(() =>
      page.evaluate(
        () => dcsmcraft.world.settlements["devin-temple"].defeated.length,
      ),
    )
    .toBe(3);
  await page.evaluate((site) => {
    const g = dcsmcraft;
    Object.assign(g.player, {
      x: site.x + 0.5,
      y: site.y,
      z: site.z + 2.8,
      yaw: 0,
      pitch: 0,
      vx: 0,
      vy: 0,
      vz: 0,
    });
    g.target = g.world.raycast(
      { x: g.player.x, y: g.player.y + 1.62, z: g.player.z },
      g.direction(),
      4.5,
    );
    g.pointerLockFallback = true;
    g.running = true;
  }, site);
  await page.evaluate(() =>
    dcsmcraft.renderer.gl.domElement.dispatchEvent(
      new MouseEvent("mousedown", { button: 0, bubbles: true }),
    ),
  );
  await page.waitForFunction(
    () => dcsmcraft.world.relicClaimed,
    {},
    { timeout: 40000 },
  );
  await page.mouse.up();
  const saved = await page.evaluate(async () => {
    const g = dcsmcraft;
    const sword = g.inventory.slots.find((s) => s?.id === "devin_sword");
    if (!sword) throw new Error("Earned sword was not awarded");
    sword.enchantments = { sharpness: 1 };
    g.inventory.selected = 1;
    g.pause();
    g.ui.play();
    g.running = true;
    g.pointerLockFallback = true;
    await g.save();
    return g.id;
  });
  await page.waitForTimeout(250);
  await page.screenshot({
    path: "/workspace/artifacts/DCSMCRAFT-v1.0.0-devin-blade.png",
  });
  await page.mouse.click(640, 400, { button: "right" });
  await page.waitForTimeout(120);
  expect(
    await page.evaluate(
      () => dcsmcraft.renderer.arcane.particles.filter(Boolean).length,
    ),
  ).toBeGreaterThan(20);
  await page.screenshot({
    path: "/workspace/artifacts/DCSMCRAFT-v1.0.0-devin-pulse.png",
  });
  await page.keyboard.press("F5");
  await page.keyboard.press("F5");
  await page.waitForTimeout(250);
  await page.screenshot({
    path: "/workspace/artifacts/DCSMCRAFT-v1.0.0-hellfire-armor.png",
  });
  await page.reload();
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.evaluate((id) => dcsmcraft.loadWorld(id), saved);
  await page.waitForFunction(() => dcsmcraft.active);
  expect(
    await page.evaluate(
      () => dcsmcraft.world.settlements["devin-temple"].defeated.length,
    ),
  ).toBe(3);
  expect(
    await page.evaluate(
      () =>
        dcsmcraft.entities.filter((e) => e.type === "devin_guardian").length,
    ),
  ).toBe(0);
  expect(
    await page.evaluate(() => dcsmcraft.inventory.slots[1].enchantments),
  ).toEqual({ sharpness: 1 });
  expect(errors).toEqual([]);
});
test("hail and tornado menu choices render real effects and persistent moving funnels, with effects independent of simulation", async ({
  page,
}) => {
  const errors = await create(page);
  await page.evaluate(() => {
    const g = dcsmcraft;
    g.pause();
    g.ui.pause();
  });
  await page.getByRole("button", { name: "Weather", exact: true }).click();
  await page.locator("[data-weather=hail]").click();
  await expect(page.locator("[data-weather=hail]")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.evaluate(() => {
    const g = dcsmcraft;
    g.player.y += 12;
    g.player.flying = true;
    g.world.weather.intensity = 1;
    g.ui.play();
    g.running = true;
    g.pointerLockFallback = true;
  });
  await expect
    .poll(() =>
      page.evaluate(() => dcsmcraft.renderer.weatherVisual.hail.visible),
    )
    .toBe(true);
  await page.screenshot({
    path: "/workspace/artifacts/DCSMCRAFT-v1.0.0-hailstorm.png",
  });
  await page.evaluate(() => {
    dcsmcraft.pause();
    dcsmcraft.ui.weather();
  });
  await page.locator("[data-weather=tornado]").click();
  await page.evaluate(() => {
    const g = dcsmcraft;
    g.world.weather.intensity = 1;
    g.ui.play();
    g.running = true;
    g.pointerLockFallback = true;
  });
  await expect
    .poll(() =>
      page.evaluate(() => dcsmcraft.renderer.weatherVisual.funnel.visible),
    )
    .toBe(true);
  const f = await page.evaluate(() => ({ ...dcsmcraft.world.weather.funnel }));
  await page.waitForTimeout(500);
  expect(
    await page.evaluate(() => dcsmcraft.world.weather.funnel.age),
  ).toBeGreaterThan(f.age);
  await page.evaluate(() => {
    const g = dcsmcraft,
      f = g.world.weather.funnel;
    g.player.x = f.x;
    g.player.z = f.z + 65;
    g.player.y = g.world.terrain(f.x, f.z).h + 18;
    g.player.yaw = 0;
    g.player.pitch = 0.08;
  });
  await page.waitForTimeout(300);
  expect(
    await page.evaluate(
      () => dcsmcraft.renderer.weatherVisual.funnel.material.fog,
    ),
  ).toBe(false);
  await page.screenshot({
    path: "/workspace/artifacts/DCSMCRAFT-v1.0.0-tornado.png",
  });
  const id = await page.evaluate(async () => {
    const g = dcsmcraft;
    g.pause();
    await g.save();
    return g.id;
  });
  await page.reload();
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.evaluate((id) => dcsmcraft.loadWorld(id), id);
  await page.waitForFunction(() => dcsmcraft.active);
  expect(await page.evaluate(() => dcsmcraft.world.weather.kind)).toBe(
    "tornado",
  );
  expect(
    await page.evaluate(() => dcsmcraft.world.weather.funnel.age),
  ).toBeGreaterThan(0);
  expect(errors).toEqual([]);
});
test("jungle pandas koalas and savanna tigers have original articulated models, voices and safe collision-height bounds", async ({
  page,
}) => {
  const errors = await create(page, false);
  const results = await page.evaluate(async () => {
    const g = dcsmcraft,
      { createEntity } = await import("/src/simulation.js");
    g.pause();
    g.entities = [];
    const t = g.world.terrain(g.player.x, g.player.z),
      x = Math.floor(g.player.x),
      z = Math.floor(g.player.z);
    for (let dx = -9; dx <= 9; dx++)
      for (let dz = -7; dz <= 7; dz++) {
        g.world.set(x + dx, 150, z + dz, 1);
        for (let dy = 151; dy < 155; dy++) g.world.set(x + dx, dy, z + dz, 0);
      }
    for (const [i, type] of [
      "panda",
      "koala",
      "tiger",
      "ash_deer",
      "cinderback",
      "basalt_crawler",
      "cinder_wraith",
    ].entries()) {
      const e = createEntity(g, type, x - 7 + i * 2, z);
      e.y = 151;
      e.turn = 9999;
      e.yaw = Math.PI - 0.3;
      e.speed = 0;
      g.entities.push(e);
      g.audio.voice(g, e, "idle");
    }
    Object.assign(g.player, {
      x: x + 0.5,
      y: 153,
      z: z + 10,
      yaw: 0,
      pitch: -0.12,
      flying: true,
    });
    g.inventory.slots[g.inventory.selected] = null;
    g.ui.play();
    g.pointerLockFallback = true; // Frozen simulation keeps models posed for inspection.
    return g.entities.map((e) => ({ id: e.id, type: e.type }));
  });
  await expect
    .poll(() => page.evaluate(() => dcsmcraft.renderer.mobMeshes.size))
    .toBeGreaterThanOrEqual(7);
  const bounds = await page.evaluate(async () => {
    const { Box3 } = await import("/node_modules/three/build/three.module.js");
    return dcsmcraft.entities.map((e) => {
      const m = dcsmcraft.renderer.mobMeshes.get(e.id),
        b = new Box3().setFromObject(m);
      return { type: e.type, height: b.max.y - b.min.y };
    });
  });
  for (const b of bounds)
    expect(b.height).toBeLessThanOrEqual(MOB_INFO[b.type].height + 0.02);
  await page.screenshot({
    path: "/workspace/artifacts/DCSMCRAFT-v1.0.0-wildlife.png",
  });
  expect(results.length).toBe(7);
  expect(errors).toEqual([]);
});
