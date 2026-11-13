import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import {
  BLOCKS,
  ITEMS,
  RECIPES,
  MOB_INFO,
  SPAWN_EGG_TYPES,
} from "../src/data.js";
const old = JSON.parse(
  readFileSync(
    new URL("../reference/end-baseline-2.19.0.json", import.meta.url),
  ),
);
const stable = (v) =>
  Array.isArray(v)
    ? v.map(stable)
    : v && typeof v === "object"
      ? Object.fromEntries(
          Object.keys(v)
            .sort()
            .map((k) => [k, stable(v[k])]),
        )
      : v;
const hash = (v) =>
  createHash("sha256")
    .update(JSON.stringify(stable(v)))
    .digest("hex");
test("all 2.19 saved block IDs, item/combat definitions, existing recipes and species stay compatible; only lava opacity changes", () => {
  assert.ok(BLOCKS.length > old.blocks.length);
  old.blocks.forEach((b, i) => {
    const current = { ...BLOCKS[i] };
    assert.equal(current.key, b.key);
    if (current.fluid?.type === "lava") {
      assert.equal(current.transparent, false);
      current.transparent = true;
    }
    assert.equal(hash(current), b.hash, b.key);
  });
  for (const [k, h] of Object.entries(old.items))
    assert.equal(hash(ITEMS[k]), h, k);
  const recipes = new Map(RECIPES.map((r) => [r.id, r]));
  for (const [k, h] of Object.entries(old.recipes))
    assert.equal(hash(recipes.get(k)), h, k);
  for (const [k, h] of Object.entries(old.mobs))
    assert.equal(hash(MOB_INFO[k]), h, k);
  assert.deepEqual(SPAWN_EGG_TYPES.slice(0, old.eggs.length), old.eggs);
});
