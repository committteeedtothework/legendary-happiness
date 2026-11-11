import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import {
  REFINED_ITEM_IDS,
  REFINED_COLOR_IDS,
} from "../../src/refined-item-art.js";

import { B, ITEMS } from "../../src/data.js";
const html = readFileSync("dist/DCSMCRAFT-Standalone.html"),
  out = "/workspace/artifacts/item-arrow-2718";
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
  await page.goto(origin + "/item-arrow.html");
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
async function gallery(page, shots, name, cols = 4) {
  await page.evaluate(
    ({ shots, cols }) => {
      const old = document.querySelector("#weapon-gallery");
      old?.remove();
      let panel = document.createElement("div");
      panel.id = "weapon-gallery";
      panel.style.cssText = `position:fixed;inset:0;overflow:auto;background:#1e252c;z-index:100000;display:grid;grid-template-columns:repeat(${cols},1fr);align-content:start;gap:4px;color:#fff;font:12px monospace;padding:8px`;
      for (const s of shots) {
        const cell = document.createElement("div");
        cell.textContent = s.id;
        let img = new Image();
        img.src = s.image;
        img.style.cssText =
          "display:block;width:100%;image-rendering:pixelated";
        cell.append(img);
        panel.append(cell);
      }
      document.body.append(panel);
    },
    { shots, cols },
  );
  await page
    .locator("#weapon-gallery img")
    .last()
    .evaluate((i) => i.decode());
  const ratio = await page
    .locator("#weapon-gallery img")
    .first()
    .evaluate((i) => i.naturalHeight / i.naturalWidth);
  await page.setViewportSize({
    width: 1280,
    height: Math.ceil(
      Math.ceil(shots.length / cols) * ((1280 / cols) * ratio + 28) + 40,
    ),
  });
  await page.screenshot({ path: `${out}/${name}.png` });
  await page.locator("#weapon-gallery").evaluate((n) => n.remove());
  await page.setViewportSize({ width: 854, height: 478 });
}
test("all 75 refreshed food/resource icons render crisp distinct original art and remain flat held items without arm clipping", async ({
  page,
}) => {
  test.setTimeout(120000);
  const evidence = await boot(page);
  const result = await page.evaluate(
    (ids) => {
      const g = dcsmcraft,
        r = g.renderer,
        shots = [],
        rows = [];
      for (const id of ids) {
        g.inventory.slots[0] = { id, count: 1 };
        g.ui.updateHotbar();
        shots.push({ id, image: document.querySelector("#hotbar img").src });
        r.setHeld(id, g.inventory.held);
        r.animator.reset();
        r.animator.equip = 0;
        r.draw({
          game: g,
          player: g.player,
          playing: true,
          elapsed: g.elapsed,
          animating: false,
        });
        rows.push({
          id,
          flat: r.heldMesh.userData.flatCutout,
          finite: r.heldMesh.matrixWorld.elements.every(Number.isFinite),
          clear: r.handRig.viewBounds.max.z <= -0.1099,
          hidden: !r.handRig.armVisuals.visible,
        });
      }
      return { shots, rows };
    },
    [...REFINED_ITEM_IDS, ...REFINED_COLOR_IDS],
  );
  expect(result.rows.length).toBe(75);
  for (const row of result.rows)
    expect(row, row.id).toMatchObject({
      flat: true,
      finite: true,
      clear: true,
      hidden: true,
    });
  await gallery(page, result.shots, "refined-items", 8);
  writeFileSync(
    `${out}/refined-items.json`,
    JSON.stringify(result.rows, null, 2),
  );
  const distinct = await page.evaluate(async (shots) => {
    const s = new Set();
    for (const shot of shots) {
      const img = new Image();
      img.src = shot.image;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = c.height = 32;
      const x = c.getContext("2d");
      x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, 32, 32).data;
      let transparent = false,
        opaque = false;
      for (let i = 3; i < d.length; i += 4) {
        if (d[i] !== 0 && d[i] !== 255)
          throw Error("Filtered alpha " + shot.id);
        transparent ||= d[i] === 0;
        opaque ||= d[i] === 255;
      }
      if (!transparent || !opaque) throw Error("Missing cutout " + shot.id);
      s.add(shot.image);
    }
    return s.size;
  }, result.shots);
  expect(distinct).toBeGreaterThan(65);
  expect(evidence.errors).toEqual([]);
  expect(evidence.external).toEqual([]);
});
test("actual Survival bow shots point forward in first/F5, lodge into a wall, persist through reload and return exactly one arrow on pickup", async ({
  page,
}) => {
  test.setTimeout(150000);
  const evidence = await boot(page);
  await page.evaluate((stone) => {
    const g = dcsmcraft;
    g.mode = "survival";
    g.inventory.slots[0] = { id: "bow", count: 1, durability: 100 };
    g.inventory.slots[1] = { id: "arrow", count: 2 };
    g.target = null;
    g.lastPlace = -1e6;
    g.pointerLockFallback = true;
    for (let z = -4; z <= 1; z++) g.world.set(0, 199, z, stone);
    g.world.set(0, 200, -3, stone);
    g.world.set(0, 201, -3, stone);
    g.renderer.setHeld("bow", g.inventory.held);
    document
      .querySelector("#game-canvas")
      .dispatchEvent(new MouseEvent("mousedown", { button: 2, bubbles: true }));
    g.elapsed += 1.5;
    g.renderer.animator.reset();
  }, B.stone);
  const direction = await page.evaluate(() => {
    const g = dcsmcraft,
      r = g.renderer,
      shots = [];
    let result = [];
    for (const mode of [0, 2]) {
      g.elapsed += 0.033;
      r.draw({
        game: g,
        player: g.player,
        playing: true,
        cameraMode: mode,
        elapsed: g.elapsed,
        animating: true,
      });
      const m = mode ? r.playerModel.userData.grip.children[0] : r.heldMesh,
        a = m.userData.nockedArrow;
      const tip = a.localToWorld(a.userData.tip.clone()),
        nock = a.localToWorld(a.userData.nock.clone()),
        d = tip.clone().sub(nock).normalize();
      const frame = m.userData.drawMeshes[m.userData.drawStage],
        s = frame.localToWorld(frame.userData.stringNock.clone());
      result.push({ z: d.z, contact: nock.distanceTo(s) });
      shots.push(r.gl.domElement.toDataURL());
    }
    return { result, shots };
  });
  for (const r of direction.result) {
    expect(r.z).toBeLessThan(-0.999);
    expect(r.contact).toBeLessThan(0.00001);
  }
  for (let i = 0; i < 2; i++)
    writeFileSync(
      `${out}/drawn-bow-${i ? "F5" : "first"}.png`,
      Buffer.from(direction.shots[i].split(",")[1], "base64"),
    );
  await page.evaluate(() => {
    dispatchEvent(new MouseEvent("mouseup", { button: 2 }));
    dcsmcraft.running = true;
  });
  await page.waitForFunction(
    () => dcsmcraft.world.embeddedArrows?.length === 1,
  );
  const lodged = await page.evaluate(() => {
    const g = dcsmcraft;
    g.pause();
    return {
      arrow: g.world.embeddedArrows[0],
      ammo: g.inventory.slots
        .filter((s) => s?.id === "arrow")
        .reduce((n, s) => n + s.count, 0),
      loose: g.drops.filter((s) => s.id === "arrow").length,
      visible: [...g.renderer.projectileMeshes.values()].some((m) => m.visible),
    };
  });
  expect(lodged.ammo).toBe(1);
  expect(lodged.visible).toBe(true);
  expect(lodged.loose).toBe(0);
  expect(lodged.arrow.stuck).toBe(true);
  expect(lodged.arrow.hit.z).toBe(-3);
  await page.evaluate(() => dcsmcraft.save());
  await page.reload();
  await page.waitForFunction(() => dcsmcraft?.initialized);
  await page.locator("[data-action=load]").first().click();
  await page.waitForFunction(
    () => dcsmcraft.running && dcsmcraft.ui.screen === "play",
  );
  expect(await page.evaluate(() => dcsmcraft.world.embeddedArrows.length)).toBe(
    1,
  );
  await page.evaluate(() => {
    const g = dcsmcraft,
      q = g.world.embeddedArrows[0];
    Object.assign(g.player, {
      x: q.x,
      y: 200,
      z: q.z + 0.2,
      vx: 0,
      vy: 0,
      vz: 0,
    });
  });
  await page.waitForFunction(
    () =>
      dcsmcraft.world.embeddedArrows.length === 0 &&
      dcsmcraft.inventory.slots
        .filter((s) => s?.id === "arrow")
        .reduce((n, s) => n + s.count, 0) === 2,
  );
  await page.evaluate(() => dcsmcraft.pause());
  expect(
    await page.evaluate(() =>
      dcsmcraft.inventory.slots
        .filter((s) => s?.id === "arrow")
        .reduce((n, s) => n + s.count, 0),
    ),
  ).toBe(2);
  expect(evidence.errors).toEqual([]);
  expect(evidence.external).toEqual([]);
});
test("crafting and Creative views have one functional close X, recipe books still toggle, and real empty-hand swings are silent", async ({
  page,
}) => {
  const evidence = await boot(page);
  for (const [mode, type, tab] of [
    ["survival", "personal", "inventory"],
    ["survival", "table", "inventory"],
    ["creative", "personal", "catalog"],
    ["creative", "personal", "inventory"],
  ]) {
    await page.evaluate(
      ({ mode, type, tab }) => {
        const g = dcsmcraft;
        g.mode = mode;
        g.ui.creativeTab = tab;
        g.openInventory(type);
      },
      { mode, type, tab },
    );
    const crosses = page.locator("#overlay button").filter({ hasText: /^×$/ });
    await expect(crosses).toHaveCount(1);
    if (mode === "survival" || tab === "inventory") {
      const book = page.locator("[data-action=toggle-recipes]");
      await book.click();
      await expect(crosses).toHaveCount(1);
      await book.click();
    }
    await page.locator("[data-action=close-inv]").click();
    await page.waitForFunction(() => dcsmcraft.ui.screen === "play");
  }
  const swing = await page.evaluate(() => {
    const g = dcsmcraft;
    g.pause();
    g.ui.play();
    g.inventory.slots[0] = null;
    g.inventory.selected = 0;
    g.target = null;
    g.entities = [];
    g.pointerLockFallback = true;
    const tones = [];
    g.audio.tone = (type) => tones.push(type);
    document
      .querySelector("#game-canvas")
      .dispatchEvent(new MouseEvent("mousedown", { button: 0, bubbles: true }));
    const kind = g.renderer.animator.action?.kind;
    dispatchEvent(new MouseEvent("mouseup", { button: 0 }));
    return { tones, kind };
  });
  expect(swing.kind).toBe("attack");
  expect(swing.tones).not.toContain("swing");
  expect(evidence.errors).toEqual([]);
  expect(evidence.external).toEqual([]);
});
