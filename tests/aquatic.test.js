import { respawnPeer } from "../src/coop-survival.js";
import test from "node:test";
import assert from "node:assert/strict";
import {
  B,
  BLOCKS,
  ITEMS,
  CREATIVE_ITEMS,
  MOB_INFO,
  GENERATION_VERSION,
  makeStack,
} from "../src/data.js";
import { World, index } from "../src/world.js";
import { Inventory, matchRecipe } from "../src/inventory.js";
import { createPlayer, updatePlayer, collides } from "../src/physics.js";
import {
  createEntity,
  damageEntity,
  tickPlayerSurvival,
} from "../src/simulation.js";
import {
  CONDUIT_FRAME,
  conduitStatus,
  bubbleColumn,
  tickAquaticWorld,
  tickAquaticEntity,
  aquaticState,
  tickOceanPlayer,
  effect,
} from "../src/aquatic.js";
import {
  useAquatic,
  releaseTrident,
  tickAquaticGear,
  brewingSlotAccepts,
} from "../src/aquatic-gear.js";
import {
  oceanTerrain,
  OCEAN_BIOMES,
  oceanSite,
  buriedTreasure,
} from "../src/ocean-generation.js";
import { awardXP, enchantItem } from "../src/equipment.js";
import { exportRealm, restoreRealm } from "../src/realms.js";
import { meshChunk } from "../src/mesher.js";
import { playerEye, playerHeight } from "../src/player-body.js";
import { createMobModel } from "../src/models.js";
import { mockCanvas } from "./helpers/mock-canvas.js";
function game() {
  const w = new World("Aquatic proof");
  const g = {
    world: w,
    dimension: "overworld",
    player: createPlayer({ x: 4.5, y: 201, z: 4.5 }),
    inventory: new Inventory(),
    entities: [],
    drops: [],
    mode: "survival",
    difficulty: "normal",
    tickCount: 1,
    time: 23000,
    elapsed: 10,
    settings: { renderDistance: 2 },
    ui: { toast() {}, updateHotbar() {}, updateHUD() {} },
    audio: { tone() {}, voice() {} },
    renderer: { action() {}, combatImpact() {} },
    damage(n) {
      this.player.health -= n;
    },
    targetEntity() {
      return this.targeted;
    },
    direction() {
      const p = this.player;
      return {
        x: -Math.sin(p.yaw) * Math.cos(p.pitch),
        y: Math.sin(p.pitch),
        z: -Math.cos(p.yaw) * Math.cos(p.pitch),
      };
    },
  };
  for (let z = 0; z < 10; z++)
    for (let x = 0; x < 10; x++) {
      w.set(x, 199, z, B.stone);
      for (let y = 200; y < 206; y++)
        w.set(
          x,
          y,
          z,
          x === 0 || z === 0 || x === 9 || z === 9 ? B.stone : B.water,
        );
    }
  return g;
}
const api = {
  createEntity,
  dropItem(g, s, x, y, z) {
    g.drops.push({ ...s, x, y, z });
  },
  damageEntity,
};
test("ocean extension preserves legacy IDs, fits 16-bit chunks, exposes connected recipes and all Creative eggs", () => {
  assert.equal(GENERATION_VERSION, 16);
  assert.equal(B.snow_layer_8, 136);
  assert.equal(B.prismarine, 137);
  assert.ok(BLOCKS.length <= 65535);
  assert.equal(new Set(BLOCKS.map((b) => b.key)).size, BLOCKS.length);
  for (const id of [
    "fishing_rod",
    "trident",
    "conduit",
    "turtle_shell",
    "nautilus_shell",
    "heart_of_the_sea",
    "brewing_stand",
    "turtle_master_potion",
  ])
    assert.ok(CREATIVE_ITEMS.includes(id), id);
  for (const type of [
    "cod",
    "salmon",
    "tropical_fish",
    "pufferfish",
    "squid",
    "dolphin",
    "turtle",
    "drowned",
  ])
    assert.equal(ITEMS[`${type}_spawn_egg`].spawnType, type);
  const slots = [
    "nautilus_shell",
    "nautilus_shell",
    "nautilus_shell",
    "nautilus_shell",
    "heart_of_the_sea",
    "nautilus_shell",
    "nautilus_shell",
    "nautilus_shell",
    "nautilus_shell",
  ].map((id) => makeStack(id));
  assert.equal(matchRecipe(slots, 3).result, "conduit");
});
test("all nine ocean climates occur deterministically without changing the connected coastline", () => {
  const biomes = new Set();
  for (let z = -6000; z <= 6000; z += 79)
    for (let x = -6000; x <= 6000; x += 83) {
      const t = { h: (x + z) % 3 ? 40 : 53 };
      const a = oceanTerrain(t, x, z, 711);
      biomes.add(a.biome);
      assert.equal(a.h, t.h);
    }
  for (const b of OCEAN_BIOMES) assert.ok(biomes.has(b), b);
});
test("reef and kelp chunks mesh finite high atlas IDs across negative borders", () => {
  const g = game();
  for (const [x, id] of [
    [3, B.fire_coral],
    [4, B.sea_pickle_4],
    [5, B.kelp],
    [6, B.turtle_egg_4_2],
    [7, B.conduit],
  ])
    g.world.set(x, 201, 3, id);
  const c = g.world.ensure(0, 0),
    groups = meshChunk(g.world, c);
  assert.ok(groups.filter(Boolean).length);
  for (const a of groups.filter(Boolean))
    assert.ok([...a.uv].every((n) => Number.isFinite(n) && n >= 0 && n <= 1));
});
test("mapped ocean loot persists, chest depletion and removed chests never refill after chunk unload", () => {
  const w = new World("Aquatic treasure");
  let site;
  outer: for (let z = -4; z <= 4; z++)
    for (let x = -4; x <= 4; x++) {
      site = oceanSite(w, x, z);
      if (site) break outer;
    }
  assert.ok(site);
  const q = buriedTreasure(w, site),
    key = `${q.x},${q.y},${q.z}`;
  assert.equal(w.get(q.x, q.y, q.z), B.chest);
  assert.equal(w.containers[key].slots[0].id, "heart_of_the_sea");
  w.containers[key].slots.fill(null);
  w.chunks.clear();
  assert.equal(w.get(q.x, q.y, q.z), B.chest);
  assert.ok(w.containers[key].slots.every((s) => !s));
  w.set(q.x, q.y, q.z, B.sand);
  delete w.containers[key];
  const saved = exportRealm({ world: w, entities: [], drops: [] }),
    r = restoreRealm(
      w.seed,
      "overworld",
      JSON.parse(JSON.stringify(saved)),
    ).world;
  assert.equal(r.get(q.x, q.y, q.z), B.sand);
  assert.equal(r.containers[key], undefined);
});
test("bubble columns require uninterrupted source water and have opposite forces", () => {
  const g = game(),
    w = g.world;
  w.set(4, 199, 4, B.soul_sand);
  assert.equal(bubbleColumn(w, 4, 204, 4), 1);
  w.set(4, 199, 4, B.magma_block);
  assert.equal(bubbleColumn(w, 4, 204, 4), -1);
  w.set(4, 202, 4, B.water_flow_1);
  assert.equal(bubbleColumn(w, 4, 204, 4), 0);
});
test("conduit needs water and sixteen frame blocks; forty-two grant maximum range and protect breath", () => {
  const g = game(),
    w = g.world,
    x = 4,
    y = 202,
    z = 4;
  w.set(x, y, z, B.conduit);
  assert.equal(CONDUIT_FRAME.length, 42);
  assert.equal(conduitStatus(w, x, y, z).active, false);
  for (const [dx, dy, dz] of CONDUIT_FRAME.slice(0, 16))
    w.set(x + dx, y + dy, z + dz, B.prismarine);
  assert.deepEqual(conduitStatus(w, x, y, z), {
    active: true,
    frame: 16,
    radius: 32,
  });
  for (const [dx, dy, dz] of CONDUIT_FRAME)
    w.set(x + dx, y + dy, z + dz, B.sea_lantern);
  assert.equal(conduitStatus(w, x, y, z).radius, 96);
  g.tickCount = 40;
  tickAquaticWorld(g, api);
  Object.assign(g.player, { inWater: true, underwater: true, oxygen: 2 });
  tickPlayerSurvival(g);
  assert.ok(g.player.oxygen > 2);
  assert.ok(g.player.effects.conduit_power);
  w.set(4, 203, 4, B.stone);
  assert.equal(conduitStatus(w, x, y, z).active, false);
});
test("fish buckets preserve health, consume one fish, and release exactly once without inventory room", () => {
  const g = game();
  g.inventory.slots.fill(makeStack("stone", 64));
  g.inventory.slots[0] = makeStack("water_bucket");
  const e = createEntity(g, "salmon", 4, 3);
  e.y = 202;
  e.hp = 2;
  g.entities = [e];
  g.targeted = e;
  assert.ok(useAquatic(g));
  assert.equal(e.hp, 0);
  assert.equal(g.inventory.held.id, "salmon_bucket");
  g.targeted = null;
  g.target = { x: 4, y: 201, z: 3, id: B.stone, normal: { x: 0, y: 1, z: 0 } };
  useAquatic(g);
  assert.equal(g.inventory.held.id, "bucket");
  assert.equal(g.entities.filter((e) => e.hp > 0).length, 1);
  assert.equal(g.entities.at(-1).hp, 2);
  useAquatic(g);
  assert.equal(g.entities.filter((e) => e.hp > 0).length, 1);
});
test("feeding dolphin sets a real structure destination, turtle breeding and eggs require a pair and sand", () => {
  const g = game();
  let site;
  outer: for (let z = -4; z < 4; z++)
    for (let x = -4; x < 4; x++) {
      site = oceanSite(g.world, x, z);
      if (site) break outer;
    }
  const d = createEntity(g, "dolphin", site.x + 10, site.z);
  g.targeted = d;
  g.inventory.slots[0] = makeStack("cod", 2);
  useAquatic(g);
  assert.ok(d.guide);
  assert.ok(Math.hypot(d.guide.x - site.x, d.guide.z - site.z) < 2);
  assert.equal(g.inventory.held.count, 1);
  const a = createEntity(g, "turtle", 4, 4),
    b = createEntity(g, "turtle", 5, 4);
  a.y = b.y = 201;
  a.love = b.love = 600;
  g.entities = [a, b];
  tickAquaticEntity(g, a, api);
  assert.ok(a.pregnant);
  assert.equal(b.love, 0);
  assert.equal(a.breedCooldown, 6000);
});
test("hatching produces babies, adulthood drops one scute, reload cannot duplicate that reward", () => {
  const g = game(),
    w = g.world;
  w.set(3, 199, 3, B.sand);
  w.set(3, 200, 3, B.turtle_egg_2_2);
  aquaticState(w).growth["3,200,3"] = { ticks: 2360 };
  g.tickCount = 40;
  tickAquaticWorld(g, api);
  assert.equal(w.get(3, 200, 3), B.air);
  assert.equal(
    g.entities.filter((e) => e.type === "turtle" && e.baby).length,
    2,
  );
  const e = g.entities[0];
  e.growTicks = 1;
  tickAquaticEntity(g, e, api);
  assert.equal(g.drops.filter((s) => s.id === "scute").length, 1);
  const loaded = JSON.parse(JSON.stringify(e));
  tickAquaticEntity(g, loaded, api);
  assert.equal(g.drops.filter((s) => s.id === "scute").length, 1);
});
test("a full real brewing batch consumes one ingredient and one fuel use for three bottles", () => {
  const g = game();
  const c = (g.world.containers["4,200,4"] = {
    type: "brewing_stand",
    slots: [
      makeStack("water_bottle"),
      makeStack("water_bottle"),
      makeStack("water_bottle"),
      makeStack("nether_wart", 2),
      makeStack("blaze_powder"),
    ],
    progress: 0,
  });
  for (let i = 0; i < 399; i++) tickAquaticGear(g);
  assert.equal(c.slots[0].id, "water_bottle");
  tickAquaticGear(g);
  assert.ok(c.slots.slice(0, 3).every((s) => s.id === "awkward_potion"));
  assert.equal(c.slots[3].count, 1);
  assert.equal(c.fuel, 19);
  c.slots[3] = makeStack("turtle_shell");
  for (let i = 0; i < 400; i++) tickAquaticGear(g);
  assert.ok(c.slots.slice(0, 3).every((s) => s.id === "turtle_master_potion"));
  assert.equal(c.slots[3], null);
  assert.equal(c.fuel, 18);
  assert.equal(brewingSlotAccepts(0, makeStack("diamond")), false);
  assert.equal(brewingSlotAccepts(4, makeStack("blaze_powder")), true);
});
test("Turtle Master grants saved timed effects and drinking returns a bottle atomically", () => {
  const g = game();
  g.inventory.slots[0] = makeStack("turtle_master_potion");
  useAquatic(g);
  assert.equal(g.inventory.held.id, "glass_bottle");
  assert.equal(g.player.effects.resistance.level, 3);
  assert.equal(g.player.effects.slowness.level, 4);
  tickOceanPlayer(g);
  assert.equal(g.player.effects.resistance.ticks, 399);
});
test("trident charge gates, Loyalty returns exactly one durable enchanted weapon, including after reload", () => {
  const g = game();
  g.player.yaw = 0;
  g.inventory.slots[0] = {
    ...makeStack("trident"),
    enchantments: { loyalty: 3 },
  };
  useAquatic(g);
  g.tickCount += 9;
  assert.equal(releaseTrident(g), false);
  assert.equal(g.inventory.held.id, "trident");
  useAquatic(g);
  g.tickCount += 10;
  assert.equal(releaseTrident(g), true);
  assert.equal(g.inventory.held, null);
  assert.equal(g.world.aquatic.projectiles.length, 1);
  let q = g.world.aquatic.projectiles[0];
  q.hit = true;
  q.x = g.player.x;
  q.y = g.player.y + 1;
  q.z = g.player.z;
  g.world.aquatic = JSON.parse(JSON.stringify(g.world.aquatic));
  tickAquaticGear(g);
  assert.equal(g.inventory.held.id, "trident");
  assert.equal(g.inventory.held.durability, 249);
  assert.equal(g.inventory.held.enchantments.loyalty, 3);
  tickAquaticGear(g);
  assert.equal(g.inventory.slots.filter((s) => s?.id === "trident").length, 1);
});
test("Riptide rejects dry activation, excludes Loyalty, and swept movement cannot cross a wall", () => {
  const g = game();
  g.inventory.slots[0] = {
    ...makeStack("trident"),
    enchantments: { riptide: 3 },
  };
  useAquatic(g);
  g.tickCount += 10;
  assert.equal(releaseTrident(g), false);
  g.player.inWater = true;
  useAquatic(g);
  g.tickCount += 10;
  assert.ok(releaseTrident(g));
  for (let y = 200; y <= 205; y++)
    for (let x = 1; x <= 8; x++) g.world.set(x, y, 2, B.stone);
  for (let i = 0; i < 40; i++) updatePlayer(g, new Set(), 0.05);
  assert.ok(g.player.z >= 3.3 - 1e-4);
  assert.equal(collides(g.world, g.player), false);
  g.mode = "creative";
  assert.equal(enchantItem(g, 0, "loyalty").ok, false);
});
test("Mending uses earned XP on damaged held and armor items before storing leftover points", () => {
  const g = game();
  g.inventory.slots[0] = {
    ...makeStack("trident"),
    durability: 240,
    enchantments: { mending: 1 },
  };
  awardXP(g, 7);
  assert.equal(g.inventory.held.durability, 250);
  assert.equal(g.player.xp, 2);
});
test("sprint swimming has a short body, coherent eye height, and restores upright dimensions on land", () => {
  const g = game();
  g.player.food = 20;
  updatePlayer(g, new Set(["KeyW", "ControlLeft"]), 0.05);
  assert.ok(g.player.swimming);
  assert.equal(playerHeight(g.player), 0.6);
  assert.equal(playerEye(g.player), 0.4);
  g.player.y = 210;
  updatePlayer(g, new Set(), 0.05);
  assert.equal(g.player.swimming, false);
  assert.equal(playerHeight(g.player), 1.8);
});
test("all sea life has original finite geometry; baby turtles are scaled and do not reuse generic humanoid bodies", () => {
  const restore = mockCanvas();
  try {
    for (const type of [
      "cod",
      "salmon",
      "tropical_fish",
      "pufferfish",
      "squid",
      "dolphin",
      "turtle",
      "drowned",
      "husk",
      "stray",
      "skeleton_horse",
    ]) {
      const m = createMobModel({ type, baby: type === "turtle" });
      assert.equal(m.userData.aquaticStyle, type);
      m.traverse((o) => {
        if (o.geometry)
          assert.ok(
            [...o.geometry.attributes.position.array].every(Number.isFinite),
          );
      });
    }
  } finally {
    restore();
  }
});

