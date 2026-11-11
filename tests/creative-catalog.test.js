import test from "node:test";
import assert from "node:assert/strict";
import {
  CREATIVE_TABS,
  CREATIVE_ENTRIES,
  creativeCategory,
  creativeEntries,
  creativeWindow,
} from "../src/creative-catalog.js";
import { ITEMS, CREATIVE_ITEMS } from "../src/data.js";
test("all Creative entries belong to exactly one variety and retain their authoritative inventory index", () => {
  const tabs = CREATIVE_TABS.filter(
    (t) => !["search", "inventory", "stands"].includes(t.id),
  );
  const assigned = tabs.flatMap((t) => creativeEntries(t.id));
  assert.equal(assigned.length, CREATIVE_ITEMS.length);
  assert.equal(new Set(assigned.map((e) => e.id)).size, CREATIVE_ITEMS.length);
  for (const e of assigned) {
    assert.equal(CREATIVE_ITEMS[e.index], e.id);
    assert.ok(ITEMS[e.id]);
  }
  for (const t of CREATIVE_TABS) assert.ok(ITEMS[t.icon], t.id);
  assert.equal(creativeEntries("search").length, CREATIVE_ITEMS.length);
  assert.deepEqual(creativeEntries("bad-category"), []);
});
test("categories distinguish natural resources, colored materials, devices, tools, armor, weapons and custom content", () => {
  for (const [id, category] of Object.entries({
    planks: "building",
    cherry_stairs: "building",
    red_concrete: "colors",
    wool: "colors",
    red_sand: "natural",
    copper_ore: "natural",
    poppy: "natural",
    redstone: "redstone",
    tnt: "redstone",
    crafting_table: "functional",
    cherry_door: "functional",
    music_disc_amber: "functional",
    oak_boat: "tools",
    bucket: "tools",
    spyglass: "tools",
    arrow: "combat",
    netherite_chestplate: "combat",
    matthew_dual_pistols: "combat",
    devin_sword: "combat",
    carrot: "food",
    iron_ingot: "ingredients",
    palm_tablet: "ingredients",
    cinder_roc_spawn_egg: "spawn",
  }))
    assert.equal(creativeCategory(id), category, id);
});
test("material families stay together and searches combine words across display names and item IDs", () => {
  const building = creativeEntries("building").map((e) => e.id);
  assert.ok(building.indexOf("planks") < building.indexOf("oak_stairs"));
  assert.ok(building.indexOf("oak_slab") < building.indexOf("spruce_planks"));
  const all = creativeEntries("search", "CHERRY stairs");
  assert.deepEqual(
    all.map((e) => e.id),
    ["cherry_stairs"],
  );
  assert.equal(creativeEntries("combat", "cherry").length, 0);
  assert.ok(
    creativeEntries("search", "cinder roc").some(
      (e) => e.id === "cinder_roc_spawn_egg",
    ),
  );
  assert.deepEqual(creativeEntries("search", "nothing-like-this-12345"), []);
});
test("scroll virtualization reaches the entire catalog, keeps windows bounded, and handles empty/end views", () => {
  const seen = new Set(),
    count = CREATIVE_ENTRIES.length;
  for (let row = 0; row < Math.ceil(count / 9); row++) {
    const w = creativeWindow(count, row * 48, 48);
    assert.ok(w.end - w.start <= 63);
    assert.equal(w.start % 9, 0);
    assert.ok(w.offset >= 0 && w.height >= 240);
    for (let i = w.start; i < Math.min(count, w.end); i++) seen.add(i);
  }
  assert.equal(seen.size, count);
  const end = creativeWindow(count, 1e9, 48);
  assert.ok(end.end >= count);
  assert.equal(end.scrollTop, end.height - 240);
  const empty = creativeWindow(0, -500, 32);
  assert.deepEqual(empty, {
    start: 0,
    end: 45,
    offset: 0,
    height: 160,
    scrollTop: 0,
  });
});
