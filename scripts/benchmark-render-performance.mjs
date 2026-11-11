import { performance } from "node:perf_hooks";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { writeFile } from "node:fs/promises";
import * as THREE from "three";
import { Renderer } from "../src/renderer.js";
import { World } from "../src/world.js";
import { terrainPlan, meshHorizon } from "../src/horizon.js";
import { nearbyBlockLights } from "../src/render-budget.js";
import { B } from "../src/data.js";
const args = process.argv.slice(2),
  value = (key) => args[args.indexOf(key) + 1];
const baseline = args.includes("--baseline")
  ? (await import(pathToFileURL(resolve(value("--baseline"))))).Renderer
  : null;
const frames = 120;
function fixture(Type, modern) {
  const r = Object.create(Type.prototype);
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
    plan: terrainPlan(0, 0, 24),
    planKey: "0,0,24",
  });
  for (const e of r.plan)
    r.meshes.set(e.key, {
      children: [],
      userData: {
        horizon: !!(e.horizon || e.distance > 8),
        surfaceOnly: modern
          ? !!(e.horizon || e.distance > 8) || e.distance > 4
          : e.distance > 4,
        revision: 0,
      },
    });
  let reads = 0;
  const original = r.entryRevision.bind(r);
  r.entryRevision = (e) => {
    reads++;
    return original(e);
  };
  r.loadAround(0, 0, 24);
  reads = 0;
  const start = performance.now();
  for (let i = 0; i < frames; i++) r.loadAround(0.5, 0.5, 24);
  return {
    frames,
    planEntries: r.plan.length,
    revisionChecks: reads,
    cpuMs: performance.now() - start,
  };
}
function creatures(Type) {
  const r = Object.create(Type.prototype),
    entities = Array.from({ length: 96 }, (_, i) => ({
      id: "e" + i,
      type: "cow",
      hp: 10,
      x: (i % 12) * 2,
      y: 1,
      z: Math.floor(i / 12) * 2,
      yaw: 0,
    }));
  Object.assign(r, {
    settings: { renderDistance: 4 },
    camera: new THREE.PerspectiveCamera(),
    scene: new THREE.Scene(),
    mobMeshes: new Map(),
    dropMeshes: new Map(),
    entityTarget: new THREE.Vector3(),
    syncProjectiles() {},
  });
  let clones = 0;
  for (const e of entities) {
    const m = new THREE.Group();
    m.position.set(e.x, e.y, e.z);
    m.userData.entityType = e.type;
    m.userData.renderReady = true;
    const clone = m.position.clone.bind(m.position);
    m.position.clone = () => {
      clones++;
      return clone();
    };
    r.mobMeshes.set(e.id, m);
  }
  r.syncEntities(entities, [], 0);
  clones = 0;
  const start = performance.now();
  for (let i = 0; i < frames; i++) r.syncEntities(entities, [], i / 60);
  return {
    frames,
    creatures: entities.length,
    positionClones: clones,
    cpuMs: performance.now() - start,
  };
}
const lightSet = new Set(["1,200,1", "4,200,4", "6,200,6", "7,200,7"]);
let editsVisited = 0;
const savedEdits = new Map(
  Array.from({ length: 100000 }, (_, i) => [`${10000 + i},100,10000`, B.stone]),
);
const w = {
    generatedLights: lightSet,
    get: () => B.torch,
    get edits() {
      editsVisited += savedEdits.size;
      return savedEdits;
    },
  },
  p = { x: 0, y: 200, z: 0 };
function oldLights() {
  return [
    ...new Set([
      ...w.generatedLights,
      ...[...w.edits].filter(([, id]) => id === B.torch).map(([pos]) => pos),
    ]),
  ]
    .map((pos) => pos.split(",").map(Number))
    .filter(([x, y, z]) => Math.hypot(x - p.x, y - p.y, z - p.z) < 20)
    .sort(
      (a, b) =>
        Math.hypot(a[0] - p.x, a[2] - p.z) - Math.hypot(b[0] - p.x, b[2] - p.z),
    )
    .slice(0, 4);
}
let t = performance.now();
for (let i = 0; i < 30; i++) oldLights();
const oldLight = {
  refreshes: 30,
  savedEditsVisited: editsVisited,
  cpuMs: performance.now() - t,
};
editsVisited = 0;
t = performance.now();
for (let i = 0; i < 30; i++) nearbyBlockLights(w, p, 4);
const newLight = {
  refreshes: 30,
  savedEditsVisited: editsVisited,
  cpuMs: performance.now() - t,
};
const world = new World("LOD workload"),
  lod = {};
for (const step of [2, 4, 8]) {
  const groups = meshHorizon(world, 20, 20, { span: 4, step });
  lod[step] = groups
    .filter(Boolean)
    .reduce((n, g) => n + g.position.length / 3, 0);
}
const report = {
  version: "2.7.1",
  environment: "Node CPU workloads; no WebGL rendering or hardware FPS claim",
  notes: [
    "Stationary terrain is already built, with no pending jobs/edits. Baseline metadata is matched to its own renderer; this does not inflate the old implementation with repeated fallback rebuilds.",
    "Light workload has 100,000 saved stone edits and four indexed nearby lights.",
    "Creature workload updates 96 existing original models represented by lightweight groups; position-clone calls are counted directly.",
    "CPU timings vary by host/load. Operation counts and LOD vertex counts are the reproducible evidence.",
  ],
  terrain: {
    before: baseline ? fixture(baseline, false) : null,
    after: fixture(Renderer, true),
  },
  creatureUpdates: {
    before: baseline ? creatures(baseline) : null,
    after: creatures(Renderer),
  },
  lightSelection: { before: oldLight, after: newLight },
  lodVertices: lod,
};
if (args.includes("--output"))
  await writeFile(
    resolve(value("--output")),
    JSON.stringify(report, null, 2) + "\n",
  );
console.log(JSON.stringify(report, null, 2));
