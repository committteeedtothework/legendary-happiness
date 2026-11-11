import test from "node:test";
import assert from "node:assert/strict";
import { World } from "../src/world.js";
import { B } from "../src/data.js";
import { Inventory } from "../src/inventory.js";
import { createPlayer } from "../src/physics.js";
import { createEntity, damageEntity } from "../src/simulation.js";
import { populateEncounters, recordGuardianDeath } from "../src/encounters.js";
import {
  relicSite,
  templeUnlocked,
  extractRelic,
  guardianDefeatCount,
} from "../src/relic.js";
import { exportRealm, restoreRealm } from "../src/realms.js";
function fixture(mode = "survival", difficulty = "normal") {
  const world = new World("Wildflower"),
    p = relicSite(world);
  const g = {
    world,
    dimension: "overworld",
    player: createPlayer({ x: p.x + 0.5, y: p.y, z: p.z + 3 }),
    inventory: new Inventory(),
    entities: [],
    drops: [],
    mode,
    difficulty,
    running: true,
    mouseDown: true,
    elapsed: 1,
    tickCount: 1,
    ui: { toast() {}, updateHotbar() {}, announce() {} },
    audio: { tone() {}, voice() {} },
  };
  world.settlements["devin-temple"] = {
    created: [],
    defeated: [],
    attuned: true,
  };
  populateEncounters(g, createEntity);
  assert.equal(g.entities.length, 3);
  return {
    g,
    p,
    target: { x: p.x, y: p.y + 1, z: p.z, id: B.devin_relic_blade },
  };
}
for (const [mode, difficulty] of [
  ["survival", "normal"],
  ["creative", "normal"],
  ["survival", "peaceful"],
  ["creative", "peaceful"],
]) {
  test(`${mode}/${difficulty}: zero, one and two defeated Guardians cannot start extraction; the third unlocks the real 30-second claim`, () => {
    const { g, p, target } = fixture(mode, difficulty);
    for (let dead = 0; dead < 3; dead++) {
      assert.equal(templeUnlocked(g), false);
      extractRelic(g, target, dead * 40000);
      extractRelic(g, target, dead * 40000 + 30000);
      assert.equal(g.extraction, null);
      assert.equal(g.world.relicClaimed, false);
      assert.equal(g.world.get(p.x, p.y, p.z + 7), B.temple_seal);
      damageEntity(g, g.entities[dead], 10000, { knockback: 0 });
    }
    assert.equal(guardianDefeatCount(g.world), 3);
    assert.equal(templeUnlocked(g), true);
    assert.equal(g.world.get(p.x, p.y, p.z + 7), B.air);
    extractRelic(g, target, 150000);
    extractRelic(g, target, 179999);
    assert.equal(g.world.relicClaimed, false);
    extractRelic(g, target, 180000);
    extractRelic(g, target, 210000);
    assert.equal(g.world.relicClaimed, true);
    assert.equal(
      g.inventory.slots.filter((s) => s?.id === "devin_sword").length,
      1,
    );
  });
}
test("duplicate or invalid role records never substitute for all three distinct Guardian defeats", () => {
  const { g, target } = fixture();
  g.entities = [];
  for (const defeated of [
    [0, 0, 0],
    [0, 1, 1],
    [0, 1, 9],
    [0, 1, -1],
    [0, 1, 2.5],
  ]) {
    g.world.settlements["devin-temple"].defeated = defeated;
    assert.ok(guardianDefeatCount(g.world) < 3);
    extractRelic(g, target, 0);
    extractRelic(g, target, 30000);
    assert.equal(g.extraction, null);
    assert.equal(g.world.relicClaimed, false);
  }
});
test("living Guardians override stale completed records and death recording rejects living, foreign or invalid guardians", () => {
  const { g, target } = fixture(),
    record = g.world.settlements["devin-temple"];
  const e = g.entities[0];
  recordGuardianDeath(g.world, e);
  assert.deepEqual(record.defeated, []);
  for (const changes of [
    { encounter: "other" },
    { guardianIndex: -1 },
    { guardianIndex: 3 },
    { guardianIndex: 1.5 },
  ])
    recordGuardianDeath(g.world, { ...e, ...changes, hp: 0 });
  assert.deepEqual(record.defeated, []);
  record.defeated = [0, 1, 2];
  assert.equal(templeUnlocked(g), false);
  extractRelic(g, target, 0);
  assert.equal(g.extraction, null);
  for (const entity of g.entities)
    damageEntity(g, entity, 10000, { knockback: 0 });
  assert.equal(templeUnlocked(g), true);
  assert.deepEqual(record.defeated, [0, 1, 2]);
});
test("switching modes/difficulty and reloading after two victories preserves the remaining Guardian requirement", () => {
  const { g, target } = fixture();
  damageEntity(g, g.entities[0], 10000, { knockback: 0 });
  damageEntity(g, g.entities[1], 10000, { knockback: 0 });
  const saved = JSON.parse(
    JSON.stringify(
      exportRealm({
        world: g.world,
        entities: g.entities.filter((e) => e.hp > 0),
        drops: g.drops,
      }),
    ),
  );
  Object.assign(g, restoreRealm(g.world.seed, "overworld", saved));
  for (const [mode, difficulty] of [
    ["creative", "peaceful"],
    ["creative", "normal"],
    ["survival", "peaceful"],
    ["survival", "normal"],
  ]) {
    g.mode = mode;
    g.difficulty = difficulty;
    populateEncounters(g, createEntity);
    assert.equal(g.entities.length, 1);
    assert.equal(templeUnlocked(g), false);
    extractRelic(g, target, 30000);
    assert.equal(g.extraction, null);
  }
  damageEntity(g, g.entities[0], 10000, { knockback: 0 });
  assert.equal(templeUnlocked(g), true);
});
