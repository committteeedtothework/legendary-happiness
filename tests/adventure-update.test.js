import * as THREE from "three";
import { createPlayerModel, animatePlayerModel } from "../src/player-model.js";
import test from "node:test";
import assert from "node:assert/strict";
import { World } from "../src/world.js";
import {
  B,
  BLOCKS,
  MOB_INFO,
  DEFAULT_SETTINGS,
  makeStack,
} from "../src/data.js";
import { createPlayer } from "../src/physics.js";
import { Inventory } from "../src/inventory.js";
import {
  createEntity,
  tickSurvival,
  damageEntity,
  dropItem,
} from "../src/simulation.js";
import {
  nightHostile,
  enemyCombat,
  fireHostileProjectile,
  tickHostileProjectiles,
  creeperExplosion,
  upgradeNightEnemies,
} from "../src/hostile-combat.js";
import { caveNode } from "../src/caves.js";
import { relicSite, templeUnlocked } from "../src/relic.js";
import { populateEncounters } from "../src/encounters.js";
import { restoreRealm, exportRealm } from "../src/realms.js";
import { actionPose, FirstPersonAnimator } from "../src/animation.js";
import { VIDEO_GROUPS } from "../src/graphics.js";
import { mockCanvas } from "./helpers/mock-canvas.js";
function fixture() {
  const w = new World("Wildflower");
  // Elevated test arena keeps natural terrain out of combat fixtures.
  for (let x = -12; x <= 24; x++)
    for (let z = -10; z <= 10; z++) w.set(x, 199, z, B.stone);
  const g = {
    world: w,
    dimension: "overworld",
    player: createPlayer({ x: 0.5, y: 200, z: 0.5 }),
    inventory: new Inventory(),
    entities: [],
    drops: [],
    mode: "survival",
    difficulty: "normal",
    time: 15000,
    tickCount: 1,
    elapsed: 1,
    settings: { ...DEFAULT_SETTINGS, renderDistance: 2 },
    audio: { tone() {}, voice() {} },
    ui: { toast() {}, updateHotbar() {}, updateHUD() {} },
    renderer: {},
    damage(n) {
      this.player.health -= n;
    },
  };
  return g;
}
function enemy(g, type, x = 4, z = 0) {
  const e = createEntity(g, type, x, z, `${type}-test`);
  e.y = 200;
  e.onGround = true;
  g.entities.push(e);
  return e;
}
const hit = (g, e) =>
  enemyCombat(
    g,
    e,
    g.player,
    Math.hypot(e.x - g.player.x, e.z - g.player.z),
    -1,
    0,
    damageEntity,
    dropItem,
  );
