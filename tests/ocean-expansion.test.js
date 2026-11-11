import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { World } from "../src/world.js";
import {
  B,
  BLOCKS,
  ITEMS,
  RECIPES,
  GENERATION_VERSION,
  MOB_INFO,
  CREATIVE_ITEMS,
} from "../src/data.js";
import {
  continentAt,
  continentalTerrain,
  expeditionCinderBase,
} from "../src/expedition-terrain.js";
import { villageAt, villageSpacing } from "../src/villages.js";
import {
  infernalSite,
  infernalSpacing,
  infernalGuards,
} from "../src/infernal-world.js";
import { siteOffset } from "../src/expedition-structures.js";
import { populateEncounters } from "../src/encounters.js";
import {
  openInfernalVault,
  infernalLootBlocked,
} from "../src/infernal-encounters.js";
import { Inventory, matchRecipe } from "../src/inventory.js";
import { createPlayer, updatePlayer, collides } from "../src/physics.js";
import { useBoat, updateRidingBoat, tickBoats } from "../src/boats.js";
import { damageEntity, createEntity } from "../src/simulation.js";
import { exportRealm, restoreRealm } from "../src/realms.js";
import {
  spawnFliers,
  tickFlier,
  deflectFireball,
} from "../src/cinder-flight.js";
import { tickHostileProjectiles } from "../src/hostile-combat.js";
import {
  biomeWeatherProfile,
  tickWeather,
  precipitation,
  setWeather,
} from "../src/weather.js";
import { createMobModel } from "../src/models.js";
import { mockCanvas } from "./helpers/mock-canvas.js";
import { modelFingerprint } from "./helpers/model-fingerprint.js";
import { isFlatItem } from "../src/item-shapes.js";

const quiet = { toast() {}, updateHotbar() {}, updateHUD() {}, announce() {} };
function game(world = new World("Wildflower")) {
  const p = createPlayer({ x: 0.5, y: 64, z: 3.5 });
  return {
    world,
    dimension: world.dimension,
    player: p,
    mode: "survival",
    difficulty: "normal",
    inventory: new Inventory(),
    entities: [],
    drops: [],
    hostileProjectiles: [],
    tickCount: 0,
    time: 6000,
    elapsed: 0,
    settings: { renderDistance: 2 },
    ui: quiet,
    audio: { tone() {}, voice() {} },
    renderer: { action() {}, combatImpact() {}, explosionEffect() {} },
    damage(n) {
      p.health -= n;
    },
  };
}
function waterGame() {
  const g = game();
  g.world.get = (x, y, z) => {
    x = Math.floor(x);
    y = Math.floor(y);
    z = Math.floor(z);
    return x >= 6 && y >= 61 && y <= 70
      ? B.stone
      : y < 61
        ? B.stone
        : y <= 62
          ? B.water
          : B.air;
  };
  g.world.solid = (x, y, z) => BLOCKS[g.world.get(x, y, z)].solid;
  g.world.skyHeight = () => 62;
  return g;
}
function look(g, t) {
  const p = g.player,
    dx = t.x - p.x,
    dz = t.z - p.z;
  p.yaw = Math.atan2(-dx, -dz);
  p.pitch = Math.atan2(t.y - p.y - 1.62, Math.hypot(dx, dz));
}

