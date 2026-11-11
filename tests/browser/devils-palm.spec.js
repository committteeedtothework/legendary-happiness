import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import { B } from "../../src/data.js";
import { STANDS } from "../../src/stands-data.js";
const html = readFileSync("dist/DCSMCRAFT-Standalone.html", "utf8"),
  out = "/workspace/artifacts/devils-palm-playtest";
mkdirSync(out, { recursive: true });
async function boot(page, offline = true) {
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
          graphics: 1,
          renderDistance: 2,
          volume: 0,
          musicEnabled: false,
          distantTerrain: false,
          frameLimit: 30,
        }),
      );
  });
  if (offline)
    await page.route("**/*", (r) =>
      r.request().url().endsWith("/palm.html")
        ? r.fulfill({ contentType: "text/html", body: html })
        : (external.push(r.request().url()), r.abort()),
    );
  await page.goto(offline ? "/palm.html" : "/");
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  return { errors, external };
}
async function create(page, mode = "creative") {
  await page.locator("[data-action=create]").first().click();
  await page.locator("[name=name]").fill("Devil’s Palm QA");
  await page.locator("[name=seed]").fill("Wildflower");
  await page.locator(`[name=mode][value=${mode}]`).check();
  await page.locator("[name=difficulty]").selectOption("peaceful");
  await page.locator("[data-action=start-world]").click();
  await page.waitForFunction(() => dcsmcraft.running);
}
async function configure(page, values = {}) {
  await page.evaluate(() => dcsmcraft.pause());
  await page.locator("[data-action=settings]").click();
  await page.locator("[data-action=stand-settings]").click();
  for (const [key, value] of Object.entries({
    rarity: 100,
    trialSeconds: 5,
    awakening: 100,
    death: 0,
    neutral: 0,
    corpseChance: 100,
    ...values,
  })) {
    const input = page.locator(`#palm-config [name=${key}]`);
    if (typeof value === "boolean") await input.setChecked(value);
    else await input.fill(String(value));
  }
  await page.locator("#palm-config button[type=submit]").click();
  await expect(page.locator("#palm-config-status")).toContainText("Saved");
}
async function play(page) {
  await page.evaluate(() => {
    dcsmcraft.resume();
    dcsmcraft.pointerLockFallback = true;
  });
}
async function naturalPalm(page) {
  await play(page);
  await page.waitForFunction(
    () => dcsmcraft.world.palm?.sites.some((s) => s.phase === "active"),
    {},
    { timeout: 20000 },
  );
  return page.evaluate(() =>
    dcsmcraft.world.palm.sites.find((s) => s.phase === "active"),
  );
}
async function enter(page, site) {
  await page.evaluate((site) => {
    const g = dcsmcraft;
    g.entities = [];
    g.player.x = site.x + 0.5;
    g.player.z = site.z + 0.5;
    g.player.y = g.world.skyHeight(g.player.x, g.player.z) + 1.001;
    Object.assign(g.player, {
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: 0,
      pitch: 0.08,
      flying: false,
      onGround: true,
      fallStart: g.player.y,
    });
    g.renderer.loadAround(g.player.x, g.player.z, 2, 9);
    g.resume();
    g.pointerLockFallback = true;
  }, site);
  await page.waitForFunction(
    () => dcsmcraft.player.standData?.trial?.phase === "trial",
  );
}
async function shot(page, name) {
  if (!["awakening", "trial-haze", "rejection-death"].includes(name))
    await page.evaluate(() => {
      for (const id of ["toast", "cycle-banner"])
        document.getElementById(id)?.classList.remove("show");
    });
  await page.screenshot({ path: out + "/" + name + ".png" });
  expect(
    await page.evaluate(() => dcsmcraft.renderer.gl.getContext().getError()),
  ).toBe(0);
}