test("four nighttime waves rotate all new archetypes and old saves migrate without changing identity or health", () => {
  assert.deepEqual(
    new Set(Array.from({ length: 12 }, (_, i) => nightHostile(i))),
    new Set(["zombie", "creeper", "spider", "skeleton"]),
  );
  const old = [
    { id: "a", type: "shade", hp: 11 },
    { id: "b", type: "stalker", hp: 7 },
  ];
  assert.deepEqual(
    upgradeNightEnemies(old).map((e) => [e.id, e.type, e.hp]),
    [
      ["a", "zombie", 11],
      ["b", "skeleton", 7],
    ],
  );
  assert.equal(old[0].type, "shade");
  assert.equal(upgradeNightEnemies(old, "cinderwild")[0].type, "shade");
  assert.equal(
    restoreRealm("x", "overworld", { generationVersion: 8, entities: old })
      .entities[1].type,
    "skeleton",
  );
});
test("night spawn selection produces new enemy varieties without legacy shades or stalkers", () => {
  const g = fixture();
  g.player.x = 1000;
  g.player.z = 1000;
  // Use a level, unlit surface while retaining real World block methods.
  const terrain = g.world.terrain.bind(g.world);
  g.world.terrain = (x, z) => ({ h: 199, biome: "meadow" });
  const solid = g.world.solid.bind(g.world);
  g.world.solid = (x, y, z) => Math.floor(y) < 200;
  for (let i = 0; i < 8; i++) {
    g.tickCount = 99 + i * 100;
    tickSurvival(g);
  }
  assert.ok(
    g.entities.filter((e) =>
      ["zombie", "creeper", "spider", "skeleton"].includes(e.type),
    ).length >= 4,
  );
  assert.ok(!g.entities.some((e) => ["shade", "stalker"].includes(e.type)));
  g.world.terrain = terrain;
  g.world.solid = solid;
});
test("creeper primes for 30 ticks, stops moving, cancels when escaped and does not drop loot every tick", () => {
  const g = fixture(),
    e = enemy(g, "creeper", 2);
  for (let i = 0; i < 20; i++) {
    const r = hit(g, e);
    assert.equal(r.speed, 0);
    assert.equal(r.skipMelee, true);
  }
  assert.equal(e.fuse, 20);
  assert.equal(e.hp, 20);
  assert.equal(g.drops.length, 0);
  g.player.x = -8;
  for (let i = 0; i < 10; i++) hit(g, e);
  assert.equal(e.fuse, 0);
  assert.equal(e.hp, 20);
});
test("creeper blast damages exposed targets and terrain, protects containers, and persists edits without duplicating inventory", () => {
  const g = fixture(),
    e = enemy(g, "creeper", 2);
  g.world.set(3, 200, 0, B.chest);
  g.world.containers["3,200,0"] = {
    type: "chest",
    slots: [makeStack("diamond", 3)],
  };
  const before = g.player.health;
  creeperExplosion(g, e, damageEntity, dropItem);
  assert.ok(g.player.health < before);
  assert.equal(e.hp, 0);
  assert.equal(g.world.get(2, 199, 0), B.air);
  assert.equal(g.world.get(3, 200, 0), B.chest);
  assert.equal(g.world.containers["3,200,0"].slots[0].count, 3);
  const loaded = restoreRealm(
    g.world.seed,
    "overworld",
    exportRealm({ world: g.world, entities: [], drops: g.drops }),
  );
  assert.equal(loaded.world.get(2, 199, 0), B.air);
  assert.equal(loaded.world.containers["3,200,0"].slots[0].count, 3);
});
test("solid walls shield creatures from creeper damage", () => {
  const g = fixture(),
    e = enemy(g, "creeper", 3);
  for (let y = 200; y < 204; y++)
    for (let z = -3; z < 4; z++) g.world.set(2, y, z, B.obsidian);
  creeperExplosion(g, e, damageEntity, dropItem);
  assert.equal(g.player.health, 20);
});
test("skeleton keeps distance, fires aimed arrows, and projectiles damage only once", () => {
  const g = fixture(),
    e = enemy(g, "skeleton", 10);
  const r = hit(g, e);
  assert.equal(r.speed, 0);
  assert.equal(g.hostileProjectiles.length, 1);
  assert.equal(e.attack, 1.8);
  hit(g, e);
  assert.equal(g.hostileProjectiles.length, 1);
  for (let i = 0; i < 25; i++) tickHostileProjectiles(g, damageEntity);
  assert.equal(g.player.health, 16);
  assert.equal(g.hostileProjectiles.length, 0);
});
test("projectiles sweep solid walls, ignore Creative players and expire in Peaceful", () => {
  for (const mode of ["wall", "creative", "peaceful"]) {
    const g = fixture(),
      e = enemy(g, "skeleton", 10);
    if (mode === "wall")
      for (let y = 200; y < 203; y++) g.world.set(5, y, 0, B.stone);
    if (mode === "creative") g.mode = "creative";
    fireHostileProjectile(g, e, g.player);
    if (mode === "peaceful") g.difficulty = "peaceful";
    for (let i = 0; i < 95; i++) tickHostileProjectiles(g, damageEntity);
    assert.equal(g.player.health, 20, mode);
    assert.equal(g.hostileProjectiles.length, 0, mode);
  }
});
test("arrows strike intervening villagers once rather than passing through their bodies", () => {
  const g = fixture(),
    e = enemy(g, "skeleton", 10),
    v = enemy(g, "villager", 6);
  fireHostileProjectile(g, e, g.player);
  for (let i = 0; i < 25; i++) tickHostileProjectiles(g, damageEntity);
  assert.equal(v.hp, 16);
  assert.equal(g.player.health, 20);
});
for (const [index, kind] of ["shockwave", "barrage", "lunge"].entries())
  test(`Guardian ${index + 1} visibly charges ${kind}, has a recovery window and can be countered`, () => {
    const g = fixture(),
      e = enemy(g, "devin_guardian", 4);
    Object.assign(e, { guardianIndex: index, specialCooldown: 0 });
    const r = hit(g, e);
    assert.equal(e.special, kind);
    assert.ok(e.specialTicks >= 23);
    assert.equal(r.speed, 0);
    assert.equal(g.player.health, 20);
    if (index === 0) g.player.y += 1.1; // jump clears the shockwave
    for (let i = 0; i < 32; i++) hit(g, e);
    if (index === 0) {
      assert.equal(g.player.health, 20);
      assert.ok(e.specialCooldown > 100);
    }
    if (index === 1) {
      assert.equal(g.hostileProjectiles.length, 3);
      assert.ok(e.specialCooldown > 100);
    }
    if (index === 2) {
      assert.equal(e.special, null);
      assert.ok(e.specialCooldown > 100);
    }
    assert.ok(MOB_INFO.devin_guardian.health > 44);
  });
