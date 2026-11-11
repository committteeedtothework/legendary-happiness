import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import { B, ITEMS, MOB_INFO, makeStack } from "../../src/data.js";
import { OVERWORLD_STYLES } from "../../src/overworld-models.js";
import { VILLAGE_STYLES } from "../../src/village-styles.js";
import { isFlatItem } from "../../src/item-shapes.js";
import { EXTRA_ART } from "../../src/block-art.js";
const html = readFileSync("dist/DCSMCRAFT-Standalone.html", "utf8");
const captures = "/workspace/artifacts/field-form-playtest";
mkdirSync(captures, { recursive: true });
async function create(page, offline = true) {
  const errors = [],
    external = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (/Shader Error|GL_INVALID|WebGLProgram/.test(m.text()))
      errors.push(m.text());
  });
  await page.addInitScript(() =>
    localStorage.setItem(
      "dcsmcraft-settings",
      JSON.stringify({
        texturePack: "supplied",
        renderDistance: 2,
        graphics: 3,
        frameLimit: 30,
        volume: 0,
        musicEnabled: false,
        clouds: false,
        distantTerrain: false,
      }),
    ),
  );
  if (offline)
    await page.route("**/*", (r) =>
      r.request().url().endsWith("/field.html")
        ? r.fulfill({ contentType: "text/html", body: html })
        : (external.push(r.request().url()), r.abort()),
    );
  await page.goto(offline ? "/field.html" : "/");
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
    for (let x = -9; x <= 9; x++)
      for (let z = -6; z <= 9; z++) g.world.set(x, 199, z, B.smooth_stone);
    Object.assign(g.player, {
      x: 0,
      y: 200,
      z: 7,
      yaw: 0,
      pitch: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      onGround: true,
      flying: false,
    });
    g.inventory.slots[0] = null;
    g.renderer.setHeld(null);
    g.time = 6000;
    g.ui.play();
    g.running = false;
    g.pointerLockFallback = true;
    g.renderer.loadAround(0, 7, 2, 9);
  }, B);
  await page.waitForFunction(() => dcsmcraft.renderer.meshes.size >= 9);
  return { errors, external };
}
function entities(types) {
  return types.map((type, i) => ({
    id: "portrait-" + type,
    type,
    x: (i - (types.length - 1) / 2) * 2.05,
    y: 200,
    z: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    onGround: true,
    hp: MOB_INFO[type]?.health || 20,
    yaw: Math.PI - 0.23,
    age: 100,
    attack: 0,
    hurt: 0,
    speed: 0,
    turn: 0,
    dir: 0,
    style: "meadow",
    profession: "farmer",
  }));
}
async function picture(page, name) {
  await page.evaluate(() => {
    for (const id of ["cycle-banner", "toast"])
      document.querySelector("#" + id)?.classList.remove("show");
  });
  await page.waitForTimeout(120);
  await page.screenshot({ path: captures + "/" + name + ".png" });
  expect(
    await page.evaluate(() => dcsmcraft.renderer.gl.getContext().getError()),
  ).toBe(0);
}
test("every redesigned Overworld creature renders with finite articulated geometry; villagers track without neck spins and persist", async ({
  page,
}) => {
  test.setTimeout(180000);
  const result = await create(page);
  const groups = [
    ["grazer", "woolling", "cow", "chicken"],
    ["rabbit", "panda", "koala", "tiger"],
    ["zombie", "creeper", "skeleton", "spider"],
    ["villager", "iron_golem", "devin_guardian", "watcher"],
    ["shade", "stalker"],
  ];
  for (const [index, types] of groups.entries()) {
    const fixtures = entities(types);
    await page.evaluate((fixtures) => {
      for (const m of dcsmcraft.renderer.mobMeshes.values())
        dcsmcraft.renderer.disposeObject(m);
      dcsmcraft.renderer.mobMeshes.clear();
      dcsmcraft.entities = fixtures;
      dcsmcraft.renderer.syncEntities(fixtures, [], 1, 0.05);
    }, fixtures);
    await page.waitForFunction(
      (ids) => ids.every((id) => dcsmcraft.renderer.mobMeshes.has(id)),
      fixtures.map((e) => e.id),
    );
    const actual = await page.evaluate(() =>
      Array.from(dcsmcraft.renderer.mobMeshes.values())
        .filter((m) => m.visible)
        .map((m) => {
          let finite = true,
            draws = 0;
          m.updateMatrixWorld(true);
          m.traverse((o) => {
            finite &&= o.matrixWorld.elements.every(Number.isFinite);
            if (o.isMesh) draws++;
          });
          return { style: m.userData.overworldStyle, finite, draws };
        }),
    );
    expect(actual.every((m) => m.finite && m.style && m.draws <= 40)).toBe(
      true,
    );
    await picture(page, "creatures-" + index);
  }
  for (const [index, styles] of [
    Object.keys(VILLAGE_STYLES).slice(0, 4),
    Object.keys(VILLAGE_STYLES).slice(4),
  ].entries()) {
    const fixtures = entities(styles.map(() => "villager")).map((e, i) => ({
      ...e,
      id: "villager-" + styles[i],
      style: styles[i],
      profession: i % 2 ? "mason" : "farmer",
    }));
    await page.evaluate((fixtures) => {
      for (const m of dcsmcraft.renderer.mobMeshes.values())
        dcsmcraft.renderer.disposeObject(m);
      dcsmcraft.renderer.mobMeshes.clear();
      dcsmcraft.entities = fixtures;
      dcsmcraft.renderer.syncEntities(fixtures, [], 1, 0.05);
    }, fixtures);
    await picture(page, "village-outfits-" + index);
  }
  const neck = await page.evaluate(() => {
    const g = dcsmcraft,
      e = g.entities[0],
      r = g.renderer;
    g.entities = [e];
    let yaw = 0,
      pitch = 0,
      step = 0,
      previous = 0;
    for (let i = 0; i < 600; i++) {
      const angle = (i / 600) * Math.PI * 12;
      r.camera.position.set(
        e.x + Math.sin(angle) * 4,
        201.6 + Math.sin(angle * 0.4) * 3,
        e.z + Math.cos(angle) * 4,
      );
      e.yaw = Math.sin(angle * 0.3) * Math.PI * 6;
      r.syncEntities([e], [], i / 60, 1 / 60);
      const head = r.mobMeshes.get(e.id).userData.head;
      yaw = Math.max(yaw, Math.abs(head.rotation.y));
      pitch = Math.max(pitch, Math.abs(head.rotation.x));
      if (i) step = Math.max(step, Math.abs(head.rotation.y - previous));
      previous = head.rotation.y;
    }
    return { yaw, pitch, step };
  });
  expect(neck.yaw).toBeLessThanOrEqual(Math.PI / 3 + 1e-7);
  expect(neck.pitch).toBeLessThanOrEqual(0.3200001);
  expect(neck.step).toBeLessThan(0.4);
  await page.evaluate(async () => {
    const g = dcsmcraft;
    g.entities[0].yaw = 0;
    await g.save();
  });
  await page.reload();
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.locator("[data-action=load]").first().click();
  await page.waitForFunction(() => dcsmcraft.running);
  await page.evaluate(() => dcsmcraft.pause());
  expect(
    await page.evaluate(() =>
      dcsmcraft.entities.some(
        (e) => e.type === "villager" && e.style === "desert",
      ),
    ),
  ).toBe(true);
  expect(result.errors).toEqual([]);
  expect(result.external).toEqual([]);
});
test("all 97 flat items retain real transparent textures in hand, F5 and camera-facing drops; solid gear retains depth", async ({
  page,
}) => {
  test.setTimeout(150000);
  const result = await create(page),
    ids = Object.keys(ITEMS).filter(isFlatItem);
  expect(ids).toHaveLength(97);
  const check = await page.evaluate((ids) => {
    const g = dcsmcraft,
      r = g.renderer,
      out = [];
    for (const id of ids) {
      r.setHeld(id);
      let planes = 0,
        depth = 0;
      r.heldMesh.traverse((m) => {
        if (m.isMesh) {
          if (m.geometry.type === "PlaneGeometry") planes++;
          const a = m.geometry.attributes.position;
          for (let i = 0; i < a.count; i++)
            depth = Math.max(depth, Math.abs(a.getZ(i)));
        }
      });
      out.push({ id, flat: r.heldMesh.userData.flatCutout, planes, depth });
    }
    return out;
  }, ids);
  expect(check.every((i) => i.flat && i.planes === 1 && i.depth === 0)).toBe(
    true,
  );
  for (const id of ["apple", "string", "flint_and_steel", "oak_door"]) {
    await page.evaluate((stack) => {
      const g = dcsmcraft;
      g.inventory.slots[0] = stack;
      g.inventory.selected = 0;
      g.renderer.setHeld(stack.id, stack);
      g.ui.updateHotbar();
    }, makeStack(id));
    await picture(page, id + "-flat-held");
  }
  await page.keyboard.press("KeyQ");
  await page.waitForFunction(() =>
    dcsmcraft.drops.some((d) => d.id === "oak_door"),
  );
  await page.waitForFunction(() =>
    Array.from(dcsmcraft.renderer.dropMeshes.values()).some(
      (m) => m.userData.flatCutout,
    ),
  );
  const drop = await page.evaluate(() => {
    const r = dcsmcraft.renderer,
      m = Array.from(r.dropMeshes.values())[0];
    return {
      flat: m.userData.flatCutout,
      facing: Math.abs(m.quaternion.dot(r.camera.quaternion)),
    };
  });
  expect(drop.flat).toBe(true);
  expect(drop.facing).toBeCloseTo(1, 6);
  await page.evaluate(() => {
    const g = dcsmcraft;
    g.inventory.slots[0] = { id: "apple", count: 1 };
    g.renderer.setHeld("apple");
  });
  await page.keyboard.press("F5");
  await picture(page, "flat-item-f5");
  const flatF5 = await page.evaluate(
    () =>
      dcsmcraft.renderer.playerModel?.userData.grip.children[0].userData
        .flatCutout,
  );
  expect(flatF5).toBe(true);
  for (const id of [
    "planks",
    "iron_sword",
    "devin_sword",
    "matthew_dual_pistols",
  ]) {
    expect(
      await page.evaluate((id) => {
        const r = dcsmcraft.renderer;
        r.setHeld(id);
        return !!r.heldMesh.userData.flatCutout;
      }, id),
    ).toBe(false);
  }
  expect(result.errors).toEqual([]);
  expect(result.external).toEqual([]);
});
test("repaired pack faces reach chunk workers and remeshing; torches, door edges, plants and rail surfaces render correctly", async ({
  page,
}) => {
  test.setTimeout(150000);
  const result = await create(page, false);
  const worker = await page.evaluate(
    async ({ B, extras }) => {
      const { default: source } = await import("/src/worker-code.js");
      const url = URL.createObjectURL(
          new Blob([source], { type: "text/javascript" }),
        ),
        w = new Worker(url);
      try {
        const groups = await new Promise((resolve, reject) => {
          const timer = setTimeout(
            () => reject(new Error("Texture worker timeout")),
            15000,
          );
          w.onerror = (e) => {
            clearTimeout(timer);
            reject(new Error(e.message));
          };
          w.onmessage = (e) => {
            clearTimeout(timer);
            e.data.error
              ? reject(new Error(e.data.error))
              : resolve(e.data.groups);
          };
          w.postMessage({
            ticket: 1,
            seed: "Wildflower",
            dimension: "overworld",
            generationVersion: 12,
            cx: 0,
            cz: 0,
            edits: {
              "1,200,1": B.furnace,
              "3,200,1": B.crafting_table,
              "5,200,1": B.chest,
            },
            texturePack: "supplied",
            ambientOcclusion: true,
            biomeColors: true,
            biomeBlend: 2,
          });
        });
        const found = new Set();
        for (const g of groups.filter(Boolean))
          for (let i = 0; i < g.uv.length; i += 2)
            found.add(
              Math.floor(g.uv[i] * 16) +
                (31 - Math.floor(g.uv[i + 1] * 32)) * 16,
            );
        return extras.every((n) => found.has(n));
      } finally {
        w.terminate();
        URL.revokeObjectURL(url);
      }
    },
    { B, extras: Object.values(EXTRA_ART) },
  );
  expect(worker).toBe(true);
  await page.evaluate((B) => {
    const g = dcsmcraft;
    for (const [i, id] of [
      B.furnace,
      B.crafting_table,
      B.chest,
      B.torch,
      B.bamboo,
      B.cobweb,
      B.mine_rail,
      B.oak_door,
    ].entries())
      g.world.set(i - 4, 200, 0, id);
    g.world.set(3, 201, 0, B.oak_door + 1);
    g.renderer.loadAround(0, 7, 2, 9);
  }, B);
  await page.evaluate(() => {
    Object.assign(dcsmcraft.player, { z: -5, yaw: Math.PI, pitch: 0.06 });
  });
  await picture(page, "repaired-pack-blocks");
  const torch = await page.evaluate((B) => {
    const c = dcsmcraft.renderer.atlas.canvas.getContext("2d"),
      out = [];
    for (let f = 0; f < 3; f++) {
      const t = B.torch * 3 + f,
        data = c.getImageData(
          (t % 16) * 16,
          Math.floor(t / 16) * 16,
          16,
          16,
        ).data;
      out.push(
        Array.from(data).filter((a, i) => i % 4 === 3 && a === 255).length,
      );
    }
    return out;
  }, B);
  expect(torch).toEqual([256, 256, 256]);
  expect(
    await page.evaluate((B) => {
      const t = B.bamboo * 3 + 1,
        c = dcsmcraft.renderer.atlas.canvas.getContext("2d");
      const data = c.getImageData(
        (t % 16) * 16,
        Math.floor(t / 16) * 16,
        16,
        16,
      ).data;
      return Array.from(data).filter((a, i) => i % 4 === 3 && a === 255).length;
    }, B),
  ).toBe(48);
  await page.evaluate(() => {
    dcsmcraft.settings.texturePack = "renewed";
    dcsmcraft.renderer.applyGraphics();
    dcsmcraft.renderer.loadAround(0, 7, 2, 9);
    dcsmcraft.settings.texturePack = "supplied";
    dcsmcraft.renderer.applyGraphics();
    dcsmcraft.renderer.loadAround(0, 7, 2, 9);
  });
  await page.waitForFunction((extras) => {
    const found = new Set();
    for (const group of dcsmcraft.renderer.meshes.values())
      group.traverse((m) => {
        const uv = m.geometry?.attributes.uv;
        if (uv)
          for (let i = 0; i < uv.count; i++)
            found.add(
              Math.floor(uv.getX(i) * 16) +
                (31 - Math.floor(uv.getY(i) * 32)) * 16,
            );
      });
    return extras.every((n) => found.has(n));
  }, Object.values(EXTRA_ART));
  expect(result.errors).toEqual([]);
});
