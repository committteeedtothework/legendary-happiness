import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  B,
  BLOCKS,
  ITEMS,
  RECIPES,
  CREATIVE_ITEMS,
  SMELTS,
  makeStack,
  ATLAS_COLS,
  ATLAS_ROWS,
} from "../src/data.js";
import reference from "../src/edition-reference.js";
import { EDITION_AUDIT } from "../src/edition-data.js";
import {
  blockParts,
  editionStateId,
  shapeSurfaces,
} from "../src/block-shapes.js";
import { blockArtUV, blockArtTile } from "../src/block-art.js";
import { World } from "../src/world.js";
import { Inventory, matchRecipe } from "../src/inventory.js";
import { allocateIngredients, recipeNeeds } from "../src/recipe-ingredients.js";
import { collides, createPlayer, moveBody } from "../src/physics.js";
import { placeDoor, doorAt, setDoorOpen } from "../src/doors.js";
import {
  placeEdition,
  useEdition,
  tickEditionWorld,
} from "../src/edition-interactions.js";
import {
  useEditionWeapon,
  releaseEditionWeapon,
  blockShieldProjectile,
} from "../src/edition-combat.js";
import { tickHostileProjectiles } from "../src/hostile-combat.js";
import { tickSurvival, createEntity, damageEntity } from "../src/simulation.js";
import { createHeldModel, createDroppedModel } from "../src/first-person.js";
import { mockCanvas } from "./helpers/mock-canvas.js";
import { meshChunk } from "../src/mesher.js";
function arena() {
  const world = new World("content mechanics", {}, "overworld", 15),
    inventory = new Inventory();
  for (let z = 0; z < 8; z++)
    for (let x = 0; x < 8; x++) {
      world.set(x, 199, z, B.stone);
      for (let y = 200; y < 205; y++) world.set(x, y, z, B.air);
    }
  return {
    world,
    inventory,
    player: createPlayer({ x: 2.5, y: 200, z: 2.5 }),
    entities: [],
    drops: [],
    hostileProjectiles: [],
    mode: "survival",
    difficulty: "normal",
    elapsed: 5,
    tickCount: 1,
    time: 1000,
    dimension: "overworld",
    settings: { renderDistance: 2, cycleText: {} },
    audio: { tone() {}, voice() {} },
    renderer: { action() {}, combatImpact() {} },
    ui: { toast() {}, updateHotbar() {}, updateHUD() {} },
    damage() {},
  };
}
test("version-pinned audit covers every reference block and item, with explicit deferred/excluded entries and no duplicate aliases", () => {
  assert.equal(reference.version, "26.3");
  assert.equal(EDITION_AUDIT.blocks.length, 1286);
  assert.equal(EDITION_AUDIT.items.length, 1658);
  for (const entries of Object.values(EDITION_AUDIT)) {
    assert.equal(new Set(entries.map((e) => e.reference)).size, entries.length);
    assert.ok(
      entries.every(
        (e) =>
          e.note &&
          ["added", "retained", "deferred", "excluded"].includes(e.status),
      ),
    );
    assert.ok(entries.some((e) => e.status === "deferred"));
  }
  assert.equal(ITEMS.oak_log, undefined);
  assert.equal(ITEMS.cobblestone, undefined);
  assert.equal(new Set(CREATIVE_ITEMS).size, CREATIVE_ITEMS.length);
  assert.equal(new Set(BLOCKS.map((b) => b.key)).size, BLOCKS.length);
  assert.ok(
    EDITION_AUDIT.blocks.filter((e) => e.status === "added").length > 700,
  );
  assert.ok(
    EDITION_AUDIT.items.filter((e) => e.status === "added").length > 800,
  );
});
test("16-bit blocks survive edits, unload, reload and meshing above the previous byte limit", () => {
  const w = new World("high ids", {}, "overworld", 15),
    id = B.warped_stairs;
  assert.ok(id > 255);
  w.set(-1, 205, -1, id);
  assert.ok(w.ensure(-1, -1).data instanceof Uint16Array);
  const restored = new World(
    w.seed,
    Object.fromEntries(w.edits),
    "overworld",
    15,
  );
  assert.equal(restored.get(-1, 205, -1), id);
  w.chunks.clear();
  assert.equal(w.get(-1, 205, -1), id);
  const mesh = meshChunk(w, w.ensure(-1, -1));
  for (const g of mesh.filter(Boolean)) {
    assert.ok(g.position.every(Number.isFinite));
    assert.ok(g.uv.every((u) => u >= 0 && u <= 1));
  }
});
test("every new block has finite exterior geometry and a valid independent atlas mapping for all states", () => {
  for (const [id, b] of BLOCKS.entries())
    if (b.edition) {
      const parts = blockParts(id);
      assert.ok(parts.length, b.key);
      assert.ok(
        parts.every((p) => p.length === 6 && p.every(Number.isFinite)),
        b.key,
      );
      const surfaces = shapeSurfaces(parts);
      assert.ok(surfaces.length > 0, b.key);
      for (let f = 0; f < 6; f++) {
        const uv = blockArtUV(id, f, 0.5, 0.5, "renewed");
        assert.ok(
          uv.every((v) => v >= 0 && v <= 1),
          b.key,
        );
        const tile =
          Math.floor(uv[0] * ATLAS_COLS) +
          (ATLAS_ROWS - 1 - Math.floor(uv[1] * ATLAS_ROWS)) * ATLAS_COLS;
        assert.equal(tile, blockArtTile(id, f));
      }
    }
});
test("all imported crafting and station recipes accept real alternative ingredients, consume atomically, and have usable results", () => {
  for (const recipe of RECIPES.filter((r) => r.edition)) {
    const inv = new Inventory(),
      need = recipeNeeds(recipe).map((n) => (Array.isArray(n) ? n[0] : n));
    for (const id of need) assert.equal(inv.add(makeStack(id)), 0, recipe.id);
    assert.equal(inv.autofill(recipe, 3), null, recipe.id);
    const match = inv.recipe(3, recipe.station || "table");
    assert.ok(match, recipe.id);
    // Existing custom recipes retain priority if both describe the same grid.
    assert.equal(match.result, recipe.result, recipe.id);
    const before = JSON.stringify(inv.export());
    inv.cursor = makeStack("bedrock");
    const oldCursor = inv.cursor;
    assert.equal(inv.craftOne(3, recipe.station || "table"), false, recipe.id);
    assert.equal(inv.cursor, oldCursor);
    inv.cursor = null;
    assert.equal(inv.craftOne(3, recipe.station || "table"), true, recipe.id);
    assert.equal(inv.cursor.id, recipe.result, recipe.id);
    assert.ok(inv.cursor.count <= ITEMS[recipe.result].stack);
  }
});
test("tag allocation backtracks and smithing cannot run at an ordinary crafting table or duplicate enchanted gear", () => {
  assert.deepEqual(
    allocateIngredients(
      [["planks", "birch_planks"], "planks"],
      [
        { id: "planks", count: 1 },
        { id: "birch_planks", count: 1 },
      ],
    ),
    ["birch_planks", "planks"],
  );
  const inv = new Inventory();
  inv.craft[0] = makeStack("netherite_upgrade_smithing_template");
  inv.craft[1] = {
    ...makeStack("diamond_sword"),
    durability: 1000,
    enchantments: { sharpness: 3 },
  };
  inv.craft[2] = makeStack("netherite_ingot");
  assert.equal(inv.recipe(3, "table"), null);
  assert.equal(inv.craftOne(3, "smithing_table"), true);
  assert.equal(inv.cursor.id, "netherite_sword");
  assert.equal(inv.cursor.durability, 2031 - (1561 - 1000));
  assert.equal(inv.cursor.enchantments.sharpness, 3);
  assert.ok(inv.craft.every((s) => !s));
  assert.equal(inv.craftOne(3, "smithing_table"), false);
});
test("slabs merge exactly once, upper halves target their own surface, and compound stairs leave usable empty space", () => {
  const g = arena();
  g.inventory.slots[0] = makeStack("oak_slab", 3);
  g.world.set(4, 200, 4, B.oak_slab);
  g.target = {
    x: 4,
    y: 200,
    z: 4,
    id: B.oak_slab,
    normal: { x: 0, y: 1, z: 0 },
    distance: 3,
  };
  assert.equal(placeEdition(g), true);
  assert.equal(BLOCKS[g.world.get(4, 200, 4)].state.half, "double");
  assert.equal(g.inventory.held.count, 2);
  const upper = editionStateId(B.oak_slab, { half: "top" });
  g.world.set(6, 200, 4, upper);
  assert.equal(
    g.world.raycast({ x: 6.5, y: 202, z: 4.5 }, { x: 0, y: -1, z: 0 }, 4)
      .distance,
    1,
  );
  g.world.set(4, 200, 2, B.oak_stairs);
  assert.equal(
    collides(g.world, { x: 4.5, y: 200.51, z: 2.8 }, 0.3, 0.15),
    false,
  );
  assert.equal(
    collides(g.world, { x: 4.5, y: 200.51, z: 2.2 }, 0.3, 0.15),
    true,
  );
});
test("new shape placement refuses player intersections and fences retain their taller collision after body feet rise above the block cell", () => {
  const g = arena();
  g.inventory.slots[0] = makeStack("oak_stairs", 2);
  g.target = {
    x: 2,
    y: 199,
    z: 2,
    id: B.stone,
    normal: { x: 0, y: 1, z: 0 },
    distance: 1,
  };
  placeEdition(g);
  assert.equal(g.inventory.held.count, 2);
  assert.equal(g.world.get(2, 200, 2), B.air);
  g.world.set(4, 200, 4, B.oak_fence);
  assert.equal(collides(g.world, { x: 4.5, y: 201.2, z: 4.5 }, 1.8, 0.6), true);
  assert.equal(
    collides(g.world, { x: 4.5, y: 201.51, z: 4.5 }, 1.8, 0.6),
    false,
  );
});
test("all new wood door families keep linked halves, toggles and item drops across save reconstruction", () => {
  const w = new World("all doors", {}, "overworld", 15);
  let n = 0;
  for (const [id, b] of BLOCKS.entries())
    if (b.edition && b.door && !b.internal) {
      const x = n++ * 3;
      w.set(x, 199, 0, B.stone);
      assert.equal(placeDoor(w, x, 200, 0, Math.PI / 2, [], id), true, b.key);
      assert.equal(doorAt(w, x, 201, 0).item, b.key);
      assert.equal(setDoorOpen(w, x, 201, 0, true), true);
      const d = doorAt(w, x, 200, 0);
      assert.equal(d.open, true);
      const save = new World(
        w.seed,
        Object.fromEntries(w.edits),
        "overworld",
        15,
      );
      assert.equal(doorAt(save, x, 200, 0).base, id);
      w.set(x, 200, 0, B.air);
      assert.equal(w.get(x, 201, 0), B.air);
    }
  assert.ok(n >= 12);
});
test("native station interactions open real containers or recipe menus; smoker and blast furnace smelt only their category at twice speed", () => {
  const g = arena();
  g.openInventory = (type, container, target) =>
    (g.opened = { type, container, target });
  for (const key of [
    "barrel",
    "smoker",
    "blast_furnace",
    "stonecutter",
    "smithing_table",
  ]) {
    g.world.set(5, 200, 5, B[key]);
    g.target = { x: 5, y: 200, z: 5, id: B[key] };
    assert.equal(useEdition(g), true);
    assert.equal(
      g.opened.type,
      key === "barrel"
        ? "chest"
        : ["smoker", "blast_furnace"].includes(key)
          ? "furnace"
          : key,
    );
    delete g.world.containers["5,200,5"];
  }
  const c = {
    type: "furnace",
    station: "smoker",
    slots: [makeStack("potato"), makeStack("coal"), null],
    burn: 0,
    progress: 0,
  };
  g.world.containers["5,200,5"] = c;
  for (let i = 0; i < 100; i++) tickSurvival(g);
  assert.equal(c.slots[2]?.id, "baked_potato");
  c.slots = [makeStack("raw_iron"), makeStack("coal"), null];
  c.progress = 0;
  for (let i = 0; i < 110; i++) tickSurvival(g);
  assert.equal(c.slots[2], null);
  c.station = "blast_furnace";
  for (let i = 0; i < 100; i++) tickSurvival(g);
  assert.equal(c.slots[2]?.id, "iron_ingot");
});
test("new crop state growth is bounded to loaded ground and persists without hidden plant metadata", () => {
  const g = arena();
  g.world.set(5, 199, 4, B.water);
  g.world.set(4, 199, 4, B.farmland);
  g.world.set(4, 200, 4, B.carrots__0);
  g.world.editionPlants = new Set(["4,200,4", "9000,80,9000"]);
  g.world.tick = 200;
  const chunks = g.world.chunks.size;
  tickEditionWorld(g.world, g.player, 32);
  assert.equal(g.world.get(4, 200, 4), B.carrots__0 + 1);
  assert.equal(g.world.chunks.size, chunks);
  const save = new World(
    g.world.seed,
    Object.fromEntries(g.world.edits),
    "overworld",
    15,
  );
  assert.equal(save.get(4, 200, 4), B.carrots__0 + 1);
});
test("bows and crossbows require actual charge/ammunition, preserve loaded state and never fire twice on release", () => {
  const g = arena();
  g.inventory.slots[0] = makeStack("bow");
  g.inventory.slots[1] = makeStack("arrow", 2);
  assert.equal(useEditionWeapon(g), true);
  g.elapsed += 1;
  assert.equal(releaseEditionWeapon(g), true);
  assert.equal(g.inventory.slots[1].count, 1);
  assert.equal(g.inventory.held.durability, 383);
  assert.equal(g.hostileProjectiles.length, 1);
  assert.equal(releaseEditionWeapon(g), false);
  g.inventory.slots[0] = makeStack("crossbow");
  useEditionWeapon(g);
  g.elapsed += 1.3;
  releaseEditionWeapon(g);
  assert.equal(g.inventory.slots[1], null);
  assert.equal(g.inventory.held.charged, true);
  const loaded = new Inventory(g.inventory.export());
  assert.equal(loaded.held.charged, true);
  useEditionWeapon(g);
  assert.equal(g.inventory.held.charged, false);
  assert.equal(g.hostileProjectiles.length, 2);
  releaseEditionWeapon(g);
  assert.equal(g.hostileProjectiles.length, 2);
});
test("player arrows hit actual creatures in Peaceful, stop at walls, and recover one arrow rather than duplicating ammunition", () => {
  const g = arena();
  g.player.yaw = 0;
  g.player.pitch = 0;
  g.inventory.slots[0] = makeStack("bow");
  g.inventory.slots[1] = makeStack("arrow", 2);
  const e = {
    type: "zombie",
    id: "arrow-target",
    x: 2.5,
    y: 200,
    z: 0.5,
    hp: 20,
  };
  g.entities = [e];
  useEditionWeapon(g);
  g.elapsed += 1;
  releaseEditionWeapon(g);
  g.difficulty = "peaceful";
  tickHostileProjectiles(g, damageEntity);
  assert.ok(e.hp < 20);
  assert.equal(g.hostileProjectiles.length, 0);
  g.entities = [];
  g.world.set(2, 201, 0, B.stone);
  useEditionWeapon(g);
  g.elapsed += 1;
  releaseEditionWeapon(g);
  tickHostileProjectiles(g, damageEntity);
  assert.equal(g.drops.filter((s) => s.id === "arrow").length, 0);
  assert.equal(g.world.embeddedArrows.length, 1);
  tickHostileProjectiles(g, damageEntity);
  assert.equal(g.drops.filter((s) => s.id === "arrow").length, 0);
  assert.equal(g.world.embeddedArrows.length, 1);
});
test("shield projectile defense is directional, costs durability and releases immediately", () => {
  const g = arena();
  g.inventory.slots[0] = makeStack("shield");
  g.player.yaw = 0;
  useEditionWeapon(g);
  assert.equal(
    blockShieldProjectile(g, g.player, { x: 2.5, z: 0, damage: 4 }),
    true,
  );
  assert.equal(g.inventory.held.durability, 331);
  assert.equal(
    blockShieldProjectile(g, g.player, { x: 2.5, z: 5, damage: 4 }),
    false,
  );
  releaseEditionWeapon(g);
  assert.equal(g.player.shieldRaised, false);
});
test("new building shapes and combat gear have finite held/dropped geometry with a bounded draw count", () => {
  const restore = mockCanvas();
  try {
    for (const id of [
      "oak_stairs",
      "tuff_wall",
      "cherry_trapdoor",
      "copper_lantern",
      "heavy_core",
      "bow",
      "crossbow",
      "shield",
      "mace",
      "netherite_sword",
    ]) {
      const atlas = { texture: new THREE.Texture(), pack: "renewed" },
        m = createHeldModel(id, atlas);
      let batches = 0;
      m.traverse((o) => {
        if (o.isMesh) {
          batches++;
          assert.ok(
            o.geometry.attributes.position.array.every(Number.isFinite),
            id,
          );
        }
      });
      assert.ok(batches <= 14, id);
      const dropped = createDroppedModel(id, atlas);
      const size = new THREE.Box3()
        .setFromObject(dropped)
        .getSize(new THREE.Vector3());
      assert.ok(Math.abs(Math.max(size.x, size.y, size.z) - 0.38) < 1e-5, id);
    }
  } finally {
    restore();
  }
});

test("bare hands can use empty space or ordinary ground without treating it as a crop", () => {
  const g = arena();
  assert.equal(useEdition(g), false);
  g.target = { x: 2, y: 199, z: 2, id: B.stone };
  assert.equal(useEdition(g), false);
});

test("arrow pitch follows the camera for both upward and downward shots", () => {
  for (const pitch of [-0.4, 0.4]) {
    const g = arena();
    g.inventory.slots[0] = makeStack("bow");
    g.inventory.slots[1] = makeStack("arrow", 2);
    g.player.pitch = pitch;
    useEditionWeapon(g);
    g.elapsed += 1;
    releaseEditionWeapon(g);
    assert.equal(Math.sign(g.hostileProjectiles[0].vy), Math.sign(pitch));
  }
});
