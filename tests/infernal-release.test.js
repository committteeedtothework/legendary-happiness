import test from "node:test";
import assert from "node:assert/strict";
import { World } from "../src/world.js";
import { B, MOB_INFO, makeStack, GENERATION_VERSION } from "../src/data.js";
import {
  infernalBase,
  infernalSite,
  infernalGuards,
  infernalLoot,
} from "../src/infernal-world.js";
import { infernalLootBlocked } from "../src/infernal-encounters.js";
import { createEntity, damageEntity, tickSurvival } from "../src/simulation.js";
import { populateEncounters } from "../src/encounters.js";
import { Inventory } from "../src/inventory.js";
import { createPlayer, collides } from "../src/physics.js";
import {
  relicSite,
  attuneTemple,
  templeUnlocked,
  extractRelic,
} from "../src/relic.js";
import { exportRealm, restoreRealm, travel } from "../src/realms.js";
import { enemyCombat } from "../src/hostile-combat.js";
import { firePistols } from "../src/matthew.js";
import { SKINS, skinPreview } from "../src/skins.js";
import { createPlayerModel, animatePlayerModel } from "../src/player-model.js";
import { cleanPose } from "../src/multiplayer.js";

function game(world = new World("Wildflower", {}, "cinderwild", 12)) {
  const g = {
    world,
    dimension: world.dimension,
    mode: "survival",
    difficulty: "normal",
    player: createPlayer({ x: 8.5, y: 200, z: 8.5 }),
    inventory: new Inventory(),
    entities: [],
    drops: [],
    time: 6000,
    tickCount: 1,
    elapsed: 1,
    running: true,
    mouseDown: true,
    settings: { renderDistance: 2, cycleText: {} },
    ui: { toast() {}, updateHotbar() {}, updateHUD() {} },
    audio: { tone() {}, voice() {} },
    renderer: { guardianWave() {}, action() {} },
    save: async () => {},
  };
  g.damage = (n) => (g.player.health -= n);
  return g;
}
test("infernal generation has six seeded regions, immense relief, dry structure islands and legacy generation stays explicit", () => {
  const w = new World("Wildflower", {}, "cinderwild", 12),
    biomes = new Set(),
    heights = [];
  for (let z = -2400; z <= 2400; z += 64)
    for (let x = -2400; x <= 2400; x += 64) {
      const t = infernalBase(x, z, w.seedInt);
      biomes.add(t.biome);
      heights.push(t.h);
      assert.deepEqual(t, infernalBase(x, z, w.seedInt));
    }
  assert.equal(GENERATION_VERSION, 16);
  assert.equal(biomes.size, 6);
  assert.ok(Math.max(...heights) - Math.min(...heights) > 100);
  const s = infernalSite(w, -1, -1);
  assert.ok(s.y > 68);
  assert.ok(s.height >= 44);
  assert.equal(w.terrain(s.x, s.z).h, s.y);
  const legacy = new World(w.seed, {}, "cinderwild", 10);
  assert.notDeepEqual(legacy.ensure(-1, -1).data, w.ensure(-1, -1).data);
});
test("new volcanic chunks and decorations are generation-order independent at negative borders", () => {
  const a = new World("Infernal border", {}, "cinderwild", 12),
    b = new World(a.seed, {}, "cinderwild", 12);
  const coords = [
    [-1, -1],
    [0, -1],
    [-1, 0],
    [0, 0],
  ];
  coords.forEach(([x, z]) => a.ensure(x, z));
  coords.toReversed().forEach(([x, z]) => b.ensure(x, z));
  for (const [key, c] of a.chunks)
    assert.deepEqual(c.data, b.chunks.get(key).data);
});
test("all huge fortress types have valuable, functional enchanted gear and a guarded sigil", () => {
  const w = new World("Wildflower", {}, "cinderwild", 12),
    found = new Map();
  for (let z = -3; z <= 3; z++)
    for (let x = -3; x <= 3; x++) {
      const s = infernalSite(w, x, z);
      found.set(s.kind, s);
    }
  assert.equal(found.size, 3);
  for (const s of found.values()) {
    assert.equal(w.get(s.x, s.y + 1, s.z - 15), B.chest);
    const c = w.containers[`${s.x},${s.y + 1},${s.z - 15}`];
    assert.equal(c.guarded, 6);
    assert.equal(c.slots[0].id, "cinder_sigil");
    assert.ok(c.slots[1].enchantments);
    assert.ok(c.slots[1].durability > 500);
    assert.equal(infernalLoot(s)[0].count, 1);
    assert.equal(w.get(s.x, s.y + 1, s.z - 8), B.infernal_seal);
    assert.equal(
      w.get(s.x + s.radius - 4, s.y + s.height, s.z + s.radius - 4),
      B.glow_crystal,
    );
    assert.equal(infernalGuards(s).length, 6);
  }
});
test("vaults cannot be looted early, guard defeats never duplicate, and emptied rewards persist across reload and regeneration", () => {
  const g = game(),
    s = infernalSite(g.world, 0, 0),
    t = { x: s.x, y: s.y + 1, z: s.z - 15, id: B.chest };
  g.player.x = s.x;
  g.player.y = s.y + 1;
  g.player.z = s.z + 10;
  g.world.get(t.x, t.y, t.z);
  populateEncounters(g, createEntity);
  populateEncounters(g, createEntity);
  assert.equal(g.entities.length, 6);
  assert.ok(
    g.entities.every(
      (e) =>
        !collides(g.world, e, MOB_INFO[e.type].height, MOB_INFO[e.type].width),
    ),
  );
  assert.equal(infernalLootBlocked(g, t), true);
  for (const e of g.entities.slice(0, 5)) {
    damageEntity(g, e, 1000, { knockback: 0 });
    damageEntity(g, e, 1000, { knockback: 0 });
  }
  assert.equal(infernalLootBlocked(g, t), true);
  const loaded = restoreRealm(
    g.world.seed,
    "cinderwild",
    exportRealm({
      world: g.world,
      entities: g.entities.filter((e) => e.hp > 0),
      drops: g.drops,
    }),
  );
  g.world = loaded.world;
  g.entities = loaded.entities;
  populateEncounters(g, createEntity);
  assert.equal(g.entities.length, 1);
  damageEntity(g, g.entities[0], 1000, { knockback: 0 });
  assert.equal(g.world.settlements[s.id].defeated.length, 6);
  assert.equal(infernalLootBlocked(g, t), false);
  assert.equal(g.world.get(s.x, s.y + 1, s.z - 8), B.air);
  const c = g.world.containers[`${t.x},${t.y},${t.z}`];
  c.slots.fill(null);
  const saved = exportRealm({ world: g.world, entities: [], drops: [] });
  g.world = restoreRealm(g.world.seed, "cinderwild", saved).world;
  g.entities = [];
  g.world.get(t.x, t.y, t.z);
  populateEncounters(g, createEntity);
  assert.equal(g.entities.length, 0);
  assert.ok(g.world.containers[`${t.x},${t.y},${t.z}`].slots.every((s) => !s));
});
test("Peaceful preserves infernal defenders without damage or false defeat rewards", () => {
  const g = game(),
    s = infernalSite(g.world, 0, 0);
  Object.assign(g.player, { x: s.x, y: s.y + 1, z: s.z + 4 });
  populateEncounters(g, createEntity);
  g.difficulty = "peaceful";
  tickSurvival(g);
  assert.equal(g.entities.length, 6);
  assert.equal(g.world.settlements[s.id].defeated.length, 0);
  assert.equal(g.player.health, 20);
});
test("Guardians are immune to actual pistol fire but remain vulnerable to melee, including existing temples", () => {
  const g = game(new World("combat", {}, "overworld", 10));
  g.inventory.slots[0] = makeStack("matthew_dual_pistols");
  Object.assign(g.player, { x: 8.5, y: 200, z: 8.5, yaw: 0, pitch: 0 });
  const e = createEntity(g, "devin_guardian", 8, 2);
  e.y = 200;
  g.entities = [e];
  assert.equal(e.hp, 140);
  assert.equal(firePistols(g, damageEntity), true);
  assert.equal(e.hp, 140);
  assert.equal(damageEntity(g, e, 100, { kind: "bullet" }), 0);
  assert.equal(e.hurt, 0);
  assert.equal(g.drops.length, 0);
  assert.ok(damageEntity(g, e, 10, { knockback: 0 }) > 0);
  assert.ok(e.hp < 140);
});
test("the new temple moat, sigil ward and Guardian seal enforce a two-stage acquisition without consuming duplicate keys", () => {
  const g = game(new World("Wildflower")),
    p = relicSite(g.world),
    gate = { x: p.x, y: p.y, z: p.z + 32, id: B.temple_seal };
  Object.assign(g.player, { x: p.x + 0.5, y: p.y, z: p.z + 34 });
  assert.equal(g.world.get(gate.x, gate.y, gate.z), B.temple_seal);
  assert.equal(g.world.get(p.x + 10, p.y - 4, p.z + 28), B.lava);
  attuneTemple(g, gate);
  assert.equal(g.world.get(gate.x, gate.y, gate.z), B.temple_seal);
  g.inventory.slots[0] = makeStack("cinder_sigil", 2);
  attuneTemple(g, gate);
  attuneTemple(g, gate);
  assert.equal(g.inventory.held.count, 1);
  assert.equal(g.world.get(gate.x, gate.y, gate.z), B.air);
  assert.equal(templeUnlocked(g), false);
  populateEncounters(g, createEntity);
  assert.equal(g.entities.length, 3);
  for (const e of g.entities) damageEntity(g, e, 1000, { knockback: 0 });
  assert.equal(templeUnlocked(g), true);
  assert.equal(g.world.get(p.x, p.y, p.z + 7), B.air);
  g.world = restoreRealm(
    g.world.seed,
    "overworld",
    exportRealm({ world: g.world, entities: [], drops: [] }),
  ).world;
  assert.equal(templeUnlocked(g), true);
  assert.equal(g.world.get(gate.x, gate.y, gate.z), B.air);
  Object.assign(g.player, { x: p.x + 0.5, y: p.y, z: p.z + 2.8 });
  g.mouseDown = true;
  const target = { x: p.x, y: p.y + 1, z: p.z, id: B.devin_relic_blade };
  extractRelic(g, target, 0);
  extractRelic(g, target, 30000);
  extractRelic(g, target, 60000);
  assert.equal(
    g.inventory.slots.filter((s) => s?.id === "devin_sword").length,
    1,
  );
});
test("new enemies have dodgeable windups and distinct ground slam, aimed volley and straight charge attacks", () => {
  for (const type of ["dread_knight", "soul_reaver", "magma_maw"]) {
    const g = game();
    const e = createEntity(g, type, 8, 5);
    e.y = 200;
    g.entities = [e];
    g.player.z = 8.5;
    const attack = () =>
      enemyCombat(g, e, g.player, 3, 0, 1, damageEntity, () => {});
    attack();
    assert.ok(e.castTicks > 0);
    assert.equal(g.player.health, 20);
    for (let i = 0; i < 34; i++) attack();
    if (type === "dread_knight") assert.ok(g.player.health < 20);
    if (type === "soul_reaver") assert.equal(g.hostileProjectiles.length, 3);
    if (type === "magma_maw") assert.ok(e.mawDashTicks >= 0);
  }
});
test("Vergil is a distinct persistent and network-valid skin with an animated blue coat", () => {
  assert.equal(SKINS.vergil.name, "Vergil");
  assert.notEqual(skinPreview("vergil"), skinPreview("dante"));
  const m = createPlayerModel("vergil", [], null);
  assert.equal(m.userData.coat.length, 2);
  const p = createPlayer({ x: 0, y: 200, z: 0 });
  p.vy = 5;
  animatePlayerModel(m, p, 1 / 30, true, 0);
  assert.ok(m.userData.coat[0].rotation.x < 0);
  assert.equal(cleanPose({ ...p, skin: "vergil" }).skin, "vergil");
});

