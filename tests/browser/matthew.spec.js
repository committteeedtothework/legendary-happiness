import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { B, makeStack } from "../../src/data.js";
const html = readFileSync("dist/DCSMCRAFT-Standalone.html", "utf8");
const KEY = "matthew-incursion",
  GUN = "matthew_dual_pistols";
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
        ambientVolume: 0,
        musicEnabled: false,
      }),
    ),
  );
  await page.route("**/*", (r) =>
    r.request().url().endsWith("/matthew.html")
      ? r.fulfill({ contentType: "text/html", body: html })
      : r.abort(),
  );
  await page.goto("/matthew.html");
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.locator("[data-action=create]").first().click();
  await page.locator("[name=seed]").fill("Wildflower");
  await page.locator("[name=mode][value=creative]").check();
  await page.locator("[data-action=start-world]").click();
  await page.waitForFunction(() => dcsmcraft.running);
  return errors;
}
async function arena(page, { emerge = false } = {}) {
  await page.evaluate(
    ({ B, emerge, gun }) => {
      const g = dcsmcraft;
      g.pause();
      g.entities = [];
      g.drops = [];
      g.difficulty = "normal";
      for (let x = -10; x <= 24; x++)
        for (let z = -12; z <= 24; z++) g.world.set(x, 199, z, B.stone);
      Object.assign(g.player, {
        x: 0.5,
        y: 200,
        z: 12.5,
        yaw: 0,
        pitch: 0,
        flying: false,
        vx: 0,
        vy: 0,
        vz: 0,
        health: 20,
        onGround: true,
        fallStart: 200,
      });
      g.inventory.slots.fill(null);
      g.inventory.selected = 0;
      g.inventory.slots[0] = { id: gun, count: 1 };
      if (emerge)
        g.world.settlements["matthew-incursion"] = {
          x: 0,
          y: 200,
          z: 0,
          phase: "emerging",
          age: 0,
          opened: false,
          created: [],
          defeated: [],
        };
      g.ui.play();
      g.ui.root.querySelector("#cycle-banner")?.classList.remove("show");
      g.running = true;
      g.pointerLockFallback = true;
    },
    { B, emerge, gun: GUN },
  );
  await page.mouse.move(640, 400);
  await page.waitForTimeout(250);
}
async function aim(page, point) {
  await page.evaluate((t) => {
    const p = dcsmcraft.player;
    p.yaw = Math.atan2(p.x - t.x, p.z - t.z);
    p.pitch = Math.atan2(t.y - p.y - 1.62, Math.hypot(t.x - p.x, t.z - p.z));
  }, point);
  await page.waitForTimeout(150);
}
async function healthy(page, errors) {
  await page.waitForFunction(() => dcsmcraft.renderer.meshes.size >= 9);
  expect(
    await page.evaluate(() => dcsmcraft.renderer.gl.getContext().getError()),
  ).toBe(0);
  expect(errors).toEqual([]);
}
test("standalone Creative journal summons the natural incursion and shows the exact announcement", async ({
  page,
}) => {
  test.setTimeout(150000);
  const errors = await create(page);
  await page.waitForFunction(() => dcsmcraft.renderer.meshes.size >= 9);
  // Wildflower starts in dense jungle. Walk/flight is position-fixtured to a
  // real, unedited clearing; never require an event to overwrite the forest.
  await page.evaluate(() => {
    const g = dcsmcraft;
    g.pause();
    g.tickCount = 20;
    Object.assign(g.player, {
      x: 88.5,
      z: 8.5,
      y: g.world.terrain(88, 8).h + 1,
      vx: 0,
      vy: 0,
      vz: 0,
    });
    for (let z = -2; z <= 2; z++)
      for (let x = 3; x <= 7; x++) g.world.ensure(x, z);
    g.ui.play();
    g.running = true;
    g.pointerLockFallback = true;
  });
  await page.keyboard.press("KeyJ");
  await expect(page.locator("[data-action=summon-incursion]")).toBeVisible();
  await page.locator("[data-action=summon-incursion]").click();
  await expect
    .poll(
      () =>
        page.evaluate(
          () => dcsmcraft.world.settlements["matthew-incursion"]?.phase,
        ),
      { timeout: 20000 },
    )
    .toBe("emerging");
  await expect(page.locator("#cycle-banner span")).toHaveText(
    "Hellspawn from Cinderworld have surfed in the overworld! Defeat them and claim a powerful weapon.",
  );
  await page.waitForFunction(
    () => dcsmcraft.world.settlements["matthew-incursion"].age >= 45,
  );
  await page.evaluate(() => {
    const p = dcsmcraft.player,
      s = dcsmcraft.world.settlements["matthew-incursion"];
    p.yaw = Math.atan2(p.x - s.x, p.z - s.z);
    p.pitch = 0.08;
  });
  await page.screenshot({
    path: "/workspace/artifacts/DCSMCRAFT-v1.3.0-natural-incursion.png",
  });
  await healthy(page, errors);
});
test("standalone mouse fire alternates held pistols, survives right-release, hits a mob and cannot mine through a wall", async ({
  page,
}) => {
  const errors = await create(page);
  await arena(page);
  await page.evaluate(() => {
    dcsmcraft.entities = [
      {
        id: "pistol-target",
        type: "cinder_wraith",
        x: 0.5,
        y: 200,
        z: 2.5,
        hp: 100,
        age: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        onGround: true,
        attack: 0,
        dir: 0,
        turn: 100,
      },
    ];
  });
  await aim(page, { x: 0.5, y: 201.2, z: 2.5 });
  await page.mouse.down();
  await expect
    .poll(() => page.evaluate(() => dcsmcraft.entities[0]?.hp))
    .toBeLessThan(90);
  await page.mouse.down({ button: "right" });
  await page.mouse.up({ button: "right" });
  expect(await page.evaluate(() => dcsmcraft.mouseDown)).toBe(true);
  await page.waitForTimeout(500);
  await page.mouse.up();
  expect(
    await page.evaluate(() => dcsmcraft.renderer.leftHandRig.root.visible),
  ).toBe(true);
  expect(
    await page.evaluate(() => dcsmcraft.renderer.heldMesh.userData.kind),
  ).toBe("pistols");
  await page.keyboard.press("F5");
  await expect
    .poll(() =>
      page.evaluate(
        () => dcsmcraft.renderer.playerModel?.userData.leftGrip.children.length,
      ),
    )
    .toBe(1);
  const beforeShot = await page.evaluate(
    () => dcsmcraft.player.matthewShotTick,
  );
  await page.waitForFunction(
    () => dcsmcraft.tickCount >= dcsmcraft.player.matthewShotTick,
  );
  await page.mouse.click(640, 400);
  await expect
    .poll(() => page.evaluate(() => dcsmcraft.player.matthewShotTick))
    .toBeGreaterThan(beforeShot);
  await expect
    .poll(() => page.evaluate(() => dcsmcraft.renderer.pistolKick), {
      timeout: 5000,
    })
    .toBe(0);
  await page.screenshot({
    path: "/workspace/artifacts/DCSMCRAFT-v1.3.0-dual-pistols-f5.png",
  });
  await page.evaluate((B) => {
    const g = dcsmcraft;
    g.cameraMode = 0;
    Object.assign(g.player, {
      x: 0.5,
      y: 200,
      z: 12.5,
      yaw: 0,
      pitch: 0,
      vx: 0,
      vy: 0,
      vz: 0,
    });
    g.entities = [
      {
        id: "wall-target",
        type: "cinder_wraith",
        x: 0.5,
        y: 200,
        z: 2.5,
        hp: 100,
        age: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        onGround: true,
        dir: 0,
        turn: 100,
      },
    ];
    for (let y = 200; y < 203; y++) g.world.set(0, y, 8, B.stone);
  }, B);
  await aim(page, { x: 0.5, y: 201.2, z: 2.5 });
  await page.mouse.down();
  await page.waitForTimeout(700);
  await page.mouse.up();
  expect(await page.evaluate(() => dcsmcraft.entities[0]?.hp)).toBe(100);
  expect(await page.evaluate(() => dcsmcraft.world.get(0, 201, 8))).toBe(
    B.stone,
  );
  await healthy(page, errors);
});
test("standalone real controls Dash, Sky Star and Air Trick stop at body-sized obstacles", async ({
  page,
}) => {
  const errors = await create(page);
  await arena(page);
  const before = await page.evaluate(() => dcsmcraft.player.z);
  await page.mouse.click(640, 400, { button: "right" });
  await expect
    .poll(() => page.evaluate(() => dcsmcraft.player.z))
    .toBeLessThan(before - 3);
  await page.evaluate(() => {
    dcsmcraft.player.tricksterRecharges = [];
  });
  await page.keyboard.down("Space");
  await page.waitForTimeout(150);
  await page.keyboard.up("Space");
  await page.mouse.click(640, 400, { button: "right" });
  await expect
    .poll(() => page.evaluate(() => dcsmcraft.player.tricksterAirUsed))
    .toBe(true);
  await page.evaluate(() => {
    const g = dcsmcraft;
    Object.assign(g.player, {
      x: 0.5,
      y: 200,
      z: 12.5,
      onGround: true,
      vx: 0,
      vy: 0,
      vz: 0,
      tricksterRecharges: [],
      tricksterBlinkTick: 0,
    });
    g.entities = [
      {
        id: "blink-target",
        type: "zombie",
        x: 0.5,
        y: 200,
        z: 2.5,
        hp: 100,
        age: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        onGround: true,
        dir: 0,
        turn: 100,
      },
    ];
  });
  await aim(page, { x: 0.5, y: 201.2, z: 2.5 });
  await page.keyboard.press("KeyR");
  await expect
    .poll(() => page.evaluate(() => dcsmcraft.player.z))
    .toBeLessThan(5);
  await page.evaluate((B) => {
    const g = dcsmcraft;
    Object.assign(g.player, {
      x: 14.5,
      y: 200,
      z: 0.5,
      yaw: -Math.PI / 2,
      pitch: 0,
      onGround: true,
      vx: 0,
      vy: 0,
      vz: 0,
      tricksterRecharges: [],
    });
    delete g.player.tricksterDash;
    for (let y = 200; y < 203; y++) g.world.set(16, y, 0, B.stone);
  }, B);
  await page.mouse.click(640, 400, { button: "right" });
  await page.waitForTimeout(500);
  const x = await page.evaluate(() => dcsmcraft.player.x);
  expect(x).toBeGreaterThan(15.4);
  expect(x).toBeLessThanOrEqual(15.70001);
  await page.evaluate(() => {
    const p = dcsmcraft.player;
    Object.assign(p, {
      x: 15.69999,
      y: 201.2,
      z: 0.5,
      onGround: false,
      vy: 0,
      vx: 0,
      vz: 0,
      tricksterRecharges: [],
      tricksterAirUsed: false,
      tricksterWallUsed: false,
    });
  });
  await page.keyboard.down("Space");
  await page.mouse.click(640, 400, { button: "right" });
  await page.keyboard.up("Space");
  await expect
    .poll(() => page.evaluate(() => dcsmcraft.player.tricksterWallUsed))
    .toBe(true);
  await expect
    .poll(() => page.evaluate(() => dcsmcraft.player.y))
    .toBeGreaterThan(201.2);
  await healthy(page, errors);
});
test("standalone emerging shrine survives reload, real attacks defeat four guards, altar awards one pair and reload preserves it", async ({
  page,
}) => {
  test.setTimeout(300000);
  const errors = await create(page);
  await arena(page, { emerge: true });
  await page.waitForFunction(
    () => dcsmcraft.world.settlements["matthew-incursion"].age >= 65,
  );
  const id = await page.evaluate(async () => {
    dcsmcraft.pause();
    await dcsmcraft.save();
    return dcsmcraft.id;
  });
  await page.reload();
  await page.waitForFunction(() => dcsmcraft?.initialized);
  await page.evaluate(async (id) => {
    await dcsmcraft.loadWorld(id);
    dcsmcraft.pointerLockFallback = true;
  }, id);
  await expect
    .poll(() =>
      page.evaluate(() => dcsmcraft.world.settlements["matthew-incursion"].age),
    )
    .toBeGreaterThan(65);
  await page.waitForFunction(
    () => dcsmcraft.world.settlements["matthew-incursion"].phase === "battle",
    null,
    { timeout: 60000 },
  );
  expect(
    await page.evaluate(
      () =>
        dcsmcraft.entities.filter((e) => e.encounter === "matthew-incursion")
          .length,
    ),
  ).toBe(4);
  await page.evaluate(
    ({ sword, armor }) => {
      const g = dcsmcraft;
      g.mode = "survival";
      g.inventory.slots.fill(null);
      g.inventory.slots[0] = sword;
      g.inventory.equipment = armor;
      g.inventory.selected = 0;
      g.player.health = 20;
      g.player.food = 20;
      g.player.saturation = 20;
    },
    {
      sword: makeStack("devin_sword"),
      armor: ["helmet", "chestplate", "leggings", "boots"].map((s) =>
        makeStack("hellfire_" + s),
      ),
    },
  );
  // Use a fighting bay and retreat behind real cover between full-cooldown
  // strikes. Elite guards can kill the old stationary test actor.
  await page.evaluate(B=>{
    const g=dcsmcraft;
    for(let y=200;y<=203;y++) {
      for(let z=-3;z<=8;z++) for(const x of [8,16]) g.world.set(x,y,z,B.stone);
      for(let x=8;x<=16;x++) for(const z of [-3,8,4]) g.world.set(x,y,z,B.stone);
    }
  },B);
  // Actual left-click attacks and right-click Pulse; only camera/arena positions
  // are fixtures. HP, damage resistance, cooldowns and permanent defeats are real.
  for (let index = 0; index < 4; index++) {
    for (let hit = 0; hit < 24; hit++) {
      const exists = await page.evaluate((i) => {
        const g = dcsmcraft,
          e = g.entities.find(
            (e) =>
              e.encounter === "matthew-incursion" &&
              e.invasionIndex === i &&
              e.hp > 0,
          );
        if (!e) return false;
        Object.assign(e, { x: 12.5, y: 200, z: 0.5, vx: 0, vy: 0, vz: 0 });
        Object.assign(g.player, {
          x: e.x,
          y: e.y,
          z: e.z + 6.5,
          vx: 0,
          vy: 0,
          vz: 0,
          onGround: true,
          yaw: 0,
          pitch: 0,
        });
        g.player.yaw = Math.atan2(g.player.x - e.x, g.player.z - e.z);
        g.player.pitch = Math.atan2(e.y + 1.1 - g.player.y - 1.62, 1.9);
        g.pointerLockFallback = true;
        return true;
      }, index);
      if (!exists) break;
      await page.waitForTimeout(650);
      await page.evaluate((i) => {
        const g = dcsmcraft,
          e = g.entities.find(
            (e) =>
              e.encounter === "matthew-incursion" &&
              e.invasionIndex === i &&
              e.hp > 0,
          );
        if (!e) return;
        Object.assign(e, { x: 12.5, y: 200, z: 0.5, vx: 0, vy: 0, vz: 0 });
        Object.assign(g.player, {
          x: e.x,
          y: e.y,
          z: e.z + 1.9,
          vx: 0,
          vy: 0,
          vz: 0,
          yaw: 0,
        });
        const height =
          e.type === "basalt_crawler"
            ? 0.8
            : e.type === "cinder_wraith"
              ? 2.1
              : e.type === "magma_maw" ? 1.25
                : e.type === "dread_knight" ? 2.8
                  : e.type === "soul_reaver" ? 2.45 : 1.95;
        g.player.pitch = Math.atan2(height * 0.55 - 1.62, 1.9);
      }, index);
      await page.waitForTimeout(100);
      await page.mouse.click(640, 400);
    }
    await expect
      .poll(() =>
        page.evaluate(
          (i) =>
            dcsmcraft.world.settlements["matthew-incursion"].defeated.includes(
              i,
            ),
          index,
        ),
      )
      .toBe(true);
  }
  await expect
    .poll(() =>
      page.evaluate(
        () => dcsmcraft.world.settlements["matthew-incursion"].phase,
      ),
    )
    .toBe("ready");
  expect(await page.evaluate(() => dcsmcraft.player.health)).toBeGreaterThan(0);
  await page.evaluate(() => {
    Object.assign(dcsmcraft.player, {
      x: 0.5,
      y: 200,
      z: 3.5,
      vx: 0,
      vy: 0,
      vz: 0,
      onGround: true,
    });
    dcsmcraft.pointerLockFallback = true;
  });
  await aim(page, { x: 0.5, y: 201.5, z: 0.5 });
  await page.evaluate(() => {
    for (let i = 0; i < 36; i++)
      dcsmcraft.inventory.slots[i] = { id: "stone", count: 64 };
  });
  await page.mouse.click(640, 400, { button: "right" });
  expect(
    await page.evaluate(
      () => dcsmcraft.world.settlements["matthew-incursion"].phase,
    ),
  ).toBe("ready");
  await page.evaluate(() => {
    dcsmcraft.inventory.slots[4] = null;
  });
  await page.mouse.click(640, 400, { button: "right" });
  await expect
    .poll(() =>
      page.evaluate(
        () => dcsmcraft.world.settlements["matthew-incursion"].phase,
      ),
    )
    .toBe("claimed");
  await page.mouse.click(640, 400, { button: "right" });
  expect(
    await page.evaluate(
      () =>
        dcsmcraft.inventory.slots.filter(
          (s) => s?.id === "matthew_dual_pistols",
        ).length,
    ),
  ).toBe(1);
  await page.evaluate(async () => {
    dcsmcraft.pause();
    await dcsmcraft.save();
  });
  await page.reload();
  await page.waitForFunction(() => dcsmcraft?.initialized);
  await page.evaluate(async (id) => {
    await dcsmcraft.loadWorld(id);
    dcsmcraft.pause();
  }, id);
  expect(
    await page.evaluate(
      () => dcsmcraft.world.settlements["matthew-incursion"].phase,
    ),
  ).toBe("claimed");
  expect(
    await page.evaluate(
      () =>
        dcsmcraft.inventory.slots.filter(
          (s) => s?.id === "matthew_dual_pistols",
        ).length,
    ),
  ).toBe(1);
  expect(
    await page.evaluate(
      () => dcsmcraft.world.settlements["matthew-incursion"].defeated.length,
    ),
  ).toBe(4);
  await healthy(page, errors);
});

