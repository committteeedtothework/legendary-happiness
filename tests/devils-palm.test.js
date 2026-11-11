import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { World, index } from "../src/world.js";
import { B, BLOCKS } from "../src/data.js";
import { hash } from "../src/random.js";
import { Inventory } from "../src/inventory.js";
import { createPlayer, collides, updatePlayer } from "../src/physics.js";
import {
  palmConfig,
  fateWeights,
  selectFate,
  STANDS,
  standBindings,
  STAND_KEYS,
} from "../src/stands-data.js";
import {
  ensurePalm,
  tickPalm,
  relocatePalm,
  resolvePalmTrial,
  configurePalm,
  palmDev,
} from "../src/devils-palm.js";
import {
  palmColumn,
  invalidatePalm,
  installPalm,
} from "../src/palm-terrain.js";
import {
  activateStand,
  standRecord,
  tickStand,
  standTravel,
  tickStandProjectiles,
  standMaxEnergy,
} from "../src/stand-abilities.js";
import {
  createStandModel,
  animateStandModel,
  createCorpseModel,
  createDinosaurModel,
} from "../src/stand-models.js";
import { StandVisuals } from "../src/stand-visuals.js";
import { pack, unpack } from "../src/storage.js";
import { damageEntity, hitEntity } from "../src/simulation.js";

function flatWorld() {
  const map = new Map();
  return {
    seed: "Palm QA",
    seedInt: 87123,
    dimension: "overworld",
    tick: 0,
    chunks: new Map(),
    dirty: new Set(),
    revisions: new Map(),
    edits: new Map(),
    editChunks: new Map(),
    settlements: {},
    containers: {},
    protectedAreas: [],
    skyCache: new Map(),
    terrain: () => ({ h: 80, biome: "desert" }),
    nearbyVillages: () => [],
    get(x, y, z) {
      return (
        map.get(`${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`) ??
        (y < 0 ? B.stone : B.air)
      );
    },
    set(x, y, z, id) {
      map.set(`${Math.floor(x)},${Math.floor(y)},${Math.floor(z)}`, id);
      this.edits.set(`${x},${y},${z}`, id);
      const key = `${Math.floor(x / 16)},${Math.floor(z / 16)}`;
      this.editChunks.set(key, [
        ...(this.editChunks.get(key) || []),
        [x, y, z, id],
      ]);
      return true;
    },
    solid(x, y, z) {
      return !!BLOCKS[this.get(x, y, z)]?.solid;
    },
    raycast: World.prototype.raycast,
  };
}
function game(mode = "creative") {
  const w = flatWorld(),
    messages = [];
  const g = {
    id: "world-fixture",
    world: w,
    dimension: "overworld",
    mode,
    difficulty: "normal",
    spawn: { x: -1000, y: 81, z: -1000 },
    tickCount: 0,
    elapsed: 0,
    entities: [],
    drops: [],
    standProjectiles: [],
    inventory: new Inventory(),
    player: createPlayer({ x: 0.5, y: 81, z: 0.5 }),
    devStands: true,
    saves: 0,
    rules: { keepInventory: false },
    ui: {
      toast: (m) => messages.push(m),
      announce: (a, b) => messages.push(a + " " + b),
      updateHUD() {},
      updateHotbar() {},
    },
    audio: { standSound() {}, tone() {}, voice() {} },
    renderer: { epoch: 0, jobs: new Map(), action() {}, combatImpact() {} },
  };
  g.damage = (n, cause, force = false) => {
    if (g.mode !== "creative" || force) {
      g.player.health = Math.max(0, g.player.health - n);
      g.lastDeath = { cause };
    }
  };
  g.save = () => {
    g.saves++;
    return Promise.resolve();
  };
  g.messages = messages;
  const state = ensurePalm(w);
  state.config = palmConfig({ rarity: 0 });
  state.sites = [
    {
      id: "palm:1",
      serial: 1,
      x: 0,
      y: 80,
      z: 0,
      angle: 0,
      seed: 87123,
      phase: "active",
    },
  ];
  state.serial = 1;
  state.nextMove = 999999;
  return g;
}
function ticks(g, n) {
  for (let i = 0; i < n; i++) {
    g.tickCount++;
    tickPalm(g, damageEntity);
  }
}
function grant(g, id) {
  Object.assign(standRecord(g.player), {
    id,
    summoned: true,
    soul: 123,
    energy: 100,
    cooldowns: {},
  });
}