test("offline natural Palm, owner rules, actual timed awakening, frozen movement, hidden relic and persistent reload", async ({
  page,
}) => {
  test.setTimeout(150000);
  const result = await boot(page);
  await create(page);
  await configure(page);
  await page.locator("[data-stand-key=summon]").selectOption("KeyK");
  const site = await naturalPalm(page);
  expect(["desert", "badlands"]).toContain(
    await page.evaluate(
      (site) => dcsmcraft.world.terrain(site.x, site.z).biome,
      site,
    ),
  );
  await page.evaluate((site) => {
    const g = dcsmcraft;
    g.pause();
    g.ui.play();
    Object.assign(g.player, {
      x: site.x - Math.sin(site.angle) * 25,
      y: site.y + 105,
      z: site.z + Math.cos(site.angle) * 25,
      yaw: -site.angle,
      pitch: -1.0,
      flying: true,
      vx: 0,
      vy: 0,
      vz: 0,
    });
    g.settings.renderDistance = 6;
    g.settings.fog = false;
    g.renderer.applyGraphics();
    g.renderer.loadAround(g.player.x, g.player.z, 6, 30);
  }, site);
  await page.waitForTimeout(3000);
  await shot(page, "formation");
  await enter(page, site);
  await page.waitForTimeout(1600);
  await shot(page, "trial-haze");
  await page.waitForFunction(
    () => dcsmcraft.player.standData?.lastFate?.outcome === "stand",
  );
  const record = await page.evaluate(() => ({
    id: dcsmcraft.player.standData.id,
    soul: dcsmcraft.player.standData.soul,
    serial: dcsmcraft.player.standData.serial,
  }));
  expect(STANDS[record.id]).toBeTruthy();
  const before = await page.evaluate(() => ({
    x: dcsmcraft.player.x,
    z: dcsmcraft.player.z,
  }));
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(250);
  await page.keyboard.up("KeyW");
  expect(
    await page.evaluate(
      ({ x, z }) => Math.hypot(dcsmcraft.player.x - x, dcsmcraft.player.z - z),
      before,
    ),
  ).toBeLessThan(0.01);
  await shot(page, "awakening");
  await page.waitForFunction(
    () =>
      dcsmcraft.tickCount > dcsmcraft.player.standData.awakeningUntil ||
      !dcsmcraft.player.standData.awakeningUntil,
  );
  await page.keyboard.press("KeyV");
  await expect(page.locator(".stand-summary")).toBeVisible();
  await shot(page, "stand-interface");
  expect(
    await page.evaluate(
      () =>
        dcsmcraft.world.containers[
          `${dcsmcraft.world.palm.sites[0].x + 16},${dcsmcraft.world.palm.sites[0].y - 13},${dcsmcraft.world.palm.sites[0].z + 8}`
        ].slots.filter((s) => s?.id === "saint_corpse_part").length,
    ),
  ).toBe(1);
  await page.setViewportSize({ width: 640, height: 720 });
  await shot(page, "stand-interface-narrow");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.evaluate(async () => {
    dcsmcraft.pause();
    await dcsmcraft.save();
  });
  await page.reload();
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.locator("[data-action=load]").first().click();
  await page.waitForFunction(() => dcsmcraft.running);
  expect(
    await page.evaluate(() => ({
      id: dcsmcraft.player.standData.id,
      soul: dcsmcraft.player.standData.soul,
      serial: dcsmcraft.player.standData.serial,
    })),
  ).toEqual(record);
  expect(await page.evaluate(() => dcsmcraft.settings.standKeys.summon)).toBe(
    "KeyK",
  );
  expect(await page.evaluate(() => dcsmcraft.devStands)).toBe(false);
  expect(result.errors).toEqual([]);
  expect(result.external).toEqual([]);
});

test("offline interrupted trial resumes, escape never rolls, rejection follows normal death/respawn and Keep Inventory", async ({
  page,
}) => {
  test.setTimeout(150000);
  const result = await boot(page);
  await create(page, "survival");
  await configure(page, { awakening: 0, death: 100, corpseChance: 0 });
  const site = await naturalPalm(page);
  await enter(page, site);
  await page.waitForFunction(
    () => dcsmcraft.player.standData.trial.elapsed >= 25,
  );
  await page.evaluate(async () => {
    dcsmcraft.pause();
    await dcsmcraft.save();
  });
  const progress = await page.evaluate(
    () => dcsmcraft.player.standData.trial.elapsed,
  );
  await page.reload();
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.locator("[data-action=load]").first().click();
  await page.waitForFunction(() => dcsmcraft.running);
  expect(
    await page.evaluate(() => dcsmcraft.player.standData.trial.elapsed),
  ).toBeGreaterThanOrEqual(progress);
  await page.evaluate(() => {
    const g = dcsmcraft,
      s = g.world.palm.sites[0];
    Object.assign(g.player, {
      x: s.x + 160,
      y: s.y + 20,
      z: s.z,
      flying: false,
    });
    g.pointerLockFallback = true;
  });
  await page.waitForFunction(() => !dcsmcraft.player.standData.trial);
  expect(
    await page.evaluate(() => dcsmcraft.player.standData.lastFate),
  ).toBeUndefined();
  await page.evaluate(() => {
    dcsmcraft.inventory.slots.fill(null);
    dcsmcraft.inventory.slots[0] = { id: "log", count: 6 };
  });
  await enter(page, site);
  await page.waitForFunction(() => dcsmcraft.player.health <= 0);
  await expect(page.locator("[data-action=respawn]")).toBeVisible();
  expect(
    await page.evaluate(() =>
      dcsmcraft.drops
        .filter((d) => d.id === "log")
        .reduce((sum, d) => sum + d.count, 0),
    ),
  ).toBe(6);
  await shot(page, "rejection-death");
  const soul = await page.evaluate(() => dcsmcraft.player.standData.soul);
  await page.locator("[data-action=respawn]").click();
  await page.waitForFunction(() => dcsmcraft.player.health > 0);
  expect(await page.evaluate(() => dcsmcraft.player.standData.soul)).toBe(soul);
  await configure(page, {
    awakening: 0,
    death: 100,
    corpseChance: 0,
    keepInventory: true,
  });
  await page.evaluate(() => {
    dcsmcraft.inventory.slots.fill(null);
    dcsmcraft.inventory.slots[0] = { id: "diamond", count: 3 };
    dcsmcraft.player.xp = 9;
  });
  await enter(page, site);
  await page.waitForFunction(() => dcsmcraft.player.health <= 0);
  expect(
    await page.evaluate(() => ({
      stack: dcsmcraft.inventory.slots[0],
      xp: dcsmcraft.player.xp,
    })),
  ).toEqual({ stack: { id: "diamond", count: 3 }, xp: 9 });
  expect(result.errors).toEqual([]);
  expect(result.external).toEqual([]);
});

