import test from "node:test";
import assert from "node:assert/strict";
import { World, index } from "../src/world.js";
import { B, BLOCKS, ITEMS, RECIPES, MIN_Y, makeStack } from "../src/data.js";
import { Inventory } from "../src/inventory.js";
import { createPlayer } from "../src/physics.js";
import { createEntity, damageEntity, dropItem } from "../src/simulation.js";
import {
  strongholds,
  portalFrames,
  END_PILLARS,
  endTerrain,
} from "../src/end-terrain.js";
import {
  endState,
  useEndItem,
  enterEnd,
  leaveEnd,
  tickEndWorld,
  tickEnderman,
  safeEndTeleport,
} from "../src/end-runtime.js";
import { exportRealm, restoreRealm, realmState } from "../src/realms.js";
import { meshChunk } from "../src/mesher.js";
import { meshHorizon } from "../src/horizon.js";
import { blockArtUV } from "../src/block-art.js";
import { surfaceSoundLevels } from "../src/surface-sound.js";
import { explosionCells } from "../src/explosion-spread.js";
const api = { createEntity, damageEntity, dropItem };
function game(dimension = "overworld") {
  const w = new World("End reliable", {}, dimension),
    p = createPlayer({ x: 5.5, y: 81, z: 5.5 });
  return {
    world: w,
    dimension,
    player: p,
    active: true,
    mode: "survival",
    difficulty: "normal",
    inventory: new Inventory(),
    entities: [],
    drops: [],
    realms: {},
    spawn: { x: 5.5, y: 81, z: 5.5 },
    time: 18000,
    tickCount: 1,
    elapsed: 1,
    settings: { renderDistance: 2 },
    ui: { toast() {}, announce() {}, updateHotbar() {}, updateHUD() {} },
    renderer: {
      setWorld() {},
      loadAround() {},
      action() {},
      guardianWave() {},
      explosionEffect() {},
    },
    audio: { tone() {}, voice() {} },
    save: async () => {},
    damage(n) {
      this.player.health -= n;
    },
  };
}
function flat(g, range = 20, y = 80) {
  for (let x = -range; x <= range; x++)
    for (let z = -range; z <= range; z++) {
      g.world.set(x, y, z, B.stone);
      for (let h = y + 1; h < y + 5; h++) g.world.set(x, h, z, B.air);
    }
}
function ticks(g, n) {
  for (let i = 0; i < n; i++) {
    tickEndWorld(g, api);
    g.tickCount++;
  }
}
test("End content appends IDs, valid original atlas UVs and the real Pearl + Powder Eye recipe", () => {
  for (const key of [
    "end_stone",
    "end_portal_frame",
    "end_gateway",
    "dragon_egg",
  ]) {
    assert.ok(Number.isInteger(B[key]));
    for (const v of blockArtUV(B[key], 2, 0.5, 0.5))
      assert.ok(v > 0 && v < 1, key);
  }
  assert.equal(ITEMS.ender_pearl.stack, 16);
  assert.deepEqual(RECIPES.find((r) => r.id === "eye_of_ender").ingredients, [
    "ender_pearl",
    "blaze_powder",
  ]);
  assert.ok(B.end_stone > B.heavy_core);
});
test("main island, ten solid towers, true void, outer islands and gateway terrain are deterministic across reload and horizon/detail", () => {
  const w = new World("End geometry", {}, "end");
  assert.equal(w.get(300, -100, 0), B.air);
  assert.equal(w.terrain(300, 0).void, true);
  assert.equal(w.get(0, w.terrain(0, 0).h, 0), B.end_stone);
  for (const p of END_PILLARS) assert.equal(w.get(p.x, p.top, p.z), B.obsidian);
  assert.ok(w.terrain(900, 0).h > MIN_Y);
  const voidMesh = meshHorizon(w, 16, 0, { span: 1, step: 4 });
  assert.equal((voidMesh[0]?.i.length || 0) + (voidMesh[1]?.i.length || 0), 0);
  assert.deepEqual(
    w.ensure(0, 0).data,
    new World("End geometry", {}, "end").ensure(0, 0).data,
  );
});
test("strongholds cross chunk seams, contain exactly twelve frames and never override explicit saved edits", () => {
  const w = new World("End temples"),
    site = strongholds(w)[0],
    frames = portalFrames(site);
  assert.equal(frames.length, 12);
  for (const q of frames)
    assert.ok(
      [B.end_portal_frame, B.end_portal_frame_filled].includes(
        w.get(q.x, q.y, q.z),
      ),
    );
  const q = frames[0];
  w.set(q.x, q.y, q.z, B.diamond_ore);
  const restored = new World(w.seed, w.exportEdits());
  assert.equal(restored.get(q.x, q.y, q.z), B.diamond_ore);
  assert.deepEqual(strongholds(restored), strongholds(w));
});
test("Eyes consume one item per empty frame; eleven filled frames never open, the twelfth opens exactly the interior", () => {
  const g = game(),
    site = strongholds(g.world)[0];
  g.inventory.slots[0] = makeStack("eye_of_ender", 12);
  for (const q of portalFrames(site))
    g.world.set(q.x, q.y, q.z, B.end_portal_frame);
  for (const [i, q] of portalFrames(site).entries()) {
    g.target = { ...q, id: g.world.get(q.x, q.y, q.z) };
    assert.equal(useEndItem(g), true);
    if (i < 11)
      assert.notEqual(g.world.get(site.x, site.y + 1, site.z), B.end_portal);
  }
  assert.equal(g.inventory.held, null);
  for (let x = -1; x <= 1; x++)
    for (let z = -1; z <= 1; z++)
      assert.equal(
        g.world.get(site.x + x, site.y + 1, site.z + z),
        B.end_portal,
      );
});
test("a thrown Eye guides toward the same stronghold, consumes once, has bounded life and resolves into recovery or shatter", () => {
  const g = game();
  g.inventory.slots[0] = makeStack("eye_of_ender", 2);
  assert.equal(useEndItem(g), true);
  const s = endState(g.world),
    o = s.orbs[0],
    site = strongholds(g.world).find((x) => x.id === s.lastStronghold.id);
  assert.ok(
    Math.hypot(o.to.x - site.x, o.to.z - site.z) <
      Math.hypot(g.player.x - site.x, g.player.z - site.z),
  );
  assert.equal(g.inventory.held.count, 1);
  useEndItem(g);
  assert.equal(s.orbs.length, 1);
  ticks(g, 70);
  assert.equal(s.orbs.length, 0);
  assert.ok(g.drops.length <= 1);
});
test("pearl sweep cannot teleport through a wall or into a ceiling and respects its cooldown", () => {
  const g = game();
  flat(g, 12);
  g.player.x = 0.5;
  g.player.z = 5.5;
  g.player.y = 81;
  g.player.yaw = 0;
  g.player.pitch = 0;
  for (let x = -4; x <= 4; x++)
    for (let y = 81; y < 87; y++) g.world.set(x, y, 0, B.stone);
  g.inventory.slots[0] = makeStack("ender_pearl", 3);
  useEndItem(g);
  useEndItem(g);
  assert.equal(g.inventory.held.count, 2);
  ticks(g, 40);
  assert.ok(g.player.z > 1);
  assert.equal(g.player.health, 15);
  assert.equal(g.world.solid(g.player.x, g.player.y, g.player.z), false);
  assert.equal(g.world.solid(g.player.x, g.player.y + 1, g.player.z), false);
});
test("travel preserves inventory and both realms; DRAGOON, broken crystals, drops and victory rewards survive serialization without duplication", () => {
  const g = game();
  flat(g, 8);
  g.inventory.slots[0] = makeStack("diamond_sword");
  const original = g.world;
  assert.equal(enterEnd(g), true);
  assert.equal(g.dimension, "end");
  assert.equal(g.inventory.held.id, "diamond_sword");
  assert.equal(g.world.solid(g.player.x, g.player.y - 1, g.player.z), true);
  ticks(g, 1);
  let boss = g.entities.find((e) => e.type === "dragoon");
  assert.equal(g.entities.filter((e) => e.type === "end_crystal").length, 10);
  const crystal = g.entities.find((e) => e.type === "end_crystal");
  damageEntity(g, crystal, 1, { kind: "arrow" });
  assert.equal(endState(g.world).broken.length, 1);
  const saved = exportRealm(realmState(g));
  const restored = restoreRealm(
    g.world.seed,
    "end",
    JSON.parse(JSON.stringify(saved)),
  );
  g.world = restored.world;
  g.entities = restored.entities;
  g.drops = restored.drops;
  ticks(g, 1);
  assert.equal(
    g.entities.filter((e) => e.type === "end_crystal" && e.hp > 0).length,
    9,
  );
  boss = g.entities.find((e) => e.type === "dragoon");
  damageEntity(g, boss, 1000, { knockback: 0 });
  assert.equal(boss.dying, 1);
  ticks(g, 105);
  assert.equal(endState(g.world).defeated, true);
  assert.equal(g.player.xp, 12000);
  assert.equal(g.world.get(0, 65, 0), B.dragon_egg);
  assert.equal(g.world.get(1, 61, 0), B.end_exit);
  const before = g.drops.filter((d) => d.id === "dragoon_trophy").length;
  ticks(g, 30);
  assert.equal(g.drops.filter((d) => d.id === "dragoon_trophy").length, before);
  assert.equal(leaveEnd(g), true);
  assert.equal(g.world, original);
  assert.equal(g.inventory.held.id, "diamond_sword");
});
test("crystals actually heal a nearby flying DRAGOON, destruction stops the beam, and perching requires melee", () => {
  const g = game("end");
  ticks(g, 1);
  const s = endState(g.world),
    boss = g.entities.find((e) => e.type === "dragoon"),
    crystal = g.entities.find((e) => e.type === "end_crystal");
  Object.assign(boss, {
    x: crystal.x + 2,
    y: crystal.y,
    z: crystal.z,
    hp: 80,
    age: 9,
    mode: "perch",
    modeAge: 50,
  });
  ticks(g, 1);
  assert.equal(boss.hp, 81);
  assert.equal(s.phase, 2);
  assert.equal(damageEntity(g, boss, 10, { kind: "arrow" }), 0);
  assert.equal(damageEntity(g, boss, 10, { kind: "melee", knockback: 0 }), 10);
  damageEntity(g, crystal, 1, { kind: "arrow" });
  assert.ok(s.broken.includes(crystal.pillar));
});
test("Endermen stay neutral until eye contact or damage, avoid projectiles, and do not wander through solid walls", () => {
  const g = game();
  flat(g, 25);
  g.player.x = 0.5;
  g.player.y = 81;
  g.player.z = 5.5;
  g.player.yaw = 0;
  g.player.pitch = 0;
  const e = createEntity(g, "enderman", 0, -4);
  Object.assign(e, { x: 0.5, y: 81, z: -3.5 });
  g.entities = [e];
  for (let i = 0; i < 4; i++) tickEnderman(g, e, api);
  assert.ok(!e.angry);
  g.player.pitch = Math.atan2(1.03, 9);
  for (let i = 0; i < 20; i++) tickEnderman(g, e, api);
  assert.ok(e.angry > 0);
  const hp = e.hp;
  damageEntity(g, e, 20, { kind: "arrow" });
  assert.equal(e.hp, hp);
  assert.equal(g.world.solid(e.x, e.y, e.z), false);
});
test("lava is opaque in source, flow states and geometry; fire/lava audio queries do not generate terrain", () => {
  const g = game();
  flat(g, 3);
  g.world.set(0, 81, 0, B.lava);
  for (const b of BLOCKS.filter((b) => b.fluid?.type === "lava"))
    assert.equal(b.transparent, false);
  const c = g.world.ensure(0, 0),
    mesh = meshChunk(g.world, c, { ambientOcclusion: false });
  assert.ok(mesh[0].uv.some((x) => Number.isFinite(x)));
  const n = g.world.chunks.size,
    levels = surfaceSoundLevels(g.world, { x: 0.5, y: 82, z: 0.5 });
  assert.ok(levels.lava > 0);
  assert.equal(g.world.chunks.size, n);
});
test("pressure rays are seeded, asymmetric, bounded and leave chests, obsidian and unloaded chunks intact", () => {
  const g = game();
  flat(g, 8);
  for (let y = 81; y <= 85; y++)
    for (let x = -6; x <= 6; x++)
      for (let z = -6; z <= 6; z++) g.world.set(x, y, z, B.stone);
  g.world.set(1, 82, 1, B.chest);
  g.world.containers["1,82,1"] = {
    type: "chest",
    slots: [makeStack("diamond")],
  };
  g.world.set(-1, 82, 1, B.obsidian);
  const n = g.world.chunks.size,
    a = explosionCells(g.world, { x: 0.5, y: 82, z: 0.5 }, 4, 55),
    b = explosionCells(g.world, { x: 0.5, y: 82, z: 0.5 }, 4, 55);
  assert.deepEqual(a, b);
  assert.ok(a.length > 0 && a.length <= 512);
  assert.ok(!a.some((q) => q.id === B.chest || q.id === B.obsidian));
  assert.equal(g.world.chunks.size, n);
  const keys = new Set(a.map((q) => `${q.x},${q.y},${q.z}`));
  assert.ok(a.some((q) => !keys.has(`${-q.x},${q.y},${q.z}`)));
});

