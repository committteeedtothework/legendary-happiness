import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {
  queueTerrainResult,
  drainTerrainResults,
  injectTerrainCoverage,
} from "../src/terrain-stream.js";
import { prepareWorkerChunks } from "../src/terrain-worker-cache.js";
import { World } from "../src/world.js";
import { meshChunk } from "../src/mesher.js";
import { B } from "../src/data.js";
import workerSource from "../src/worker-code.js";
const groups = () => [
  {
    position: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]),
    normal: new Float32Array(9),
    uv: new Float32Array(6),
    color: new Float32Array(9),
    indices: new Uint32Array([0, 1, 2]),
  },
];
test("worker completion keeps its pending key and uploads only within the per-frame queue budget; stale jobs never allocate geometry", () => {
  let uploads = 0,
    time = 0;
  const r = {
    jobs: new Map(),
    epoch: 3,
    readyMeshes: [],
    entryRevision: () => 7,
    installMesh(x, z, gs) {
      uploads++;
      time += 2;
      gs.forEach((g) => g?.dispose());
    },
  };
  for (let i = 0; i < 5; i++) {
    r.jobs.set(i, {
      ticket: i,
      key: `${i},0`,
      epoch: 3,
      revision: 7,
      cx: i,
      cz: 0,
    });
    queueTerrainResult(r, { busy: true }, { ticket: i, groups: groups() });
  }
  assert.equal(uploads, 0);
  assert.equal(r.jobs.size, 5);
  assert.equal(
    drainTerrainResults(r, 1, () => time),
    1,
  );
  assert.equal(uploads, 1);
  assert.equal(r.jobs.size, 4);
  r.epoch = 4;
  drainTerrainResults(r, 2, () => time);
  assert.equal(uploads, 1);
  assert.equal(r.jobs.size, 0);
  r.jobs.set(9, { ticket: 9, epoch: 4, revision: 6 });
  queueTerrainResult(r, {}, { ticket: 9, groups: groups() });
  assert.equal(r.readyMeshes.length, 0);
});
test("only the coarse layer clips by completed column ownership; neither layer uses pixel dither", () => {
  for (const horizon of [true, false]) {
    const shader = {
      uniforms: {},
      vertexShader: "#include <project_vertex>",
      fragmentShader: "#include <clipping_planes_fragment>",
    };
    injectTerrainCoverage(
      shader,
      { horizonMask: {}, horizonOrigin: {} },
      horizon,
    );
    assert.equal(shader.fragmentShader.includes("dcsmCoverage"), horizon);
    assert.equal(shader.fragmentShader.includes("gl_FragCoord"), false);
    if (horizon) {
      assert.ok(shader.fragmentShader.includes(">.5)discard"));
      assert.ok(
        shader.vertexShader.includes("transformed-normal*.002"),
        "boundary walls sample their own column",
      );
    }
  }
});
test("cache edit stamps invalidate edited and reverted chunks and keep an exact bounded neighborhood", () => {
  const w = new World("cache-test"),
    stamps = new Map(),
    job = { cx: 0, cz: 0, edits: {} };
  prepareWorkerChunks(w, job, stamps);
  for (let z = -1; z <= 1; z++)
    for (let x = -1; x <= 1; x++) w.chunks.set(`${x},${z}`, { cx: x, cz: z });
  const keep = w.chunks.get("0,0");
  prepareWorkerChunks(w, job, stamps);
  assert.equal(w.chunks.get("0,0"), keep);
  prepareWorkerChunks(w, { ...job, edits: { "0,80,0": B.torch } }, stamps);
  assert.equal(w.chunks.has("0,0"), false);
  w.chunks.set("0,0", { cx: 0, cz: 0 });
  prepareWorkerChunks(w, job, stamps);
  assert.equal(w.chunks.has("0,0"), false);
  for (let x = 0; x < 40; x++) {
    prepareWorkerChunks(w, { cx: x, cz: 0, edits: {} }, stamps);
    w.chunks.set(`${x},0`, { cx: x, cz: 0 });
    assert.ok(w.chunks.size <= 25);
    assert.ok(stamps.size <= 25);
  }
});
test("actual bundled worker reuses generated neighbors and matches fresh geometry after edits and removal, without stale lighting", () => {
  let result;
  const c = vm.createContext({
    console,
    self: { postMessage: (d) => (result = d) },
  });
  vm.runInContext(workerSource, c);
  const run = (cx, edits = {}) => {
    c.self.onmessage({
      data: {
        ticket: cx,
        epoch: 3,
        cx,
        cz: 0,
        key: `${cx},0`,
        seed: "Wildflower",
        dimension: "overworld",
        generationVersion: 16,
        surfaceOnly: false,
        horizon: false,
        edits,
        ambientOcclusion: true,
        biomeColors: true,
        biomeBlend: 2,
        texturePack: "renewed",
      },
    });
    assert.ok(!result.error, result.error);
    return result;
  };
  for (const [cx, edits] of [
    [0, {}],
    [1, {}],
    [0, { "15,160,0": B.torch }],
    [0, {}],
  ]) {
    const a = run(cx, edits),
      w = new World("Wildflower", edits, "overworld", 16);
    for (let z = -1; z <= 1; z++)
      for (let x = cx - 1; x <= cx + 1; x++) w.ensure(x, z);
    const expected = meshChunk(w, w.ensure(cx, 0), {
      interactiveModels: true,
      ambientOcclusion: true,
      biomeColors: true,
      biomeBlend: 2,
      texturePack: "renewed",
    });
    for (let i = 0; i < expected.length; i++) {
      if (!expected[i]) {
        assert.equal(a.groups[i], null);
        continue;
      }
      for (const k of Object.keys(expected[i]))
        assert.deepEqual(
          [...a.groups[i][k]],
          [...expected[i][k]],
          `${cx} ${k}`,
        );
    }
    assert.ok(a.cacheStats.chunks <= 25);
    assert.ok(a.cacheStats.contexts <= 2);
  }
});
test("full generated chunk handoff preserves exact blocks, loot, lamps and growth indexes without regenerating collision terrain", async () => {
  const { nearbyVillages } = await import("../src/villages.js");
  const seed = "Wildflower",
    probe = new World(seed),
    v = nearbyVillages(probe, 0, 0, 1024)[0];
  assert.ok(v);
  const h = v.houses[0],
    cx = Math.floor((h.x + 1) / 16),
    cz = Math.floor((h.z + 5) / 16);
  let result;
  const c = vm.createContext({
    console,
    self: { postMessage: (d) => (result = d) },
  });
  vm.runInContext(workerSource, c);
  c.self.onmessage({
    data: {
      ticket: 1,
      epoch: 1,
      key: `${cx},${cz}`,
      cx,
      cz,
      seed,
      dimension: "overworld",
      generationVersion: 16,
      surfaceOnly: false,
      horizon: false,
      revision: 0,
      edits: {},
      ambientOcclusion: true,
      biomeColors: true,
      texturePack: "renewed",
    },
  });
  assert.ok(result.generated);
  const payload = structuredClone(result.generated),
    fresh = new World(seed),
    expected = fresh.ensure(cx, cz),
    w = new World(seed);
  assert.deepEqual(payload.data, expected.data);
  assert.ok(payload.meta.containers.length > 0, "village loot handoff");
  assert.equal(w.adoptGeneratedChunk(payload), true);
  const ensure = w.ensure.bind(w);
  w.ensure = (x, z) => {
    assert.ok(w.chunks.has(`${x},${z}`), "collision must use adopted cells");
    return ensure(x, z);
  };
  assert.equal(w.get(cx * 16, 0, cz * 16), fresh.get(cx * 16, 0, cz * 16));
  assert.deepEqual(w.containers, fresh.containers);
  assert.deepEqual(
    [...w.generatedLights].sort(),
    [...fresh.generatedLights].sort(),
  );
  assert.deepEqual([...w.caneRoots].sort(), [...fresh.caneRoots].sort());
  assert.deepEqual(
    [...w.editionPlants].sort(),
    [...(fresh.editionPlants || [])].sort(),
  );
  const [key, value] = Object.entries(w.containers)[0];
  value.slots[0] = null;
  assert.equal(w.adoptGeneratedChunk(payload), false);
  assert.equal(w.containers[key].slots[0], null);
  const stale = new World(seed);
  stale.revisions.set(`${cx},${cz}`, 2);
  assert.equal(stale.adoptGeneratedChunk(payload), false);
  assert.equal(stale.chunks.size, 0);
});
test("outgoing detail retires atomically once coarse cover exists without leaving invisible old meshes", async (t) => {
  const { Renderer } = await import("../src/renderer.js"),
    T = await import("three");
  let time = 0;
  t.mock.method(performance, "now", () => time);
  const r = Object.create(Renderer.prototype),
    old = new T.Group(),
    coarse = new T.Group();
  old.userData = { horizon: false };
  coarse.userData = { horizon: true };
  Object.assign(r, {
    world: {
      chunks: new Map(),
      revisions: new Map(),
      dirty: new Set(),
      meshRevision: 0,
    },
    settings: {},
    epoch: 0,
    jobs: new Map(),
    workers: [],
    meshes: new Map([
      ["9,0", old],
      ["8,0,h4", coarse],
    ]),
    plan: [],
    planKey: "0,0,8",
    scene: new T.Scene(),
    worldAnimations: { removeChunk() {} },
  });
  r.loadAround(0, 0, 8);

  assert.equal(r.meshes.has("9,0"), false);
  assert.equal(r.streamSettled, true);
});
