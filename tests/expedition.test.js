import test from "node:test";
import assert from "node:assert/strict";
import { World } from "../src/world.js";
import { B, BLOCKS, ITEMS, RECIPES, makeStack } from "../src/data.js";
import {
  compass,
  relicNavigation,
  debugNavigation,
} from "../src/navigation.js";
import { daylightAt } from "../src/daylight.js";
import { relicSite } from "../src/relic.js";
import { Inventory, canHarvest, miningTicks } from "../src/inventory.js";
import { armorStats, reduceDamage } from "../src/equipment.js";
import { createPlayer } from "../src/physics.js";
import { createEntity, tickSurvival, damageEntity } from "../src/simulation.js";
import { hostileTarget, golemTarget, combatClear } from "../src/defenders.js";
import { populateVillages } from "../src/ecology.js";
import { villageAt } from "../src/villages.js";
import { exportRealm, restoreRealm } from "../src/realms.js";
import { SKINS, skinFor, skinPreview } from "../src/skins.js";
function arena() {
  const world = new World("Wildflower"),
    player = createPlayer({ x: 0, y: 200, z: 0 });
  for (let x = -5; x <= 16; x++)
    for (let z = -5; z <= 5; z++) world.set(x, 199, z, B.stone);
  return {
    world,
    player,
    entities: [],
    drops: [],
    inventory: new Inventory(),
    settings: { renderDistance: 4 },
    mode: "creative",
    difficulty: "normal",
    time: 15000,
    tickCount: 1,
    elapsed: 0,
    dimension: "overworld",
    damage() {},
    ui: { updateHUD() {}, updateHotbar() {}, toast() {} },
    audio: { tone() {} },
  };
}
test("compass follows the rendered look vector across all axes and yaw wrapping", () => {
  for (const [yaw, name, deg] of [
    [0, "North", 0],
    [-Math.PI / 2, "East", 90],
    [Math.PI, "South", 180],
    [Math.PI / 2, "West", 270],
    [-Math.PI * 4, "North", 0],
  ]) {
    assert.equal(compass(yaw).name, name);
    assert.equal(compass(yaw).degrees, deg);
  }
  const w = new World("Wildflower"),
    s = relicSite(w),
    p = { x: s.x + 0.5, y: s.y, z: s.z + 10.5, yaw: 0, pitch: 0.2 };
  let nav = relicNavigation(w, p);
  assert.equal(nav.dx, 0);
  assert.equal(nav.dz, -10);
  assert.equal(nav.distance, 10);
  assert.equal(nav.turn, 0);
  p.yaw = Math.PI / 2;
  assert.equal(relicNavigation(w, p).turn, 90);
  p.x = s.x - 9.5;
  p.z = s.z + 0.5;
  p.yaw = -Math.PI / 2;
  nav = relicNavigation(w, p);
  assert.equal(nav.bearing, 90);
  assert.equal(nav.turn, 0);
  p.x = -0.2;
  p.z = -16.2;
  assert.match(debugNavigation(w, p), /Block  -1 \/ .* \/ -17 · Chunk -1, -2/);
  assert.match(debugNavigation(w, p), /North −Z/);
  w.relicClaimed = true;
  assert.match(relicNavigation(w, p).message, /claimed/);
  assert.equal(relicNavigation(w, p).site, undefined);
  assert.match(
    relicNavigation(new World("a", {}, "cinderwild"), p).message,
    /Return/,
  );
});
test("daylight is bounded, continuous at sunrise sunset and midnight and supports fractional ticks", () => {
  for (let t = 0; t < 24000; t += 0.5) {
    const a = daylightAt(t),
      b = daylightAt(t + 0.5);
    for (const k of ["daylight", "warmth", "sun", "moon", "stars"]) {
      assert.ok(a[k] >= 0 && a[k] <= 1.2);
      assert.ok(Math.abs(a[k] - b[k]) < 0.001);
    }
  }
  assert.deepEqual(daylightAt(0), daylightAt(24000));
  assert.equal(daylightAt(6000).daylight, 1);
  assert.equal(daylightAt(18000).daylight, 0);
  assert.ok(daylightAt(23999.9).daylight < daylightAt(0.1).daylight);
  assert.notEqual(daylightAt(100).sun, daylightAt(100.3).sun);
});
test("dirt recipes consume actual materials, equipment wears quickly and cannot bypass wood mining", () => {
  const recipes = RECIPES.filter((r) => r.result.startsWith("dirt_"));
  assert.equal(recipes.length, 10);
  for (const recipe of recipes) {
    const inv = new Inventory();
    recipe.pattern.forEach((row, y) =>
      [...row].forEach((c, x) => {
        if (recipe.key[c]) inv.craft[y * 3 + x] = makeStack(recipe.key[c]);
      }),
    );
    assert.equal(inv.recipe(3)?.result, recipe.result);
    assert.ok(inv.craftOne(3));
    assert.equal(inv.cursor.id, recipe.result);
    assert.equal(inv.cursor.count, 1);
    assert.ok(inv.craft.every((s) => !s));
    assert.equal(inv.craftOne(3), false);
  }
  assert.equal(canHarvest(BLOCKS[B.stone], makeStack("dirt_pickaxe")), false);
  assert.ok(
    miningTicks(BLOCKS[B.stone], makeStack("dirt_pickaxe")) >
      miningTicks(BLOCKS[B.stone], makeStack("wooden_pickaxe")),
  );
  assert.ok(ITEMS.dirt_sword.attack < ITEMS.wooden_sword.attack);
  const inv = new Inventory();
  inv.slots[0] = makeStack("dirt_pickaxe");
  for (let i = 0; i < 12; i++) inv.damageTool();
  assert.equal(inv.held, null);
  inv.equipment = ["helmet", "chestplate", "leggings", "boots"].map((s) =>
    makeStack("dirt_" + s),
  );
  assert.equal(armorStats(inv).armor, 2.5);
  const damage = reduceDamage(inv, 6, "a night shade");
  assert.ok(damage > 5.5 && damage < 6);
});
test("new villages double their houses, preserve old layouts and save one defender without resurrection", () => {
  const g = arena(),
    v = villageAt(g.world, 0, 0);
  assert.equal(v.houses.length, 8);
  assert.equal(v.radius, 42);
  assert.equal(
    villageAt(new World("Wildflower", {}, "overworld", 4), 0, 0).houses.length,
    4,
  );
  Object.assign(g.player, { x: v.x, y: v.y + 1, z: v.z + 8 });
  populateVillages(g, createEntity);
  populateVillages(g, createEntity);
  const guards = g.entities.filter((e) => e.type === "iron_golem");
  assert.equal(guards.length, 1);
  assert.equal(guards[0].hp, 100);
  const saved = restoreRealm(
    g.world.seed,
    "overworld",
    exportRealm({ world: g.world, entities: g.entities, drops: [] }),
  );
  g.world = saved.world;
  g.entities = saved.entities;
  guards[0].hp = 0;
  g.entities = g.entities.filter((e) => e.id !== guards[0].id);
  populateVillages(g, createEntity);
  assert.equal(g.entities.filter((e) => e.type === "iron_golem").length, 0);
  const legacy = arena();
  legacy.world = new World("Wildflower", {}, "overworld", 4);
  const old = villageAt(legacy.world, 0, 0);
  Object.assign(legacy.player, { x: old.x, z: old.z });
  legacy.world.settlements[old.id] = { inhabited: true };
  populateVillages(legacy, createEntity);
  populateVillages(legacy, createEntity);
  assert.equal(legacy.entities.length, 1);
  assert.equal(legacy.entities[0].type, "iron_golem");
});
test("golems fight nearby hostiles, spare civilians and award no player XP for their kills", () => {
  const g = arena(),
    guard = createEntity(g, "iron_golem", 0, 0),
    enemy = createEntity(g, "shade", 2, 0),
    civilian = createEntity(g, "cow", 3, 1);
  for (const e of [guard, enemy, civilian])
    Object.assign(e, { y: 200, onGround: true });
  guard.persistent = true;
  g.entities = [guard, enemy, civilian];
  g.player.x = -4;
  assert.equal(golemTarget(g, guard), enemy);
  assert.equal(hostileTarget(g, enemy), guard);
  tickSurvival(g);
  assert.equal(enemy.hp, 8);
  assert.equal(g.player.xp, 0);
  assert.ok(guard.attack > 0);
  for (let i = 0; i < 26; i++) tickSurvival(g);
  assert.ok(!g.entities.includes(enemy));
  assert.equal(g.player.xp, 0);
  assert.equal(civilian.hp, 10);
  damageEntity(g, guard, 200);
  assert.ok(g.drops.some((d) => d.id === "iron_ingot"));
  assert.ok(!g.drops.some((d) => d.id === "raw_meat"));
  assert.equal(g.player.xp, 0);
});
test("hostiles hurt villagers and guard melee respects solid walls while ignoring grass", () => {
  const g = arena(),
    e = createEntity(g, "shade", 0, 0),
    v = createEntity(g, "villager", 1, 0);
  Object.assign(e, { y: 200, onGround: true });
  Object.assign(v, { y: 200, onGround: true });
  g.player.x = -4;
  g.entities = [e, v];
  tickSurvival(g);
  assert.equal(v.hp, 17);
  assert.equal(g.player.xp, 0);
  e.attack = 0;
  Object.assign(e, { x: 0.5, z: 0.5 });
  Object.assign(v, { x: 1.5, z: 0.5 });
  g.world.set(1, 201, 0, B.stone);
  assert.equal(combatClear(g.world, e, v), false);
  g.world.set(1, 201, 0, B.fern);
  assert.equal(combatClear(g.world, e, v), true);
  const hp = v.hp;
  g.world.set(1, 201, 0, B.stone);
  tickSurvival(g);
  assert.equal(v.hp, hp);
});
test("skin palettes are original distinct costumes and unknown saved IDs recover to Explorer", () => {
  assert.equal(Object.keys(SKINS).length, 11);
  assert.equal(skinFor("broken"), SKINS.explorer);
  assert.equal(new Set(Object.keys(SKINS).map(skinPreview)).size, 11);
  for (const id of Object.keys(SKINS))
    assert.match(decodeURIComponent(skinPreview(id)), /<svg/);
});
test("guard spawn reserves its full body space and retries obstructed legacy settlements without duplicating residents", () => {
  const g = arena(),
    v = villageAt(g.world, 0, 0);
  Object.assign(g.player, { x: v.x, y: v.y + 1, z: v.z + 8 });
  g.world.settlements[v.id] = { inhabited: true };
  for (const [dx, dz] of [
    [4, 6],
    [4, 12],
    [-4, 6],
    [-4, 12],
  ])
    for (let x = -1; x <= 1; x++)
      for (let z = -1; z <= 1; z++)
        g.world.set(v.x + dx + x, v.y + 2, v.z + dz + z, B.stone);
  populateVillages(g, createEntity);
  assert.equal(g.entities.length, 0);
  assert.ok(!g.world.settlements[v.id].guardCreated);
  for (let x = -1; x <= 1; x++)
    for (let z = -1; z <= 1; z++)
      for (let y = 1; y <= 3; y++)
        g.world.set(v.x + 4 + x, v.y + y, v.z + 6 + z, B.air);
  populateVillages(g, createEntity);
  populateVillages(g, createEntity);
  assert.equal(g.entities.length, 1);
  assert.equal(g.entities[0].type, "iron_golem");
  assert.equal(g.world.settlements[v.id].guardCreated, true);
});
