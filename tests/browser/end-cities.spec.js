import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
const out = "/workspace/artifacts/end-cities";
mkdirSync(out, { recursive: true });
async function boot(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.stack || e.message));
  page.on("console", (m) => {
    if (/Shader Error|VALIDATE_STATUS|GL_INVALID|WebGLProgram/.test(m.text()))
      errors.push(m.text());
  });
  await page.addInitScript(() =>
    localStorage.setItem(
      "dcsmcraft-settings",
      JSON.stringify({
        graphics: 2,
        renderDistance: 4,
        volume: 0,
        musicEnabled: false,
        ambientSounds: false,
        frameLimit: 30,
      }),
    ),
  );
  await page.goto("/");
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.locator("[data-action=create]").click();
  await page.locator("[name=seed]").fill("End city QA");
  await page.locator("[name=mode][value=survival]").check();
  await page.locator("[data-action=start-world]").click();
  await page.waitForFunction(() => dcsmcraft.running);
  await page.evaluate(() => {
    dcsmcraft.pause();
    dcsmcraft.entities = [];
  });
  await page.waitForFunction(() => !document.pointerLockElement);
  return errors;
}
test("full-stack outside dropping, collection, offhand shield/swap and shared held-model hotbar icons work through the UI", async ({
  page,
}) => {
  test.setTimeout(240000);
  const errors = await boot(page);
  await page.evaluate(async () => {
    const g = dcsmcraft,
      { makeStack } = await import("/src/data.js");
    g.inventory.slots.fill(null);
    g.inventory.slots[0] = { ...makeStack("stone", 64), origin: "stack64" };
    g.openInventory("personal");
  });
  const slot = page.locator('[data-ref=inventory][data-index="0"]');
  await slot.hover();
  await page.mouse.down();
  await page.mouse.move(5, 5, { steps: 5 });
  await page.mouse.up();
  expect(await page.evaluate(() => dcsmcraft.inventory.cursor)).toBeNull();
  expect(
    await page.evaluate(() =>
      dcsmcraft.drops
        .filter((d) => d.origin === "stack64")
        .reduce((n, d) => n + d.count, 0),
    ),
  ).toBe(64);
  await page.evaluate(async () => {
    const g = dcsmcraft,
      { makeStack } = await import("/src/data.js");
    g.inventory.slots[0] = makeStack("stone", 8);
    g.inventory.slots[1] = makeStack("stone", 12);
    g.ui.refreshInventory();
  });
  await slot.dblclick({ delay: 60 });
  expect(await page.evaluate(() => dcsmcraft.inventory.cursor?.count)).toBe(20);
  await page.evaluate(async () => {
    const g = dcsmcraft,
      { makeStack } = await import("/src/data.js");
    g.inventory.cursor = null;
    g.inventory.slots[0] = makeStack("iron_sword");
    g.inventory.offhand[0] = makeStack("shield");
    g.inventory.slots[1] = makeStack("stone", 64);
    g.inventory.slots[2] = makeStack("oak_stairs");
    g.inventory.slots[3] = makeStack("matthew_dual_pistols");
    g.inventory.selected = 0;
    g.closeInventory();
    g.target = null;
    g.targetEntity = () => null;
    g.beginSecondaryInput();
  });
  await page.waitForFunction(
    () =>
      dcsmcraft.renderer.modelIcons?.urls.has("stone") &&
      dcsmcraft.renderer.modelIcons.urls.has("shield") &&
      dcsmcraft.renderer.offhandMesh,
  );
  expect(
    await page.evaluate(
      () =>
        dcsmcraft.player.shieldRaised && dcsmcraft.player.shieldHand === "off",
    ),
  ).toBe(true);
  await page.screenshot({ path: out + "/offhand-shield-model-icons.png" });
  await page.evaluate(() => dcsmcraft.endSecondaryInput());
  await page.keyboard.press("f");
  expect(await page.evaluate(() => dcsmcraft.inventory.held.id)).toBe("shield");
  expect(await page.evaluate(() => dcsmcraft.inventory.offhand[0].id)).toBe(
    "iron_sword",
  );
  expect(await page.locator("#save-status").isVisible()).toBe(false);
  expect(await page.locator("#day-label").textContent()).toMatch(/^Day /);
  await page.setViewportSize({width:390,height:844});
  await page.waitForTimeout(200);
  const offBounds=await page.locator('.hotbar-offhand').boundingBox();expect(offBounds.x).toBeGreaterThanOrEqual(0);expect(offBounds.x+offBounds.width).toBeLessThanOrEqual(390);
  await page.screenshot({path:out+'/offhand-phone-hud.png'});
  expect(errors).toEqual([]);
  writeFileSync(
    out + "/inventory-browser.json",
    JSON.stringify(
      { errors, stack64Dropped: true, offhand: true, modelIcons: true },
      null,
      2,
    ),
  );
});
test("End Cities, Shulkers, Enderman anatomy and revised dragon swoops render with stable shaders", async ({
  page,
}) => {
  test.setTimeout(240000);
  const errors = await boot(page);
  await page.evaluate(async () => {
    const g = dcsmcraft,
      { enterEnd } = await import("/src/end-runtime.js"),
      { endCityAt } = await import("/src/end-cities.js");
    enterEnd(g);
    let site;
    for (let x = 4; x < 14 && !site; x++)
      for (let z = -8; z < 8 && !site; z++) {
        const c = endCityAt(g.world, x, z);
        if (c?.ship) site = c;
      }
    window.citySite = site;
    g.world.endgame.defeated = true;
    g.entities = [];
    Object.assign(g.player, {
      x: site.x + 14,
      y: site.y + 14,
      z: site.z + 29,
      fallStart: site.y + 14,
      yaw: 0.45,
      pitch: -0.04,
      flying: true,
    });
    g.renderer.loadAround(g.player.x, g.player.z, 3, 12);
    g.resume();
    g.mode = "creative";
  });
  await page.waitForTimeout(3500);
  await page.screenshot({ path: out + "/end-city-towers-bridges-ship.png" });
  expect(
    await page.evaluate(() =>
      dcsmcraft.entities.some((e) => e.type === "shulker"),
    ),
  ).toBe(true);
  await page.evaluate(async () => {
    const g = dcsmcraft,
      s = citySite,
      { B } = await import("/src/data.js");
    Object.assign(g.player, {
      x: s.x - 1.5,
      y: s.y + 1.05,
      z: s.z + .5,
      fallStart: s.y + 1.05,
      yaw: Math.PI,
      pitch: 0.1,
    });
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: out + "/end-city-interior-staircase.png" });
  await page.evaluate(async () => {
    const g = dcsmcraft,
      s = citySite,
      { createEntity } = await import("/src/simulation.js");
    const e = createEntity(g, "enderman", s.x, s.z);
    e.id = "head-check";
    e.x = s.x + 0.5;
    e.y = s.y + 1;
    e.z = s.z + 0.5;
    e.angry = 100;
    g.entities = [e];
    Object.assign(g.player, {
      x: s.x + 0.5,
      y: s.y + 1.02,
      z: s.z + 4,
      yaw: 0,
      pitch: 0.1,
    });
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: out + "/enderman-connected-head.png" });
  expect(
    await page.evaluate(
      () =>
        dcsmcraft.renderer.mobMeshes.get("head-check").userData.head.position.y,
    ),
  ).toBeGreaterThan(2.5);
  await page.evaluate(async () => {
    const g = dcsmcraft,
      { tickEndWorld } = await import("/src/end-runtime.js"),
      { createEntity, damageEntity, dropItem } =
        await import("/src/simulation.js");
    g.pause();
    g.world.endgame.defeated = false;
    g.entities = [];
    Object.assign(g.player, {
      x: 45,
      y: 85,
      z: 10,
      yaw: 1,
      pitch: 0,
      flying: true,
    });
    tickEndWorld(g, { createEntity, damageEntity, dropItem });
    const b = g.entities.find((e) => e.type === "dragoon");
    b.mode = "swoop";
    b.modeAge = 10;
    g.resume();
  });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: out + "/dragoon-swoop.png" });
  expect(errors).toEqual([]);
  writeFileSync(
    out + "/city-browser.json",
    JSON.stringify(
      { errors, city: true, shulkers: true, dragonSwoop: true },
      null,
      2,
    ),
  );
});
test("expanded biome village workshops, varied trades and revised HUD render in game", async ({
  page,
}) => {
  test.setTimeout(240000);
  const errors = await boot(page);
  await page.evaluate(async () => {
    const g = dcsmcraft,
      { villageAt } = await import("/src/villages.js");
    let v;
    for (let x = -3; x <= 3 && !v; x++)
      for (let z = -3; z <= 3 && !v; z++) v = villageAt(g.world, x, z);
    window.village = v;
    const h = v.houses.find((h) => h.profession === "blacksmith");
    Object.assign(g.player, {
      x: h.x + 12,
      y: v.y + 7,
      z: h.z + 14,
      yaw: 0.55,
      pitch: -0.18,
      fallStart: v.y + 7,
      flying: true,
    });
    g.mode = "creative";
    g.renderer.loadAround(g.player.x, g.player.z, 3, 12);
    g.resume();
  });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: out + "/village-blacksmith-forge.png" });
  await page.waitForFunction(()=>dcsmcraft.entities.some(e=>e.type==="villager"&&e.profession==="blacksmith"));
  await page.evaluate(() => {
    const g = dcsmcraft;
    const e = g.entities.find(
      (e) => e.type === "villager" && e.profession === "blacksmith",
    );
    if (!e) throw Error("Blacksmith did not spawn");
    g.openTrade(e);
  });
  await expect(page.locator(".trade-dialog")).toBeVisible();
  await page.screenshot({ path: out + "/blacksmith-trades.png" });
  expect(errors).toEqual([]);
});
