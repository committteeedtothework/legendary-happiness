import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { World, index } from "../src/world.js";
import {
  B,
  ITEMS,
  BLOCKS,
  GENERATION_VERSION,
  HOSTILE_TYPES,
  MOB_INFO,
} from "../src/data.js";
import {
  connectedTerrain,
  connectedCinderBase,
} from "../src/connected-terrain.js";
import { wildCavePlan, cinderCaveVoid } from "../src/wild-caves.js";
import { deepCaveNode } from "../src/cave-update.js";
import { spawnSurfaceHostiles, createEntity } from "../src/simulation.js";
import { spawnFliers } from "../src/cinder-flight.js";
import { createPlayer } from "../src/physics.js";
import { exportRealm, restoreRealm } from "../src/realms.js";
import {
  createHandRig,
  createHeldModel,
  fitHandGrip,
  updateHandRig,
} from "../src/first-person.js";
import { isFlatItem } from "../src/item-shapes.js";
import { actionPose } from "../src/animation.js";
import { mockCanvas } from "./helpers/mock-canvas.js";

test("generator 14 replaces isolated discs with mostly connected land and shorter water/lava crossings across seeds", () => {
  assert.equal(GENERATION_VERSION, 16);
  const report = [];
  for (const seed of ["Wildflower", "Linked shores", "Cinder crossings"]) {
    const w = new World(seed, {}, "overworld", 14),
      c = new World(seed, {}, "cinderwild");
    let sea = 0,
      lava = 0,
      n = 0,
      contacts = new Set(),
      biomes = new Set(),
      runs = [];
    const width = 129,
      land = new Uint8Array(width * width);
    for (let iz = 0; iz < width; iz++) {
      let run = 0;
      for (let ix = 0; ix < width; ix++) {
        const x = (ix - 64) * 64,
          z = (iz - 64) * 64;
        const t = w.baseTerrain(x, z),
          ct = c.baseTerrain(x, z);
        assert.deepEqual(t, connectedTerrain(x, z, w.seedInt));
        assert.equal(ct.biome, connectedCinderBase(x, z, c.seedInt).biome);
        assert.equal(ct.land, connectedCinderBase(x, z, c.seedInt).land);
        biomes.add(t.biome);
        sea += t.h < 62;
        lava += ct.h < 69;
        n++;
        land[iz * width + ix] = t.h >= 62 ? 1 : 0;
        if (t.h < 62) run += 64;
        else if (run) {
          runs.push(run);
          run = 0;
        }
        if (t.biome !== "ocean") {
          for (const [dx, dz] of [
            [64, 0],
            [0, 64],
          ]) {
            const b = w.baseTerrain(x + dx, z + dz).biome;
            if (b !== "ocean" && b !== t.biome)
              contacts.add([b, t.biome].sort().join(":"));
          }
        }
      }
    }
    let largest = 0;
    for (let i = 0; i < land.length; i++)
      if (land[i]) {
        let size = 0,
          queue = [i];
        land[i] = 0;
        for (let at = 0; at < queue.length; at++) {
          const p = queue[at],
            x = p % width,
            z = Math.floor(p / width);
          size++;
          for (const next of [
            x ? p - 1 : -1,
            x + 1 < width ? p + 1 : -1,
            z ? p - width : -1,
            z + 1 < width ? p + width : -1,
          ])
            if (next >= 0 && land[next]) {
              land[next] = 0;
              queue.push(next);
            }
        }
        largest = Math.max(largest, size);
      }
    runs.sort((a, b) => a - b);
    assert.ok(sea / n > 0.12 && sea / n < 0.4, `${seed}: ${sea / n}`);
    assert.ok(lava / n > 0.12 && lava / n < 0.4);
    assert.ok(largest / (n - sea) > 0.7, `${seed}: fragmented land`);
    assert.ok(runs[Math.floor(runs.length / 2)] <= 384);
    assert.ok(runs[Math.floor(runs.length * 0.9)] <= 1024);
    assert.equal(biomes.size, 13);
    assert.ok(contacts.size > 18);
    report.push({
      seed,
      sea: sea / n,
      lava: lava / n,
      connected: largest / (n - sea),
    });
  }
  assert.equal(report.length, 3);
});

