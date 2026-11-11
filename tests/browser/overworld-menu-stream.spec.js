import { test, expect } from "@playwright/test";
import { createServer } from "node:http";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
const html = readFileSync("dist/DCSMCRAFT-Standalone.html"),
  out = process.env.DCSMCRAFT_STREAM_ARTIFACTS || "test-results/streaming";
mkdirSync(out, { recursive: true });
let server, origin;
test.beforeAll(async () => {
  server = createServer((q, r) => {
    r.setHeader("Content-Type", "text/html");
    r.end(html);
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  origin = `http://127.0.0.1:${server.address().port}`;
});
test.afterAll(async () => {
  server?.closeAllConnections();
  if (server) await new Promise((r) => server.close(r));
});
async function boot(page) {
  const errors = [],
    external = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (/Shader Error|GL_INVALID|WebGLProgram/.test(m.text()))
      errors.push(m.text());
  });
  await page.addInitScript(() => {
    localStorage.setItem(
      "dcsmcraft-settings",
      JSON.stringify({
        graphics: 1,
        renderDistance: 4,
        distantTerrain: true,
        volume: 0,
        musicEnabled: false,
        ambientSounds: false,
        frameLimit: 30,
      }),
    );
  });
  await page.route("**/*", (r) =>
    r
      .request()
      .url()
      .startsWith(origin + "/")
      ? r.continue()
      : (external.push(r.request().url()), r.abort()),
  );
  await page.goto(origin);
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  return { errors, external };
}
async function start(page) {
  await page.locator("[data-action=create]").click();
  await page.locator("[name=seed]").fill("Wildflower");
  await page.locator("[name=mode][value=creative]").check();
  await page.locator("[name=difficulty]").selectOption("peaceful");
  await page.locator("[data-action=start-world]").click();
  await page.waitForFunction(() => dcsmcraft.running);
}
test("Java-style menus keep every navigation path, original inventory, skin preview and a visible animated original logo at desktop and narrow sizes", async ({
  page,
}) => {
  test.setTimeout(180000);
  const evidence = await boot(page);
  for (const [name, w, h] of [
    ["desktop", 1280, 800],
    ["compact", 640, 360],
    ["portrait", 480, 800],
  ]) {
    await page.setViewportSize({ width: w, height: h });
    await page.evaluate(() => dcsmcraft.ui.title());
    await page.screenshot({ path: out + "/title-" + name + ".png" });
    const box = await page.locator(".dcsm-logo").boundingBox();
    expect(box.width).toBeGreaterThan(200);
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThan(h);
    const overlap = await page.evaluate(() => {
      const a = document.querySelector(".dcsm-logo").getBoundingClientRect(),
        b = document.querySelector(".world-panel").getBoundingClientRect();
      return a.bottom > b.top;
    });
    expect(overlap).toBe(false);
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.locator("[data-action=settings]").click();
  await expect(page.locator("#overlay h2")).toHaveText("Options");
  await page.screenshot({ path: out + "/options.png" });
  await page.locator('[data-action="sound-settings"]').click();
  await expect(page.locator("#overlay h2")).toHaveText("Music & Sounds");
  await page
    .locator('[data-action="toggle-audio"][data-audio="mobSounds"]')
    .click();
  await expect(page.locator("#overlay h2")).toHaveText("Music & Sounds");
  await page.screenshot({ path: out + "/sound.png" });
  await page.keyboard.press("Escape");
  await expect(page.locator("#overlay h2")).toHaveText("Options");
  await page.locator('[data-action="cycle-settings"]').click();
  await page.locator('[data-cycle="dayStart"]').fill("A new day.");
  await page.locator('[data-action="preview-cycle"]').click();
  await page.screenshot({ path: out + "/messages.png" });
  await page.keyboard.press("Escape");
  await expect(page.locator("#overlay h2")).toHaveText("Options");

  await page.locator("[data-action=video-settings]").click();
  await expect(page.locator("#overlay h2")).toHaveText("Video Settings");
  await page.screenshot({ path: out + "/video.png" });
  await page.locator("[data-action=back]").last().click();
  await page.evaluate(() => dcsmcraft.ui.title());
  await page.locator("[data-action=skins]").click();
  await page.waitForFunction(() => !!dcsmcraft.ui.skinPreview);
  await page.locator('[data-action=cycle-skin][data-step="1"]').click();
  await page.screenshot({ path: out + "/skins.png" });
  await page.locator("[data-action=back]").last().click();
  await start(page);
  await page.evaluate(() => dcsmcraft.pause());
  await page.screenshot({ path: out + "/pause.png" });
  await page.locator("[data-action=world-tools]").click();
  await expect(page.locator("[data-action=titan-menu]")).toBeVisible();
  await expect(page.locator("[data-action=backup-current]")).toBeVisible();
  await page.locator("[data-action=back]").click();
  await expect(page.locator("#overlay h2")).toHaveText("Game Menu");
  await page.locator("[data-action=resume]").click();
  await page.keyboard.press("KeyE");
  await expect(page.locator(".creative-window")).toBeVisible();
  await page.screenshot({ path: out + "/creative.png" });
  const slot = page.locator(".slot[data-ref]").first(),
    size = await slot.boundingBox();
  expect(size.height).toBeLessThan(55);
  expect(evidence.errors).toEqual([]);
  expect(evidence.external).toEqual([]);
  writeFileSync(
    out + "/menu-report.json",
    JSON.stringify(
      {
        htmlSHA256: createHash("sha256").update(html).digest("hex"),
        ...evidence,
      },
      null,
      2,
    ),
  );
});
test("native workers stream and adopt full collision chunks, bound queued uploads, fade detailed terrain over coarse coverage and preserve edited seams on reload", async ({
  page,
}) => {
  test.setTimeout(180000);
  const evidence = await boot(page);
  await start(page);
  await page.evaluate(() => {
    const g = dcsmcraft;
    g.pause();
    g.ui.play();
    g.entities = [];
    g.settings.renderDistance = 8;
    g.settings.distantTerrain = true;
    g.renderer.applyGraphics();
    g.pointerLockFallback = true;
  });
  const initial = await page.evaluate(() => ({
    x: dcsmcraft.player.x,
    z: dcsmcraft.player.z,
  }));
  await expect
    .poll(
      () => page.evaluate(() => dcsmcraft.renderer.streamStats?.adopted || 0),
      { timeout: 60000 },
    )
    .toBeGreaterThan(0);
  const samples = [];
  for (let i = 0; i < 10; i++) {
    await page.evaluate(
      ({ x, z }) => {
        dcsmcraft.player.x = x;
        dcsmcraft.player.z = z;
      },
      { x: initial.x + i * 8, z: initial.z },
    );
    await page.waitForTimeout(150);
    samples.push(
      await page.evaluate(() => {
        const r = dcsmcraft.renderer;
        return {
          jobs: r.jobs.size,
          ready: r.readyMeshes?.length || 0,
          meshes: r.meshes.size,
          chunks: r.world.chunks.size,
          uploads: { ...r.streamStats },
          cache: r.workerCacheStats,
        };
      }),
    );
  }
  for (const s of samples) {
    expect(s.jobs).toBeLessThanOrEqual(4);
    expect(s.ready).toBeLessThanOrEqual(4);
    if (s.cache) expect(s.cache.chunks).toBeLessThanOrEqual(25);
    expect(s.meshes).toBeLessThan(400);
  }
  await page.screenshot({ path: out + "/streamed-world.png" });
  const edit = await page.evaluate(async () => {
    const g = dcsmcraft,
      x = Math.floor(g.player.x / 16) * 16 + 15,
      z = Math.floor(g.player.z),
      y = 180;
    g.world.set(x, y, z, 3);
    g.world.set(x + 1, y, z, 3);
    await g.save();
    return { x, y, z, id: g.id };
  });
  await page.evaluate(async (id) => {
    await dcsmcraft.loadWorld(id);
    dcsmcraft.pause();
  }, edit.id);
  expect(
    await page.evaluate(
      ({ x, y, z }) => [
        dcsmcraft.world.get(x, y, z),
        dcsmcraft.world.get(x + 1, y, z),
      ],
      edit,
    ),
  ).toEqual([3, 3]);
  expect(evidence.errors).toEqual([]);
  expect(evidence.external).toEqual([]);
  writeFileSync(
    out + "/stream-report.json",
    JSON.stringify(
      {
        htmlSHA256: createHash("sha256").update(html).digest("hex"),
        samples,
        ...evidence,
      },
      null,
      2,
    ),
  );
});
test("stationary sticks do not steal mouse input; profile changes wait for neutral and shoulder buttons change actual tabs", async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.addInitScript(() => {
    window.pad = {
      id: "Xbox Wireless",
      index: 0,
      mapping: "standard",
      connected: true,
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 18 }, () => ({ pressed: false, value: 0 })),
    };
    Object.defineProperty(navigator, "getGamepads", { value: () => [pad] });
  });
  const evidence = await boot(page);
  await page.evaluate(() => {
    pad.axes[0] = 0.8;
    dcsmcraft.controller.frame(1 / 60);
  });
  expect(await page.evaluate(() => dcsmcraft.controller.lastDevice)).toBe(
    "controller",
  );
  await page.mouse.move(20, 20);
  await page.mouse.move(30, 20);
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => dcsmcraft.controller.lastDevice)).toBe(
    "keyboard",
  );
  await page.evaluate(() => {
    pad.axes[0] = 0.4;
    dcsmcraft.controller.frame(1 / 60);
  });
  expect(await page.evaluate(() => dcsmcraft.controller.lastDevice)).toBe(
    "controller",
  );
  await page.evaluate(() => {
    pad.axes.fill(0);
    dcsmcraft.controller.frame(1 / 60);
    dcsmcraft.ui.settings();
  });
  await page.locator('[data-action="controller-settings"]').click();
  await page.evaluate(() => {
    pad.buttons[0] = { pressed: true, value: 1 };
    const select = document.querySelector('[data-pad-setting="preset"]');
    select.value = "playstation";
    select.dispatchEvent(new Event("change", { bubbles: true }));
    dcsmcraft.controller.frame(1 / 60);
  });
  await page.waitForTimeout(120);
  expect(await page.evaluate(() => dcsmcraft.ui.screen)).toBe(
    "controller-settings",
  );
  expect(await page.evaluate(() => dcsmcraft.controller.awaitNeutral)).toBe(
    true,
  );
  await page.evaluate(() => {
    pad.buttons[0] = { pressed: false, value: 0 };
    dcsmcraft.controller.frame(1 / 60);
  });
  expect(await page.evaluate(() => dcsmcraft.controller.awaitNeutral)).toBe(
    false,
  );
  await page.evaluate(() => dcsmcraft.ui.title());
  await start(page);
  await page.evaluate(() => {
    dcsmcraft.pause();
    dcsmcraft.openInventory("personal");
  });
  const before = await page
    .locator('[role="tab"][aria-selected="true"]')
    .getAttribute("data-creative-tab");
  await page.evaluate(() => {
    pad.buttons[5] = { pressed: true, value: 1 };
    dcsmcraft.controller.frame(1 / 60);
    pad.buttons[5] = { pressed: false, value: 0 };
    dcsmcraft.controller.frame(1 / 60);
  });
  const selected = await page
    .locator('[role="tab"][aria-selected="true"]')
    .count();
  expect(selected).toBe(1);
  expect(
    await page
      .locator('[role="tab"][aria-selected="true"]')
      .getAttribute("data-creative-tab"),
  ).not.toBe(before);
  await page.evaluate(() => {
    const g = dcsmcraft;
    g.closeInventory();
    g.running = false;
    g.player.health = 0;
    g.ui.death();
    pad.buttons[1] = { pressed: true, value: 1 };
    g.controller.frame(1 / 60);
  });
  expect(await page.evaluate(() => dcsmcraft.ui.screen)).toBe("death");
  await page.evaluate(() => {
    pad.buttons[1] = { pressed: false, value: 0 };
    dcsmcraft.controller.frame(1 / 60);
    pad.buttons[0] = { pressed: true, value: 1 };
    dcsmcraft.controller.frame(1 / 60);
    pad.buttons[0] = { pressed: false, value: 0 };
    dcsmcraft.controller.frame(1 / 60);
  });
  expect(
    await page.evaluate(() => ({
      screen: dcsmcraft.ui.screen,
      health: dcsmcraft.player.health,
    })),
  ).toEqual({ screen: "play", health: 20 });
  expect(evidence.errors).toEqual([]);
  expect(evidence.external).toEqual([]);
  writeFileSync(
    out + "/handoff-report.json",
    JSON.stringify(
      {
        before,
        screen: await page.evaluate(() => dcsmcraft.ui.screen),
        ...evidence,
      },
      null,
      2,
    ),
  );
});