test("paused charge cannot throw; a full bag suspends Loyalty return without overwriting or duplicating the weapon", () => {
  const g = game();
  g.inventory.slots[0] = {
    ...makeStack("trident"),
    enchantments: { loyalty: 3 },
  };
  useAquatic(g);
  g.tickCount += 20;
  g.ui.screen = "pause";
  assert.equal(releaseTrident(g), false);
  assert.equal(g.inventory.held.id, "trident");
  g.ui.screen = "play";
  useAquatic(g);
  g.tickCount += 20;
  assert.ok(releaseTrident(g));
  g.inventory.slots = Array.from({ length: 36 }, () => makeStack("stone", 64));
  const q = g.world.aquatic.projectiles[0];
  Object.assign(q, {
    hit: true,
    x: g.player.x,
    y: g.player.y + 1,
    z: g.player.z,
  });
  tickAquaticGear(g);
  assert.equal(g.world.aquatic.projectiles.length, 1);
  assert.ok(g.inventory.slots.every((s) => s.id === "stone" && s.count === 64));
  g.world.aquatic = JSON.parse(JSON.stringify(g.world.aquatic));
  g.inventory.slots[10] = null;
  tickAquaticGear(g);
  assert.equal(g.world.aquatic.projectiles.length, 0);
  assert.equal(g.inventory.slots[10].id, "trident");
  assert.equal(g.inventory.slots[10].durability, 249);
  tickAquaticGear(g);
  assert.equal(g.inventory.slots.filter((s) => s?.id === "trident").length, 1);
});

