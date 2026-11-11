import test from "node:test";
import assert from "node:assert/strict";
import { World, coordKey } from "../src/world.js";
import {
  B,
  BLOCKS,
  ITEMS,
  RECIPES,
  MIN_Y,
  MAX_Y,
  makeStack,
} from "../src/data.js";
import {
  Inventory,
  matchRecipe,
  miningTicks,
  canHarvest,
} from "../src/inventory.js";
import {
  createPlayer,
  collides,
  moveBody,
  intersectsBlock,
  updatePlayer,
} from "../src/physics.js";
import { tickSurvival, hitEntity, dropItem } from "../src/simulation.js";
import { pack, unpack } from "../src/storage.js";
const total = (inv) =>
  [...inv.slots, ...inv.craft, inv.cursor]
    .filter(Boolean)
    .reduce((n, s) => n + s.count, 0);
function fakeGame() {
  const cells = new Map();
  const world = {
    seedInt: 123,
    tick: 0,
    edits: new Map(),
    containers: {},
    cropTicks: {},
    simulate() {
      this.tick++;
    },
    get(x, y, z) {
      x = Math.floor(x);
      y = Math.floor(y);
      z = Math.floor(z);
      return cells.get(coordKey(x, y, z)) ?? (y < 0 ? B.stone : B.air);
    },
    solid(x, y, z) {
      return BLOCKS[this.get(x, y, z)].solid;
    },
    terrain() {
      return { h: 0, biome: "meadow" };
    },
  };
  const g = {
    world,
    player: createPlayer({ x: 0.5, y: 0, z: 0.5 }),
    inventory: new Inventory(),
    mode: "survival",
    difficulty: "normal",
    settings: { renderDistance: 3 },
    time: 1000,
    tickCount: 0,
    elapsed: 0,
    entities: [],
    drops: [],
    damage(n) {
      if (this.player.hurt <= 0) {
        this.player.health = Math.max(0, this.player.health - n);
        this.player.hurt = 0.5;
      }
    },
    audio: { tone() {} },
    ui: { updateHotbar() {}, updateHUD() {}, toast() {} },
  };
  g.cells = cells;
  return g;
}

