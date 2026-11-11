import { test, expect } from "@playwright/test";
import { B } from "../../src/data.js";

test("production build creates a playable world, opens inventory and preserves edited seam blocks on reload", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() =>
    localStorage.setItem(
      "dcsmcraft-settings",
      JSON.stringify({
        graphics: 1,
        renderDistance: 2,
        distantTerrain: false,
        volume: 0,
        musicEnabled: false,
        frameLimit: 30,
      }),
    ),
  );
  await page.goto("/");
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.locator("[data-action=create]").click();
  await page.locator("[name=seed]").fill("Wildflower");
  await page.locator("[name=difficulty]").selectOption("peaceful");
  await page.locator("[data-action=start-world]").click();
  await page.waitForFunction(
    () => dcsmcraft.running && dcsmcraft.ui.screen === "play",
  );
  await page.keyboard.press("KeyE");
  await expect(
    page.getByRole("button", { name: "Toggle recipe book" }),
  ).toBeVisible();
  const id = await page.evaluate(
    async ({ B }) => {
      const g = dcsmcraft;
      g.pause();
      g.giganto.record.config.enabled = false;
      g.world.set(15, 200, 8, B.torch);
      g.world.set(16, 199, 8, B.stone);
      g.player.health = 13;
      g.inventory.slots[0] = { id: "diamond", count: 3 };
      await g.save();
      return g.id;
    },
    { B },
  );
  await page.reload();
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.evaluate((id) => dcsmcraft.loadWorld(id), id);
  await page.waitForFunction(() => dcsmcraft.active);
  const state = await page.evaluate(() => {
    dcsmcraft.pause();
    return {
      torch: dcsmcraft.world.get(15, 200, 8),
      stone: dcsmcraft.world.get(16, 199, 8),
      health: dcsmcraft.player.health,
      diamonds: dcsmcraft.inventory.slots[0]?.count,
    };
  });
  expect(state).toEqual({
    torch: B.torch,
    stone: B.stone,
    health: 13,
    diamonds: 3,
  });
  expect(errors).toEqual([]);
});
