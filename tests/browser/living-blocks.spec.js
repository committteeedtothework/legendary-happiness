import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { B, makeStack } from "../../src/data.js";
const html = readFileSync("dist/DCSMCRAFT-Standalone.html", "utf8");
async function create(page) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (/Shader Error|GL_INVALID|WebGLProgram|texSubImage/.test(m.text()))
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
    r.request().url().endsWith("/living-blocks.html")
      ? r.fulfill({ contentType: "text/html", body: html })
      : r.abort(),
  );
  await page.goto("/living-blocks.html");
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
    g.difficulty = "peaceful";
    for (let x = -12; x <= 26; x++)
      for (let z = -10; z <= 10; z++) g.world.set(x, 199, z, B.stone);
    Object.assign(g.player, {
      x: 0.5,
      y: 200,
      z: 3.5,
      yaw: 0,
      pitch: -Math.atan2(1.62, 3),
      flying: false,
      vx: 0,
      vy: 0,
      vz: 0,
      health: 20,
    });
    g.inventory.slots.fill(null);
    g.ui.play();
    g.running = true;
    g.pointerLockFallback = true;
    g.ui.root.querySelector("#cycle-banner")?.classList.remove("show");
  }, B);
  await page.mouse.move(640, 400);
  return errors;
}
async function aim(page, item, point = { x: 0.5, y: 200, z: 0.5 }) {
  await page.evaluate(
    ({ stack, point }) => {
      const g = dcsmcraft,
        p = g.player;
      g.inventory.slots[g.inventory.selected] = stack;
      const dx = point.x - p.x,
        dz = point.z - p.z;
      p.yaw = Math.atan2(-dx, -dz);
      p.pitch = Math.atan2(point.y - p.y - 1.62, Math.hypot(dx, dz));
      g.lastPlace = -10;
      g.ui.updateHotbar();
    },
    { stack: makeStack(item), point },
  );
  await page.waitForTimeout(200);
}
test("standalone real right-click ignites a normal floor and collects/replaces a source with the same bucket", async ({
  page,
}) => {
  const errors = await create(page);
  await aim(page, "flint_and_steel");
  await page.mouse.click(640, 400, { button: "right" });
  await expect
    .poll(() => page.evaluate(() => dcsmcraft.world.get(0, 200, 0)))
    .toBe(B.fire);
  await page.evaluate((B) => {
    dcsmcraft.world.set(0, 200, 0, B.water);
  }, B);
  await aim(page, "bucket");
  await page.mouse.click(640, 400, { button: "right" });
  await expect
    .poll(() => page.evaluate(() => dcsmcraft.inventory.held?.id))
    .toBe("water_bucket");
  expect(await page.evaluate(() => dcsmcraft.world.get(0, 200, 0))).not.toBe(
    B.water,
  );
  await page.evaluate(() => {
    dcsmcraft.mode = "survival";
    dcsmcraft.lastPlace = -10;
  });
  await page.waitForTimeout(250);
  await page.mouse.click(640, 400, { button: "right" });
  await expect
    .poll(() => page.evaluate(() => dcsmcraft.inventory.held?.id))
    .toBe("bucket");
  expect(await page.evaluate(() => dcsmcraft.world.get(0, 200, 0))).toBe(
    B.water,
  );
  await page.waitForFunction(() => dcsmcraft.renderer.meshes.size >= 9);
  expect(
    await page.evaluate(() => dcsmcraft.renderer.gl.getContext().getError()),
  ).toBe(0);
  expect(errors).toEqual([]);
});
test("standalone renders flowing levels across a chunk edge and preserves fluids, new items and TNT fuse through persistent reload", async ({
  page,
}) => {
  const errors = await create(page);
  const saved = await page.evaluate(
    async ({ B, stack }) => {
      const g = dcsmcraft;
      g.pause();
      g.world.set(15, 200, 0, B.water);
      for (let i = 0; i < 120; i++) g.world.simulate();
      g.world.set(4, 200, 4, B.primed_tnt);
      for (let i = 0; i < 31; i++) g.world.simulate();
      g.inventory.slots[0] = stack;
      Object.assign(g.player, {
        x: 15.5,
        y: 203,
        z: 9.5,
        yaw: 0,
        pitch: -0.4,
        flying: true,
      });
      g.ui.play();
      g.running = false;
      await g.save();
      return {
        id: g.id,
        flow: g.world.get(16, 200, 0),
        fuse: g.world.blockTimers["4,200,4"].ticks,
        atlas: [g.renderer.atlas.canvas.width, g.renderer.atlas.canvas.height],
      };
    },
    { B, stack: makeStack("golden_pickaxe") },
  );
  expect(saved.flow).toBe(B.water_flow_1);
  expect(saved.fuse).toBe(49);
  expect(saved.atlas).toEqual([256, 512]);
  await page.screenshot({
    path: "/workspace/artifacts/DCSMCRAFT-v1.2.0-flowing-water.png",
  });
  await page.reload();
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  const after = await page.evaluate(async (id) => {
    const g = dcsmcraft;
    await g.loadWorld(id);
    g.pause();
    return {
      flow: g.world.get(16, 200, 0),
      fuse: g.world.blockTimers["4,200,4"].ticks,
      held: g.inventory.held?.id,
    };
  }, saved.id);
  expect(after).toEqual({
    flow: B.water_flow_1,
    fuse: 49,
    held: "golden_pickaxe",
  });
  const drained = await page.evaluate((B) => {
    const g = dcsmcraft;
    g.world.set(15, 200, 0, B.air);
    for (let i = 0; i < 300; i++) g.world.simulate();
    return g.world.get(16, 200, 0);
  }, B);
  expect(drained).toBe(B.air);
  expect(errors).toEqual([]);
});
test("standalone cactus contact damages Survival players and water extinguishes their burning status", async ({
  page,
}) => {
  const errors = await create(page);
  await page.evaluate((B) => {
    const g = dcsmcraft;
    g.mode = "survival";
    g.world.set(1, 200, 0, B.cactus);
    Object.assign(g.player, {
      x: 0.75,
      y: 200,
      z: 0.5,
      vx: 0,
      vy: 0,
      vz: 0,
      health: 20,
    });
  }, B);
  await expect
    .poll(() => page.evaluate(() => dcsmcraft.player.health))
    .toBeLessThan(20);
  await page.evaluate((B) => {
    const g = dcsmcraft;
    Object.assign(g.player, { x: -4.5, y: 200, z: 0.5, burning: 100 });
    g.world.set(-5, 200, 0, B.water);
  }, B);
  await expect
    .poll(() => page.evaluate(() => dcsmcraft.player.burning))
    .toBe(0);
  expect(errors).toEqual([]);
});
test("standalone real flint-and-steel ignition starts a four-second TNT fuse and a terrain-changing explosion", async ({
  page,
}) => {
  const errors = await create(page);
  await page.evaluate((B) => {
    dcsmcraft.world.set(0, 200, 0, B.tnt);
    dcsmcraft.world.set(1, 200, 0, B.planks);
  }, B);
  await aim(page, "flint_and_steel", { x: 0.5, y: 200.5, z: 0.5 });
  await page.mouse.click(640, 400, { button: "right" });
  await expect
    .poll(() => page.evaluate(() => dcsmcraft.world.get(0, 200, 0)))
    .toBe(B.primed_tnt);
  expect(
    await page.evaluate(() => dcsmcraft.world.blockTimers["0,200,0"].ticks),
  ).toBeGreaterThan(55);
  await page.evaluate(() => {
    dcsmcraft.player.flying = true;
    dcsmcraft.player.y = 203;
  });
  await expect
    .poll(() => page.evaluate(() => dcsmcraft.world.get(0, 200, 0)), {
      timeout: 18000,
    })
    .toBe(B.air);
  expect(await page.evaluate(() => dcsmcraft.world.get(1, 200, 0))).toBe(B.air);
  expect(
    await page.evaluate(() => dcsmcraft.renderer.gl.getContext().getError()),
  ).toBe(0);
  expect(errors).toEqual([]);
});
test("real tick simulation shows cleave, aimed ground-sigil and five-bolt warnings with dodge windows", async ({
  page,
}) => {
  const errors = await create(page);
  for (const [role, kind, radius] of [
    [0, "cleave", 4.5],
    [1, "sigil", 2.8],
    [2, "fan", 1.4],
  ]) {
    await page.evaluate(
      ({ role }) => {
        const g = dcsmcraft;
        g.mode = "survival";
        g.difficulty = "normal";
        g.time = 1000;
        Object.assign(g.player, {
          x: 0.5,
          y: 200,
          z: role === 0 ? 3.5 : 6.5,
          health: 20,
          hurt: 0,
          flying: false,
          vx: 0,
          vy: 0,
          vz: 0,
        });
        g.hostileProjectiles = [];
        g.entities = [
          {
            id: "sentinel",
            type: "devin_guardian",
            x: 0.5,
            y: 200,
            z: 0.5,
            vx: 0,
            vy: 0,
            vz: 0,
            hp: 100,
            yaw: Math.PI,
            age: 0,
            attack: 0,
            hurt: 0,
            turn: 0,
            dir: 0,
            speed: 0,
            onGround: true,
            guardianIndex: role,
            specialCycle: 1,
            specialCooldown: 0,
          },
        ];
      },
      { role },
    );
    await page.waitForFunction(
      (kind) => dcsmcraft.entities[0]?.special === kind,
      kind,
    );
    const warning = await page.evaluate(() => {
      const g = dcsmcraft,
        e = g.entities[0],
        m = g.renderer.mobMeshes.get(e.id),
        ring = m?.userData.warning;
      if (!ring) return null;
      const pos = ring.getWorldPosition(ring.position.clone());
      return {
        visible: ring.visible,
        radius: ring.scale.x,
        x: pos.x,
        z: pos.z,
        mark: e.specialTarget,
        color: ring.material.color.getHexString(),
      };
    });
    expect(warning?.visible).toBe(true);
    expect(warning.radius).toBe(radius);
    if (kind === "sigil") {
      expect(warning.x).toBeCloseTo(warning.mark.x, 1);
      expect(warning.z).toBeCloseTo(warning.mark.z, 1);
      expect(warning.color).toBe("70edff");
      await page.screenshot({
        path: "/workspace/artifacts/DCSMCRAFT-v1.2.0-guardian-sigil.png",
      });
    }
    await page.evaluate(() => {
      Object.assign(dcsmcraft.player, {
        x: 8,
        y: 200,
        z: 6.5,
        vx: 0,
        vy: 0,
        vz: 0,
      });
    });
    if (kind === "fan") {
      await page.waitForFunction(
        () => dcsmcraft.hostileProjectiles.length === 5,
      );
      await page.waitForFunction(
        () => dcsmcraft.renderer.projectileMeshes.size === 5,
      );
    } else await page.waitForFunction(() => !dcsmcraft.entities[0]?.special);
    expect(await page.evaluate(() => dcsmcraft.player.health)).toBe(20);
  }
  expect(errors).toEqual([]);
});
