import test from "node:test";
import assert from "node:assert/strict";
import { Inventory } from "../src/inventory.js";
import { RECIPES, makeStack } from "../src/data.js";
import { inventoryPointerLook } from "../src/skin-preview.js";
const recipe = (id) => RECIPES.find((r) => r.id === id || r.result === id);
const totals = (inv) => {
  const counts = {};
  for (const s of [...inv.slots, ...inv.craft, ...inv.offhand, inv.cursor])
    if (s) counts[s.id] = (counts[s.id] || 0) + s.count;
  return counts;
};
test("book fills personal shaped and shapeless recipes atomically without consuming items or borrowing the cursor/offhand", () => {
  const inv = new Inventory();
  inv.slots[0] = makeStack("log", 3);
  inv.offhand[0] = makeStack("diamond", 2);
  inv.cursor = makeStack("apple", 4);
  const r = recipe("planks"),
    before = totals(inv);
  assert.ok(inv.canAutofill(r, 2));
  assert.equal(inv.autofill(r, 2), null);
  assert.equal(inv.recipe(2).result, r.result);
  assert.deepEqual(totals(inv), before);
  assert.equal(inv.offhand[0].id, "diamond");
  assert.equal(inv.cursor.count, 4);
  assert.equal(inv.craftOne(2), false);
  assert.equal(
    inv.cursor.id,
    "apple",
    "incompatible cursor must prevent output",
  );
});
test("full inventory can fill a recipe when reserving ingredients frees room for old grid contents; failures preserve everything", () => {
  const inv = new Inventory();
  inv.slots.fill(null);
  for (let i = 0; i < 36; i++) inv.slots[i] = makeStack("cobblestone", 64);
  inv.slots[0] = makeStack("log", 1);
  inv.craft[0] = makeStack("apple", 1);
  const before = totals(inv);
  assert.equal(inv.autofill(recipe("planks"), 2), null);
  assert.deepEqual(totals(inv), before);
  assert.equal(inv.slots[0].id, "apple");
  const blocked = new Inventory();
  for (let i = 0; i < 36; i++) blocked.slots[i] = makeStack("cobblestone", 64);
  blocked.slots[0] = makeStack("log", 2);
  blocked.craft[0] = makeStack("apple", 1);
  const snapshot = JSON.stringify(blocked.export());
  assert.equal(blocked.canAutofill(recipe("planks"), 2), false);
  assert.match(blocked.autofill(recipe("planks"), 2), /room/);
  assert.equal(JSON.stringify(blocked.export()), snapshot);
});
test("matching large crafting stacks stay ready even with no room in inventory; missing materials and oversized recipes cannot alter stacks", () => {
  const inv = new Inventory();
  for (let i = 0; i < 36; i++) inv.slots[i] = makeStack("cobblestone", 64);
  inv.craft[0] = makeStack("log", 64);
  const before = JSON.stringify(inv.export());
  assert.equal(inv.autofill(recipe("planks"), 2), null);
  assert.equal(JSON.stringify(inv.export()), before);
  const table = recipe("wooden_pickaxe");
  assert.match(inv.autofill(table, 2), /crafting table/);
  assert.equal(JSON.stringify(inv.export()), before);
  const missing = new Inventory();
  const empty = JSON.stringify(missing.export());
  assert.equal(missing.canAutofill(table, 3), false);
  assert.match(missing.autofill(table, 3), /ingredients/);
  assert.equal(JSON.stringify(missing.export()), empty);
});
test("tag alternatives, shapeless placement and metadata survive repeated book filling with no duplication", () => {
  const inv = new Inventory();
  inv.slots[0] = {
    ...makeStack("log", 4),
    origin: "test",
    mapTarget: { x: 12, z: 9 },
  };
  const r = recipe("planks"),
    before = totals(inv);
  for (let i = 0; i < 50; i++) {
    assert.equal(inv.autofill(r, 2), null);
    assert.deepEqual(totals(inv), before);
  }
  inv.craft.find(Boolean).mapTarget.x = 99;
  assert.equal(inv.slots.find((s) => s?.id === "log").mapTarget.x, 12);
  const tagged = {
    id: "test-tagged",
    result: "stick",
    count: 4,
    ingredients: [["planks", "oak_planks"], "planks"],
  };
  const b = new Inventory();
  b.slots[0] = makeStack("oak_planks", 1);
  b.slots[1] = makeStack("planks", 1);
  assert.equal(b.autofill(tagged, 2), null);
  assert.equal(b.craft[0].id, "oak_planks");
  assert.equal(b.craft[1].id, "planks");
});
test("offhand storage persists independently and older inventory saves gain an empty pocket", () => {
  const inv = new Inventory({ slots: [makeStack("log", 3)] });
  assert.deepEqual(inv.offhand, [null]);
  inv.offhand[0] = { ...makeStack("shield"), enchantments: { unbreaking: 2 } };
  const copy = new Inventory(inv.export());
  assert.deepEqual(copy.offhand, inv.offhand);
  copy.offhand[0].enchantments.unbreaking = 3;
  assert.equal(inv.offhand[0].enchantments.unbreaking, 2);
  const before = totals(inv);
  inv.click(inv.offhand, 0);
  inv.click(inv.slots, 4);
  assert.deepEqual(totals(inv), before);
  assert.equal(inv.slots[4].id, "shield");
});
test("inventory model looks toward the pointer with bounded head pitch/yaw even far outside its frame", () => {
  const rect = { left: 100, top: 100, width: 100, height: 160 };
  const center = inventoryPointerLook(rect, 150, 143.2);
  assert.equal(center.yaw, 0);
  assert.ok(Math.abs(center.pitch) < 1e-10);
  assert.ok(inventoryPointerLook(rect, 300, 143).yaw > 0);
  assert.ok(inventoryPointerLook(rect, 0, 143).yaw < 0);
  assert.ok(inventoryPointerLook(rect, 150, 0).pitch > 0);
  assert.ok(inventoryPointerLook(rect, 150, 500).pitch < 0);
  for (const [x, y] of [
    [-1e8, -1e8],
    [1e8, 1e8],
  ]) {
    const p = inventoryPointerLook(rect, x, y);
    assert.ok(Math.abs(p.yaw) <= 0.75);
    assert.ok(Math.abs(p.pitch) <= 0.45);
  }
});
