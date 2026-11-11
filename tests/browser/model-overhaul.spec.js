import { World } from "../../src/world.js";
import { relicSite } from "../../src/relic.js";
import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import { B, ITEMS, makeStack } from "../../src/data.js";
import { INFERNAL_STYLES } from "../../src/infernal-models.js";
const html = readFileSync("dist/DCSMCRAFT-Standalone.html", "utf8");
const captures = "/workspace/artifacts/model-overhaul-playtest";
mkdirSync(captures, { recursive: true });
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
        musicEnabled: false,
        particles: "all",
      }),
    ),
  );
  await page.route("**/*", (r) =>
    r.request().url().endsWith("/models.html")
      ? r.fulfill({ contentType: "text/html", body: html })
      : r.abort(),
  );
  await page.goto("/models.html");
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
    for (let x = -12; x <= 12; x++)
      for (let z = -15; z <= 15; z++) g.world.set(x, 199, z, B.stone);
    Object.assign(g.player, {
      x: 0.5,
      y: 200,
      z: 5.5,
      yaw: 0,
      pitch: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      health: 20,
      flying: false,
      onGround: true,
      fallStart: 200,
    });
    g.ui.play();
    g.running = false;
    g.pointerLockFallback = true;
    g.renderer.loadAround(0.5, 5.5, 2, 9);
  }, B);
  await page.waitForFunction(() => dcsmcraft.renderer.meshes.size >= 9);
  return errors;
}
async function hold(page, id) {
  await page.evaluate((s) => {
    const g = dcsmcraft;
    g.inventory.slots[0] = s;
    g.inventory.selected = 0;
    g.renderer.setHeld(s.id, s);
    g.renderer.animator.reset();
    g.renderer.animator.equip = 0;
    g.ui.updateHotbar();
  }, makeStack(id));
  await page.waitForTimeout(130);
}
async function photo(page, name) {
  await page.evaluate(() => {
    document.querySelector("#cycle-banner")?.classList.remove("show");
    document.querySelector("#toast")?.classList.remove("show");
  });
  await page.screenshot({ path: captures + "/" + name + ".png" });
  expect(
    await page.evaluate(() => dcsmcraft.renderer.gl.getContext().getError()),
  ).toBe(0);
}
test("offline all weapon/tool silhouettes render in hand and as drops; flint/steel is a flat alpha cutout while working blocks and pistols remain", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors = await create(page);
  const ids = Object.keys(ITEMS).filter((id) =>
    ["sword", "spear", "axe", "pickaxe", "shovel", "hoe"].includes(
      ITEMS[id].tool,
    ),
  );
  const result = await page.evaluate((ids) => {
    const r = dcsmcraft.renderer,
      out = [];
    for (const id of ids) {
      r.setHeld(id);
      let draws = 0,
        finite = true;
      r.heldMesh.traverse((o) => {
        if (o.isMesh) {
          draws++;
          finite &&= o.geometry.attributes.position.array.every(
            Number.isFinite,
          );
        }
      });
      out.push({
        id,
        draws,
        finite,
        profile: r.heldMesh.userData.pixelProfile,
        attached: r.heldMesh.parent === r.handRig.grip,
      });
    }
    return out;
  }, ids);
  expect(result).toHaveLength(42);
  expect(
    result.every((r) => r.finite && r.profile && r.attached && r.draws <= 5),
  ).toBe(true);
  for (const id of [
    "iron_sword",
    "diamond_axe",
    "diamond_pickaxe",
    "iron_shovel",
    "iron_hoe",
    "hellfire_spear",
    "devin_sword",
  ]) {
    await hold(page, id);
    await photo(page, id + "-held");
  }
  await hold(page, "flint_and_steel");
  await photo(page, "flint-and-steel-held");
  const flat = await page.evaluate(() => {
    const r = dcsmcraft.renderer,
      m = r.heldMesh.children[0],
      c = m.material.map.image,
      d = c.getContext("2d").getImageData(0, 0, 32, 32).data;
    return {
      flat: r.heldMesh.userData.flatCutout,
      geometry: m.geometry.type,
      hole: d[(15 * 32 + 12) * 4 + 3],
      solid: d[(10 * 32 + 5) * 4 + 3],
      sides: m.material.side,
    };
  });
  expect(flat).toEqual({
    flat: true,
    geometry: "PlaneGeometry",
    hole: 0,
    solid: 255,
    sides: 2,
  });
  const ignition = await page.evaluate((B) => {
    const g = dcsmcraft;
    g.target = {
      x: 0,
      y: 199,
      z: 3,
      id: B.stone,
      normal: { x: 0, y: 1, z: 0 },
    };
    g.lastPlace = -100;
    g.use();
    return {
      fire: g.world.get(0, 200, 3),
      durability: g.inventory.held.durability,
    };
  }, B);
  expect(ignition.fire).toBe(B.fire);
  expect(ignition.durability).toBe(64);
  const survivalIgnition = await page.evaluate((B) => {
    const g = dcsmcraft;
    g.mode = "survival";
    g.target = {
      x: 1,
      y: 199,
      z: 3,
      id: B.stone,
      normal: { x: 0, y: 1, z: 0 },
    };
    g.lastPlace = -100;
    g.use();
    return {
      fire: g.world.get(1, 200, 3),
      durability: g.inventory.held.durability,
    };
  }, B);
  expect(survivalIgnition.fire).toBe(B.fire);
  expect(survivalIgnition.durability).toBe(63);
  await page.evaluate(() => {
    dcsmcraft.mode = "creative";
    dcsmcraft.running = true;
    dcsmcraft.pointerLockFallback = true;
  });
  await page.keyboard.press("q");
  await page.waitForFunction(() =>
    dcsmcraft.drops.some((d) => d.id === "flint_and_steel"),
  );
  const dropped = await page.evaluate(() => {
    const g = dcsmcraft;
    g.pause();
    g.ui.play();
    const d = g.drops.find((d) => d.id === "flint_and_steel");
    g.renderer.syncEntities(g.entities, g.drops, 0, 0);
    const model = g.renderer.dropMeshes.get(d.uid);
    return {
      flat: model.children[0].userData.flatCutout,
      geometry: model.children[0].children[0].geometry.type,
    };
  });
  expect(dropped).toEqual({ flat: true, geometry: "PlaneGeometry" });
  await hold(page, "matthew_dual_pistols");
  expect(
    await page.evaluate(() => dcsmcraft.renderer.heldMesh.userData.finish),
  ).toBe("silver");
  await hold(page, "planks");
  expect(
    await page.evaluate(
      () => dcsmcraft.renderer.heldMesh.children[0].geometry.type,
    ),
  ).toBe("BoxGeometry");
  const id = await page.evaluate(async () => {
    await dcsmcraft.save();
    return dcsmcraft.id;
  });
  await page.reload();
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.evaluate((id) => dcsmcraft.loadWorld(id), id);
  await page.waitForFunction(() => dcsmcraft.active);
  await page.evaluate(() => dcsmcraft.pause());
  expect(await page.evaluate(() => dcsmcraft.world.get(0, 199, 0))).toBe(
    B.stone,
  );
  expect(errors).toEqual([]);
});
test("real sword hits, staged F5 weapon swings and minimal-particle Devin flair render without detached grips or extra idle motes", async ({
  page,
}) => {
  const errors = await create(page);
  await page.evaluate((B) => {
    const g = dcsmcraft;
    Object.assign(g.player, { x: 0.5, y: 200, z: 3.2, yaw: 0, pitch: -0.12 });
    g.inventory.slots[0] = { id: "cow_spawn_egg", count: 64 };
    g.target = {
      x: 0,
      y: 199,
      z: 0,
      id: B.stone,
      normal: { x: 0, y: 1, z: 0 },
    };
    g.lastPlace = -100;
    g.use();
    const e = g.entities.find((e) => e.type === "cow");
    e.hp = 100;
  }, B);
  await hold(page, "iron_sword");
  await page.evaluate(() => {
    const g = dcsmcraft;
    g.target = null;
    g.lastAttack = g.elapsed - 2;
    g.renderer.gl.domElement.dispatchEvent(
      new MouseEvent("mousedown", { button: 0, bubbles: true }),
    );
  });
  expect(
    await page.evaluate(
      () => dcsmcraft.entities.find((e) => e.type === "cow").hp,
    ),
  ).toBeLessThan(100);
  await page.evaluate(() => {
    const g = dcsmcraft;
    g.running = true;
    g.ui.play();
  });
  await page.keyboard.press("F5");
  await page.keyboard.press("F5");
  await page.waitForFunction(
    () => dcsmcraft.renderer.playerModel?.userData.forearms?.length === 2,
  );
  for (const id of ["iron_sword", "hellfire_spear", "devin_sword"]) {
    await hold(page, id);
    await page.waitForFunction(
      (id) =>
        dcsmcraft.renderer.playerModel?.userData.grip.children[0]?.userData
          .weaponModel === id,
      id,
    );
    await page.evaluate(() => {
      const g = dcsmcraft;
      g.pause();
      g.ui.play();
      g.renderer.action("attack");
      g.renderer.animator.action.age = 0.12;
      g.renderer.draw({
        player: g.player,
        equipment: g.inventory.equipment,
        playing: true,
        cameraMode: 2,
        time: g.time,
        elapsed: g.renderer.lastTime + 0.02,
        animating: true,
      });
    });
    await page.waitForTimeout(100);
    await photo(page, id + "-f5-swing");
    const contact = await page.evaluate(() => {
      const u = dcsmcraft.renderer.playerModel.userData;
      return u.grip.parent === u.forearms[1];
    });
    expect(contact).toBe(true);
  }
  await page.evaluate(() => {
    const g = dcsmcraft;
    g.settings.particles = "minimal";
    g.renderer.arcane.clear();
  });
  await page.waitForTimeout(200);
  expect(
    await page.evaluate(() => {
      let visible = 0;
      dcsmcraft.renderer.playerModel.traverse((o) => {
        if (
          (o.userData.magicGlint !== undefined || o.userData.bladeSheen) &&
          o.visible
        )
          visible++;
      });
      return visible;
    }),
  ).toBe(0);
  await page.evaluate(
    (site) => {
      const g = dcsmcraft;
      g.pause();
      g.ui.play();
      g.cameraMode = 0;
      g.entities = [];
      g.inventory.slots[0] = null;
      g.world.ensure(Math.floor(site.x / 16), Math.floor(site.z / 16));
      Object.assign(g.player, {
        x: site.x + 0.5,
        y: site.y,
        z: site.z + 4.2,
        yaw: 0,
        pitch: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        flying: false,
        fallStart: site.y,
      });
      g.renderer.loadAround(g.player.x, g.player.z, 2, 9);
      g.settings.particles = "all";
    },
    relicSite(new World("Wildflower")),
  );
  await page.waitForFunction(
    () => dcsmcraft.renderer.arcane.relicDisplay?.visible,
  );
  expect(
    await page.evaluate(
      () => dcsmcraft.renderer.arcane.relicDisplay.userData.goldenGrip,
    ),
  ).toBe(true);
  await photo(page, "devin-sword-planted");
  expect(errors).toEqual([]);
});
test("player uses actual water physics with first-person paddling, F5 prone swimming and stationary treading, then recovers on land", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors = await create(page);
  await hold(page, "iron_sword");
  await page.evaluate((B) => {
    const g = dcsmcraft;
    g.entities = [];
    for (let x = -7; x <= 7; x++)
      for (let z = -7; z <= 7; z++) {
        g.world.set(x, 196, z, B.stone);
        for (let y = 197; y <= 201; y++)
          g.world.set(
            x,
            y,
            z,
            Math.abs(x) === 7 || Math.abs(z) === 7 ? B.stone : B.water,
          );
      }
    Object.assign(g.player, {
      x: 0.5,
      y: 201.0,
      z: 5.5,
      vx: 0,
      vy: 0,
      vz: 0,
      flying: false,
      onGround: false,
      fallStart: 201,
      yaw: 0,
      pitch: 0,
    });
    g.ui.play();
    g.running = true;
    g.pointerLockFallback = true;
  }, B);
  await page.keyboard.down("w");
  await page.waitForFunction(
    () => dcsmcraft.player.inWater && dcsmcraft.renderer.animator.swim > 0.9,
  );
  expect(
    await page.evaluate(() => ({
      left: dcsmcraft.renderer.leftHandRig.root.visible,
      pistol: dcsmcraft.renderer.leftPistol.visible,
    })),
  ).toEqual({ left: true, pistol: false });
  await photo(page, "swim-first-person");
  await page.keyboard.press("F5");
  await page.keyboard.press("F5");
  await page.waitForFunction(
    () => dcsmcraft.renderer.playerModel?.userData.prone > 0.9,
  );
  await photo(page, "swim-f5-prone");
  await page.keyboard.up("w");
  await page.waitForFunction(
    () => dcsmcraft.renderer.playerModel.userData.prone < 0.1,
  );
  const arm = await page.evaluate(
    () => dcsmcraft.renderer.playerModel.userData.arms[0].rotation.x,
  );
  await page.waitForTimeout(500);
  expect(
    Math.abs(
      arm -
        (await page.evaluate(
          () => dcsmcraft.renderer.playerModel.userData.arms[0].rotation.x,
        )),
    ),
  ).toBeGreaterThan(0.02);
  await photo(page, "swim-f5-treading");
  await page.evaluate(() => {
    const g = dcsmcraft;
    Object.assign(g.player, {
      x: 10.5,
      y: 200,
      z: 5.5,
      vx: 0,
      vy: 0,
      vz: 0,
      inWater: false,
      underwater: false,
      onGround: true,
      fallStart: 200,
    });
  });
  await page.waitForFunction(
    () => dcsmcraft.renderer.playerModel.userData.swim < 0.01,
  );
  expect(
    await page.evaluate(() =>
      Math.abs(dcsmcraft.renderer.playerModel.userData.rig.rotation.x),
    ),
  ).toBeLessThan(0.02);
  expect(errors).toEqual([]);
});
test("all redesigned Cinderworld foes render their unique rigs, articulate specials, and restore glowing material after damage flash", async ({
  page,
}) => {
  test.setTimeout(120000);
  const errors = await create(page);
  await page.evaluate(
    ({ B, types }) => {
      const g = dcsmcraft,
        World = g.world.constructor;
      g.world = new World("Wildflower", {}, "cinderwild");
      g.dimension = "cinderwild";
      g.renderer.setWorld(g.world);
      g.entities = [];
      g.drops = [];
      for (let x = -17; x <= 17; x++)
        for (let z = -15; z <= 15; z++) {
          g.world.set(x, 279, z, B.cinderstone);
          for (let y = 280; y < 289; y++) g.world.set(x, y, z, B.air);
        }
      Object.assign(g.player, {
        x: 0.5,
        y: 281,
        z: 10.5,
        yaw: 0,
        pitch: -0.1,
        vx: 0,
        vy: 0,
        vz: 0,
        flying: true,
        health: 20,
      });
      g.inventory.slots[0] = null;
      for (const [i, type] of types.entries()) {
        const e = {
          id: "design-" + type,
          type,
          x: -8 + i * 2.4,
          y: 280,
          z: i === 7 ? -6 : 0,
          hp: 1000,
          yaw: Math.PI,
          age: 0,
          attack: 0,
          hurt: 0,
          vx: 0,
          vy: 0,
          vz: 0,
          onGround: true,
          speed: 0,
          turn: 0,
          dir: 0,
        };
        g.entities.push(e);
      }
      g.renderer.loadAround(0.5, 10.5, 2, 9);
      g.ui.play();
      g.running = false;
    },
    { B, types: INFERNAL_STYLES },
  );
  await page.waitForFunction(() => dcsmcraft.renderer.mobMeshes.size === 8);
  await photo(page, "cinderworld-roster");
  const report = await page.evaluate(() => {
    const r = dcsmcraft.renderer,
      out = [];
    for (const e of dcsmcraft.entities) {
      const u = r.mobMeshes.get(e.id).userData;
      let draws = 0;
      r.mobMeshes.get(e.id).traverse((o) => {
        if (o.isMesh) draws++;
      });
      out.push({
        style: u.infernalStyle,
        draws,
        glow: u.materials.some((m) => m.emissive.getHex() !== 0),
      });
    }
    const e = dcsmcraft.entities.find((e) => e.type === "soul_reaver");
    e.hurt = 1;
    r.syncEntities(dcsmcraft.entities, [], 1, 0.016);
    e.hurt = 0;
    r.syncEntities(dcsmcraft.entities, [], 1.1, 0.016);
    return {
      out,
      rest: r.mobMeshes
        .get(e.id)
        .userData.materials.every((m) =>
          m.emissive.equals(m.userData.restEmissive),
        ),
    };
  });
  expect(report.out.every((v) => v.glow && v.draws < 30)).toBe(true);
  expect(report.rest).toBe(true);
  for (const type of [
    "soul_reaver",
    "magma_maw",
    "dread_knight",
    "mad_titan",
  ]) {
    await page.evaluate((type) => {
      const g = dcsmcraft,
        e = g.entities.find((e) => e.type === type);
      e.castTicks = 12;
      e.special = type === "mad_titan" ? "slam" : null;
      e.attack = 2;
      Object.assign(g.player, {
        x: e.x,
        y: type === "mad_titan" ? 282 : 280.3,
        z: e.z + (type === "mad_titan" ? 7 : 4),
        yaw: 0,
        pitch: 0,
      });
      g.renderer.syncEntities(g.entities, [], 2, 0.016);
    }, type);
    await page.waitForTimeout(120);
    await photo(page, "cinder-" + type);
  }
  expect(errors).toEqual([]);
});
