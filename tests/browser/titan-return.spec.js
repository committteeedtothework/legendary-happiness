import { createHash } from "node:crypto";
import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
const html = readFileSync("dist/DCSMCRAFT-Standalone.html"),
  out = process.env.DCSMCRAFT_RETURN_ARTIFACTS || "test-results/return-portal";
mkdirSync(out, { recursive: true });
let server, origin;
test.use({ trace: "off" });
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
  await page.addInitScript(
    () =>
      localStorage.getItem("dcsmcraft-settings") ||
      localStorage.setItem(
        "dcsmcraft-settings",
        JSON.stringify({
          graphics: 1,
          renderDistance: 2,
          distantTerrain: false,
          volume: 0,
          musicEnabled: false,
          ambientSounds: false,
          frameLimit: 30,
          skin: "explorer",
        }),
      ),
  );
  await page.route("**/*", (r) =>
    r
      .request()
      .url()
      .startsWith(origin + "/")
      ? r.continue()
      : (external.push(r.request().url()), r.abort()),
  );
  await page.goto(origin + "/titan.html");
  await page.waitForFunction(() => dcsmcraft?.initialized);
  await page.locator("[data-action=create]").click();
  await page.locator("[name=seed]").fill("Wildflower");
  await page.locator("[name=mode][value=creative]").check();
  await page.locator("[name=difficulty]").selectOption("peaceful");
  await page.locator("[data-action=start-world]").click();
  await page.waitForFunction(
    () => dcsmcraft.running && dcsmcraft.ui.screen === "play",
  );
  await page.evaluate(() => {
    const g = dcsmcraft;
    g.pause();
    g.ui.play();
    g.entities = [];
    g.inventory.slots.fill(null);
    g.world.set(0, 199, 0, 3);
    g.inventory.selected = 0;
    Object.assign(g.player, {
      x: 0.5,
      y: 200,
      z: 0.5,
      yaw: 0,
      pitch: 0,
      vy: 0,
      onGround: true,
      health: 20,
    });
  });
  return { errors, external };
}

async function portal(page, full = false) {
  await page.evaluate((full) => {
    const g = dcsmcraft;
    if (full)
      g.inventory.slots = Array.from({ length: 36 }, () => ({
        id: "stone",
        count: 64,
      }));
    for (let x = 0; x <= 10; x++)
      for (let z = 0; z <= 10; z++) {
        g.world.set(x, 199, z, 3);
        for (let y = 200; y < 206; y++) g.world.set(x, y, z, 0);
      }
    Object.assign(g.player, {
      x: 4.5,
      y: 200,
      z: 7,
      yaw: 0,
      pitch: 0,
      onGround: true,
      health: 17,
      hunger: 12,
      saturation: 3,
    });
    g.inventory.slots[0] = {
      id: "diamond_sword",
      count: 1,
      durability: 500,
      enchantments: { sharpness: 2 },
    };
    g.giganto.record.config.spawnChance = 0;
    g.giganto.record.portal = {
      id: "browser-titan",
      cell: "0,0",
      x: 4,
      y: 200,
      z: 4,
    };
    g.giganto.overworld(0.01);
    g.running = true;
    g.pointerLockFallback = true;
  }, full);
  await page.keyboard.press("KeyE");
  await page.waitForFunction(
    () =>
      dcsmcraft.giganto.active &&
      !dcsmcraft.giganto.pending &&
      dcsmcraft.giganto.view?.assetsReady,
  );
}

