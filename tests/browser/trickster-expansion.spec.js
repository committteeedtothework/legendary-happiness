import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { B } from "../../src/data.js";
const html = readFileSync("dist/DCSMCRAFT-Standalone.html", "utf8");
async function create(page) {
  const errors = [];
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
        particles: "all",
        fancyGraphics: true,
        ambientSounds: false,
        musicEnabled: false,
        volume: 0,
        skin: "dante",
      }),
    ),
  );
  await page.route("**/*", (r) =>
    r.request().url().endsWith("/trickster.html")
      ? r.fulfill({ contentType: "text/html", body: html })
      : r.abort(),
  );
  await page.goto("/trickster.html");
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.locator("[data-action=create]").first().click();
  await page.locator("[name=seed]").fill("Wildflower");
  await page.locator("[name=mode][value=creative]").check();
  await page.locator("[data-action=start-world]").click();
  await page.waitForFunction(() => dcsmcraft.running);
  await page.evaluate((B) => {
    const g = dcsmcraft;
    g.pause();
    g.entities = [];
    g.drops = [];
    for (let x = -10; x <= 24; x++)
      for (let z = -22; z <= 24; z++) g.world.set(x, 199, z, B.stone);
    Object.assign(g.player, {
      x: 0.5,
      y: 200,
      z: 12.5,
      yaw: 0,
      pitch: 0,
      onGround: true,
      flying: false,
      vx: 0,
      vy: 0,
      vz: 0,
      fallStart: 200,
      health: 20,
    });
    g.inventory.slots[0] = { id: "matthew_dual_pistols", count: 1 };
    g.inventory.selected = 0;
    g.ui.play();
    g.running = true;
    g.pointerLockFallback = true;
    g.ui.root.querySelector("#cycle-banner")?.classList.remove("show");
  }, B);
  await page.waitForFunction(() => dcsmcraft.renderer.meshes.size >= 9);
  return errors;
}
async function reset(page, extra = {}) {
  await page.evaluate((extra) => {
    const g = dcsmcraft;
    Object.assign(g.player, {
      x: 0.5,
      y: 200,
      z: 12.5,
      yaw: 0,
      pitch: 0,
      onGround: true,
      flying: false,
      vx: 0,
      vy: 0,
      vz: 0,
      fallStart: 200,
      tricksterBlinkTick: 0,
      tricksterRecharges: [],
      ...extra,
    });
    delete g.player.tricksterDash;
    g.ui.play();
    g.running = true;
    g.pointerLockFallback = true;
    g.renderer.tricksterVisual.clear();
  }, extra);
  await page.waitForTimeout(100);
}
async function healthy(page, errors) {
  expect(
    await page.evaluate(() => dcsmcraft.renderer.gl.getContext().getError()),
  ).toBe(0);
  expect(errors).toEqual([]);
}
test("standalone R free-blinks without hostiles, approaches a villager harmlessly, stops at a wall, and preserves cooldown on reload", async ({
  page,
}) => {
  const errors = await create(page);
  await page.keyboard.press("KeyR");
  await expect
    .poll(() => page.evaluate(() => dcsmcraft.player.z))
    .toBeLessThan(-5);
  expect(
    await page.evaluate(
      () => dcsmcraft.player.tricksterBlinkTick > dcsmcraft.tickCount,
    ),
  ).toBe(true);
  expect(
    await page.evaluate(() => dcsmcraft.player.tricksterRecharges.length),
  ).toBe(1);
  await page.evaluate(() => {
    dcsmcraft.pause();
    dcsmcraft.ui.play();
  });
  await page.screenshot({
    path: "/workspace/artifacts/DCSMCRAFT-v1.3.3-free-blink.png",
  });
  await reset(page);
  await page.evaluate(() => {
    dcsmcraft.entities = [
      {
        id: "blink-villager",
        type: "villager",
        x: 0.5,
        y: 200,
        z: 2.5,
        hp: 20,
        age: 0,
        onGround: true,
        vx: 0,
        vy: 0,
        vz: 0,
        dir: 0,
        turn: 99999,
        speed: 0,
      },
    ];
    dcsmcraft.player.pitch = Math.atan2(201 - 201.62, 10);
  });
  await page.keyboard.press("KeyR");
  await expect
    .poll(() => page.evaluate(() => dcsmcraft.player.z))
    .toBeLessThan(5);
  expect(
    await page.evaluate(
      () => dcsmcraft.entities.find((e) => e.id === "blink-villager").hp,
    ),
  ).toBe(20);
  await page.evaluate(() => (dcsmcraft.entities = []));
  await reset(page, { x: 14.5, z: 0.5, yaw: -Math.PI / 2 });
  await page.evaluate((B) => {
    for (let y = 200; y < 203; y++) dcsmcraft.world.set(16, y, 0, B.stone);
  }, B);
  await page.keyboard.press("KeyR");
  await expect
    .poll(() => page.evaluate(() => dcsmcraft.player.x))
    .toBeGreaterThan(15);
  expect(await page.evaluate(() => dcsmcraft.player.x)).toBeLessThan(15.71);
  const saved = await page.evaluate(async () => {
    const g = dcsmcraft;
    g.pause();
    await g.save();
    return { id: g.id, ready: g.player.tricksterBlinkTick };
  });
  await page.reload();
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.locator(`[data-action=load][data-id="${saved.id}"]`).click();
  await page.waitForFunction(() => dcsmcraft.active);
  expect(await page.evaluate(() => dcsmcraft.player.tricksterBlinkTick)).toBe(
    saved.ready,
  );
  await healthy(page, errors);
});
test("standalone weapon move guides sit above the hotbar in both modes, keep targeting separate, and fit a narrow viewport", async ({
  page,
}) => {
  const errors = await create(page);
  await expect(page.locator("#weapon-moves")).toContainText("R Air Trick");
  const inspect = () =>
    page.evaluate(() => {
      const box = (id) => {
        const r = document.getElementById(id).getBoundingClientRect();
        return { top: r.top, bottom: r.bottom, left: r.left, right: r.right };
      };
      return {
        guide: box("weapon-moves"),
        bar: box("hotbar"),
        center: innerHeight / 2,
        target: document.getElementById("target-label").textContent,
        width: innerWidth,
      };
    });
  let bounds = await inspect();
  expect(bounds.guide.bottom).toBeLessThan(bounds.bar.top);
  expect(bounds.guide.top).toBeGreaterThan(bounds.center + 80);
  expect(bounds.target).not.toMatch(/Air Trick|RMB Dash/);
  await page.evaluate(() => {
    dcsmcraft.mode = "survival";
    dcsmcraft.ui.lastHUD = null;
    dcsmcraft.ui.updateHUD();
    dcsmcraft.ui.toast("DASH");
  });
  bounds = await inspect();
  expect(bounds.guide.bottom).toBeLessThan(bounds.bar.top);
  const toast = await page.locator("#toast").boundingBox();
  expect(toast.y + toast.height).toBeLessThan(bounds.guide.top);
  await page.evaluate(() => {
    dcsmcraft.inventory.slots[0] = { id: "devin_sword", count: 1 };
    dcsmcraft.player.devinReadyTick = dcsmcraft.tickCount + 40;
  });
  await expect(page.locator("#weapon-moves")).toContainText("R Seeker");
  await expect(page.locator("#weapon-moves")).toContainText("RMB Pulse");
  expect((await inspect()).target).not.toMatch(/Seeker|Pulse/);
  await page.screenshot({
    path: "/workspace/artifacts/DCSMCRAFT-v1.3.3-sword-hotbar-guide.png",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(
    () =>
      (dcsmcraft.inventory.slots[0] = { id: "matthew_dual_pistols", count: 1 }),
  );
  await expect(page.locator("#weapon-moves")).toContainText("R Air Trick");
  bounds = await inspect();
  expect(bounds.guide.left).toBeGreaterThanOrEqual(0);
  expect(bounds.guide.right).toBeLessThanOrEqual(bounds.width);
  expect(bounds.guide.bottom).toBeLessThan(bounds.bar.top);
  await page.evaluate(
    () => (dcsmcraft.inventory.slots[0] = { id: "stone", count: 64 }),
  );
  await expect(page.locator("#weapon-moves")).toBeHidden();
  await healthy(page, errors);
});
test("standalone dash renders pooled wakes, echoes and first-person speed lines, respects toggles, and clears after finishing", async ({
  page,
}) => {
  const errors = await create(page);
  await page.keyboard.press("F5");
  await page.mouse.click(640, 400, { button: "right" });
  await page.waitForFunction(
    () =>
      dcsmcraft.renderer.tricksterVisual.echoes.count > 0 &&
      dcsmcraft.renderer.tricksterVisual.lines.geometry.drawRange.count > 0,
  );
  await page.evaluate(() => {
    dcsmcraft.pause();
    dcsmcraft.ui.play();
  });
  await page.screenshot({
    path: "/workspace/artifacts/DCSMCRAFT-v1.3.3-dash-f5.png",
  });
  const budget = await page.evaluate(() => {
    const v = dcsmcraft.renderer.tricksterVisual;
    return {
      meshes: v.root.children.length,
      rings: v.sigils.count,
      ghosts: v.echoes.count,
      segments: v.streaks.length,
    };
  });
  expect(budget.meshes).toBe(3);
  expect(budget.rings).toBeLessThanOrEqual(12);
  expect(budget.ghosts).toBeLessThanOrEqual(12);
  expect(budget.segments).toBeLessThanOrEqual(96);
  await reset(page);
  await page.keyboard.press("F5");
  await page.keyboard.press("F5");
  await page.mouse.click(640, 400, { button: "right" });
  await page.waitForFunction(
    () => dcsmcraft.renderer.tricksterVisual.lines.geometry.drawRange.count > 0,
  );
  await page.evaluate(() => {
    dcsmcraft.pause();
    dcsmcraft.ui.play();
  });
  await page.screenshot({
    path: "/workspace/artifacts/DCSMCRAFT-v1.3.3-dash-first-person.png",
  });
  await page.evaluate(() => {
    dcsmcraft.ui.play();
    dcsmcraft.running = true;
    dcsmcraft.pointerLockFallback = true;
  });
  await page.waitForTimeout(650);
  expect(
    await page.evaluate(() => dcsmcraft.renderer.tricksterVisual.root.visible),
  ).toBe(false);
  await page.evaluate(() => {
    dcsmcraft.settings.particles = "minimal";
    dcsmcraft.settings.dynamicFOV = false;
  });
  await reset(page);
  await page.mouse.click(640, 400, { button: "right" });
  await page.waitForTimeout(120);
  expect(
    await page.evaluate(() => dcsmcraft.renderer.tricksterVisual.root.visible),
  ).toBe(false);
  await page.waitForTimeout(600);
  expect(
    await page.evaluate(() =>
      Math.abs(dcsmcraft.renderer.camera.fov - dcsmcraft.settings.FOV),
    ),
  ).toBeLessThan(0.1);
  await healthy(page, errors);
});
