import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import { B, BLOCKS, ITEMS, CREATIVE_ITEMS } from "../../src/data.js";
import { VIDEO_CHOICES } from "../../src/graphics.js";
const html = readFileSync("dist/DCSMCRAFT-Standalone.html", "utf8");
const out = "/workspace/artifacts/overworld-foundations-playtest";
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
        graphics: 1,
        renderDistance: 2,
        distantTerrain: false,
        volume: 0,
        frameLimit: 20,
        musicEnabled: false,
      }),
    ),
  );
  await page.route("**/*", (r) =>
    r.request().url().endsWith("/overworld-foundations.html")
      ? r.fulfill({ contentType: "text/html", body: html })
      : (external.push(r.request().url()), r.abort()),
  );
  await page.goto("/overworld-foundations.html");
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.locator("[data-action=create]").click();
  await page.locator(`[name=mode][value=${mode}]`).check();
  await page.locator("[name=seed]").fill("Living Pastures");
  await page.locator("[data-action=start-world]").click();
  await page.waitForFunction(() => dcsmcraft.running);
  return { errors, external };
}
test("every catalog/hotbar icon has visible pixels in every texture pack; full block previews fit and egg silhouettes differ by species", async ({
  page,
}) => {
  test.setTimeout(240000);
  const r = await boot(page);
  const cubeIndices = CREATIVE_ITEMS.map((id, i) => ({
    i,
    b: BLOCKS[ITEMS[id].block],
  }))
    .filter(({ b }) => b?.edition && b.shape === "cube")
    .map(({ i }) => i);
  const reports = [];
  for (const [pack] of VIDEO_CHOICES.texturePack) {
    const report = await page.evaluate(
      async ({ pack, cubeIndices }) => {
        const g = dcsmcraft;
        g.running = false;
        g.settings.texturePack = pack;
        g.renderer.applyGraphics();
        g.ui.creativeTab = "catalog";
        g.ui.creativeCategory = "search";
        g.ui.catalogQuery = "";
        g.ui.catalogScroll = 0;
        g.openInventory("personal");
        const u = g.ui,
          icons = new Map(),
          cubes = new Set(cubeIndices);
        const pitch =
          u.overlay.querySelector(".creative-catalog").clientWidth / 9;
        for (
          let row = 0;
          row <= Math.ceil(u.catalogMatches.length / 9);
          row += 5
        ) {
          u.catalogScroll = row * pitch;
          u.renderCreativeRows();
          for (const e of u.overlay.querySelectorAll(".creative-slot"))
            icons.set(Number(e.dataset.index), e.querySelector("img")?.src);
        }
        u.catalogScroll = 1e9;
        u.renderCreativeRows();
        for (const e of u.overlay.querySelectorAll(".creative-slot"))
          icons.set(Number(e.dataset.index), e.querySelector("img")?.src);
        const blank = [],
          cropped = [],
          bad = [];
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 32;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        for (const [index, src] of icons) {
          if (!src?.startsWith("data:image/png")) {
            bad.push(index);
            continue;
          }
          const img = new Image();
          img.src = src;
          await img.decode();
          ctx.clearRect(0, 0, 32, 32);
          ctx.drawImage(img, 0, 0);
          const pixels = ctx.getImageData(0, 0, 32, 32).data;
          let count = 0,
            edge = 0;
          for (let y = 0; y < 32; y++)
            for (let x = 0; x < 32; x++)
              if (pixels[(y * 32 + x) * 4 + 3] > 20) {
                count++;
                if (x === 0 || x === 31 || y === 0 || y === 31) edge++;
              }
          if (count < 12) blank.push(index);
          if (cubes.has(index) && edge) cropped.push(index);
        }
        u.catalogScroll = 0;
        u.renderCreativeRows();
        return { pack, count: icons.size, blank, cropped, bad };
      },
      { pack, cubeIndices },
    );
    reports.push(report);
    expect(report.count, pack).toBe(CREATIVE_ITEMS.length);
    expect(report.blank, pack).toEqual([]);
    expect(report.bad, pack).toEqual([]);
    expect(report.cropped, pack).toEqual([]);
  }
  await page.getByRole("tab", { name: "Spawn Eggs", exact: true }).click();
  await page.screenshot({ path: out + "/spawn-eggs.png" });
  const sources = await page
    .locator(".creative-slot img")
    .evaluateAll((els) => els.map((e) => e.src));
  expect(new Set(sources).size).toBe(sources.length);
  await page.getByRole("tab", { name: "Building Blocks", exact: true }).click();
  await page.screenshot({ path: out + "/block-icons.png" });
  await page.getByRole("tab", { name: "Search Items", exact: true }).click();
  await page.locator("#creative-search").fill("milk bucket");
  await page.locator(".creative-slot").click();
  await page.locator('.creative-hotbar [data-index="0"]').click();
  expect(await page.evaluate(() => dcsmcraft.inventory.slots[0].id)).toBe(
    "milk_bucket",
  );
  await expect(
    page.locator('.creative-hotbar [data-index="0"] img'),
  ).toBeVisible();
  expect(r.errors).toEqual([]);
  expect(r.external).toEqual([]);
});
async function aimAtAnimal(page, id) {
  await page.mouse.move(640, 400);
  await page.evaluate((id) => {
    const g = dcsmcraft,
      p = g.player,
      e = g.entities.find((e) => e.id === id),
      dx = e.x - p.x,
      dz = e.z - p.z;
    p.yaw = Math.atan2(-dx, -dz);
    p.pitch = Math.atan2(e.y + 0.7 - p.y - 1.62, Math.hypot(dx, dz));
    g.pointerLockFallback = true;
    g.lastPlace = -999;
  }, id);
  await page.waitForTimeout(120);
}
test("offline Survival mouse interactions breed one calf, milk a cow, drink milk and preserve farm progress through an actual save/reload", async ({
  page,
}) => {
  test.setTimeout(120000);
  const r = await boot(page, "survival");
  await page.evaluate((B) => {
    const g = dcsmcraft;
    g.running = false;
    g.entities = [];
    g.drops = [];
    for (let x = 0; x < 12; x++)
      for (let z = 0; z < 12; z++) {
        g.world.set(x, 199, z, B.grass);
        for (let y = 200; y <= 204; y++) g.world.set(x, y, z, B.air);
      }
    Object.assign(g.player, {
      x: 5.5,
      y: 200,
      z: 8.5,
      vx: 0,
      vy: 0,
      vz: 0,
      fallStart: 200,
      onGround: true,
      health: 20,
    });
    g.spawn = { x: 5.5, y: 200, z: 8.5 };
    for (let i = 0; i < 2; i++)
      g.entities.push({
        id: "farm-cow-" + i,
        type: "cow",
        x: 4.5 + i * 2,
        y: 200,
        z: 6,
        hp: 10,
        onGround: true,
        yaw: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        turn: 10000,
        speed: 0,
        age: 0,
      });
    g.inventory.slots.fill(null);
    g.inventory.slots[0] = { id: "wheat", count: 4 };
    g.inventory.slots[1] = { id: "bucket", count: 1 };
    g.inventory.selected = 0;
    g.ui.updateHotbar();
    g.running = true;
    g.pointerLockFallback = true;
  }, B);
  for (const id of ["farm-cow-0", "farm-cow-1"]) {
    await aimAtAnimal(page, id);
    await page.mouse.click(640, 400, { button: "right" });
    await page.waitForTimeout(250);
  }
  await page.waitForFunction(() =>
    dcsmcraft.entities.some((e) => e.type === "cow" && e.baby),
  );
  expect(await page.evaluate(() => dcsmcraft.inventory.slots[0].count)).toBe(2);
  expect(
    await page.evaluate(
      () => dcsmcraft.entities.filter((e) => e.type === "cow" && e.baby).length,
    ),
  ).toBe(1);
  await page.keyboard.press("Digit2");
  await aimAtAnimal(page, "farm-cow-0");
  await page.mouse.click(640, 400, { button: "right" });
  await page.waitForFunction(
    () => dcsmcraft.inventory.held?.id === "milk_bucket",
  );
  await page.evaluate(() => {
    dcsmcraft.player.effects = { poison: { ticks: 300, level: 1 } };
  });
  await page.waitForTimeout(250);
  await page.mouse.click(640, 400, { button: "right" });
  await page.waitForFunction(
    () =>
      dcsmcraft.inventory.held?.id === "bucket" &&
      !dcsmcraft.player.effects?.poison,
  );
  await page.evaluate(() => {
    const g = dcsmcraft;
    Object.assign(g.player, { x: 6.5, z: 10.5, yaw: 0, pitch: -0.25 });
    document.querySelector("#cycle-banner").classList.remove("show");
    document.querySelector("#toast").classList.remove("show");
  });
  await page.waitForTimeout(200);
  await page.screenshot({ path: out + "/farm.png" });
  const saved = await page.evaluate(async () => {
    const g = dcsmcraft;
    g.running = false;
    const baby = g.entities.find((e) => e.type === "cow" && e.baby);
    baby.growTicks = 12000;
    g.entities.find((e) => e.id === "farm-cow-0").breedCooldown = 4000;
    await g.save();
    return { id: g.id, babyId: baby.id };
  });
  await page.reload();
  await page.waitForFunction(() => dcsmcraft?.initialized);
  await page.evaluate(async (id) => {
    await dcsmcraft.loadWorld(id);
    dcsmcraft.running = false;
  }, saved.id);
  const restored = await page.evaluate(
    (babyId) => ({
      baby: dcsmcraft.entities.find((e) => e.id === babyId),
      cow: dcsmcraft.entities.find((e) => e.id === "farm-cow-0"),
      bucket: dcsmcraft.inventory.slots[1],
    }),
    saved.babyId,
  );
  expect(restored.baby).toMatchObject({
    baby: true,
    persistent: true,
    growTicks: 12000,
  });
  expect(restored.cow.breedCooldown).toBe(4000);
  expect(restored.bucket.id).toBe("bucket");
  expect(r.errors).toEqual([]);
  expect(r.external).toEqual([]);
});
test("actual enchanting UI applies Fortune, disables Silk Touch conflict without charging, and mined blocks deliver enchanted loot", async ({
  page,
}) => {
  test.setTimeout(90000);
  const r = await boot(page, "survival");
  await page.evaluate(() => {
    const g = dcsmcraft;
    g.running = false;
    g.player.xp = 100;
    g.inventory.slots[0] = {
      id: "diamond_pickaxe",
      count: 1,
      durability: 1561,
    };
    g.inventory.slots[1] = { id: "lapis_lazuli", count: 20 };
    g.inventory.selected = 0;
    g.openEnchanting();
    g.ui.enchanting(0);
  });
  await expect(page.locator("[data-action=enchant-item]")).toHaveCount(24);
  await page.locator("[data-enchantment=fortune]").click();
  await expect(page.locator("[data-enchantment=silk_touch]")).toBeDisabled();
  expect(await page.evaluate(() => dcsmcraft.player.xp)).toBe(95);
  await page.screenshot({ path: out + "/enchanting.png" });
  const mined = await page.evaluate((B) => {
    const g = dcsmcraft;
    g.running = false;
    g.inventory.held.enchantments = { silk_touch: 1 };
    g.world.set(7, 199, 7, B.stone);
    g.world.set(7, 200, 7, B.diamond_ore);
    g.drops = [];
    g.breakBlock({ x: 7, y: 200, z: 7, id: B.diamond_ore });
    return {
      drops: g.drops.map((d) => ({ id: d.id, count: d.count })),
      block: g.world.get(7, 200, 7),
      xp: g.player.xp,
    };
  }, B);
  expect(mined.drops).toEqual([{ id: "diamond_ore", count: 1 }]);
  expect(mined.block).toBe(B.air);
  expect(mined.xp).toBe(95);
  expect(r.errors).toEqual([]);
  expect(r.external).toEqual([]);
});
