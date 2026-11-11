import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
let html;
test.beforeAll(() => {
  execFileSync(process.execPath, [
    "scripts/build-standalone.mjs",
    "/tmp/dcsmcraft-v03-test.html",
  ]);
  html = readFileSync("/tmp/dcsmcraft-v03-test.html", "utf8");
});
async function create(page, standalone = false) {
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
  if (standalone) {
    await page.route("**/v03.html", (r) =>
      r.fulfill({ contentType: "text/html", body: html }),
    );
    await page.goto("/v03.html");
  } else await page.goto("/");
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.locator("[data-action=create]").first().click();
  await page.locator("[name=seed]").fill("Wildflower");
  await page.locator("[name=mode][value=creative]").check();
  await page.locator("[data-action=start-world]").click();
  await page.waitForFunction(() => dcsmcraft.active && dcsmcraft.running);
  return errors;
}
test("standalone Video Settings toggles work, survive reload and retain playable controls", async ({
  page,
}) => {
  const errors = await create(page, true);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "Video Settings..." }).click();
  await expect(
    page.getByRole("heading", { name: "Video Settings", exact: true }),
  ).toBeVisible();
  await page.locator("[data-setting=renderDistance]").fill("16");
  for (const key of [
    "fancyGraphics",
    "fog",
    "clouds",
    "showFPS",
    "distantTerrain",
  ])
    await page.locator(`[data-graphics=${key}]`).click();
  await expect(page.locator("[data-graphics=fancyGraphics]")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  const prefs = await page.evaluate(() => ({
    fancy: dcsmcraft.settings.fancyGraphics,
    view: dcsmcraft.settings.renderDistance,
    fps: dcsmcraft.settings.showFPS,
  }));
  expect(prefs).toEqual({ fancy: false, view: 16, fps: true });
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Options", exact: true }),
  ).toBeVisible();
  await page.locator(".settings-dialog > [data-action=back]").click();
  await page.getByRole("button", { name: "Back to Game", exact: true }).click();
  await page.waitForFunction(() => dcsmcraft.running);
  await expect(page.locator("#fps-counter")).toBeVisible();
  await page.evaluate(async () => {
    dcsmcraft.pause();
    await dcsmcraft.save();
  });
  await page.reload();
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  expect(
    await page.evaluate(() => ({
      fancy: dcsmcraft.settings.fancyGraphics,
      view: dcsmcraft.settings.renderDistance,
      clouds: dcsmcraft.settings.clouds,
      fps: dcsmcraft.settings.showFPS,
    })),
  ).toEqual({ fancy: false, view: 16, clouds: false, fps: true });
  expect(errors).toEqual([]);
});
test("village residents, actual targeted interaction, atomic trading and persistent reload", async ({
  page,
}) => {
  const errors = await create(page);
  const fixture = await page.evaluate(async () => {
    const g = dcsmcraft,
      { villageAt } = await import("/src/villages.js"),
      { populateVillages } = await import("/src/ecology.js"),
      { createEntity } = await import("/src/simulation.js");
    g.pause();
    const v = villageAt(g.world, 0, 0);
    g.player.x = v.x + 0.5;
    g.player.y = v.y + 1;
    g.player.z = v.z + 8;
    populateVillages(g, createEntity);
    const e = g.entities.find(
      (e) =>
        e.type === "villager" &&
        e.profession === "farmer" &&
        e.village?.id === v.id,
    );
    g.mode = "survival";
    g.difficulty = "peaceful";
    g.player.x = e.x;
    g.player.y = e.y;
    g.player.z = e.z + 2;
    g.player.yaw = 0;
    g.player.pitch = 0;
    g.target = null;
    g.inventory.slots.fill(null);
    g.inventory.slots[0] = { id: "wheat", count: 40 };
    g.lastPlace = -10;
    g.use();
    return {
      id: e.id,
      residents: g.entities.filter(
        (resident) =>
          resident.type === "villager" && resident.village?.id === e.village.id,
      ).length,
      uniqueResidents:
        new Set(
          g.entities
            .filter((resident) => resident.type === "villager")
            .map((resident) => resident.id),
        ).size ===
        g.entities.filter((resident) => resident.type === "villager").length,
      generation: g.world.generationVersion,
    };
  });
  expect(fixture.residents).toBe(8);
  expect(fixture.generation).toBe(11);
  expect(fixture.uniqueResidents).toBe(true);
  await expect(page.locator(".trade-dialog")).toBeVisible();
  await page.locator('[data-trade="0"]').click();
  await page.locator('[data-trade="1"]').click();
  expect(
    await page.evaluate(
      () => dcsmcraft.inventory.slots.find((s) => s?.id === "bread")?.count,
    ),
  ).toBe(6);
  const id = await page.evaluate(async () => {
    const g = dcsmcraft;
    g.pause();
    await g.save();
    return g.id;
  });
  await page.reload();
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  await page.evaluate((id) => dcsmcraft.loadWorld(id), id);
  await page.waitForFunction(() => dcsmcraft.active);
  const restored = await page.evaluate((id) => {
    const g = dcsmcraft;
    g.pause();
    const e = g.entities.find((e) => e.id === id);
    return {
      uses: e.tradeUses,
      residents: g.entities.filter(
        (resident) =>
          resident.type === "villager" && resident.village?.id === e.village.id,
      ).length,
      uniqueResidents:
        new Set(
          g.entities
            .filter((resident) => resident.type === "villager")
            .map((resident) => resident.id),
        ).size ===
        g.entities.filter((resident) => resident.type === "villager").length,
      bread: g.inventory.slots.find((s) => s?.id === "bread")?.count,
      settled: Object.keys(g.world.settlements).length,
    };
  }, fixture.id);
  expect(restored).toMatchObject({ uses: [1, 1], residents: 8, bread: 6 });
  expect(restored.settled).toBeGreaterThan(0);
  expect(restored.uniqueResidents).toBe(true);
  expect(errors).toEqual([]);
});
test("embedded workers build beyond the former distance limit and reject stale realm jobs", async ({
  page,
}) => {
  const errors = await create(page);
  const key = await page.evaluate(() => {
    const g = dcsmcraft;
    g.pause();
    g.ui.screen = "test";
    g.settings.renderDistance = 16;
    const r = g.renderer,
      cx = Math.floor(g.player.x / 16),
      cz = Math.floor(g.player.z / 16),
      key = `${cx + 9},${cz}`;
    r.planKey = `${cx},${cz},16`;
    r.plan = [{ cx: cx + 9, cz, key, distance: 9 }];
    return key;
  });
  await expect
    .poll(
      () => page.evaluate((key) => dcsmcraft.renderer.meshes.has(key), key),
      { timeout: 45000 },
    )
    .toBe(true);
  const distance = await page.evaluate(
    (key) => ({
      simplified: dcsmcraft.renderer.meshes.get(key).userData.surfaceOnly,
      mainThreadChunk: dcsmcraft.world.chunks.has(key),
      fallback: dcsmcraft.renderer.workerFallback,
    }),
    key,
  );
  expect(distance).toEqual({
    simplified: true,
    mainThreadChunk: false,
    fallback: false,
  });
  await page.evaluate(async () => {
    const g = dcsmcraft,
      { World } = await import("/src/world.js");
    const old = g.world;
    r: {
      const cx = Math.floor(g.player.x / 16),
        cz = Math.floor(g.player.z / 16);
      g.renderer.plan = [
        { cx: cx + 10, cz, key: `${cx + 10},${cz}`, distance: 10 },
      ];
      g.renderer.loadAround(g.player.x, g.player.z, 16, 1);
      g.world = new World("Different realm");
      g.renderer.setWorld(g.world);
      g.renderer.plan = [];
    }
    g.oldWorld = old;
  });
  await page.waitForTimeout(500);
  expect(
    await page.evaluate(() =>
      [...dcsmcraft.renderer.meshes.keys()].some(
        (k) => Number(k.split(",")[0]) >= 9,
      ),
    ),
  ).toBe(false);
  expect(errors).toEqual([]);
});

