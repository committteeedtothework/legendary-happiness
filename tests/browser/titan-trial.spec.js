import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { B } from "../../src/data.js";
const html = readFileSync("dist/DCSMCRAFT-Standalone.html", "utf8");
const KEY = "matthew-incursion";
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
        renderDistance: 2,
        graphics: 1,
        volume: 0,
        ambientVolume: 0,
        musicEnabled: false,
      }),
    ),
  );
  await page.route("**/*", (r) =>
    r.request().url().endsWith("/titan.html")
      ? r.fulfill({ contentType: "text/html", body: html })
      : r.abort(),
  );
  await page.goto("/titan.html");
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.locator("[data-action=create]").first().click();
  await page.locator("[name=seed]").fill("Wildflower");
  await page.locator("[data-action=start-world]").click();
  await page.waitForFunction(() => dcsmcraft.running);
  await page.evaluate((B) => {
    const g = dcsmcraft;
    g.pause();
    g.entities = [];
    g.drops = [];
    g.mode = "survival";
    g.difficulty = "normal";
    for (let x = -20; x <= 20; x++)
      for (let z = -20; z <= 20; z++) g.world.set(x, 199, z, B.stone);
    Object.assign(g.player, {
      x: 0.5,
      y: 200,
      z: 12.5,
      vx: 0,
      vy: 0,
      vz: 0,
      health: 20,
      fallStart: 200,
      onGround: true,
      flying: false,
    });
    g.world.settlements["matthew-incursion"] = {
      x: 0,
      y: 200,
      z: 0,
      phase: "emerging",
      age: 179,
      opened: true,
      created: [],
      defeated: [],
    };
    g.ui.play();
    g.running = true;
    g.pointerLockFallback = true;
  }, B);
  await page.waitForFunction(
    () => dcsmcraft.world.settlements["matthew-incursion"].phase === "battle",
  );
  await page.evaluate(() => dcsmcraft.pause());
  return errors;
}
async function grip(page) {
  await page.evaluate(() => {
    const g = dcsmcraft,
      s = g.world.settlements["matthew-incursion"];
    Object.assign(g.player, {
      x: 5.8,
      y: 200,
      z: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      health: 20,
      fallStart: 200,
    });
    s.grab = { arm: 0, age: 69 };
    g.ui.play();
    g.running = true;
    g.pointerLockFallback = true;
  });
  await page.waitForFunction(() => dcsmcraft.dimension === "cinderwild");
  await page.evaluate(() => {
    dcsmcraft.pause();
    dcsmcraft.ui.play();
    dcsmcraft.ui.updateHUD();
  });
}
function aim(g, e, height = 1.7) {
  const p = g.player;
  p.yaw = Math.atan2(p.x - e.x, p.z - e.z);
  p.pitch = Math.atan2(
    e.y + height - p.y - 1.62,
    Math.hypot(e.x - p.x, e.z - p.z),
  );
  g.target = null;
}

test("standalone elite guards, random orb bullets, cover and rendered reaching tentacles", async ({
  page,
}) => {
  test.setTimeout(150000);
  const errors = await create(page);
  const guards = await page.evaluate(() =>
    dcsmcraft.entities
      .filter((e) => e.encounter === "matthew-incursion")
      .map((e) => ({ type: e.type, hp: e.hp })),
  );
  expect(guards.map((e) => e.hp)).toEqual([84, 120, 88, 84]);
  expect(guards.map((e) => e.type)).toEqual([
    "soul_reaver",
    "dread_knight",
    "magma_maw",
    "soul_reaver",
  ]);
  const shot = await page.evaluate(() =>
    dcsmcraft.hostileProjectiles.find((q) => q.orbBullet),
  );
  expect(shot).toBeTruthy();
  expect(shot.damage).toBe(6);
  // Use the actual emitted projectile with a controlled trajectory to check the
  // built game's production sweep and damage path, including solid cover.
  await page.evaluate((B) => {
    const g = dcsmcraft,
      q = g.hostileProjectiles.find((q) => q.orbBullet);
    g.entities = [];
    g.world.settlements["matthew-incursion"].orbNextShot = 1e9;
    Object.assign(g.player, {
      x: 11.5,
      y: 200,
      z: 8.5,
      hurt: 0,
      health: 20,
      fallStart: 200,
    });
    g.hostileProjectiles = [
      { ...q, x: 10, y: 201, z: 8.5, vx: 2, vy: 0, vz: 0 },
    ];
    g.ui.play();
    g.running = true;
  }, B);
  await page.waitForFunction(() => dcsmcraft.player.health < 20);
  await page.evaluate(() => dcsmcraft.pause());
  expect(await page.evaluate(() => dcsmcraft.player.health)).toBe(14);
  await page.evaluate((B) => {
    const g = dcsmcraft;
    g.world.set(10, 201, 8, B.stone);
    Object.assign(g.player, { x: 11.5, y: 200, z: 8.5, hurt: 0, health: 20 });
    g.hostileProjectiles = [
      {
        id: "cover-check",
        orbBullet: true,
        x: 9.5,
        y: 201,
        z: 8.5,
        vx: 2.5,
        vy: 0,
        vz: 0,
        damage: 6,
        age: 0,
        sourceType: "sealed_pistols",
      },
    ];
    g.running = true;
  }, B);
  await page.waitForFunction(() => dcsmcraft.hostileProjectiles.length === 0);
  await page.evaluate(() => dcsmcraft.pause());
  expect(await page.evaluate(() => dcsmcraft.player.health)).toBe(20);
  await page.evaluate(() => {
    const g = dcsmcraft,
      s = g.world.settlements["matthew-incursion"];
    Object.assign(g.player, { x: 8, y: 200, z: 3, yaw: 1.21, pitch: -0.08 });
    s.grab = { arm: 0, age: 20 };
    g.ui.play();
    g.ui.root.querySelector("#cycle-banner")?.classList.remove("show");
  });
  await page.waitForTimeout(500);
  await page.screenshot({
    path: "/workspace/artifacts/DCSMCRAFT-v1.6.0-orb-tentacles.png",
  });
  expect(
    await page.evaluate(() => dcsmcraft.renderer.gl.getContext().getError()),
  ).toBe(0);
  expect(errors).toEqual([]);
});