test("seeded terrain and chunk data are deterministic", () => {
  const a = new World("Wildflower"),
    b = new World("Wildflower");
  assert.deepEqual(a.terrain(15, -18), b.terrain(15, -18));
  assert.deepEqual(a.ensure(0, 0).data, b.ensure(0, 0).data);
  assert.notDeepEqual(
    a.terrain(160, 30),
    new World("Another world").terrain(160, 30),
  );
});
test("reference height bounds and solid bedrock", () => {
  const w = new World("height");
  assert.equal(MAX_Y - MIN_Y + 1, 384);
  assert.equal(w.get(0, MIN_Y, 0), B.bedrock);
  assert.equal(w.get(0, MAX_Y + 1, 0), B.air);
  assert.equal(w.set(0, MIN_Y, 0, B.air), false);
  assert.equal(w.set(0, MAX_Y + 1, 0, B.stone), false);
});
test("chunk generation is independent of neighbor load order", () => {
  const a = new World("edge"),
    b = new World("edge");
  a.ensure(0, 0);
  a.ensure(1, 0);
  b.ensure(1, 0);
  b.ensure(0, 0);
  assert.deepEqual(a.ensure(0, 0).data, b.ensure(0, 0).data);
  assert.deepEqual(a.ensure(1, 0).data, b.ensure(1, 0).data);
});
test("negative chunk edits survive unload, regeneration and reconstruction", () => {
  const w = new World("persist");
  w.set(-1, 150, -16, B.chest);
  w.set(16, 151, 15, B.planks);
  w.unload(10, 10, 1);
  assert.equal(w.chunks.size, 0);
  assert.equal(w.get(-1, 150, -16), B.chest);
  assert.equal(w.get(16, 151, 15), B.planks);
  const r = new World("persist", w.exportEdits());
  assert.equal(r.get(-1, 150, -16), B.chest);
  assert.equal(r.get(16, 151, 15), B.planks);
});
test("DDA targeting returns correct face, distance and respects reach", () => {
  const w = new World("ray");
  w.set(16, 200, 0, B.stone);
  const ray = w.raycast(
    { x: 13.5, y: 200.5, z: 0.5 },
    { x: 1, y: 0, z: 0 },
    4.5,
  );
  assert.equal(ray.x, 16);
  assert.equal(ray.distance, 2.5);
  assert.deepEqual(ray.normal, { x: -1, y: 0, z: 0 });
  assert.equal(
    w.raycast({ x: 10, y: 200.5, z: 0.5 }, { x: 1, y: 0, z: 0 }, 4.5),
    null,
  );
});
test("water passes targeting rays and glass stops them", () => {
  const w = new World("ray2");
  w.set(1, 180, 0, B.water);
  w.set(2, 180, 0, B.glass);
  assert.equal(
    w.raycast({ x: 0.5, y: 180.5, z: 0.5 }, { x: 1, y: 0, z: 0 }, 5).id,
    B.glass,
  );
});
test("edited sand falls using block updates and rests on solids", () => {
  const w = new World("sand");
  w.set(0, 180, 0, B.stone);
  w.set(0, 183, 0, B.sand);
  for (let i = 0; i < 4; i++) w.simulate();
  assert.equal(w.get(0, 181, 0), B.sand);
  assert.equal(w.get(0, 183, 0), B.air);
});
test("mining speed and tier requirements match the selected equipment", () => {
  assert.equal(miningTicks(BLOCKS[B.stone], makeStack("wooden_pickaxe")), 23);
  assert.equal(miningTicks(BLOCKS[B.stone], null), 150);
  assert.equal(miningTicks(BLOCKS[B.bedrock], null), Infinity);
  assert.equal(
    canHarvest(BLOCKS[B.iron_ore], makeStack("wooden_pickaxe")),
    false,
  );
  assert.equal(
    canHarvest(BLOCKS[B.iron_ore], makeStack("stone_pickaxe")),
    true,
  );
  assert.equal(
    canHarvest(BLOCKS[B.diamond_ore], makeStack("stone_pickaxe")),
    false,
  );
  assert.equal(
    canHarvest(BLOCKS[B.diamond_ore], makeStack("iron_pickaxe")),
    true,
  );
  assert.ok(
    miningTicks(BLOCKS[B.log], makeStack("wooden_axe")) <
      miningTicks(BLOCKS[B.log], null),
  );
});
test("inventory merges to stack limits then occupies empty slots", () => {
  const inv = new Inventory();
  inv.slots[0] = makeStack("log", 63);
  assert.equal(inv.add(makeStack("log", 4)), 0);
  assert.equal(inv.slots[0].count, 64);
  assert.equal(inv.slots[1].count, 3);
  assert.equal(total(inv), 67);
});
test("full inventory returns remaining items without destroying them", () => {
  const inv = new Inventory();
  inv.slots = Array.from({ length: 36 }, () => makeStack("stone", 64));
  assert.equal(inv.add(makeStack("log", 3)), 3);
  assert.equal(total(inv), 2304);
});
test("split, place-one, merge and swapping conserve item count", () => {
  const inv = new Inventory();
  inv.slots[0] = makeStack("log", 7);
  inv.slots[1] = makeStack("dirt", 4);
  const n = total(inv);
  inv.click(inv.slots, 0, true);
  assert.equal(inv.cursor.count, 4);
  assert.equal(inv.slots[0].count, 3);
  inv.click(inv.slots, 2, true);
  assert.equal(inv.slots[2].count, 1);
  inv.click(inv.slots, 1);
  assert.equal(inv.cursor.id, "dirt");
  assert.equal(inv.slots[1].id, "log");
  inv.click(inv.slots, 3);
  assert.equal(total(inv), n);
  assert.equal(inv.cursor, null);
});
test("partial transfer and full transfer never duplicate items", () => {
  const inv = new Inventory(),
    from = [makeStack("coal", 12)],
    to = [makeStack("coal", 60)];
  inv.transfer(from, 0, to);
  assert.equal(to[0].count, 64);
  assert.equal(from[0].count, 8);
  to.push(null);
  inv.transfer(from, 0, to);
  assert.equal(from[0], null);
  assert.equal(to[1].count, 8);
});
test("tools remain separate and retain durability", () => {
  const inv = new Inventory(),
    a = makeStack("wooden_pickaxe"),
    b = { ...a, durability: 12 };
  inv.add(a);
  inv.add(b);
  assert.equal(inv.slots[0].durability, 59);
  assert.equal(inv.slots[1].durability, 12);
  inv.damageTool();
  assert.equal(inv.slots[0].durability, 58);
  inv.slots[0].durability = 1;
  inv.damageTool();
  assert.equal(inv.slots[0], null);
});
test("shapeless recipes accept any position and reject extra ingredients", () => {
  const grid = Array(4).fill(null);
  grid[3] = makeStack("log");
  assert.equal(matchRecipe(grid, 2).result, "planks");
  grid[0] = makeStack("dirt");
  assert.equal(matchRecipe(grid, 2), null);
});
test("shaped recipes support translated and mirrored patterns", () => {
  const grid = Array(9).fill(null);
  for (const [i, id] of [
    [1, "planks"],
    [2, "planks"],
    [4, "stick"],
    [5, "planks"],
    [7, "stick"],
  ])
    grid[i] = makeStack(id);
  assert.equal(matchRecipe(grid, 3).result, "wooden_axe");
  const two = [
    makeStack("planks"),
    makeStack("planks"),
    makeStack("planks"),
    makeStack("planks"),
  ];
  assert.equal(matchRecipe(two, 2).result, "crafting_table");
});
test("all recipes have valid items and fit the intended grid", () => {
  for (const r of RECIPES) {
    assert.ok(ITEMS[r.result]);
    assert.ok(r.count > 0 && r.count <= ITEMS[r.result].stack);
    for (const id of r.ingredients || Object.values(r.key))
      assert.ok((Array.isArray(id) ? id : [id]).every((k) => ITEMS[k]));
    if (r.pattern)
      assert.ok(
        r.pattern.length <= 3 &&
          r.pattern.every((row) => row.length === r.pattern[0].length),
      );
  }
});
test("crafting consumes inputs only when the entire result fits cursor", () => {
  const inv = new Inventory();
  inv.craft[0] = makeStack("log", 2);
  inv.cursor = makeStack("planks", 63);
  assert.equal(inv.craftOne(2), false);
  assert.equal(inv.craft[0].count, 2);
  inv.cursor = null;
  assert.equal(inv.craftOne(2), true);
  assert.equal(inv.cursor.count, 4);
  assert.equal(inv.craft[0].count, 1);
  assert.equal(inv.craftOne(2), true);
  assert.equal(inv.cursor.count, 8);
  assert.equal(inv.craft[0], null);
});
test("snapshot inventory constructor clones stacks and preserves cursor", () => {
  const inv = new Inventory();
  inv.slots[0] = makeStack("stone", 22);
  inv.cursor = makeStack("log", 2);
  const restored = new Inventory(inv.export());
  restored.slots[0].count--;
  assert.equal(inv.slots[0].count, 22);
  assert.deepEqual(restored.cursor, inv.cursor);
});
test("furnace smelts after 200 ticks, consumes fuel and keeps output", () => {
  const g = fakeGame();
  g.world.containers["1,0,1"] = {
    type: "furnace",
    slots: [makeStack("raw_iron", 2), makeStack("coal"), null],
    burn: 0,
    progress: 0,
  };
  for (let i = 0; i < 199; i++) tickSurvival(g);
  const f = g.world.containers["1,0,1"];
  assert.equal(f.slots[2], null);
  assert.equal(f.slots[1], null);
  tickSurvival(g);
  assert.equal(f.slots[2].id, "iron_ingot");
  assert.equal(f.slots[2].count, 1);
  assert.equal(f.slots[0].count, 1);
  assert.equal(f.progress, 0);
  assert.equal(f.burn, 1401);
});
test("blocked furnace output consumes no new fuel or input", () => {
  const g = fakeGame(),
    f = {
      type: "furnace",
      slots: [makeStack("raw_iron"), makeStack("coal"), makeStack("glass")],
      burn: 0,
      progress: 0,
    };
  g.world.containers["1,0,1"] = f;
  for (let i = 0; i < 210; i++) tickSurvival(g);
  assert.equal(f.slots[0].count, 1);
  assert.equal(f.slots[1].count, 1);
  assert.equal(f.slots[2].id, "glass");
  assert.equal(f.burn, 0);
});
test("AABB collision prevents wall penetration across chunk boundary", () => {
  const g = fakeGame(),
    p = createPlayer({ x: 15.65, y: 0, z: 0.5 });
  for (let y = 0; y < 3; y++) g.cells.set(coordKey(16, y, 0), B.stone);
  moveBody(g.world, p, 0.5, -0.01, 0);
  assert.ok(p.x <= 15.701);
  assert.equal(collides(g.world, p), false);
  assert.ok(p.onGround);
  assert.equal(intersectsBlock(p, 16, 0, 0), false);
});
test("ceiling stops jump velocity without embedding player", () => {
  const g = fakeGame(),
    p = createPlayer({ x: 0.5, y: 0, z: 0.5 });
  g.cells.set("0,2,0", B.stone);
  p.vy = 8;
  moveBody(g.world, p, 0, 0.5, 0);
  assert.ok(p.y <= 0.201);
  assert.equal(p.vy, 0);
  assert.equal(collides(g.world, p), false);
});
test("jump, gravity and landing return to ground", () => {
  const g = fakeGame();
  g.player.onGround = true;
  let max = 0;
  for (let i = 0; i < 120; i++) {
    updatePlayer(g, i === 0 ? new Set(["Space"]) : new Set(), 1 / 60);
    max = Math.max(max, g.player.y);
  }
  assert.ok(max > 1.1 && max < 1.4);
  assert.ok(Math.abs(g.player.y) < 0.002);
  assert.equal(g.player.onGround, true);
  assert.equal(g.player.health, 20);
});
test("fall damage applies once on landing", () => {
  const g = fakeGame();
  g.player = createPlayer({ x: 0.5, y: 9, z: 0.5 });
  for (let i = 0; i < 100; i++) updatePlayer(g, new Set(), 1 / 60);
  assert.equal(g.player.health, 14);
});
test("crouching stops at a ledge", () => {
  const g = fakeGame();
  g.world.solid = (x, y, z) =>
    Math.floor(y) < 0 && Math.floor(x) === 0 && Math.floor(z) === 0;
  g.player.onGround = true;
  g.player.yaw = -Math.PI / 2;
  for (let i = 0; i < 120; i++)
    updatePlayer(g, new Set(["KeyW", "ShiftLeft"]), 1 / 60);
  assert.ok(g.player.x < 1.31);
  assert.ok(g.player.y > -0.01);
});
test("oxygen and suffocation can damage the player", () => {
  const g = fakeGame();
  g.player.underwater = true;
  g.player.oxygen = 0;
  for (let i = 0; i < 21; i++) tickSurvival(g);
  assert.equal(g.player.health, 18);
});
test("food exhaustion drains saturation before hunger", () => {
  const g = fakeGame();
  g.player.exhaustion = 4;
  tickSurvival(g);
  assert.equal(g.player.saturation, 4);
  assert.equal(g.player.food, 20);
  g.player.saturation = 0;
  g.player.exhaustion = 4;
  tickSurvival(g);
  assert.equal(g.player.food, 19);
});
test("item pickup happens once and does not duplicate a stack", () => {
  const g = fakeGame();
  dropItem(g, makeStack("log", 3), 0.5, 0.2, 0.5, 0);
  for (let i = 0; i < 10; i++) tickSurvival(g);
  assert.equal(g.drops.length, 0);
  assert.equal(total(g.inventory), 3);
});
test("entity death drops only once even with repeated attack calls", () => {
  const g = fakeGame();
  g.inventory.slots[0] = makeStack("diamond_sword");
  const e = { id: "x", type: "woolling", x: 1, y: 0, z: 1, hp: 1 };
  hitEntity(g, e);
  const n = g.drops.reduce((a, s) => a + s.count, 0),
    xp = g.player.xp;
  hitEntity(g, e);
  assert.equal(n, 4);
  assert.equal(
    g.drops.reduce((a, s) => a + s.count, 0),
    n,
  );
  assert.equal(g.player.xp, xp);
});
test("attack cooldown reduces rapid-click damage", () => {
  const g = fakeGame();
  g.inventory.slots[0] = makeStack("iron_sword");
  const e = { id: "x", type: "shade", x: 1, y: 0, z: 1, hp: 40 };
  g.player.onGround = true;
  hitEntity(g, e);
  assert.equal(e.hp, 34);
  hitEntity(g, e);
  assert.equal(e.hp, 33);
  g.elapsed = 1;
  hitEntity(g, e);
  assert.equal(e.hp, 27);
});
test("save envelope validates integrity and survives round trip", () => {
  const data = {
      seed: "hello",
      edits: { "1,3,4": B.chest },
      inventory: new Inventory().export(),
    },
    record = pack(data);
  assert.deepEqual(unpack(record), data);
  record.payload = record.payload.replace("hello", "wrong");
  assert.throws(() => unpack(record), /integrity/);
});

