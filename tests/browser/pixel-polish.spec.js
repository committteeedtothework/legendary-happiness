import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import { B, ITEMS, makeStack } from "../../src/data.js";
import { actionPose } from "../../src/animation.js";
const html = readFileSync("dist/DCSMCRAFT-Standalone.html", "utf8");
const captures = "/workspace/artifacts/pixel-polish-playtest";
mkdirSync(captures, { recursive: true });
async function boot(page) {
  const errors = [],
    external = [];
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
          texturePack: "renewed",
          renderDistance: 2,
          graphics: 2,
          volume: 0,
          ambientVolume: 0,
          musicEnabled: false,
          distantTerrain: false,
          frameLimit: 30,
        }),
      );
  });
  await page.route("**/*", (r) =>
    r.request().url().endsWith("/pixel.html")
      ? r.fulfill({ contentType: "text/html", body: html })
      : (external.push(r.request().url()), r.abort()),
  );
  await page.goto("/pixel.html");
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  return { errors, external };
}
async function create(page) {
  await page.locator("[data-action=create]").first().click();
  await page.locator("[name=name]").fill("Pixel & Grip test");
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
      onGround: true,
      flying: false,
      vx: 0,
      vy: 0,
      vz: 0,
      fallStart: 200,
    });
    g.time = 6000;
    g.inventory.slots.fill(null);
    g.inventory.selected = 0;
    g.renderer.setHeld(null);
    g.ui.play();
    g.running = false;
    g.pointerLockFallback = true;
    g.renderer.loadAround(0.5, 6.5, 2, 9);
  }, B);
  await page.waitForFunction(() => dcsmcraft.renderer.meshes.size >= 9);
}
async function shot(page, name) {
  await page.evaluate(() => {
    for (const id of ["toast", "cycle-banner"])
      document.querySelector("#" + id)?.classList.remove("show");
  });
  await page.screenshot({ path: captures + "/" + name + ".png" });
  expect(
    await page.evaluate(() => dcsmcraft.renderer.gl.getContext().getError()),
  ).toBe(0);
}

test("self-contained pixel menus navigate, sliders and toggles work by keyboard and persist, and narrow layouts fit", async ({
  page,
}) => {
  const result = await boot(page);
  await shot(page, "title-final");
  await page.locator("[data-action=settings]").click();
  expect(
    await page
      .locator(".options-sliders")
      .evaluate(
        (e) => getComputedStyle(e).gridTemplateColumns.split(" ").length,
      ),
  ).toBe(2);
  const fov = page.locator("[data-setting=FOV]");
  await fov.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("[data-value=FOV]")).toHaveText("76°");
  await page.keyboard.press("Tab");
  await expect(page.locator("[data-setting=volume]")).toBeFocused();
  await shot(page, "options-final");
  await page.locator("[data-action=video-settings]").click();
  const ao = page.locator("[data-graphics=ambientOcclusion]");
  await ao.focus();
  await page.keyboard.press("Tab");
  await expect(page.locator("[data-graphics=shadows]")).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Space");
  await expect(
    page.locator("[data-graphics=ambientOcclusion]"),
  ).toHaveAttribute("aria-pressed", "false");
  await page.locator("[data-preference=particles]").selectOption("decreased");
  await page.locator("[data-preference=texturePack]").selectOption("classic");
  await page.locator("[data-preference=texturePack]").selectOption("renewed");
  await shot(page, "video-final");
  await page.setViewportSize({ width: 640, height: 720 });
  await expect(page.locator(".video-group").first()).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.locator(".video-dialog [data-action=back]").last().click();
  expect(
    await page
      .locator(".options-sliders")
      .evaluate(
        (e) => getComputedStyle(e).gridTemplateColumns.split(" ").length,
      ),
  ).toBe(1);
  await page.locator("[data-action=back]").last().click();
  await page.locator("[data-action=create]").first().click();
  await page.locator("[name=mode][value=creative]").check();
  await expect(page.locator("[name=mode][value=creative]")).toBeChecked();
  await shot(page, "create-narrow");
  await page.reload();
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  expect(
    await page.evaluate(() => ({
      FOV: dcsmcraft.settings.FOV,
      ao: dcsmcraft.settings.ambientOcclusion,
      particles: dcsmcraft.settings.particles,
    })),
  ).toEqual({ FOV: 76, ao: false, particles: "decreased" });
  expect(result.errors).toEqual([]);
  expect(result.external).toEqual([]);
});

