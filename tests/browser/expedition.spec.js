import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { B } from "../../src/data.js";
let html;
test.beforeAll(() => {
  execFileSync(process.execPath, [
    "scripts/build-standalone.mjs",
    "/tmp/dcsmcraft-expedition-tested.html",
  ]);
  html = readFileSync("/tmp/dcsmcraft-expedition-tested.html", "utf8");
});
async function launch(page, standalone = true) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (/Shader Error|WebGLProgram|GL_INVALID|texSubImage/.test(m.text()))
      errors.push(m.text());
  });
  await page.addInitScript(() => {
    if (!localStorage.getItem("dcsmcraft-settings"))
      localStorage.setItem(
        "dcsmcraft-settings",
        JSON.stringify({ renderDistance: 2, graphics: 2 }),
      );
  });
  if (standalone)
    await page.route("**/*", (r) =>
      r.request().url().endsWith("/expedition.html")
        ? r.fulfill({ contentType: "text/html", body: html })
        : r.abort(),
    );
  await page.goto(standalone ? "/expedition.html" : "/");
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  return errors;
}
async function world(page) {
  await page.locator("[data-action=create]").first().click();
  await page.locator("[name=seed]").fill("Wildflower");
  await page.locator("[name=mode][value=creative]").check();
  await page.locator("[data-action=start-world]").click();
  await page.waitForFunction(() => dcsmcraft.running);
  await page.evaluate(() => {
    dcsmcraft.pause();
    dcsmcraft.ui.play();
    dcsmcraft.pointerLockFallback = true;
  });
}
async function stage(page) {
  await page.evaluate((B) => {
    const g = dcsmcraft;
    g.entities = [];
    for (let x = -7; x <= 7; x++)
      for (let z = -7; z <= 7; z++) g.world.set(x, 199, z, B.grass);
    Object.assign(g.player, {
      x: 0.5,
      y: 200,
      z: 0.5,
      yaw: 0,
      pitch: 0,
      flying: true,
      onGround: true,
      vx: 0,
      vy: 0,
      vz: 0,
    });
    g.inventory.slots[0] = { id: "devin_sword", count: 1 };
    g.inventory.selected = 0;
    g.ui.play();
    g.pointerLockFallback = true;
    g.running = true;
    g.ui.root.querySelector("#cycle-banner").classList.remove("show");
  }, B);
}
test("standalone wardrobe buttons select all skins, persist locally and F5 cycles real animated views", async ({
  page,
}) => {
  const errors = await launch(page);
  await page.getByRole("button", { name: "Skins", exact: true }).click();
  await expect(page.locator(".skin-card")).toHaveCount(11);
  for (const skin of ["explorer", "clown", "hero", "criminal"]) {
    await page.locator(`[data-skin=${skin}]`).click();
    await expect(page.locator(`[data-skin=${skin}]`)).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  }
  await page.screenshot({
    path: "/workspace/artifacts/DCSMCRAFT-v1.0.0-skins.png",
  });
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.reload();
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  expect(await page.evaluate(() => dcsmcraft.settings.skin)).toBe("criminal");
  await world(page);
  await stage(page);
  await page.keyboard.press("F5");
  await expect
    .poll(() => page.evaluate(() => dcsmcraft.renderer.playerModel?.visible))
    .toBe(true);
  expect(
    await page.evaluate(() => ({
      mode: dcsmcraft.cameraMode,
      z: dcsmcraft.renderer.camera.position.z,
      skin: dcsmcraft.renderer.playerModel.userData.skin,
    })),
  ).toMatchObject({ mode: 1, skin: "criminal", z: 4.5 });
  await page.keyboard.press("F5");
  await expect
    .poll(() => page.evaluate(() => dcsmcraft.renderer.camera.position.z))
    .toBe(-3.5);
  const rig = await page.evaluate(() => {
    const g = dcsmcraft,
      r = g.renderer,
      m = r.playerModel,
      u = m.userData;
    const start = u.arms[1].rotation.x;
    r.action("attack");
    return {
      skin: u.skin,
      limbs: u.arms.length + u.legs.length,
      held: u.grip.children[0].userData.kind,
      head: u.head.children.length,
      start,
    };
  });
  expect(rig).toMatchObject({ skin: "criminal", limbs: 4, held: "sword" });
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          Math.abs(dcsmcraft.renderer.playerModel.userData.arms[1].rotation.x),
        ),
      { intervals: [20, 30, 50, 80] },
    )
    .toBeGreaterThan(0.05);
  for (const skin of ["explorer", "clown", "hero", "criminal"]) {
    await page.evaluate((skin) => {
      dcsmcraft.settings.skin = skin;
      dcsmcraft.ui.saveSettings();
    }, skin);
    await expect
      .poll(() =>
        page.evaluate(() => dcsmcraft.renderer.playerModel.userData.skin),
      )
      .toBe(skin);
    await page.waitForTimeout(300);
    await page.screenshot({
      path: `/workspace/artifacts/DCSMCRAFT-v1.0.0-player-${skin}.png`,
    });
  }
  await page.keyboard.press("F5");
  await expect.poll(() => page.evaluate(() => dcsmcraft.cameraMode)).toBe(0);
  expect(
    await page.evaluate(() => dcsmcraft.renderer.playerModel.visible),
  ).toBe(false);
  expect(errors).toEqual([]);
});
test("F3 displays exact sword base, signed deltas and compass consistent with the rendered camera", async ({
  page,
}) => {
  const errors = await launch(page);
  await world(page);
  const s = await page.evaluate(() => {
    const g = dcsmcraft,
      s = g.world.relicPlan;
    g.pause();
    Object.assign(g.player, {
      x: s.x + 0.5,
      y: s.y,
      z: s.z + 10.5,
      yaw: 0,
      pitch: 0,
      flying: true,
    });
    g.ui.play();
    return s;
  });
  await page.keyboard.press("F3");
  await expect(page.locator("#hud-debug")).toBeVisible();
  const text = await page.locator("#hud-debug").textContent();
  expect(text).toContain(`Site X ${s.x}  Y ${s.y}  Z ${s.z}`);
  expect(text).toContain("Travel ΔX +0.0  ΔY +0.0  ΔZ -10.0");
  expect(text).toContain("Facing North");
  expect(text).toContain("Straight ahead · 10.0 blocks");
  await page.evaluate(() => {
    dcsmcraft.player.yaw = -Math.PI / 2;
  });
  await expect(page.locator("#hud-debug")).toContainText("Facing East");
  await expect(page.locator("#hud-debug")).toContainText("Turn left 90°");
  const look = await page.evaluate(() => {
    const r = dcsmcraft.renderer;
    const v = r.camera.position.clone();
    r.camera.getWorldDirection(v);
    return v.toArray();
  });
  expect(look[0]).toBeCloseTo(1, 5);
  expect(look[2]).toBeCloseTo(0, 5);
  await page.screenshot({
    path: "/workspace/artifacts/DCSMCRAFT-v1.0.0-F3.png",
  });
  expect(errors).toEqual([]);
});
test("F5 camera respects walls beyond non-solid plants and armor follows the player rig", async ({
  page,
}) => {
  const errors = await launch(page);
  await world(page);
  await stage(page);
  await page.evaluate((B) => {
    const g = dcsmcraft;
    g.world.set(0, 201, 1, B.fern);
    for (let x = -1; x <= 1; x++)
      for (let y = 200; y < 204; y++) g.world.set(x, y, 2, B.stone);
    g.inventory.equipment = [
      { id: "dirt_helmet", count: 1 },
      { id: "iron_chestplate", count: 1 },
      { id: "diamond_leggings", count: 1 },
      { id: "leather_boots", count: 1 },
    ];
  }, B);
  await page.keyboard.press("F5");
  await expect
    .poll(() => page.evaluate(() => dcsmcraft.renderer.camera.position.z))
    .toBeLessThan(2);
  const r = await page.evaluate(() => {
    const g = dcsmcraft,
      r = g.renderer;
    return {
      distance: r.cameraDistance,
      z: r.camera.position.z,
      signature: r.playerSignature,
      visible: r.playerModel.visible,
    };
  });
  expect(r.z).toBeGreaterThan(0.6);
  expect(r.distance).toBeLessThanOrEqual(1.25);
  expect(r.signature).toContain("dirt_helmet");
  expect(r.visible).toBe(true);
  await page.keyboard.press("F5");
  await expect
    .poll(() => page.evaluate(() => dcsmcraft.renderer.camera.position.z))
    .toBe(-3.5);
  await page.waitForTimeout(300);
  await page.screenshot({
    path: "/workspace/artifacts/DCSMCRAFT-v1.0.0-armor.png",
  });
  expect(errors).toEqual([]);
});
test("new village renders eight houses with repaired villager arms and a persistent defender that fights night mobs", async ({
  page,
}) => {
  const errors = await launch(page, false);
  await world(page);
  const result = await page.evaluate(async () => {
    const g = dcsmcraft,
      { villageAt } = await import("/src/villages.js"),
      { populateVillages } = await import("/src/ecology.js"),
      { createEntity, tickSurvival } = await import("/src/simulation.js");
    g.pause();
    const v = villageAt(g.world, 0, 0);
    Object.assign(g.player, { x: v.x + 0.5, y: v.y + 1, z: v.z + 10.5 });
    populateVillages(g, createEntity);
    const guard = g.entities.find(
        (e) => e.type === "iron_golem" && e.village.id === v.id,
      ),
      resident = g.entities.find(
        (e) => e.type === "villager" && e.village.id === v.id,
      );
    const enemy = createEntity(g, "shade", guard.x + 1.7, guard.z);
    Object.assign(enemy, {
      x: guard.x + 1.7,
      y: guard.y,
      z: guard.z,
      onGround: true,
    });
    g.entities.push(enemy);
    g.time = 15000;
    g.difficulty = "normal";
    const xp = g.player.xp;
    for (let i = 0; i < 30; i++) tickSurvival(g);
    const defended = !g.entities.includes(enemy),
      noXp = g.player.xp === xp;
    const id = g.id;
    await g.save();
    const guardId = guard.id;
    Object.assign(g.player, {
      x: v.x + 4,
      y: v.y + 40,
      z: v.z + 15,
      yaw: 0.18,
      pitch: -1.2,
      flying: true,
    });
    g.settings.renderDistance = 4;
    g.settings.fog = false;
    g.time = 6000;
    g.ui.root.querySelector("#cycle-banner").classList.remove("show");
    g.ui.play();
    return {
      villageChunk: `${Math.floor(v.x / 16)},${Math.floor(v.z / 16)}`,
      homes: v.houses.length,
      residents: g.entities.filter(
        (e) => e.type === "villager" && e.village.id === v.id,
      ).length,
      defended,
      noXp,
      id,
      guardId,
      residentId: resident.id,
    };
  });
  expect(result).toMatchObject({
    homes: 8,
    residents: 8,
    defended: true,
    noXp: true,
  });
  await page.waitForFunction(
    (key) => dcsmcraft.renderer.meshes.has(key),
    result.villageChunk,
  );
  await page.waitForTimeout(2500);
  await page.screenshot({
    path: "/workspace/artifacts/DCSMCRAFT-v1.0.0-village.png",
  });
  const arms = await page.evaluate((id) => {
    const g = dcsmcraft,
      e = g.entities.find((e) => e.id === id);
    g.renderer.camera.position.set(e.x, e.y, e.z + 4);
    g.renderer.syncEntities(g.entities, [], 0, 0);
    const m = g.renderer.mobMeshes.get(id);
    return {
      folded: m.userData.foldedArms.length,
      pieces: m.userData.foldedArms.map((a) => a.children.length),
    };
  }, result.residentId);
  expect(arms.folded).toBe(2);
  expect(arms.pieces).toEqual([2, 2]);
  await page.reload();
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.evaluate((id) => dcsmcraft.loadWorld(id), result.id);
  await page.waitForFunction(() => dcsmcraft.active);
  expect(
    await page.evaluate(
      (id) => dcsmcraft.entities.filter((e) => e.id === id).length,
      result.guardId,
    ),
  ).toBe(1);
  expect(errors).toEqual([]);
});
test("daylight rendering transitions smoothly with warm horizons and clear moonlit nights", async ({
  page,
}) => {
  const errors = await launch(page);
  await world(page);
  await stage(page);
  const colors = await page.evaluate(() => {
    const g = dcsmcraft,
      r = g.renderer;
    g.pause();
    g.ui.play();
    const a = [];
    for (const time of [0, 0.5, 6000, 12000, 18000, 23999.5, 24000]) {
      r.draw({
        player: g.player,
        time,
        playing: true,
        elapsed: g.elapsed,
        animating: false,
      });
      a.push({
        time,
        color: r.scene.background.toArray(),
        sun: r.sun.intensity,
        hemi: r.hemi.intensity,
        stars: r.starField.material.opacity,
      });
    }
    return a;
  });
  expect(colors[0].color).toEqual(colors.at(-1).color);
  expect(Math.abs(colors[0].sun - colors[1].sun)).toBeLessThan(0.001);
  expect(colors[2].sun).toBeGreaterThan(colors[4].sun);
  expect(colors[4].stars).toBeGreaterThan(0.7);
  for (const [time, name] of [
    [6000, "day"],
    [12000, "dusk"],
    [18000, "night"],
  ]) {
    await page.evaluate((time) => {
      dcsmcraft.time = time;
    }, time);
    await page.waitForTimeout(300);
    await page.screenshot({
      path: `/workspace/artifacts/DCSMCRAFT-v1.0.0-${name}.png`,
    });
  }
  expect(errors).toEqual([]);
});
test("villager folded arms and iron guardian render as connected grounded voxel models", async ({
  page,
}) => {
  const errors = await launch(page, false);
  await world(page);
  await stage(page);
  const models = await page.evaluate(async () => {
    const g = dcsmcraft,
      { createEntity } = await import("/src/simulation.js");
    g.pause();
    g.time = 6000;
    g.settings.fog = false;
    g.entities = ["villager", "iron_golem", "cow"].map((type, i) =>
      Object.assign(createEntity(g, type, (i - 1) * 2.4, -4), {
        x: (i - 1) * 2.4,
        y: 200,
        z: -4,
        onGround: true,
        yaw: Math.PI,
        hp: 100,
        profession: "farmer",
      }),
    );
    Object.assign(g.player, { x: 0, y: 200, z: 3, yaw: 0, pitch: 0 });
    g.ui.play();
    g.renderer.camera.position.set(0, 201.62, 3);
    g.renderer.syncEntities(g.entities, [], 0, 0);
    return g.entities.map((e) => {
      const m = g.renderer.mobMeshes.get(e.id);
      return {
        type: e.type,
        legs: m.userData.legs.length,
        folded: m.userData.foldedArms?.length || 0,
        arms: m.userData.arms?.length || 0,
      };
    });
  });
  expect(models).toEqual([
    { type: "villager", legs: 2, folded: 2, arms: 0 },
    { type: "iron_golem", legs: 2, folded: 0, arms: 2 },
    { type: "cow", legs: 4, folded: 0, arms: 0 },
  ]);
  const swings = await page.evaluate(() => {
    const g = dcsmcraft,
      e = g.entities.find((e) => e.type === "iron_golem"),
      angles = [];
    for (const remaining of [1.2, 1.15, 1.05, 0.95, 0.8, 0.65, 0]) {
      e.attack = remaining;
      g.renderer.syncEntities(g.entities, [], 0, 0);
      angles.push(g.renderer.mobMeshes.get(e.id).userData.arms[0].rotation.x);
    }
    return angles;
  });
  // The local model faces -Z. Positive X rotation raises a hanging arm
  // toward its target; the previous negative assertion checked a backward swing.
  expect(Math.min(...swings)).toBeGreaterThanOrEqual(-0.001);
  expect(Math.max(...swings)).toBeGreaterThan(2);
  await page.waitForTimeout(700);
  await page.screenshot({
    path: "/workspace/artifacts/DCSMCRAFT-v1.0.0-guard-and-villager.png",
  });
  expect(errors).toEqual([]);
});
