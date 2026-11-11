import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { B, BLOCKS, ITEMS, ATLAS_COLS, ATLAS_ROWS } from "../../src/data.js";
import { COMPLETED_BLOCK_IDS } from "../../src/completed-block-art.js";
import { COMPLETED_ITEM_IDS } from "../../src/completed-item-art.js";
import { suppliedBlockFaces } from "../../src/supplied-pack.js";
import { SUPPLIED_ITEMS } from "../../src/supplied-pack-data.js";
const html = readFileSync("dist/DCSMCRAFT-Standalone.html"),
  previousRender = JSON.parse(
    readFileSync(
      new URL("../../reference/rendered-art-2.7.18.json", import.meta.url),
    ),
  ),
  out = "/workspace/artifacts/completed-art-2719";
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
async function boot(page, before = false) {
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
  await page.goto(origin + (before ? "/before.html" : "/completed-art.html"));
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

const packSnapshot = async (page, pack) =>
  page.evaluate(
    async ({ pack, ids, tiles, cols }) => {
      const g = dcsmcraft,
        r = g.renderer;
      g.settings.texturePack = pack;
      r.applyGraphics();
      const ctx = r.atlas.canvas.getContext("2d"),
        hashes = {};
      for (const t of tiles) {
        const bytes = ctx.getImageData(
          (t % cols) * 16,
          Math.floor(t / cols) * 16,
          16,
          16,
        ).data;
        let h = 2166136261;
        for (const c of bytes) h = Math.imul(h ^ c, 16777619);
        hashes[t] = [
          ...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
        ]
          .map((n) => n.toString(16).padStart(2, "0"))
          .join("");
      }
      const icons = {};
      for (const id of ids) {
        g.inventory.slots[0] = { id, count: 1 };
        g.ui.updateHotbar();
        icons[id] = [
          ...new Uint8Array(
            await crypto.subtle.digest(
              "SHA-256",
              new TextEncoder().encode(
                document.querySelector("#hotbar img").src,
              ),
            ),
          ),
        ]
          .map((n) => n.toString(16).padStart(2, "0"))
          .join("");
      }
      return { hashes, icons };
    },
    {
      pack,
      ids: Object.keys(ITEMS),
      tiles: [
        ...new Set(
          BLOCKS.flatMap((b, id) =>
            [0, 1, 2].map((f) => (b.artTile ?? id * 3) + f),
          ),
        ),
      ].filter((t) => t < ATLAS_COLS * ATLAS_ROWS),
      cols: ATLAS_COLS,
    },
  );
test("the exact standalone updates only audited atlas/icon art across all packs, preserving Classic and every finished weapon, armor, skin and food icon", async ({
  page,
}) => {
  test.setTimeout(240000);
  const evidence = await boot(page);
  const reports = [];
  for (const pack of ["classic", "renewed", "supplied"]) {
    const previous = previousRender.packs[pack],
      next = await packSnapshot(page, pack);
    const allowedBlocks = COMPLETED_BLOCK_IDS.filter(
        (id) =>
          pack !== "classic" &&
          (pack !== "supplied" ||
            BLOCKS[id].edition ||
            !suppliedBlockFaces(BLOCKS[id])),
      ),
      changedTiles = new Set(
        allowedBlocks.flatMap((id) =>
          [0, 1, 2].map((f) => (BLOCKS[id].artTile ?? id * 3) + f),
        ),
      );
    let count = 0;
    for (const [t, h] of Object.entries(previous.hashes)) {
      if (!changedTiles.has(+t))
        expect(next.hashes[t], `${pack} protected tile ${t}`).toBe(h);
      else if (next.hashes[t] !== h) count++;
    }
    const changedItems = [];
    for (const id of Object.keys(ITEMS)) {
      const item = ITEMS[id],
        b = item.block === undefined ? null : BLOCKS[item.block],
        textureChanged =
          b &&
          [0, 1, 2].some((f) =>
            changedTiles.has((b.artTile ?? item.block * 3) + f),
          ),
        newUtility =
          pack !== "classic" &&
          COMPLETED_ITEM_IDS.includes(id) &&
          !(pack === "supplied" && SUPPLIED_ITEMS[id]);
      if (!textureChanged && !newUtility)
        expect(next.icons[id], `${pack} protected icon ${id}`).toBe(
          previous.icons[id],
        );
      else if (next.icons[id] !== previous.icons[id]) changedItems.push(id);
    }
    if (pack === "classic") {
      expect(count).toBe(0);
      expect(changedItems).toHaveLength(0);
    } else expect(count).toBeGreaterThan(1200);
    reports.push({
      pack,
      changedTiles: count,
      changedItems,
      protectedItems: Object.keys(ITEMS).length - changedItems.length,
    });
  }
  writeFileSync(`${out}/before-after.json`, JSON.stringify(reports, null, 2));

  expect(evidence.errors).toEqual([]);

  expect(evidence.external).toEqual([]);
});
async function gallery(page, shots, name) {
  await page.evaluate((shots) => {
    const p = document.createElement("div");
    p.id = "art-gallery";
    p.style.cssText =
      "position:fixed;inset:0;overflow:auto;background:#25262d;z-index:99999;color:white;font:12px monospace;display:grid;grid-template-columns:repeat(8,1fr);gap:8px;padding:8px;align-content:start";
    for (const s of shots) {
      const c = document.createElement("div");
      c.textContent = s.id;
      const i = new Image();
      i.src = s.image;
      i.style.cssText = "display:block;width:100%;image-rendering:pixelated";
      c.append(i);
      p.append(c);
    }
    document.body.append(p);
  }, shots);
  await page.setViewportSize({
    width: 1280,
    height: Math.ceil(shots.length / 8) * 174 + 24,
  });
  await page
    .locator("#art-gallery img")
    .last()
    .evaluate((i) => i.decode());
  await page.screenshot({ path: `${out}/${name}.png` });
  await page.locator("#art-gallery").evaluate((p) => p.remove());
  await page.setViewportSize({ width: 854, height: 478 });
}
test("remaining block and utility art renders in actual hotbar, held and dropped models with readable cutouts and no new arm clipping", async ({
  page,
}) => {
  test.setTimeout(240000);
  const evidence = await boot(page);
  const blockIds = Object.entries(ITEMS)
    .filter(
      ([id, item]) =>
        item.block !== undefined &&
        COMPLETED_BLOCK_IDS.some(
          (n) =>
            (BLOCKS[n].artTile ?? n * 3) ===
            (BLOCKS[item.block].artTile ?? item.block * 3),
        ),
    )
    .map(([id]) => id);
  const ids = [...blockIds, ...COMPLETED_ITEM_IDS];
  const results = await page.evaluate((ids) => {
    const g = dcsmcraft,
      r = g.renderer,
      rows = [],
      shots = [];
    for (const id of ids) {
      g.inventory.slots[0] = { id, count: 1 };
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
      g.ui.updateHotbar();
      const m = r.heldMesh;
      rows.push({
        id,
        finite: m.matrixWorld.elements.every(Number.isFinite),
        clear: r.handRig.viewBounds.max.z <= -0.1099,
        hidden: !r.handRig.armVisuals.visible,
      });
      shots.push({ id, image: document.querySelector("#hotbar img").src });
    }
    return { rows, shots };
  }, ids);
  for (const row of results.rows)
    expect(row, row.id).toMatchObject({
      finite: true,
      clear: true,
      hidden: true,
    });
  const selected = [
    "crafting_table",
    "furnace",
    "chest",
    "smithing_table",
    "blast_furnace",
    "smoker",
    "barrel",
    "note_block",
    "stonecutter",
    "cauldron",
    "flower_pot",
    "heavy_core",
    "acacia_planks",
    "cherry_planks",
    "mangrove_log",
    "pale_oak_log",
    "bamboo_mosaic",
    "deepslate_bricks",
    "chiseled_tuff",
    "resin_bricks",
    "red_stained_glass",
    "magma_block",
    "prismarine",
    "conduit",
    "melon",
    "pumpkin",
    "red_mushroom",
    "lily_of_the_valley",
    "oak_sapling",
    "cornflower",
    "dandelion",
    "ladder",
    "sponge",
    "cactus",
    ...COMPLETED_ITEM_IDS,
  ];
  await gallery(
    page,
    results.shots.filter((q) => selected.includes(q.id)),
    "remaining-art",
  );
  writeFileSync(
    `${out}/held-checks.json`,
    JSON.stringify(results.rows, null, 2),
  );
  const dropped = await page.evaluate((ids) => {
    const g = dcsmcraft;
    g.drops = ids.map((id, i) => ({
      id,
      count: 1,
      uid: "art-" + i,
      x: 1 + (i % 6) * 0.6,
      y: 200.5,
      z: -2 - Math.floor(i / 6),
      age: 20,
      delay: 0,
      vx: 0,
      vy: 0,
      vz: 0,
    }));
    g.renderer.syncEntities([], g.drops, g.elapsed);
    g.renderer.draw({
      game: g,
      player: g.player,
      playing: true,
      elapsed: g.elapsed,
      animating: false,
    });
    return {
      count: g.renderer.dropMeshes.size,
      finite: [...g.renderer.dropMeshes.values()].every((m) =>
        m.matrixWorld.elements.every(Number.isFinite),
      ),
      cutouts: [...g.renderer.dropMeshes.values()].every(
        (m) => m.userData.flatCutout,
      ),
    };
  }, COMPLETED_ITEM_IDS);
  expect(dropped).toMatchObject({ count: 18, finite: true, cutouts: true });
  const alpha = await page.evaluate(
    async (shots) => {
      for (const q of shots) {
        const i = new Image();
        i.src = q.image;
        await i.decode();
        const c = document.createElement("canvas");
        c.width = c.height = 32;
        const x = c.getContext("2d");
        x.drawImage(i, 0, 0);
        const d = x.getImageData(0, 0, 32, 32).data;
        for (let n = 3; n < d.length; n += 4)
          if (d[n] !== 0 && d[n] !== 255)
            throw Error("filtered utility alpha " + q.id);
      }
      return true;
    },
    results.shots.filter((q) => COMPLETED_ITEM_IDS.includes(q.id)),
  );
  expect(alpha).toBe(true);
  expect(evidence.errors).toEqual([]);
  expect(evidence.external).toEqual([]);
});