test("recipe sidebar, crafting, slot transfers and furnace indicators remain functional with new inventory chrome", async ({
  page,
}) => {
  const result = await boot(page);
  await create(page);
  await page.evaluate(() => {
    dcsmcraft.inventory.slots[0] = { id: "log", count: 2 };
    dcsmcraft.openInventory("table");
  });
  await page.locator("#recipe-search").fill("Oak planks");
  await page.locator(".recipe-card:visible").first().click();
  await expect(page.locator(".output-slot img")).toBeVisible();
  await page.locator("[data-action=craft]").click();
  await page.locator('[data-ref=inventory][data-index="1"]').click();
  expect(await page.evaluate(() => dcsmcraft.inventory.slots[1]?.id)).toBe(
    "planks",
  );
  expect(await page.evaluate(() => dcsmcraft.inventory.slots[1]?.count)).toBe(
    4,
  );
  await shot(page, "workbench-final");
  await page.locator("[data-action=close-inv]").click();
  await page.keyboard.press("KeyE");
  await expect(page.locator(".creative-catalog")).toBeVisible();
  await page.locator("#creative-search").fill("diamond");
  await expect(page.locator(".creative-slot:visible").first()).toBeVisible();
  await shot(page, "catalog-final");
  await page.locator("[data-action=creative-tab][data-tab=inventory]").click();
  await expect(page.locator(".recipe-book")).toBeVisible();
  await page.locator("[data-action=close-inv]").click();
  await page.evaluate(() =>
    dcsmcraft.openInventory("furnace", {
      slots: [{ id: "raw_iron", count: 1 }, { id: "coal", count: 1 }, null],
      progress: 100,
      burn: 50,
    }),
  );
  await expect(page.locator("#furnace-flame")).toHaveClass(/burning/);
  expect(
    await page
      .locator("#furnace-flame")
      .evaluate((e) => getComputedStyle(e).fontSize),
  ).toBe("0px");
  await shot(page, "furnace-final");
  await page.locator("[data-action=close-inv]").click();
  await page.keyboard.press("Escape");
  await expect(page.locator(".pause-dialog")).toBeVisible();
  await shot(page, "pause-final");
  await page.locator("[data-action=settings]").click();
  await page.locator("[data-action=resume]").click();
  await expect(page.locator("#overlay")).not.toHaveClass("visible");
  await page.evaluate(async () => {
    const g = dcsmcraft;
    g.pause();
    g.world.set(16, 199, 0, 3);
    await g.save();
  });
  await page.reload();
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.locator("[data-action=load]").first().click();
  await page.waitForFunction(() => dcsmcraft.running);
  expect(
    await page.evaluate(() => ({
      item: dcsmcraft.inventory.slots[1]?.id,
      count: dcsmcraft.inventory.slots[1]?.count,
      edit: dcsmcraft.world.get(16, 199, 0),
    })),
  ).toEqual({ item: "planks", count: 4, edit: 3 });
  expect(result.errors).toEqual([]);
  expect(result.external).toEqual([]);
});

