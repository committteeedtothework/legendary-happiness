import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { B, RECIPES } from "../../src/data.js";
const html = readFileSync("dist/DCSMCRAFT-Standalone.html"),
  out = "/workspace/artifacts/inventory-book-2714";
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
const slot = (i) => `.main-slots [data-ref=inventory][data-index="${i}"]`;
const index = (result) =>
  RECIPES.findIndex((r) => r.id === result || r.result === result);
async function boot(page) {
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
        renderDistance: 2,
        distantTerrain: false,
        volume: 0,
        frameLimit: 30,
        skin: "explorer",
        recipeBookOpen: false,
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
  await page.goto(origin + "/inventory.html");
  await page.waitForFunction(() => dcsmcraft?.initialized);
  await page.locator("[data-action=create]").click();
  await page.locator("[name=seed]").fill("Wildflower");
  await page.locator("[name=mode][value=survival]").check();
  await page.locator("[name=difficulty]").selectOption("peaceful");
  await page.locator("[data-action=start-world]").click();
  await page.waitForFunction(
    () => dcsmcraft.running && dcsmcraft.ui.screen === "play",
  );
  await page.evaluate((stone) => {
    const g = dcsmcraft;
    g.pause();
    g.world.set(0, 199, 0, stone);
    g.entities = [];
    g.inventory = new g.inventory.constructor();
    Object.assign(g.player, {
      x: 0.5,
      y: 200,
      z: 0.5,
      vy: 0,
      yaw: 0,
      pitch: 0,
      onGround: true,
      health: 20,
      fallStart: 200,
    });
    g.inventory.slots[9] = { id: "log", count: 4 };
    g.ui.play();
    g.openInventory("personal");
  }, B.stone);
  return { errors, external };
}
test("compact inventory book fills the 2x2 grid, crafts once, tracks the mouse with the equipped skin and disposes its preview", async ({
  page,
}) => {
  test.setTimeout(120000);
  const evidence = await boot(page);
  await expect(page.locator(".inventory-model canvas")).toBeVisible();
  await expect(page.locator(".recipe-book")).toBeHidden();
  await expect(page.locator("[data-ref=armor]")).toHaveCount(4);
  await expect(page.locator("[data-ref=offhand]")).toHaveCount(1);
  await expect(page.locator(".main-slots .slot")).toHaveCount(27);
  await expect(page.locator(".inventory-hotbar .slot")).toHaveCount(9);
  const model = await page.locator(".inventory-model").boundingBox();
  await page.mouse.move(model.x - 80, model.y + model.height * 0.3);
  await page.waitForFunction(
    () => dcsmcraft.ui.inventoryPreview.look.yaw < -0.1,
  );
  await page.mouse.move(
    model.x + model.width + 160,
    model.y + model.height * 0.3,
  );
  await page.waitForFunction(
    () => dcsmcraft.ui.inventoryPreview.look.yaw > 0.1,
  );
  await page.mouse.move(model.x, 5);
  await page.waitForFunction(
    () => dcsmcraft.ui.inventoryPreview.look.pitch > 0.1,
  );
  await page.evaluate(
    () => (window.__inventoryPreview = dcsmcraft.ui.inventoryPreview),
  );
  await page.locator(".recipe-book-toggle").click();
  await expect(page.locator(".recipe-book")).toBeVisible();
  await expect(page.locator(".recipe-book-toggle")).toHaveAttribute(
    "aria-expanded",
    "true",
  );
  await page.locator("#recipe-search").fill("Oak Planks");
  const card = page.locator(
    `[data-action=recipe][data-recipe="${index("planks")}"]`,
  );
  await expect(card).toHaveAttribute("data-ready", "true");
  await card.click();
  expect(
    await page.evaluate(() => ({
      grid: dcsmcraft.inventory.craft.filter(Boolean),
      logs: dcsmcraft.inventory.slots
        .filter((s) => s?.id === "log")
        .reduce((n, s) => n + s.count, 0),
      cursor: dcsmcraft.inventory.cursor,
    })),
  ).toEqual({ grid: [{ id: "log", count: 1 }], logs: 3, cursor: null });
  await expect(page.locator(".output-slot img")).toBeVisible();
  await page.locator("[data-action=craft]").click();
  expect(await page.evaluate(() => dcsmcraft.inventory.cursor)).toEqual({
    id: "planks",
    count: 4,
  });
  await page.locator(slot(10)).click();
  await page.locator("#recipe-search").fill("Stick");
  await page
    .locator(`[data-action=recipe][data-recipe="${index("sticks")}"]`)
    .click();
  expect(await page.evaluate(() => dcsmcraft.inventory.recipe(2).result)).toBe(
    "stick",
  );
  await page.locator("[data-action=craft]").click();
  await page.locator(slot(11)).click();
  await page.locator("#recipe-search").fill("definitely-no-recipe");
  await expect(page.locator(".recipe-card")).toHaveCount(0);
  await expect(page.locator(".recipe-empty")).toBeVisible();
  for (let i = 0; i < 6; i++) await page.locator(".recipe-book-toggle").click();
  expect(
    await page.evaluate(
      () => dcsmcraft.ui.inventoryPreview === window.__inventoryPreview,
    ),
  ).toBe(true);
  await page.evaluate(() => {
    const g = dcsmcraft;
    g.settings.skin = "dante";
    g.inventory.slots[12] = { id: "iron_helmet", count: 1, durability: 165 };
    g.inventory.slots[13] = { id: "shield", count: 1, durability: 336 };
    g.ui.refreshInventory();
  });
  await page.locator(slot(12)).click();
  await page.locator('[data-ref=armor][data-index="0"]').click();
  expect(
    await page.evaluate(() => ({
      skin: dcsmcraft.ui.inventoryPreview.model.userData.skin,
      equipment: dcsmcraft.inventory.equipment[0]?.id,
    })),
  ).toEqual({ skin: "dante", equipment: "iron_helmet" });
  await page.locator(slot(13)).click();
  await page.locator("[data-ref=offhand]").click();
  expect(await page.evaluate(() => dcsmcraft.inventory.offhand[0]?.id)).toBe(
    "shield",
  );
  await page.locator(".recipe-book-toggle").click();
  await expect(page.locator(".recipe-book")).toBeHidden();
  await page.mouse.move(model.x + model.width, model.y + model.height);
  await page.screenshot({ path: out + "/personal-closed.png" });
  await page.evaluate(
    () => (window.__closedPreview = dcsmcraft.ui.inventoryPreview),
  );
  await page.keyboard.press("KeyE");
  await page.waitForFunction(() => dcsmcraft.ui.screen === "play");
  expect(await page.evaluate(() => window.__closedPreview.disposed)).toBe(true);
  expect(await page.locator(".inventory-model canvas").count()).toBe(0);
  await page.evaluate(() => dcsmcraft.save());
  await page.reload();
  await page.waitForFunction(() => dcsmcraft.initialized);
  await page.locator("[data-action=load]").first().click();
  await page.waitForFunction(() => dcsmcraft.active);
  expect(
    await page.evaluate(() => ({
      offhand: dcsmcraft.inventory.offhand[0]?.id,
      helmet: dcsmcraft.inventory.equipment[0]?.id,
    })),
  ).toEqual({ offhand: "shield", helmet: "iron_helmet" });
  expect(evidence.errors).toEqual([]);
  expect(evidence.external).toEqual([]);
});
test("table recipes fill 3x3 from carried materials, missing ingredients are harmless and the book stays usable at small sizes", async ({
  page,
}) => {
  test.setTimeout(120000);
  const evidence = await boot(page);
  await page.evaluate((id) => {
    const g = dcsmcraft;
    g.closeCraft();
    g.ui.play();
    g.inventory = new g.inventory.constructor();
    g.inventory.slots[9] = { id: "planks", count: 3 };
    g.inventory.slots[10] = { id: "stick", count: 2 };
    g.world.set(2, 200, 0, id);
    g.target = { x: 2, y: 200, z: 0, id, normal: { x: -1, y: 0, z: 0 } };
    g.lastPlace = -1e6;
    g.use();
  }, B.crafting_table);
  await expect(page.locator(".craft-grid .slot")).toHaveCount(9);
  await expect(page.locator(".recipe-book")).toBeHidden();
  await page.locator(".recipe-book-toggle").click();
  await page.locator("#recipe-search").fill("Wooden Pickaxe");
  const card = page.locator(`[data-recipe="${index("wooden_pickaxe")}"]`);
  await expect(card).toHaveAttribute("data-ready", "true");
  await card.click();
  expect(
    await page.evaluate(() => dcsmcraft.inventory.recipe(3, "table").result),
  ).toBe("wooden_pickaxe");
  await page.locator("[data-action=craft]").click();
  await page.locator(slot(11)).click();
  const before = await page.evaluate(() =>
    JSON.stringify(dcsmcraft.inventory.export()),
  );
  await card.click();
  expect(
    await page.evaluate(() => JSON.stringify(dcsmcraft.inventory.export())),
  ).toBe(before);
  await page.locator("#recipe-search").fill("");
  await page.locator("#recipe-craftable").check();
  await expect(page.locator(".recipe-card.missing")).toHaveCount(0);
  await page.locator("#recipe-craftable").uncheck();
  await expect(page.locator(".recipe-card")).toHaveCount(20);
  await page.screenshot({ path: out + "/table-book.png" });
  for (const viewport of [
    { width: 640, height: 720 },
    { width: 390, height: 700 },
    { width: 1280, height: 480 },
  ]) {
    await page.setViewportSize(viewport);
    const frame = await page.locator(".inventory-window").boundingBox();
    expect(frame.x).toBeGreaterThanOrEqual(0);
    expect(frame.x + frame.width).toBeLessThanOrEqual(viewport.width + 1);
    await page.locator(".recipe-book-toggle").scrollIntoViewIfNeeded();
    await page.locator(".recipe-book-toggle").click();
    await expect(page.locator(".recipe-book")).toBeHidden();
    await page.locator(".recipe-book-toggle").click();
    await expect(page.locator(".recipe-book")).toBeVisible();
  }
  expect(evidence.errors).toEqual([]);
  expect(evidence.external).toEqual([]);
});
