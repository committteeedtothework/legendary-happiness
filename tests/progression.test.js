import test from "node:test";
import assert from "node:assert/strict";
import { B, BLOCKS, ITEMS, RECIPES, makeStack } from "../src/data.js";
import { Inventory, compatible, miningTicks } from "../src/inventory.js";
import {
  equipHeld,
  armorStats,
  reduceDamage,
  enchantItem,
  wear,
} from "../src/equipment.js";
import { World } from "../src/world.js";
import { createPlayer, collides } from "../src/physics.js";
import { relicSite, extractRelic, resetExtraction } from "../src/relic.js";
import { hitEntity, devinPulse } from "../src/simulation.js";
import { exportRealm, restoreRealm } from "../src/realms.js";
import { ambienceSamples } from "../src/soundscape.js";

function game() {
  const world = new World("Wildflower", {}, "overworld", 6),
    p = relicSite(world);
  const g = {
    world,
    mode: "survival",
    dimension: "overworld",
    running: true,
    mouseDown: true,
    inventory: new Inventory(),
    player: createPlayer(
      { x: p.x + 0.5, y: p.y, z: p.z + 2.8 },
      { onGround: true },
    ),
    entities: [],
    drops: [],
    elapsed: 10,
    tickCount: 100,
    settings: { renderDistance: 2 },
    audio: { tone() {} },
    ui: { updateHotbar() {}, updateHUD() {}, toast() {}, announce() {} },
    save: async () => {},
  };
  g.target = { x: p.x, y: p.y + 1, z: p.z, id: B.devin_relic_blade };
  world.get(p.x, p.y, p.z);
  return g;
}
function victim(g, type = "shade", hp = 60, dx = 0, dz = -2) {
  return {
    id: `${type}:${dx}:${dz}`,
    type,
    hp,
    x: g.player.x + dx,
    y: g.player.y,
    z: g.player.z + dz,
    vx: 0,
    vy: 0,
    vz: 0,
    onGround: true,
  };
}
test("all armor and spear recipes consume real ingredients and produce one correctly typed item", () => {
  for (const recipe of RECIPES.filter(
    (r) =>
      ITEMS[r.result].armorSlot !== undefined ||
      ITEMS[r.result].tool === "spear",
  )) {
    const inv = new Inventory();
    if (recipe.ingredients)
      recipe.ingredients.forEach(
        (id, i) => (inv.craft[i] = makeStack(Array.isArray(id) ? id[0] : id)),
      );
    else
      recipe.pattern.forEach((row, y) =>
        [...row].forEach((c, x) => {
          if (recipe.key[c])
            inv.craft[y * 3 + x] = makeStack(
              Array.isArray(recipe.key[c]) ? recipe.key[c][0] : recipe.key[c],
            );
        }),
      );
    assert.equal(inv.craftOne(3, recipe.station || "table"), true, recipe.id);
    assert.equal(inv.cursor.id, recipe.result);
    assert.equal(inv.cursor.count, 1);
    assert.ok(inv.craft.every((s) => !s));
    assert.equal(inv.craftOne(3, recipe.station || "table"), false);
    assert.equal(ITEMS[recipe.result].stack, 1);
  }
});
test("right-click equipment swaps atomically, preserves enchantments and restores from inventory saves", () => {
  const inv = new Inventory();
  inv.slots[0] = {
    ...makeStack("iron_chestplate"),
    enchantments: { protection: 2 },
  };
  inv.equipment[1] = makeStack("leather_chestplate");
  assert.equal(equipHeld(inv), true);
  assert.equal(inv.held.id, "leather_chestplate");
  assert.equal(inv.equipment[1].enchantments.protection, 2);
  assert.deepEqual(new Inventory(inv.export()).equipment, inv.equipment);
  inv.slots[0] = makeStack("iron_spear");
  const before = JSON.stringify(inv.export());
  assert.equal(equipHeld(inv), false);
  assert.equal(JSON.stringify(inv.export()), before);
});
test("iron and diamond armor reduce physical damage with toughness, wear, breakage and bypass rules", () => {
  for (const material of ["iron", "diamond"]) {
    const inv = new Inventory();
    ["helmet", "chestplate", "leggings", "boots"].forEach(
      (slot, i) => (inv.equipment[i] = makeStack(`${material}_${slot}`)),
    );
    const before = inv.equipment[1].durability,
      dealt = reduceDamage(inv, 10, "a night shade");
    assert.ok(dealt > 0 && dealt < 10);
    assert.equal(inv.equipment[1].durability, before - 2);
    assert.equal(reduceDamage(inv, 10, "a fall"), 10);
    assert.equal(reduceDamage(inv, 10, "the void"), 10);
    assert.equal(armorStats(inv).armor, material === "iron" ? 15 : 20);
  }
  const inv = new Inventory();
  inv.equipment[0] = { ...makeStack("iron_helmet"), durability: 1 };
  reduceDamage(inv, 8, "a night shade");
  assert.equal(inv.equipment[0], null);
});
test("Protection and Feather Falling apply capped damage reduction while hunger and void bypass", () => {
  const inv = new Inventory();
  inv.equipment[3] = {
    ...makeStack("diamond_boots"),
    enchantments: { feather_falling: 4, protection: 4 },
  };
  assert.ok(Math.abs(reduceDamage(inv, 10, "a fall") - 3.6) < 0.0001);
  assert.equal(reduceDamage(inv, 10, "starvation"), 10);
  assert.equal(reduceDamage(inv, 10, "the void"), 10);
});
test("enchanting charges exact XP/lapis only on successful compatible upgrades and respects maximum levels", () => {
  const g = game();
  g.player.xp = 100;
  g.inventory.slots[0] = makeStack("iron_sword");
  g.inventory.slots[1] = makeStack("lapis_lazuli", 10);
  assert.equal(enchantItem(g, 0, "sharpness").ok, true);
  assert.equal(g.player.xp, 95);
  assert.equal(g.inventory.slots[1].count, 9);
  assert.equal(enchantItem(g, 0, "sharpness").ok, true);
  assert.equal(g.player.xp, 85);
  assert.equal(g.inventory.slots[1].count, 7);
  const before = JSON.stringify(g.inventory.export());
  assert.equal(enchantItem(g, 0, "protection").ok, false);
  assert.equal(JSON.stringify(g.inventory.export()), before);
  g.inventory.slots[0].enchantments.sharpness = 5;
  assert.equal(enchantItem(g, 0, "sharpness").ok, false);
  g.inventory.slots[0].enchantments = {};
  g.player.xp = 0;
  assert.equal(enchantItem(g, 0, "sharpness").ok, false);
  assert.equal(g.inventory.slots[1].count, 7);
});
test("Creative enchanting is free and Creative combat no longer consumes weapon durability", () => {
  const g = game();
  g.mode = "creative";
  g.inventory.slots[0] = makeStack("iron_sword");
  assert.equal(enchantItem(g, 0, "sharpness").ok, true);
  assert.equal(g.player.xp, 0);
  const before = g.inventory.held.durability;
  hitEntity(g, victim(g));
  assert.equal(g.inventory.held.durability, before);
});
test("metadata is deep-copied and distinct enchantments cannot stack or overwrite each other", () => {
  const a = { ...makeStack("iron_sword"), enchantments: { sharpness: 1 } },
    b = { ...makeStack("iron_sword"), enchantments: { sharpness: 2 } };
  assert.equal(compatible(a, b), false);
  assert.equal(compatible(a, { ...a, enchantments: { sharpness: 1 } }), true);
  const inv = new Inventory({ slots: [a] });
  inv.slots[0].enchantments.sharpness = 5;
  assert.equal(a.enchantments.sharpness, 1);
  const original = new Inventory();
  original.equipment[0] = {
    ...makeStack("iron_helmet"),
    enchantments: { protection: 2 },
  };
  const copy = new Inventory(original.export());
  copy.equipment[0].enchantments.protection = 4;
  assert.equal(original.equipment[0].enchantments.protection, 2);
});
test("Efficiency speeds correct tools, Unbreaking avoids wear, and legendary equipment is unbreakable", () => {
  const stack = makeStack("iron_pickaxe"),
    normal = miningTicks(BLOCKS[B.stone], stack);
  stack.enchantments = { efficiency: 3 };
  assert.ok(miningTicks(BLOCKS[B.stone], stack) < normal);
  stack.enchantments = { unbreaking: 3 };
  const before = stack.durability;
  wear(stack, 20, () => 0.5);
  assert.equal(stack.durability, before);
  wear(stack, 1, () => 0);
  assert.equal(stack.durability, before - 1);
  assert.equal(wear(makeStack("devin_sword"), 1000), false);
});
test("Sharpness adds real damage and Knockback pushes without penetrating walls", () => {
  const g = game();
  g.inventory.slots[0] = {
    ...makeStack("iron_sword"),
    enchantments: { sharpness: 3, knockback: 2 },
  };
  const e = victim(g, "shade", 50, 1, 0);
  for (let y = Math.floor(e.y); y < e.y + 3; y++)
    g.world.set(Math.floor(e.x) + 1, y, Math.floor(e.z), B.stone);
  hitEntity(g, e);
  assert.equal(e.hp, 42);
  assert.equal(collides(g.world, e, 1.95), false);
});
test("relic site and linked sword blocks are deterministic across chunk order and absent in legacy/different realms", () => {
  const a = new World("Wildflower"),
    b = new World("Wildflower"),
    p = relicSite(a);
  assert.deepEqual(p, relicSite(b));
  b.ensure(Math.floor(p.x / 16) + 1, Math.floor(p.z / 16));
  assert.equal(a.get(p.x, p.y, p.z), B.devin_relic_base);
  assert.equal(b.get(p.x, p.y + 1, p.z), B.devin_relic_blade);
  assert.equal(relicSite(new World("Wildflower", {}, "overworld", 2)), null);
  assert.equal(relicSite(new World("Wildflower", {}, "cinderwild")), null);
});
test("extraction requires the full 30000 ms and awards exactly one uniquely identified sword", () => {
  const g = game();
  extractRelic(g, g.target, 100);
  extractRelic(g, g.target, 30099);
  assert.equal(g.world.relicClaimed, false);
  assert.equal(g.inventory.slots.filter(Boolean).length, 0);
  extractRelic(g, g.target, 30100);
  assert.equal(g.world.relicClaimed, true);
  assert.equal(
    g.inventory.slots.filter((s) => s?.id === "devin_sword").length,
    1,
  );
  assert.ok(g.inventory.slots.find(Boolean).origin);
  extractRelic(g, g.target, 99999);
  assert.equal(g.inventory.slots.filter(Boolean).length, 1);
});
test("release, menus, aim changes and leaving reach cancel extraction without carrying progress", () => {
  for (const cancel of [
    (g) => (g.mouseDown = false),
    (g) => (g.running = false),
    (g) => (g.target = { ...g.target, id: B.stone }),
    (g) => (g.player.x += 20),
    (g) => (g.player.health = 0),
  ]) {
    const g = game();
    extractRelic(g, g.target, 0);
    extractRelic(g, g.target, 29000);
    cancel(g);
    extractRelic(g, g.target, 30000);
    assert.equal(g.extraction, null);
    assert.equal(g.world.relicClaimed, false);
  }
  const g = game();
  extractRelic(g, g.target, 0);
  resetExtraction(g);
  extractRelic(g, g.target, 30000);
  assert.equal(g.extraction.progress, 0);
});
test("full inventory cannot consume the planted sword; freeing space permits a single claim", () => {
  const g = game();
  g.inventory.slots = Array.from({ length: 36 }, () => makeStack("stone", 64));
  extractRelic(g, g.target, 0);
  extractRelic(g, g.target, 30000);
  assert.equal(g.world.relicClaimed, false);
  assert.equal(
    g.world.get(g.target.x, g.target.y, g.target.z),
    B.devin_relic_blade,
  );
  g.inventory.slots[0] = null;
  extractRelic(g, g.target, 30001);
  assert.equal(g.world.relicClaimed, true);
  assert.equal(g.inventory.slots[0].id, "devin_sword");
});
test("claimed relic edits and the sword origin/enchantments survive realm and inventory serialization", () => {
  const g = game();
  extractRelic(g, g.target, 0);
  extractRelic(g, g.target, 30000);
  const state = restoreRealm(
    g.world.seed,
    "overworld",
    exportRealm({ world: g.world, entities: [], drops: [] }),
  );
  assert.equal(state.world.relicClaimed, true);
  assert.equal(state.world.get(g.target.x, g.target.y, g.target.z), B.air);
  assert.deepEqual(
    new Inventory(g.inventory.export()).slots,
    g.inventory.slots,
  );
});
test("Devin's Pulse hits visible hostiles only, respects walls and cooldown, and grants no duplicate kill XP", () => {
  const g = game();
  g.inventory.slots[0] = makeStack("devin_sword");
  const a = victim(g, "shade", 5, 0, -2),
    b = victim(g, "stalker", 20, 3, 0),
    cow = victim(g, "cow", 10, 1, -1),
    villager = victim(g, "villager", 20, -1, -1);
  g.entities = [a, b, cow, villager];
  for (let y = Math.floor(g.player.y); y < g.player.y + 3; y++)
    g.world.set(Math.floor(g.player.x) + 2, y, Math.floor(g.player.z), B.stone);
  assert.equal(devinPulse(g), true);
  assert.ok(a.hp <= 0);
  assert.equal(b.hp, 20);
  assert.equal(cow.hp, 10);
  assert.equal(villager.hp, 20);
  assert.equal(g.player.xp, 5);
  assert.equal(devinPulse(g), false);
  assert.equal(g.player.xp, 5);
  g.tickCount += 200;
  assert.equal(devinPulse(g), true);
  assert.equal(g.player.xp, 5);
});
test("fully charged Devin Sword hits heal once; weak rapid hits cannot be used for unlimited healing", () => {
  const g = game();
  g.inventory.slots[0] = makeStack("devin_sword");
  g.player.health = 10;
  const e = victim(g);
  hitEntity(g, e);
  assert.equal(g.player.health, 11);
  hitEntity(g, e);
  assert.equal(g.player.health, 11);
  assert.equal(g.inventory.held.durability, undefined);
});
test("sugar cane grows to three blocks beside water, supports paper/book recipes, and stops when dry", () => {
  const w = new World("cane");
  w.set(0, 198, 0, B.stone);
  w.set(0, 199, 0, B.sand);
  w.set(1, 199, 0, B.water);
  w.set(0, 200, 0, B.sugar_cane);
  for (let i = 0; i < 800; i++) w.simulate();
  assert.equal(w.get(0, 202, 0), B.sugar_cane);
  assert.equal(w.get(0, 203, 0), B.air);
  assert.ok(RECIPES.find((r) => r.id === "paper"));
  assert.ok(RECIPES.find((r) => r.id === "book"));
  w.set(1, 199, 0, B.air);
  w.set(0, 201, 0, B.air);
  w.set(0, 202, 0, B.air);
  for (let i = 0; i < 400; i++) w.simulate();
  assert.equal(w.get(0, 201, 0), B.air);
});
test("all ambient preview samples contain finite, bounded, distinct original audio with click-free edges", () => {
  const fingerprints = [];
  for (const kind of ["wind", "water", "night", "rumble"]) {
    const data = ambienceSamples(kind, 8000, 1);
    assert.ok(data.every(Number.isFinite));
    assert.ok(Math.max(...data.map(Math.abs)) <= 0.7);
    assert.ok(data.some((v) => Math.abs(v) > 0.01));
    assert.ok(Math.abs(data[0]) < 0.001);
    assert.ok(Math.abs(data.at(-1)) < 0.01);
    fingerprints.push(data.reduce((s, x, i) => s + x * (i % 19), 0).toFixed(5));
  }
  assert.equal(new Set(fingerprints).size, 4);
});
