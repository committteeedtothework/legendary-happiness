import { test, expect } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { B, CYCLE_TEXT } from "../../src/data.js";
let html;
test.beforeAll(() => {
  execFileSync(process.execPath, [
    "scripts/build-standalone.mjs",
    "/tmp/dcsmcraft-tested.html",
  ]);
  html = readFileSync("/tmp/dcsmcraft-tested.html", "utf8");
});
async function standalone(page) {
  const errors = [],
    external = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/*", (route) => {
    if (route.request().url().endsWith("/edition.html"))
      return route.fulfill({ contentType: "text/html", body: html });
    external.push(route.request().url());
    return route.abort();
  });
  await page.goto("/edition.html");
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  return { errors, external };
}
async function create(page, mode = "creative") {
  await page.locator("[data-action=create]").first().click();
  await page.locator("[name=seed]").fill("Wildflower");
  await page.locator(`[name=mode][value=${mode}]`).check();
  await page.locator("[data-action=start-world]").click();
  await page.waitForFunction(() => dcsmcraft.active && dcsmcraft.running);
}
test("exact standalone works without network, all title/options actions work, and its own HTML download starts clean", async ({
  page,
}) => {
  const { errors, external } = await standalone(page);
  await page.locator("[data-action=worlds]").click();
  await expect(page.locator(".empty-state")).toBeVisible();
  await page.locator("[data-action=title]").last().click();
  await page.getByRole("button", { name: "How to play", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Obsidian portal → Cinderwild" }),
  ).toBeVisible();
  await page.locator("[data-action=features]").click();
  await expect(page.locator(".checklist")).toBeVisible();
  await page.locator("[data-action=back]").last().click();
  await page.getByRole("button", { name: "Options", exact: true }).click();
  const initial = await page.evaluate(() =>
    dcsmcraft.renderer.gl.getPixelRatio(),
  );
  await page.locator("[data-setting=graphics]").fill("1");
  expect(
    await page.evaluate(() => dcsmcraft.renderer.gl.getPixelRatio()),
  ).toBeLessThan(initial);
  expect(await page.evaluate(() => dcsmcraft.renderer.clouds.visible)).toBe(
    true,
  );
  await page.locator("[data-setting=graphics]").fill("4");
  await page.locator("[data-setting=FOV]").fill("85");
  await page.locator("[data-setting=sensitivity]").fill("0.003");
  await page.locator("[data-setting=renderDistance]").fill("2");
  await page.locator("[data-setting=volume]").fill("0.65");
  await page.locator("[data-cycle=dayEnd]").fill("The lantern hour is here.");
  await page.getByRole("button", { name: "Preview messages" }).click();
  await expect(page.locator("#message-preview")).toHaveText(
    "The lantern hour is here.",
  );
  await page.reload();
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  expect(
    await page.evaluate(() => ({
      graphics: dcsmcraft.settings.graphics,
      line: dcsmcraft.settings.cycleText.dayEnd,
    })),
  ).toEqual({ graphics: 4, line: "The lantern hour is here." });
  const downloading = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Save game HTML", exact: true })
    .click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe("DCSMCRAFT-Standalone.html");
  const copy = readFileSync(await download.path(), "utf8");
  expect(copy).toContain("data-dcsmcraft-bundle");
  expect(copy).toContain('<div id="app"></div>');
  expect(copy).not.toContain("<canvas");
  await page.unroute("**/*");
  await page.route("**/*", (route) =>
    route.request().url().endsWith("/shared.html")
      ? route.fulfill({ contentType: "text/html", body: copy })
      : route.abort(),
  );
  await page.goto("/shared.html");
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.getByRole("button", { name: "Options", exact: true }).click();
  await page.getByRole("button", { name: "Restore messages" }).click();
  await expect(page.locator("[data-cycle=dayEnd]")).toHaveValue(
    CYCLE_TEXT.dayEnd,
  );
  await page.locator(".settings-dialog > [data-action=back]").click();
  await create(page);
  await page.keyboard.press("KeyE");
  await expect(page.locator(".inventory-window")).toBeVisible();
  await page.keyboard.press("KeyE");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.locator(".settings-dialog > [data-action=back]").click();
  const backupEvent = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export world backup", exact: true })
    .click();
  const backup = await backupEvent;
  expect(backup.suggestedFilename()).toMatch(/\.json$/);
  const file = JSON.parse(readFileSync(await backup.path(), "utf8"));
  expect(file.realms.overworld).toBeTruthy();
  await page
    .getByRole("button", { name: "Back to Game", exact: false })
    .click();
  await page.waitForFunction(() => dcsmcraft.running);
  await page.keyboard.press("Escape");
  await page.locator("[data-action=quit]").click();
  await page.waitForFunction(
    () => dcsmcraft.ui.screen === "title" && !dcsmcraft.active,
  );
  await page.locator("[data-action=worlds]").click();
  await expect(page.locator(".world-row")).toHaveCount(1);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test("standalone flint ignition, physical portal entry, linked return, realm saves and reload", async ({
  page,
}) => {
  const { errors, external } = await standalone(page);
  await create(page, "survival");
  const ignition = await page.evaluate((B) => {
    const g = dcsmcraft;
    g.pause();
    for (let u = 0; u < 4; u++)
      for (let v = 0; v < 5; v++)
        g.world.set(
          8 + u,
          180 + v,
          8,
          u === 0 || u === 3 || v === 0 || v === 4 ? B.obsidian : B.air,
        );
    g.inventory.slots[0] = { id: "flint_and_steel", count: 1, durability: 64 };
    g.inventory.selected = 0;
    g.target = { x: 8, y: 181, z: 8, id: B.obsidian };
    g.lastPlace = -10;
    g.use();
    g.world.set(-1, 150, 16, B.chest);
    g.world.containers["-1,150,16"] = {
      type: "chest",
      slots: [{ id: "diamond", count: 7 }],
    };
    g.mode = "creative";
    Object.assign(g.player, {
      x: 9.5,
      y: 181,
      z: 8.5,
      vx: 0,
      vy: 0,
      vz: 0,
      health: 20,
    });
    const result = {
      portal: g.world.get(9, 181, 8),
      wear: g.inventory.slots[0].durability,
    };
    return result;
  }, B);
  expect(ignition).toEqual({ portal: B.portal, wear: 63 });
  // pause exits native pointer lock asynchronously. Finish that transition
  // before resuming, as a real click on the menu does.
  await page.waitForFunction(() => !document.pointerLockElement);
  await page.evaluate(async () => {
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
    dcsmcraft.resume();
  });
  await page.waitForFunction(() => dcsmcraft.dimension === "cinderwild");
  await expect(page.locator("#cycle-banner")).toContainText("CINDERWORLD");
  const saved = await page.evaluate(async (B) => {
    const g = dcsmcraft;
    g.pause();
    g.world.set(-1, 160, 16, B.emberglass);
    g.entities[0].hp = 13;
    await g.save();
    return {
      id: g.id,
      links: Object.keys(g.portalLinks).length,
      realms: Object.keys(g.snapshot().realms),
      mobs: g.entities.map((e) => e.type),
    };
  }, B);
  expect(saved.links).toBe(2);
  expect(saved.realms.sort()).toEqual(["cinderwild", "overworld"]);
  expect(saved.mobs).toContain("emberling");
  await page.reload();
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.locator("[data-action=worlds]").click();
  await page.locator("[data-action=load]").click();
  await page.waitForFunction(
    () => dcsmcraft.dimension === "cinderwild" && dcsmcraft.active,
  );
  const restored = await page.evaluate((B) => {
    const g = dcsmcraft;
    g.pause();
    return {
      block: g.world.get(-1, 160, 16),
      hp: g.entities[0].hp,
      realm: g.dimension,
    };
  }, B);
  expect(restored).toEqual({
    block: B.emberglass,
    hp: 13,
    realm: "cinderwild",
  });
  await page.evaluate(() => {
    const g = dcsmcraft,
      f = Object.values(g.world.portals)[0];
    g.portalCooldown = 0;
    Object.assign(g.player, {
      x: f.x + 1.5,
      y: f.y + 1,
      z: f.z + 0.5,
      vx: 0,
      vy: 0,
      vz: 0,
    });
    g.resume();
  });
  await page.waitForFunction(() => dcsmcraft.dimension === "overworld");
  const home = await page.evaluate(() => {
    const g = dcsmcraft;
    g.pause();
    return {
      chest: g.world.get(-1, 150, 16),
      diamonds: g.world.containers["-1,150,16"].slots[0].count,
      collision:
        g.world.solid(g.player.x, g.player.y + 0.05, g.player.z) ||
        g.world.solid(g.player.x, g.player.y + 1.5, g.player.z),
    };
  });
  expect(home).toEqual({ chest: B.chest, diamonds: 7, collision: false });
  await page.evaluate(() => {
    const g = dcsmcraft;
    g.travelDimension(Object.values(g.world.portals)[0]);
    g.mode = "survival";
    g.player.hurt = 0;
    g.inventory.slots[8] = { id: "obsidian", count: 3 };
    g.damage(100, "a test emberling");
  });
  await expect(page.locator("[data-action=respawn]")).toBeVisible();
  await page.locator("[data-action=respawn]").click();
  await page.waitForFunction(
    () =>
      dcsmcraft.dimension === "overworld" &&
      dcsmcraft.running &&
      dcsmcraft.player.health === 20,
  );
  const deathDrops = await page.evaluate(() =>
    dcsmcraft.realms.cinderwild.drops
      .filter((d) => d.id === "obsidian")
      .reduce((n, d) => n + d.count, 0),
  );
  expect(deathDrops).toBe(3);
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});

test("standalone custom messages occur at all four cycle boundaries, audio produces a signal, and volume mutes", async ({
  page,
}) => {
  const { errors } = await standalone(page);
  await create(page);
  for (const [tick, key, text] of [
    [12000, "dayEnd", "Shelter before sunset!"],
    [13000, "nightStart", "The hunt begins."],
    [23000, "nightEnd", "Morning is near."],
    [24000, "dayStart", "Build a new day."],
  ]) {
    await page.evaluate(
      ({ tick, key, text }) => {
        const g = dcsmcraft;
        g.time = tick - 1;
        g.settings.cycleText[key] = text;
      },
      { tick, key, text },
    );
    await expect(page.locator("#cycle-banner span")).toHaveText(text);
  }
  const energy = await page.evaluate(async () => {
    const g = dcsmcraft;
    g.pause();
    g.audio.unlock();
    await g.audio.context.resume();
    const analyser = g.audio.context.createAnalyser();
    analyser.fftSize = 2048;
    g.audio.master.connect(analyser);
    g.audio.tone("portal");
    await new Promise((r) => setTimeout(r, 180));
    const signal = new Float32Array(2048);
    analyser.getFloatTimeDomainData(signal);
    return {
      peak: Math.max(...signal.map(Math.abs)),
      played: g.audio.played,
      state: g.audio.context.state,
    };
  });
  expect(energy.peak).toBeGreaterThan(0.0001);
  expect(energy.played).toBeGreaterThan(4);
  expect(energy.state).toBe("running");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.locator("[data-setting=volume]").fill("0");
  const muted = await page.evaluate(async () => {
    const audio = dcsmcraft.audio;
    const analyser = audio.context.createAnalyser();
    analyser.fftSize = 2048;
    audio.master.connect(analyser);
    // Pull an active signal through the master, including when tone() is muted.
    // An idle AudioParam.value may expose a cached value instead of audio output.
    audio.note(440, 1, 0.4);
    await new Promise((resolve) => setTimeout(resolve, 350));
    const signal = new Float32Array(2048);
    analyser.getFloatTimeDomainData(signal);
    return {
      volume: audio.settings.volume,
      peak: Math.max(...signal.map(Math.abs)),
    };
  });
  expect(muted.volume).toBe(0);
  expect(muted.peak).toBeLessThan(0.0001);
  expect(errors).toEqual([]);
});
