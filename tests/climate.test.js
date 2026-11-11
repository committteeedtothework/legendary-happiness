import test from "node:test";
import assert from "node:assert/strict";
import { AmbientDSP } from "../src/soundscape.js";
import { makeMusicPhrase, musicSamples } from "../src/music.js";
import { World } from "../src/world.js";
import { B } from "../src/data.js";
import {
  createWeather,
  setWeather,
  tickWeather,
  weatherAt,
  restoreWeather,
  precipitation,
} from "../src/weather.js";
import { villageAt, nearbyVillages, VILLAGE_SPACING } from "../src/villages.js";
import { VILLAGE_STYLES } from "../src/village-styles.js";
import { doorAt } from "../src/doors.js";
import { exportRealm, restoreRealm } from "../src/realms.js";
import { meshHorizon, terrainPlan } from "../src/horizon.js";
import { meshChunk } from "../src/mesher.js";
import { createPlayer } from "../src/physics.js";
import { createEntity } from "../src/simulation.js";
import { populateVillages } from "../src/ecology.js";

test("ambient stream continues bit-for-bit across render blocks without repeating or resetting its filters", () => {
  const a = new AmbientDSP(123, 8000),
    b = new AmbientDSP(123, 8000),
    targets = { wind: 0.4, water: 0.3, night: 0.3, leaves: 0.2, rumble: 0.1 };
  a.set(targets);
  b.set(targets);
  const left = new Float32Array(64000),
    right = new Float32Array(left.length);
  a.render(left, right);
  const joined = new Float32Array(left.length),
    joinedRight = new Float32Array(left.length);
  for (let offset = 0; offset < joined.length; offset += 128) {
    const l = new Float32Array(128),
      r = new Float32Array(128);
    b.render(l, r);
    joined.set(l, offset);
    joinedRight.set(r, offset);
  }
  assert.deepEqual(left, joined);
  assert.deepEqual(right, joinedRight);
  assert.notDeepEqual(left.slice(0, 32000), left.slice(32000));
  assert.notDeepEqual(left, right);
  assert.ok(left.every((v) => Number.isFinite(v) && Math.abs(v) <= 0.8));
  b.set({ rain: 0.8, fire: 0.3 });
  const later = new Float32Array(16000);
  b.render(later, new Float32Array(16000));
  assert.notDeepEqual(later, left.slice(0, 16000));
  assert.ok(Math.abs(later[0] - joined.at(-1)) < 0.25);
});
test("original music phrases have rests, valid note timing and new arrangements rather than a repeating song", () => {
  const fingerprints = new Set();
  for (let i = 0; i < 20; i++) {
    const p = makeMusicPhrase(120, "meadow", i);
    assert.ok(p.duration > 60 && p.duration < 130);
    assert.ok(p.events.length >= 24);
    assert.ok(
      p.events.every(
        (e) =>
          e.midi >= 24 && e.midi <= 96 && e.duration > 0 && e.at < p.duration,
      ),
    );
    for (let j = 1; j < p.events.length; j++)
      assert.ok(p.events[j].at >= p.events[j - 1].at);
    fingerprints.add(JSON.stringify(p.events));
  }
  assert.equal(fingerprints.size, 20);
  assert.notDeepEqual(
    makeMusicPhrase(1, "alpine"),
    makeMusicPhrase(1, "meadow"),
  );
  const felt = musicSamples(60, "felt", 8000, 2),
    bell = musicSamples(60, "bell", 8000, 2);
  assert.ok(felt.every((v) => Number.isFinite(v) && Math.abs(v) < 0.8));
  assert.equal(felt[0], 0);
  assert.equal(felt.at(-1), 0);
  assert.notDeepEqual(felt, bell);
});
test("weather is seeded, fades gradually, produces storms and saves its exact remaining timer", () => {
  const world = new World("weather"),
    g = { world, player: { x: 8, y: 75, z: 8 } },
    original = createWeather(world.seedInt);
  assert.deepEqual(world.weather, original);
  world.weather.remaining = 1;
  world.tick++;
  tickWeather(g);
  assert.ok(["rain", "thunder"].includes(world.weather.kind));
  assert.ok(world.weather.intensity > 0 && world.weather.intensity < 0.01);
  setWeather(world, "thunder");
  for (let i = 0; i < 500; i++) {
    world.tick++;
    tickWeather(g);
  }
  assert.ok(world.weather.intensity > 0.8);
  assert.ok(world.weather.nextStrike > 0);
  const state = exportRealm({ world, entities: [], drops: [] }),
    loaded = restoreRealm(world.seed, "overworld", state);
  assert.deepEqual(loaded.world.weather, world.weather);
  setWeather(world, "clear");
  const before = world.weather.intensity;
  world.tick++;
  tickWeather(g);
  assert.ok(world.weather.intensity < before && world.weather.intensity > 0);
  assert.equal(restoreWeather({}, 5).kind, "clear");
});
test("snow, rain, dry deserts, shelters and Cinderwild produce appropriate weather exposure", () => {
  assert.equal(precipitation("snowy_taiga"), "snow");
  assert.equal(precipitation("alpine"), "snow");
  assert.equal(precipitation("meadow"), "rain");
  assert.equal(precipitation("desert"), "none");
  assert.equal(precipitation("badlands"), "none");
  const w = new World("Wildflower"),
    p = { x: 0.5, y: 200, z: 0.5 };
  setWeather(w, "rain");
  w.weather.intensity = 1;
  assert.equal(weatherAt(w, p).exposed, true);
  w.set(0, 203, 0, B.planks);
  assert.equal(weatherAt(w, p).exposed, false);
  w.set(0, 203, 0, B.air);
  assert.equal(weatherAt(w, p).exposed, true);
  const c = new World("weather", {}, "cinderwild");
  c.weather.kind = "thunder";
  c.weather.intensity = 1;
  const before = structuredClone(c.weather);
  tickWeather({ world: c, player: p });
  assert.deepEqual(c.weather, before);
  assert.equal(weatherAt(c, p).intensity, 0);
});
test("sky roof cache follows edits, stays bounded and releases unloaded columns", () => {
  const w = new World("Wildflower");
  assert.ok(w.skyHeight(0, 0) < 200);
  w.set(0, 210, 0, B.glass);
  assert.equal(w.skyHeight(0, 0), 210);
  w.set(0, 210, 0, B.air);
  assert.ok(w.skyHeight(0, 0) < 200);
  for (let z = 0; z < 8; z++) for (let x = 0; x < 8; x++) w.skyHeight(x, z);
  assert.ok(w.skyCache.size <= 4096);
  w.unload(100, 100, 1);
  assert.equal(w.skyCache.size, 0);
});
test("rain hydrates exposed crops without irrigating sheltered farmland", () => {
  const w = new World("Wildflower");
  setWeather(w, "rain");
  w.weather.intensity = 1;
  w.set(0, 99, 0, B.farmland);
  w.set(0, 100, 0, B.crop);
  w.cropTicks["0,100,0"] = { age: 0 };
  w.set(8, 99, 0, B.farmland);
  w.set(8, 100, 0, B.crop);
  w.cropTicks["8,100,0"] = { age: 0 };
  w.set(8, 103, 0, B.planks);
  for (let i = 0; i < 100; i++) w.simulate();
  assert.equal(w.cropTicks["0,100,0"].age, 1);
  assert.equal(w.cropTicks["8,100,0"].age, 0);
});
test("new village regions enforce at least 384 blocks between centers and retain legacy 192-block regions", () => {
  const w = new World("Wildflower", {}, "overworld", 12),
    sites = [];
  assert.equal(VILLAGE_SPACING, 512);
  for (let rz = -4; rz <= 4; rz++)
    for (let rx = -4; rx <= 4; rx++) {
      const v = villageAt(w, rx, rz);
      if (v) sites.push(v);
    }
  assert.ok(sites.length > 20);
  for (let i = 0; i < sites.length; i++)
    for (let j = 0; j < i; j++)
      assert.ok(
        Math.hypot(sites[i].x - sites[j].x, sites[i].z - sites[j].z) >= 384,
      );
  const old = villageAt(new World("Wildflower", {}, "overworld", 5), 0, 0);
  assert.equal(old.x, 102);
  assert.equal(old.z, 99);
  assert.equal(old.style, undefined);
  const v = villageAt(w, 0, 0);
  assert.ok(nearbyVillages(w, v.x, v.z, 1).some((s) => s.id === v.id));
});
test("all eight regional villages have real floors, linked doors, beds, roofs, loot and residents", () => {
  const roofs = new Set();
  for (const style of Object.keys(VILLAGE_STYLES)) {
    const w = new World("regional-" + style);
    w.baseTerrain = () => ({
      h: 72,
      biome:
        style === "snow"
          ? "snowy_taiga"
          : style === "pine"
            ? "pine_forest"
            : style === "birch"
              ? "birch_woodland"
              : style === "meadow"
                ? "woodland"
                : style,
      river: 1,
      land: 1,
    });
    const v = villageAt(w, 0, 0);
    assert.equal(v.style, style);
    const h = v.houses[0],
      floor = h.floor;
    assert.equal(w.get(h.x + 1, floor + 1, h.z + 1), B.bed);
    assert.ok(doorAt(w, h.doorX, floor + 1, h.doorZ));
    assert.equal(
      w.get(h.doorX, floor + 2, h.doorZ),
      w.get(h.doorX, floor + 1, h.doorZ) + 1,
    );
    for (let dx = 1; dx <= 5; dx++)
      for (let dz = 1; dz <= 5; dz++)
        assert.ok(
          w.skyHeight(h.x + dx, h.z + dz) >= floor + 5,
          `${style} roof opening at ${dx},${dz}`,
        );
    assert.equal(
      w.containers[`${h.x + 1},${floor + 1},${h.z + 5}`].slots[0].id,
      "bread",
    );
    roofs.add(VILLAGE_STYLES[style].shape + VILLAGE_STYLES[style].roof);
    const g = {
      world: w,
      dimension: "overworld",
      player: createPlayer({ x: v.x, y: v.y + 1, z: v.z + 8 }),
      entities: [],
      time: 6000,
    };
    populateVillages(g, createEntity);
    assert.equal(g.entities.filter((e) => e.type === "villager").length, 8);
    assert.ok(
      g.entities
        .filter((e) => e.type === "villager")
        .every((e) => e.style === style && e.home.y === floor + 1),
    );
  }
  assert.ok(roofs.size >= 5);
});
test("distant heightfield tiles include village silhouettes and edits without allocating voxel chunks", () => {
  const w = new World("Wildflower"),
    v = villageAt(w, 0, 0),
    cx = Math.floor(v.x / 64) * 4,
    cz = Math.floor(v.z / 64) * 4;
  const geometry = meshHorizon(w, cx, cz, { span: 4 });
  assert.equal(w.chunks.size, 0);
  assert.ok(geometry.some(Boolean));
  for (const g of geometry.filter(Boolean)) {
    assert.ok(g.position.every(Number.isFinite));
    assert.ok(g.indices.every((i) => i < g.position.length / 3));
  }
  const before = geometry.reduce((n, g) => n + (g?.position.length || 0), 0);
  w.set(cx * 16 + 4, 220, cz * 16 + 4, B.planks);
  const edited = meshHorizon(w, cx, cz, { span: 4 });
  assert.ok(edited.reduce((n, g) => n + (g?.position.length || 0), 0) > before);
});
test("24-chunk horizon plan uses large stable tiles and fewer draw groups than one object per distant chunk", () => {
  const p = terrainPlan(-1, 2, 24);
  assert.ok(p.length < 400);
  assert.ok(p.some((e) => e.span === 4 && e.distance > 20));
  assert.ok(p.filter((e) => !e.horizon).every((e) => e.distance <= 8.4));
  assert.equal(new Set(p.map((e) => e.key)).size, p.length);
  assert.ok(
    terrainPlan(0, 0, 2).some((e) => e.horizon),
    "minimum distance still covers unfinished chunks",
  );
});
test("middle-distance surface meshing keeps house wall faces below roof tops", () => {
  const w = new World("Wildflower", {}, "overworld", 5),
    v = villageAt(w, 0, 0),
    h = v.houses[0],
    c = w.ensure(Math.floor((h.x + 3) / 16), Math.floor((h.z + 6) / 16)),
    g = meshChunk(w, c, { surfaceOnly: true, ambientOcclusion: false });
  const x = h.x - c.cx * 16,
    z = h.z + 6 - c.cz * 16,
    vertices = g[0].position;
  let wall = false;
  for (let i = 0; i < vertices.length; i += 3)
    if (
      vertices[i] >= x &&
      vertices[i] <= x + 7 &&
      vertices[i + 1] >= v.y + 1 &&
      vertices[i + 1] <= v.y + 4 &&
      Math.abs(vertices[i + 2] - z) < 1.1
    )
      wall = true;
  assert.ok(wall);
});