test("the arrival platform is outside the island and the fountain/head combat floor stays clear above its support", () => {
  const w = new World("End arrival", {}, "end");
  assert.ok(w.terrain(96, 0).void);
  assert.equal(w.get(96, 50, 0), B.obsidian);
  for (let y = 51; y <= 54; y++) assert.equal(w.get(96, y, 0), B.air);
  for (const [x, z] of [
    [1, 0],
    [0, 1],
    [0, -11],
    [-11, 0],
  ]) {
    assert.equal(w.get(x, 60, z), B.end_stone);
    assert.equal(w.get(x, 61, z), B.air);
  }
});
test("a won encounter can resurrect from four real placed crystals, with 500 repeat XP and no second egg", () => {
  const g = game("end");
  ticks(g, 1);
  let boss = g.entities.find((e) => e.type === "dragoon");
  damageEntity(g, boss, 1000, { kind: "melee" });
  ticks(g, 105);
  assert.ok(endState(g.world).defeated);
  g.world.set(0, 65, 0, B.air);
  g.inventory.slots[0] = makeStack("end_crystal", 4);
  for (const [x, z] of [
    [3, 0],
    [-3, 0],
    [0, 3],
    [0, -3],
  ]) {
    g.target = { x, y: 60, z, id: g.world.get(x, 60, z) };
    useEndItem(g);
  }
  g.tickCount = Math.ceil(g.tickCount / 20) * 20;
  ticks(g, 1);
  assert.equal(endState(g.world).defeated, false);
  assert.equal(g.inventory.held, null);
  boss = g.entities.find((e) => e.type === "dragoon" && e.hp > 0);
  assert.equal(boss.hp, 200);
  damageEntity(g, boss, 1000, { kind: "melee" });
  ticks(g, 105);
  assert.equal(g.player.xp, 12500);
  assert.equal(g.world.get(0, 65, 0), B.air);
  assert.equal(endState(g.world).kills, 2);
});
test("broken or missing legacy End metadata is normalized rather than crashing a resumed world", () => {
  const g = game();
  for (const value of [
    null,
    "bad",
    [],
    { clouds: [null, { x: 0, y: 0, z: 0, radius: 2 }], orbs: [null] },
  ]) {
    g.world.endgame = value;
    assert.doesNotThrow(() => ticks(g, 1));
  }
});

