import test from "node:test";
import assert from "node:assert/strict";
import { World, index } from "../src/world.js";
import {
  B,
  BLOCKS,
  ITEMS,
  RECIPES,
  SMELTS,
  FUELS,
  makeStack,
  MOB_INFO,
} from "../src/data.js";
import {
  CINDER_BIOMES,
  cinderBase,
  cinderOre,
  cinderSite,
} from "../src/cinderworld.js";
import { relicSite, extractRelic, templeUnlocked } from "../src/relic.js";
import { populateEncounters } from "../src/encounters.js";
import { createEntity, damageEntity, tickSurvival } from "../src/simulation.js";
import { createPlayer, collides } from "../src/physics.js";
import { Inventory, miningTicks, canHarvest } from "../src/inventory.js";
import { reduceDamage, ENCHANTMENTS } from "../src/equipment.js";
import { wildlifeForBiome } from "../src/ecology.js";
import { exportRealm, restoreRealm } from "../src/realms.js";
import { setWeather, tickWeather } from "../src/weather.js";
import { meshHorizon } from "../src/horizon.js";
function fixture(world = new World("Wildflower", {}, "overworld", 10)) {
  const site = relicSite(world),
    spawn = site
      ? { x: site.x + 0.5, y: site.y, z: site.z + 4 }
      : { x: 8.5, y: world.terrain(8, 8).h + 1, z: 8.5 };
  const g = {
    world,
    dimension: world.dimension,
    player: createPlayer(spawn),
    inventory: new Inventory(),
    entities: [],
    drops: [],
    time: 6000,
    tickCount: 1,
    elapsed: 1,
    mode: "survival",
    difficulty: "normal",
    running: true,
    mouseDown: true,
    settings: { renderDistance: 2, cycleText: {} },
    ui: { toast() {}, updateHUD() {}, updateHotbar() {}, announce() {} },
    audio: { tone() {}, voice() {} },
    save: async () => {},
  };
  g.damage = (n) => {
    g.player.health -= n;
    g.extraction = null;
  };
  return g;
}
test("Cinderworld has four deterministic volcanic regions, varied relief and reproducible negative-border chunks", () => {
  const w = new World("Wildflower", {}, "cinderwild", 10),
    found = new Set();
  let min = 320,
    max = -64;
  for (let z = -1800; z <= 1800; z += 48)
    for (let x = -1800; x <= 1800; x += 48) {
      const t = cinderBase(x, z, w.seedInt);
      found.add(t.biome);
      min = Math.min(min, t.h);
      max = Math.max(max, t.h);
      assert.deepEqual(t, cinderBase(x, z, w.seedInt));
    }
  assert.deepEqual(
    [...found].sort(),
    Object.keys(CINDER_BIOMES)
      .filter((b) => !["bloodlands", "soul_vale"].includes(b))
      .sort(),
  );
  assert.ok(max - min > 40);
  const a = new World("Wildflower", {}, "cinderwild", 10),
    b = new World("Wildflower", {}, "cinderwild", 10);
  for (const [x, z] of [
    [-1, -1],
    [0, -1],
    [-1, 0],
    [0, 0],
  ])
    a.ensure(x, z);
  for (const [x, z] of [
    [0, 0],
    [-1, 0],
    [0, -1],
    [-1, -1],
  ])
    b.ensure(x, z);
  for (const [key, c] of a.chunks)
    assert.deepEqual(c.data, b.chunks.get(key).data);
  assert.notDeepEqual(
    a.ensure(0, 0).data,
    new World("Wildflower", {}, "cinderwild", 6).ensure(0, 0).data,
  );
});
test("exclusive coherent ore veins are uncommon but reachable, with meaningful iron and diamond mining tiers", () => {
  const w = new World("Wildflower", {}, "cinderwild", 10);
  let hell = 0,
    brim = 0,
    rock = 0;
  for (let cz = -2; cz <= 2; cz++)
    for (let cx = -2; cx <= 2; cx++) {
      const c = w.ensure(cx, cz);
      for (const id of c.data) {
        if (id === B.hellfire_ore) hell++;
        if (id === B.brimstone_ore) brim++;
        if (id === B.cinderstone) rock++;
      }
    }
  assert.ok(hell > 80 && hell < rock * 0.02, `${hell} hellfire / ${rock} rock`);
  assert.ok(brim > hell / 2 && brim < rock * 0.03);
  const over = new World("Wildflower", {}, "overworld", 10);
  for (const [x, z] of [
    [0, 0],
    [4, 6],
    [-2, -1],
  ]) {
    const c = over.ensure(x, z);
    assert.ok(
      !c.data.includes(B.hellfire_ore) && !c.data.includes(B.brimstone_ore),
    );
  }
  assert.equal(cinderOre(0, 5, 0, 1), B.cinderstone);
  assert.equal(cinderOre(0, 100, 0, 1), B.cinderstone);
  assert.equal(BLOCKS[B.hellfire_ore].drop, "raw_hellfire");
  assert.equal(BLOCKS[B.hellfire_ore].tier, 4);
  assert.equal(BLOCKS[B.brimstone_ore].tier, 3);
  assert.ok(
    miningTicks(BLOCKS[B.hellfire_ore], makeStack("diamond_pickaxe")) <
      miningTicks(BLOCKS[B.hellfire_ore], makeStack("iron_pickaxe")),
  );
  assert.equal(
    canHarvest(BLOCKS[B.hellfire_ore], makeStack("iron_pickaxe")),
    false,
  );
  assert.equal(
    canHarvest(BLOCKS[B.hellfire_ore], makeStack("diamond_pickaxe")),
    true,
  );
  assert.ok(ITEMS.hellfire_pickaxe.speed > ITEMS.diamond_pickaxe.speed);
});
test("raw ore smelts through production furnace ticks, alloy consumes both exclusive resources and all ten gear recipes work", () => {
  const g = fixture(new World("forge", {}, "cinderwild"));
  g.mode = "creative";
  g.difficulty = "peaceful";
  g.player.y = 180;
  const x = Math.floor(g.player.x),
    z = Math.floor(g.player.z),
    key = `${x},180,${z}`;
  g.world.set(x, 180, z, B.furnace);
  g.world.containers[key] = {
    type: "furnace",
    slots: [makeStack("raw_hellfire", 2), makeStack("brimstone"), null],
  };
  for (let i = 0; i < 400; i++) tickSurvival(g);
  assert.deepEqual(
    g.world.containers[key].slots[2],
    makeStack("hellfire_ingot", 2),
  );
  assert.equal(SMELTS.raw_hellfire, "hellfire_ingot");
  assert.ok(FUELS.brimstone >= 1600);
  const inv = new Inventory();
  inv.craft[0] = makeStack("hellfire_ingot");
  inv.craft[1] = makeStack("hellfire_ingot");
  inv.craft[2] = makeStack("brimstone");
  assert.ok(inv.craftOne(2));
  assert.deepEqual(inv.cursor, makeStack("hellfire_alloy", 2));
  assert.ok(inv.craft.every((s) => !s));
  const recipes = RECIPES.filter(
    (r) => r.result.startsWith("hellfire_") && ITEMS[r.result].stack === 1,
  );
  assert.equal(recipes.length, 10);
  for (const r of recipes) {
    const v = new Inventory();
    r.pattern.forEach((row, y) =>
      [...row].forEach((c, x) => {
        if (r.key[c]) v.craft[y * 3 + x] = makeStack(r.key[c]);
      }),
    );
    assert.ok(v.craftOne(3), r.id);
    assert.equal(v.cursor.id, r.result);
    assert.ok(v.craft.every((s) => !s));
    assert.equal(v.craftOne(3), false);
  }
});
test("Hellfire armor adds heat protection without immunity and retains equipment and enchantment rules", () => {
  const inv = new Inventory();
  inv.equipment = ["helmet", "chestplate", "leggings", "boots"].map((slot) =>
    makeStack(`hellfire_${slot}`),
  );
  const normal = reduceDamage(inv, 8, "hit"),
    lava = reduceDamage(inv, 8, "Cinderworld lava");
  assert.ok(lava > 0);
  assert.ok(Math.abs(lava / normal - 0.6) < 1e-9);
  assert.ok(ENCHANTMENTS.protection.fits(ITEMS.hellfire_chestplate));
  assert.ok(ENCHANTMENTS.efficiency.fits(ITEMS.hellfire_pickaxe));
  inv.equipment[0].enchantments = { protection: 2 };
  assert.deepEqual(new Inventory(inv.export()).equipment, inv.equipment);
  assert.ok(ITEMS.hellfire_sword.durability > ITEMS.diamond_sword.durability);
});
function structures() {
  const w = new World("Wildflower", {}, "cinderwild", 10),
    found = {};
  for (let z = -5; z <= 5; z++)
    for (let x = -5; x <= 5; x++) {
      const s = cinderSite(w, x, z);
      if (s && !found[s.kind]) found[s.kind] = s;
    }
  return { w, found };
}
test("all three exploration structures have real loot, furnishings and persistent empty-container state", () => {
  const { w, found } = structures();
  assert.equal(Object.keys(found).length, 3);
  for (const s of Object.values(found)) {
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++)
        w.ensure(Math.floor(s.x / 16) + dx, Math.floor(s.z / 16) + dz);
    const chest = Object.entries(w.containers).find(([key]) => {
      const [x, , z] = key.split(",").map(Number);
      return Math.hypot(x - s.x, z - s.z) < 15;
    });
    assert.ok(chest, s.kind);
    const [key, c] = chest;
    assert.equal(w.get(...key.split(",").map(Number)), B.chest);
    assert.ok(c.slots.some((i) => i && ITEMS[i.id]));
    c.slots.fill(null);
    const loaded = restoreRealm(
      w.seed,
      "cinderwild",
      exportRealm({ world: w, entities: [], drops: [] }),
    ).world;
    loaded.unload(999, 999, 1);
    loaded.get(...key.split(",").map(Number));
    assert.ok(loaded.containers[key].slots.every((i) => !i));
  }
});
test("bastion and shrine defenders spawn once and keep their cleared state through save/reload", () => {
  const { w, found } = structures(),
    s = found.bastion,
    g = fixture(w);
  Object.assign(g.player, { x: s.x, y: s.y + 1, z: s.z + 6 });
  populateEncounters(g, createEntity);
  assert.equal(g.entities.filter((e) => e.encounter === s.id).length, 3);
  populateEncounters(g, createEntity);
  assert.equal(g.entities.length, 3);
  for (const e of g.entities) damageEntity(g, e, 100, { reward: false });
  g.entities = [];
  populateEncounters(g, createEntity);
  assert.equal(g.entities.length, 0);
  const loaded = restoreRealm(
    w.seed,
    "cinderwild",
    exportRealm({ world: w, entities: [], drops: [] }),
  );
  g.world = loaded.world;
  populateEncounters(g, createEntity);
  assert.equal(g.entities.length, 0);
});
test("new sword temples lie far from actual spawn, have real foundations and three non-cloned Guardians", () => {
  for (const seed of ["Wildflower", "Stonebridge", "devin", "137"]) {
    const w = new World(seed),
      p = relicSite(w),
      spawn = w.findSpawn();
    assert.ok(p?.temple, seed);
    assert.ok(Math.hypot(p.x - spawn.x, p.z - spawn.z) > 800);
  }
  const g = fixture(),
    p = relicSite(g.world);
  populateEncounters(g, createEntity);
  assert.equal(g.entities.length, 3);
  populateEncounters(g, createEntity);
  assert.equal(g.entities.length, 3);
  assert.equal(g.world.get(p.x, p.y, p.z), B.devin_relic_base);
  assert.equal(g.world.get(p.x + 13, p.y + 5, p.z - 6), B.basalt);
  assert.ok(
    g.entities.every(
      (e) =>
        !collides(g.world, e, MOB_INFO[e.type].height, MOB_INFO[e.type].width),
    ),
  );
});
test("temple seal blocks extraction until balanced Guardians fall, then grants one sword and never resurrects them", () => {
  const g = fixture(),
    p = relicSite(g.world),
    target = { x: p.x, y: p.y + 1, z: p.z, id: B.devin_relic_blade };
  g.player.z = p.z + 2.8;
  populateEncounters(g, createEntity);
  extractRelic(g, target, 0);
  assert.equal(g.extraction, null);
  assert.equal(templeUnlocked(g), false);
  for (const e of g.entities) {
    for (let i = 0; i < 30; i++) damageEntity(g, e, 7);
    assert.ok(e.hp > 0);
    damageEntity(g, e, 7);
    assert.ok(e.hp <= 0);
    damageEntity(g, e, 7);
  }
  assert.equal(g.world.settlements["devin-temple"].defeated.length, 3);
  assert.equal(templeUnlocked(g), true);
  extractRelic(g, target, 1000);
  extractRelic(g, target, 30999);
  assert.equal(g.world.relicClaimed, false);
  extractRelic(g, target, 31000);
  assert.equal(g.world.relicClaimed, true);
  assert.equal(
    g.inventory.slots.filter((s) => s?.id === "devin_sword").length,
    1,
  );
  const loaded = restoreRealm(
    g.world.seed,
    "overworld",
    exportRealm({ world: g.world, entities: [], drops: [] }),
  );
  g.world = loaded.world;
  g.entities = [];
  populateEncounters(g, createEntity);
  assert.equal(g.entities.length, 0);
  assert.equal(g.world.settlements["devin-temple"].defeated.length, 3);
});
test("Guardians telegraph melee, can be dodged, remain dormant in Peaceful and survive daylight", () => {
  const g = fixture();
  populateEncounters(g, createEntity);
  const e = g.entities[0];
  g.entities = [e];
  g.player.x = e.x;
  g.player.z = e.z + 1.6;
  for (let i = 0; i < 10; i++) tickSurvival(g);
  assert.equal(g.player.health, 20);
  assert.ok(e.windup > 0);
  for (let i = 0; i < 6; i++) tickSurvival(g);
  assert.ok(g.player.health < 20);
  const hp = g.player.health;
  g.player.z += 10;
  for (let i = 0; i < 20; i++) tickSurvival(g);
  assert.equal(g.player.health, hp);
  g.difficulty = "peaceful";
  for (let i = 0; i < 40; i++) tickSurvival(g);
  assert.ok(g.entities.some((v) => v.id === e.id));
  assert.equal(e.hp, 140);
  assert.equal(templeUnlocked(g), false);
});
test("jungle and savanna wildlife select pandas, koalas and day-active tigers with distinct behavior flags", () => {
  const jungle = new Set(
      Array.from({ length: 5 }, (_, i) => wildlifeForBiome("jungle", i)),
    ),
    savanna = new Set(
      Array.from({ length: 5 }, (_, i) => wildlifeForBiome("savanna", i)),
    );
  assert.ok(jungle.has("panda") && jungle.has("koala"));
  assert.ok(savanna.has("tiger"));
  assert.ok(MOB_INFO.panda.neutral);
  assert.ok(!MOB_INFO.koala.neutral);
  assert.ok(MOB_INFO.tiger.noSunBurn);
  assert.equal(wildlifeForBiome("emberwood", 0), "ash_deer");
  assert.equal(wildlifeForBiome("emberwood", 1), "cinderback");
  assert.ok(MOB_INFO.cinderback.neutral);
});
test("hail damages exposed Survival players, roofs shelter them and tornadoes apply bounded collision-aware motion", () => {
  const g = fixture(new World("storm"));
  Object.assign(g.player, { x: 8.5, y: 200, z: 8.5 });
  setWeather(g.world, "hail");
  g.world.weather.intensity = 1;
  g.world.tick = 60;
  tickWeather(g);
  assert.equal(g.player.health, 19);
  g.world.set(8, 203, 8, B.planks);
  g.world.tick = 120;
  tickWeather(g);
  assert.equal(g.player.health, 19);
  g.world.set(8, 203, 8, B.air);
  setWeather(g.world, "tornado");
  g.world.weather.intensity = 1;
  g.world.weather.funnel = { x: 16.5, z: 8.5, age: 20, seed: 1 };
  const highX = g.player.x;
  tickWeather(g);
  assert.equal(g.player.x, highX);
  g.player.y =
    Math.max(
      g.world.terrain(g.player.x, g.player.z).h,
      g.world.terrain(16.5, 8.5).h,
    ) + 4;
  const x = g.player.x;
  tickWeather(g);
  assert.notEqual(g.player.x, x);
  assert.ok(g.player.vy >= 4);
  const state = exportRealm({ world: g.world, entities: [], drops: [] }),
    loaded = restoreRealm(g.world.seed, "overworld", state);
  assert.deepEqual(loaded.world.weather, g.world.weather);
  setWeather(g.world, "clear");
  assert.equal(g.world.weather.funnel, null);
});
test("new Cinderworld horizon uses biome surfaces and structure silhouettes without voxel allocation", () => {
  const w = new World("Wildflower", {}, "cinderwild", 10),
    s = cinderSite(w, 0, 0),
    cx = Math.floor(s.x / 64) * 4,
    cz = Math.floor(s.z / 64) * 4;
  const mesh = meshHorizon(w, cx, cz, { span: 4 });
  assert.equal(w.chunks.size, 0);
  assert.ok(mesh.some(Boolean));
  for (const g of mesh.filter(Boolean))
    assert.ok(g.position.every(Number.isFinite));
  assert.ok(BLOCKS.length <= 65535);
  assert.equal(B.oak_door, 37);
  assert.equal(B.sugar_cane, 57);
});

test("natural seeded weather can generate hail and tornadoes as well as rain/thunder without Creative overrides", () => {
  const found = new Set();
  for (let seed = 0; seed < 240; seed++) {
    const w = new World("weather-" + seed),
      g = {
        world: w,
        player: { x: 8, y: 180, z: 8, health: 20 },
        mode: "creative",
      };
    w.weather.remaining = 1;
    w.tick = 1;
    tickWeather(g);
    found.add(w.weather.kind);
    assert.equal(w.weather.override, null);
    if (w.weather.kind === "tornado") assert.ok(w.weather.funnel);
  }
  assert.deepEqual([...found].sort(), [
    "clear",
    "hail",
    "rain",
    "thunder",
    "tornado",
  ]);
});
