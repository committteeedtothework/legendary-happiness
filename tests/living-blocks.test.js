import { Multiplayer } from "../src/multiplayer.js";
import test from "node:test";
import assert from "node:assert/strict";
import { World } from "../src/world.js";
import {
  B,
  BLOCKS,
  ITEMS,
  RECIPES,
  MOB_INFO,
  DEFAULT_SETTINGS,
  makeStack,
} from "../src/data.js";
import {
  fluid,
  isWater,
  isLava,
  fluidHeight,
  igniteBlock,
  primeTnt,
  cactusContact,
} from "../src/block-dynamics.js";
import { useBucket, useFlintAndSteel } from "../src/block-actions.js";
import { Inventory, canHarvest } from "../src/inventory.js";
import {
  createPlayer,
  collides,
  moveBody,
  updatePlayer,
} from "../src/physics.js";
import {
  createEntity,
  damageEntity,
  tickSurvival,
  dropItem,
} from "../src/simulation.js";
import { enemyCombat } from "../src/hostile-combat.js";
import { exportRealm, restoreRealm } from "../src/realms.js";
import { relicSite, templeUnlocked } from "../src/relic.js";
import { populateEncounters } from "../src/encounters.js";
import { meshChunk } from "../src/mesher.js";
function arena() {
  const w = new World("Living blocks");
  for (let x = -10; x <= 24; x++)
    for (let z = -10; z <= 10; z++) w.set(x, 199, z, B.stone);
  return w;
}
function run(w, n) {
  for (let i = 0; i < n; i++) w.simulate();
}
function game(w = arena()) {
  return {
    world: w,
    player: createPlayer({ x: 0.5, y: 201, z: 0.5 }),
    inventory: new Inventory(),
    entities: [],
    drops: [],
    hostileProjectiles: [],
    mode: "survival",
    difficulty: "normal",
    dimension: w.dimension,
    time: 1000,
    tickCount: 1,
    settings: { ...DEFAULT_SETTINGS, renderDistance: 2 },
    renderer: { action() {} },
    audio: { tone() {}, voice() {} },
    ui: { toast() {}, updateHotbar() {}, updateHUD() {} },
    direction: () => ({ x: 0, y: -1, z: 0 }),
    damage(n) {
      this.player.health -= n;
    },
  };
}
test("water spreads seven levels, lava advances later and only three blocks in the Overworld", () => {
  for (const [id, reach, wait] of [
    [B.water, 7, 5],
    [B.lava, 3, 30],
  ]) {
    const w = arena();
    w.set(0, 200, 0, id);
    run(w, wait - 1);
    assert.equal(w.get(1, 200, 0), B.air);
    run(w, 250);
    assert.ok(fluid(w.get(reach, 200, 0)));
    assert.equal(w.get(reach + 1, 200, 0), B.air);
    assert.equal(fluid(w.get(reach, 200, 0)).source, false);
    assert.ok(
      fluidHeight(w.get(1, 200, 0)) > fluidHeight(w.get(reach, 200, 0)),
    );
  }
});
test("water prefers falling before spreading and reaches the floor as a visible full-height fall", () => {
  const w = arena();
  w.set(0, 205, 0, B.water);
  run(w, 100);
  assert.equal(w.get(1, 205, 0), B.air);
  assert.equal(fluid(w.get(0, 203, 0)).falling, true);
  assert.equal(fluidHeight(w.get(0, 203, 0)), 1);
  assert.ok(isWater(w.get(2, 200, 0)));
});
test("removing a source drains downstream loops without leaving free source blocks", () => {
  const w = arena();
  w.set(0, 203, 0, B.water);
  run(w, 100);
  w.set(0, 203, 0, B.air);
  run(w, 300);
  for (let y = 200; y <= 203; y++)
    for (let x = -8; x <= 8; x++)
      for (let z = -8; z <= 8; z++)
        assert.equal(isWater(w.get(x, y, z)), false);
  assert.equal(w.fluidQueue.size, 0);
});
test("fluid crosses positive and negative chunk edges and respects solid barriers", () => {
  for (const x of [-1, 15]) {
    const w = arena();
    w.set(x, 200, 0, B.water);
    w.set(x + 2, 200, 0, B.glass);
    run(w, 100);
    assert.ok(isWater(w.get(x + 1, 200, 0)));
    assert.equal(w.get(x + 2, 200, 0), B.glass);
  }
});
test("water and lava produce obsidian, cobble or stone according to source and direction", () => {
  for (const [lava, expected] of [
    [B.lava, B.obsidian],
    [B.lava_flow_2, B.cobble],
  ]) {
    const w = arena();
    w.set(0, 200, 0, lava);
    w.set(1, 200, 0, B.water);
    run(w, 10);
    assert.equal(w.get(0, 200, 0), expected);
  }
  const w = arena();
  w.set(0, 200, 0, B.water);
  w.set(0, 201, 0, B.lava);
  run(w, 35);
  assert.equal(w.get(0, 200, 0), B.stone);
});
test("two supported neighboring water sources renew the middle, one source does not", () => {
  const w = arena();
  w.set(-1, 200, 0, B.water);
  w.set(1, 200, 0, B.water);
  run(w, 30);
  assert.equal(w.get(0, 200, 0), B.water);
  const a = arena();
  a.set(-1, 200, 0, B.water);
  run(a, 30);
  assert.equal(fluid(a.get(0, 200, 0)).source, false);
});
test("fluid states and draining survive a save/load, and unloaded simulation never generates chunks", () => {
  const w = arena();
  w.set(0, 200, 0, B.water);
  run(w, 80);
  w.set(0, 200, 0, B.air);
  const saved = exportRealm({ world: w, entities: [], drops: [] }),
    r = restoreRealm(w.seed, w.dimension, saved).world;
  r.ensure(0, 0);
  r.ensure(-1, 0);
  r.ensure(0, -1);
  r.ensure(-1, -1);
  run(r, 250);
  assert.equal(isWater(r.get(1, 200, 0)), false);
  r.set(0, 200, 0, B.water);
  r.chunks.clear();
  run(r, 200);
  assert.equal(r.chunks.size, 0);
  assert.ok(r.fluidQueue.size > 0);
  r.ensure(0, 0);
  run(r, 80);
  assert.ok(isWater(r.get(1, 200, 0)));
});
test("Cinderworld water evaporates, its lava flows faster and farther", () => {
  const w = arena();
  w.dimension = "cinderwild";
  w.set(0, 200, 0, B.water);
  run(w, 5);
  assert.equal(w.get(0, 200, 0), B.air);
  w.set(0, 200, 0, B.lava);
  run(w, 9);
  assert.equal(w.get(1, 200, 0), B.air);
  run(w, 100);
  assert.ok(isLava(w.get(7, 200, 0)));
});
test("bucket source collection and placement conserve one bucket with a full inventory", () => {
  const g = game();
  g.inventory.slots.fill(null);
  for (let i = 0; i < 36; i++) g.inventory.slots[i] = makeStack("stone", 64);
  g.inventory.slots[0] = makeStack("bucket");
  g.world.set(0, 200, 0, B.water);
  assert.equal(useBucket(g), true);
  assert.equal(g.inventory.held.id, "water_bucket");
  assert.equal(g.world.get(0, 200, 0), B.air);
  useBucket(g);
  assert.equal(g.inventory.held.id, "bucket");
  assert.equal(g.world.get(0, 200, 0), B.water);
  assert.equal(
    g.inventory.slots.filter((s) => s.id.includes("bucket")).length,
    1,
  );
  useBucket(g);
  useBucket(g);
  assert.equal(g.inventory.held.id, "bucket");
  g.world.set(0, 200, 0, B.water_flow_3);
  useBucket(g);
  assert.equal(g.inventory.held.id, "bucket");
  assert.equal(g.world.get(0, 200, 0), B.water_flow_3);
});
test("filled bucket collision uses the solid surface and cannot replace containers", () => {
  const g = game();
  g.inventory.slots[0] = makeStack("water_bucket");
  g.world.set(0, 200, 0, B.chest);
  g.world.containers["0,200,0"] = {
    type: "chest",
    slots: [makeStack("diamond", 3)],
  };
  // The camera is inside the chest cell: DDA normal is zero, so placement must reject it.
  g.player.y = 199;
  useBucket(g);
  assert.equal(g.world.get(0, 200, 0), B.chest);
  assert.equal(g.world.containers["0,200,0"].slots[0].count, 3);
});
test("flint and steel lights ordinary surfaces, spends durability on success and primes TNT", () => {
  const g = game();
  g.inventory.slots[0] = makeStack("flint_and_steel");
  const start = g.inventory.held.durability;
  const t = { x: 0, y: 199, z: 0, id: B.stone, normal: { x: 0, y: 1, z: 0 } };
  useFlintAndSteel(g, t);
  assert.equal(g.world.get(0, 200, 0), B.fire);
  assert.equal(g.inventory.held.durability, start - 1);
  useFlintAndSteel(g, t);
  assert.equal(g.inventory.held.durability, start - 1);
  g.world.set(0, 200, 0, B.tnt);
  useFlintAndSteel(g, { ...t, y: 200, id: B.tnt });
  assert.equal(g.world.get(0, 200, 0), B.primed_tnt);
  assert.equal(g.world.blockTimers["0,200,0"].ticks, 80);
});
test("fire consumes flammable material, never silently erases chests, and water extinguishes it", () => {
  const w = arena();
  w.set(1, 200, 0, B.planks);
  w.set(-1, 200, 0, B.chest);
  w.containers["-1,200,0"] = { type: "chest", slots: [makeStack("diamond")] };
  assert.ok(igniteBlock(w, 0, 200, 0));
  // Cinderstone support keeps the original flame alive while adjacent wood burns.
  w.set(0, 199, 0, B.cinderstone);
  run(w, 400);
  assert.notEqual(w.get(1, 200, 0), B.planks);
  assert.equal(w.get(-1, 200, 0), B.chest);
  assert.equal(w.containers["-1,200,0"].slots[0].id, "diamond");
  w.set(0, 200, 0, B.fire);
  w.set(0, 201, 0, B.water);
  run(w, 20);
  assert.notEqual(w.get(0, 200, 0), B.fire);
});
test("primed TNT keeps its remaining fuse through realm saves and explodes exactly once", () => {
  const w = arena();
  w.set(0, 200, 0, B.tnt);
  primeTnt(w, 0, 200, 0);
  run(w, 31);
  const r = restoreRealm(
    w.seed,
    w.dimension,
    exportRealm({ world: w, entities: [], drops: [] }),
  ).world;
  r.ensure(0, 0);
  assert.equal(r.blockTimers["0,200,0"].ticks, 49);
  run(r, 48);
  assert.equal(r.dynamicBursts.length, 0);
  run(r, 1);
  assert.equal(r.dynamicBursts.length, 1);
  run(r, 50);
  assert.equal(r.dynamicBursts.length, 1);
  assert.equal(r.get(0, 200, 0), B.air);
});
test("TNT detonates through the real survival simulation and primes nearby TNT without item duplication", () => {
  const g = game();
  g.player.x = 8;
  g.player.y = 200;
  g.world.set(0, 200, 0, B.tnt);
  g.world.set(1, 200, 0, B.tnt);
  primeTnt(g.world, 0, 200, 0, 1);
  tickSurvival(g);
  assert.equal(g.world.get(0, 200, 0), B.air);
  assert.equal(g.world.get(1, 200, 0), B.primed_tnt);
  assert.equal(
    g.drops.some((d) => d.id === "tnt"),
    false,
  );
});
test("cactus damage follows its inset body at the side and on top without hurting distant players", () => {
  const w = arena();
  w.set(1, 200, 0, B.cactus);
  const p = createPlayer({ x: 0.5, y: 200, z: 0.5 });
  moveBody(w, p, 0.5, 0, 0, 1.8, 0.6, 0);
  assert.equal(collides(w, p), false);
  assert.equal(cactusContact(w, p), true);
  assert.equal(cactusContact(w, { ...p, x: 0.3 }), false);
  assert.equal(cactusContact(w, { ...p, x: 1.5, y: 201 }), true);
  const g = game(w);
  g.player = p;
  g.tickCount = 9;
  tickSurvival(g);
  assert.equal(p.health, 19);
  g.mode = "creative";
  g.tickCount = 19;
  tickSurvival(g);
  assert.equal(p.health, 19);
});
test("water extinguishes the saved player burning state, lava damages and sets it", () => {
  const g = game();
  g.player.y = 200;
  g.tickCount = 19;
  g.world.set(0, 200, 0, B.lava);
  tickSurvival(g);
  assert.equal(g.player.health, 16);
  assert.ok(g.player.burning > 0);
  g.world.set(0, 200, 0, B.water);
  g.tickCount = 39;
  tickSurvival(g);
  assert.equal(g.player.burning, 0);
  assert.equal(g.player.health, 16);
});
test("new content has real recipes, smelting connections and correct harvest restrictions; internal states stay out of Creative", () => {
  for (const key of [
    "bucket",
    "tnt",
    "stone_bricks",
    "clay",
    "brick",
    "bookshelf",
    "copper_block",
    "gold_block",
    "golden_pickaxe",
    "golden_helmet",
  ])
    assert.ok(
      RECIPES.some((r) => r.result === key),
      key,
    );
  assert.equal(
    canHarvest(BLOCKS[B.gold_ore], makeStack("golden_pickaxe")),
    false,
  );
  assert.equal(canHarvest(BLOCKS[B.gold_ore], makeStack("iron_pickaxe")), true);
  for (const b of BLOCKS.filter((b) => b.internal))
    assert.equal(ITEMS[b.key], undefined);
  const inv = new Inventory();
  inv.craft = Array.from({ length: 9 }, () => makeStack("copper_ingot"));
  assert.equal(inv.craftOne(3), true);
  assert.equal(inv.cursor.id, "copper_block");
  assert.equal(inv.cursor.count, 1);
  assert.ok(inv.craft.every((s) => s === null));
  inv.craft[0] = inv.cursor;
  inv.cursor = null;
  inv.craftOne(3);
  assert.equal(inv.cursor.id, "copper_ingot");
  assert.equal(inv.cursor.count, 9);
});
test("lava bucket fuel leaves exactly one reusable empty bucket, and copper smelts", () => {
  const g = game();
  g.world.containers["0,200,2"] = {
    type: "furnace",
    slots: [makeStack("raw_copper"), makeStack("lava_bucket"), null],
    progress: 0,
    burn: 0,
  };
  for (let i = 0; i < 200; i++) tickSurvival(g);
  const c = g.world.containers["0,200,2"];
  assert.equal(c.slots[1].id, "bucket");
  assert.equal(c.slots[1].count, 1);
  assert.equal(c.slots[2].id, "copper_ingot");
  assert.ok(c.burn > 19000);
});
test("expanded atlas meshes deep appended IDs, shallow fluids, fire and cactus with finite in-range UVs", () => {
  const w = arena();
  w.set(0, 200, 0, B.water_flow_7);
  w.set(1, 200, 0, B.bookshelf);
  w.set(2, 200, 0, B.fire);
  w.set(3, 200, 0, B.cactus);
  const groups = meshChunk(w, w.ensure(0, 0), { ambientOcclusion: false });
  for (const g of groups.filter(Boolean)) {
    assert.ok(g.uv.every((v) => v >= 0 && v <= 1));
    assert.ok(g.position.every(Number.isFinite));
  }
  assert.ok(
    Array.from(groups[1].position).some(
      (v) => Math.abs(v - 200 - 1 / 9) < 0.0001,
    ),
  );
  const opaque = groups[0];
  let floorVisible = false;
  for (let i = 0; i < opaque.position.length; i += 12) {
    const xs = [0, 3, 6, 9].map((j) => opaque.position[i + j]),
      ys = [1, 4, 7, 10].map((j) => opaque.position[i + j]),
      zs = [2, 5, 8, 11].map((j) => opaque.position[i + j]);
    if (
      opaque.normal[i + 1] === 1 &&
      ys.every((y) => y === 200) &&
      Math.min(...xs) === 3 &&
      Math.max(...xs) === 4 &&
      Math.min(...zs) === 0 &&
      Math.max(...zs) === 1
    )
      floorVisible = true;
  }
  assert.equal(
    floorVisible,
    true,
    "inset cactus must not hide the full floor tile beneath its margins",
  );
  assert.ok(BLOCKS.length < 65536);
  assert.ok(
    Math.max(
      ...BLOCKS.map((b, i) => (b.artTile ?? i * 3) * (b.edition ? 1 : 0)),
    ) < 4096,
  );
});
function guardian(role, cycle = 1) {
  const g = game();
  g.player.y = 200;
  g.player.x = 3;
  const e = createEntity(g, "devin_guardian", 0, 0);
  Object.assign(e, {
    x: 0,
    y: 200,
    z: 0,
    guardianIndex: role,
    specialCooldown: 0,
    specialCycle: cycle,
  });
  g.entities = [e];
  return { g, e };
}
function combat(g, e) {
  return enemyCombat(
    g,
    e,
    g.player,
    Math.hypot(g.player.x - e.x, g.player.z - e.z),
    1,
    0,
    damageEntity,
    dropItem,
  );
}
test("Guardians alternate six actual attacks and the second volley launches five bolts", () => {
  for (const [role, kind, ticks] of [
    [0, "cleave", 40],
    [1, "sigil", 40],
    [2, "fan", 32],
  ]) {
    const { g, e } = guardian(role);
    combat(g, e);
    assert.equal(e.special, kind);
    assert.equal(e.specialTicks, ticks - 1);
    for (let i = 1; i < ticks; i++) combat(g, e);
    if (kind === "fan") assert.equal(g.hostileProjectiles.length, 5);
    else assert.ok(g.player.health < 20);
    assert.ok(e.specialCooldown >= 140);
  }
});
test("locked sigils can be sidestepped, cleaves can be flanked, and wounded Guardians recover faster", () => {
  const { g, e } = guardian(1);
  combat(g, e);
  const mark = { ...e.specialTarget };
  g.player.z = 7;
  for (let i = 0; i < 40; i++) combat(g, e);
  assert.equal(g.player.health, 20);
  assert.deepEqual(e.specialTarget, mark);
  const a = guardian(0);
  combat(a.g, a.e);
  a.g.player.x = -3;
  for (let i = 0; i < 40; i++) combat(a.g, a.e);
  assert.equal(a.g.player.health, 20);
  const b = guardian(2);
  b.e.hp = 40;
  combat(b.g, b.e);
  for (let i = 1; i < 32; i++) combat(b.g, b.e);
  assert.equal(b.e.specialCooldown, 140);
});
test("citadel has taller outer towers and a real sealed sanctuary until three persistent Guardian defeats", () => {
  const w = new World("Wildflower", {}, "overworld", 10),
    p = relicSite(w),
    g = game(w);
  Object.assign(g.player, { x: p.x, y: p.y, z: p.z + 12 });
  assert.equal(w.generationVersion, 10);
  assert.equal(w.get(p.x + 30, p.y + 36, p.z + 30), B.glow_crystal);
  assert.equal(w.get(p.x, p.y, p.z + 7), B.temple_seal);
  assert.equal(w.get(p.x + 7, p.y + 5, p.z), B.stone_bricks);
  populateEncounters(g, createEntity);
  assert.equal(g.entities.length, 3);
  assert.ok(g.entities.every((e) => e.hp === 140));
  assert.equal(templeUnlocked(g), false);
  for (const e of g.entities.slice()) {
    damageEntity(g, e, 300, { knockback: 0 });
  }
  assert.equal(templeUnlocked(g), true);
  assert.equal(w.get(p.x, p.y, p.z + 7), B.air);
  assert.equal(w.settlements["devin-temple"].defeated.length, 3);
  const r = restoreRealm(
    w.seed,
    w.dimension,
    exportRealm({ world: w, entities: g.entities, drops: [] }),
  );
  assert.equal(r.world.get(p.x, p.y, p.z + 7), B.air);
  g.world = r.world;
  g.entities = r.entities;
  populateEncounters(g, createEntity);
  assert.equal(g.entities.filter((e) => e.hp > 0).length, 0);
});