test("standalone held pistols open doors and crafting tables before using Dash", async ({
  page,
}) => {
  const errors = await create(page);
  await arena(page);
  await page.evaluate((B) => {
    const g = dcsmcraft;
    Object.assign(g.player, {
      x: 0.5,
      y: 200,
      z: 10.5,
      yaw: 0,
      pitch: 0,
      vx: 0,
      vy: 0,
      vz: 0,
    });
    g.world.set(0, 200, 6, B.oak_door);
    g.world.set(0, 201, 6, B.oak_door + 1);
    g.world.set(3, 200, 7, B.crafting_table);
  }, B);
  await aim(page, { x: 0.5, y: 201.2, z: 6.05 });
  await page.mouse.click(640, 400, { button: "right" });
  await expect
    .poll(() => page.evaluate(() => dcsmcraft.world.get(0, 200, 6)))
    .toBe(B.oak_door + 2);
  expect(await page.evaluate(() => dcsmcraft.player.z)).toBeCloseTo(10.5, 2);
  await page.evaluate(() => {
    Object.assign(dcsmcraft.player, {
      x: 3.5,
      y: 200,
      z: 10.5,
      vx: 0,
      vy: 0,
      vz: 0,
    });
  });
  await aim(page, { x: 3.5, y: 200.5, z: 7.5 });
  await page.mouse.click(640, 400, { button: "right" });
  await expect
    .poll(() => page.evaluate(() => dcsmcraft.ui.screen))
    .toBe("inventory");
  expect(errors).toEqual([]);
});