async function finish(page) {
  await page.evaluate(() => {
    const g = dcsmcraft,
      e = g.giganto,
      s = e.session;
    Object.assign(s.config, {
      graphicsQuality: "low",
      shadowQuality: "off",
      postProcessing: false,
      music: false,
      audio: false,
    });
    Object.assign(s, {
      stage: "finale",
      stageTime: 6.85,
      won: false,
      emerald: true,
      cinematicFrom: { x: -12, y: 64, z: 60 },
      qte: null,
      counterScene: null,
      attack: "idle",
    });
    e.controls.clear();
    g.running = true;
    g.ui.play();
  });
  await page.waitForFunction(
    () =>
      dcsmcraft.giganto.session.stage === "victory" &&
      dcsmcraft.giganto.session.returnPortal?.age > 1.5,
  );
}
async function flyThrough(page, pauseDuringFade = false) {
  await page.keyboard.down("KeyW");
  try {
    if (pauseDuringFade) {
      await page.waitForFunction(
        () =>
          dcsmcraft.giganto.session?.returnPortal?.crossed &&
          dcsmcraft.giganto.session.returnPortal.fade > 0.06 &&
          !dcsmcraft.giganto.closing,
      );
      await page.keyboard.up("KeyW");
      await page.keyboard.press("Escape");
      const fade = await page.evaluate(
        () => dcsmcraft.giganto.session.returnPortal.fade,
      );
      await expect(page.locator("#titan-return-fade")).toHaveCSS(
        "visibility",
        "hidden",
      );
      await page.waitForTimeout(200);
      expect(
        await page.evaluate(() => dcsmcraft.giganto.session.returnPortal.fade),
      ).toBe(fade);
      const id = await page.evaluate(() => dcsmcraft.id);
      await page.locator("[data-titan=quit]").click();
      await page.waitForFunction(
        () => dcsmcraft.ui.screen === "title" && !dcsmcraft.active,
      );
      expect(
        await page
          .locator("#titan-return-fade")
          .evaluate((n) => n.style.opacity),
      ).toBe("0");
      await page.evaluate(async (id) => {
        await dcsmcraft.loadWorld(id);
      }, id);
    }
    await page.waitForFunction(
      () => !dcsmcraft.giganto.active && !dcsmcraft.giganto.closing,
      null,
      { timeout: 45000 },
    );
  } finally {
    await page.keyboard.up("KeyW");
  }
}
test("defeat opens a playable return portal; pause, settings, save and quit, reload and physical crossing restore the world once", async ({
  page,
}) => {
  test.setTimeout(240000);
  const evidence = await boot(page);
  await portal(page);
  await finish(page);
  const before = await page.evaluate(() => {
    const g = dcsmcraft,
      e = g.giganto,
      s = e.session;
    return {
      screen: g.ui.screen,
      running: g.running,
      gate: { ...s.returnPortal },
      player: { ...s.avatar },
      ledger: e.record.ledger.length,
      canExit: e.button("exit"),
      meshes: e.view.scene.children.filter(
        (o) => o.name === "Overworld return portal",
      ).length,
    };
  });
  expect(before.screen).toBe("play");
  expect(before.running).toBe(true);
  expect(before.ledger).toBe(0);
  expect(before.meshes).toBe(1);
  await expect(page.locator("[data-titan=exit]")).toHaveCount(0);
  await page.screenshot({ path: out + "/return-portal.png" });
  await page.keyboard.press("Escape");
  const paused = await page.evaluate(() => ({
    time: dcsmcraft.giganto.session.time,
    gate: { ...dcsmcraft.giganto.session.returnPortal },
    p: { ...dcsmcraft.giganto.session.avatar },
  }));
  await page.waitForTimeout(200);
  expect(
    await page.evaluate(() => ({
      time: dcsmcraft.giganto.session.time,
      gate: { ...dcsmcraft.giganto.session.returnPortal },
      p: { ...dcsmcraft.giganto.session.avatar },
    })),
  ).toEqual(paused);
  await expect(page.locator("[data-titan=exit]")).toHaveCount(0);
  await page.locator("[data-titan=menu]").click();
  await expect(page.locator("#overlay h2")).toHaveText("Options");
  await page.locator("[data-titan=back]").click();
  const id = await page.evaluate(() => dcsmcraft.id);
  await page.locator("[data-titan=quit]").click();
  await page.waitForFunction(
    () => dcsmcraft.ui.screen === "title" && !dcsmcraft.active,
  );
  await page.locator("[data-action=worlds]").click();
  await page.locator(`[data-action=load][data-id="${id}"]`).click();
  await page.waitForFunction(
    () => dcsmcraft.giganto.view?.assetsReady && dcsmcraft.running,
  );
  const restored = await page.evaluate(() => {
    const e = dcsmcraft.giganto;
    return {
      gate: { ...e.session.returnPortal },
      stage: e.session.stage,
      ledger: e.record.ledger.length,
    };
  });
  expect(restored.gate.x).toBe(before.gate.x);
  expect(restored.gate.z).toBe(before.gate.z);
  expect(restored.stage).toBe("victory");
  expect(restored.ledger).toBe(0);
  await flyThrough(page, true);
  const result = await page.evaluate(async () => {
    const g = dcsmcraft;
    g.pause();
    await g.save();
    return {
      health: g.player.health,
      ledger: g.giganto.record.ledger,
      diamonds: g.inventory.slots
        .filter((x) => x?.id === "diamond")
        .reduce((n, x) => n + x.count, 0),
      ingots: g.inventory.slots
        .filter((x) => x?.id === "hellfire_ingot")
        .reduce((n, x) => n + x.count, 0),
      repeat: await g.giganto.exit(),
      arena: document.querySelector("#app").classList.contains("titan-active"),
      fade: document.querySelector("#titan-return-fade").style.opacity,
    };
  });
  expect(result).toEqual({
    health: 17,
    ledger: ["browser-titan"],
    diamonds: 6,
    ingots: 8,
    repeat: false,
    arena: false,
    fade: "0",
  });
  expect(evidence.errors).toEqual([]);
  expect(evidence.external).toEqual([]);
  writeFileSync(
    out + "/return-report.json",
    JSON.stringify(
      {
        htmlSHA256: createHash("sha256").update(html).digest("hex"),
        before,
        paused,
        restored,
        result,
      },
      null,
      2,
    ),
  );
});
test("failed portal return preserves the victory and full inventory, then a second crossing awards overflow drops once", async ({
  page,
}) => {
  test.setTimeout(180000);
  const evidence = await boot(page);
  await portal(page, true);
  await finish(page);
  await page.evaluate(async () => {
    const g = dcsmcraft;
    await g.save();
    window.realSave = g.store.save.bind(g.store);
    g.store.save = async () => {
      throw Error("TEST_SAVE_FAILURE");
    };
  });
  await page.keyboard.down("KeyW");
  await page.waitForFunction(
    () =>
      dcsmcraft.giganto.active &&
      !dcsmcraft.giganto.closing &&
      document
        .querySelector("#toast")
        .textContent.includes("Enter the portal to retry"),
    null,
    { timeout: 45000 },
  );
  await page.keyboard.up("KeyW");
  const failed = await page.evaluate(() => {
    const g = dcsmcraft,
      e = g.giganto;
    e.controls.clear();
    return {
      stage: e.session.stage,
      crossed: e.session.returnPortal.crossed,
      fade: e.session.returnPortal.fade,
      running: g.running,
      ledger: e.record.ledger.length,
      drops: g.drops.filter((x) => x.uid?.startsWith("titan:")).length,
    };
  });
  expect(failed).toEqual({
    stage: "victory",
    crossed: false,
    fade: 0,
    running: true,
    ledger: 0,
    drops: 0,
  });
  await page.evaluate(() => {
    dcsmcraft.store.save = window.realSave;
  });
  await flyThrough(page);
  const result = await page.evaluate(async () => {
    const g = dcsmcraft;
    g.pause();
    await g.save();
    const id = g.id;
    await g.loadWorld(id);
    g.pause();
    return {
      ledger: g.giganto.record.ledger,
      drops: g.drops
        .filter((x) => x.uid?.startsWith("titan:"))
        .map((x) => ({ id: x.id, count: x.count })),
      repeat: await g.giganto.exit(),
    };
  });
  expect(result.ledger).toEqual(["browser-titan"]);
  expect(result.drops.sort((a, b) => a.id.localeCompare(b.id))).toEqual([
    { id: "diamond", count: 6 },
    { id: "hellfire_ingot", count: 8 },
  ]);
  expect(result.repeat).toBe(false);
  expect(evidence.errors).toEqual([]);
  expect(evidence.external).toEqual([]);
  writeFileSync(
    out + "/rollback-report.json",
    JSON.stringify({ failed, result }, null, 2),
  );
});
test("overworld menus use concise game text and retain working navigation, skin preview, settings and crafting", async ({
  page,
}) => {
  test.setTimeout(180000);
  const evidence = await boot(page);
  const captures = [];
  for (const [method, title] of [
    ["title", "DCSMCRAFT"],
    ["create", "Create New World"],
    ["skins", "Skins"],
    ["settings", "Options"],
    ["videoSettings", "Video Settings"],
    ["guide", "Controls"],
    ["features", "About DCSMCRAFT"],
    ["death", "You Died!"],
  ]) {
    await page.evaluate(async (method) => {
      dcsmcraft.pause();
      await dcsmcraft.ui[method]();
    }, method);
    const text = await page.locator("#overlay").innerText();
    expect(text).toContain(title);
    expect(text).not.toMatch(
      /foundation|room to grow|find our feet|every story has a detour|next expedition|not a complete reproduction|simplified voxel surfaces|uploaded Minecraft|wearing this outfit|honestly, block by block/i,
    );
    if (["create", "skins", "death"].includes(method)) {
      await page.screenshot({ path: out + "/" + method + ".png" });
      captures.push(method);
    }
  }
  await page.evaluate(() => {
    dcsmcraft.ui.settings();
  });
  await page.locator("[data-action=video-settings]").click();
  await expect(page.locator("#overlay h2")).toHaveText("Video Settings");
  await page.locator("[data-action=back]").last().click();
  await expect(page.locator("#overlay h2")).toHaveText("Options");
  await page.locator("[data-action=back]").last().click();
  await expect(page.locator("#overlay h2")).toHaveText("Game Menu");
  await page.locator("[data-action=resume]").click();
  await page.keyboard.press("KeyE");
  await expect(page.locator("[data-action=close-inv]")).toHaveCount(1);
  await page.locator("[data-action=close-inv]").click();
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-action=resume]")).toBeVisible();
  await page.locator("[data-action=resume]").click();
  await page.keyboard.press("F3");
  await expect(page.locator("#hud-debug")).toBeVisible();
  await expect(page.locator("#hud-debug")).not.toContainText("Draw calls");
  await expect(page.locator("#hud-debug")).not.toContainText(
    "20 Hz simulation",
  );
  expect(evidence.errors).toEqual([]);
  expect(evidence.external).toEqual([]);
  writeFileSync(
    out + "/copy-report.json",
    JSON.stringify({ captures, errors: evidence.errors }, null, 2),
  );
});