test("stacked fluid columns have no oxygen gaps between vertically connected blocks", () => {
  const g = game();
  for (let y = 200; y <= 202; y++) g.world.set(0, y, 0, B.water);
  g.player.y = 200.4;
  updatePlayer(g, new Set(), 1 / 60);
  assert.equal(g.player.inWater, true);
  assert.equal(g.player.underwater, true);
  g.player.y = 201.4;
  updatePlayer(g, new Set(), 1 / 60);
  assert.equal(g.player.underwater, false);
});
test("flow washes a mature crop into one seed and one wheat, without repeating drops", () => {
  const g = game();
  g.player.x = -8;
  g.player.y = 200;
  g.world.set(0, 200, 0, B.crop);
  g.world.cropTicks["0,200,0"] = { age: 7 };
  g.world.set(0, 201, 0, B.water);
  for (let i = 0; i < 80; i++) tickSurvival(g);
  assert.equal(g.world.cropTicks["0,200,0"], undefined);
  assert.deepEqual(
    g.drops
      .filter((d) => ["seeds", "wheat"].includes(d.id))
      .map((d) => [d.id, d.count])
      .sort(),
    [
      ["seeds", 1],
      ["wheat", 1],
    ],
  );
});
test("water currents lift and transport dropped materials while pickup is delayed", () => {
  const g = game();
  g.player.x = -8;
  g.player.y = 200;
  g.world.set(0, 200, 0, B.water);
  run(g.world, 100);
  dropItem(g, makeStack("iron_ingot"), 1.5, 200.2, 0.5, 600);
  g.drops[0].vy = -2;
  tickSurvival(g);
  assert.ok(g.drops[0].x > 1.5);
  assert.ok(g.drops[0].y > 200.2);
  assert.equal(g.drops[0].count, 1);
});
test("saved fire age resumes and exposed rain extinguishes a persistent supported flame", () => {
  const w = arena();
  w.set(0, 199, 0, B.cinderstone);
  igniteBlock(w, 0, 200, 0);
  run(w, 65);
  const r = restoreRealm(
    w.seed,
    w.dimension,
    exportRealm({ world: w, entities: [], drops: [] }),
  ).world;
  r.ensure(0, 0);
  assert.equal(r.blockTimers["0,200,0"].ticks, 60);
  r.weather.kind = "rain";
  r.weather.intensity = 1;
  run(r, 15);
  assert.equal(r.get(0, 200, 0), B.air);
  assert.equal(r.blockTimers["0,200,0"], undefined);
});

test("co-op guest applies flowing-state IDs and TNT timers without keeping an independent simulation queue", () => {
  const g = game(),
    session = Object.create(Multiplayer.prototype);
  session.game = g;
  const timers = { "1,200,0": { kind: "tnt", ticks: 49 } };
  session.applyState({
    dimension: "overworld",
    edits: [
      ["0,200,0", B.water_flow_7],
      ["1,200,0", B.primed_tnt],
      ["2,200,0", B.lava_flow_4],
    ],
    worldTick: 200,
    time: 1200,
    tickCount: 200,
    blockTimers: timers,
    entities: [],
    drops: [],
  });
  assert.equal(g.world.get(0, 200, 0), B.water_flow_7);
  assert.equal(g.world.get(2, 200, 0), B.lava_flow_4);
  assert.deepEqual(g.world.blockTimers, timers);
  assert.equal(g.world.fluidQueue.size, 0);
  assert.ok(g.world.fluidBuckets.every((b) => b.length === 0));
  assert.equal(g.world.pending.length, 0);
});
