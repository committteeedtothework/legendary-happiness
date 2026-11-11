import test from "node:test";
import assert from "node:assert/strict";
import { World, index } from "../src/world.js";
import {
  B,
  BLOCKS,
  ITEMS,
  MOB_INFO,
  RECIPES,
  SPAWN_EGG_TYPES,
  CREATIVE_ITEMS,
  makeStack,
  DEFAULT_SETTINGS,
} from "../src/data.js";
import {
  deepCaveNode,
  CAVE_REGIONS,
  mineshaftSite,
} from "../src/cave-update.js";
import {
  caveDarkness,
  findCaveFloor,
  spawnCaveHostiles,
  spawnWatcher,
  tickWatcher,
  watcherSeen,
} from "../src/cave-life.js";
import { createEntity, damageEntity, dropItem } from "../src/simulation.js";
import { createPlayer, collides, updatePlayer } from "../src/physics.js";
import { Inventory } from "../src/inventory.js";
import { exportRealm, restoreRealm } from "../src/realms.js";
import { useSpawnEgg } from "../src/spawn-eggs.js";
import { hostileTarget } from "../src/defenders.js";
import { AmbientDSP } from "../src/soundscape.js";
import { voiceSamples } from "../src/voices.js";
import { meshChunk } from "../src/mesher.js";
function chamber() {
  const world = new World("Cave laboratory");
  for (let x = -38; x <= 38; x++)
    for (let z = -38; z <= 38; z++) {
      world.set(x, -1, z, B.stone);
      world.set(x, 6, z, B.stone);
      for (let y = 0; y < 6; y++) world.set(x, y, z, B.air);
    }
  const calls = [];
  return {
    world,
    dimension: "overworld",
    player: createPlayer({ x: 0.5, y: 0, z: 0.5 }),
    inventory: new Inventory(),
    entities: [],
    drops: [],
    mode: "survival",
    difficulty: "normal",
    time: 6000,
    tickCount: 100,
    elapsed: 1,
    settings: { ...DEFAULT_SETTINGS, renderDistance: 2 },
    running: true,
    ui: { toast() {}, updateHotbar() {}, updateHUD() {} },
    audio: {
      tone() {},
      voice(...a) {
        calls.push(a);
      },
    },
    damage(n) {
      this.player.health -= n;
    },
    calls,
  };
}
test("new caves have four seeded regions, upper/lower connected voids, unchanged bedrock and reproducible negative borders", () => {
  const types = new Set(),
    w = new World("Wildflower");
  for (let rz = -5; rz <= 5; rz++)
    for (let rx = -5; rx <= 5; rx++)
      for (let l = 0; l < 2; l++) {
        const a = deepCaveNode(rx, rz, l, w.seedInt);
        types.add(a.type);
        assert.deepEqual(a, deepCaveNode(rx, rz, l, w.seedInt));
        assert.ok(a.y > -60 && a.y < 40);
      }
  assert.deepEqual([...types].sort(), [...CAVE_REGIONS].sort());
  const a = new World("Wildflower"),
    b = new World("Wildflower"),
    coords = [
      [-1, -1],
      [0, -1],
      [-1, 0],
      [0, 0],
      [3, 2],
    ];
  coords.forEach(([x, z]) => a.ensure(x, z));
  coords.toReversed().forEach(([x, z]) => b.ensure(x, z));
  for (const [x, z] of coords) {
    assert.deepEqual(a.ensure(x, z).data, b.ensure(x, z).data);
    for (let i = 0; i < 256; i++)
      assert.equal(a.ensure(x, z).data[i], B.bedrock);
  }
  const n = deepCaveNode(0, 0, 0, w.seedInt);
  assert.equal(w.get(n.x, n.y, n.z), B.air);
});
test("mineshafts naturally vary by seed/cell and have traversable rails, timber frames, webs and real loot containers", () => {
  const w = new World("Wildflower"),
    s = mineshaftSite(w, 0, 0);
  assert.ok(s);
  let missing = false;
  for (let i = -5; i <= 5; i++) if (!mineshaftSite(w, i, 2)) missing = true;
  assert.ok(missing);
  for (
    let z = Math.floor((s.z - 30) / 16);
    z <= Math.floor((s.z + 30) / 16);
    z++
  )
    for (
      let x = Math.floor((s.x - 32) / 16);
      x <= Math.floor((s.x + 32) / 16);
      x++
    )
      w.ensure(x, z);
  assert.equal(w.get(s.x + 7, s.y - 1, s.z), B.planks);
  assert.equal(w.get(s.x + 7, s.y, s.z), B.mine_rail);
  assert.equal(w.get(s.x - 26, s.y + 1, s.z + 2), B.log);
  assert.ok(!collides(w, { x: s.x + 7.5, y: s.y, z: s.z + 0.5 }, 1.8, 0.6));
  const boxes = Object.entries(w.containers).filter(
    ([, c]) => c.mineshaft === s.id,
  );
  assert.equal(boxes.length, 2);
  assert.ok(
    boxes.every(([, c]) => c.slots.some((i) => i?.id === "iron_ingot")),
  );
  let webs = 0;
  for (let x = -28; x <= 28; x++)
    for (let z = -22; z <= 22; z++)
      if (w.get(s.x + x, s.y + 2, s.z + z) === B.cobweb) webs++;
  assert.ok(webs > 0);
});
test("emptied and broken mineshaft chests never refill after chunk regeneration or realm reload", () => {
  const w = new World("Wildflower"),
    s = mineshaftSite(w, 0, 0),
    x = s.x + 12,
    z = s.z + 1,
    key = `${x},${s.y},${z}`;
  w.get(x, s.y, z);
  w.containers[key].slots.fill(null);
  w.chunks.clear();
  w.get(x, s.y, z);
  assert.ok(w.containers[key].slots.every((v) => v === null));
  const saved = JSON.parse(
      JSON.stringify(exportRealm({ world: w, entities: [], drops: [] })),
    ),
    h = restoreRealm(w.seed, "overworld", saved).world;
  h.get(x, s.y, z);
  assert.ok(h.containers[key].slots.every((v) => v === null));
  h.set(x, s.y, z, B.air);
  delete h.containers[key];
  h.chunks.clear();
  assert.equal(h.get(x, s.y, z), B.air);
  assert.equal(h.containers[key], undefined);
});
test("diamond veins are much scarcer than the prior scattered ores and remain in the deep placement range", () => {
  const now = new World("Wildflower"),
    old = new World("Wildflower", {}, "overworld", 11);
  let newer = 0,
    older = 0,
    iron = 0;
  for (let z = -2; z <= 2; z++)
    for (let x = -2; x <= 2; x++) {
      const a = now.ensure(x, z).data,
        b = old.ensure(x, z).data;
      for (let i = 0; i < a.length; i++) {
        if ([B.diamond_ore, B.deepslate_diamond_ore].includes(a[i])) {
          newer++;
          const y = Math.floor(i / 256) - 64;
          assert.ok(y >= -56 && y <= 8);
        }
        if ([B.iron_ore, B.deepslate_iron_ore].includes(a[i])) iron++;
        if (b[i] === B.diamond_ore) older++;
      }
    }
  assert.ok(
    newer > 20 && newer < older * 0.12,
    JSON.stringify({ newer, older }),
  );
  assert.ok(iron > newer * 3);
});
test("cave darkness requires a roof and responds immediately to placed/removed torch light", () => {
  const g = chamber();
  assert.equal(caveDarkness(g.world, g.player), true);
  g.world.set(3, 0, 0, B.torch);
  assert.equal(caveDarkness(g.world, g.player), false);
  g.world.set(3, 0, 0, B.air);
  assert.equal(caveDarkness(g.world, g.player), true);
  assert.equal(caveDarkness(g.world, { x: 0, y: 300, z: 0 }), false);
});
test("all four ordinary nighttime hostiles can spawn in daytime caves with clear bodies outside the player exclusion radius", () => {
  const g = chamber(),
    types = new Set();
  for (let i = 1; i <= 4; i++) {
    g.tickCount = i * 100;
    spawnCaveHostiles(g, createEntity);
  }
  for (const e of g.entities) {
    types.add(e.type);
    assert.ok(e.caveSpawn);
    assert.ok(
      Math.hypot(e.x - g.player.x, e.y - g.player.y, e.z - g.player.z) >= 24,
    );
    assert.equal(
      collides(g.world, e, MOB_INFO[e.type].height, MOB_INFO[e.type].width),
      false,
    );
  }
  assert.deepEqual([...types].sort(), [
    "creeper",
    "skeleton",
    "spider",
    "zombie",
  ]);
});
test("cave spawns respect Creative, Peaceful, light, loaded space and actual body clearance", () => {
  const g = chamber();
  g.mode = "creative";
  spawnCaveHostiles(g, createEntity);
  assert.equal(g.entities.length, 0);
  g.mode = "survival";
  g.difficulty = "peaceful";
  spawnCaveHostiles(g, createEntity);
  assert.equal(g.entities.length, 0);
  g.difficulty = "normal";
  assert.equal(findCaveFloor(g.world, 99999, 99999, 0), null);
  g.world.set(2, 0, 0, B.torch);
  spawnCaveHostiles(g, createEntity);
  assert.ok(
    g.entities.length > 0,
    "a lit player area must not suppress distant dark cave spawns",
  );
  assert.ok(g.entities.every((e) => Math.hypot(e.x - 2, e.y, e.z) >= 9));
  g.entities = [];
  for (let x = -36; x <= 36; x += 8)
    for (let z = -36; z <= 36; z += 8) g.world.set(x, 0, z, B.torch);
  spawnCaveHostiles(g, createEntity);
  assert.equal(g.entities.length, 0);
  g.world.set(2, 0, 0, B.air);
  for (let y = 0; y < 6; y++) g.world.set(8, y, 0, B.stone);
  assert.equal(findCaveFloor(g.world, 8, 0, 0, "watcher"), null);
});
test("daytime spiders chase inside dark caves but retain daytime neutrality on the surface", () => {
  const g = chamber(),
    e = { type: "spider", x: 0.5, y: 0, z: -4, hp: 20 };
  g.entities = [e];
  assert.equal(hostileTarget(g, e), g.player);
  e.y = 300;
  assert.equal(hostileTarget(g, e), null);
});
test("Watcher rejects melee, bullets and environmental damage without knockback, XP, drops or player damage", () => {
  const g = chamber(),
    e = createEntity(g, "watcher", 0, -25);
  Object.assign(e, { y: 0 });
  g.entities = [e];
  const before = { x: e.x, y: e.y, z: e.z, hp: e.hp };
  for (const kind of ["melee", "bullet", "explosion", "fire"])
    assert.equal(damageEntity(g, e, 1e9, { kind }), 0);
  assert.deepEqual({ x: e.x, y: e.y, z: e.z, hp: e.hp }, before);
  assert.equal(g.player.xp, 0);
  assert.equal(g.drops.length, 0);
  for (let i = 0; i < 20; i++) {
    g.tickCount++;
    tickWatcher(g, e);
  }
  assert.equal(g.player.health, 20);
  assert.equal(e.attack, 0);
});
test("Watcher stares and laughs once on discovery, stalks only out of view, and cover prevents detection", () => {
  const g = chamber(),
    e = createEntity(g, "watcher", 0, -25);
  Object.assign(e, { y: 0, creativeSpawn: true });
  g.entities = [e];
  assert.equal(watcherSeen(g.player, e, 0, g.world), true);
  const z = e.z;
  tickWatcher(g, e);
  assert.equal(g.calls.length, 1);
  assert.equal(e.z, z);
  for (let i = 0; i < 30; i++) {
    g.tickCount++;
    tickWatcher(g, e);
  }
  assert.equal(g.calls.length, 1);
  g.player.yaw = Math.PI;
  g.tickCount++;
  tickWatcher(g, e);
  assert.ok(e.z > z);
  g.player.yaw = 0;
  g.world.set(0, 1, -10, B.stone);
  g.world.set(0, 2, -10, B.stone);
  assert.equal(watcherSeen(g.player, e, 0, g.world), false);
});
test("rare natural Watcher appearances are seeded, single, saved and excluded from surface/Creative", () => {
  const g = chamber();
  for (let i = 0; i < 120 && !g.entities.length; i++) {
    g.tickCount += 200;
    spawnWatcher(g, createEntity);
  }
  assert.equal(g.entities.length, 1);
  assert.equal(g.entities[0].type, "watcher");
  assert.ok(g.entities[0].persistent);
  for (let i = 0; i < 30; i++) {
    g.tickCount += 200;
    spawnWatcher(g, createEntity);
  }
  assert.equal(g.entities.length, 1);
  const saved = JSON.parse(
      JSON.stringify(
        exportRealm({ world: g.world, entities: g.entities, drops: [] }),
      ),
    ),
    loaded = restoreRealm(g.world.seed, "overworld", saved);
  assert.equal(loaded.entities[0].hp, 1000);
  assert.deepEqual(
    loaded.world.settlements["cave-watcher"],
    g.world.settlements["cave-watcher"],
  );
  g.entities = [];
  g.mode = "creative";
  g.tickCount += 10000;
  spawnWatcher(g, createEntity);
  assert.equal(g.entities.length, 0);
});
test("natural Watcher retreats from light or close approach without death loot", () => {
  const g = chamber(),
    e = createEntity(g, "watcher", 0, -25);
  e.y = 0;
  g.world.set(2, 0, -24, B.torch);
  tickWatcher(g, e);
  assert.equal(e.hp, 0);
  assert.equal(g.drops.length, 0);
  assert.equal(g.player.xp, 0);
});
test("Creative catalog includes hostile/passive spawn eggs with no Survival recipes or drops", () => {
  for (const type of SPAWN_EGG_TYPES) {
    const id = `${type}_spawn_egg`;
    assert.ok(CREATIVE_ITEMS.includes(id));
    assert.equal(ITEMS[id].creativeOnly, true);
    assert.equal(ITEMS[id].spawnType, type);
    assert.equal(
      RECIPES.some((r) => r.result === id),
      false,
    );
  }
  assert.ok(
    SPAWN_EGG_TYPES.includes("zombie") && SPAWN_EGG_TYPES.includes("cow"),
  );
  const g = chamber();
  g.inventory.slots[0] = makeStack("cow_spawn_egg", 64);
  useSpawnEgg(g);
  assert.equal(g.entities.length, 0);
  dropItem(g, g.inventory.held, 0, 0, 0);
  assert.equal(g.drops.length, 0);
});
test("every Creative spawn egg creates its actual creature with clear collision and never consumes the egg", () => {
  const g = chamber();
  g.mode = "creative";
  Object.assign(g.player, { x: 4.5, z: 0.5 });
  g.target = { x: 8, y: -1, z: 0, id: B.stone, normal: { x: 0, y: 1, z: 0 } };
  for (const type of SPAWN_EGG_TYPES) {
    g.entities = [];
    g.inventory.slots[0] = makeStack(`${type}_spawn_egg`, 64);
    assert.equal(useSpawnEgg(g), true);
    assert.equal(g.entities.length, 1, type);
    assert.equal(g.entities[0].type, type);
    assert.equal(g.inventory.held.count, 64);
    assert.equal(
      collides(
        g.world,
        g.entities[0],
        MOB_INFO[type].height,
        MOB_INFO[type].width,
      ),
      false,
    );
  }
});
test("egg placement rejects walls and occupied player space", () => {
  const g = chamber();
  g.mode = "creative";
  Object.assign(g.player, { x: 4.5, z: 0.5 });
  g.inventory.slots[0] = makeStack("zombie_spawn_egg");
  g.target = { x: 8, y: -1, z: 0, id: B.stone, normal: { x: 0, y: 1, z: 0 } };
  for (let y = 0; y < 6; y++) g.world.set(8, y, 0, B.stone);
  useSpawnEgg(g);
  assert.equal(g.entities.length, 0);
  for (let y = 0; y < 6; y++) g.world.set(8, y, 0, B.air);
  g.player.x = 8.5;
  useSpawnEgg(g);
  assert.equal(g.entities.length, 0);
});
test("cave/night soundscapes are finite, continuously stateful and independent of render-buffer boundaries", () => {
  const a = new AmbientDSP(42, 8000),
    b = new AmbientDSP(42, 8000),
    levels = { cave: 0.8, eerie: 0.3, rumble: 0.2, caveTone: 72 };
  a.set(levels);
  b.set(levels);
  const left = new Float32Array(8000),
    right = new Float32Array(8000);
  a.render(left, right);
  const chunks = [];
  for (let i = 0; i < 4; i++) {
    const l = new Float32Array(2000),
      r = new Float32Array(2000);
    b.render(l, r);
    chunks.push(...l);
  }
  assert.deepEqual(left, Float32Array.from(chunks));
  assert.ok(left.some((v) => Math.abs(v) > 0.001));
  assert.ok(left.every((v) => Number.isFinite(v) && Math.abs(v) <= 0.8));
  const next = new Float32Array(8000);
  a.render(next, new Float32Array(8000));
  assert.notDeepEqual(left, next);
  const laugh = voiceSamples("watcher", 8000);
  assert.ok(laugh.length > 8000 && laugh.every(Number.isFinite));
});
test("cobwebs actually slow movement and rails render as low non-colliding track panels", () => {
  const g = chamber();
  g.player.onGround = true;
  const start = g.player.z;
  for (let i = 0; i < 20; i++) updatePlayer(g, new Set(["KeyW"]), 1 / 60);
  const normal = Math.abs(g.player.z - start);
  Object.assign(g.player, {
    x: 0.5,
    y: 0,
    z: 0.5,
    vx: 0,
    vy: 0,
    vz: 0,
    onGround: true,
  });
  g.world.set(0, 0, 0, B.cobweb);
  for (let i = 0; i < 20; i++) updatePlayer(g, new Set(["KeyW"]), 1 / 60);
  assert.ok(Math.abs(g.player.z - 0.5) < normal * 0.5);
  const w = new World("rail"),
    c = w.ensure(0, 0);
  c.data.fill(0);
  c.maxY = 1;
  c.data[index(8, 0, 8)] = B.mine_rail;
  const groups = meshChunk(w, c),
    ys = groups
      .filter(Boolean)
      .flatMap((g) => Array.from(g.position).filter((v, i) => i % 3 === 1));
  assert.ok(Math.max(...ys) <= 0.041);
  assert.equal(BLOCKS[B.mine_rail].solid, false);
});

test("cave atmosphere darkens deep roofed chambers, preserves surface houses/open shafts and excludes Cinderworld", async () => {
  const { caveExposure } = await import("../src/daylight.js");
  const w = {
    dimension: "overworld",
    terrain: () => ({ h: 70 }),
    skyHeight: () => 70,
  };
  assert.equal(caveExposure(w, { x: 0, y: 10, z: 0 }), 1);
  assert.equal(caveExposure(w, { x: 0, y: 67, z: 0 }), 0);
  assert.equal(caveExposure(w, { x: 0, y: 60, z: 0 }), 0.5);
  w.skyHeight = () => 9;
  assert.equal(caveExposure(w, { x: 0, y: 10, z: 0 }), 0);
  w.dimension = "cinderwild";
  w.skyHeight = () => 90;
  assert.equal(caveExposure(w, { x: 0, y: 10, z: 0 }), 0);
});
