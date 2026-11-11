import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { B, BLOCKS, DEFAULT_SETTINGS, MOB_INFO } from "../src/data.js";
import { World } from "../src/world.js";
import { createPlayer, collides, updatePlayer } from "../src/physics.js";
import { Inventory } from "../src/inventory.js";
import { createEntity, damageEntity, tickSurvival } from "../src/simulation.js";
import {
  tickInvasion,
  INVASION,
  INVADERS,
  tickOrbGunfire,
} from "../src/invasion.js";
import { tickHostileProjectiles, enemyCombat } from "../src/hostile-combat.js";
import {
  activeTrial,
  beginTitanTrial,
  tickRiftTrial,
  respawnInTrial,
  useTrialExit,
  findTrialSite,
  TITAN_HP,
} from "../src/rift-trial.js";
import { exportRealm, restoreRealm } from "../src/realms.js";
import { createMobModel } from "../src/models.js";
function fixture() {
  const world = new World("Wildflower");
  for (let x = -20; x <= 20; x++)
    for (let z = -20; z <= 20; z++) world.set(x, 199, z, B.stone);
  const g = {
    world,
    dimension: "overworld",
    mode: "survival",
    difficulty: "normal",
    player: createPlayer({ x: 10.5, y: 200, z: 10.5 }),
    inventory: new Inventory(),
    entities: [],
    drops: [],
    tickCount: 1,
    time: 6000,
    elapsed: 1,
    settings: { ...DEFAULT_SETTINGS, renderDistance: 2 },
    renderer: {
      setWorld() {},
      loadAround() {},
      action() {},
      arcane: { burst() {}, emit() {} },
    },
    audio: { tone() {}, voice() {} },
    ui: { toast() {}, announce() {}, updateHUD() {}, updateHotbar() {} },
    damage(n) {
      this.player.health -= n;
    },
    save() {
      return Promise.resolve();
    },
  };
  world.settlements[INVASION] = {
    x: 0,
    y: 200,
    z: 0,
    phase: "battle",
    age: 180,
    created: [],
    defeated: [],
  };
  return g;
}
function trial(g) {
  assert.equal(beginTitanTrial(g, createEntity), true);
  return activeTrial(g);
}
const boss = (g) => g.entities.find((e) => e.type === "mad_titan");
function exitTarget(t) {
  return {
    x: t.arena.x,
    y: t.arena.y + 1,
    z: t.arena.z + 15,
    id: B.trial_exit,
  };
}

