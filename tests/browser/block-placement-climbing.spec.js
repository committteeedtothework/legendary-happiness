import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { B } from "../../src/data.js";
const html = readFileSync("dist/DCSMCRAFT-Standalone.html", "utf8");
async function create(page, mode = "survival") {
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (/Shader Error|GL_INVALID|WebGLProgram/.test(m.text()))
      errors.push(m.text());
  });
  await page.addInitScript(() =>
    localStorage.setItem(
      "dcsmcraft-settings",
      JSON.stringify({ renderDistance: 2, graphics: 1 }),
    ),
  );
  await page.route("**/*", (r) =>
    r.request().url().endsWith("/block-fix.html")
      ? r.fulfill({ contentType: "text/html", body: html })
      : r.abort(),
  );
  await page.goto("/block-fix.html");
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.locator("[data-action=create]").first().click();
  await page.locator("[name=seed]").fill("Wildflower");
  await page.locator(`[name=mode][value=${mode}]`).check();
  await page.locator("[data-action=start-world]").click();
  await page.waitForFunction(() => dcsmcraft.active);
  await page.evaluate(() => dcsmcraft.pause());
  await page.mouse.move(640, 400);
  return errors;
}
for (const mode of ["survival", "creative"])
  test(`${mode}: hold place and jump to build underneath at negative chunk coordinates, then release safely`, async ({
    page,
  }) => {
    const errors = await create(page, mode);
    await page.evaluate((B) => {
      const g = dcsmcraft;
      for (let x = -19; x <= -14; x++)
        for (let z = -19; z <= -14; z++) {
          g.world.set(x, 199, z, B.stone);
          for (let y = 200; y <= 211; y++) g.world.set(x, y, z, B.air);
        }
      g.entities = [];
      g.drops = [];
      g.difficulty = "peaceful";
      g.inventory.slots.fill(null);
      g.inventory.slots[0] = { id: "planks", count: 32 };
      g.inventory.selected = 0;
      Object.assign(g.player, {
        x: -16.5,
        y: 200 - 0.000005,
        z: -16.5,
        yaw: 0,
        pitch: -1.54,
        vx: 0,
        vy: 0,
        vz: 0,
        onGround: true,
        flying: false,
        fallStart: 200,
      });
      g.resume();
      g.pointerLockFallback = true;
    }, B);
    await page.waitForFunction(() => dcsmcraft.target?.y === 199);
    // The first attempt is blocked by the body; holding place retries as the jump clears it.
    await page.mouse.down({ button: "right" });
    expect(await page.evaluate(() => dcsmcraft.world.get(-17, 200, -17))).toBe(
      B.air,
    );
    await page.keyboard.down("Space");
    await page.waitForFunction(
      () => dcsmcraft.world.get(-17, 202, -17) === 8,
      null,
      { timeout: 15000 },
    );
    await page.mouse.up({ button: "right" });
    await page.keyboard.up("Space");
    const result = await page.evaluate(() => {
      const g = dcsmcraft;
      g.pause();
      let blocks = 0;
      for (let y = 200; y < 211; y++)
        if (g.world.get(-17, y, -17) === 8) blocks++;
      return {
        blocks,
        count: g.inventory.slots[0].count,
        feet: g.player.y,
        held: g.rightMouseDown,
        id: g.id,
      };
    });
    expect(result.blocks).toBeGreaterThanOrEqual(3);
    expect(result.feet).toBeGreaterThanOrEqual(200 + result.blocks - 0.00002);
    expect(result.held).toBe(false);
    expect(result.count).toBe(mode === "creative" ? 32 : 32 - result.blocks);
    await page.evaluate(() => {
      dcsmcraft.resume();
      dcsmcraft.pointerLockFallback = true;
    });
    await page.keyboard.down("Space");
    await page.waitForTimeout(650);
    await page.keyboard.up("Space");
    expect(
      await page.evaluate(() => {
        let n = 0;
        for (let y = 200; y < 211; y++)
          if (dcsmcraft.world.get(-17, y, -17) === 8) n++;
        return n;
      }),
    ).toBe(result.blocks);
    await page.evaluate(async () => {
      dcsmcraft.pause();
      await dcsmcraft.save();
    });
    await page.reload();
    await page.waitForFunction(() => window.dcsmcraft?.initialized);
    await page
      .locator(`[data-action=load][data-id="${result.id}"]`)
      .first()
      .click();
    await page.waitForFunction(() => dcsmcraft.active);
    expect(await page.evaluate(() => dcsmcraft.world.get(-17, 202, -17))).toBe(
      B.planks,
    );
    expect(errors).toEqual([]);
  });