test("wild cave plans vary in branching, chamber aspect, height, orientation and tunnel widths while retaining region anchors", () => {
  const w = new World("Wildflower"),
    counts = new Set(),
    aspects = new Set(),
    widths = new Set();
  for (let z = -4; z <= 4; z++)
    for (let x = -4; x <= 4; x++)
      for (let layer = 0; layer < 2; layer++) {
        const plan = wildCavePlan(x, z, layer, w.seedInt);
        assert.deepEqual(plan[0].a, deepCaveNode(x, z, layer, w.seedInt));
        assert.deepEqual(plan, wildCavePlan(x, z, layer, w.seedInt));
        counts.add(plan.length);
        for (const s of plan) {
          if (s.room) aspects.add(Math.floor(s.aspect * 10));
          else widths.add(Math.floor(s.r * 10));
        }
      }
  assert.ok(counts.size >= 8);
  assert.ok(aspects.size >= 9);
  assert.ok(widths.size >= 20);
});

test("new caves generate different void shapes across real negative chunk boundaries, preserve bedrock and survive saves", () => {
  const a = new World("Cave maze"),
    b = new World("Cave maze");
  const coords = [
    [-2, -1],
    [-1, -1],
    [0, -1],
    [-2, 0],
    [-1, 0],
    [0, 0],
  ];
  const results = coords.map(([x, z]) => a.ensure(x, z).data.slice());
  for (const [x, z] of [...coords].reverse()) b.ensure(x, z);
  const shapes = new Set();
  let carved = 0;
  for (let n = 0; n < coords.length; n++) {
    const [x, z] = coords[n],
      data = b.ensure(x, z).data;
    assert.deepEqual(data, results[n]);
    const pattern = [];
    for (let dz = 0; dz < 16; dz++)
      for (let dx = 0; dx < 16; dx++) {
        assert.equal(data[index(dx, -64, dz)], B.bedrock);
        for (let y = -55; y < 35; y++)
          if (data[index(dx, y, dz)] === B.air) {
            carved++;
            pattern.push(`${dx},${y},${dz}`);
          }
      }
    shapes.add(pattern.join(";"));
  }
  assert.ok(carved > 500);
  assert.ok(shapes.size >= 4);
  a.set(-1, -20, -1, B.planks);
  const save = exportRealm({ world: a, entities: [], drops: [] });
  const restored = restoreRealm(a.seed, "overworld", save).world;
  assert.equal(restored.generationVersion, 16);
  assert.equal(restored.get(-1, -20, -1), B.planks);
  assert.deepEqual(restored.ensure(-1, 0).data, a.ensure(-1, 0).data);
  let voids = 0,
    solid = 0;
  for (let y = 10; y < 75; y += 4)
    for (let x = -80; x < 80; x += 4) {
      if (cinderCaveVoid(x, y, -17, a.seedInt)) voids++;
      else solid++;
    }
  assert.ok(voids > 30 && solid > voids);
});
function hellGame(difficulty = "normal") {
  const w = new World("Threat", {}, "cinderwild");
  w.terrain = () => ({ h: 80, biome: "ash_wastes" });
  w.skyHeight = () => 80;
  w.get = (x, y) => (y < 81 ? B.cinderstone : B.air);
  w.solid = (x, y) => y < 81;
  return {
    world: w,
    player: createPlayer({ x: 0.5, y: 81, z: 0.5 }),
    dimension: "cinderwild",
    mode: "survival",
    difficulty,
    entities: [],
    tickCount: 60,
  };
}
test("Cinderworld spawns three threats every three seconds, respects difficulty caps, clear bodies and Peaceful", () => {
  for (const [difficulty, cap] of [
    ["easy", 18],
    ["normal", 26],
    ["hard", 32],
  ]) {
    const g = hellGame(difficulty);
    spawnSurfaceHostiles(g);
    assert.equal(g.entities.length, 3);
    for (let tick = 120; tick <= 1800; tick += 60) {
      g.tickCount = tick;
      spawnSurfaceHostiles(g);
    }
    assert.equal(g.entities.length, cap);
    g.tickCount = 100;
    spawnFliers(g, createEntity);
    assert.equal(
      g.entities.length,
      cap,
      "flyers respect the shared live-hostile cap",
    );
    assert.ok(
      g.entities.every(
        (e) =>
          HOSTILE_TYPES.has(e.type) && e.y === 81 && Math.hypot(e.x, e.z) > 22,
      ),
    );
    assert.equal(new Set(g.entities.map((e) => e.type)).size, 6);
  }
  const peaceful = hellGame("peaceful");
  spawnSurfaceHostiles(peaceful);
  spawnFliers(peaceful, createEntity);
  assert.equal(peaceful.entities.length, 0);
  const blocked = hellGame();
  blocked.world.solid = () => true;
  spawnSurfaceHostiles(blocked);
  assert.equal(blocked.entities.length, 0);
  const lit = hellGame();
  for (let x = -40; x <= 40; x += 5)
    for (let z = -40; z <= 40; z += 5)
      lit.world.edits.set(`${x},81,${z}`, B.torch);
  lit.world.get = (x, y) =>
    y === 81 ? B.torch : y < 81 ? B.cinderstone : B.air;
  spawnSurfaceHostiles(lit);
  assert.equal(lit.entities.length, 0);
});
test("increased Cinderworld flying density remains bounded and unchanged Overworld spawning is excluded", () => {
  const g = hellGame();
  for (let tick = 100; tick <= 1400; tick += 100) {
    g.tickCount = tick;
    spawnFliers(g, createEntity);
  }
  assert.equal(g.entities.length, 6);
  assert.ok(g.entities.every((e) => MOB_INFO[e.type].flying && e.y > 85));
  g.dimension = "overworld";
  g.entities = [];
  spawnFliers(g, createEntity);
  assert.equal(g.entities.length, 0);
});
test("all held blocks sit at the hand tip without deep forearm penetration and flat tools remain at the actual socket", () => {
  const restore = mockCanvas();
  try {
    const atlas = { texture: new THREE.Texture(), pack: "renewed" };
    for (const [id, item] of Object.entries(ITEMS)) {
      if (item.block === undefined && !item.tool && id !== "flint_and_steel")
        continue;
      const r = createHandRig(),
        m = createHeldModel(id, atlas);
      r.grip.add(m);
      fitHandGrip(r, id, m);
      if (isFlatItem(id))
        assert.ok(Math.abs(m.position.z) <= 0.006, `${id}: floating sprite`);
      for (const kind of ["attack", "mine", "place", "use", "eat"])
        for (let n = 0; n <= 12; n++) {
          const p = actionPose(kind, n / 12, item.tool);
          r.root.position.set(0.37 + p.x, -0.22 + p.y, -0.72 + p.z);
          r.root.rotation.set(p.rx, p.ry, p.rz);
          updateHandRig(r);
          r.root.updateMatrixWorld(true);
          assert.ok(
            new THREE.Box3().setFromObject(r.root).max.z <= -0.1099,
            `${id}/${kind}: camera clipping`,
          );
          if (item.block !== undefined && !isFlatItem(id)) {
            const cube = m.children[0];
            cube.geometry.computeBoundingBox();
            const point = r.forearm.localToWorld(new THREE.Vector3(0, -0.5, 0));
            assert.ok(
              pointInHeld(cube, cube.worldToLocal(point)),
              `${id}: disconnected block`,
            );
            // Past the first 5cm, no center of the forearm may enter the held cube.
            const deeper = r.forearm.localToWorld(
              new THREE.Vector3(0, -0.5 + 0.05 / r.forearm.scale.y, 0),
            );
            assert.equal(
              pointInHeld(cube, cube.worldToLocal(deeper)),
              false,
              `${id}/${kind}: arm buried in block`,
            );
          }
        }
    }
  } finally {
    restore();
  }
});

function pointInHeld(mesh, p) {
  return mesh.userData.voxelParts
    ? mesh.userData.voxelParts.some(
        (b) =>
          p.x >= b[0] - 1e-6 &&
          p.x <= b[3] + 1e-6 &&
          p.y >= b[1] - 1e-6 &&
          p.y <= b[4] + 1e-6 &&
          p.z >= b[2] - 1e-6 &&
          p.z <= b[5] + 1e-6,
      )
    : mesh.geometry.boundingBox.containsPoint(p);
}
