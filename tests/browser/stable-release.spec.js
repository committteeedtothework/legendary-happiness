import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { B, RECIPES } from "../../src/data.js";
const html = readFileSync("dist/DCSMCRAFT-Standalone.html", "utf8");
async function boot(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    if (!localStorage.getItem("dcsmcraft-settings"))
      localStorage.setItem(
        "dcsmcraft-settings",
        JSON.stringify({
          renderDistance: 2,
          graphics: 1,
          skin: "explorer",
          ambientSounds: false,
          musicEnabled: false,
        }),
      );
  });
  await page.route("**/*", (r) =>
    r.request().url().endsWith("/stable.html")
      ? r.fulfill({ contentType: "text/html", body: html })
      : r.abort(),
  );
  await page.goto("/stable.html");
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  return errors;
}
async function create(page, mode = "creative") {
  await page.locator("[data-action=create]").click();
  await page.locator("[name=seed]").fill("Wildflower");
  await page.locator(`[name=mode][value=${mode}]`).check();
  await page.locator("[data-action=start-world]").click();
  await page.waitForFunction(() => dcsmcraft.active);
  await page.evaluate(() => dcsmcraft.pause());
}
test("offline release menus, eleven skins, soft UI notes and usable crafting-table recipe sidebar", async ({
  page,
}) => {
  const errors = await boot(page);
  await expect(page.locator(".masthead")).toHaveCount(0);
  await expect(page.locator("[data-action=multiplayer]")).toBeVisible();
  await page.screenshot({
    path: "/workspace/artifacts/DCSMCRAFT-v1.0.0-title.png",
  });
  await page.locator("[data-action=skins]").click();
  await expect(page.locator(".skin-card")).toHaveCount(11);
  await page.getByRole("button", { name: /Devin The Hero/ }).click();
  await expect(page.locator("[data-skin=devin]")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.screenshot({
    path: "/workspace/artifacts/DCSMCRAFT-v1.0.0-skins.png",
  });
  await page.locator("[data-action=back]").last().click();
  await page.evaluate(() => {
    const a = dcsmcraft.audio;
    window.uiNotes = [];
    const old = a.note.bind(a);
    a.note = (...args) => {
      uiNotes.push(args);
      old(...args);
    };
  });
  await page.locator("[data-action=settings]").click();
  expect(
    await page.evaluate(() => uiNotes.map((n) => ({ gain: n[2], type: n[3] }))),
  ).toEqual([
    { gain: 0.045, type: "sine" },
    { gain: 0.012, type: "sine" },
  ]);
  await expect(page.locator(".pause-options-nav")).toHaveCount(0);
  await page.locator("[data-action=back]").last().click();
  await create(page, "survival");
  await page.locator("[data-action=settings]").click();
  await expect(page.locator(".pause-options-nav")).toBeVisible();
  await page.screenshot({
    path: "/workspace/artifacts/DCSMCRAFT-v1.0.0-options.png",
  });
  await page.evaluate(() => {
    dcsmcraft.inventory.slots.fill(null);
    dcsmcraft.inventory.slots[0] = { id: "planks", count: 3 };
    dcsmcraft.inventory.slots[1] = { id: "stick", count: 2 };
    dcsmcraft.openInventory("table");
  });
  await expect(page.locator(".recipe-book")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Crafting Recipes" }),
  ).toBeVisible();
  await page.locator("#recipe-search").fill("wooden pickaxe");
  const i = RECIPES.findIndex((r) => r.result === "wooden_pickaxe");
  await page.locator(`[data-recipe="${i}"]`).click();
  await expect(page.locator(".output-slot img")).toHaveAttribute(
    "alt",
    "Wooden pickaxe",
  );
  await page.screenshot({
    path: "/workspace/artifacts/DCSMCRAFT-v1.0.0-crafting.png",
  });
  await page.locator(".output-slot").click({ modifiers: ["Shift"] });
  expect(
    await page.evaluate(() => ({
      tools: dcsmcraft.inventory.slots
        .filter((s) => s?.id === "wooden_pickaxe")
        .reduce((n, s) => n + s.count, 0),
      craft: dcsmcraft.inventory.craft.filter(Boolean).length,
    })),
  ).toEqual({ tools: 1, craft: 0 });
  await page.evaluate(async () => {
    dcsmcraft.closeInventory();
    dcsmcraft.pause();
    await dcsmcraft.save();
  });
  await page.reload();
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  expect(await page.evaluate(() => dcsmcraft.settings.skin)).toBe("devin");
  const savedId = await page
    .locator("#recent-world [data-action=load]")
    .getAttribute("data-id");
  await page
    .locator(`#recent-world [data-action=load][data-id="${savedId}"]`)
    .click();
  await page.waitForFunction(() => dcsmcraft.active);
  await page.evaluate(() => {
    const g = dcsmcraft;
    Object.assign(g.player, {
      x: 8.5,
      y: 200,
      z: 8.5,
      yaw: 0,
      pitch: 0,
      flying: true,
    });
    g.time = 6000;
    g.resume();
    g.pointerLockFallback = true;
  });
  await page.keyboard.press("F5");
  await page.keyboard.press("F5");
  await page.waitForFunction(
    () =>
      dcsmcraft.renderer.playerModel?.userData.skin === "devin" &&
      dcsmcraft.cameraMode === 2,
  );
  await page.screenshot({
    path: "/workspace/artifacts/DCSMCRAFT-v1.0.0-devin-hero.png",
  });
  for (const skin of ["stargazer", "ranger", "smith", "tidekeeper"]) {
    await page.evaluate((skin) => (dcsmcraft.settings.skin = skin), skin);
    await page.waitForFunction(
      (skin) => dcsmcraft.renderer.playerModel?.userData.skin === skin,
      skin,
    );
    expect(
      await page.evaluate(() => dcsmcraft.renderer.gl.getContext().getError()),
    ).toBe(0);
  }
  expect(errors).toEqual([]);
});
test("manual door stays open while the player leaves and across a persistent reload", async ({
  page,
}) => {
  const errors = await boot(page);
  await create(page);
  const id = await page.evaluate((B) => {
    const g = dcsmcraft;
    for (let x = 7; x <= 10; x++)
      for (let z = 4; z <= 10; z++) {
        g.world.set(x, 199, z, B.stone);
        for (let y = 200; y <= 203; y++) g.world.set(x, y, z, B.air);
      }
    g.world.set(8, 200, 6, B.oak_door);
    g.world.set(8, 201, 6, B.oak_door + 1);
    Object.assign(g.player, {
      x: 8.09,
      y: 200,
      z: 8.5,
      yaw: 0,
      pitch: 0,
      flying: true,
      vx: 0,
      vy: 0,
      vz: 0,
    });
    g.entities = [];
    g.resume();
    g.pointerLockFallback = true;
    return g.id;
  }, B);
  await page.waitForFunction(() => dcsmcraft.target?.id === 37 + 1);
  await page.locator("#game-canvas").click({ button: "right", force: true });
  await page.waitForFunction(() => dcsmcraft.world.get(8, 200, 6) === 39);
  await page.evaluate(() => {
    dcsmcraft.player.x = 8.5;
    dcsmcraft.player.z = 12.5;
  });
  await page.waitForTimeout(1100);
  expect(await page.evaluate(() => dcsmcraft.world.get(8, 200, 6))).toBe(
    B.oak_door + 2,
  );
  await page.evaluate(async () => {
    dcsmcraft.pause();
    await dcsmcraft.save();
  });
  await page.reload();
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.locator(`[data-action=load][data-id="${id}"]`).first().click();
  await page.waitForFunction(() => dcsmcraft.active);
  expect(await page.evaluate(() => dcsmcraft.world.get(8, 200, 6))).toBe(
    B.oak_door + 2,
  );
  await page.evaluate(() => {
    Object.assign(dcsmcraft.player, {
      x: 8.09,
      y: 200,
      z: 8.5,
      yaw: 0,
      pitch: 0,
      flying: true,
      vx: 0,
      vy: 0,
      vz: 0,
    });
    dcsmcraft.resume();
    dcsmcraft.pointerLockFallback = true;
  });
  await page.waitForFunction(() => dcsmcraft.target?.id === 40);
  await page.locator("#game-canvas").click({ button: "right", force: true });
  await page.waitForFunction(() => dcsmcraft.world.get(8, 200, 6) === 37);
  expect(errors).toEqual([]);
});
test("R launches a visible homing Seeker in the actual game and saves its cooldown", async ({
  page,
}) => {
  const errors = await boot(page);
  await create(page);
  await page.evaluate((B) => {
    const g = dcsmcraft;
    // Isolate homing damage from daylight burning and idle wandering.
    g.time = 14000;
    for (let x = 4; x <= 14; x++)
      for (let z = -10; z <= 10; z++) g.world.set(x, 199, z, B.stone);
    Object.assign(g.player, {
      x: 8.5,
      y: 200,
      z: 8.5,
      yaw: 0,
      pitch: 0,
      flying: true,
      vx: 0,
      vy: 0,
      vz: 0,
    });
    g.inventory.slots[0] = { id: "devin_sword", count: 1 };
    g.inventory.selected = 0;
    const common = {
      y: 200,
      vx: 0,
      vy: 0,
      vz: 0,
      onGround: true,
      hp: 30,
      yaw: 0,
      age: 0,
      attack: 0,
      hurt: 0,
      turn: 9999,
      dir: 0,
      speed: 0,
    };
    g.entities = [
      { ...common, id: "seek-hostile", type: "shade", x: 10.5, z: -4.5 },
      { ...common, id: "seek-friend", type: "cow", x: 8.5, z: 5 },
    ];
    g.resume();
    g.pointerLockFallback = true;
  }, B);
  await page.keyboard.press("KeyR");
  await page.waitForFunction(
    () => dcsmcraft.player.devinSeekerTick > dcsmcraft.tickCount,
  );
  await page.waitForFunction(
    () => dcsmcraft.entities.find((e) => e.id === "seek-hostile")?.hp === 18,
    null,
    { timeout: 12000 },
  );
  expect(
    await page.evaluate(
      () => dcsmcraft.entities.find((e) => e.id === "seek-friend").hp,
    ),
  ).toBe(30);
  const result = await page.evaluate(async () => {
    dcsmcraft.pause();
    await dcsmcraft.save();
    const { data } = await dcsmcraft.store.load(dcsmcraft.id);
    return {
      cooldown: data.player.devinSeekerTick,
      tick: data.tickCount,
      points:
        dcsmcraft.renderer.arcane.points.geometry.attributes.position.count,
    };
  });
  expect(result.cooldown).toBeGreaterThan(result.tick);
  expect(result.points).toBe(256);
  expect(errors).toEqual([]);
});