test("Guardian specials and creeper fuses cancel when their target leaves, Peaceful never damages", () => {
  const g = fixture(),
    e = enemy(g, "devin_guardian", 4);
  Object.assign(e, {
    guardianIndex: 0,
    specialCooldown: 0,
    anchor: { x: 4, z: 0 },
  });
  hit(g, e);
  assert.ok(e.special);
  g.player.x = 100;
  tickSurvival(g);
  assert.equal(e.special, null);
  const c = enemy(g, "creeper", 100);
  g.difficulty = "peaceful";
  c.fuse = 29;
  tickSurvival(g);
  assert.equal(g.player.health, 20);
});
test("new temple is larger and taller, has stable loot and three non-clipping stronger defenders", () => {
  const w = new World("Wildflower", {}, "overworld", 10),
    s = relicSite(w),
    g = fixture();
  g.world = w;
  Object.assign(g.player, { x: s.x, y: s.y, z: s.z + 3 });
  assert.equal(w.generationVersion, 10);
  assert.equal(w.get(s.x + 18, s.y + 25, s.z + 18), B.glow_crystal);
  assert.equal(w.get(s.x + 22, s.y, s.z), B.runestone);
  assert.equal(w.get(s.x, s.y + 19, s.z + 5), B.runestone);
  populateEncounters(g, createEntity);
  assert.equal(g.entities.length, 3);
  assert.equal(templeUnlocked(g), false);
  const key = `${s.x + 12},${s.y},${s.z - 12}`;
  assert.equal(w.get(s.x + 12, s.y, s.z - 12), B.chest);
  assert.equal(w.containers[key].slots[0].count, 10);
  for (const e of g.entities) {
    assert.equal(e.hp, 140);
    for (let i = 0; i < 30; i++) damageEntity(g, e, 7, { knockback: 0 });
    assert.ok(e.hp > 0);
    damageEntity(g, e, 7, { knockback: 0 });
    assert.ok(e.hp <= 0);
  }
  assert.equal(templeUnlocked(g), true);
});
test("generator 9 creates connected underground chambers and reproducible chunk seams while retaining bedrock", () => {
  const w = new World("Wildflower", {}, "overworld", 9),
    n = caveNode(0, 0, w.seedInt),
    a = new World(w.seed, {}, "overworld", 9),
    b = new World(w.seed, {}, "overworld", 9);
  assert.equal(w.get(Math.floor(n.x), Math.round(n.y), Math.floor(n.z)), B.air);
  assert.ok(w.solid(n.x, Math.floor(n.y - n.radius * 0.65) - 2, n.z));
  const coords = [
    [-1, -1],
    [0, -1],
    [-1, 0],
    [0, 0],
    [3, 3],
    [4, 3],
  ];
  for (const [x, z] of coords) a.ensure(x, z);
  for (const [x, z] of coords.toReversed()) b.ensure(x, z);
  for (const [key, c] of a.chunks) {
    assert.deepEqual(c.data, b.chunks.get(key).data);
    assert.equal(c.data[0], B.bedrock);
  }
  const old = new World(w.seed, {}, "overworld", 8);
  assert.notDeepEqual(w.ensure(3, 3).data, old.ensure(3, 3).data);
});
test("standard mining, placement and use share a finite non-alternating swing and settle to rest", () => {
  const kinds = ["attack", "mine", "place", "use", "eat"];
  for (const kind of kinds)
    for (const tool of ["sword", "spear", "axe", "shovel", "block", undefined])
      for (const t of [0, 0.1, 0.4, 0.8, 1]) {
        const p = actionPose(kind, t, tool);
        assert.ok(Object.values(p).every(Number.isFinite));
        if (t === 0 || t === 1)
          assert.ok(Object.values(p).every((v) => Math.abs(v) < 1e-8));
      }
  assert.deepEqual(actionPose("place", 0.4), actionPose("use", 0.4));
  const a = new FirstPersonAnimator();
  a.trigger("attack", "sword");
  const d = a.action.direction;
  a.action = null;
  a.trigger("attack", "sword");
  assert.equal(a.action.direction, d);
  a.action = null;
  a.trigger("attack", "sword", "devin_sword");
  const custom = a.action.direction;
  a.action = null;
  a.trigger("attack", "sword", "devin_sword");
  assert.equal(a.action.direction, -custom);
});
test("all new graphics controls have independent persisted defaults and are exposed exactly once", () => {
  const keys = VIDEO_GROUPS.flatMap((g) => g[2].map((f) => f[0]));
  for (const k of [
    "stars",
    "animatedTextures",
    "entityAnimations",
    "droppedItemAnimation",
    "dynamicFOV",
    "damageTilt",
    "cloudHeight",
  ]) {
    assert.equal(keys.filter((x) => x === k).length, 1);
    assert.ok(DEFAULT_SETTINGS[k] !== undefined);
  }
});

