import test from "node:test";
import assert from "node:assert/strict";
import { doorId, doorAt } from "../src/doors.js";
import { World, chunkKey } from "../src/world.js";
import { villageAt } from "../src/villages.js";
import { B, MOB_INFO, makeStack } from "../src/data.js";
import { Inventory } from "../src/inventory.js";
import { createPlayer } from "../src/physics.js";
import { createEntity, tickSurvival } from "../src/simulation.js";
import { populateVillages, tradeWithVillager } from "../src/ecology.js";
import { exportRealm, restoreRealm } from "../src/realms.js";
import { meshChunk } from "../src/mesher.js";
import { createFoleyBank } from "../src/foley.js";
function gameAtVillage() {
  const world = new World("Wildflower", {}, "overworld", 5),
    v = villageAt(world, 0, 0);
  return {
    world,
    v,
    dimension: "overworld",
    player: createPlayer({ x: v.x + 0.5, y: v.y + 1, z: v.z + 7.5 }),
    entities: [],
    drops: [],
    inventory: new Inventory(),
    settings: { renderDistance: 4 },
    mode: "creative",
    difficulty: "peaceful",
    time: 14000,
    tickCount: 0,
    elapsed: 0,
    damage() {},
    ui: { updateHUD() {}, updateHotbar() {}, toast() {} },
    audio: { tone() {} },
  };
}
test("village terrain, homes, well, farm and loot are deterministic regardless of chunk order", () => {
  const a = new World("Wildflower", {}, "overworld", 5),
    b = new World("Wildflower", {}, "overworld", 5),
    v = villageAt(a, 0, 0);
  assert.ok(v);
  assert.deepEqual(v, villageAt(b, 0, 0));
  const coords = [
    [4, 4],
    [5, 4],
    [6, 4],
    [4, 5],
    [5, 5],
    [6, 5],
    [7, 5],
    [4, 6],
    [6, 6],
  ];
  for (const [x, z] of coords) a.ensure(x, z);
  for (const [x, z] of [...coords].reverse()) b.ensure(x, z);
  for (const [x, z] of coords)
    assert.deepEqual(a.ensure(x, z).data, b.ensure(x, z).data);
  assert.equal(a.get(v.x, v.y, v.z), B.water);
  const h = v.houses[0];
  assert.equal(a.get(h.x + 1, v.y + 1, h.z + 1), B.bed);
  assert.equal(a.get(h.doorX, v.y + 1, h.doorZ), doorId(2));
  assert.equal(a.get(h.doorX, v.y + 2, h.doorZ), doorId(2, false, true));
  assert.equal(
    a.containers[`${h.x + 1},${v.y + 1},${h.z + 5}`].slots[0].id,
    "bread",
  );
  assert.ok(Object.values(a.cropTicks).some((c) => c.age === 7));
});
test("old generators retain terrain and never inject new villages; new saves retain generation version", () => {
  const old = new World("Wildflower", {}, "overworld", 2);
  assert.equal(villageAt(old, 0, 0), null);
  const current = new World("Wildflower", {}, "overworld", 5);
  const state = restoreRealm(
    current.seed,
    "overworld",
    exportRealm({ world: current, entities: [], drops: [] }),
  );
  assert.equal(state.world.generationVersion, 5);
  assert.equal(
    restoreRealm("Wildflower", "overworld", { edits: {} }).world
      .generationVersion,
    2,
  );
});
test("village residents spawn once, survive distance, persist records, and do not respawn after death", () => {
  const g = gameAtVillage();
  populateVillages(g, createEntity);
  populateVillages(g, createEntity);
  assert.equal(g.entities.length, 9);
  assert.ok(
    g.entities.every(
      (e) => e.persistent && (e.home || e.type === "iron_golem"),
    ),
  );
  const dead = g.entities[0].id;
  g.entities[0].hp = 0;
  tickSurvival(g);
  populateVillages(g, createEntity);
  assert.ok(!g.entities.some((e) => e.id === dead));
  g.player.x += 400;
  for (let i = 0; i < 2; i++) tickSurvival(g);
  assert.equal(g.entities.length, 8);
  const state = restoreRealm(
    g.world.seed,
    "overworld",
    exportRealm({ world: g.world, entities: g.entities, drops: [] }),
  );
  g.world = state.world;
  g.entities = state.entities;
  g.player.x = g.v.x;
  populateVillages(g, createEntity);
  assert.equal(g.entities.length, 8);
  assert.ok(g.world.settlements[g.v.id]);
});
test("villagers follow generated entrances and return inside homes at night", () => {
  const g = gameAtVillage();
  populateVillages(g, createEntity);
  g.entities = [g.entities[0]];
  const e = g.entities[0];
  e.x = g.v.x + 0.5;
  e.z = g.v.z + 7.5;
  let opened = false;
  for (let i = 0; i < 700; i++) {
    tickSurvival(g);
    opened ||= !!doorAt(g.world, e.home.doorX, e.home.y, e.home.doorZ)?.open;
  }
  assert.equal(opened, true, "villager opened its door on the way home");
  assert.equal(
    doorAt(g.world, e.home.doorX, e.home.y, e.home.doorZ).open,
    true,
    "door stays open after the resident passed until the player closes it",
  );
  assert.ok(
    Math.hypot(e.x - e.home.x, e.z - e.home.z) < 1.2,
    `did not reach home: ${e.x},${e.z}`,
  );
  assert.equal(g.world.solid(e.x, e.y + 0.05, e.z), false);
});
test("trading pays exact items, caps stock, and cannot duplicate items or consume payment when output is blocked", () => {
  const g = gameAtVillage();
  populateVillages(g, createEntity);
  const e = g.entities.find((e) => e.profession === "farmer");
  g.player.x = e.x;
  g.player.z = e.z;
  g.inventory.add(makeStack("wheat", 40));
  assert.equal(tradeWithVillager(g, e, 0).ok, true);
  assert.equal(g.inventory.slots.filter((s) => s?.id === "wheat")[0].count, 20);
  assert.equal(g.inventory.slots.find((s) => s?.id === "emerald").count, 1);
  assert.equal(tradeWithVillager(g, e, 1).ok, true);
  assert.equal(g.inventory.slots.find((s) => s?.id === "bread").count, 6);
  g.inventory.slots = Array.from({ length: 36 }, () => makeStack("stone", 64));
  g.inventory.slots[0] = makeStack("wheat", 40);
  const before = JSON.stringify(g.inventory.export());
  assert.equal(tradeWithVillager(g, e, 0).ok, false);
  assert.equal(JSON.stringify(g.inventory.export()), before);
  e.tradeUses[0] = 12;
  assert.equal(tradeWithVillager(g, e, 0).ok, false);
  e.tradeUses[0] = 0;
  e.hp = 0;
  assert.equal(tradeWithVillager(g, e, 0).ok, false);
});
test("meshing hides enclosed faces, supports ambient occlusion, and uses smaller distant geometry", () => {
  const world = new World("Wildflower", {}, "overworld", 5),
    c = world.ensure(0, 0),
    full = meshChunk(world, c),
    distant = meshChunk(world, c, { surfaceOnly: true });
  const vertices = (groups) =>
    groups.filter(Boolean).reduce((n, g) => n + g.position.length, 0);
  assert.ok(vertices(distant) < vertices(full));
  assert.ok(
    full
      .filter(Boolean)
      .every(
        (g) =>
          g.position.length / 3 === g.color.length / 3 &&
          g.indices.length % 6 === 0,
      ),
  );
  const raw = meshChunk(world, c, { ambientOcclusion: false });
  assert.notDeepEqual(full[0].color, raw[0].color);
  world.set(15, 180, 15, B.stone);
  assert.ok(world.revisions.get(chunkKey(1, 1)) > 0);
});
test("all new wildlife have distinct body sizes and original PCM impact samples are varied and bounded", () => {
  assert.equal(Object.keys(MOB_INFO).length, 39);
  assert.ok(MOB_INFO.chicken.height < MOB_INFO.cow.height);
  const context = {
    sampleRate: 22050,
    createBuffer(channels, length, rate) {
      const data = new Float32Array(length);
      return {
        getChannelData() {
          return data;
        },
        length,
        sampleRate: rate,
      };
    },
  };
  const bank = createFoleyBank(context);
  assert.equal(Object.keys(bank).length, 9);
  assert.notDeepEqual(
    bank.wood[0].getChannelData(0),
    bank.stone[0].getChannelData(0),
  );
  for (const entries of Object.values(bank))
    for (const buffer of entries) {
      const data = buffer.getChannelData(0);
      assert.ok(data.some((v) => Math.abs(v) > 0.01));
      assert.ok(data.every((v) => Number.isFinite(v) && Math.abs(v) <= 0.93));
    }
});
