import test from "node:test";
import assert from "node:assert/strict";
import { World, index } from "../src/world.js";
import { BIOMES, variedTerrain, surfaceBlock } from "../src/biomes.js";
import { B, BLOCKS, RECIPES, SMELTS, FUELS, makeStack } from "../src/data.js";
import { hashSeed } from "../src/random.js";
import { Inventory } from "../src/inventory.js";
import { meshChunk } from "../src/mesher.js";
import { frameDue, easeAngle, particleCount } from "../src/graphics.js";
import { FirstPersonAnimator } from "../src/animation.js";
import { VOICE_PROFILES, voiceSamples } from "../src/voices.js";
test("all thirteen biomes occur with bounded terrain, ridges and ocean floors in deterministic climate fields", () => {
  const found = new Set(),
    seed = hashSeed("Wildflower");
  let min = 320,
    max = -64;
  for (let z = -2048; z <= 2048; z += 64)
    for (let x = -2048; x <= 2048; x += 64) {
      const t = variedTerrain(x, z, seed, 7);
      found.add(t.biome);
      assert.deepEqual(t, variedTerrain(x, z, seed, 7));
      min = Math.min(min, t.h);
      max = Math.max(max, t.h);
      assert.ok(t.h >= 40 && t.h <= 184);
    }
  assert.deepEqual(
    [...found].sort(),
    Object.keys(BIOMES)
      .filter((b) => b === "ocean" || !b.includes("ocean"))
      .sort(),
  );
  assert.ok(max - min > 60);
});
test("terrain changes smoothly across climate borders rather than creating biome cliffs", () => {
  const w = new World("Wildflower");
  let max = 0;
  for (let z = -384; z < 384; z += 8)
    for (let x = -384; x < 384; x += 8)
      max = Math.max(
        max,
        Math.abs(w.baseTerrain(x, z).h - w.baseTerrain(x + 1, z).h),
      );
  assert.ok(max <= 8, `maximum one-block elevation step ${max}`);
});
test("new surfaces, tree species and flowers generate reproducibly across negative chunk boundaries", () => {
  const a = new World("Wildflower"),
    b = new World("Wildflower");
  for (const [cx, cz] of [
    [-123, -128],
    [-100, -32],
    [2, 3],
    [0, 0],
  ])
    a.ensure(cx, cz);
  for (const [cx, cz] of [
    [0, 0],
    [2, 3],
    [-100, -32],
    [-123, -128],
  ])
    b.ensure(cx, cz);
  for (const [key, c] of a.chunks)
    assert.deepEqual(c.data, b.chunks.get(key).data);
  assert.equal(surfaceBlock({ h: 80, biome: "badlands" }, 80, 1), B.red_sand);
  assert.equal(surfaceBlock({ h: 80, biome: "badlands" }, 77, 1), B.terracotta);
  assert.equal(surfaceBlock({ h: 80, biome: "marsh" }, 80, 1), B.moss);
  assert.equal(surfaceBlock({ h: 80, biome: "snowy_taiga" }, 80, 1), B.snow);
});
test("new log species preserve actual plank crafting, smelting and fuel progression", () => {
  for (const id of ["pine_log", "birch_log"]) {
    const inv = new Inventory();
    inv.craft[0] = makeStack(id);
    assert.equal(inv.craftOne(), true);
    assert.deepEqual(
      inv.cursor,
      makeStack(id === "pine_log" ? "spruce_planks" : "birch_planks", 4),
    );
    assert.equal(inv.craft[0], null);
    assert.equal(FUELS[id], 300);
    assert.equal(SMELTS[id], "charcoal");
  }
  assert.equal(SMELTS.red_sand, "glass");
  assert.ok(RECIPES.every((r) => r.id && r.result));
});
test("v2 and v3 remain explicit persisted generators and new worlds use v16", () => {
  assert.equal(new World("a").generationVersion, 16);
  const old = new World("Wildflower", {}, "overworld", 3),
    current = new World("Wildflower");
  assert.notDeepEqual(old.ensure(0, 0).data, current.ensure(0, 0).data);
  assert.equal(B.oak_door, 37);
  assert.equal(B.sugar_cane, 57);
  assert.ok(
    Math.max(
      ...BLOCKS.map((b, i) => (b.artTile ?? i * 3) * (b.edition ? 1 : 0)),
    ) < 4096,
  );
});
test("chunk edit index is current before unloading and supports edits overwritten in place", () => {
  const w = new World("index");
  w.set(-1, 200, 16, B.stone);
  w.set(-1, 200, 16, B.chest);
  assert.deepEqual(w.editChunks.get("-1,1"), [[-1, 200, 16, B.chest]]);
  w.unload(50, 50, 1);
  assert.equal(w.get(-1, 200, 16), B.chest);
});
test("terrain memoization is bounded and unloading releases transient cane and torch indexes", () => {
  const w = new World("memo");
  let calls = 0;
  const original = w.baseTerrain.bind(w);
  w.baseTerrain = (...args) => {
    calls++;
    return original(...args);
  };
  w.terrain(0, 0);
  const before = calls;
  for (let i = 0; i < 200; i++) w.terrain(0, 0);
  assert.equal(calls, before);
  w.set(0, 200, 0, B.torch);
  w.set(1, 200, 0, B.sugar_cane);
  w.unload(100, 100, 1);
  assert.equal(w.generatedLights.size, 0);
  assert.equal(w.caneRoots.size, 0);
});
test("mesher caches biome tint per column and blend/color controls change shading, not geometry", () => {
  const w = new World("mesh");
  const c = w.ensure(0, 0);
  c.data.fill(0);
  c.maxY = 200;
  for (let z = 0; z < 16; z++)
    for (let x = 0; x < 16; x++) c.data[index(x, 200, z)] = B.grass;
  for (let z = -1; z <= 1; z++) for (let x = -1; x <= 1; x++) w.ensure(x, z);
  let calls = 0;
  const terrain = w.terrain.bind(w);
  w.terrain = (...args) => {
    calls++;
    return terrain(...args);
  };
  const on = meshChunk(w, c, { biomeBlend: 0 });
  assert.ok(calls <= 256, `terrain calls ${calls}`);
  const off = meshChunk(w, c, { biomeColors: false }),
    blended = meshChunk(w, c, { biomeBlend: 4 });
  assert.deepEqual(on[0].position, off[0].position);
  assert.deepEqual(on[0].position, blended[0].position);
  assert.notDeepEqual(on[0].color, off[0].color);
});
test("FPS pacing respects chosen caps and free rendering without changing clock state", () => {
  for (const limit of [30, 60, 120]) {
    let last,
      count = 0;
    for (let now = 0; now < 1000; now += 1000 / 240)
      if (frameDue(now, last, limit)) {
        last = now;
        count++;
      }
    assert.ok(count <= limit + 1 && count >= limit - 1);
  }
  assert.equal(frameDue(1, 0, 0), true);
  assert.equal(frameDue(1, 0, 30), false);
});
test("angle smoothing follows the shortest wrap and particle levels are real budgets", () => {
  const a = easeAngle(Math.PI - 0.01, -Math.PI + 0.01, 0.5);
  assert.ok(Math.abs(a - Math.PI) < 0.0001);
  assert.equal(particleCount({ particles: "minimal" }, 9), 0);
  assert.equal(particleCount({ particles: "decreased" }, 9), 3);
  assert.equal(particleCount({ particles: "all" }, 9), 9);
});
test("turning bobbing off removes stride motion while preserving combat animation", () => {
  const p = { yaw: 0, pitch: 0, vy: 0, onGround: true },
    a = new FirstPersonAnimator();
  const still = a.step(0.016, p, { moving: true, bobbing: false });
  assert.equal(still.x, 0);
  assert.equal(still.y, 0);
  assert.equal(still.rz, 0);
  a.trigger("attack", "sword");
  const hit = a.step(0.1, p, { moving: true, bobbing: false });
  assert.ok(Math.abs(hit.x) + Math.abs(hit.rz) > 0.05);
});
test("rich creature voices are finite, bounded, unique and variant-dependent with faded edges", () => {
  const signatures = new Set();
  for (const type of Object.keys(VOICE_PROFILES)) {
    const data = voiceSamples(type, 22050),
      variant = voiceSamples(type, 22050, 1);
    let energy = 0,
      max = 0;
    for (const v of data) {
      assert.ok(Number.isFinite(v));
      energy += v * v;
      max = Math.max(max, Math.abs(v));
    }
    assert.ok(energy / data.length > 0.0001);
    assert.ok(max <= 0.65);
    assert.equal(Math.abs(data[0]), 0);
    assert.ok(Math.abs(data.at(-1)) < 0.001);
    assert.notDeepEqual(data, variant);
    signatures.add(data.slice(50, 100).join(","));
  }
  assert.equal(signatures.size, 42);
});