test("standalone abduction, supplies, Titan bullet immunity, saved damage, checkpoint respawn, real victory and return", async ({
  page,
}) => {
  test.setTimeout(210000);
  const errors = await create(page);
  await grip(page);
  await expect(page.locator("#titan-boss")).toContainText("320 / 320");
  const info = await page.evaluate(() => {
    const g = dcsmcraft,
      t = g.realms.overworld.world.settlements["matthew-incursion"].trial;
    return {
      id: g.id,
      arena: t.arena,
      boss: g.entities.find((e) => e.type === "mad_titan").id,
    };
  });
  // The supplied chest is a normal interactive container, not decorative loot.
  await page.evaluate(
    ({ a, B }) => {
      const g = dcsmcraft;
      g.target = { x: a.x + 2, y: a.y + 1, z: a.z + 13, id: B.chest };
      g.use();
    },
    { a: info.arena, B },
  );
  await expect(page.locator(".inventory-window")).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        dcsmcraft.world.containers[
          `${(dcsmcraft.player.x + 1.5) | 0},245,${(dcsmcraft.player.z - 0.5) | 0}`
        ]?.slots?.[0]?.id,
    ),
  ).toBe("diamond_sword");
  await page.evaluate(() => {
    const g = dcsmcraft;
    g.closeInventory();
    g.pause();
    g.ui.play();
  });
  const result = await page.evaluate((aimSource) => {
    const g = dcsmcraft,
      e = g.entities.find((e) => e.type === "mad_titan"),
      aim = eval(`(${aimSource})`);
    Object.assign(g.player, {
      x: e.x,
      y: e.y,
      z: e.z + 6,
      fallStart: e.y,
      hurt: 0,
    });
    g.inventory.selected = 0;
    g.inventory.slots[0] = { id: "matthew_dual_pistols", count: 1 };
    aim(g, e);
    g.lastPistolTick = -100;
    g.player.pistolNextTick = 0;
    const before = e.hp;
    g.firePistols();
    const after = e.hp;
    Object.assign(g.player, { x: e.x, y: e.y, z: e.z + 2.5 });
    g.inventory.slots[0] = { id: "diamond_sword", count: 1, durability: 1561 };
    g.lastAttack = -100;
    aim(g, e);
    g.tryAttack();
    g.ui.updateHUD();
    return { before, after, melee: e.hp };
  }, aim.toString());
  expect(result.before).toBe(320);
  expect(result.after).toBe(320);
  expect(result.melee).toBeLessThan(320);
  await page.evaluate(() => {
    const g = dcsmcraft,
      e = g.entities.find((e) => e.type === "mad_titan");
    g.player.z = e.z + 8;
    g.player.pitch = 0.09;
    e.hurt = 0;
    g.ui.root.querySelector("#cycle-banner")?.classList.remove("show");
  });
  await page.waitForTimeout(250);
  await page.screenshot({
    path: "/workspace/artifacts/DCSMCRAFT-v1.6.0-mad-titan.png",
  });
  await page.evaluate(async () => {
    dcsmcraft.pause();
    await dcsmcraft.save();
  });
  await page.reload();
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.evaluate((id) => dcsmcraft.loadWorld(id), info.id);
  await page.waitForFunction(() => dcsmcraft.active);
  await page.evaluate(() => {
    dcsmcraft.pause();
    dcsmcraft.ui.play();
    dcsmcraft.ui.updateHUD();
  });
  expect(await page.evaluate(() => dcsmcraft.dimension)).toBe("cinderwild");
  expect(
    await page.evaluate(
      () => dcsmcraft.entities.find((e) => e.type === "mad_titan").hp,
    ),
  ).toBe(result.melee);
  await page.evaluate(
    ({ a, B }) => {
      const g = dcsmcraft;
      g.breakBlock({ x: a.x, y: a.y + 1, z: a.z + 15, id: B.trial_exit });
    },
    { a: info.arena, B },
  );
  expect(
    await page.evaluate(
      ({ a, B }) => dcsmcraft.world.get(a.x, a.y + 1, a.z + 15),
      { a: info.arena, B },
    ),
  ).toBe(B.trial_exit);
  // Ordinary travel cannot skip the boss; an actual death/respawn retains it.
  await page.evaluate(() => {
    const g = dcsmcraft;
    g.travelDimension({ x: 1, y: 100, z: 1, axis: "x" });
    g.player.hurt = 0;
    g.damage(999, "trial test");
  });
  await expect(page.locator("[data-action=respawn]")).toBeVisible();
  await page.locator("[data-action=respawn]").click();
  await page.evaluate(() => {
    dcsmcraft.pause();
    dcsmcraft.ui.play();
  });
  expect(await page.evaluate(() => dcsmcraft.dimension)).toBe("cinderwild");
  expect(
    await page.evaluate(
      () => dcsmcraft.entities.find((e) => e.type === "mad_titan").hp,
    ),
  ).toBe(result.melee);
  // Controlled full-cooldown hits use the real targeting/combat/durability path.
  const victory = await page.evaluate((aimSource) => {
    const g = dcsmcraft,
      e = g.entities.find((e) => e.type === "mad_titan"),
      aim = eval(`(${aimSource})`);
    g.inventory.selected = 0;
    g.inventory.slots[0] = { id: "diamond_sword", count: 1, durability: 1561 };
    let hits = 0;
    while (e.hp > 0 && hits < 90) {
      Object.assign(g.player, { x: e.x, y: e.y, z: e.z + 2.5 });
      g.lastAttack = -100;
      aim(g, e);
      if (!g.tryAttack()) break;
      hits++;
    }
    const t = g.realms.overworld.world.settlements["matthew-incursion"].trial;
    Object.assign(g.player, {
      x: t.arena.x + 0.5,
      y: t.arena.y + 1.01,
      z: t.arena.z + 13.5,
    });
    g.ui.updateHUD();
    return { phase: t.phase, hits };
  }, aim.toString());
  expect(victory.phase).toBe("victory");
  expect(victory.hits).toBeGreaterThan(40);
  await expect(page.locator("#titan-boss")).toContainText(
    "Return rune unlocked",
  );
  await page.evaluate(
    ({ a, B }) => {
      const g = dcsmcraft;
      g.target = { x: a.x, y: a.y + 1, z: a.z + 15, id: B.trial_exit };
      g.use();
      g.pause();
      g.ui.play();
    },
    { a: info.arena, B },
  );
  expect(await page.evaluate(() => dcsmcraft.dimension)).toBe("overworld");
  expect(
    await page.evaluate(
      () => dcsmcraft.world.settlements["matthew-incursion"].trial.phase,
    ),
  ).toBe("escaped");
  expect(
    await page.evaluate(
      () => dcsmcraft.world.settlements["matthew-incursion"].phase,
    ),
  ).toBe("battle");
  expect(
    await page.evaluate(
      () =>
        dcsmcraft.entities.filter(
          (e) => e.encounter === "matthew-incursion" && e.hp > 0,
        ).length,
    ),
  ).toBe(4);
  await page.evaluate(async () => {
    await dcsmcraft.save();
  });
  await page.reload();
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.evaluate((id) => dcsmcraft.loadWorld(id), info.id);
  await page.waitForFunction(() => dcsmcraft.active);
  await page.evaluate(() => dcsmcraft.pause());
  expect(
    await page.evaluate(
      () => dcsmcraft.world.settlements["matthew-incursion"].trial.phase,
    ),
  ).toBe("escaped");
  expect(
    await page.evaluate(
      () =>
        dcsmcraft.realms.cinderwild.entities.filter(
          (e) => e.type === "mad_titan" && e.hp > 0,
        ).length,
    ),
  ).toBe(0);
  expect(
    await page.evaluate(() => dcsmcraft.renderer.gl.getContext().getError()),
  ).toBe(0);
  expect(errors).toEqual([]);
});
