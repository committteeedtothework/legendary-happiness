import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { B } from "../../src/data.js";

let html;
test.beforeAll(() => {
  execFileSync(process.execPath, [
    "scripts/build-standalone.mjs",
    "/tmp/dcsmcraft-controls-tested.html",
  ]);
  html = readFileSync("/tmp/dcsmcraft-controls-tested.html", "utf8");
});
async function create(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    localStorage.setItem(
      "dcsmcraft-settings",
      JSON.stringify({ renderDistance: 2, graphics: 1 }),
    );
  });
  await page.route("**/*", (r) =>
    r.request().url().endsWith("/controls.html")
      ? r.fulfill({ contentType: "text/html", body: html })
      : r.abort(),
  );
  await page.goto("/controls.html");
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.locator("[data-action=create]").first().click();
  await page.locator("[name=seed]").fill("Wildflower");
  await page.locator("[data-action=start-world]").click();
  await page.waitForFunction(() => dcsmcraft.active && dcsmcraft.running);
  // A flat, high test platform isolates keyboard behavior from terrain/AI.
  await page.evaluate((B) => {
    const g = dcsmcraft;
    for (let x = -12; x <= 12; x++)
      for (let z = -32; z <= 12; z++) g.world.set(x, 199, z, B.stone);
    Object.assign(g.player, {
      x: 8.5,
      y: 200,
      z: 8.5,
      yaw: 0,
      pitch: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      fallStart: 200,
      onGround: true,
    });
    g.difficulty = "peaceful";
  }, B);
  return errors;
}
async function doubleW(page) {
  // One browser task keeps automation latency outside the seven-tick gesture.
  // The normal production event listeners and simulation handle every event.
  await page.evaluate(() => {
    for (const type of ["keydown", "keyup", "keydown"])
      window.dispatchEvent(
        new KeyboardEvent(type, { code: "KeyW", bubbles: true }),
      );
  });
  await page.waitForFunction(
    () =>
      dcsmcraft.player.sprinting &&
      Math.hypot(dcsmcraft.player.vx, dcsmcraft.player.vz) > 5.4,
  );
}
async function ticks(page, count = 8) {
  const start = await page.evaluate(() => dcsmcraft.tickCount);
  await page.waitForFunction(
    (end) => dcsmcraft.tickCount >= end,
    start + count,
  );
}

test("standalone double-W sprint persists through direction changes and stops on release; held-key repeat cannot start it", async ({
  page,
}) => {
  const errors = await create(page);
  await page.keyboard.down("KeyW");
  await page.waitForFunction(
    () => dcsmcraft.player.vz < -4 && !dcsmcraft.player.sprinting,
  );
  await page.keyboard.down("KeyW"); // Native repeat keydown, not a second tap.
  await ticks(page);
  expect(await page.evaluate(() => dcsmcraft.player.sprinting)).toBe(false);
  await page.keyboard.up("KeyW");
  await ticks(page);
  await doubleW(page);
  await ticks(page, 12);
  expect(await page.evaluate(() => dcsmcraft.player.sprinting)).toBe(true);
  await page.keyboard.down("KeyA");
  await page.keyboard.up("KeyW");
  await page.waitForFunction(
    () => dcsmcraft.player.sprinting && dcsmcraft.player.vx < -5.4,
  );
  await page.keyboard.up("KeyA");
  expect(
    await page.evaluate(() => ({
      sprint: dcsmcraft.player.sprinting,
      latch: dcsmcraft.sprintInput.latched,
    })),
  ).toEqual({ sprint: false, latch: false });
  await page.keyboard.down("KeyW");
  await page.waitForFunction(() => dcsmcraft.player.vz < -4);
  expect(await page.evaluate(() => dcsmcraft.player.sprinting)).toBe(false);
  await page.keyboard.up("KeyW");
  expect(errors).toEqual([]);
});

test("both physical Shift keys crouch and cancel sprint in the standalone game", async ({
  page,
}) => {
  const errors = await create(page);
  for (const shift of ["ShiftLeft", "ShiftRight"]) {
    await ticks(page);
    await doubleW(page);
    await page.keyboard.down(shift);
    await page.waitForFunction(
      () => dcsmcraft.player.crouching && !dcsmcraft.player.sprinting,
    );
    await ticks(page);
    expect(
      await page.evaluate(() =>
        Math.hypot(dcsmcraft.player.vx, dcsmcraft.player.vz),
      ),
    ).toBeLessThan(1.5);
    await page.keyboard.up(shift);
    await page.waitForFunction(
      () => !dcsmcraft.player.crouching && dcsmcraft.player.vz < -4,
    );
    expect(await page.evaluate(() => dcsmcraft.player.sprinting)).toBe(false);
    await page.keyboard.up("KeyW");
  }
  expect(errors).toEqual([]);
});

test("pause, inventory, focus loss and saved-world reload clear sprint and pending taps", async ({
  page,
}) => {
  const errors = await create(page);
  await doubleW(page);
  // Save while sprint is active: the input latch must not survive reloading.
  await page.evaluate(() => dcsmcraft.save());
  await page.keyboard.press("Escape");
  expect(
    await page.evaluate(
      () =>
        dcsmcraft.player.sprinting ||
        dcsmcraft.sprintInput.latched ||
        dcsmcraft.keys.size > 0,
    ),
  ).toBe(false);
  await page.getByRole("button", { name: "Back to Game", exact: true }).click();
  await page.waitForFunction(() => dcsmcraft.running);
  await page.keyboard.down("KeyW");
  await page.keyboard.press("KeyE");
  await expect(page.locator(".inventory-window")).toBeVisible();
  expect(
    await page.evaluate(
      () => dcsmcraft.sprintInput.lastForwardTick === -Infinity,
    ),
  ).toBe(true);
  await page.keyboard.up("KeyW");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => dcsmcraft.running);
  await page.keyboard.down("KeyW");
  await ticks(page);
  expect(await page.evaluate(() => dcsmcraft.player.sprinting)).toBe(false);
  await page.keyboard.up("KeyW");
  await ticks(page);
  await doubleW(page);
  await page.evaluate(() => window.dispatchEvent(new Event("blur")));
  await expect(page.locator(".pause-dialog")).toBeVisible();
  expect(
    await page.evaluate(
      () => dcsmcraft.player.sprinting || dcsmcraft.sprintInput.latched,
    ),
  ).toBe(false);
  await page.reload();
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.locator("[data-action=load]").first().click();
  await page.waitForFunction(() => dcsmcraft.running);
  expect(
    await page.evaluate(
      () =>
        dcsmcraft.player.sprinting ||
        dcsmcraft.sprintInput.latched ||
        dcsmcraft.keys.size > 0,
    ),
  ).toBe(false);
  expect(errors).toEqual([]);
});