test("connected first-person arms render every swing family, preserve combat, flat art, drops, F5 and independent pistols", async ({
  page,
}) => {
  test.setTimeout(180000);
  const result = await boot(page);
  await create(page);
  // Sweep production poses deterministically so every stage, rather than one
  // lucky screenshot frame, checks the actual view-model rendered offline.
  for (const id of [
    "diamond_sword",
    "diamond_axe",
    "diamond_pickaxe",
    "diamond_shovel",
    "diamond_hoe",
    "diamond_spear",
    "devin_sword",
    "flint_and_steel",
    "planks",
    "apple",
    "matthew_dual_pistols",
  ]) {
    const tool = ITEMS[id].tool;
    const poses = Array.from({ length: 21 }, (_, i) =>
      actionPose(
        tool === "pistols"
          ? "fire"
          : tool
            ? "attack"
            : id === "apple"
              ? "eat"
              : "use",
        i / 20,
        tool,
      ),
    );
    const maxError = await page.evaluate(
      ({ id, poses }) => {
        const g = dcsmcraft,
          r = g.renderer;
        g.inventory.slots[0] = { id, count: 1 };
        r.setHeld(id);
        r.animator.equip = 0;
        let error = 0;
        for (const pose of poses) {
          r.animator.step = () => pose;
          r.draw({
            player: g.player,
            equipment: g.inventory.equipment,
            playing: true,
            cameraMode: 0,
            time: g.time,
            elapsed: r.lastTime + 0.02,
            animating: false,
          });
          for (const rig of [r.handRig, r.leftHandRig].filter(
            (x) => x.root.visible,
          )) {
            rig.root.updateMatrixWorld(true);
            const v = rig.arm.hand.clone(),
              hand = rig.wrist.localToWorld(v.set(0, -0.04, 0.025));
            const top = rig.forearm.localToWorld(v.clone().set(0, -0.5, 0));
            error = Math.max(error, hand.distanceTo(top));
            if (!rig.root.matrixWorld.elements.every(Number.isFinite))
              error = 999;
          }
        }
        const pose = poses[7];
        r.animator.step = () => pose;
        return error;
      },
      { id, poses },
    );
    expect(maxError).toBeLessThan(0.03);
    await shot(page, id + "-swing-final");
  }
  // Real click damage still uses the authoritative melee path.
  await page.evaluate((stack) => {
    const g = dcsmcraft;
    g.renderer.animator.step = Object.getPrototypeOf(
      g.renderer.animator,
    ).step.bind(g.renderer.animator);
    g.inventory.slots[0] = stack;
    g.renderer.setHeld(stack.id, stack);
    g.renderer.animator.equip = 0;
    g.mode = "survival";
    g.player.attackCooldown = 1;
    g.player.yaw = 0;
    g.player.pitch = 0;
    g.entities = [
      {
        id: "swing-target",
        type: "zombie",
        x: 0.5,
        y: 200,
        z: 4.5,
        hp: 40,
        vx: 0,
        vy: 0,
        vz: 0,
        yaw: 0,
        turn: 0,
        dir: 0,
        age: 100,
        attack: 0,
        hurt: 0,
        onGround: true,
      },
    ];
  }, makeStack("diamond_sword"));
  await page.mouse.click(640, 400);
  expect(await page.evaluate(() => dcsmcraft.entities[0].hp)).toBeLessThan(40);
  await page.keyboard.press("F5");
  await page.waitForFunction(() => dcsmcraft.renderer.playerModel?.visible);
  expect(
    await page.evaluate(() => {
      const u = dcsmcraft.renderer.playerModel.userData;
      return u.grip.parent === u.forearms[1];
    }),
  ).toBe(true);
  await shot(page, "f5-final");
  await page.keyboard.press("F5");
  await page.keyboard.press("F5");
  await page.evaluate((stack) => {
    const g = dcsmcraft;
    g.entities = [];
    g.inventory.slots[0] = stack;
    g.renderer.setHeld(stack.id, stack);
    g.renderer.animator.equip = 0;
  }, makeStack("flint_and_steel"));
  const alpha = await page.evaluate(() => {
    const m = dcsmcraft.renderer.heldMesh.children[0],
      c = m.material.map.image;
    return {
      type: m.geometry.type,
      opaque: Array.from(
        c.getContext("2d").getImageData(0, 0, 32, 32).data,
      ).filter((v, i) => i % 4 === 3 && v > 0).length,
    };
  });
  expect(alpha.type).toBe("PlaneGeometry");
  expect(alpha.opaque).toBeLessThan(450);
  expect(alpha.opaque).toBeGreaterThan(80);
  await page.keyboard.press("KeyQ");
  await page.waitForFunction(() =>
    dcsmcraft.drops.some((d) => d.id === "flint_and_steel"),
  );
  await page.waitForFunction(() =>
    [...dcsmcraft.renderer.dropMeshes.values()].some(
      (m) => m.userData.flatCutout,
    ),
  );
  await shot(page, "flat-item-final");
  expect(result.errors).toEqual([]);
  expect(result.external).toEqual([]);
});