test("default fate boundaries are exactly 35/50/15, seeded sampling is stable and weights always normalize", () => {
  const c = palmConfig();
  assert.deepEqual(fateWeights(c), { awakening: 35, death: 50, neutral: 15 });
  assert.deepEqual(
    [0, 0.349999, 0.35, 0.849999, 0.85, 0.999999].map((v) =>
      selectFate(v, fateWeights(c)),
    ),
    ["stand", "stand", "death", "death", "neutral", "neutral"],
  );
  for (const input of [
    { awakening: 0, death: 0, neutral: 0 },
    { awakening: 900, death: -3, neutral: 12 },
    { awakening: 1, death: 1, neutral: 1 },
    { pity: true, pityRate: 20 },
  ]) {
    const w = fateWeights(input, 100);
    assert.ok(Math.abs(w.awakening + w.death + w.neutral - 100) < 1e-10);
    assert.ok(Object.values(w).every((v) => v >= 0));
  }
  assert.equal(fateWeights({ ...c, pity: false }, 50).awakening, 35);
  assert.equal(fateWeights(c, 100).awakening, 55);
  const counts = { stand: 0, death: 0, neutral: 0 };
  for (let n = 0; n < 30000; n++)
    counts[selectFate(hash(n, 17, 91, 811), fateWeights(c))]++;
  for (const [key, expected] of [
    ["stand", 0.35],
    ["death", 0.5],
    ["neutral", 0.15],
  ])
    assert.ok(Math.abs(counts[key] / 30000 - expected) < 0.012);
});
test("a default trial takes 1200 simulation ticks and commits one outcome across frames and save restoration", () => {
  const g = game();
  standRecord(g.player).forceOutcome = "stand";
  ticks(g, 1199);
  assert.equal(g.player.standData.lastFate, undefined);
  ticks(g, 1);
  const id = g.player.standData.id,
    serial = g.player.standData.serial,
    last = g.player.standData.lastFate;
  assert.ok(STANDS[id]);
  assert.equal(last.serial, 1);
  assert.equal(last.outcome, "stand");
  const saved = unpack(
    pack({ player: g.player, palm: g.world.palm, tick: g.tickCount }),
  );
  g.player = createPlayer(g.spawn, saved.player);
  g.world.palm = saved.palm;
  ticks(g, 1800);
  assert.equal(g.player.standData.id, id);
  assert.equal(g.player.standData.serial, serial);
  assert.deepEqual(g.player.standData.lastFate, last);
  assert.equal(g.messages.filter((m) => m.startsWith("YOUR STAND")).length, 1);
});
test("early escape and natural death cause no fate roll or pity increment; a later entry receives a new attempt identity", () => {
  const g = game("survival");
  ticks(g, 900);
  g.player.x = 200;
  ticks(g, 1);
  assert.equal(g.player.standData.trial, null);
  assert.equal(g.player.standData.lastFate, undefined);
  assert.equal(g.player.standData.failures, 0);
  g.player.x = 0;
  ticks(g, 1);
  assert.equal(g.player.standData.serial, 2);
  g.player.health = 0;
  ticks(g, 1);
  assert.equal(g.player.standData.trial, null);
  assert.equal(g.player.standData.lastFate, undefined);
});
test("all three outcomes execute once; death uses the damage callback and Creative is protected by default", () => {
  for (const mode of ["survival", "creative"])
    for (const outcome of ["stand", "death", "neutral"]) {
      const g = game(mode);
      g.world.palm.config.trialSeconds = 5;
      standRecord(g.player).forceOutcome = outcome;
      ticks(g, 100);
      assert.equal(g.player.standData.lastFate.outcome, outcome);
      assert.equal(
        g.player.health <= 0,
        mode === "survival" && outcome === "death",
      );
      if (outcome !== "stand") assert.equal(g.player.standData.failures, 1);
      const ledger = JSON.stringify(g.player.standData.lastFate);
      ticks(g, 10);
      assert.equal(JSON.stringify(g.player.standData.lastFate), ledger);
    }
});
test("an existing Stand does not reroll; explicit replacement works and lowering count cannot cancel another active trial", () => {
  const g = game();
  grant(g, "tusk");
  ticks(g, 1500);
  assert.equal(g.player.standData.serial, 0);
  configurePalm(g, { allowReplacement: true, trialSeconds: 5 });
  g.player.standData.forceOutcome = "stand";
  g.player.standData.forceStand = "d4c";
  ticks(g, 100);
  assert.equal(g.player.standData.id, "d4c");
  g.player.standData.trial = null;
  g.player.x = 300;
  ticks(g, 1);
  g.player.x = 0;
  ticks(g, 1);
  assert.equal(g.player.standData.trial.phase, "trial");
  configurePalm(g, { allowReplacement: false });
  ticks(g, 1);
  assert.equal(g.player.standData.trial, null);
});
test("corpse rewards are rare configurable persistent unique grants; their energy benefit cannot stack", () => {
  const g = game();
  g.world.palm.config = {
    ...g.world.palm.config,
    corpseChance: 100,
    trialSeconds: 5,
  };
  standRecord(g.player).forceOutcome = "stand";
  ticks(g, 100);
  assert.equal(
    g.inventory.slots.filter((s) => s?.id === "saint_corpse_part").length,
    1,
  );
  assert.equal(standMaxEnergy(g), 110);
  for (let i = 0; i < 5; i++) resolvePalmTrial(g, g.world.palm.sites[0]);
  assert.equal(
    g.inventory.slots.filter((s) => s?.id === "saint_corpse_part").length,
    1,
  );
  g.inventory.add({ id: "saint_corpse_part", count: 1 });
  assert.equal(standMaxEnergy(g), 110);
});
test("multiple players have independent authoritative trials and relocation waits for every participant", () => {
  const g = game();
  g.world.palm.config.trialSeconds = 5;
  const peer = {
    player: createPlayer({ x: 2, y: 81, z: 2 }),
    inventory: new Inventory(),
    standIdentity: "peer",
    ui: { toast() {}, announce() {} },
    audio: { standSound() {} },
    save: g.save,
  };
  Object.setPrototypeOf(peer, g);
  g.multiplayer = {
    connected: true,
    isGuest: false,
    peers: new Map([["one", { player: peer.player, context: peer }]]),
  };
  standRecord(g.player).forceOutcome = "stand";
  standRecord(peer.player).forceOutcome = "neutral";
  ticks(g, 50);
  assert.equal(relocatePalm(g), false);
  ticks(g, 50);
  assert.equal(g.player.standData.lastFate.outcome, "stand");
  assert.equal(peer.player.standData.lastFate.outcome, "neutral");
  assert.notEqual(g.player.standData.soul, peer.player.standData.soul);
});
test("relocation preserves edited formations as harmless ruins, leaves edit data intact, and refuses protected destinations", () => {
  const g = game();
  g.world.palm.config.rarity = 1;
  g.player.x = 10000;
  g.player.z = 10000;
  g.world.set(3, 81, 3, B.planks);
  const edits = JSON.stringify([...g.world.edits]);
  assert.equal(relocatePalm(g), true);
  assert.equal(g.world.palm.sites[0].phase, "ruin");
  assert.equal(JSON.stringify([...g.world.edits]), edits);
  assert.equal(g.world.get(3, 81, 3), B.planks);
  assert.equal(
    g.world.palm.sites.filter((s) => s.phase === "active").length,
    1,
  );
  g.world.protectedAreas = [{ x: 0, z: 0, radius: 100000 }];
  assert.equal(relocatePalm(g), false);
});
test("actual Palm blocks are deterministic across chunk order and reload; edits override fingers and chambers do not replenish loot", () => {
  const state = {
    version: 1,
    revision: 1,
    sites: [
      {
        id: "palm:1",
        serial: 1,
        x: 0,
        y: 90,
        z: 0,
        angle: 0,
        seed: 1,
        phase: "active",
      },
    ],
    config: palmConfig({ rarity: 0 }),
  };
  const a = new World("Palm terrain"),
    b = new World("Palm terrain");
  a.palm = structuredClone(state);
  b.palm = structuredClone(state);
  const chunks = [
    [0, 0],
    [-1, -4],
    [1, 0],
    [-2, -3],
    [0, -4],
  ];
  for (const [x, z] of chunks) a.ensure(x, z);
  for (const [x, z] of [...chunks].reverse()) b.ensure(x, z);
  for (const [x, z] of chunks)
    assert.deepEqual(a.ensure(x, z).data, b.ensure(x, z).data);
  const middle = palmColumn(state.sites[0], -5, -60, 80, a.seedInt);
  assert.ok(middle.h > 125);
  assert.ok(a.get(-5, middle.h, -60) !== B.air);
  a.set(-5, middle.h, -60, B.gold_block);
  const saved = JSON.parse(
    JSON.stringify({
      palm: a.palm,
      edits: a.exportEdits(),
      containers: a.containers,
    }),
  );
  const c = new World("Palm terrain", saved.edits);
  c.palm = saved.palm;
  c.containers = saved.containers;
  assert.equal(c.get(-5, middle.h, -60), B.gold_block);
  c.get(16, 77, 8);
  const chest = c.containers["16,77,8"];
  assert.ok(chest);
  chest.slots.fill(null);
  c.chunks.clear();
  c.get(16, 77, 8);
  assert.ok(chest.slots.every((s) => !s));
});
test("development-only controls refuse production and guest commands, while personal keys preserve movement and R", () => {
  const g = game();
  g.devStands = false;
  assert.throws(() => palmDev(g, ["outcome", "stand"]), /disabled/);
  g.devStands = true;
  g.multiplayer = { isGuest: true };
  assert.throws(() => palmDev(g, ["outcome", "stand"]), /disabled/);
  assert.deepEqual(standBindings(), STAND_KEYS);
  const k = standBindings({
    summon: "KeyW",
    primary: "KeyR",
    secondary: "KeyH",
    info: "KeyH",
  });
  assert.equal(new Set(Object.values(k)).size, 4);
  assert.ok(!Object.values(k).includes("KeyW"));
  assert.ok(!Object.values(k).includes("KeyR"));
});
test("Tusk nails hit hostile targets, stop at blocks, consume energy and reject cooldown spam", () => {
  const g = game();
  g.player.y = 0;
  grant(g, "tusk");
  g.entities = [
    {
      id: "z",
      type: "zombie",
      x: 0.5,
      y: 0,
      z: -5,
      hp: 20,
      vx: 0,
      vy: 0,
      vz: 0,
    },
  ];
  assert.equal(activateStand(g, "primary", damageEntity), true);
  assert.equal(g.player.standData.energy, 88);
  assert.equal(activateStand(g, "primary", damageEntity), false);
  for (let i = 0; i < 10; i++) tickStandProjectiles(g, damageEntity);
  assert.equal(g.entities[0].hp, 14);
  assert.equal(g.standProjectiles.length, 0);
  g.tickCount = 20;
  g.world.set(0, 1, -3, B.stone);
  assert.equal(activateStand(g, "primary", damageEntity), true);
  for (let i = 0; i < 10; i++) tickStandProjectiles(g, damageEntity);
  assert.equal(g.entities[0].hp, 14);
});
test("rope retrieves items exactly once and traversal follows a collision-tested path rather than passing through walls", () => {
  const g = game();
  g.player.y = 0;
  grant(g, "lonesome");
  g.drops = [{ id: "diamond", count: 3, x: 0.5, y: 1, z: -7 }];
  assert.equal(activateStand(g, "primary", damageEntity), true);
  assert.equal(g.drops[0].count, 0);
  assert.equal(g.inventory.slots[0].count, 3);
  g.tickCount = 100;
  assert.equal(activateStand(g, "primary", damageEntity), false);
  assert.equal(g.inventory.slots[0].count, 3);
  for (let y = 0; y < 3; y++) g.world.set(0, y, -8, B.stone);
  assert.equal(activateStand(g, "secondary", damageEntity), true);
  assert.ok(g.player.z > -7.7 && g.player.z < -0.5);
  assert.equal(collides(g.world, g.player), false);
});
test("Scary Monsters changes actual movement/collision and melee damage, then restores safely", () => {
  const g = game();
  g.player.y = 0;
  g.player.onGround = true;
  grant(g, "monsters");
  assert.equal(activateStand(g, "primary", damageEntity), true);
  assert.equal(g.player.standData.transformed, true);
  const human = game();
  human.player.y = 0;
  human.player.onGround = true;
  updatePlayer(g, new Set(["KeyW"]), 1 / 60);
  updatePlayer(human, new Set(["KeyW"]), 1 / 60);
  assert.ok(Math.abs(g.player.vz / human.player.vz - 1.35) < 0.001);
  g.tickCount = 301;
  tickStand(g);
  assert.equal(g.player.standData.transformed, false);
});
test("Cream Starter heals without over-healing or spending energy on invalid targets; D4C cannot cross walls/protection", () => {
  const g = game();
  g.player.y = 0;
  grant(g, "cream");
  g.player.health = 18;
  assert.equal(activateStand(g, "primary", damageEntity), true);
  assert.equal(g.player.health, 20);
  const energy = g.player.standData.energy;
  g.tickCount = 200;
  assert.equal(activateStand(g, "primary", damageEntity), false);
  assert.equal(g.player.standData.energy, energy);
  grant(g, "d4c");
  for (let y = 0; y < 3; y++)
    for (let x = -1; x <= 1; x++) g.world.set(x, y, -3, B.stone);
  assert.equal(activateStand(g, "primary", damageEntity), true);
  assert.ok(g.player.z > -2.6);
  assert.equal(collides(g.world, g.player), false);
  assert.equal(activateStand(g, "secondary", damageEntity), true);
  assert.ok(Math.abs(g.player.z - 0.5) < 0.01);
  g.world.protectedAreas = [{ x: 0.5, z: 0.5, radius: 5 }];
  g.tickCount = 1000;
  assert.equal(activateStand(g, "primary", damageEntity), false);
});
test("Stand models are distinct, finite, articulated and bounded; repeated summon/dismiss releases owned geometry", () => {
  createDinosaurModel().traverse((o) => {
    if (o.material) {
      assert.equal(o.material.opacity, 1);
      assert.equal(o.material.transparent, false);
    }
  });
  const scene = new THREE.Scene(),
    renderer = {
      scene,
      disposeObject(m) {
        scene.remove(m);
        m.traverse((o) => {
          o.geometry?.dispose();
          o.material?.dispose();
        });
      },
    };
  const visual = new StandVisuals(renderer),
    base = scene.children.length,
    g = game();
  g.renderer = renderer;
  g.settings = { particles: "all" };
  g.active = true;
  g.cameraMode = 2;
  const signatures = [];
  for (const id of Object.keys(STANDS)) {
    const m = createStandModel(id);
    let count = 0;
    animateStandModel(m, 1, 0.8);
    m.updateMatrixWorld(true);
    m.traverse((o) => {
      assert.ok(o.matrixWorld.elements.every(Number.isFinite));
      if (o.isMesh) {
        count++;
        assert.ok(o.geometry.attributes.position.array.every(Number.isFinite));
      }
    });
    assert.ok(count <= 8);
    signatures.push(
      JSON.stringify(
        new THREE.Box3()
          .setFromObject(m)
          .getSize(new THREE.Vector3())
          .toArray(),
      ),
    );
  }
  assert.equal(new Set(signatures).size, 5);
  for (let i = 0; i < 40; i++) {
    grant(g, Object.keys(STANDS)[i % 5]);
    visual.sync(g, 0.05);
    g.player.standData.summoned = false;
    visual.sync(g, 0.05);
    assert.equal(visual.entries.size, 0);
    assert.equal(scene.children.length, base);
  }
  assert.equal(visual.nails.count, 0);
  grant(g, "tusk");
  visual.sync(g, 0.05);
  assert.equal(visual.entries.size, 1);
  visual.trialFade = 1;
  g.active = false;
  visual.sync(g, 0);
  assert.equal(visual.entries.size, 0);
  assert.equal(visual.trialFade, 0);
  assert.equal(visual.trial, null);
  assert.equal(scene.children.length, base);
  assert.equal(visual.rifts.count, 0);
  assert.ok(createCorpseModel().userData.artifactModel);
});