test("generator 13 makes separated continents, deep seas and all broad climate regions deterministically", () => {
  assert.ok(GENERATION_VERSION >= 13);
  const w = new World("Wildflower", {}, "overworld", 13),
    biomes = new Set();
  let ocean = 0,
    total = 0;
  for (let z = -8192; z <= 8192; z += 256)
    for (let x = -8192; x <= 8192; x += 256) {
      const t = w.baseTerrain(x, z);
      assert.deepEqual(t, continentalTerrain(x, z, w.seedInt));
      biomes.add(t.biome);
      ocean += t.h < 62;
      total++;
    }
  assert.ok(ocean / total > 0.55 && ocean / total < 0.9);
  assert.equal(biomes.size, 13);
  let wetRiver = 0;
  for (let z = -1000; z <= 1000; z += 16)
    for (let x = -1000; x <= 1000; x += 16) {
      const t = w.baseTerrain(x, z);
      if (t.land > 0.99 && t.river < 0.001) {
        assert.ok(t.h < 62, "river cores must fill below sea level");
        wetRiver++;
      }
    }
  assert.ok(wetRiver > 0);
  for (let n = -2; n <= 2; n++)
    for (let z = -2000; z <= 2000; z += 128)
      assert.ok(
        w.baseTerrain(n * 4096 + 2048, z).h < 50,
        "continuous deep crossing between continental cells",
      );
  for (const seed of ["Wildflower", "Oceans", "winter", "a", "12345"]) {
    const a = new World(seed),
      p = a.findSpawn();
    assert.ok(a.solid(p.x, p.y - 0.1, p.z));
    assert.equal(collides(a, p), false);
  }
  assert.ok(continentAt(w.seedInt, 0, 0).radius >= 1280);
  let desertSpawns = 0;
  for (let i = 0; i < 100; i++) {
    const world = new World(`Spawn-${i}`),
      p = world.findSpawn();
    assert.equal(collides(world, p), false);
    assert.ok(world.solid(p.x, p.y - 0.1, p.z));
    if (world.terrain(p.x, p.z).biome === "desert") desertSpawns++;
  }
  assert.ok(desertSpawns > 0, "exercise the broad-desert spawn fallback");
});
test("villages and Cinderworld structures have a hard 1024-block minimum center separation", () => {
  for (const dimension of ["overworld", "cinderwild"]) {
    const w = new World("Wildflower", {}, dimension),
      sites = [];
    assert.equal(
      dimension === "overworld" ? villageSpacing(w) : infernalSpacing(w),
      1536,
    );
    for (let z = -4; z <= 4; z++)
      for (let x = -4; x <= 4; x++) {
        const s =
          dimension === "overworld"
            ? villageAt(w, x, z)
            : infernalSite(w, x, z);
        if (s) sites.push(s);
      }
    assert.ok(sites.length > 10);
    for (let i = 0; i < sites.length; i++)
      for (let j = i + 1; j < sites.length; j++)
        assert.ok(
          Math.hypot(sites[i].x - sites[j].x, sites[i].z - sites[j].z) >= 1024,
        );
    if (dimension === "cinderwild") {
      assert.equal(new Set(sites.map((s) => s.kind)).size, 3);
      assert.equal(new Set(sites.map((s) => s.rotation)).size, 4);
      assert.ok(new Set(sites.map((s) => s.variant)).size > 30);
    }
  }
});
test("new chunks remain order-independent on negative borders in both dimensions", () => {
  for (const d of ["overworld", "cinderwild"]) {
    const a = new World("Expedition borders", {}, d),
      b = new World(a.seed, {}, d),
      coords = [
        [-1, -1],
        [0, -1],
        [-1, 0],
        [0, 0],
      ];
    coords.forEach(([x, z]) => a.ensure(x, z));
    coords.toReversed().forEach(([x, z]) => b.ensure(x, z));
    for (const [key, c] of a.chunks)
      assert.deepEqual(c.data, b.chunks.get(key).data);
  }
});
test("rotated procedural vaults retain six collision-free guards, sealed loot, persistent rewards and varied buildings", () => {
  const hashes = new Set();
  for (const rotation of [0, 1, 2, 3]) {
    const w = new World("Wildflower", {}, "cinderwild");
    let s;
    outer: for (let z = -3; z <= 3; z++)
      for (let x = -3; x <= 3; x++) {
        const v = infernalSite(w, x, z);
        if (v.rotation === rotation) {
          s = v;
          break outer;
        }
      }
    assert.ok(s);
    const [dx, dz] = siteOffset(s, 0, -15),
      t = { x: s.x + dx, y: s.y + 1, z: s.z + dz, id: B.chest };
    assert.equal(w.get(t.x, t.y, t.z), B.chest);
    const g = game(w);
    Object.assign(g.player, { x: s.x, y: s.y + 1, z: s.z });
    populateEncounters(g, createEntity);
    populateEncounters(g, createEntity);
    const guards = g.entities.filter((e) => e.encounter === s.id);
    assert.equal(guards.length, 6);
    guards.forEach((e) =>
      assert.equal(
        collides(w, e, MOB_INFO[e.type].height, MOB_INFO[e.type].width),
        false,
      ),
    );
    assert.equal(infernalLootBlocked(g, t), true);
    guards.forEach((e) => damageEntity(g, e, 1000, { knockback: 0 }));
    assert.equal(infernalLootBlocked(g, t), false);
    const [gx, gz] = siteOffset(s, 0, -8);
    assert.equal(w.get(s.x + gx, s.y + 1, s.z + gz), B.air);
    const key = `${t.x},${t.y},${t.z}`;
    assert.equal(w.containers[key].slots[0].id, "cinder_sigil");
    w.containers[key].slots.fill(null);
    const saved = exportRealm({ world: w, entities: [], drops: [] }),
      loaded = restoreRealm(w.seed, w.dimension, saved).world;
    loaded.get(t.x, t.y, t.z);
    assert.ok(loaded.containers[key].slots.every((x) => !x));
    const bytes = w.ensure(Math.floor(s.x / 16), Math.floor(s.z / 16)).data;
    hashes.add(createHash("sha256").update(bytes).digest("hex"));
  }
  assert.equal(hashes.size, 4);
});
test("boats have a real five-plank recipe, single ownership, buoyancy, steering, wall collision, safe dismount and one recovery drop", () => {
  const grid = [
    { id: "planks", count: 1 },
    null,
    { id: "planks", count: 1 },
    { id: "planks", count: 1 },
    { id: "planks", count: 1 },
    { id: "planks", count: 1 },
    null,
    null,
    null,
  ];
  assert.equal(matchRecipe(grid, 3).result, "oak_boat");
  assert.equal(ITEMS.oak_boat.stack, 1);
  assert.ok(CREATIVE_ITEMS.includes("oak_boat"));
  const g = waterGame();
  g.inventory.slots[0] = { id: "oak_boat", count: 1 };
  look(g, { x: 0.5, y: 62.8, z: 0.5 });
  assert.equal(useBoat(g), true);
  assert.equal(g.entities.length, 1);
  assert.equal(g.inventory.held, null);
  const b = g.entities[0];
  look(g, { x: b.x, y: b.y + 0.25, z: b.z });
  assert.equal(useBoat(g), true);
  assert.equal(g.player.boatId, b.id);
  for (let n = 0; n < 240; n++) updatePlayer(g, new Set(["KeyW"]), 1 / 60);
  assert.ok(b.z < -8);
  assert.ok(b.speed > 7);
  assert.ok(Math.abs(b.y - (62 + 8 / 9 - 0.28)) < 0.04);
  assert.equal(g.player.underwater, false);
  b.yaw = -Math.PI / 2;
  for (let n = 0; n < 300; n++) updatePlayer(g, new Set(["KeyW"]), 1 / 60);
  assert.ok(b.x < 5.36, "hull cannot tunnel through the wall");
  updatePlayer(g, new Set(["ShiftLeft"]), 1 / 60);
  assert.ok(!g.player.boatId);
  assert.equal(b.rider, undefined);
  damageEntity(g, b, 20, { knockback: 0 });
  damageEntity(g, b, 20, { knockback: 0 });
  assert.equal(g.drops.filter((d) => d.id === "oak_boat").length, 1);
});
test("boat rejection never spends items, saved boats persist, and recovered rider identities are safe", () => {
  const g = waterGame();
  g.inventory.slots[0] = { id: "oak_boat", count: 1 };
  g.player.pitch = 0.5;
  useBoat(g);
  assert.equal(g.inventory.held.count, 1);
  assert.equal(g.entities.length, 0);
  look(g, { x: 0.5, y: 62.8, z: 0.5 });
  useBoat(g);
  const b = g.entities[0];
  const saved = exportRealm({
    world: g.world,
    entities: g.entities,
    drops: g.drops,
  });
  assert.deepEqual(
    restoreRealm(g.world.seed, "overworld", saved).entities[0],
    b,
  );
  b.rider = "another-player";
  look(g, { x: b.x, y: b.y + 0.25, z: b.z });
  useBoat(g);
  assert.ok(!g.player.boatId);
  delete b.rider;
  tickBoats(g);
  assert.ok(b.hp > 0);
});
test("fliers spawn naturally over lava, respect Peaceful and Creative targeting, and launch real fireballs", () => {
  const w = new World("flight", {}, "cinderwild"),
    g = game(w);
  g.player.y = 110;
  w.get = () => B.air;
  w.solid = () => false;
  w.terrain = () => ({ h: 100, biome: "ash_wastes" });
  g.difficulty = "peaceful";
  spawnFliers(g, createEntity);
  assert.equal(g.entities.length, 0);
  g.difficulty = "normal";
  spawnFliers(g, createEntity);
  assert.equal(g.entities.length, 1);
  const e = g.entities[0];
  Object.assign(e, { x: 0.5, y: 108, z: -17, age: 0 });
  for (let n = 0; n < 80; n++) {
    e.age++;
    g.tickCount++;
    tickFlier(g, e);
  }
  assert.ok(g.hostileProjectiles.some((q) => q.fireball));
  assert.ok(e.y > 100);
  g.mode = "creative";
  g.hostileProjectiles = [];
  e.attack = 0;
  for (let n = 0; n < 80; n++) tickFlier(g, e);
  assert.equal(g.hostileProjectiles.length, 0);
});
test("aimed fireball deflection is cooldown/cover guarded and returned shots damage their shooter without PvP", () => {
  const g = game();
  g.world.get = () => B.air;
  g.world.solid = () => false;
  g.player.y = 100;
  g.player.yaw = 0;
  g.player.pitch = 0;
  const e = {
    id: "shooter",
    type: "ember_ray",
    x: 0.5,
    y: 100.8,
    z: -4,
    hp: 24,
    vx: 0,
    vy: 0,
    vz: 0,
  };
  g.entities = [e];
  const q = {
    id: "fire",
    fireball: true,
    arcane: true,
    x: 0.5,
    y: 101.62,
    z: 1,
    vx: 0,
    vy: 0,
    vz: 0.48,
    source: e.id,
    sourceType: e.type,
    damage: 6,
    age: 0,
  };
  g.hostileProjectiles = [q];
  const realRay = g.world.raycast.bind(g.world);
  g.world.raycast = () => ({ distance: 1 });
  assert.equal(deflectFireball(g), false);
  g.world.raycast = realRay;
  assert.equal(deflectFireball(g), true);
  assert.equal(q.reflected, true);
  assert.ok(q.vz < 0);
  assert.equal(deflectFireball(g), false);
  const hp = g.player.health;
  for (let n = 0; n < 15; n++) tickHostileProjectiles(g, damageEntity);
  assert.equal(e.hp, 6);
  assert.equal(g.player.health, hp);
  assert.equal(g.hostileProjectiles.length, 0);
  g.tickCount += 6;
  g.hostileProjectiles = [
    {
      id: "next",
      fireball: true,
      x: g.player.x,
      y: g.player.y + 1.62,
      z: g.player.z - 2,
    },
  ];
  assert.equal(
    deflectFireball(g),
    true,
    "the simulation-tick parry cooldown recovers",
  );
});
test("biome climates shorten wet/cold dry spells, keep deserts dry, and retain explicit weather overrides", () => {
  assert.ok(
    biomeWeatherProfile("jungle").rate > biomeWeatherProfile("meadow").rate,
  );
  assert.ok(
    biomeWeatherProfile("snowy_taiga").rate >
      biomeWeatherProfile("meadow").rate,
  );
  assert.equal(precipitation("snowy_taiga"), "snow");
  for (const biome of ["jungle", "snowy_taiga", "desert"]) {
    const g = game();
    g.world.terrain = () => ({ h: 70, biome });
    g.world.skyHeight = () => 70;
    g.world.chunks.clear();
    g.world.weather.remaining = 1;
    g.world.tick = 1;
    tickWeather(g);
    if (biome === "desert") {
      tickWeather(g);
      assert.equal(g.world.weather.kind, "clear");
    } else assert.notEqual(g.world.weather.kind, "clear");
    setWeather(g.world, "thunder");
    tickWeather(g);
    assert.equal(g.world.weather.kind, "thunder");
  }
});