test("all five Stands execute real keyboard abilities, render distinct rigs and respect collisions and cooldowns", async ({
  page,
}) => {
  test.setTimeout(150000);
  const result = await boot(page);
  await create(page);
  await page.evaluate((B) => {
    const g = dcsmcraft;
    g.pause();
    g.entities = [];
    g.drops = [];
    for (let x = -10; x <= 10; x++)
      for (let z = -15; z <= 15; z++) g.world.set(x, 199, z, B.stone);
    Object.assign(g.player, {
      x: 0.5,
      y: 200,
      z: 6.5,
      yaw: 0,
      pitch: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      fallStart: 200,
      onGround: true,
      flying: false,
    });
    g.difficulty = "normal";
    g.inventory.slots.fill(null);
    g.renderer.loadAround(0.5, 6.5, 2, 9);
    g.time = 18000;
    g.resume();
    g.pointerLockFallback = true;
  }, B);
  const grant = async (id) =>
    page.evaluate((id) => {
      const g = dcsmcraft;
      g.player.standData = {
        id,
        summoned: true,
        soul: 771,
        energy: 100,
        level: 1,
        xp: 0,
        serial: 0,
        failures: 0,
        cooldowns: {},
        trial: null,
      };
    }, id);
  await grant("tusk");
  await page.evaluate(
    () =>
      (dcsmcraft.entities = [
        {
          id: "nail-target",
          type: "zombie",
          x: 0.5,
          y: 200,
          z: 0,
          hp: 100,
          vx: 0,
          vy: 0,
          vz: 0,
          yaw: 0,
          age: 0,
          turn: 10000,
          speed: 0,
          dir: 0,
          attack: 999,
          onGround: true,
        },
      ]),
  );
  await page.keyboard.press("KeyF");
  const cooldown = await page.evaluate(
    () => dcsmcraft.player.standData.cooldowns.primary,
  );
  await page.keyboard.press("KeyF");
  expect(
    await page.evaluate(() => dcsmcraft.player.standData.cooldowns.primary),
  ).toBe(cooldown);
  await page.waitForFunction(() => dcsmcraft.entities[0].hp <= 94);
  await page.keyboard.press("KeyG");
  await page.waitForTimeout(80);
  await shot(page, "tusk-nails");
  await grant("lonesome");
  await page.evaluate(() => {
    dcsmcraft.entities = [];
    dcsmcraft.drops = [
      {
        id: "diamond",
        count: 3,
        uid: "rope-drop",
        x: 0.5,
        y: 201,
        z: 0,
        vy: 0,
        age: 0,
        delay: 0,
      },
    ];
  });
  await page.keyboard.press("KeyF");
  await page.waitForFunction(() =>
    dcsmcraft.inventory.slots.some((s) => s?.id === "diamond" && s.count === 3),
  );
  await page.evaluate((B) => {
    for (let x = -1; x <= 1; x++)
      for (let y = 200; y <= 203; y++) dcsmcraft.world.set(x, y, -4, B.stone);
  }, B);
  await page.keyboard.press("KeyG");
  expect(await page.evaluate(() => dcsmcraft.player.z)).toBeLessThan(0);
  await shot(page, "rope-traverse");
  await grant("monsters");
  await page.keyboard.press("KeyF");
  await page.waitForFunction(() => dcsmcraft.player.standData.transformed);
  await page.keyboard.press("F5");
  await page.keyboard.press("F5");
  await page.waitForTimeout(250);
  expect(
    await page.evaluate(() => {
      const r = dcsmcraft.renderer;
      return (
        r.cameraDistance > 1.1 ||
        !r.standVisuals.dinos.get("local").model.visible
      );
    }),
  ).toBe(true);
  await page.evaluate(() => {
    dcsmcraft.player.z = 6.5;
    dcsmcraft.player.pitch = -0.08;
  });
  await page.waitForTimeout(250);
  await shot(page, "scary-monsters-f5");
  expect(
    await page.evaluate(
      () => dcsmcraft.renderer.standVisuals.dinos.get("local").model.visible,
    ),
  ).toBe(true);
  expect(
    await page.evaluate(() => dcsmcraft.renderer.playerModel.visible),
  ).toBe(false);
  expect(
    await page.evaluate(() => dcsmcraft.renderer.standVisuals.dinos.size),
  ).toBe(1);
  await page.evaluate(
    () => (dcsmcraft.player.standData.transformUntil = dcsmcraft.tickCount + 3),
  );
  await page.waitForFunction(() => !dcsmcraft.player.standData.transformed);
  await page.keyboard.press("F5");
  await grant("cream");
  await page.evaluate(() => {
    dcsmcraft.player.health = 10;
  });
  await page.keyboard.press("KeyF");
  expect(await page.evaluate(() => dcsmcraft.player.health)).toBe(14);
  await shot(page, "cream-starter");
  await grant("d4c");
  await page.evaluate((B) => {
    const g = dcsmcraft;
    for (let x = -1; x <= 1; x++)
      for (let y = 200; y <= 203; y++) g.world.set(x, y, -4, B.air);
    Object.assign(g.player, { x: 0.5, z: 6.5, pitch: 0, yaw: 0 });
  }, B);
  await page.keyboard.press("KeyF");
  expect(await page.evaluate(() => dcsmcraft.player.z)).toBeLessThan(-1);
  await shot(page, "d4c-rifts");
  await page.keyboard.press("KeyG");
  expect(
    await page.evaluate(() => Math.abs(dcsmcraft.player.z - 6.5)),
  ).toBeLessThan(0.1);
  await page.evaluate(() => {
    const g = dcsmcraft;
    g.player.standData.cooldowns = {};
    g.world.protectedAreas = [{ x: g.player.x, z: g.player.z, radius: 10 }];
  });
  const energy = await page.evaluate(() => dcsmcraft.player.standData.energy);
  await page.keyboard.press("KeyF");
  expect(
    await page.evaluate(() => dcsmcraft.player.standData.energy),
  ).toBeLessThan(energy + 2);
  expect(
    await page.evaluate(() => Math.abs(dcsmcraft.player.z - 6.5)),
  ).toBeLessThan(0.1);
  expect(result.errors).toEqual([]);
  expect(result.external).toEqual([]);
});

