import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { World } from "../src/world.js";
import { Renderer } from "../src/renderer.js";
import { B } from "../src/data.js";
import { meshChunk } from "../src/mesher.js";
import { snapshotMeshChunks, applyMeshSnapshot } from "../src/mesh-snapshot.js";
import workerSource from "../src/worker-code.js";
import vm from "node:vm";
const warm = () => {
  const w = new World("Wildflower");
  for (let z = -1; z <= 1; z++) for (let x = -1; x <= 1; x++) w.ensure(x, z);
  w.dirty.clear();
  w.revisions.clear();
  return w;
};
test("interior/edge/corner edits invalidate exactly the face/AO/connected-shape halo, including negative chunk boundaries", () => {
  const w = warm();
  for (const [x, z, want] of [
    [8, 8, ["0,0"]],
    [15, 8, ["0,0", "1,0"]],
    [15, 15, ["0,0", "1,0", "0,1", "1,1"]],
    [-16, -16, ["-2,-2", "-1,-2", "-2,-1", "-1,-1"]],
  ]) {
    w.dirty.clear();
    w.revisions.clear();
    w.set(x, 180, z, B.stone);
    assert.deepEqual([...w.dirty].sort(), want.sort());
    assert.deepEqual([...w.revisions.keys()].sort(), want.sort());
  }
});
test("loaded-cell snapshots are independent transferable copies and applying them never generates terrain", () => {
  const w = warm(),
    snap = snapshotMeshChunks(w, 0, 0),
    sizes = [...w.chunks.values()].map((c) => c.data.byteLength);
  const copied = structuredClone(snap.chunks, { transfer: snap.transfers });
  assert.ok(snap.chunks.every((c) => c.data.byteLength === 0));
  assert.deepEqual(
    [...w.chunks.values()].map((c) => c.data.byteLength),
    sizes,
  );
  const target = new World(w.seed);
  target.ensure = () => {
    throw Error("Snapshot application must not generate");
  };
  applyMeshSnapshot(target, copied);
  assert.equal(target.chunks.size, 9);
  for (const [key, c] of w.chunks) {
    assert.notEqual(target.chunks.get(key).data, c.data);
    assert.deepEqual(target.chunks.get(key).data, c.data);
  }
});
test("ordinary edited chunks dispatch once to workers before missing terrain, with no synchronous remesh or detached game data", () => {
  const world = warm();
  world.set(8, 180, 8, B.stone);
  const sent = [];
  const r = Object.create(Renderer.prototype);
  Object.assign(r, {
    world,
    settings: {},
    planKey: "0,0,2",
    plan: [
      { key: "1,0", cx: 1, cz: 0, distance: 1 },
      { key: "0,0", cx: 0, cz: 0, distance: 0 },
    ],
    meshes: new Map([
      [
        "0,0",
        {
          children: [],
          userData: { revision: 0, surfaceOnly: false, horizon: false },
        },
      ],
    ]),
    epoch: 0,
    ticket: 0,
    jobs: new Map(),
    workers: [0, 1].map(() => ({
      busy: false,
      worker: { postMessage: (m, t) => sent.push([m, t]) },
    })),
    scene: new THREE.Scene(),
    worldAnimations: { removeChunk() {} },
  });
  r.rebuild = () => assert.fail("Edits must not remesh on the main thread");
  r.loadAround(8, 8, 2);
  assert.equal(sent[0][0].key, "0,0");
  assert.equal(sent[0][0].chunks.length, 9);
  assert.equal(sent.filter(([m]) => m.key === "0,0").length, 1);
  assert.equal(world.chunks.get("0,0").data.byteLength, 196608);
  assert.ok(r.jobs.size <= 2);
});
test("actual bundled worker meshes authoritative snapshots exactly, including corner AO, stairs, panes and fluid cells", () => {
  const w = warm();
  for (const [x, y, z, id] of [
    [15, 100, 15, B.stone],
    [15, 101, 15, B.oak_stairs],
    [16, 100, 15, B.glass_pane],
    [15, 100, 16, B.water],
    [16, 101, 16, B.torch],
  ])
    w.set(x, y, z, id);
  let result;
  const context = vm.createContext({
    self: {
      postMessage: (d) => {
        result = d;
      },
    },
    console,
  });
  vm.runInContext(workerSource, context);
  for (const [cx, cz] of [
    [0, 0],
    [1, 0],
    [0, 1],
    [1, 1],
  ]) {
    const snapshot = snapshotMeshChunks(w, cx, cz),
      edits = Object.fromEntries(w.edits);
    const options = {
      interactiveModels: true,
      ambientOcclusion: true,
      biomeColors: true,
      biomeBlend: 2,
      texturePack: "renewed",
    };
    const expected = meshChunk(w, w.ensure(cx, cz), options);
    context.self.onmessage({
      data: {
        ticket: 1,
        seed: w.seed,
        dimension: w.dimension,
        generationVersion: w.generationVersion,
        cx,
        cz,
        chunks: snapshot.chunks,
        edits,
        ...options,
      },
    });
    assert.equal(result.error, undefined);
    for (let i = 0; i < 2; i++) {
      if (!expected[i]) assert.equal(result.groups[i], null);
      else
        for (const [key, a] of Object.entries(expected[i]))
          assert.deepEqual(
            Array.from(result.groups[i][key]),
            Array.from(a),
            `${cx},${cz} ${key}`,
          );
    }
  }
});

test("first meshes snapshot loaded lamp edits before any mesh/cache exists, and in-flight neighbor lighting becomes stale", () => {
  const world = warm();
  world.set(15, 180, 8, B.torch);
  for (const c of world.chunks.values()) delete c.lightSources;
  const sent = [],
    r = Object.create(Renderer.prototype);
  Object.assign(r, {
    world,
    settings: {},
    planKey: "0,0,2",
    plan: [{ key: "1,0", cx: 1, cz: 0, distance: 1 }],
    meshes: new Map(),
    epoch: 0,
    ticket: 0,
    jobs: new Map(),
    workers: [{ busy: false, worker: { postMessage: (m) => sent.push(m) } }],
    scene: new THREE.Scene(),
    worldAnimations: { removeChunk() {} },
  });
  r.loadAround(8, 8, 2);
  assert.equal(sent.length, 1);
  const job = sent[0],
    source = job.chunks.find((c) => c.key === "0,0");
  assert.ok(
    source.lightSources.some((p) => p[0] === 15 && p[1] === 180 && p[2] === 8),
  );
  assert.equal(r.entryRevision(job), job.revision);
  world.set(14, 180, 8, B.stone);
  assert.notEqual(
    r.entryRevision(job),
    job.revision,
    "worker completion must be rejected after an occluder edit",
  );
  assert.equal(world.chunks.get("0,0").data.byteLength, 196608);
});