test("untouched real Palm terrain returns to the original seeded chunks after relocation; offline occupants preserve ruins", () => {
  const g = game();
  g.world = new World("Wildflower");
  g.spawn = g.world.findSpawn();
  g.player = createPlayer({ x: 10000, y: 100, z: 10000 });
  const state = ensurePalm(g.world);
  state.config = palmConfig({ rarity: 1 });
  state.sites = [
    {
      id: "palm:1",
      serial: 1,
      x: 0,
      y: 90,
      z: 0,
      angle: 0,
      seed: 1,
      phase: "active",
    },
  ];
  state.serial = 1;
  const base = new World("Wildflower"),
    col = palmColumn(
      state.sites[0],
      -5,
      -60,
      base.terrain(-5, -60).h,
      g.world.seedInt,
    );
  assert.notEqual(g.world.get(-5, col.h, -60), base.get(-5, col.h, -60));
  let moved = false;
  for (let n = 0; n < 50 && !moved; n++) moved = relocatePalm(g);
  assert.equal(moved, true);
  assert.equal(
    g.world.palm.sites.some((s) => s.id === "palm:1"),
    false,
  );
  assert.equal(g.world.get(-5, col.h, -60), base.get(-5, col.h, -60));
  const h = game();
  h.player.x = 10000;
  h.player.z = 10000;
  h.world.palm.config.rarity = 1;
  h.multiplayer = {
    connected: false,
    isGuest: false,
    savedPlayers: { abc: { player: { x: 0, y: 81, z: 0 } } },
  };
  assert.equal(relocatePalm(h), true);
  assert.equal(h.world.palm.sites.find((s) => s.id === "palm:1").phase, "ruin");
});
test("restoring a saved partial trial preserves its attempt and outcomes; disconnect cancellation never creates a completed roll", () => {
  const g = game();
  g.world.palm.config.trialSeconds = 5;
  ticks(g, 45);
  const saved = unpack(pack({ player: g.player, palm: g.world.palm }));
  g.player = createPlayer(g.spawn, saved.player);
  g.world.palm = saved.palm;
  g.player.standData.forceOutcome = "neutral";
  ticks(g, 55);
  assert.equal(g.player.standData.lastFate.serial, 1);
  assert.equal(g.player.standData.failures, 1);
  const h = game();
  ticks(h, 300);
  h.player.standData.trial = null;
  h.player.x = 200;
  ticks(h, 20);
  assert.equal(h.player.standData.lastFate, undefined);
  assert.equal(h.player.standData.failures, 0);
});
test("secondary healing and roar affect valid visible targets, and level upgrades really increase maximum energy", () => {
  const g = game();
  g.player.y = 0;
  grant(g, "cream");
  const friend = createPlayer({ x: 1, y: 0, z: -1 });
  friend.health = 12;
  g.standFriends = () => [g.player, friend];
  assert.equal(activateStand(g, "secondary", damageEntity), true);
  assert.equal(friend.health, 16);
  grant(g, "monsters");
  g.entities = [
    {
      id: "enemy",
      type: "zombie",
      x: 1,
      y: 0,
      z: -1,
      hp: 20,
      vx: 0,
      vy: 0,
      vz: 0,
    },
  ];
  assert.equal(activateStand(g, "secondary", damageEntity), true);
  assert.equal(g.entities[0].hp, 15);
  g.player.standData.xp = 19;
  g.player.standData.cooldowns = {};
  g.player.standData.energy = 100;
  activateStand(g, "secondary", damageEntity);
  assert.equal(g.player.standData.level, 2);
  assert.equal(standMaxEnergy(g), 105);
});
test("awkward transformation expiry never restores a tall body into a ceiling or changes unrelated player motion", () => {
  const g = game();
  g.player.y = 0.6;
  grant(g, "monsters");
  g.player.standData.transformed = true;
  g.player.standData.transformUntil = 1;
  g.world.set(0, 2, 0, B.stone);
  g.tickCount = 2;
  tickStand(g);
  assert.equal(g.player.standData.transformed, true);
  assert.equal(g.player.standData.returnBlocked, true);
  g.world.set(0, 2, 0, B.air);
  g.tickCount = 20;
  tickStand(g);
  assert.equal(g.player.standData.transformed, false);
});

test("transformation increases actual melee damage and damaged imported config safely returns to valid defaults", () => {
  const normal = game();
  normal.player.y = 0;
  normal.player.onGround = true;
  const target = {
    id: "z",
    type: "zombie",
    hp: 30,
    x: 0.5,
    y: 0,
    z: -2,
    vx: 0,
    vy: 0,
    vz: 0,
  };
  const first = hitEntity(normal, target);
  const transformed = game();
  transformed.player.y = 0;
  transformed.player.onGround = true;
  grant(transformed, "monsters");
  transformed.player.standData.transformed = true;
  const second = hitEntity(transformed, { ...target, hp: 30 });
  assert.ok(second > first);
  assert.equal(second, 2);
  assert.deepEqual(palmConfig(null), palmConfig());
  assert.deepEqual(standBindings(null), STAND_KEYS);
  const player = {
    standData: { id: "bad-id", energy: NaN, level: Infinity, xp: -4 },
  };
  assert.equal(standRecord(player).id, null);
  assert.equal(player.standData.energy, 100);
  assert.equal(player.standData.level, 1);
});
