import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { Renderer } from "../src/renderer.js";
import { World } from "../src/world.js";
import { B, BLOCKS, DEFAULT_SETTINGS } from "../src/data.js";
import {
  VIDEO_GROUPS,
  GRAPHICS_PRESETS,
  applyGraphicsPreset,
  effectiveFrameLimit,
} from "../src/graphics.js";
import {
  nearbyBlockLights,
  nearestPlayerDistance,
  applyDisplayResolution,
} from "../src/render-budget.js";
import { terrainPlan, meshHorizon } from "../src/horizon.js";
import { WorldAnimations } from "../src/world-animations.js";
import { mockCanvas } from "./helpers/mock-canvas.js";

function settledRenderer(radius = 24) {
  const r = Object.create(Renderer.prototype);
  Object.assign(r, {
    settings: {},
    world: {
      meshRevision: 0,
      chunks: new Map(),
      revisions: new Map(),
      dirty: new Set(),
    },
    epoch: 0,
    jobs: new Map(),
    workers: [],
    meshes: new Map(),
    plan: terrainPlan(0, 0, radius),
    planKey: `0,0,${radius}`,
    scene: new THREE.Scene(),
    worldAnimations: { setChunk() {}, removeChunk() {} },
  });
  for (const e of r.plan)
    r.meshes.set(e.key, {
      children: [],
      userData: {
        horizon: !!(e.horizon || e.distance > 8),
        surfaceOnly: !!(e.horizon || e.distance > 8) || e.distance > 4,
        revision: 0,
      },
    });
  let reads = 0;
  const entryRevision = r.entryRevision.bind(r);
  r.entryRevision = (e) => {
    reads++;
    return entryRevision(e);
  };
  r.reads = () => reads;
  return r;
}
test("stationary settled terrain avoids rescanning the whole plan; edits, settings epochs, new meshes and chunk movement invalidate it", () => {
  const r = settledRenderer();
  r.loadAround(0, 0, 24);
  const count = r.reads();
  assert.equal(count, r.plan.length);
  for (let i = 0; i < 120; i++) r.loadAround(0.5, 0.5, 24);
  assert.equal(r.reads(), count);
  r.world.meshRevision++;
  r.loadAround(0.5, 0.5, 24);
  assert.equal(r.reads(), count * 2);
  r.epoch++;
  r.loadAround(0.5, 0.5, 24);
  assert.equal(r.reads(), count * 3);
  r.installMesh(0, 0, [], false, { revision: 0 });
  assert.equal(r.streamSettled, false);
  r.loadAround(0.5, 0.5, 24);
  assert.equal(r.reads(), count * 4);
  r.world.dirty.add("0,0");
  let rebuilt = 0;
  r.world.ensure = () => ({ key: "0,0" });
  r.rebuild = () => {
    rebuilt++;
    r.world.dirty.delete("0,0");
  };
  r.loadAround(0.5, 0.5, 24);
  assert.equal(rebuilt, 1);
  assert.equal(r.streamSettled, false);
  // Changing chunk creates a new plan and cannot reuse the old settled flag.
  r.workers = [{ busy: true }];
  r.loadAround(32, 0, 24);
  assert.equal(r.planKey, "2,0,24");
  assert.equal(r.streamSettled, false);
});
test("coarse tiles overlapping the near region retain their surface-only classification instead of rebuilding every frame", () => {
  const r = settledRenderer();
  const close = r.plan.find((e) => e.horizon && e.distance < 4);
  assert.ok(close);
  r.plan = [close];
  r.loadAround(0, 0, 24);
  assert.equal(r.streamSettled, true);
  const n = r.reads();
  r.loadAround(0, 0, 24);
  assert.equal(r.reads(), n);
});
test("local lights use loaded indexed positions, ignore removed/unloaded lamps and never iterate the entire saved edit history", () => {
  const reads = [],
    w = {
      chunks: new Map([["0,0", {}]]),
      generatedLights: new Set([
        "1,200,1",
        "4,200,4",
        "16,200,0",
        "3000,200,3000",
        "3,200,3",
      ]),
      get(x, y, z) {
        reads.push([x, y, z]);
        return x === 3 ? B.air : B.torch;
      },
      get edits() {
        throw Error("Whole-save scans are forbidden");
      },
    };
  const near = nearbyBlockLights(w, { x: 0, y: 200, z: 0 }, 4);
  assert.deepEqual(
    near.map((p) => p.x),
    [1, 4],
  );
  assert.ok(reads.every(([x]) => x < 16));
  const count = reads.length;
  assert.deepEqual(nearbyBlockLights(w, { x: 0, y: 200, z: 0 }, 0), []);
  assert.equal(reads.length, count);
});
test("no-op block edits preserve sky/cave caches and mesh versions while real edits invalidate them", () => {
  const w = new World("unchanged edit cache");
  w.set(1, 201, 1, B.stone);
  w.skyCache.set("1,1", 201);
  w.caveLightCache = new Map([["test", 1]]);
  const rev = w.meshRevision;
  assert.equal(w.set(1, 201, 1, B.stone), false);
  assert.equal(w.meshRevision, rev);
  assert.equal(w.skyCache.get("1,1"), 201);
  assert.equal(w.caveLightCache.size, 1);
  assert.equal(w.set(1, 201, 1, B.glow_crystal), true);
  assert.equal(w.meshRevision, rev + 1);
  assert.equal(w.skyCache.has("1,1"), false);
  assert.equal(w.caveLightCache.size, 0);
  assert.ok(w.generatedLights.has("1,201,1"));
  w.set(1, 201, 1, B.air);
  assert.equal(w.generatedLights.has("1,201,1"), false);
  w.unload(100, 100, 1);
  assert.ok(w.meshRevision > rev + 2);
});
test("graphics changes avoid framebuffer resizing unless resolution, pixel cap or viewport actually changes", () => {
  const calls = [],
    r = {
      gl: {
        setPixelRatio: (x) => calls.push(["ratio", x]),
        setSize: (w, h) => calls.push(["size", w, h]),
      },
    };
  const settings = { graphics: 3, maxPixelRatio: 2 };
  applyDisplayResolution(r, settings, 1280, 720, 2);
  assert.equal(calls.length, 2);
  for (let i = 0; i < 30; i++)
    applyDisplayResolution(
      r,
      { ...settings, brightness: i / 30 },
      1280,
      720,
      2,
    );
  assert.equal(calls.length, 2);
  applyDisplayResolution(r, { ...settings, maxPixelRatio: 1 }, 1280, 720, 2);
  assert.deepEqual(calls.at(-1), ["ratio", 1]);
  applyDisplayResolution(r, settings, 1600, 900, 2);
  assert.deepEqual(calls.at(-1), ["size", 1600, 900]);
});
test("presets and every new graphics field have real persisted defaults; menu limits respect a lower gameplay cap", () => {
  for (const [, , fields] of VIDEO_GROUPS)
    for (const [key] of fields)
      assert.notEqual(DEFAULT_SETTINGS[key], undefined, key);
  const controls = {
    ...DEFAULT_SETTINGS,
    skin: "hero",
    FOV: 88,
    sensitivity: 0.003,
    volume: 0.7,
  };
  for (const preset of Object.keys(GRAPHICS_PRESETS)) {
    assert.equal(applyGraphicsPreset(controls, preset), true);
    assert.equal(controls.skin, "hero");
    assert.equal(controls.volume, 0.7);
    assert.equal(controls.FOV, 88);
    assert.equal(controls.sensitivity, 0.003);
  }
  const before = JSON.stringify(controls);
  assert.equal(applyGraphicsPreset(controls, "bogus"), false);
  assert.equal(JSON.stringify(controls), before);
  assert.equal(
    effectiveFrameLimit({ frameLimit: 0, menuFrameLimit: 30 }, "title"),
    30,
  );
  assert.equal(
    effectiveFrameLimit({ frameLimit: 0, menuFrameLimit: 30 }, "play"),
    0,
  );
  assert.equal(
    effectiveFrameLimit({ frameLimit: 30, menuFrameLimit: 60 }, "inventory"),
    30,
  );
  assert.equal(
    effectiveFrameLimit({ frameLimit: 144, menuFrameLimit: 0 }, "pause"),
    144,
  );
});
test("Fast distant terrain reduces actual mesh vertex counts while retaining the same world data", () => {
  const w = new World("LOD workload");
  const detailed = meshHorizon(w, 20, 20, { span: 4, step: 2 }),
    fast = meshHorizon(w, 20, 20, { span: 4, step: 8 });
  const vertices = (a) =>
    a.filter(Boolean).reduce((n, x) => n + x.position.length / 3, 0);
  assert.ok(
    vertices(fast) < vertices(detailed) * 0.5,
    `${vertices(fast)} vs ${vertices(detailed)}`,
  );
  assert.equal(w.chunks.size, 0, "far LOD must not generate collision chunks");
  assert.equal(w.edits.size, 0);
});
test("distant animated block models skip animation work and return correctly when approached", () => {
  const restore = mockCanvas();
  try {
    const r = new WorldAnimations(new THREE.Scene(), {
      texture: new THREE.Texture(),
      pack: "classic",
    });
    r.setChunk("0,0", [{ x: 0, y: 200, z: 0, id: B.chest }]);
    const model = r.models.get("0,200,0");
    const g = {
      active: true,
      player: { x: 100, z: 100 },
      settings: { blockEntityDistance: 32 },
      world: { containers: {} },
      ui: { screen: "play" },
    };
    r.update(g, 1 / 60, 0);
    assert.equal(model.visible, false);
    g.player.x = g.player.z = 1;
    r.update(g, 1 / 60, 0);
    assert.equal(model.visible, true);
    r.clear();
    assert.equal(r.models.size, 0);
  } finally {
    restore();
  }
});
test("nearest-player distance matches the old horizontal metric without building an array per creature", () => {
  const players = [
    { x: -10, z: 2 },
    { x: 5, z: 7 },
    { x: 3, z: -4 },
  ];
  for (let i = -50; i <= 50; i++) {
    const p = { x: i, z: i * 0.4 };
    assert.ok(
      Math.abs(
        nearestPlayerDistance(p, players) -
          Math.min(...players.map((q) => Math.hypot(p.x - q.x, p.z - q.z))),
      ) < 1e-10,
    );
  }
});
test("the actual terrain worker consumes the distant-detail option and produces the matching LOD geometry", async () => {
  const before = globalThis.self,
    results = [];
  globalThis.self = {
    postMessage(data) {
      results.push(data);
    },
  };
  try {
    await import("../src/terrain-worker.js");
    const job = {
      ticket: 1,
      seed: "LOD workload",
      dimension: "overworld",
      generationVersion: 16,
      surfaceOnly: true,
      edits: {},
      cx: 20,
      cz: 20,
      span: 4,
      horizon: true,
      biomeColors: true,
      texturePack: "renewed",
    };
    for (const distantDetail of [8, 2])
      self.onmessage({ data: { ...job, distantDetail } });
    assert.equal(results.length, 2);
    assert.ok(results.every((r) => !r.error));
    const vertices = (r) =>
      r.groups.filter(Boolean).reduce((n, g) => n + g.position.length / 3, 0);
    assert.ok(vertices(results[0]) < vertices(results[1]) / 2);
    const direct = meshHorizon(new World(job.seed), 20, 20, {
      span: 4,
      step: 8,
    });
    assert.deepEqual(results[0].groups, direct);
  } finally {
    globalThis.self = before;
  }
});
