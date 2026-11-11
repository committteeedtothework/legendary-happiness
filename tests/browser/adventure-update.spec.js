import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { World } from "../../src/world.js";
import { caveNode } from "../../src/caves.js";
const html = readFileSync("dist/DCSMCRAFT-Standalone.html", "utf8");
async function create(page, standalone = true) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (
      /Shader Error|WebGLProgram|GL_INVALID|texSubImage|processorerror/.test(
        m.text(),
      )
    )
      errors.push(m.text());
  });
  await page.addInitScript(
    () =>
      !localStorage.getItem("dcsmcraft-settings") &&
      localStorage.setItem(
        "dcsmcraft-settings",
        JSON.stringify({ renderDistance: 2, graphics: 2 }),
      ),
  );
  if (standalone)
    await page.route("**/*", (r) =>
      r.request().url().endsWith("/adventure.html")
        ? r.fulfill({ contentType: "text/html", body: html })
        : r.abort(),
    );
  await page.goto(standalone ? "/adventure.html" : "/");
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.locator("[data-action=create]").first().click();
  await page.locator("[name=seed]").fill("Wildflower");
  await page.locator("[name=mode][value=creative]").check();
  await page.locator("[data-action=start-world]").click();
  await page.waitForFunction(() => dcsmcraft.running);
  await page.evaluate(() => {
    const g = dcsmcraft;
    g.pause();
    g.ui.play();
    g.running = true;
    g.pointerLockFallback = true;
    g.entities = [];
    g.ui.root.querySelector("#cycle-banner").classList.remove("show");
  });
  return errors;
}
test("single-file release renders four original hostile rigs and rotating solid dropped blocks, weapons, and materials without outside requests", async ({
  page,
}) => {
  const errors = await create(page);
  const result = await page.evaluate(() => {
    const g = dcsmcraft,
      r = g.renderer;
    g.pause();
    g.ui.play();
    g.running = false;
    Object.assign(g.player, {
      x: 0.5,
      y: 205,
      z: 9,
      yaw: 0,
      pitch: -0.3,
      flying: true,
    });
    r.camera.position.set(0.5, 206, 9);
    const es = ["zombie", "creeper", "spider", "skeleton"].map((type, i) => ({
      id: type,
      type,
      x: (i - 1.5) * 2.2,
      y: 204,
      z: 0,
      yaw: 0,
      hp: 20,
      age: 0,
      attack: 0,
      hurt: 0,
      speed: 0,
      onGround: true,
    }));
    const drops = [
      "planks",
      "diamond_sword",
      "diamond",
      "string",
      "bone_meal",
      "oak_door",
    ].map((id, i) => ({
      id,
      uid: id,
      x: i * 0.65 - 1.5,
      y: 204,
      z: 3,
      count: 1,
      age: 0,
    }));
    g.entities = es;
    g.drops = drops;
    r.syncEntities(es, drops, 1, 1 / 60);
    const models = es.map((e) => {
      const m = r.mobMeshes.get(e.id);
      let meshes = 0;
      m.traverse((o) => {
        if (o.isMesh) meshes++;
      });
      return {
        type: e.type,
        meshes,
        legs: m.userData.spiderLegs?.length || m.userData.legs.length,
        bow: !!m.userData.bow,
      };
    });
    const items = drops.map((d) => {
      const m = r.dropMeshes.get(d.uid);
      let solid = true,
        count = 0;
      m.traverse((o) => {
        if (o.isMesh) {
          count++;
          o.geometry.computeBoundingBox();
          const b = o.geometry.boundingBox;
          solid &&= b.max.z > b.min.z && !o.isSprite;
        }
      });
      return { id: d.id, count, solid, root: m.userData.droppedItem };
    });
    g.settings.droppedItemAnimation = false;
    r.syncEntities(es, drops, 2, 0);
    const frozen = [...r.dropMeshes.values()].every((m) => m.rotation.y === 0);
    g.settings.droppedItemAnimation = true;
    r.syncEntities(es, drops, 3, 0);
    const rotating = [...r.dropMeshes.values()].every(
      (m) => m.rotation.y === 3,
    );
    const chicken = {
      id: "toggle-chicken",
      type: "chicken",
      x: 0,
      y: 204,
      z: 1,
      hp: 4,
      age: 0,
      onGround: false,
      attack: 0,
      hurt: 0,
      yaw: 0,
    };
    g.settings.entityAnimations = false;
    r.syncEntities([...es, chicken], drops, 4, 0.1);
    const cm = r.mobMeshes.get(chicken.id),
      before = [cm.userData.head.rotation.x, cm.userData.wings[0].rotation.z];
    chicken.age = 120;
    r.syncEntities([...es, chicken], drops, 9, 0.1);
    const creatureFrozen =
      before[0] === cm.userData.head.rotation.x &&
      before[1] === cm.userData.wings[0].rotation.z;
    return { models, items, frozen, rotating, creatureFrozen };
  });
  expect(result.models.every((m) => m.meshes > 3)).toBe(true);
  expect(result.models.find((m) => m.type === "spider").legs).toBe(8);
  expect(result.models.find((m) => m.type === "skeleton").bow).toBe(true);
  expect(
    result.items.every((m) => m.solid && m.count > 0 && m.root === m.id),
  ).toBe(true);
  expect(result.frozen && result.rotating && result.creatureFrozen).toBe(true);
  await page.screenshot({
    path: "/workspace/artifacts/DCSMCRAFT-v1.2.0-mobs-drops.png",
  });
  expect(errors).toEqual([]);
});
test("new graphics buttons, cloud slider and three texture packs update actual rendering and survive reload", async ({
  page,
}) => {
  const errors = await create(page);
  await page.evaluate(() => {
    dcsmcraft.pause();
    dcsmcraft.ui.videoSettings();
  });
  for (const key of [
    "stars",
    "animatedTextures",
    "entityAnimations",
    "droppedItemAnimation",
    "dynamicFOV",
    "damageTilt",
  ]) {
    const button = page.locator(`[data-graphics=${key}]`);
    await expect(button).toHaveAttribute("aria-pressed", "true");
    await button.click();
    await expect(page.locator(`[data-graphics=${key}]`)).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  }
  await page.locator("[data-setting=cloudHeight]").fill("224");
  await expect(page.locator("[data-value=cloudHeight]")).toHaveText("Y 224");
  for (const pack of ["classic", "soft", "renewed"]) {
    await page.locator("[data-preference=texturePack]").selectOption(pack);
    await expect
      .poll(() => page.evaluate(() => dcsmcraft.renderer.appliedPack))
      .toBe(pack);
  }
  const actual = await page.evaluate(() => {
    const g = dcsmcraft;
    g.ui.play();
    g.player.sprinting = true;
    g.player.hurt = 0.25;
    g.renderer.camera.fov = g.settings.FOV;
    return new Promise((resolve) =>
      setTimeout(
        () =>
          resolve({
            stars: g.renderer.starField.visible,
            animated: g.renderer.fluidFancy.value,
            cloud: g.renderer.clouds.position.y,
            fov: g.renderer.camera.fov,
            tilt: g.renderer.camera.rotation.z,
            pack: g.renderer.appliedPack,
          }),
        200,
      ),
    );
  });
  expect(actual).toMatchObject({
    stars: false,
    animated: 0,
    cloud: 64,
    tilt: 0,
    pack: "renewed",
  });
  expect(actual.fov).toBeCloseTo(75, 0);
  await page.evaluate(() => dcsmcraft.ui.videoSettings());
  await page.screenshot({
    path: "/workspace/artifacts/DCSMCRAFT-v1.2.0-video.png",
    fullPage: true,
  });
  await page.reload();
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  expect(
    await page.evaluate(() =>
      [
        "stars",
        "animatedTextures",
        "entityAnimations",
        "droppedItemAnimation",
        "dynamicFOV",
        "damageTilt",
      ].map((k) => dcsmcraft.settings[k]),
    ),
  ).toEqual([false, false, false, false, false, false]);
  expect(await page.evaluate(() => dcsmcraft.settings.cloudHeight)).toBe(224);
  expect(errors).toEqual([]);
});
test("skeleton arrows collide with shelter and hit exposed Survival players; creeper fuses cancel and blasts persist", async ({
  page,
}) => {
  const errors = await create(page, false);
  const result = await page.evaluate(async () => {
    const g = dcsmcraft,
      { B } = await import("/src/data.js"),
      { createEntity, tickSurvival } = await import("/src/simulation.js");
    g.pause();
    g.ui.play();
    g.running = false;
    g.mode = "survival";
    g.time = 15000;
    g.entities = [];
    g.drops = [];
    g.tickCount = 1;
    for (let x = -3; x < 20; x++)
      for (let z = -4; z < 5; z++) g.world.set(x, 199, z, B.stone);
    Object.assign(g.player, {
      x: 0.5,
      y: 200,
      z: 0.5,
      health: 20,
      food: 20,
      saturation: 20,
      hurt: 0,
      flying: false,
    });
    const skeleton = createEntity(g, "skeleton", 10, 0, "skeleton");
    skeleton.y = 200;
    g.entities = [skeleton];
    for (let y = 200; y < 204; y++) g.world.set(5, y, 0, B.stone);
    // Direct projectile launch isolates swept collision from line-of-sight AI.
    const { fireHostileProjectile, tickHostileProjectiles } = await import(
      "/src/hostile-combat.js"
    );
    const { damageEntity } = await import("/src/simulation.js");
    fireHostileProjectile(g, skeleton, g.player);
    for (let i = 0; i < 25; i++) tickHostileProjectiles(g, damageEntity);
    const sheltered = g.player.health;
    for (let y = 200; y < 204; y++) g.world.set(5, y, 0, B.air);
    fireHostileProjectile(g, skeleton, g.player);
    for (let i = 0; i < 25; i++) tickHostileProjectiles(g, damageEntity);
    const exposed = g.player.health;
    g.player.hurt = 0;
    g.entities = [];
    g.hostileProjectiles = [];
    const creeper = createEntity(g, "creeper", 2, 0, "creeper");
    creeper.y = 200;
    g.entities = [creeper];
    for (let i = 0; i < 20; i++) tickSurvival(g);
    const primed = creeper.fuse;
    g.player.x = -5;
    for (let i = 0; i < 15; i++) tickSurvival(g);
    const cancelled = creeper.fuse;
    Object.assign(g.player, {
      x: creeper.x - 2,
      y: 200,
      z: creeper.z,
      hurt: 0,
      health: 20,
    });
    for (let i = 0; i < 32; i++) {
      g.player.hurt = 0;
      tickSurvival(g);
    }
    const exploded = !g.entities.some((e) => e.id === "creeper"),
      terrain = g.world.get(2, 199, 0),
      id = g.id;
    await g.save();
    await g.loadWorld(id);
    g.pause();
    return {
      sheltered,
      exposed,
      primed,
      cancelled,
      exploded,
      terrain,
      reloaded: g.world.get(2, 199, 0),
    };
  });
  expect(result).toMatchObject({
    sheltered: 20,
    exposed: 16,
    primed: 20,
    cancelled: 0,
    exploded: true,
    terrain: 0,
    reloaded: 0,
  });
  expect(errors).toEqual([]);
});
test("temple Guardians show three distinct charge warnings and release jumpable waves, bolts and aimed dashes", async ({
  page,
}) => {
  const errors = await create(page, false);
  const result = await page.evaluate(async () => {
    const g = dcsmcraft,
      { B } = await import("/src/data.js"),
      { relicSite } = await import("/src/relic.js"),
      { populateEncounters } = await import("/src/encounters.js"),
      { createEntity, damageEntity, dropItem } = await import(
        "/src/simulation.js"
      ),
      { enemyCombat } = await import("/src/hostile-combat.js");
    g.pause();
    g.ui.play();
    g.mode = "survival";
    const s = relicSite(g.world);
    Object.assign(g.player, {
      x: s.x + 0.5,
      y: s.y,
      z: s.z + 3,
      health: 20,
      hurt: 0,
    });
    g.entities = [];
    populateEncounters(g, createEntity);
    const guardians = g.entities;
    const checks = [];
    for (const e of guardians) {
      Object.assign(e, {
        x: s.x + 3,
        y: s.y,
        z: s.z + 3,
        specialCooldown: 0,
        windup: 0,
        attack: 0,
      });
      const combat = () =>
        enemyCombat(g, e, g.player, 3, -1, 0, damageEntity, dropItem);
      combat();
      g.renderer.camera.position.set(g.player.x, g.player.y + 1.62, g.player.z);
      g.renderer.syncEntities(guardians, [], 1, 1 / 60);
      const warning = g.renderer.mobMeshes.get(e.id).userData.warning.visible;
      checks.push({ kind: e.special, hp: e.hp, warning });
      if (e.guardianIndex === 0) g.player.y = s.y + 1.1;
      for (let i = 0; i < 32; i++) combat();
      g.player.y = s.y;
    }
    const bolts = g.hostileProjectiles.length,
      waves = g.renderer.effects.some((e) => e.grow === 12);
    g.mode = "creative";
    Object.assign(g.player, {
      x: s.x + 31,
      y: s.y + 19,
      z: s.z + 39,
      yaw: 0.65,
      pitch: -0.28,
      flying: true,
    });
    g.ui.play();
    g.running = true;
    g.pointerLockFallback = true;
    g.renderer.setWorld(g.world);
    g.renderer.loadAround(s.x, s.z, 2, 9);
    return { checks, bolts, waves, site: s };
  });
  expect(result.checks.map((e) => e.kind)).toEqual([
    "shockwave",
    "barrage",
    "lunge",
  ]);
  expect(result.checks.every((e) => e.warning && e.hp === 140)).toBe(true);
  expect(result.bolts).toBe(3);
  expect(result.waves).toBe(true);
  await page.waitForFunction(() => dcsmcraft.renderer.meshes.size >= 9);
  await page.waitForTimeout(800);
  await page.screenshot({
    path: "/workspace/artifacts/DCSMCRAFT-v1.2.0-grand-temple.png",
  });
  expect(errors).toEqual([]);
});
test("new underground chambers render from inside and preserve a real placed torch across save and reload", async ({
  page,
}) => {
  const errors = await create(page);
  const w = new World("Wildflower"),
    n = caveNode(0, 0, w.seedInt);
  const position = {
    x: Math.floor(n.x),
    y: Math.floor(n.y),
    z: Math.floor(n.z),
  };
  await page.evaluate(async (p) => {
    const g = dcsmcraft;
    g.pause();
    g.ui.play();
    g.entities = [];
    g.player.flying = true;
    Object.assign(g.player, {
      x: p.x + 0.5,
      y: p.y,
      z: p.z + 0.5,
      yaw: 0,
      pitch: 0,
      vx: 0,
      vy: 0,
      vz: 0,
    });
    g.world.set(p.x, p.y - 1, p.z, 3);
    g.world.set(p.x, p.y, p.z, 18);
    g.running = true;
    g.pointerLockFallback = true;
    await g.save();
  }, position);
  await page.waitForFunction((p) => {
    const cx = Math.floor(p.x / 16),
      cz = Math.floor(p.z / 16);
    for (let z = -1; z <= 1; z++)
      for (let x = -1; x <= 1; x++)
        if (!dcsmcraft.renderer.meshes.has(`${cx + x},${cz + z}`)) return false;
    return true;
  }, position);
  await page.waitForTimeout(400);
  await page.screenshot({
    path: "/workspace/artifacts/DCSMCRAFT-v1.2.0-connected-caves.png",
  });
  const id = await page.evaluate(() => dcsmcraft.id);
  await page.evaluate(async (id) => {
    dcsmcraft.pause();
    await dcsmcraft.loadWorld(id);
    dcsmcraft.pause();
  }, id);
  const saved = await page.evaluate(
    (p) => ({
      generator: dcsmcraft.world.generationVersion,
      torch: dcsmcraft.world.get(p.x, p.y, p.z),
      nearbyAir: dcsmcraft.world.get(p.x + 1, p.y, p.z),
      y: dcsmcraft.player.y,
    }),
    position,
  );
  expect(saved.generator).toBe(11);
  expect(saved.torch).toBe(18);
  expect(saved.nearbyAir).toBe(0);
  expect(saved.y).toBeCloseTo(position.y, 0);
  expect(errors).toEqual([]);
});
