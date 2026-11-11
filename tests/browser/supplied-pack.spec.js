import { test, expect } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import { B, BLOCKS, makeStack, ATLAS_COLS } from "../../src/data.js";
import { suppliedBlockFaces } from "../../src/supplied-pack.js";
import { EXTRA_ART } from "../../src/block-art.js";
import {
  SUPPLIED_PIXELS,
  SUPPLIED_ITEMS,
} from "../../src/supplied-pack-data.js";
const html = readFileSync("dist/DCSMCRAFT-Standalone.html", "utf8");
const captures = "/workspace/artifacts/supplied-pack-playtest";
mkdirSync(captures, { recursive: true });
const expectedTiles = BLOCKS.flatMap((b, id) =>
  (b.edition || b.key === "torch" ? [] : suppliedBlockFaces(b) || []).map(
    (face, f) => ({
      tile: (b.artTile ?? id * 3) + f,
      pixels: SUPPLIED_PIXELS["block/" + face],
    }),
  ),
);
expectedTiles.push(
  ...Object.entries(EXTRA_ART).map(([name, tile]) => ({
    tile,
    pixels: SUPPLIED_PIXELS["block/" + name],
  })),
);
async function open(page, standalone = true) {
  const errors = [],
    requests = [];
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
          renderDistance: 2,
          graphics: 2,
          volume: 0,
          musicEnabled: false,
        }),
      );
  });
  if (standalone)
    await page.route("**/*", (r) => {
      if (r.request().url().endsWith("/pack.html"))
        return r.fulfill({ contentType: "text/html", body: html });
      requests.push(r.request().url());
      return r.abort();
    });
  await page.goto(standalone ? "/pack.html" : "/");
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  return { errors, requests };
}
async function create(page) {
  await page.locator("[data-action=create]").first().click();
  await page.locator("[name=seed]").fill("Wildflower");
  await page.locator("[name=mode][value=creative]").check();
  await page.locator("[data-action=start-world]").click();
  await page.waitForFunction(() => dcsmcraft.running);
}
async function menu(page) {
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page
    .getByRole("button", { name: "Video Settings...", exact: true })
    .click();
}
async function play(page) {
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await page.locator(".settings-dialog > [data-action=back]").click();
  await page.locator("[data-action=resume]").first().click();
  await page.waitForFunction(() => dcsmcraft.running);
}
test("offline pack renders every imported block face with exact pixels and transparent cutouts, inventory, held and dropped items", async ({
  page,
}) => {
  test.setTimeout(150000);
  const result = await open(page);
  await create(page);
  await menu(page);
  await page.locator("[data-preference=texturePack]").selectOption("supplied");
  await page.locator("[data-preference=texturePack]").scrollIntoViewIfNeeded();
  await page.screenshot({ path: captures + "/graphics-menu.png" });
  const bad = await page.evaluate(
    ({ tiles, columns }) => {
      const c = dcsmcraft.renderer.atlas.canvas.getContext("2d");
      return tiles
        .filter(({ tile, pixels }) => {
          const raw = atob(pixels),
            out = [];
          for (let i = 0; i < raw.length; i += 5)
            for (let n = 0; n < raw.charCodeAt(i); n++)
              for (let j = 1; j < 5; j++) out.push(raw.charCodeAt(i + j));
          const actual = c.getImageData(
            (tile % columns) * 16,
            Math.floor(tile / columns) * 16,
            16,
            16,
          ).data;
          // Canvas clears hidden RGB and rounds premultiplied translucent pixels.
          return out.some((v, i) => {
            const alpha = out[i - (i % 4) + 3];
            if (i % 4 !== 3 && alpha === 0) return false;
            return (
              Math.abs(actual[i] - v) > (i % 4 !== 3 && alpha < 255 ? 2 : 0)
            );
          });
        })
        .map((t) => t.tile);
    },
    { tiles: expectedTiles, columns: ATLAS_COLS },
  );
  expect(bad).toEqual([]);
  await play(page);
  const badItems = await page.evaluate(
    async (items) => {
      const g = dcsmcraft;
      g.pause();
      g.ui.play();
      g.running = false;
      const bad = [],
        canvas = document.createElement("canvas");
      canvas.width = canvas.height = 32;
      const c = canvas.getContext("2d");
      for (const [id, encoded] of items) {
        g.inventory.slots[0] = { id, count: 1 };
        g.ui.updateHotbar();
        const img = document.querySelector("#hotbar img");
        await img.decode();
        c.clearRect(0, 0, 32, 32);
        c.drawImage(img, 0, 0, 32, 32);
        const actual = c.getImageData(0, 0, 32, 32).data;
        const raw = atob(encoded),
          out = [];
        for (let i = 0; i < raw.length; i += 5)
          for (let n = 0; n < raw.charCodeAt(i); n++)
            for (let j = 1; j < 5; j++) out.push(raw.charCodeAt(i + j));
        let mismatch = false;
        for (let y = 0; y < 32; y++)
          for (let x = 0; x < 32; x++) {
            const source = (Math.floor(y / 2) * 16 + Math.floor(x / 2)) * 4,
              dest = (y * 32 + x) * 4;
            for (let ch = 0; ch < 4; ch++)
              if (
                (ch === 3 || out[source + 3]) &&
                Math.abs(actual[dest + ch] - out[source + ch]) >
                  (ch < 3 && out[source + 3] < 255 ? 2 : 0)
              )
                mismatch = true;
          }
        if (mismatch) bad.push(id);
      }
      return bad;
    },
    Object.entries(SUPPLIED_ITEMS).map(([id, name]) => [
      id,
      SUPPLIED_PIXELS[name.includes("/") ? name : "item/" + name],
    ]),
  );
  expect(badItems).toEqual([]);
  await page.evaluate(
    ({ B, stack }) => {
      const g = dcsmcraft;
      g.pause();
      g.entities = [];
      g.drops = [];
      Object.assign(g.player, {
        x: 0.5,
        y: 200,
        z: 6.5,
        yaw: 0,
        pitch: 0.1,
        vx: 0,
        vy: 0,
        vz: 0,
        flying: false,
        onGround: true,
      });
      for (let x = -7; x <= 7; x++)
        for (let z = -9; z <= 8; z++) g.world.set(x, 199, z, B.grass);
      for (const [i, id] of [
        B.stone,
        B.diamond_ore,
        B.cobble,
        B.planks,
        B.log,
        B.glass,
        B.leaves,
        B.brick,
        B.bookshelf,
        B.jukebox,
      ].entries())
        g.world.set(i - 5, 200, 0, id);
      g.inventory.slots[0] = stack;
      g.inventory.slots[1] = { id: "diamond_sword", count: 1 };
      g.inventory.slots[2] = { id: "apple", count: 3 };
      g.inventory.selected = 0;
      g.renderer.setHeld(stack.id, stack);
      g.ui.play();
      g.running = false;
      g.pointerLockFallback = true;
      g.renderer.loadAround(0.5, 6.5, 2, 9);
    },
    { B, stack: makeStack("flint_and_steel") },
  );
  await page.waitForFunction(() => dcsmcraft.renderer.meshes.size >= 9);
  const imageInfo = await page.evaluate(() => {
    let pixels, kind;
    dcsmcraft.renderer.heldMesh.traverse((m) => {
      if (m.isMesh && m.material.map) {
        const canvas = m.material.map.image;
        pixels = Array.from(
          canvas
            .getContext("2d")
            .getImageData(0, 0, canvas.width, canvas.height).data,
        );
        kind = m.geometry.type;
      }
    });
    return {
      kind,
      transparent: pixels.filter((v, i) => i % 4 === 3 && v === 0).length,
      opaque: pixels.filter((v, i) => i % 4 === 3 && v > 0).length,
    };
  });
  expect(imageInfo.kind).toBe("PlaneGeometry");
  expect(imageInfo.transparent).toBeGreaterThan(300);
  expect(imageInfo.opaque).toBeGreaterThan(80);
  await page.screenshot({ path: captures + "/flint-held.png" });
  await page.keyboard.press("KeyQ");
  await page.waitForFunction(() =>
    dcsmcraft.drops.some((d) => d.id === "flint_and_steel"),
  );
  await page.waitForFunction(() => dcsmcraft.renderer.dropMeshes.size > 0);
  await page.screenshot({ path: captures + "/terrain-items.png" });
  await page.keyboard.press("KeyE");
  await expect(page.locator("[data-action=close-inv]").first()).toBeVisible();
  await page.screenshot({ path: captures + "/creative-inventory.png" });
  expect(
    await page.evaluate(() => dcsmcraft.renderer.gl.getContext().getError()),
  ).toBe(0);
  expect(result.errors).toEqual([]);
  expect(result.requests).toEqual([]);
});
test("all packs switch reversibly without editing world state; supplied choice and world survive reload", async ({
  page,
}) => {
  const result = await open(page);
  await create(page);
  await menu(page);
  const choice = page.locator("[data-preference=texturePack]");
  const snapshots = {};
  for (const name of [
    "classic",
    "soft",
    "renewed",
    "supplied",
    "classic",
    "soft",
    "renewed",
    "supplied",
  ]) {
    await choice.selectOption(name);
    const state = await page.evaluate(() => ({
      pixels: dcsmcraft.renderer.atlas.canvas.toDataURL(),
      edits: dcsmcraft.world.edits.size,
      pack: dcsmcraft.renderer.appliedPack,
    }));
    expect(state.pack).toBe(name);
    if (snapshots[name]) expect(state).toEqual(snapshots[name]);
    else snapshots[name] = state;
  }
  expect(snapshots.supplied.pixels).not.toBe(snapshots.renewed.pixels);
  await page.evaluate(async (B) => {
    dcsmcraft.world.set(-1, 200, 16, B.diamond_block);
    dcsmcraft.inventory.slots[8] = { id: "diamond", count: 7 };
    await dcsmcraft.save();
  }, B);
  await page.reload();
  await page.waitForFunction(() => window.dcsmcraft?.initialized);
  expect(
    await page.evaluate(() => ({
      setting: dcsmcraft.settings.texturePack,
      applied: dcsmcraft.renderer.appliedPack,
    })),
  ).toEqual({ setting: "supplied", applied: "supplied" });
  await page.locator("[data-action=load]").first().click();
  await page.waitForFunction(() => dcsmcraft.running);
  expect(
    await page.evaluate(() => ({
      block: dcsmcraft.world.get(-1, 200, 16),
      item: dcsmcraft.inventory.slots[8],
    })),
  ).toEqual({ block: B.diamond_block, item: { id: "diamond", count: 7 } });
  expect(result.errors).toEqual([]);
  expect(result.requests).toEqual([]);
});
test("production-style web entry starts with saved supplied pack and retains normal movement", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "dcsmcraft-settings",
      JSON.stringify({
        texturePack: "supplied",
        renderDistance: 2,
        graphics: 1,
        volume: 0,
      }),
    ),
  );
  const result = await open(page, false);
  await create(page);
  expect(await page.evaluate(() => dcsmcraft.renderer.appliedPack)).toBe(
    "supplied",
  );
  const before = await page.evaluate(() => ({
    x: dcsmcraft.player.x,
    z: dcsmcraft.player.z,
  }));
  await page.evaluate(() => {
    dcsmcraft.pointerLockFallback = true;
  });
  await page.keyboard.down("KeyW");
  await page.waitForTimeout(650);
  await page.keyboard.up("KeyW");
  const after = await page.evaluate(() => ({
    x: dcsmcraft.player.x,
    z: dcsmcraft.player.z,
  }));
  expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeGreaterThan(
    0.3,
  );
  expect(result.errors).toEqual([]);
});