test("walk onto a one-block ledge under a low roof across a chunk seam, and stop at a taller wall", async ({
  page,
}) => {
  const errors = await create(page);
  await page.evaluate((B) => {
    const g = dcsmcraft;
    for (let x = 13; x <= 23; x++)
      for (let z = 7; z <= 10; z++) {
        g.world.set(x, 199, z, B.stone);
        for (let y = 200; y <= 204; y++) g.world.set(x, y, z, B.air);
        g.world.set(x, 203, z, B.stone);
        if (x >= 16) g.world.set(x, 200, z, B.stone);
        if (x === 21) {
          g.world.set(x, 201, z, B.stone);
          g.world.set(x, 202, z, B.stone);
        }
      }
    g.entities = [];
    g.difficulty = "peaceful";
    Object.assign(g.player, {
      x: 15.5,
      y: 200,
      z: 8.5,
      yaw: -Math.PI / 2,
      pitch: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      onGround: true,
      flying: false,
      fallStart: 200,
    });
    g.resume();
    g.pointerLockFallback = true;
  }, B);
  await page.keyboard.down("KeyW");
  await page.waitForFunction(() => dcsmcraft.player.x > 18);
  expect(
    await page.evaluate(() => Math.abs(dcsmcraft.player.y - 201)),
  ).toBeLessThan(0.00002);
  await page.waitForFunction(() => dcsmcraft.player.x >= 20.69);
  await page.waitForTimeout(300);
  await page.keyboard.up("KeyW");
  const p = await page.evaluate(() => ({ ...dcsmcraft.player }));
  expect(p.x).toBeLessThanOrEqual(20.70002);
  expect(p.y).toBeLessThan(201.001);
  expect(p.health).toBe(20);
  expect(errors).toEqual([]);
});
test("holding right click opens a door once and opening inventory clears held placement", async ({
  page,
}) => {
  const errors = await create(page, "creative");
  await page.evaluate((B) => {
    const g = dcsmcraft;
    for (let x = 7; x <= 10; x++)
      for (let z = 4; z <= 10; z++) {
        g.world.set(x, 199, z, B.stone);
        for (let y = 200; y <= 204; y++) g.world.set(x, y, z, B.air);
      }
    g.world.set(8, 200, 6, B.oak_door);
    g.world.set(8, 201, 6, B.oak_door + 1);
    Object.assign(g.player, {
      x: 8.09,
      y: 200,
      z: 8.5,
      yaw: 0,
      pitch: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      onGround: true,
      flying: false,
      fallStart: 200,
    });
    g.entities = [];
    g.inventory.slots[0] = { id: "planks", count: 64 };
    g.inventory.selected = 0;
    g.resume();
    g.pointerLockFallback = true;
  }, B);
  await page.waitForFunction(() => dcsmcraft.target?.id === 38);
  await page.mouse.down({ button: "right" });
  await page.waitForFunction(() => dcsmcraft.world.get(8, 200, 6) === 39);
  await page.waitForTimeout(800);
  expect(await page.evaluate(() => dcsmcraft.world.get(8, 200, 6))).toBe(
    B.oak_door + 2,
  );
  await page.mouse.up({ button: "right" });
  await page.evaluate(() => {
    dcsmcraft.player.x = 9.5;
    dcsmcraft.player.pitch = -1.54;
  });
  await page.waitForFunction(() => dcsmcraft.target?.y === 199);
  await page.mouse.down({ button: "right" });
  expect(await page.evaluate(() => dcsmcraft.rightMouseDown)).toBe(true);
  await page.keyboard.press("KeyE");
  await expect(page.locator(".inventory-window")).toBeVisible();
  expect(await page.evaluate(() => dcsmcraft.rightMouseDown)).toBe(false);
  await page.mouse.up({ button: "right" });
  expect(errors).toEqual([]);
});