test("crosshair targeting follows the rendered camera at upward and downward angles", async ({
  page,
}) => {
  const errors = await create(page);
  const angles = await page.evaluate(() => {
    const g = dcsmcraft;
    g.pause();
    g.ui.screen = "test";
    const result = [];
    for (const pitch of [-0.9, -0.35, 0, 0.35, 0.9])
      for (const yaw of [-1.5, 0, 1.5]) {
        g.player.pitch = pitch;
        g.player.yaw = yaw;
        g.renderer.camera.rotation.set(pitch, yaw, 0);
        g.renderer.camera.updateMatrixWorld(true);
        const actual = g.renderer.camera.getWorldDirection(
          g.direction().clone(),
        );
        result.push(g.direction().dot(actual));
      }
    return result;
  });
  expect(Math.min(...angles)).toBeGreaterThan(0.999999);
  expect(errors).toEqual([]);
});

test("Fancy torch lights activate near the player, compile correctly and switch off in Fast graphics", async ({
  page,
}) => {
  const errors = await create(page, true);
  await page.evaluate(async () => {
    const g = dcsmcraft;
    g.pause();
    const p = g.player;
    g.world.set(Math.floor(p.x) + 1, Math.floor(p.y) + 1, Math.floor(p.z), 18);
    g.renderer.lastLights = -1;
    g.ui.play();
  });
  await expect
    .poll(() =>
      page.evaluate(() =>
        dcsmcraft.renderer.localLights.some(
          (l) => l.visible && l.intensity > 0,
        ),
      ),
    )
    .toBe(true);
  await page.evaluate(() => {
    dcsmcraft.settings.fancyGraphics = false;
    dcsmcraft.renderer.applyGraphics();
  });
  await expect
    .poll(() =>
      page.evaluate(() =>
        dcsmcraft.renderer.localLights.every(
          (l) => !l.visible && l.intensity === 0,
        ),
      ),
    )
    .toBe(true);
  expect(errors).toEqual([]);
});
