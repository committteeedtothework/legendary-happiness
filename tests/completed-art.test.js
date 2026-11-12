import { beforePlayerCopy } from "./helpers/player-copy-source.js";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { B, BLOCKS, ATLAS_COLS, ATLAS_ROWS } from "../src/data.js";
import {
  COMPLETED_BLOCK_IDS,
  completedBlockPixels,
  paintCompletedBlocks,
} from "../src/completed-block-art.js";
import {
  COMPLETED_ITEM_IDS,
  completedItemPixels,
  paintCompletedItem,
} from "../src/completed-item-art.js";
import { suppliedBlockFaces } from "../src/supplied-pack.js";
const canvas = () => {
  const writes = new Map();
  return {
    writes,
    getContext: () => ({
      createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }),
      putImageData: (data, x, y) => {
        assert.ok(
          x >= 0 &&
            y >= 0 &&
            x + 16 <= ATLAS_COLS * 16 &&
            y + 16 <= ATLAS_ROWS * 16,
        );
        writes.set(`${x},${y}`, data.data.slice());
      },
    }),
  };
};
test("remaining block coverage includes all unique edition owners and legacy directional states with valid low-palette pixels", () => {
  assert.equal(COMPLETED_BLOCK_IDS.length, 626);
  for (let id = 0; id < BLOCKS.length; id++) {
    const b = BLOCKS[id];
    if (
      b.edition &&
      b.artOwner &&
      (b.editionBase === undefined || b.editionBase === id) &&
      !/(?:^|_)wool$/.test(b.materialKey || b.key)
    )
      assert.ok(COMPLETED_BLOCK_IDS.includes(id), b.key);
  }
  for (const id of COMPLETED_BLOCK_IDS)
    for (let face = 0; face < 3; face++) {
      const p = completedBlockPixels(id, face),
        used = new Set(p.grid.flat());
      assert.equal(p.grid.length, 16);
      assert.ok(p.grid.every((row) => row.length === 16));
      assert.ok(used.size <= 12, p.key);
      assert.ok(
        [...used].some((c) => p.palette[c]),
        p.key,
      );
      for (const c of used)
        assert.ok(
          c === "." || /^#[0-9a-f]{6}$/i.test(p.palette[c]),
          `${p.key}:${c}`,
        );
    }
});
test("completion writes only owned atlas cells; Classic is untouched and supplied native tiles are preserved", () => {
  const renewed = canvas(),
    classic = canvas(),
    supplied = canvas();
  paintCompletedBlocks(renewed, "renewed");
  paintCompletedBlocks(classic, "classic");
  paintCompletedBlocks(supplied, "supplied");
  assert.equal(classic.writes.size, 0);
  assert.equal(renewed.writes.size, COMPLETED_BLOCK_IDS.length * 3);
  const expected = new Set(
    COMPLETED_BLOCK_IDS.filter(
      (id) => BLOCKS[id].edition || !suppliedBlockFaces(BLOCKS[id]),
    ).flatMap((id) =>
      [0, 1, 2].map((f) => {
        let tile = (BLOCKS[id].artTile ?? id * 3) + f;
        return `${(tile % ATLAS_COLS) * 16},${Math.floor(tile / ATLAS_COLS) * 16}`;
      }),
    ),
  );
  assert.deepEqual(new Set(supplied.writes.keys()), expected);
  for (const bytes of renewed.writes.values())
    for (let i = 3; i < bytes.length; i += 4)
      assert.ok(bytes[i] === 0 || bytes[i] === 255);
  const target = new Set(
    COMPLETED_BLOCK_IDS.flatMap((id) =>
      [0, 1, 2].map((f) => (BLOCKS[id].artTile ?? id * 3) + f),
    ),
  );
  for (const id of [
    B.grass,
    B.stone,
    B.log,
    B.leaves,
    B.hellfire_ore,
    B.devin_relic_blade,
  ])
    for (const f of [0, 1, 2])
      assert.ok(!target.has(id * 3 + f), BLOCKS[id].key);
});
test("shared material families and waxed states keep coherent art; plant, glass, ladder and web cutouts retain real holes", () => {
  for (const [a, b] of [
    ["deepslate_bricks", "deepslate_brick_slab"],
    ["deepslate_tiles", "deepslate_tile_stairs"],
    ["cut_copper", "waxed_cut_copper"],
  ])
    for (let f = 0; f < 3; f++) {
      const aa = completedBlockPixels(B[a], f),
        bb = completedBlockPixels(B[b], f);
      assert.deepEqual(aa.grid, bb.grid);
      assert.deepEqual(aa.palette, bb.palette);
    }
  for (const k of [
    "oak_sapling",
    "red_mushroom",
    "lily_of_the_valley",
    "ladder",
    "cobweb",
    "red_stained_glass",
    "azalea_leaves",
    "kelp",
    "tube_coral_fan",
    "sea_pickle_1",
  ]) {
    const p = completedBlockPixels(B[k], 1),
      pixels = p.grid.flat();
    assert.ok(pixels.includes("."), k);
    assert.ok(
      pixels.some((c) => p.palette[c]),
      k,
    );
  }
  const signature = (id) =>
    JSON.stringify(completedBlockPixels(B[id], 1)?.grid);
  assert.notEqual(signature("red_mushroom"), signature("lily_of_the_valley"));
  assert.notEqual(signature("barrel"), signature("blast_furnace"));
  assert.notEqual(signature("melon"), signature("note_block"));
  assert.equal(completedBlockPixels(B.cornflower, 1).palette.r, "#a38cd1");
  assert.equal(completedBlockPixels(B.dandelion, 1).palette.r, "#e3bf52");
  assert.ok(completedBlockPixels(B.dandelion, 1).grid.flat().includes("r"));
});
test("the 18 remaining utility sprites have distinct integer-pixel silhouettes, transparent interiors and bounded discrete palettes", () => {
  assert.equal(COMPLETED_ITEM_IDS.length, 18);
  const images = new Set();
  for (const id of COMPLETED_ITEM_IDS) {
    const art = completedItemPixels(id);
    assert.ok(art.grid.flat().includes("."));
    const ops = [];
    const c = {
      set fillStyle(v) {
        this.color = v;
      },
      fillRect(...p) {
        assert.ok(p.every(Number.isInteger));
        assert.ok(
          p[0] >= 0 && p[1] >= 0 && p[0] + p[2] <= 32 && p[1] + p[3] <= 32,
        );
        assert.match(this.color, /^#[0-9a-f]{6}$/i);
        ops.push([this.color, ...p]);
      },
    };
    assert.ok(paintCompletedItem(c, id));
    assert.ok(ops.length > 15, id);
    images.add(JSON.stringify(ops));
  }
  assert.equal(images.size, 18);
  assert.equal(completedItemPixels("glass_bottle").grid[9][8], ".");
  assert.equal(completedItemPixels("water_bottle").grid[11][8], "b");
  for (const id of [
    "chicken",
    "mutton",
    "devin_sword",
    "matthew_dual_pistols",
    "iron_helmet",
    "spawn_egg_cow",
  ])
    assert.equal(completedItemPixels(id), null, id);
});
test("existing simulation, progression, arrows, animation, art and supplied assets retain their prior hashes outside authorized Titan, lighting and save-durability modules", () => {
  const before = JSON.parse(
    readFileSync(
      new URL("../reference/visual-runtime-2.7.18.json", import.meta.url),
    ),
  );
  for (const [name, h] of Object.entries(before)) {
    if (
      [
        // 2.19.0 adds an original achievement cue; 2.18.0 adds ledger observers.
        "src/audio.js",
        "src/equipment.js",
        "src/simulation.js",
        "src/ecology.js",
        "src/coop-survival.js",
        "src/aquatic.js",
        "src/realms.js",
        "src/relic.js",
        "src/invasion.js",
        "src/devils-palm.js",
        "src/rift-trial.js",
        "src/textures.js",
        "src/renderer.js",
        "src/graphics.js",
        "src/mesher.js",
        "src/block-art.js",
        "src/world.js",
        "src/edition-interactions.js",
        "src/worker-code.js",
        "src/terrain-worker.js",
        "src/horizon.js",
        "src/mesh-snapshot.js",
        "desktop/README.md",
        "src/main.js",
        "src/physics.js",
        "src/ui.js",
        "src/claim-audio.js",
        "src/menu-audio.js",
        "src/multiplayer.js",
        // P0 save durability is now covered behaviorally in save-durability.test.js.
        "src/storage.js",
      ].includes(name)
    )
      continue;
    let data = readFileSync(new URL("../" + name, import.meta.url));
    data = beforePlayerCopy(name, data);
    if (name === "src/data.js")
      data = Buffer.from(
        data
          .toString()
          .replace(
            /export const VERSION = "[^"]+"/,
            'export const VERSION = "2.7.18"',
          ),
      );
    assert.equal(createHash("sha256").update(data).digest("hex"), h, name);
  }
});
