import test from "node:test";
import assert from "node:assert/strict";
import { World } from "../src/world.js";
import {
  B,
  BLOCKS,
  makeStack,
  CYCLE_TEXT,
  HOSTILE_TYPES,
} from "../src/data.js";
import { Inventory, matchRecipe, canHarvest } from "../src/inventory.js";
import { createPlayer } from "../src/physics.js";
import { tickSurvival, createEntity } from "../src/simulation.js";
import {
  buildPortal,
  validFrame,
  frameCell,
  frameKey,
  ignitePortal,
  tickPortals,
} from "../src/portals.js";
import { exportRealm, restoreRealm } from "../src/realms.js";

for (const axis of ["x", "z"]) {
  test(`obsidian portal supports ${axis} orientation, optional corners and frame collapse across chunk edges`, () => {
    const w = new World("portal"),
      f = { x: -2, y: 180, z: 15, axis };
    assert.deepEqual(buildPortal(w, f), f);
    for (const [u, v] of [
      [0, 0],
      [0, 4],
      [3, 0],
      [3, 4],
    ]) {
      const p = frameCell(f, u, v);
      w.set(p.x, p.y, p.z, B.air);
    }
    assert.equal(validFrame(w, f), true);
    assert.equal(Object.keys(w.portals).length, 1);
    const state = restoreRealm(
      w.seed,
      "overworld",
      exportRealm({ world: w, entities: [], drops: [] }),
    );
    assert.equal(validFrame(state.world, f), true);
    assert.deepEqual(state.world.portals[frameKey(f)], f);
    const p = frameCell(f, 0, 2);
    w.set(p.x, p.y, p.z, B.air);
    assert.equal(ignitePortal(w, p), null);
    tickPortals({
      world: w,
      player: { x: f.x, y: f.y, z: f.z, health: 20 },
      travelDimension() {
        throw Error("broken portal traveled");
      },
    });
    assert.equal(Object.keys(w.portals).length, 0);
    const inner = frameCell(f, 1, 1);
    assert.equal(w.get(inner.x, inner.y, inner.z), B.air);
  });
}
test("portal requires an empty opening; Survival charges 80 ticks, resets on leaving, and honors cooldown", () => {
  const w = new World("charging"),
    f = { x: 0, y: 180, z: 0, axis: "x" };
  buildPortal(w, f);
  w.set(1, 182, 0, B.stone);
  assert.equal(validFrame(w, f), false);
  w.set(1, 182, 0, B.air);
  ignitePortal(w, f);
  let count = 0;
  const g = {
    world: w,
    mode: "survival",
    player: { x: 1.5, y: 181, z: 0.5, health: 20 },
    travelDimension() {
      count++;
    },
  };
  for (let i = 0; i < 79; i++) tickPortals(g);
  assert.equal(count, 0);
  g.player.z = 4;
  tickPortals(g);
  assert.equal(g.portalCharge, 0);
  g.player.z = 0.5;
  for (let i = 0; i < 80; i++) tickPortals(g);
  assert.equal(count, 1);
  g.portalCooldown = 100;
  for (let i = 0; i < 99; i++) tickPortals(g);
  assert.equal(count, 1);
  g.mode = "creative";
  tickPortals(g);
  assert.equal(count, 2);
});
test("obsidian requires diamond; flint and steel recipe consumes one iron and flint without accepting extras", () => {
  assert.equal(
    canHarvest(BLOCKS[B.obsidian], makeStack("iron_pickaxe")),
    false,
  );
  assert.equal(
    canHarvest(BLOCKS[B.obsidian], makeStack("diamond_pickaxe")),
    true,
  );
  const grid = [null, makeStack("iron_ingot"), makeStack("flint"), null];
  assert.equal(matchRecipe(grid, 2)?.result, "flint_and_steel");
  const inv = new Inventory();
  inv.craft.splice(0, 4, ...grid);
  assert.equal(inv.craftOne(2), true);
  assert.equal(inv.cursor.durability, 64);
  assert.equal(inv.craft.filter(Boolean).length, 0);
  assert.equal(inv.craftOne(2), false);
  grid[0] = makeStack("stick");
  assert.equal(matchRecipe(grid, 2), null);
});
test("Cinderwild is deterministic, distinct, and restores edits, portals, entities and containers", () => {
  const a = new World("ashes", {}, "cinderwild"),
    b = new World("ashes", {}, "cinderwild");
  assert.deepEqual(a.ensure(0, 0).data, b.ensure(0, 0).data);
  assert.notDeepEqual(
    a.ensure(0, 0).data,
    new World("ashes").ensure(0, 0).data,
  );
  assert.ok(a.ensure(0, 0).data.includes(B.cinderstone));
  a.set(-1, 150, 16, B.chest);
  a.containers["-1,150,16"] = {
    type: "chest",
    slots: [makeStack("diamond", 7)],
  };
  const state = restoreRealm(
    a.seed,
    "cinderwild",
    exportRealm({
      world: a,
      entities: [{ type: "emberling", hp: 13 }],
      drops: [makeStack("emberglass", 2)],
    }),
  );
  assert.equal(state.world.get(-1, 150, 16), B.chest);
  assert.equal(state.world.containers["-1,150,16"].slots[0].count, 7);
  assert.equal(state.entities[0].hp, 13);
  assert.equal(state.drops[0].count, 2);
});

