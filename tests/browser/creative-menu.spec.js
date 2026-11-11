import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import { createServer } from "node:http";
import { CREATIVE_ENTRIES } from "../../src/creative-catalog.js";
import { CREATIVE_ITEMS } from "../../src/data.js";
const html = readFileSync("dist/DCSMCRAFT-Standalone.html"),
  out = "/workspace/artifacts/creative-menu-playtest";
mkdirSync(out, { recursive: true });
let server, origin;
test.use({ trace: "off" });
test.beforeAll(async () => {
  server = createServer((req, res) => {
    res.setHeader("Content-Type", "text/html");
    res.end(html);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  origin = `http://127.0.0.1:${server.address().port}`;
});
test.afterAll(async () => {
  server?.closeAllConnections();
  if (server) await new Promise((r) => server.close(r));
});
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
        frameLimit: 20,
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
  await page.goto(origin + "/creative-menu.html");
  await page.waitForFunction(() => dcsmcraft?.initialized);
  await page.locator("[data-action=create]").click();
  await page.locator("[name=mode][value=creative]").check();
  await page.locator("[name=seed]").fill("Creative tabs");
  await page.locator("[data-action=start-world]").click();
  await page.waitForFunction(() => dcsmcraft.running);
  await page.evaluate(() => {
    const g = dcsmcraft;
    g.openInventory("personal");
    g.inventory.cursor = null;
    g.ui.refreshInventory();
    document.querySelector("#toast").classList.remove("show");
    document.querySelector("#cycle-banner").classList.remove("show");
  });
  return { errors, external };
}
test("offline Creative menu matches tabbed five-row layout, sorts varieties, and gives the correct stacks from filtered cells", async ({
  page,
}) => {
  test.setTimeout(90000);
  const r = await boot(page);
  await expect(page.locator(".creative-tabs-top [role=tab]")).toHaveCount(6);
  await expect(page.locator(".creative-tabs-bottom [role=tab]")).toHaveCount(7);
  await expect(
    page.getByRole("tab", { name: "Search Items", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await expect(
    page.locator(".creative-hotbar [data-ref=inventory]"),
  ).toHaveCount(9);
  expect(await page.locator(".creative-slot").count()).toBeLessThanOrEqual(63);
  const box = await page.locator(".creative-catalog").evaluate((e) => ({
    rows: e.clientHeight / (e.clientWidth / 9),
    scroll: e.scrollHeight > e.clientHeight,
  }));
  expect(box.rows).toBeCloseTo(5, 1);
  expect(box.scroll).toBe(true);
  await page.screenshot({ path: out + "/search.png" });
  for (const [name, term] of [
    ["Building Blocks", "cherry stairs"],
    ["Colored Blocks", "blue concrete"],
    ["Natural Blocks", "copper ore"],
    ["Functional Blocks", "smithing"],
    ["Combat & Armor", "pistols"],
    ["Tools & Travel", "spyglass"],
    ["Food & Drinks", "apple"],
    ["Ingredients", "ingot"],
    ["Spawn Eggs", "creeper"],
  ]) {
    await page.getByRole("tab", { name, exact: true }).click();
    await page.locator("#creative-search").fill(term);
    expect(await page.locator(".creative-slot").count()).toBeGreaterThan(0);
    await expect(page.locator(".creative-heading h2")).toHaveText(name);
  }
  await page.getByRole("tab", { name: "Building Blocks", exact: true }).click();
  await page.locator("#creative-search").fill("cherry stairs");
  await page.screenshot({ path: out + "/building.png" });
  const cell = page.locator(".creative-slot");
  await cell.click({ button: "right" });
  expect(await page.evaluate(() => dcsmcraft.inventory.cursor)).toMatchObject({
    id: "cherry_stairs",
    count: 1,
  });
  await page.locator('.creative-hotbar [data-index="0"]').click();
  expect(await page.evaluate(() => dcsmcraft.inventory.slots[0].id)).toBe(
    "cherry_stairs",
  );
  await cell.click();
  expect(await page.evaluate(() => dcsmcraft.inventory.cursor)).toMatchObject({
    id: "cherry_stairs",
    count: 64,
  });
  await page.evaluate(() => {
    dcsmcraft.inventory.cursor = null;
    dcsmcraft.ui.refreshInventory();
  });
  await cell.click({ modifiers: ["Shift"] });
  expect(
    await page.evaluate(() =>
      dcsmcraft.inventory.slots
        .filter((s) => s?.id === "cherry_stairs")
        .reduce((n, s) => n + s.count, 0),
    ),
  ).toBe(65);
  expect(r.errors).toEqual([]);
  expect(r.external).toEqual([]);
});
test("offline catalog scrollbar reaches its final item, empty searches clear stale cells, tabs support keyboard focus, and narrow layouts fit", async ({
  page,
}) => {
  test.setTimeout(90000);
  const r = await boot(page),
    last = CREATIVE_ENTRIES.at(-1);
  const max = await page.locator("#creative-scrollbar").getAttribute("max");
  await page.locator("#creative-scrollbar").fill(max);
  await expect(
    page.locator(`.creative-slot[data-index="${last.index}"]`),
  ).toBeVisible();
  await page.locator(`.creative-slot[data-index="${last.index}"]`).click();
  expect(await page.evaluate(() => dcsmcraft.inventory.cursor.id)).toBe(
    last.id,
  );
  await page.evaluate(() => {
    dcsmcraft.inventory.cursor = null;
    dcsmcraft.ui.refreshInventory();
  });
  await page.locator("#creative-search").fill("nonexistent-unicorn-123");
  await expect(page.locator(".creative-slot")).toHaveCount(0);
  await expect(page.locator(".creative-catalog-status")).toHaveText(
    "No matching items",
  );
  await page.locator("#creative-search").fill("devin sword");
  await expect(page.locator(".creative-slot")).toHaveCount(2);
  await page
    .locator(
      `.creative-slot[data-index="${CREATIVE_ITEMS.indexOf("devin_sword")}"]`,
    )
    .click();
  expect(await page.evaluate(() => dcsmcraft.inventory.cursor.id)).toBe(
    "devin_sword",
  );
  await page.getByRole("tab", { name: "Search Items", exact: true }).focus();
  await page.keyboard.press("ArrowRight");
  await expect(
    page.getByRole("tab", { name: "Tools & Travel", exact: true }),
  ).toBeFocused();
  await expect(
    page.getByRole("tab", { name: "Tools & Travel", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await page.evaluate(() => {
    dcsmcraft.inventory.cursor = null;
    dcsmcraft.ui.refreshInventory();
  });
  for (const width of [640, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await page.waitForTimeout(150);
    const dims = await page.locator(".creative-window").evaluate((e) => {
      const b = e.getBoundingClientRect(),
        c = e.querySelector(".creative-slot").getBoundingClientRect();
      return {
        left: b.left,
        right: b.right,
        top: b.top,
        bottom: b.bottom,
        cellW: c.width,
        cellH: c.height,
      };
    });
    expect(dims.left).toBeGreaterThanOrEqual(0);
    expect(dims.right).toBeLessThanOrEqual(width);
    expect(Math.abs(dims.cellW - dims.cellH)).toBeLessThan(1);
    await expect(
      page.getByRole("tab", {
        name: "Player Inventory & Crafting",
        exact: true,
      }),
    ).toBeVisible();
  }
  await page.screenshot({ path: out + "/narrow.png" });
  expect(r.errors).toEqual([]);
  expect(r.external).toEqual([]);
});
test("offline Stands and player crafting remain accessible through bottom tabs; Survival has no Creative catalog", async ({
  page,
}) => {
  test.setTimeout(90000);
  const r = await boot(page);
  await page.getByRole("tab", { name: "Stands", exact: true }).click();
  await expect(page.locator(".creative-stand-grid")).toBeVisible();
  await page.locator("[data-action=creative-stand][data-stand=tusk]").click();
  expect(await page.evaluate(() => dcsmcraft.player.standData.id)).toBe("tusk");
  await page
    .getByRole("tab", { name: "Player Inventory & Crafting", exact: true })
    .click();
  if (!(await page.locator(".recipe-book").isVisible()))
    await page.locator(".recipe-book-toggle").click();
  await expect(page.locator(".recipe-book")).toBeVisible();
  await expect(page.locator("[data-ref=armor]")).toHaveCount(4);
  await expect(page.locator(".main-slots [data-ref=inventory]")).toHaveCount(
    27,
  );
  await expect(page.locator(".craft-grid [data-ref=craft]")).toHaveCount(4);
  const frame = await page.locator(".creative-player-screen").boundingBox();
  expect(frame.x).toBeGreaterThan(0);
  const bottom = await page
    .getByRole("tab", { name: "Player Inventory & Crafting", exact: true })
    .boundingBox();
  expect(bottom.y + bottom.height).toBeLessThanOrEqual(800);
  await page.screenshot({ path: out + "/player-inventory.png" });
  await page.getByRole("tab", { name: "Search Items", exact: true }).click();
  await expect(page.locator(".creative-catalog")).toBeVisible();
  await page.keyboard.press("KeyE");
  await page.waitForFunction(() => dcsmcraft.ui.screen === "play");
  await page.evaluate(() => {
    const g = dcsmcraft;
    g.mode = "survival";
    g.openInventory("personal");
  });
  await expect(page.locator(".creative-window")).toHaveCount(0);
  await expect(page.locator("[data-creative-tab]")).toHaveCount(0);
  if (!(await page.locator(".recipe-book").isVisible()))
    await page.locator(".recipe-book-toggle").click();
  await expect(page.locator(".recipe-book")).toBeVisible();
  expect(r.errors).toEqual([]);
  expect(r.external).toEqual([]);
});
