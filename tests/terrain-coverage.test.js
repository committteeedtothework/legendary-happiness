import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { Renderer, buildGeometry } from "../src/renderer.js";
import { World } from "../src/world.js";
import { MIN_Y } from "../src/data.js";
import { meshHorizon, terrainPlan } from "../src/horizon.js";
import { installTerrainPreview } from "../src/terrain-streaming.js";
import { drainTerrainResults } from "../src/terrain-stream.js";

function renderer(world = new World("Coverage proof")) {
  const r = Object.create(Renderer.prototype);
  Object.assign(r, {
    world,
    settings: {},
    meshes: new Map(),
    jobs: new Map(),
    epoch: 0,
    scene: new THREE.Scene(),
    horizonMaskDirty: true,
    horizonMaskData: new Uint8Array(1024),
    horizonOrigin: { value: new THREE.Vector2() },
    horizonMask: new THREE.DataTexture(
      new Uint8Array(1024),
      32,
      32,
      THREE.RedFormat,
    ),
    worldAnimations: { setChunk() {}, removeChunk() {} },
  });
  r.material =
    r.waterMaterial =
    r.horizonMaterial =
    r.horizonWaterMaterial =
      new THREE.MeshLambertMaterial();
  return r;
}
test("coverage is binary, includes negative boundaries, and uploads no mask while stationary", () => {
  const r = renderer();
  r.meshes.set("-1,0", {
    userData: { arrivalAt: performance.now(), retireAt: performance.now() },
  });
  r.updateHorizonMask(-0.1, 0);
  assert.equal(r.horizonMaskData[16 + 16 * 32], 255);
  assert.deepEqual([...new Set(r.horizonMaskData)].sort(), [0, 255]);
  const version = r.horizonMask.version;
  for (let i = 0; i < 100; i++) r.updateHorizonMask(-0.1, 0);
  assert.equal(r.horizonMask.version, version);
  r.meshes.delete("-1,0");
  r.horizonMaskDirty = true;
  r.updateHorizonMask(-0.1, 0);
  assert.equal(r.horizonMaskData[16 + 16 * 32], 0);
});
test("even minimum view distance has fallback coverage for unfinished detail", () => {
  for (const [x, z] of [
    [0, 0],
    [-1, -1],
    [5, -9],
  ]) {
    const plan = terrainPlan(x, z, 2);
    assert.ok(
      plan.some(
        (e) =>
          e.horizon &&
          x >= e.cx &&
          x < e.cx + e.span &&
          z >= e.cz &&
          z < e.cz + e.span,
      ),
    );
  }
});
test("a preview creates no simulation chunks and is replaced atomically by worker geometry", () => {
  const r = renderer();
  r.world.ensure = () =>
    assert.fail("Preview must not generate simulation chunks");
  const entry = {
    key: "0,0,h4",
    cx: 0,
    cz: 0,
    span: 4,
    horizon: true,
    distance: 1,
  };
  r.plan = [entry];
  r.planKeys = new Set([entry.key]);
  r.planEntries = new Map([[entry.key, entry]]);
  assert.equal(installTerrainPreview(r), true);
  const old = r.meshes.get(entry.key);
  assert.equal(old.userData.preview, true);
  assert.ok(old.children.length);
  assert.ok(old.children.every((m) => !m.castShadow));
  let disposed = 0;
  old.children.forEach((m) =>
    m.geometry.addEventListener("dispose", () => disposed++),
  );
  const job = { ...entry, epoch: 0, ticket: 1, revision: 0, surfaceOnly: true };
  r.jobs.set(1, job);
  r.readyMeshes = [
    { job, data: { groups: meshHorizon(r.world, 0, 0, { span: 4, step: 8 }) } },
  ];
  assert.equal(drainTerrainResults(r), 1);
  assert.notEqual(r.meshes.get(entry.key), old);
  assert.equal(old.parent, null);
  assert.equal(r.meshes.get(entry.key).userData.preview, false);
  assert.equal(disposed, old.children.length);
  assert.equal(r.world.chunks.size, 0);
  assert.equal(r.world.edits.size, 0);
  assert.equal(installTerrainPreview(r), false);
  for (const g of r.meshes.values())
    g.children.forEach((m) => m.geometry.dispose());
  r.material.dispose();
});
test("chunk-grid skirts reach the world floor and do not allocate or change world data", () => {
  const world = new World("Coverage skirt");
  world.ensure = () => assert.fail("LOD must not load chunks");
  const groups = meshHorizon(world, -4, 0, { span: 4, step: 8 });
  let feet = 0;
  for (const g of groups.filter(Boolean))
    for (let i = 0; i < g.position.length; i += 3)
      if (
        Math.abs(g.normal[i]) + Math.abs(g.normal[i + 2]) > 0 &&
        g.position[i + 1] === MIN_Y + 1
      )
        feet++;
  assert.ok(feet > 0);
  assert.equal(world.edits.size, 0);
  assert.equal(world.chunks.size, 0);
});
test("completed worker meshes prioritize the current player rather than completion order", () => {
  const r = renderer();
  r.streamCenter = { cx: 10, cz: 0 };
  const installed = [];
  r.installMesh = (x) => installed.push(x);
  r.readyMeshes = [0, 10, 4].map((x, i) => {
    const job = {
      key: x + ",0",
      cx: x,
      cz: 0,
      ticket: i,
      epoch: 0,
      revision: 0,
    };
    r.jobs.set(i, job);
    return { job, data: { groups: [] } };
  });
  drainTerrainResults(r, 0);
  assert.deepEqual(installed, [10]);
});
test("a queued surface-only result cannot replace close full-detail terrain after the player moves", () => {
  const r = renderer();
  const job = {
    key: "0,0",
    cx: 0,
    cz: 0,
    ticket: 1,
    epoch: 0,
    revision: 0,
    horizon: false,
    surfaceOnly: true,
  };
  r.planEntries = new Map([[job.key, { key: job.key, distance: 1 }]]);
  r.jobs.set(1, job);
  r.readyMeshes = [
    {
      job,
      data: {
        get groups() {
          assert.fail("Obsolete detail must not allocate geometry");
        },
      },
    },
  ];
  assert.equal(drainTerrainResults(r), 0);
  assert.equal(r.jobs.size, 0);
});

test("synchronous bootstrap uses the same valid geometry adapter as worker uploads", () => {
  const w = new World("Bootstrap geometry");
  const groups = buildGeometry(w, w.ensure(0, 0), { ambientOcclusion: false });
  assert.ok(groups.some(Boolean));
  for (const g of groups.filter(Boolean)) {
    assert.ok(g.boundingSphere);
    assert.ok(Number.isFinite(g.boundingSphere.radius));
    g.dispose();
  }
});