test("pistol guards have upgraded roles, health, and exactly four persistent identities", () => {
  const g = fixture();
  tickInvasion(g, createEntity);
  tickInvasion(g, createEntity);
  assert.equal(g.entities.length, 4);
  assert.deepEqual(
    g.entities.map((e) => [e.type, e.hp]),
    INVADERS.map(([type, , , hp]) => [type, hp]),
  );
  assert.ok(g.entities.every((e) => e.incursionBalance === 2 && e.persistent));
});
test("legacy living guards are proportionally buffed once without reviving defeated guards", () => {
  const g = fixture(),
    s = g.world.settlements[INVASION];
  s.created = [0, 1];
  s.defeated = [1, 2, 3];
  g.entities.push({
    ...createEntity(g, "cinder_wraith", -4, -3),
    y: 200,
    hp: 21,
    encounter: INVASION,
    invasionIndex: 0,
  });
  tickInvasion(g, createEntity);
  assert.equal(g.entities[0].hp, 42);
  tickInvasion(g, createEntity);
  assert.equal(g.entities[0].hp, 42);
  assert.equal(g.entities.length, 1);
});
test("orb gunfire is seeded, capped, tick limited and stops when reward unlocks", () => {
  const a = fixture(),
    b = fixture();
  tickOrbGunfire(a);
  tickOrbGunfire(b);
  assert.deepEqual(a.hostileProjectiles, b.hostileProjectiles);
  assert.equal(a.hostileProjectiles.length, 1);
  tickOrbGunfire(a);
  assert.equal(a.hostileProjectiles.length, 1);
  for (let n = 0; n < 80; n++) {
    a.tickCount += 40;
    tickOrbGunfire(a);
  }
  assert.equal(a.hostileProjectiles.length, 48);
  a.hostileProjectiles = [];
  a.world.settlements[INVASION].defeated = [0, 1, 2, 3];
  a.tickCount += 50;
  tickInvasion(a, createEntity);
  assert.equal(a.world.settlements[INVASION].phase, "ready");
  assert.equal(a.hostileProjectiles.length, 0);
});
test("real orb bullet sweep hurts players, cover blocks it, and shots fly straight", () => {
  const g = fixture();
  Object.assign(g.player, { x: 2, y: 200, z: 0 });
  const q = {
    id: "test",
    x: 0,
    y: 201,
    z: 0,
    vx: 3,
    vy: 0,
    vz: 0,
    damage: 6,
    age: 0,
    orbBullet: true,
    sourceType: "sealed_pistols",
  };
  g.hostileProjectiles = [{ ...q }];
  tickHostileProjectiles(g, damageEntity);
  assert.equal(g.player.health, 14);
  assert.equal(g.hostileProjectiles.length, 0);
  g.player.health = 20;
  g.world.set(1, 201, 0, B.stone);
  g.hostileProjectiles = [{ ...q }];
  tickHostileProjectiles(g, damageEntity);
  assert.equal(g.player.health, 20);
  g.world.set(1, 201, 0, B.air);
  g.player.z = 5;
  g.hostileProjectiles = [{ ...q }];
  tickHostileProjectiles(g, damageEntity);
  assert.equal(g.hostileProjectiles[0].vy, 0);
});
test("tentacle warning allows escape and cancels behind cover or in unsupported modes", () => {
  const g = fixture(),
    s = g.world.settlements[INVASION];
  Object.assign(g.player, { x: 5.8, z: 0 });
  s.grab = { arm: 0, age: 0 };
  g.player.x = 11;
  tickRiftTrial(g, createEntity);
  assert.equal(s.grab, undefined);
  g.player.x = 7.8;
  s.grab = { arm: 0, age: 45 };
  g.world.set(6, 201, 0, B.stone);
  tickRiftTrial(g, createEntity);
  assert.equal(s.grab, undefined);
  assert.equal(g.player.riftGrip, undefined);
  g.world.set(6, 201, 0, B.air);
  g.player.x = 5.8;
  s.grab = { arm: 0, age: 45 };
  g.difficulty = "peaceful";
  tickRiftTrial(g, createEntity);
  assert.equal(s.grab, undefined);
  assert.equal(g.player.riftGrip, undefined);
  g.difficulty = "normal";
  s.grab = { arm: 0, age: 45 };
  g.multiplayer = { connected: true };
  tickRiftTrial(g, createEntity);
  assert.equal(s.grab, undefined);
  assert.equal(beginTitanTrial(g, createEntity), false);
});
test("seeded tentacle checks can warn a nearby player but never a distant or Creative player", () => {
  const g = fixture(),
    s = g.world.settlements[INVASION];
  Object.assign(g.player, { x: 5.8, z: 0 });
  for (let i = 0; i < 200 && !s.grab; i++) {
    g.tickCount += 100;
    tickRiftTrial(g, createEntity);
  }
  assert.ok(s.grab);
  assert.equal(g.dimension, "overworld");
  delete s.grab;
  g.mode = "creative";
  for (let i = 0; i < 20; i++) {
    g.tickCount += 100;
    tickRiftTrial(g, createEntity);
  }
  assert.equal(s.grab, undefined);
});
test("grab physically pulls a player, completes into Cinderworld, and movement cannot override grip", () => {
  const g = fixture(),
    s = g.world.settlements[INVASION];
  Object.assign(g.player, { x: 7.8, z: 0 });
  s.grab = { arm: 0, age: 39 };
  const x = g.player.x;
  tickRiftTrial(g, createEntity);
  assert.ok(g.player.x < x);
  assert.equal(g.player.riftGrip, true);
  const pulled = g.player.x;
  updatePlayer(g, new Set(["KeyD", "Space"]), 1 / 60);
  assert.ok(Math.abs(g.player.x - pulled) < 0.001);
  let changed = false;
  for (let i = 0; i < 31 && !changed; i++)
    changed = tickRiftTrial(g, createEntity);
  assert.equal(changed, true);
  assert.equal(g.dimension, "cinderwild");
  assert.equal(g.player.riftGrip, undefined);
  assert.equal(boss(g).hp, 320);
  assert.equal(collides(g.world, g.player, 1.8, 0.6), false);
});
test("arena protects player builds and provides a once-only normal supply chest", () => {
  const g = fixture(),
    cw = restoreRealm("Wildflower", "cinderwild");
  cw.world.set(4096, 300, 4096, B.diamond_block);
  g.realms = { cinderwild: cw };
  const site = findTrialSite(cw.world, { x: 0, z: 0 });
  assert.notEqual(site.x, 4096);
  const t = trial(g),
    key = `${t.arena.x + 2},${t.arena.y + 1},${t.arena.z + 13}`;
  assert.equal(cw.world.get(4096, 300, 4096), B.diamond_block);
  assert.equal(g.world.containers[key].slots[0].id, "diamond_sword");
  assert.equal(
    BLOCKS[g.world.get(t.arena.x, t.arena.y, t.arena.z)].hardness,
    Infinity,
  );
  g.world.containers[key].slots[0] = null;
  assert.equal(beginTitanTrial(g, createEntity), false);
  assert.equal(g.world.containers[key].slots[0], null);
});
test("Titan completely rejects bullets including knockback, while real melee reduces its health", () => {
  const g = fixture();
  trial(g);
  const e = boss(g),
    before = [e.x, e.y, e.z];
  assert.equal(damageEntity(g, e, 99999, { kind: "bullet" }), 0);
  assert.equal(e.hp, TITAN_HP);
  assert.deepEqual([e.x, e.y, e.z], before);
  assert.equal(damageEntity(g, e, 8, { knockback: 0 }), 6);
  assert.equal(e.hp, 314);
});
test("Titan uses four telegraphed attacks with interrupt-free windup and a dodgeable ground slam", () => {
  const g = fixture();
  trial(g);
  const e = boss(g);
  Object.assign(g.player, { x: e.x + 4, y: e.y, z: e.z });
  e.specialCooldown = 0;
  enemyCombat(g, e, g.player, 4, 1, 0, damageEntity, () => {});
  assert.equal(e.special, "shockwave");
  assert.ok(e.specialTicks > 20);
  assert.equal(g.player.health, 20);
  g.player.y = e.y + 1.1;
  for (let i = 0; i < 32; i++)
    enemyCombat(g, e, g.player, 4, 1, 0, damageEntity, () => {});
  assert.equal(g.player.health, 20);
  const moves = [];
  for (let i = 0; i < 4; i++) {
    e.special = null;
    e.specialCooldown = 0;
    enemyCombat(g, e, g.player, 4, 1, 0, damageEntity, () => {});
    moves.push(e.special);
  }
  assert.equal(new Set(moves).size, 4);
});
test("trial, damaged boss and consumed supplies survive both realm exports and restore", () => {
  const g = fixture(),
    t = trial(g);
  damageEntity(g, boss(g), 40, { knockback: 0 });
  const cache = `${t.arena.x + 2},${t.arena.y + 1},${t.arena.z + 13}`;
  g.world.containers[cache].slots[0] = null;
  const ow = JSON.parse(JSON.stringify(exportRealm(g.realms.overworld))),
    cw = JSON.parse(
      JSON.stringify(
        exportRealm({ world: g.world, entities: g.entities, drops: g.drops }),
      ),
    );
  const h = {
    ...g,
    realms: { overworld: restoreRealm("Wildflower", "overworld", ow) },
    ...restoreRealm("Wildflower", "cinderwild", cw),
  };
  tickRiftTrial(h, createEntity);
  assert.equal(activeTrial(h).bossId, t.bossId);
  assert.equal(boss(h).hp, 290);
  assert.equal(h.world.containers[cache].slots[0], null);
  h.entities = [];
  tickRiftTrial(h, createEntity);
  tickRiftTrial(h, createEntity);
  assert.equal(boss(h).hp, 290);
  assert.equal(h.entities.filter((e) => e.type === "mad_titan").length, 1);
});
test("death respawn and out-of-bounds recovery retain the arena and damaged boss", () => {
  const g = fixture(),
    t = trial(g);
  boss(g).hp = 180;
  g.player.health = 0;
  assert.equal(respawnInTrial(g), true);
  assert.equal(g.dimension, "cinderwild");
  assert.equal(g.player.health, 20);
  assert.equal(boss(g).hp, 180);
  g.player.x = t.arena.x + 50;
  tickRiftTrial(g, createEntity);
  assert.ok(Math.abs(g.player.x - t.arena.x) < 1);
  assert.equal(boss(g).hp, 180);
});
test("Peaceful leaves the Titan dormant, and only its real defeat opens the return rune once", () => {
  const g = fixture(),
    t = trial(g);
  g.difficulty = "peaceful";
  tickSurvival(g);
  assert.equal(boss(g).hp, 320);
  assert.equal(t.phase, "active");
  Object.assign(g.player, {
    x: t.arena.x + 0.5,
    y: t.arena.y + 1.01,
    z: t.arena.z + 13.5,
  });
  assert.equal(useTrialExit(g, exitTarget(t)), true);
  assert.equal(g.dimension, "cinderwild");
  g.difficulty = "normal";
  const e = boss(g);
  damageEntity(g, e, 10000, { knockback: 0 });
  assert.equal(t.phase, "victory");
  assert.equal(g.player.xp, 35);
  damageEntity(g, e, 10000);
  assert.equal(g.player.xp, 35);
  assert.equal(g.drops.filter((d) => d.id === "hellfire_ingot").length, 1);
  assert.equal(useTrialExit(g, exitTarget(t)), true);
  assert.equal(g.dimension, "overworld");
  assert.equal(t.phase, "escaped");
  assert.equal(activeTrial(g), null);
  assert.equal(beginTitanTrial(g, createEntity), false);
});
test("Titan has an original bounded three-dimensional horned model matching collision height", () => {
  const oldDocument = globalThis.document;
  globalThis.document = {
    createElement() {
      return {
        getContext() {
          return { fillRect() {} };
        },
      };
    },
  };
  const model = createMobModel({ type: "mad_titan" }),
    bounds = new THREE.Box3().setFromObject(model),
    size = bounds.getSize(new THREE.Vector3());
  assert.ok(Math.abs(size.y - MOB_INFO.mad_titan.height) < 0.05);
  assert.ok(size.x > 2);
  assert.ok(model.userData.arms.length === 2);
  let draws = 0;
  model.traverse((o) => {
    if (o.isMesh) draws++;
  });
  assert.ok(draws < 24);
  globalThis.document = oldDocument;
});

test("return rune cannot be mined and an absent or counterfeit block never activates it", () => {
  const g = fixture(),
    t = trial(g),
    target = exitTarget(t);
  assert.equal(g.world.get(target.x, target.y, target.z), B.trial_exit);
  assert.equal(BLOCKS[B.trial_exit].hardness, Infinity);
  damageEntity(g, boss(g), 10000, { knockback: 0 });
  Object.assign(g.player, {
    x: t.arena.x + 0.5,
    y: t.arena.y + 1.01,
    z: t.arena.z + 13.5,
  });
  g.world.set(target.x, target.y, target.z, B.air);
  assert.equal(useTrialExit(g, target), false);
  assert.equal(g.dimension, "cinderwild");
  g.world.set(target.x, target.y, target.z, B.trial_exit);
  assert.equal(useTrialExit(g, target), true);
  assert.equal(g.dimension, "overworld");
});
