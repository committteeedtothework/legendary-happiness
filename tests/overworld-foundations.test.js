import test from "node:test";
import assert from "node:assert/strict";
import { B, BLOCKS, ITEMS, MOB_INFO, makeStack } from "../src/data.js";
import { Inventory, miningTicks, canHarvest } from "../src/inventory.js";
import { ENCHANTMENTS, enchantItem, reduceDamage } from "../src/equipment.js";
import {
  useLivestock,
  tickLivestock,
  livestockMotion,
} from "../src/livestock.js";
import {
  FARM_FOODS,
  FARM_GROW_TICKS,
  FARM_BREED_COOLDOWN,
  farmScale,
} from "../src/livestock-data.js";
import { createPlayer, collides } from "../src/physics.js";
import {
  createEntity,
  hitEntity,
  damageEntity,
  tickPlayerSurvival,
} from "../src/simulation.js";
import { blockHarvest } from "../src/harvest.js";
import { rayBody } from "../src/matthew.js";
import { pack, unpack } from "../src/storage.js";
import { paintInventoryArt, spawnEggPalette } from "../src/inventory-art.js";

function farm() {
  const cells = new Map(),
    key = (x, y, z) => [Math.floor(x), Math.floor(y), Math.floor(z)].join(",");
  const world = {
    dimension: "overworld",
    seedInt: 75,
    settlements: {},
    containers: {},
    terrain: () => ({ h: 199, biome: "meadow" }),
    get: (x, y, z) =>
      cells.get(key(x, y, z)) ?? (Math.floor(y) < 200 ? B.grass : B.air),
    set: (x, y, z, id) => cells.set(key(x, y, z), id),
    solid(x, y, z) {
      return !!BLOCKS[this.get(x, y, z)]?.solid;
    },
    skyHeight: () => 199,
  };
  return {
    world,
    inventory: new Inventory(),
    player: createPlayer({ x: 4.5, y: 200, z: 5.5 }),
    mode: "survival",
    dimension: "overworld",
    difficulty: "normal",
    elapsed: 10,
    tickCount: 20,
    entities: [],
    drops: [],
    renderer: { action() {}, combatImpact() {} },
    audio: { tone() {}, voice() {} },
    ui: { toast() {}, updateHUD() {}, updateHotbar() {} },
    damage() {},
  };
}
function animal(g, type = "cow", x = 4, z = 3) {
  const e = createEntity(g, type, x, z);
  e.onGround = true;
  g.entities.push(e);
  return e;
}
function hold(g, id, count = 1, enchantments) {
  g.inventory.slots[g.inventory.selected] = {
    ...makeStack(id, count),
    ...(enchantments ? { enchantments } : {}),
  };
}
test("all five existing farm species accept their own foods, follow food, breed one saved baby and respect the cooldown", () => {
  for (const [type, foods] of Object.entries(FARM_FOODS)) {
    const g = farm(),
      a = animal(g, type),
      b = animal(g, type, 5);
    hold(g, foods[0], 4);
    g.targetEntity = () => a;
    assert.equal(useLivestock(g), true);
    assert.equal(a.love, 600);
    assert.equal(g.inventory.held.count, 3);
    useLivestock(g);
    assert.equal(
      g.inventory.held.count,
      3,
      "repeated clicks cannot waste food",
    );
    g.targetEntity = () => b;
    useLivestock(g);
    tickLivestock(g, a);
    tickLivestock(g, b);
    assert.equal(g.entities.length, 3, type);
    const baby = g.entities[2];
    assert.equal(baby.type, type);
    assert.equal(baby.baby, true);
    assert.equal(baby.persistent, true);
    assert.equal(baby.growTicks, FARM_GROW_TICKS);
    assert.equal(farmScale(baby), 0.5);
    assert.ok(a.breedCooldown >= FARM_BREED_COOLDOWN - 1);
    assert.equal(a.love, 0);
    assert.equal(b.love, 0);
    const before = g.inventory.held.count;
    useLivestock(g);
    assert.equal(g.inventory.held.count, before);
    const saved = unpack(pack({ entities: g.entities }));
    assert.deepEqual(saved.entities, g.entities);
    baby.growTicks = 200;
    g.targetEntity = () => baby;
    useLivestock(g);
    assert.equal(baby.growTicks, 180);
    baby.growTicks = 1;
    tickLivestock(g, baby);
    assert.equal(baby.baby, false);
  }
  const g = farm(),
    e = animal(g);
  hold(g, "wheat");
  assert.ok(livestockMotion(g, e).speed > 0);
  hold(g, "coal");
  assert.equal(livestockMotion(g, e), null);
});
test("breeding rejects wrong species, invalid spawn space and saturated populations without losing the parents' eligibility", () => {
  const g = farm(),
    a = animal(g),
    b = animal(g, "woolling", 5);
  a.love = b.love = 600;
  tickLivestock(g, a);
  assert.equal(g.entities.length, 2);
  b.type = "cow";
  const get = g.world.get;
  g.world.get = (x, y, z) => (Math.floor(y) >= 200 ? B.stone : get(x, y, z));
  tickLivestock(g, a);
  assert.equal(g.entities.length, 2);
  assert.ok(a.love > 0);
  assert.equal(a.breedCooldown, undefined);
  g.world.get = get;
  for (let i = 0; i < 62; i++) animal(g, "cow");
  tickLivestock(g, a);
  assert.equal(g.entities.length, 64);
});
test("baby growth waits for an adult-sized clearance and rays/collisions use the visible half-sized body", () => {
  const g = farm(),
    baby = animal(g);
  baby.baby = true;
  baby.growTicks = 1;
  g.world.set(4, 201, 3, B.stone);
  tickLivestock(g, baby);
  assert.equal(baby.baby, true);
  assert.equal(baby.growTicks, 0);
  assert.equal(
    collides(
      g.world,
      baby,
      MOB_INFO.cow.height * 0.5,
      MOB_INFO.cow.width * 0.5,
    ),
    false,
  );
  const origin = { x: baby.x, y: baby.y + 1, z: baby.z + 3 },
    dir = { x: 0, y: 0, z: -1 };
  assert.equal(rayBody(origin, dir, baby, 6), null);
  assert.ok(rayBody(origin, dir, { ...baby, baby: false }, 6) > 0);
  g.world.set(4, 201, 3, B.air);
  tickLivestock(g, baby);
  assert.equal(baby.baby, false);
  baby.baby = true;
  const xp = g.player.xp;
  damageEntity(g, baby, 100, { knockback: 0 });
  assert.equal(g.drops.length, 0);
  assert.equal(g.player.xp, xp);
});
test("cow milking, drinking and stacked buckets conserve containers and reject a full inventory atomically", () => {
  const g = farm(),
    cow = animal(g);
  g.targetEntity = () => cow;
  hold(g, "bucket", 3);
  useLivestock(g);
  assert.equal(g.inventory.held.count, 2);
  assert.equal(
    g.inventory.slots.filter((s) => s?.id === "milk_bucket").length,
    1,
  );
  g.inventory.selected = 1;
  g.player.effects = {
    poison: { ticks: 20, level: 1 },
    resistance: { ticks: 40, level: 3 },
  };
  useLivestock(g);
  assert.equal(g.inventory.held.id, "bucket");
  assert.deepEqual(g.player.effects, {});
  g.inventory.selected = 0;
  for (let i = 1; i < 36; i++) g.inventory.slots[i] = makeStack("stone", 64);
  const saved = JSON.stringify(g.inventory);
  useLivestock(g);
  assert.equal(JSON.stringify(g.inventory), saved);
  hold(g, "bucket");
  useLivestock(g);
  assert.equal(
    g.inventory.held.id,
    "milk_bucket",
    "single bucket can replace itself in a full bag",
  );
  hold(g, "bucket");
  cow.baby = true;
  assert.equal(useLivestock(g), false);
  assert.equal(g.inventory.held.id, "bucket");
});
test("adult chickens lay one persisted egg on their timer and sheep regain fleece only after eating the same grass block", () => {
  const g = farm(),
    chicken = animal(g, "chicken");
  chicken.eggTicks = 1;
  tickLivestock(g, chicken);
  assert.equal(g.drops.length, 1);
  assert.equal(g.drops[0].id, "egg");
  assert.ok(chicken.eggTicks >= 6000 && chicken.eggTicks < 12000);
  const restored = unpack(pack(chicken));
  tickLivestock(g, restored);
  assert.equal(g.drops.length, 1);
  chicken.baby = true;
  chicken.eggTicks = 1;
  tickLivestock(g, chicken);
  assert.equal(g.drops.length, 1);
  const sheep = animal(g, "woolling");
  sheep.sheared = true;
  sheep.grazeTicks = 1;
  sheep.grazeAt = { x: 4, y: 199, z: 3, id: B.grass };
  tickLivestock(g, sheep);
  assert.equal(sheep.sheared, false);
  assert.equal(g.world.get(4, 199, 3), B.dirt);
  sheep.sheared = true;
  sheep.grazeTicks = 1;
  g.world.set(4, 199, 3, B.stone);
  tickLivestock(g, sheep);
  assert.equal(sheep.sheared, true);
  assert.equal(g.world.get(4, 199, 3), B.stone);
});
test("Silk Touch harvests glass, ores, leaves and turtle eggs without XP; Fortune affects only supported yields", () => {
  const silk = {
    ...makeStack("diamond_pickaxe"),
    enchantments: { silk_touch: 1 },
  };
  for (const [id, key, count] of [
    [B.glass, "glass", 1],
    [B.leaves, "leaves", 1],
    [B.diamond_ore, "diamond_ore", 1],
    [B.cherry_leaves, "cherry_leaves", 1],
    [B.turtle_egg_4_0, "turtle_egg_1_0", 4],
  ]) {
    const result = blockHarvest(id, silk);
    assert.deepEqual(result.drops, [makeStack(key, count)]);
    assert.equal(result.xp, 0);
  }
  const fortune = {
    ...makeStack("diamond_pickaxe"),
    enchantments: { fortune: 3 },
  };
  assert.equal(
    blockHarvest(B.diamond_ore, fortune, null, () => 0.999).drops[0].count,
    4,
  );
  assert.equal(
    blockHarvest(B.gravel, fortune, null, () => 0.999).drops[0].id,
    "flint",
  );
  for (const id of [B.iron_block, B.chest, B.diamond_block])
    assert.equal(
      blockHarvest(id, fortune, null, () => 0.999).drops[0].count,
      1,
    );
  const double = BLOCKS.findIndex(
    (b) =>
      b.edition && b.editionFamily === "oak_slab" && b.state?.half === "double",
  );
  const slab =
    double < 0
      ? BLOCKS.findIndex(
          (b) => b.key.startsWith("oak_slab") && b.state?.half === "double",
        )
      : double;
  assert.ok(slab > 0);
  assert.equal(blockHarvest(slab, fortune).drops[0].count, 2);
  assert.equal(
    canHarvest(BLOCKS[B.diamond_ore], {
      ...makeStack("wooden_pickaxe"),
      enchantments: { silk_touch: 1 },
    }),
    false,
  );
});
test("new enchantments enforce conflicts before charging XP/lapis and preserve the existing upgrade transaction", () => {
  const g = farm();
  g.player.xp = 200;
  hold(g, "diamond_pickaxe", 1, { fortune: 1 });
  g.inventory.slots[1] = makeStack("lapis_lazuli", 32);
  let before = JSON.stringify(g.inventory),
    xp = g.player.xp;
  assert.equal(enchantItem(g, 0, "silk_touch").ok, false);
  assert.equal(JSON.stringify(g.inventory), before);
  assert.equal(g.player.xp, xp);
  assert.equal(enchantItem(g, 0, "fortune").ok, true);
  assert.equal(g.inventory.held.enchantments.fortune, 2);
  assert.equal(g.player.xp, xp - 10);
  hold(g, "diamond_sword", 1, { smite: 1 });
  assert.equal(enchantItem(g, 0, "sharpness").ok, false);
  hold(g, "iron_helmet", 1, { fire_protection: 1 });
  assert.equal(enchantItem(g, 0, "protection").ok, false);
  assert.equal(enchantItem(g, 0, "respiration").ok, true);
  assert.equal(Object.keys(ENCHANTMENTS).length, 24);
});
test("specialized armor protection, Aqua Affinity and Respiration change actual damage/mining/air with no free general protection", () => {
  const base = new Inventory(),
    fire = new Inventory(),
    blast = new Inventory(),
    arrows = new Inventory();
  for (const inv of [base, fire, blast, arrows])
    inv.equipment[0] = makeStack("iron_helmet");
  fire.equipment[0].enchantments = { fire_protection: 4 };
  blast.equipment[0].enchantments = { blast_protection: 4 };
  arrows.equipment[0].enchantments = { projectile_protection: 4 };
  for (const [inv, cause] of [
    [fire, "fire"],
    [blast, "a Creeper explosion"],
    [arrows, "Skeleton projectile"],
  ])
    assert.ok(reduceDamage(inv, 8, cause) < reduceDamage(base, 8, cause));
  assert.equal(
    reduceDamage(fire, 8, "a spider"),
    reduceDamage(base, 8, "a spider"),
  );
  const pick = makeStack("diamond_pickaxe"),
    helmet = {
      ...makeStack("iron_helmet"),
      enchantments: { aqua_affinity: 1, respiration: 3 },
    };
  assert.equal(
    miningTicks(BLOCKS[B.stone], pick, true, false, helmet),
    miningTicks(BLOCKS[B.stone], pick),
  );
  assert.ok(
    miningTicks(BLOCKS[B.stone], pick, true) >
      miningTicks(BLOCKS[B.stone], pick),
  );
  const g = farm();
  g.inventory.equipment[0] = helmet;
  g.player.underwater = true;
  g.world.get = () => B.water;
  g.world.solid = () => false;
  for (let i = 1; i <= 40; i++) {
    g.tickCount = i;
    tickPlayerSurvival(g);
  }
  assert.equal(g.player.oxygen, 290);
});
test("Smite and Bane affect only their targets, Fire Aspect ignites and Looting increases ordinary mob drops once", () => {
  const strike = (type, ench) => {
    const g = farm(),
      e = animal(g, type);
    e.hp = 100;
    hold(g, "diamond_sword", 1, ench);
    g.lastAttack = -10;
    const dealt = hitEntity(g, e);
    return { g, e, dealt };
  };
  assert.ok(strike("zombie", { smite: 5 }).dealt > strike("zombie", {}).dealt);
  assert.equal(strike("cow", { smite: 5 }).dealt, strike("cow", {}).dealt);
  const spider = strike("spider", { bane_of_arthropods: 5 });
  assert.ok(spider.e.baneSlowTicks > 0);
  assert.ok(spider.dealt > strike("spider", {}).dealt);
  assert.equal(strike("cow", { fire_aspect: 2 }).e.burningTicks, 160);
  const g = farm(),
    mob = animal(g, "zombie"),
    old = Math.random;
  try {
    Math.random = () => 0.999;
    damageEntity(g, mob, 100, { looting: 3, knockback: 0 });
  } finally {
    Math.random = old;
  }
  assert.equal(g.drops.find((d) => d.id === "rotten_flesh").count, 4);
  const count = g.drops.length;
  damageEntity(g, mob, 100, { looting: 3, knockback: 0 });
  assert.equal(g.drops.length, count);
});
test("spawn eggs have species-specific palettes and every new family painter writes visible colored pixels", () => {
  assert.notDeepEqual(spawnEggPalette("zombie"), spawnEggPalette("creeper"));
  assert.notDeepEqual(spawnEggPalette("cow"), spawnEggPalette("chicken"));
  for (const id of [
    "cow_spawn_egg",
    "creeper_spawn_egg",
    "egg",
    "compass",
    "clock",
    "redstone",
    "milk_bucket",
    "diamond",
    "amethyst_shard",
    "slime_ball",
  ]) {
    const colors = new Set(),
      ctx = {
        set fillStyle(c) {
          assert.match(c, /^#[a-f\d]{6}$/i);
          colors.add(c);
        },
        fillRect(x, y, w, h) {
          assert.ok(x >= 0 && y >= 0 && x + w <= 32 && y + h <= 32, id);
        },
      };
    assert.equal(paintInventoryArt(ctx, id, ITEMS[id]), true, id);
    assert.ok(colors.size >= 2, id);
  }
});