test("outer gateway travel creates a safe arrival and preserves an open way back after a save", () => {
  const g = game("end");
  endState(g.world).defeated = true;
  g.world.set(75, 64, 0, B.bedrock);
  g.world.set(75, 65, 0, B.end_gateway);
  Object.assign(g.player, { x: 75.5, y: 65.02, z: 0.5 });
  g.endTravelCooldown = 0;
  ticks(g, 1);
  assert.ok(g.player.x > 700);
  assert.equal(g.world.solid(g.player.x, g.player.y - 1, g.player.z), true);
  const y = endState(g.world).outerGateY ?? Math.floor(g.player.y);
  assert.equal(g.world.get(900, y, 0), B.end_gateway);
  ticks(g, 65);
  assert.ok(g.player.x > 700);
  g.player.x += 2;
  ticks(g, 1);
  g.endTravelCooldown = 0;
  Object.assign(g.player, { x: 900.5, y: y + 0.02, z: 0.5 });
  ticks(g, 1);
  assert.ok(g.player.x < 100);
  assert.equal(g.player.health, 20);
});

test("End ticks never populate Cinderworld encounters", async () => {
  const { populateEncounters } = await import("../src/encounters.js");
  const g = game("end");
  assert.doesNotThrow(() => populateEncounters(g, createEntity));
  assert.equal(g.entities.length, 0);
});
