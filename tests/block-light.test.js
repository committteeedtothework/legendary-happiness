import test from "node:test";
import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { B, MIN_Y, MAX_Y } from "../src/data.js";
import { World, index } from "../src/world.js";
import {
  buildBlockLight,
  chunkLightSources,
  emittedLight,
  itemLight,
  injectBlockLight,
} from "../src/block-light.js";
import { meshChunk } from "../src/mesher.js";
import { snapshotMeshChunks, applyMeshSnapshot } from "../src/mesh-snapshot.js";
function fixture() {
  const w = new World("lamp regression");
  for (let dz = -1; dz <= 1; dz++)
    for (let dx = -1; dx <= 1; dx++) {
      const c = {
        key: `${dx},${dz}`,
        cx: dx,
        cz: dz,
        maxY: 202,
        data: new Uint16Array(256 * (MAX_Y - MIN_Y + 1)),
      };
      w.chunks.set(c.key, c);
      for (let z = 0; z < 16; z++)
        for (let x = 0; x < 16; x++) c.data[index(x, 199, z)] = B.stone;
    }
  return w;
}
test("world-space flood lights all lamps, crosses chunk seams and has a bounded physical radius independent of camera or Fancy settings", () => {
  const w = fixture();
  for (const [x, z] of [
    [-2, 2],
    [2, 2],
    [6, 2],
    [10, 2],
    [14, 2],
    [18, 2],
  ])
    w.set(x, 200, z, B.torch);
  const c = w.chunks.get("0,0"),
    lit = buildBlockLight(w, c);
  for (const x of [-2, 2, 6, 10, 14, 18]) assert.equal(lit(x, 201, 2), 13);
  assert.equal(lit(15, 200, 2), 13);
  assert.equal(lit(2, 216, 2), 0);
  const camera = { x: 500, y: 200, z: 500, yaw: Math.PI };
  assert.equal(lit(6, 201, 2), 13);
  assert.ok(camera.x > 100);
  w.set(14, 200, 2, B.air);
  assert.ok(buildBlockLight(w, c)(14, 200, 2) < 14);
});
test("solid walls occlude lamps, water attenuates them and a reopened tunnel invalidates neighboring chunks without loading terrain", () => {
  const w = fixture();
  // Entire chunk-sized sealed tube: no alternate path around its walls.
  for (let x = -1; x <= 20; x++)
    for (let y = 199; y <= 202; y++)
      for (let z = 4; z <= 6; z++) w.set(x, y, z, B.stone);
  for (let x = 0; x <= 19; x++) w.set(x, 200, 5, B.air);
  w.set(13, 200, 5, B.torch);
  w.set(15, 200, 5, B.stone);
  let field = buildBlockLight(w, w.chunks.get("0,0"));
  assert.equal(field(16, 200, 5), 0);
  w.dirty.clear();
  w.set(15, 200, 5, B.air);
  assert.ok(w.dirty.has("1,0"));
  w.get = () => {
    throw Error("Lighting must not generate chunks");
  };
  field = buildBlockLight(w, w.chunks.get("0,0"));
  assert.equal(field(16, 200, 5), 11);
  w.set(14, 200, 5, B.water);
  assert.equal(buildBlockLight(w, w.chunks.get("0,0"))(16, 200, 5), 10);
});
test("authoritative snapshot and remeshed reload reproduce baked lights; torch UVs and geometry stay narrow with no transparent stretched sprite", () => {
  const w = fixture();
  w.set(15, 200, 4, B.torch);
  const c = w.chunks.get("0,0"),
    mesh = meshChunk(w, c, { texturePack: "renewed" }),
    snapshot = snapshotMeshChunks(w, 0, 0),
    copy = fixture();
  copy.chunks.clear();
  applyMeshSnapshot(copy, snapshot.chunks);
  assert.deepEqual(
    meshChunk(copy, copy.chunks.get("0,0"), { texturePack: "renewed" }),
    mesh,
  );
  assert.ok(mesh[0].blockLight.some((l) => l > 0.8));
  const coords = [];
  for (let n = 0; n < mesh[0].position.length; n += 3)
    if (
      mesh[0].position[n] > 15 &&
      mesh[0].position[n] < 16 &&
      mesh[0].position[n + 1] > 200
    )
      coords.push(mesh[0].position[n + 1]);
  assert.equal(Math.max(...coords), 200.625);
  assert.equal(chunkLightSources(c).filter((p) => p[3] === 14).length, 1);
  assert.equal(snapshot.chunks.length, 9);
});
test("dropped luminous items illuminate terrain even without a rendered item model; pickup removes that derived glow", () => {
  const w = fixture(),
    c = w.chunks.get("0,0");
  w.itemLightSources = [[4, 200, 4, itemLight("torch")]];
  assert.equal(buildBlockLight(w, c)(5, 200, 4), 13);
  w.itemLightSources = [];
  assert.equal(buildBlockLight(w, c)(5, 200, 4), 0);
  for (const k of [
    "torch",
    "glowstone",
    "sea_lantern",
    "lava",
    "fire",
    "lantern",
  ])
    assert.ok(emittedLight(B[k]) > 0, k);
  assert.equal(itemLight("diamond_sword"), 0);
});
test("persistent light is a separate emissive vertex attribute, not a replacement for ambient lighting, textures or transparency", () => {
  const shader = {
    vertexShader: "#include <begin_vertex>",
    fragmentShader: "#include <emissivemap_fragment>",
  };
  injectBlockLight(shader);
  assert.match(shader.vertexShader, /attribute float blockLight/);
  assert.match(
    shader.fragmentShader,
    /totalEmissiveRadiance \+= diffuseColor.rgb/,
  );
  const w = fixture();
  const t = performance.now();
  for (let x = 0; x < 16; x += 2)
    for (let z = 0; z < 16; z += 2) w.set(x, 200, z, B.glowstone);
  const field = buildBlockLight(w, w.chunks.get("0,0"));
  assert.ok(field(8, 201, 8) >= 14);
  assert.ok(
    performance.now() - t < 2500,
    "bounded dense-lamp flood must not stall seconds",
  );
});
