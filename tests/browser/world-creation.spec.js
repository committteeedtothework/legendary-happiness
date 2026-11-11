import { test, expect } from "@playwright/test";

for (const mode of ["survival", "creative"]) {
  test(`${mode} world remains playable without UUID, clone, or IndexedDB APIs`, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Object.defineProperty(crypto, "randomUUID", {
        value: undefined,
        configurable: true,
      });
      Object.defineProperty(window, "structuredClone", {
        value: undefined,
        configurable: true,
      });
      Object.defineProperty(window, "indexedDB", {
        get() {
          throw new DOMException(
            "Storage unavailable in this document.",
            "SecurityError",
          );
        },
        configurable: true,
      });
    });
    await page.goto("/");
    await page.waitForFunction(() => window.dcsmcraft?.initialized);
    await page
      .getByRole("button", { name: "Create New World", exact: false })
      .click();
    await page.locator("[name=seed]").fill("Wildflower");
    await page.locator(`[name=mode][value=${mode}]`).check();
    await page.getByRole("button", { name: "Create New World" }).click();
    await page.waitForFunction(
      () =>
        dcsmcraft.active && dcsmcraft.running && dcsmcraft.ui.screen === "play",
    );
    const before = await page.evaluate(() => ({
      x: dcsmcraft.player.x,
      z: dcsmcraft.player.z,
    }));
    await page.keyboard.down("KeyW");
    await page.waitForTimeout(600);
    await page.keyboard.up("KeyW");
    const moved = await page.evaluate(
      (p) => Math.hypot(dcsmcraft.player.x - p.x, dcsmcraft.player.z - p.z),
      before,
    );
    expect(moved).toBeGreaterThan(0.1);
    await page.evaluate(() => dcsmcraft.openInventory("personal"));
    await expect(page.locator(mode === "creative" ? ".creative-catalog" : ".inventory-window")).toBeVisible();
    const id = await page.evaluate(async () => {
      dcsmcraft.player.xp = 37;
      await dcsmcraft.save();
      return dcsmcraft.id;
    });
    await page.reload();
    await page.waitForFunction(() => window.dcsmcraft?.initialized);
    const result = await page.evaluate(async (id) => {
      const { data } = await dcsmcraft.store.load(id);
      await dcsmcraft.loadWorld(id);
      return {
        xp: data.player.xp,
        mode: data.mode,
        fallback: dcsmcraft.store.fallback,
        temporary: !!dcsmcraft.store.temporary,
        id: data.id,
      };
    }, id);
    expect(result).toMatchObject({
      xp: 37,
      mode,
      fallback: true,
      temporary: false,
    });
    expect(result.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    await page.waitForFunction(
      () => dcsmcraft.active && dcsmcraft.ui.screen === "play",
    );
  });
}

test("storage-blocked HTML viewer can play, save within session, and export an honest temporary world", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(crypto, "randomUUID", {
      value: undefined,
      configurable: true,
    });
    for (const key of ["indexedDB", "localStorage"])
      Object.defineProperty(window, key, {
        get() {
          throw new DOMException("Browser storage denied.", "SecurityError");
        },
        configurable: true,
      });
  });
  await page.goto("/");
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page
    .getByRole("button", { name: "Create New World", exact: false })
    .click();
  await page.getByRole("button", { name: "Create New World" }).click();
  await page.waitForFunction(
    () =>
      dcsmcraft.active && dcsmcraft.running && dcsmcraft.ui.screen === "play",
  );
  await expect(page.locator("#save-status")).toContainText("SESSION ONLY");
  await expect(page.locator("#toast")).toContainText("session-only");
  await page.evaluate(async () => {
    dcsmcraft.player.xp = 21;
    await dcsmcraft.quit();
  });
  await page.getByRole("button", { name: "Singleplayer", exact: true }).click();
  await expect(page.locator(".world-row")).toHaveCount(1);
  const downloaded = page.waitForEvent("download");
  await page.getByTitle("Export world backup").click();
  const file = await downloaded;
  expect(file.suggestedFilename()).toMatch(/^dcsmcraft-.*\.json$/);
  const xp = await page.evaluate(async () => {
    const worlds = await dcsmcraft.store.list();
    return (await dcsmcraft.store.load(worlds[0].id)).data.player.xp;
  });
  expect(xp).toBe(21);
});