test("portal arrival platforms remain above lava even when the search finds no dry land", () => {
  const g = game(new World("portal caldera"));
  const world = new World(g.world.seed, {}, "cinderwild");
  const terrain = world.terrain.bind(world);
  world.terrain = (x, z) => ({ ...terrain(x, z), h: 30 });
  g.realms = { cinderwild: { world, entities: [], drops: [] } };
  g.renderer.setWorld = () => {};
  g.renderer.loadAround = () => {};
  g.ui.play = () => {};
  g.ui.announce = () => {};
  travel(g, { x: 8, y: 180, z: 8, axis: "x" });
  assert.equal(g.dimension, "cinderwild");
  assert.ok(g.player.y >= 71);
  assert.ok(g.world.solid(g.player.x, g.player.y - 0.1, g.player.z));
  assert.equal(collides(g.world, g.player, 1.8, 0.6), false);
});

test("a temple bypassed in Peaceful can still be attuned through its arch after returning to Normal", () => {
  const g = game(new World("Wildflower")),
    p = relicSite(g.world);
  Object.assign(g.player, { x: p.x, y: p.y, z: p.z + 12 });
  g.difficulty = "peaceful";
  populateEncounters(g, createEntity);
  assert.equal(g.world.get(p.x, p.y, p.z + 32), B.air);
  g.difficulty = "normal";
  g.inventory.slots[0] = makeStack("cinder_sigil");
  assert.equal(
    attuneTemple(g, { x: p.x + 2, y: p.y + 1, z: p.z + 32, id: B.runestone }),
    true,
  );
  assert.equal(g.inventory.held, null);
  assert.equal(g.world.settlements["devin-temple"].attuned, true);
  assert.equal(templeUnlocked(g), false);
});
