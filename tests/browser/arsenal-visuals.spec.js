import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { B } from "../../src/data.js";
const html = readFileSync("dist/DCSMCRAFT-Standalone.html", "utf8");
async function boot(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (/Shader Error|GL_INVALID|WebGLProgram/.test(m.text()))
      errors.push(m.text());
  });
  await page.addInitScript(() => {
    if (!localStorage.getItem("dcsmcraft-settings"))
      localStorage.setItem(
        "dcsmcraft-settings",
        JSON.stringify({
          renderDistance: 2,
          graphics: 1,
          ambientVolume: 0,
          musicEnabled: false,
          particles: "all",
        }),
      );
  });
  await page.route("**/*", (r) =>
    r.request().url().endsWith("/arsenal.html")
      ? r.fulfill({ contentType: "text/html", body: html })
      : r.abort(),
  );
  await page.goto("/arsenal.html");
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  return errors;
}
async function create(page) {
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
    for (let x = -8; x < 9; x++)
      for (let z = -12; z < 14; z++) g.world.set(x, 199, z, B.stone);
    Object.assign(g.player, {
      x: 0.5,
      y: 200,
      z: 6.5,
      yaw: 0,
      pitch: 0,
      flying: false,
      onGround: true,
      vx: 0,
      vy: 0,
      vz: 0,
      fallStart: 200,
    });
    g.inventory.slots[0] = { id: "matthew_dual_pistols", count: 1 };
    g.inventory.selected = 0;
    g.renderer.setHeld("matthew_dual_pistols");
    g.renderer.animator.equip = 0;
    g.ui.play();
    g.running = true;
    g.pointerLockFallback = true;
  }, B);
  await page.waitForFunction(() => dcsmcraft.renderer.meshes.size >= 9);
  await page.waitForTimeout(400);
}
test("standalone Dante wardrobe persists and renders an articulated coat with both F5 pistols", async ({
  page,
}) => {
  const errors = await boot(page);
  await page.locator("[data-action=skins]").click();
  await expect(page.locator(".skin-card")).toHaveCount(11);
  await expect(page.locator(".skin-dialog .fine")).toContainText("11 outfits");
  await page.locator("[data-skin=dante]").click();
  await expect(page.locator("[data-skin=dante]")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.locator("[data-skin=dante]").scrollIntoViewIfNeeded();
  await page.screenshot({
    path: "/workspace/artifacts/DCSMCRAFT-v1.3.1-dante-wardrobe.png",
  });
  await page.reload();
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  expect(await page.evaluate(() => dcsmcraft.settings.skin)).toBe("dante");
  await create(page);
  await page.keyboard.press("F5");
  await page.keyboard.press("F5");
  await page.waitForFunction(
    () => dcsmcraft.renderer.playerModel?.userData.skin === "dante",
  );
  expect(
    await page.evaluate(() => {
      const u = dcsmcraft.renderer.playerModel.userData;
      return {
        coat: u.coat.length,
        right: u.grip.children[0].userData.finish,
        left: u.leftGrip.children[0].userData.finish,
        gloves: dcsmcraft.renderer.handRig.glove.userData.texturedGlove,
      };
    }),
  ).toEqual({ coat: 2, right: "silver", left: "black", gloves: true });
  await page.keyboard.down("w");
  await page.waitForTimeout(450);
  await page.keyboard.up("w");
  expect(
    await page.evaluate(() =>
      dcsmcraft.renderer.playerModel.userData.coat.every(
        (t) => t.rotation.x < 0,
      ),
    ),
  ).toBe(true);
  await page.evaluate(() => {
    dcsmcraft.pause();
    dcsmcraft.ui.play();
    dcsmcraft.player.pitch = -0.05;
  });
  await page.waitForTimeout(200);
  await page.screenshot({
    path: "/workspace/artifacts/DCSMCRAFT-v1.3.1-dante-f5.png",
  });
  expect(
    await page.evaluate(() => dcsmcraft.renderer.gl.getContext().getError()),
  ).toBe(0);
  expect(errors).toEqual([]);
});
test("standalone pistols keep their palm sockets through independent slide recoil, F5, particles and item swaps", async ({
  page,
}) => {
  const errors = await boot(page);
  await create(page);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => dcsmcraft.player.matthewHand)).toBe(1);
  await page.mouse.click(640, 400);
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => dcsmcraft.player.matthewHand)).toBe(0);
  await page.evaluate(() => {
    const g = dcsmcraft;
    g.pause();
    g.ui.play();
    g.player.matthewHand = 1;
    g.renderer.pistolKick = 0.162;
  });
  await page.waitForTimeout(200);
  expect(
    await page.evaluate(() => {
      const r = dcsmcraft.renderer;
      return {
        slide: r.heldMesh.userData.slide.position.z,
        left: r.leftPistol.userData.slide.position.z,
        flash: r.heldMesh.userData.flash.visible,
        grip: r.heldMesh.parent === r.handRig.grip,
      };
    }),
  ).toEqual({ slide: expect.any(Number), left: 0, flash: true, grip: true });
  expect(
    await page.evaluate(
      () => dcsmcraft.renderer.heldMesh.userData.slide.position.z,
    ),
  ).toBeGreaterThan(0.045);
  await page.screenshot({
    path: "/workspace/artifacts/DCSMCRAFT-v1.3.1-pistol-recoil.png",
  });
  await page.evaluate(() => {
    dcsmcraft.cameraMode = 2;
  });
  await page.waitForTimeout(200);
  expect(
    await page.evaluate(
      () =>
        dcsmcraft.renderer.playerModel.userData.grip.children[0].userData.slide
          .position.z,
    ),
  ).toBeGreaterThan(0.045);
  expect(
    await page.evaluate(
      () =>
        dcsmcraft.renderer.playerModel.userData.leftGrip.children[0].userData
          .slide.position.z,
    ),
  ).toBe(0);
  await page.evaluate(() => {
    dcsmcraft.settings.particles = "minimal";
  });
  await page.waitForTimeout(200);
  expect(
    await page.evaluate(
      () =>
        dcsmcraft.renderer.playerModel.userData.grip.children[0].userData.flash
          .visible,
    ),
  ).toBe(false);
  await page.evaluate(() => {
    const g = dcsmcraft;
    g.cameraMode = 0;
    g.settings.particles = "all";
    g.renderer.pistolKick = 0;
    g.inventory.slots[0] = { id: "stone", count: 64 };
  });
  await page.waitForTimeout(200);
  expect(
    await page.evaluate(() => dcsmcraft.renderer.leftHandRig.root.visible),
  ).toBe(false);
  await page.evaluate(() => {
    dcsmcraft.inventory.slots[0] = { id: "matthew_dual_pistols", count: 1 };
  });
  await page.waitForTimeout(200);
  expect(
    await page.evaluate(
      () => dcsmcraft.renderer.heldMesh.userData.slide.position.z,
    ),
  ).toBe(0);
  await page.evaluate(() => {
    dcsmcraft.renderer.animator.equip = 0;
  });
  await page.waitForTimeout(200);
  await page.screenshot({
    path: "/workspace/artifacts/DCSMCRAFT-v1.3.1-pistols-first-person.png",
  });
  expect(
    await page.evaluate(() => dcsmcraft.renderer.gl.getContext().getError()),
  ).toBe(0);
  expect(errors).toEqual([]);
});
