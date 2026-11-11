import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { World } from "../../src/world.js";
import { deepCaveNode } from "../../src/cave-update.js";
import { B } from "../../src/data.js";
const w = new World("Wildflower"),
  regions = new Map();
for (let z = -2; z <= 2; z++)
  for (let x = -2; x <= 2; x++)
    for (let l = 0; l < 2; l++) {
      const a = deepCaveNode(x, z, l, w.seedInt);
      if (!regions.has(a.type)) regions.set(a.type, a);
    }
test("extracted standalone runs directly from a local file with spaces, creates and persistently reloads a playable world", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const requests = [];
  page.on("request", (r) => {
    if (/^https?:/.test(r.url())) requests.push(r.url());
  });
  await page.addInitScript(() =>
    localStorage.setItem(
      "dcsmcraft-settings",
      JSON.stringify({ renderDistance: 2, graphics: 1, volume: 0 }),
    ),
  );
  try {
    await page.goto(
      pathToFileURL("/tmp/dcsmcraft desktop verification/index.html").href,
    );
  } catch (error) {
    if (error.message.includes("ERR_BLOCKED_BY_ADMINISTRATOR"))
      test.skip(
        true,
        "Managed Chromium policy blocks file://; exact standalone is tested with outside requests blocked over local HTTP.",
      );
    throw error;
  }
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.locator("[data-action=create]").first().click();
  await page.locator("[name=seed]").fill("Local Cave Test");
  await page.locator("[name=mode][value=creative]").check();
  await page.locator("[data-action=start-world]").click();
  await page.waitForFunction(() => dcsmcraft.running);
  const before = await page.evaluate(() => ({
    x: dcsmcraft.player.x,
    z: dcsmcraft.player.z,
  }));
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(650);
  await page.keyboard.up("KeyW");
  const after = await page.evaluate(() => ({
    x: dcsmcraft.player.x,
    z: dcsmcraft.player.z,
  }));
  expect(Math.hypot(before.x - after.x, before.z - after.z)).toBeGreaterThan(
    0.2,
  );
  const id = await page.evaluate(async (B) => {
    const g = dcsmcraft;
    g.pause();
    g.world.set(0, 210, 0, B.planks);
    await g.save();
    return g.id;
  }, B);
  await page.reload();
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.evaluate((id) => dcsmcraft.loadWorld(id), id);
  await page.waitForFunction(() => dcsmcraft.active);
  await page.evaluate(() => dcsmcraft.pause());
  expect(await page.evaluate(() => dcsmcraft.world.get(0, 210, 0))).toBe(
    B.planks,
  );
  expect(requests).toEqual([]);
  expect(errors).toEqual([]);
});
test("all four natural cave regions render clear bodies with chunk meshes and no WebGL errors", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() =>
    localStorage.setItem(
      "dcsmcraft-settings",
      JSON.stringify({ renderDistance: 2, graphics: 1, volume: 0 }),
    ),
  );
  const html = readFileSync("dist/DCSMCRAFT-Standalone.html", "utf8");
  await page.route("**/*", (r) =>
    r.request().url().endsWith("/regions.html")
      ? r.fulfill({ contentType: "text/html", body: html })
      : r.abort(),
  );
  await page.goto("/regions.html");
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.locator("[data-action=create]").first().click();
  await page.locator("[name=seed]").fill("Wildflower");
  await page.locator("[name=mode][value=creative]").check();
  await page.locator("[data-action=start-world]").click();
  await page.waitForFunction(() => dcsmcraft.running);
  await page.evaluate(() => dcsmcraft.pause());
  for (const [type, a] of regions) {
    const space = await page.evaluate((a) => {
      const g = dcsmcraft;
      g.entities = [];
      g.inventory.slots[0] = null;
      g.inventory.selected = 0;
      Object.assign(g.player, {
        x: a.x + 0.5,
        y: Math.floor(a.y) + 0.1,
        z: a.z + 0.5,
        yaw: 0.55,
        pitch: -0.15,
        vx: 0,
        vy: 0,
        vz: 0,
        flying: true,
        health: 20,
      });
      g.renderer.loadAround(g.player.x, g.player.z, 2, 25);
      g.ui.play();
      g.running = false;
      return [
        g.world.solid(g.player.x, g.player.y, g.player.z),
        g.world.solid(g.player.x, g.player.y + 1, g.player.z),
      ];
    }, a);
    expect(space).toEqual([false, false]);
    await page.waitForTimeout(1200);
    await expect.poll(() => page.evaluate(() => dcsmcraft.renderer.caveShade)).toBeGreaterThan(0.9);
    await page.screenshot({
      path: "/workspace/artifacts/cave-update-playtest/" + type + ".png",
    });
    expect(
      await page.evaluate(() => dcsmcraft.renderer.gl.getContext().getError()),
    ).toBe(0);
  }
  expect(regions.size).toBe(4);
  expect(errors).toEqual([]);
});
