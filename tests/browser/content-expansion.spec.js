import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import { B, RECIPES, CREATIVE_ITEMS } from "../../src/data.js";
const html = readFileSync("dist/DCSMCRAFT-Standalone.html", "utf8");
const out = "/workspace/artifacts/content-playtest";
mkdirSync(out, { recursive: true });
async function boot(page, mode = "creative") {
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
    r.request().url().endsWith("/content.html")
      ? r.fulfill({ contentType: "text/html", body: html })
      : (external.push(r.request().url()), r.abort()),
  );
  await page.goto("/content.html");
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.locator("[data-action=create]").click();
  await page.locator("[name=seed]").fill("Wildflower");
  await page.locator(`[name=mode][value=${mode}]`).check();
  await page.locator("[data-action=start-world]").click();
  await page.waitForFunction(
    () => dcsmcraft.active && dcsmcraft.ui.screen === "play",
  );
  return { errors, external };
}
async function freeze(page) {
  await page.evaluate(() => {
    dcsmcraft.running = false;
    dcsmcraft.ui.screen = "test";
    document.exitPointerLock();
  });
}
test("offline expanded catalog searches all pages; new shapes, held grips, atlas shaders and high-ID saves work", async ({
  page,
}) => {
  test.setTimeout(120000);
  const result = await boot(page);
  await freeze(page);
  await page.evaluate(() => dcsmcraft.openInventory("personal"));
  expect(await page.locator(".creative-slot").count()).toBeLessThanOrEqual(63);
  await page.locator("#creative-search").fill("cherry");
  await expect(page.locator(".creative-slot")).not.toHaveCount(0);
  await page
    .locator(
      `[data-ref=creative][data-index="${CREATIVE_ITEMS.indexOf("cherry_stairs")}"]`,
    )
    .click();
  await page.locator('[data-ref=inventory][data-index="0"]').click();
  expect(await page.evaluate(() => dcsmcraft.inventory.slots[0].id)).toBe(
    "cherry_stairs",
  );
  await page.screenshot({ path: out + "/catalog.png" });
  await page.evaluate((b) => {
    const g = dcsmcraft;
    g.closeInventory();
    g.running = false;
    g.player.flying = true;
    Object.assign(g.player, { x: 5.5, y: 201, z: 12.5, yaw: 0, pitch: 0.2 });
    g.entities = [];
    for (let z = 0; z < 16; z++)
      for (let x = 0; x < 16; x++) {
        g.world.set(x, 199, z, b.stone);
        for (let y = 200; y < 205; y++) g.world.set(x, y, z, b.air);
      }
    [
      "cherry_stairs",
      "tuff_wall",
      "oak_fence",
      "cherry_trapdoor",
      "copper_lantern",
      "heavy_core",
      "oxidized_cut_copper",
    ].forEach((key, i) => g.world.set(1 + i * 2, 200, 5, b[key]));
    g.world.set(1, 200, 7, b.cherry_door);
    g.world.set(1, 201, 7, b.cherry_door + 1);
    g.inventory.slots[0] = { id: "cherry_stairs", count: 64 };
    g.inventory.selected = 0;
    g.ui.play();
    g.renderer.loadAround(5, 12, 2, 20);
  }, B);
  await page.waitForTimeout(1600);
  await page.screenshot({ path: out + "/shapes-and-grip.png" });
  const saved = await page.evaluate(async (b) => {
    const g = dcsmcraft;
    g.running = false;
    g.ui.screen = "test";
    await g.save();
    return {
      id: g.id,
      block: g.world.get(13, 200, 5),
      gen: g.world.generationVersion,
    };
  }, B);
  expect(saved.block).toBe(B.oxidized_cut_copper);
  expect(saved.block).toBeGreaterThan(255);
  expect(saved.gen).toBe(16);
  await page.reload();
  await page.waitForFunction(() => dcsmcraft.initialized);
  await page.evaluate(async (id) => {
    await dcsmcraft.loadWorld(id);
    dcsmcraft.running = false;
  }, saved.id);
  expect(await page.evaluate(() => dcsmcraft.world.get(13, 200, 5))).toBe(
    B.oxidized_cut_copper,
  );
  expect(await page.evaluate(() => dcsmcraft.inventory.slots[0].id)).toBe(
    "cherry_stairs",
  );
  expect(result.errors).toEqual([]);
  expect(result.external).toEqual([]);
});
test("offline real workstation menus select stonecutting output and upgrade enchanted gear atomically", async ({
  page,
}) => {
  test.setTimeout(120000);
  const result = await boot(page, "survival");
  await freeze(page);
  await page.evaluate((b) => {
    const g = dcsmcraft;
    Object.assign(g.player, { x: 5.5, y: 200, z: 7.5, crouching: false });
    g.entities = [];
    for (let z = 3; z < 11; z++)
      for (let x = 3; x < 9; x++) g.world.set(x, 199, z, b.stone);
    Object.assign(g.player, {
      vx: 0,
      vy: 0,
      vz: 0,
      onGround: true,
      fallStart: 200,
      health: 20,
    });
    g.world.set(5, 200, 5, b.stonecutter);
    g.target = {
      id: b.stonecutter,
      x: 5,
      y: 200,
      z: 5,
      normal: { x: 0, y: 0, z: 1 },
      distance: 2,
    };
    g.inventory.slots[0] = { id: "andesite", count: 4 };
    g.lastPlace = -999;
    g.use();
  }, B);
  await expect(page.locator("h2")).toContainText("Stonecutting");
  await page.locator("#recipe-search").fill("andesite stairs");
  const cut = RECIPES.findIndex(
    (r) => r.station === "stonecutter" && r.result === "andesite_stairs",
  );
  await page.locator(`[data-recipe="${cut}"]`).click();
  await page.locator(".output-slot").click();
  expect(await page.evaluate(() => dcsmcraft.inventory.cursor.id)).toBe(
    "andesite_stairs",
  );
  await page.locator('[data-ref=inventory][data-index="1"]').click();
  await page.screenshot({ path: out + "/stonecutting.png" });
  await page.evaluate((b) => {
    const g = dcsmcraft;
    g.closeInventory();
    g.running = false;
    g.player.crouching = false;
    g.world.set(5, 200, 5, b.smithing_table);
    g.target = {
      id: b.smithing_table,
      x: 5,
      y: 200,
      z: 5,
      normal: { x: 0, y: 0, z: 1 },
      distance: 2,
    };
    g.inventory.slots[0] = {
      id: "netherite_upgrade_smithing_template",
      count: 1,
    };
    g.inventory.slots[2] = {
      id: "diamond_sword",
      count: 1,
      durability: 1000,
      enchantments: { sharpness: 3 },
    };
    g.inventory.slots[3] = { id: "netherite_ingot", count: 1 };
    g.lastPlace = -999;
    g.use();
  }, B);
  await expect(page.locator("h2")).toContainText("Smithing");
  await page.locator("#recipe-search").fill("netherite sword");
  const upgrade = RECIPES.findIndex(
    (r) => r.station === "smithing_table" && r.result === "netherite_sword",
  );
  await page.locator(`[data-recipe="${upgrade}"]`).click();
  await page.locator(".output-slot").click();
  expect(await page.evaluate(() => dcsmcraft.inventory.cursor)).toMatchObject({
    id: "netherite_sword",
    count: 1,
    durability: 1470,
    enchantments: { sharpness: 3 },
  });
  await page.screenshot({ path: out + "/smithing.png" });
  expect(result.errors).toEqual([]);
  expect(result.external).toEqual([]);
});
test("offline mouse charge/release fires one real bow arrow, shield releases, and new weapon models render", async ({
  page,
}) => {
  test.setTimeout(120000);
  const result = await boot(page, "survival");
  await freeze(page);
  await page.evaluate((b) => {
    const g = dcsmcraft;
    for (let z = -10; z < 14; z++)
      for (let x = -4; x < 8; x++) {
        g.world.set(x, 199, z, b.stone);
        for (let y = 200; y < 205; y++) g.world.set(x, y, z, b.air);
      }
    Object.assign(g.player, {
      x: 2.5,
      y: 200,
      z: 8.5,
      yaw: 0,
      pitch: 0,
      health: 20,
      onGround: true,
    });
    g.entities = [];
    g.inventory.slots[0] = { id: "bow", count: 1, durability: 384 };
    g.inventory.slots[1] = { id: "arrow", count: 4 };
    g.inventory.selected = 0;
    g.ui.play();
    g.running = true;
    g.pointerLockFallback = true;
  }, B);
  await page.mouse.move(450, 350);
  await page.mouse.down({ button: "right" });
  await page.waitForTimeout(1100);
  expect(await page.evaluate(() => dcsmcraft.player.editionDraw?.id)).toBe(
    "bow",
  );
  await page.screenshot({ path: out + "/bow-draw.png" });
  await page.mouse.up({ button: "right" });
  expect(
    await page.evaluate(() => dcsmcraft.inventory.slots[0].durability),
  ).toBe(383);
  expect(await page.evaluate(() => dcsmcraft.inventory.slots[1].count)).toBe(3);
  await page.evaluate(() => {
    const g = dcsmcraft;
    g.inventory.slots[0] = { id: "shield", count: 1, durability: 336 };
  });
  await page.mouse.down({ button: "right" });
  expect(await page.evaluate(() => dcsmcraft.player.shieldRaised)).toBe(true);
  await page.screenshot({ path: out + "/shield.png" });
  await page.mouse.up({ button: "right" });
  expect(await page.evaluate(() => dcsmcraft.player.shieldRaised)).toBe(false);
  for (const id of ["crossbow", "mace", "netherite_sword"]) {
    await page.evaluate(
      (id) =>
        (dcsmcraft.inventory.slots[0] = { id, count: 1, durability: 500 }),
      id,
    );
    await page.waitForTimeout(250);
  }
  expect(result.errors).toEqual([]);
  expect(result.external).toEqual([]);
});
