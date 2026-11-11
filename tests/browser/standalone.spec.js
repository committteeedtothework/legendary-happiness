import { test, expect } from "@playwright/test";
import { build } from "esbuild";
import { readFileSync } from "node:fs";
import { B } from "../../src/data.js";

test.use({ viewport: { width: 960, height: 640 } });
let html;
test.beforeAll(async () => {
  const bundle = await build({
    entryPoints: ["src/main.js"],
    bundle: true,
    format: "iife",
    minify: true,
    write: false,
    loader: { ".css": "empty" },
  });
  const js = bundle.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
  html = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${readFileSync("src/style.css", "utf8")}</style></head><body><div id="app"></div><script>${js}</script></body></html>`;
});
async function preview(page, allowPointerLock) {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/standalone-game.html", (route) =>
    route.fulfill({ contentType: "text/html", body: html }),
  );
  await page.route("**/standalone-parent.html", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><html><body></body></html>",
    }),
  );
  await page.goto("/standalone-parent.html");
  await page.setContent(
    `<iframe title="Game preview" sandbox="allow-scripts allow-downloads ${allowPointerLock ? "allow-pointer-lock" : ""}" src="/standalone-game.html" style="position:fixed;inset:0;width:100%;height:100%;border:0"></iframe>`,
  );
  const frame = page.frameLocator("iframe");
  await frame
    .getByRole("button", { name: "Create a world", exact: false })
    .click();
  return {
    frame,
    child: page.frames().find((f) => f !== page.mainFrame()),
    errors,
  };
}

for (const [mode, allowPointerLock] of [
  ["survival", true],
  ["creative", false],
]) {
  test(`standalone ${mode} starts from the real button when form submission is prohibited`, async ({
    page,
  }) => {
    const { frame, child, errors } = await preview(page, allowPointerLock);
    await frame.locator("[name=seed]").fill("Wildflower");
    await frame.locator(`[name=mode][value=${mode}]`).check();
    await frame.getByRole("button", { name: "Let's make a world" }).click();
    await child.waitForFunction(
      () =>
        dcsmcraft.active && dcsmcraft.running && dcsmcraft.ui.screen === "play",
    );
    if (!allowPointerLock)
      await child.waitForFunction(() => dcsmcraft.pointerLockFallback);
    const before = await child.evaluate(() => ({
      x: dcsmcraft.player.x,
      z: dcsmcraft.player.z,
      yaw: dcsmcraft.player.yaw,
    }));
    await page.keyboard.down("KeyW");
    await page.waitForTimeout(500);
    await page.keyboard.up("KeyW");
    expect(
      await child.evaluate(
        (p) => Math.hypot(dcsmcraft.player.x - p.x, dcsmcraft.player.z - p.z),
        before,
      ),
    ).toBeGreaterThan(0.1);
    const box = await frame.locator("#game-canvas").boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    const yaw = await child.evaluate(() => dcsmcraft.player.yaw);
    await page.mouse.move(box.x + box.width / 2 + 25, box.y + box.height / 2, {
      steps: 3,
    });
    expect(
      Math.abs((await child.evaluate(() => dcsmcraft.player.yaw)) - yaw),
    ).toBeGreaterThan(0.001);
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await child.evaluate((B) => {
      const g = dcsmcraft;
      for (let x = 7; x <= 9; x++)
        for (let z = 7; z <= 9; z++) g.world.set(x, 149, z, B.stone);
      g.world.set(8, 151, 6, B.log);
      Object.assign(g.player, {
        x: 8.5,
        y: 150,
        z: 8.5,
        yaw: 0,
        pitch: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        onGround: true,
        fallStart: 150,
      });
      g.inventory.slots[0] = null;
      g.inventory.selected = 0;
    }, B);
    await child.waitForFunction((id) => dcsmcraft.target?.id === id, B.log);
    await page.mouse.down();
    await expect
      .poll(() => child.evaluate(() => dcsmcraft.world.get(8, 151, 6)), {
        timeout: 15000,
      })
      .toBe(B.air);
    await page.mouse.up();
    await page.keyboard.press("KeyE");
    await expect(frame.locator(".inventory-window")).toBeVisible();
    await page.keyboard.press("KeyE");
    await child.waitForFunction(
      () => dcsmcraft.ui.screen === "play" && dcsmcraft.running,
    );
    await page.keyboard.press("Escape");
    await expect(
      frame.getByRole("heading", { name: "Game Menu" }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test("Enter starts a standalone world without relying on native form submission", async ({
  page,
}) => {
  const { frame, child, errors } = await preview(page, false);
  await frame.locator("[name=name]").fill("");
  await frame.getByRole("button", { name: "Let's make a world" }).click();
  expect(await child.evaluate(() => dcsmcraft.active)).toBe(false);
  await frame.locator("[name=name]").fill("Enter starts this world");
  await frame.locator("[name=seed]").fill("Wildflower");
  await frame.locator("[name=seed]").press("Enter");
  await child.waitForFunction(
    () =>
      dcsmcraft.active && dcsmcraft.running && dcsmcraft.ui.screen === "play",
  );
  expect(await child.evaluate(() => dcsmcraft.name)).toBe(
    "Enter starts this world",
  );
  expect(errors).toEqual([]);
});