function flatGame() {
  const edits = new Map();
  const world = {
    seedInt: 42,
    tick: 0,
    edits,
    containers: {},
    portals: {},
    dimension: "overworld",
    simulate() {
      this.tick++;
    },
    terrain() {
      return { h: 80, biome: "meadow" };
    },
    get(x, y, z) {
      return (
        edits.get(`${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`) ??
        (y < 81 ? B.stone : B.air)
      );
    },
    solid(x, y, z) {
      return BLOCKS[this.get(x, y, z)].solid;
    },
  };
  const g = {
    world,
    player: createPlayer({ x: 0.5, y: 81, z: 0.5 }),
    inventory: new Inventory(),
    mode: "survival",
    difficulty: "normal",
    settings: { renderDistance: 3, cycleText: { ...CYCLE_TEXT } },
    time: 14000,
    tickCount: 99,
    entities: [],
    drops: [],
    audio: { tone() {} },
    ui: {
      updateHUD() {},
      updateHotbar() {},
      announce(title, line) {
        g.messages.push([title, line]);
      },
    },
    messages: [],
    damage(n) {
      this.player.health -= n;
    },
  };
  return g;
}
test("four custom day/night lines fire once at their boundaries and never in Cinderwild", () => {
  const g = flatGame();
  g.difficulty = "peaceful";
  for (const [tick, key] of [
    [12000, "dayEnd"],
    [13000, "nightStart"],
    [23000, "nightEnd"],
    [24000, "dayStart"],
  ]) {
    g.settings.cycleText[key] = "Custom " + key;
    g.time = tick - 1;
    tickSurvival(g);
    tickSurvival(g);
  }
  assert.deepEqual(
    g.messages.map((m) => m[1]),
    [
      "Custom dayEnd",
      "Custom nightStart",
      "Custom nightEnd",
      "Custom dayStart",
    ],
  );
  g.dimension = "cinderwild";
  g.time = 12999;
  tickSurvival(g);
  assert.equal(g.messages.length, 4);
});
test("night produces dangerous hostiles, daylight and Peaceful prevent spawns, placed torches suppress them", () => {
  const g = flatGame();
  tickSurvival(g);
  assert.ok(g.entities.length > 0);
  assert.ok(g.entities.every((e) => HOSTILE_TYPES.has(e.type)));
  const daylight = flatGame();
  daylight.time = 1000;
  tickSurvival(daylight);
  assert.equal(daylight.entities.length, 0);
  const peaceful = flatGame();
  peaceful.difficulty = "peaceful";
  tickSurvival(peaceful);
  assert.equal(peaceful.entities.length, 0);
  const lit = flatGame();
  for (let x = -40; x <= 40; x += 4)
    for (let z = -40; z <= 40; z += 4)
      lit.world.edits.set(`${x},81,${z}`, B.torch);
  tickSurvival(lit);
  assert.equal(lit.entities.length, 0);
});
test("stalker melee damages Survival, walls block attacks, and Peaceful removes hostiles", () => {
  const g = flatGame();
  g.tickCount = 0;
  g.entities = [createEntity(g, "stalker", 1, 0)];
  tickSurvival(g);
  assert.equal(g.player.health, 16);
  assert.ok(g.player.vx < 0);
  const blocked = flatGame();
  blocked.tickCount = 0;
  blocked.world.raycast = () => ({ distance: 0.1 });
  blocked.entities = [createEntity(blocked, "stalker", 1, 0)];
  tickSurvival(blocked);
  assert.equal(blocked.player.health, 20);
  g.difficulty = "peaceful";
  tickSurvival(g);
  assert.equal(g.entities.length, 0);
});