test("Vite development commands are explicitly gated and real relocation restores untouched terrain while retaining edits", async ({
  page,
}) => {
  test.setTimeout(120000);
  const result = await boot(page, false);
  await create(page);
  await configure(page);
  const site = await naturalPalm(page);
  await page.evaluate(async (site) => {
    const { relocatePalm } = await import("/src/devils-palm.js"),
      g = dcsmcraft;
    g.pause();
    g.world.set(site.x + 3, site.y + 1, site.z + 3, 8);
    Object.assign(g.player, { x: g.spawn.x, y: g.spawn.y, z: g.spawn.z });
    g.testRelocated = false;
    for (let i = 0; i < 30 && !g.testRelocated; i++)
      g.testRelocated = relocatePalm(g);
    await g.save();
  }, site);
  expect(await page.evaluate(() => dcsmcraft.testRelocated)).toBe(true);
  expect(
    await page.evaluate(
      (site) => dcsmcraft.world.palm.sites.find((s) => s.id === site.id).phase,
      site,
    ),
  ).toBe("ruin");
  expect(
    await page.evaluate(
      (site) => dcsmcraft.world.get(site.x + 3, site.y + 1, site.z + 3),
      site,
    ),
  ).toBe(B.planks);
  expect(await page.evaluate(() => dcsmcraft.devStands)).toBe(true);
  await page.evaluate(async () => {
    const { runOwnerCommand } = await import("/src/chat.js");
    await runOwnerCommand(dcsmcraft, "/palmdev outcome stand tusk");
  });
  expect(await page.evaluate(() => dcsmcraft.player.standData.forceStand)).toBe(
    "tusk",
  );
  expect(result.errors).toEqual([]);
});
