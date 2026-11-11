import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { B } from "../../src/data.js";
let html;
test.beforeAll(() => {
  execFileSync(process.execPath, [
    "scripts/build-standalone.mjs",
    "/tmp/dcsmcraft-animation-tested.html",
  ]);
  html = readFileSync("/tmp/dcsmcraft-animation-tested.html", "utf8");
});
async function create(page, standalone = true) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && /Shader Error|WebGLProgram/.test(m.text()))
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
      r.request().url().endsWith("/animations.html")
        ? r.fulfill({ contentType: "text/html", body: html })
        : r.abort(),
    );
  await page.goto(standalone ? "/animations.html" : "/");
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
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
  return errors;
}
async function hold(page, id) {
  await page.evaluate(async (id) => {
    const g = dcsmcraft;
    g.inventory.slots[0] = { id, count: 1, durability: 250 };
    g.inventory.selected = 0;
    g.renderer.setHeld(id);
    g.renderer.animator.reset();
    g.renderer.animator.equip = 0;
    g.ui.updateHotbar();
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
  }, id);
}
test("standalone tools and blocks share the hand grip, have depth, and keep the atlas alive through switches", async ({
  page,
}) => {
  const errors = await create(page);
  await hold(page, "iron_sword");
  await page.screenshot({
    path: "/workspace/artifacts/DCSMCRAFT-v1.0.0-sword-grip.png",
  });
  const result = await page.evaluate(() => {
    const r = dcsmcraft.renderer;
    let disposed = false;
    r.atlas.texture.addEventListener("dispose", () => (disposed = true));
    const checks = [];
    for (const id of [
      "wooden_pickaxe",
      "iron_axe",
      "diamond_shovel",
      "stone_hoe",
      "iron_sword",
      "planks",
      "oak_door",
      "planks",
    ]) {
      r.setHeld(id);
      r.animator.equip = 0;
      const model = r.heldMesh;
      let volumes = 0;
      model.traverse((m) => {
        if (m.isMesh) {
          m.geometry.computeBoundingBox();
          const b = m.geometry.boundingBox;
          if (b.max.z > b.min.z) volumes++;
        }
      });
      for (let i = 0; i < 5; i++) {
        r.action("attack");
        r.animator.step(0.05, dcsmcraft.player);
      }
      checks.push({
        id,
        kind: model.userData.kind,
        attached: model.parent === r.handRig.grip,
        volumes,
      });
    }
    dcsmcraft.inventory.slots[0] = { id: "planks", count: 64 };
    r.animator.reset();
    r.animator.equip = 0;
    dcsmcraft.settings.FOV = 110;
    return { checks, disposed, handFOV: r.handCamera.fov };
  });
  expect(result.checks.every((c) => c.attached && c.volumes > 0)).toBe(true);
  expect(
    result.checks
      .filter((c) => c.id === "planks" || c.id === "oak_door")
      .every((c) => c.kind === "block"),
  ).toBe(true);
  expect(result.disposed).toBe(false);
  expect(result.handFOV).toBe(70);
  await hold(page, "planks");
  await page.screenshot({
    path: "/workspace/artifacts/DCSMCRAFT-v1.0.0-block-grip.png",
  });
  expect(errors).toEqual([]);
});
test("combat clicks animate swings, damage and critical feedback, recoil and death without duplicate rewards", async ({
  page,
}) => {
  const errors = await create(page);
  await hold(page, "iron_sword");
  await page.evaluate((B) => {
    const g = dcsmcraft;
    for (let x = 7; x <= 9; x++)
      for (let z = 3; z <= 9; z++) g.world.set(x, 199, z, B.stone);
    Object.assign(g.player, {
      x: 8.5,
      y: 200,
      z: 8.5,
      yaw: 0,
      pitch: 0,
      flying: true,
      onGround: true,
      vx: 0,
      vy: 0,
      vz: 0,
      xp: 0,
    });
    g.entities = [
      {
        id: "combat",
        type: "shade",
        x: 8.5,
        y: 200,
        z: 6.5,
        hp: 30,
        age: 0,
        attack: 0,
        hurt: 0,
        speed: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        onGround: true,
        turn: 100,
        dir: 0,
      },
    ];
    g.renderer.syncEntities(g.entities, [], 0);
    g.target = null;
    g.lastAttack = -10;
    g.running = true;
  }, B);
  const hit = await page.evaluate(() => {
    const g = dcsmcraft;
    g.renderer.gl.domElement.dispatchEvent(
      new MouseEvent("mousedown", { button: 0, bubbles: true }),
    );
    window.dispatchEvent(new MouseEvent("mouseup"));
    g.ui.frame();
    return {
      hp: g.entities[0].hp,
      kind: g.renderer.animator.action?.kind,
      sparks: g.renderer.effects.length,
      flinch: g.renderer.mobMeshes.get("combat").userData.flinch,
      marker: document
        .querySelector("#crosshair")
        .classList.contains("combat-hit"),
      cooldown: !document.querySelector("#attack-cooldown").hidden,
    };
  });
  expect(hit).toMatchObject({
    hp: 24,
    kind: "attack",
    flinch: 1,
    marker: true,
    cooldown: true,
  });
  expect(hit.sparks).toBeGreaterThanOrEqual(4);
  await page.waitForFunction(() => !dcsmcraft.renderer.animator.action);
  const kill = await page.evaluate(() => {
    const g = dcsmcraft,
      e = g.entities[0];
    e.hp = 1;
    e.x = 8.5;
    e.y = 200;
    e.z = 6.5;
    g.player.onGround = false;
    g.player.vy = -2;
    g.target = null;
    g.lastAttack = -10;
    g.renderer.gl.domElement.dispatchEvent(
      new MouseEvent("mousedown", { button: 0, bubbles: true }),
    );
    window.dispatchEvent(new MouseEvent("mouseup"));
    const xp = g.player.xp;
    g.tryAttack();
    g.tryAttack();
    return {
      critical: g.hitFeedback.critical,
      xp,
      after: g.player.xp,
      death: !!g.renderer.mobMeshes.get("combat").userData.death,
    };
  });
  expect(kill).toEqual({ critical: true, xp: 5, after: 5, death: true });
  await page.waitForFunction(() => !dcsmcraft.renderer.mobMeshes.has("combat"));
  await page.evaluate(() => dcsmcraft.pause());
  const phase = await page.evaluate(() => dcsmcraft.renderer.animator.phase);
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => dcsmcraft.renderer.animator.phase)).toBe(
    phase,
  );
  expect(errors).toEqual([]);
});
test("standalone door placement, upper-half interaction, persistent reload and single-drop breaking", async ({
  page,
}) => {
  const errors = await create(page);
  const placed = await page.evaluate((B) => {
    const g = dcsmcraft;
    g.mode = "survival";
    g.entities = [];
    g.drops = [];
    Object.assign(g.player, {
      x: 15.5,
      y: 200,
      z: 1.5,
      yaw: 0,
      pitch: 0,
      onGround: true,
    });
    g.world.set(15, 199, -1, B.stone);
    g.inventory.slots[0] = { id: "oak_door", count: 3 };
    g.inventory.selected = 0;
    g.target = {
      x: 15,
      y: 199,
      z: -1,
      id: B.stone,
      normal: { x: 0, y: 1, z: 0 },
    };
    g.lastPlace = -10;
    g.use();
    g.lastPlace = -10;
    g.use();
    return {
      lower: g.world.get(15, 200, -1),
      upper: g.world.get(15, 201, -1),
      count: g.inventory.held.count,
    };
  }, B);
  expect(placed).toEqual({
    lower: B.oak_door,
    upper: B.oak_door + 1,
    count: 2,
  });
  const interaction = await page.evaluate(() => {
    const g = dcsmcraft;
    g.target = g.world.raycast({ x: 15.5, y: 201.62, z: 1.5 }, g.direction());
    g.lastPlace = -10;
    g.renderer.gl.domElement.dispatchEvent(
      new MouseEvent("mousedown", { button: 2, bubbles: true }),
    );
    return {
      targetY: g.target.y,
      open: g.world.get(15, 200, -1) === g.target.id + 1,
      count: g.inventory.held.count,
    };
  });
  expect(interaction).toEqual({ targetY: 201, open: true, count: 2 });
  await page.evaluate(() => dcsmcraft.save());
  await page.reload();
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.locator("[data-action=load]").first().click();
  await page.waitForFunction(() => dcsmcraft.running);
  const removed = await page.evaluate((B) => {
    const g = dcsmcraft;
    g.pause();
    const open = g.world.get(15, 200, -1) === B.oak_door + 2;
    const upper = { x: 15, y: 201, z: -1, id: g.world.get(15, 201, -1) },
      lower = { x: 15, y: 200, z: -1, id: g.world.get(15, 200, -1) };
    g.breakBlock(upper);
    g.breakBlock(upper);
    g.breakBlock(lower);
    return {
      open,
      air:
        g.world.get(15, 200, -1) === B.air &&
        g.world.get(15, 201, -1) === B.air,
      drops: g.drops
        .filter((d) => d.id === "oak_door")
        .reduce((n, d) => n + d.count, 0),
    };
  }, B);
  expect(removed).toEqual({ open: true, air: true, drops: 1 });
  expect(errors).toEqual([]);
});
test("village doors render and residents open them without automatic closing on their nighttime route", async ({
  page,
}) => {
  const errors = await create(page, false);
  const result = await page.evaluate(async () => {
    const g = dcsmcraft,
      { villageAt } = await import("/src/villages.js"),
      { populateVillages } = await import("/src/ecology.js"),
      { tickSurvival, createEntity } = await import("/src/simulation.js"),
      { doorAt } = await import("/src/doors.js");
    const v = villageAt(g.world, 0, 0),
      h = v.houses[0];
    Object.assign(g.player, {
      x: h.doorX + 0.5,
      y: v.y + 1,
      z: h.doorZ + 5,
      yaw: 0,
      pitch: 0.06,
    });
    g.difficulty = "peaceful";
    populateVillages(g, createEntity);
    const e = g.entities.find((e) => e.home?.doorX === h.doorX + 0.5);
    e.x = v.x + 0.5;
    e.z = v.z + 7.5;
    g.time = 14000;
    let opened = false;
    for (let i = 0; i < 700; i++) {
      tickSurvival(g);
      opened ||= !!doorAt(g.world, h.doorX, v.y + 1, h.doorZ)?.open;
    }
    g.time = 6000;
    g.ui.play();
    g.pointerLockFallback = true;
    return {
      opened,
      closed: !doorAt(g.world, h.doorX, v.y + 1, h.doorZ).open,
      distance: Math.hypot(e.x - e.home.x, e.z - e.home.z),
      meshKey: `${Math.floor(h.doorX / 16)},${Math.floor(h.doorZ / 16)}`,
    };
  });
  expect(result.opened).toBe(true);
  expect(result.closed).toBe(false);
  expect(result.distance).toBeLessThan(1.2);
  await page.waitForFunction(
    (key) => dcsmcraft.renderer.meshes.has(key),
    result.meshKey,
  );
  await hold(page, "oak_door");
  await page.screenshot({
    path: "/workspace/artifacts/DCSMCRAFT-v1.0.0-village-door.png",
  });
  expect(errors).toEqual([]);
});