test("boat and flying models satisfy renderer contracts, keep the boat inventory item flat and have distinct original silhouettes", () => {
  const restore = mockCanvas();
  try {
    const models = ["boat", "ember_ray", "cinder_roc"].map((type) =>
      createMobModel({ type }),
    );
    for (const m of models) {
      assert.ok(Array.isArray(m.userData.legs));
      assert.ok(m.children.length < 40);
    }
    assert.equal(models[0].userData.oars.length, 2);
    assert.equal(models[0].userData.waterMask.material.colorWrite, false);
    assert.equal(models[0].userData.waterMask.material.depthWrite, true);
    assert.equal(models[1].userData.wings.length, 2);
    assert.equal(models[2].userData.wings.length, 2);
    assert.equal(new Set(models.map(modelFingerprint)).size, 3);
    assert.equal(isFlatItem("oak_boat"), true);
  } finally {
    restore();
  }
});
test("replicated boat and returned-fireball ownership use public peer IDs without reconnect secrets", () => {
  const g = waterGame();
  g.standIdentity = "private-reconnect-secret";
  g.multiplayer = {
    peerForPlayer: () => ({ id: "public-guest" }),
    peers: new Map(),
  };
  g.inventory.slots[0] = { id: "oak_boat", count: 1 };
  look(g, { x: 0.5, y: 62.8, z: 0.5 });
  useBoat(g);
  const b = g.entities[0];
  look(g, { x: b.x, y: b.y + 0.25, z: b.z });
  useBoat(g);
  assert.equal(b.rider, "public-guest");
  assert.ok(!JSON.stringify(g.entities).includes(g.standIdentity));
  g.player.pitch = 0;
  g.player.yaw = 0;
  g.hostileProjectiles = [
    {
      id: "q",
      fireball: true,
      x: g.player.x,
      y: g.player.y + 1.62,
      z: g.player.z - 2,
    },
  ];
  assert.equal(deflectFireball(g), true);
  assert.equal(g.hostileProjectiles[0].deflectorId, "public-guest");
  assert.ok(!JSON.stringify(g.hostileProjectiles).includes(g.standIdentity));
});