test("hydrated crops grow, dry crops wait, and crop state survives export", () => {
  const w = new World("farm"),
    x = 2,
    z = 2,
    y = Math.max(80, w.terrain(2, 2).h + 1);
  w.set(x, y - 1, z, B.farmland);
  w.set(x, y, z, B.crop);
  w.cropTicks[coordKey(x, y, z)] = { age: 0 };
  for (let i = 0; i < 100; i++) w.simulate();
  assert.equal(w.cropTicks[coordKey(x, y, z)].age, 0);
  w.set(x + 1, y - 1, z, B.water);
  for (let i = 0; i < 700; i++) w.simulate();
  assert.equal(w.cropTicks[coordKey(x, y, z)].age, 7);
  const restored = new World(w.seed, w.exportEdits());
  restored.cropTicks = structuredClone(w.cropTicks);
  assert.equal(restored.get(x, y, z), B.crop);
  assert.equal(restored.cropTicks[coordKey(x, y, z)].age, 7);
});
test("random cursor actions conserve stacks and respect limits", () => {
  const inv = new Inventory();
  inv.slots[0] = makeStack("log", 64);
  inv.slots[1] = makeStack("log", 33);
  inv.slots[2] = makeStack("stone", 64);
  inv.slots[3] = makeStack("coal", 9);
  const n = total(inv);
  let state = 32;
  for (let i = 0; i < 4000; i++) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    inv.click(inv.slots, state % 36, (state & 64) !== 0);
    assert.equal(total(inv), n);
    for (const s of [...inv.slots, inv.cursor].filter(Boolean))
      assert.ok(s.count > 0 && s.count <= ITEMS[s.id].stack);
  }
});

test("a three-block fall is safe despite collision rounding", () => {
  const g = fakeGame();
  g.player = createPlayer({ x: 0.5, y: 3, z: 0.5 });
  for (let i = 0; i < 100; i++) updatePlayer(g, new Set(), 1 / 60);
  assert.equal(g.player.health, 20);
  assert.equal(g.player.hurt, 0);
});
