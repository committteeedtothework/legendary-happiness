import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
const out = "/workspace/artifacts/end";
mkdirSync(out, { recursive: true });
async function boot(page) {
  const errors = [];
  page.on("pageerror", (e) => {
    errors.push(e.stack || e.message);
    writeFileSync(out + "/browser-errors.log", errors.join("\n\n"));
  });
  page.on("console", (m) => {
    if (/Shader Error|VALIDATE_STATUS|GL_INVALID|WebGLProgram/.test(m.text()))
      errors.push(m.text());
  });
  await page.addInitScript(() =>
    localStorage.setItem(
      "dcsmcraft-settings",
      JSON.stringify({
        graphics: 2,
        renderDistance: 4,
        distantTerrain: true,
        volume: 0,
        musicEnabled: false,
        ambientSounds: false,
        frameLimit: 30,
      }),
    ),
  );
  await page.goto("/");
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.locator("[data-action=create]").click();
  await page.locator("[name=seed]").fill("End reliable");
  await page.locator("[name=mode][value=survival]").check();
  await page.locator("[data-action=start-world]").click();
  await page.waitForFunction(() => dcsmcraft.running);
  await page.evaluate(() => {
    dcsmcraft.pause();
    dcsmcraft.entities = [];
  });
  await page.waitForFunction(() => !document.pointerLockElement);
  return errors;
}
test("craft, follow Eyes, activate a real stronghold, fight DRAGOON, reload progress and return through the exit", async ({
  page,
}) => {
  test.setTimeout(300000);
  const errors = await boot(page);
  await page.evaluate(async () => {
    const g = dcsmcraft,
      { makeStack } = await import("/src/data.js");
    g.openInventory("personal");
    g.inventory.craft = [
      makeStack("ender_pearl"),
      makeStack("blaze_powder"),
      ...Array(7).fill(null),
    ];
    g.ui.refreshInventory();
  });
  await page.locator(".output-slot").click();
  expect(await page.evaluate(() => dcsmcraft.inventory.cursor?.id)).toBe(
    "eye_of_ender",
  );
  await page.evaluate(() => {
    const g = dcsmcraft;
    g.closeCraft();
    g.resume();
    g.pause();
    g.endJournal.open();
  });
  await expect(page.locator(".end-journal")).toBeVisible();
  await page.screenshot({ path: out + "/end-journal.png" });
  await page.evaluate(async () => {
    const g = dcsmcraft,
      { strongholds, portalFrames } = await import("/src/end-terrain.js"),
      { B, makeStack } = await import("/src/data.js");
    window.endSite = strongholds(g.world)[0];
    window.endFrames = portalFrames(endSite);
    g.inventory.selected = 0;
    g.inventory.slots[0] = makeStack("eye_of_ender", 32);
    g.target = null;
    g.player.enderCooldown = 0;
    g.ui.play();
    g.running = true;
    g.use();
  });
  await page.waitForFunction(() =>
    dcsmcraft.world.endgame?.orbs.some((o) => o.kind === "eye"),
  );
  await page.screenshot({ path: out + "/eye-guidance.png" });
  await page.evaluate(async () => {
    const g = dcsmcraft,
      s = endSite;
    g.pause();
    g.player.health = 20;
    g.player.food = 20;
    Object.assign(g.player, {
      x: s.x + 0.5,
      y: s.y + 1.05,
      z: s.z + 5.5,
      yaw: 0,
      pitch: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      onGround: true,
      fallStart: s.y + 1.05,
    });
    g.renderer.loadAround(g.player.x, g.player.z, 2, 5);
    g.ui.play();
    g.running = true;
  });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: out + "/stronghold-portal-room.png" });
  await page.evaluate(() => {
    const g = dcsmcraft;
    g.pause();
    for (const q of endFrames) {
      g.target = { ...q, id: g.world.get(q.x, q.y, q.z) };
      g.lastPlace = -99;
      g.use();
    }
    g.inventory.selected = 1;
    Object.assign(g.player, {
      x: endSite.x + 0.5,
      y: endSite.y + 1.05,
      z: endSite.z + 0.5,
      vx: 0,
      vy: 0,
      vz: 0,
      fallStart: endSite.y + 1.05,
    });
    g.resume();
  });
  await page.waitForFunction(() => dcsmcraft.dimension === "end");
  await page.waitForFunction(() =>
    dcsmcraft.entities.some((e) => e.type === "dragoon"),
  );
  await page.evaluate(() => {
    const g = dcsmcraft;
    Object.assign(g.player, {
      x: 68,
      y: g.world.terrain(68, 5).h + 1.05,
      fallStart: g.world.terrain(68, 5).h + 1.05,
      z: 5,
      yaw: Math.PI / 2,
      pitch: 0.12,
      vx: 0,
      vy: 0,
      vz: 0,
    });
    g.renderer.loadAround(68, 5, 2, 5);
    const b = g.entities.find((e) => e.type === "dragoon");
    g.player.yaw = Math.atan2(g.player.x - b.x, g.player.z - b.z);
    g.player.pitch = Math.atan2(
      b.y + 3 - g.player.y - 1.62,
      Math.hypot(b.x - g.player.x, b.z - g.player.z),
    );
    g.player.health = 20;
  });
  await page.waitForTimeout(2500);
  await expect(page.locator("#world-boss-hud")).toBeVisible();
  await page.screenshot({ path: out + "/end-dragoon-flight.png" });
  const first = await page.evaluate(async () => {
    const g = dcsmcraft,
      { damageEntity } = await import("/src/simulation.js");
    g.pause();
    const c = g.entities.find((e) => e.type === "end_crystal");
    damageEntity(g, c, 1, { kind: "arrow" });
    await g.save();
    return {
      id: g.id,
      broken: g.world.endgame.broken.length,
      inventory: g.inventory.export(),
    };
  });
  await page.reload();
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.evaluate(async (id) => {
    await dcsmcraft.loadWorld(id);
    dcsmcraft.pause();
  }, first.id);
  expect(await page.evaluate(() => dcsmcraft.dimension)).toBe("end");
  expect(await page.evaluate(() => dcsmcraft.world.endgame.broken.length)).toBe(
    first.broken,
  );
  await page.evaluate(async () => {
    const g = dcsmcraft,
      { damageEntity } = await import("/src/simulation.js"),
      { tickEndWorld } = await import("/src/end-runtime.js"),
      { createEntity, dropItem } = await import("/src/simulation.js");
    g.player.health = 20;
    for (const c of [...g.entities])
      if (c.type === "end_crystal" && c.hp > 0)
        damageEntity(g, c, 1, { kind: "arrow" });
    const boss = g.entities.find((e) => e.type === "dragoon");
    Object.assign(boss, { mode: "perch", modeAge: 60, x: 0, y: 61.5, z: 0 });
    g.ui.play();
    const { dragoonHead } = await import("/src/end-hitboxes.js"),
      head = dragoonHead(boss),
      { makeStack } = await import("/src/data.js");
    Object.assign(g.player, {
      x: head.x + 0.2,
      y: 61.02,
      z: head.z - 3.2,
      fallStart: 61.02,
      yaw: Math.PI,
      pitch: 0,
      vx: 0,
      vy: 0,
      vz: 0,
    });
    g.inventory.selected = 0;
    g.inventory.slots[0] = makeStack("diamond_sword");
    g.target = null;
    g.lastAttack = -99;
    window.perchHit = g.targetEntity()?.id;
    const before = boss.hp;
    g.tryAttack();
    window.perchDamage = before - boss.hp;
    g.renderer.draw({
      player: g.player,
      time: g.time,
      playing: true,
      elapsed: g.elapsed,
      game: g,
    });
    g.running = false;
  });
  await page.screenshot({ path: out + "/dragoon-perch.png" });
  expect(await page.evaluate(() => perchHit)).toBe("dragoon");
  expect(await page.evaluate(() => perchDamage)).toBeGreaterThan(0);
  await page.evaluate(async () => {
    const g = dcsmcraft,
      { damageEntity, createEntity, dropItem } =
        await import("/src/simulation.js"),
      { tickEndWorld } = await import("/src/end-runtime.js");
    damageEntity(
      g,
      g.entities.find((e) => e.type === "dragoon"),
      1000,
      { kind: "melee", knockback: 0 },
    );
    for (let i = 0; i < 105; i++) {
      tickEndWorld(g, { damageEntity, createEntity, dropItem });
      g.tickCount++;
    }
    g.player.health = 20;
    g.resume();
  });
  await page.waitForFunction(() => dcsmcraft.world.endgame.defeated);
  await page.evaluate(() => {
    const g = dcsmcraft;
    Object.assign(g.player, {
      x: 12,
      y: 70,
      z: 12,
      yaw: 0.8,
      pitch: -0.35,
      flying: true,
    });
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: out + "/dragoon-defeated-fountain.png" });
  expect(await page.evaluate(() => dcsmcraft.world.get(0, 65, 0))).toBe(
    await page.evaluate(
      async () => (await import("/src/data.js")).B.dragon_egg,
    ),
  );
  await page.evaluate(() => {
    const g = dcsmcraft;
    g.endTravelCooldown = 0;
    Object.assign(g.player, {
      x: 1.5,
      y: 61.02,
      z: 0.5,
      vx: 0,
      vy: 0,
      vz: 0,
      fallStart: 61.02,
    });
  });
  await page.waitForFunction(() => dcsmcraft.dimension === "overworld");
  await page.evaluate(() => dcsmcraft.pause());
  expect(
    await page.evaluate(
      () => dcsmcraft.player.achievements.unlocked.free_the_end,
    ),
  ).toBeTruthy();
  expect(errors).toEqual([]);
  writeFileSync(
    out + "/end-cycle.json",
    JSON.stringify({ first, errors, returned: true }, null, 2),
  );
});
test("opaque lava, animated fluids/fire, tall Endermen and phone journal render with valid shaders", async ({
  page,
}) => {
  test.setTimeout(240000);
  const errors = await boot(page);
  await page.evaluate(async () => {
    const g = dcsmcraft,
      { B } = await import("/src/data.js"),
      { createEntity } = await import("/src/simulation.js");
    for (let x = -8; x <= 8; x++)
      for (let z = -8; z <= 8; z++) {
        g.world.set(x, 99, z, B.stone);
        for (let y = 100; y < 106; y++) g.world.set(x, y, z, 0);
      }
    for (let x = -6; x <= -2; x++)
      for (let z = -5; z <= -1; z++) g.world.set(x, 100, z, B.lava);
    for (let x = 2; x <= 6; x++)
      for (let z = -5; z <= -1; z++) g.world.set(x, 100, z, B.water);
    g.world.set(0, 100, -3, B.cinderstone);
    g.world.set(0, 101, -3, B.fire);
    const e = createEntity(g, "enderman", 0, -6);
    e.y = 100;
    g.entities = [e];
    Object.assign(g.player, {
      x: 0.5,
      y: 100.05,
      z: 6.5,
      yaw: 0,
      pitch: -0.25,
    });
    g.renderer.loadAround(0, 0, 3, 8);
    g.resume();
  });
  await page.waitForTimeout(1500);
  await page.screenshot({
    path: out + "/animated-lava-water-fire-enderman.png",
  });
  expect(
    await page.evaluate(() => dcsmcraft.renderer.waterMaterial.transparent),
  ).toBe(true);
  await page.evaluate(() => {
    dcsmcraft.pause();
    dcsmcraft.endJournal.open();
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: out + "/end-journal-phone.png" });
  expect(
    await page
      .locator(".end-journal")
      .evaluate((n) => n.getBoundingClientRect().right <= innerWidth),
  ).toBe(true);
  expect(errors).toEqual([]);
});