test("third-person hands contact blocks and weapon handles throughout attacks and interactions, facing forward", () => {
  const restore = mockCanvas();
  try {
    for (const id of [
      "iron_sword",
      "iron_spear",
      "wooden_pickaxe",
      "planks",
      "oak_door",
    ])
      for (const kind of ["attack", "mine", "place", "use", "eat"])
        for (const action of [0, 0.2, 0.8, 1]) {
          const model = createPlayerModel("devin", [], id, {
            texture: new THREE.Texture(),
          });
          animatePlayerModel(
            model,
            { pitch: 0, onGround: true },
            1 / 60,
            false,
            action,
            kind,
          );
          model.updateMatrixWorld(true);
          const palm = new THREE.Box3().setFromObject(
            model.userData.arms[1].children[1],
          );
          const contact = new THREE.Box3().setFromObject(
            model.userData.grip.children[0].children[0],
          );
          assert.ok(
            palm.intersectsBox(contact),
            `${id} ${kind} ${action} left the hand`,
          );
          if (kind === "attack" && action === 1)
            assert.ok(
              palm.getCenter(new THREE.Vector3()).z < -0.4,
              "the swing must extend in front of the body",
            );
        }
  } finally {
    restore();
  }
});
test("spiders climb solid walls through body physics and become neutral in ordinary daylight", () => {
  const g = fixture(),
    e = enemy(g, "spider", 4);
  for (let y = 200; y < 204; y++)
    for (let z = -2; z < 3; z++) g.world.set(2, y, z, B.stone);
  for (let i = 0; i < 15; i++) tickSurvival(g);
  assert.ok(e.y > 200.25, `spider did not climb: ${e.y}`);
  g.time = 6000;
  Object.assign(e, {
    x: g.player.x,
    y: g.player.y,
    z: g.player.z + 1,
    flee: 0,
    attack: 0,
  });
  const before = g.player.health;
  for (let i = 0; i < 10; i++) tickSurvival(g);
  assert.equal(g.player.health, before);
});
test("Guardian shockwaves damage grounded targets while aimed lunges hit at most once per dash", () => {
  const g = fixture(),
    e = enemy(g, "devin_guardian", 2);
  Object.assign(e, { guardianIndex: 0, specialCooldown: 0 });
  g.player.health = 40;
  for (let i = 0; i < 33; i++) hit(g, e);
  assert.equal(g.player.health, 29);
  Object.assign(e, {
    guardianIndex: 2,
    special: "dash",
    specialTicks: 8,
    dashX: -1,
    dashZ: 0,
    dashHit: false,
    x: g.player.x + 1,
  });
  for (let i = 0; i < 8; i++) hit(g, e);
  assert.equal(g.player.health, 17);
  assert.equal(e.special, null);
});
test("night enemy loot drops once on defeat and connects bones and string to real crafting recipes", () => {
  for (const [type, id] of [
    ["zombie", "rotten_flesh"],
    ["skeleton", "bone"],
    ["creeper", "gunpowder"],
    ["spider", "string"],
  ]) {
    const g = fixture(),
      e = enemy(g, type);
    damageEntity(g, e, 100, { knockback: 0 });
    damageEntity(g, e, 100, { knockback: 0 });
    assert.equal(g.drops.length, 1);
    assert.equal(g.drops[0].id, id);
  }
  const g = fixture();
  g.inventory.craft[0] = makeStack("bone");
  assert.equal(g.inventory.recipe()?.result, "bone_meal");
});