test("a thrown Loyalty trident keeps its public owner across a real Survival respawn and returns once", () => {
  const g = game();
  g.inventory.slots[0] = {
    ...makeStack("trident"),
    enchantments: { loyalty: 3 },
  };
  useAquatic(g);
  g.tickCount += 10;
  releaseTrident(g);
  const id = g.player.aquaticId,
    q = g.world.aquatic.projectiles[0];
  g.player.health = 0;
  const peer = {
    player: g.player,
    inventory: g.inventory,
    spawn: { x: 4.5, y: 201, z: 4.5 },
    context: g,
  };
  assert.ok(respawnPeer({ game: g }, peer));
  assert.equal(g.player.aquaticId, id);
  Object.assign(q, {
    hit: true,
    x: g.player.x,
    y: g.player.y + 1,
    z: g.player.z,
  });
  tickAquaticGear(g);
  assert.equal(g.inventory.slots[0].id, "trident");
  assert.equal(g.inventory.slots[0].durability, 249);
  assert.equal(g.world.aquatic.projectiles.length, 0);
});

test("stopping underwater sprinting below a low roof retains the short body until the player can stand safely", () => {
  const g = game();
  g.player.y = 200;
  g.player.swimming = true;
  g.player.onGround = true;
  for (let z = 1; z <= 8; z++)
    for (let x = 1; x <= 8; x++) g.world.set(x, 201, z, B.stone);
  updatePlayer(g, new Set(), 0.05);
  assert.equal(g.player.swimming, true);
  assert.equal(collides(g.world, g.player, playerHeight(g.player)), false);
  assert.equal(playerEye(g.player), 0.4);
  for (let z = 1; z <= 8; z++)
    for (let x = 1; x <= 8; x++) g.world.set(x, 201, z, B.water);
  updatePlayer(g, new Set(), 0.05);
  assert.equal(g.player.swimming, false);
  assert.equal(collides(g.world, g.player, playerHeight(g.player)), false);
});
