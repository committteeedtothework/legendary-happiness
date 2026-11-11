import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { CloudField, positionCelestials } from "../src/sky-effects.js";
import { daylightAt } from "../src/daylight.js";
import {
  WeatherRenderer,
  wrapWeatherCoordinate,
} from "../src/weather-renderer.js";

test("celestial orbit directions and facing do not change with walking, jumping, eye bob or F5 translation", () => {
  const root = new THREE.Group(),
    sun = new THREE.Object3D(),
    moon = new THREE.Object3D(),
    camera = new THREE.PerspectiveCamera();
  root.add(sun, moon);
  const point = new THREE.Vector3();
  let direction, orientation;
  for (const p of [
    [0, 70, 0],
    [129, 72, -128],
    [129, 72.035, -132],
    [-1000, 125, 1000],
  ]) {
    camera.position.set(...p);
    positionCelestials(root, sun, moon, camera, 1.2);
    sun.getWorldPosition(point).sub(camera.position).normalize();
    if (direction) {
      assert(direction.distanceTo(point) < 1e-12);
      assert(Math.abs(orientation.dot(sun.quaternion)) > 1 - 1e-12);
    }
    direction = point.clone();
    orientation = sun.quaternion.clone();
    assert(sun.position.clone().add(moon.position).length() < 1e-12);
  }
  const before = sun.position.clone();
  positionCelestials(root, sun, moon, camera, 1.3);
  assert(before.distanceTo(sun.position) > 10);
});
function clouds() {
  const c = new CloudField({ cloudHeight: 160, fancyGraphics: true }),
    camera = new THREE.PerspectiveCamera(),
    world = { seedInt: 871 };
  camera.position.set(127.9, 75, 127.9);
  const update = (dt = 0, weather = { kind: "clear", intensity: 0 }) =>
    c.update(
      world,
      camera,
      dt,
      weather,
      daylightAt(6000),
      new THREE.Color("#87b8e2"),
    );
  update();
  return { c, camera, world, update };
}
test("cloud world cells stay fixed through player/chunk boundaries and drift only at their own wind pace", () => {
  const { c, camera, update } = clouds(),
    old = new Map(c.cells.map((x) => [x.key, { ...x }]));
  const pos = c.position.clone();
  camera.position.set(128.1, 80, 128.1);
  update();
  assert(c.position.equals(pos));
  let shared = 0;
  for (const cell of c.cells)
    if (old.has(cell.key)) {
      assert.deepEqual(cell, old.get(cell.key));
      shared++;
    }
  assert(shared > 15);
  c.clock = 199.99;
  update();
  const a = c.position.clone();
  update(0.02);
  assert(Math.abs(c.position.x - a.x - 0.0056) < 1e-10);
  const b = c.position.clone();
  update(0);
  assert(c.position.equals(b));
  assert.equal(c.children.length, 1);
  assert(c.mesh.isInstancedMesh);
  assert(c.mesh.count <= 567);
});
test("clouds are bright/unlit in clear daylight, smoothly thicken/darken in storms and return to clear", () => {
  const { c, update } = clouds(),
    bright = c.mesh.material.color.clone(),
    baseCount = c.mesh.count;
  assert(c.mesh.material.isMeshBasicMaterial);
  assert.equal(c.mesh.material.fog, false);
  assert.equal(c.mesh.material.transparent, false);
  assert(bright.r > 0.9 && bright.g > 0.9 && bright.b > 0.8);
  update(0.016, { kind: "thunder", intensity: 1 });
  assert(c.cover > 0 && c.cover < 0.04);
  for (let i = 0; i < 150; i++)
    update(1 / 30, { kind: "thunder", intensity: 1 });
  assert(c.cover > 0.99);
  assert(c.mesh.count > baseCount);
  assert(c.mesh.material.color.r < bright.r * 0.6);
  for (let i = 0; i < 200; i++) update(1 / 30);
  assert(c.cover < 0.001);
  assert.equal(c.mesh.count, baseCount);
  const count = c.rebuilds;
  for (let i = 0; i < 60; i++) update(0);
  assert.equal(c.rebuilds, count);
});
test("cloud generation never queries terrain, obeys height/Fancy settings, and changes by seed", () => {
  const { c, camera, world, update } = clouds();
  world.terrain = () => {
    throw Error("Clouds must not load terrain");
  };
  c.settings.cloudHeight = 224;
  update();
  assert.equal(c.position.y, 64);
  const before = JSON.stringify(c.cells);
  world.seedInt++;
  update();
  assert.notEqual(JSON.stringify(c.cells), before);
  c.settings.fancyGraphics = false;
  update();
  assert(c.mesh.count <= 162);
  assert.equal(c.mesh.material.depthWrite, true);
  assert(c.eye.value.equals(camera.position));
});
function rain() {
  const world = {
      tick: 20,
      dimension: "overworld",
      seedInt: 99,
      weather: { kind: "rain", intensity: 1 },
      revisions: new Map(),
      terrain: () => ({ h: 60, biome: "meadow" }),
      skyHeight: () => 60,
    },
    p = { x: 127.9, y: 90, z: -128.1 },
    r = new WeatherRenderer(new THREE.Scene(), {
      particles: "all",
      renderDistance: 4,
    });
  for (let i = 0; i < 35; i++) r.update(world, p, 1 / 60, i / 60, true);
  return { world, p, r };
}
test("world-anchored rain keeps interior XYZ fixed while the observer moves horizontally or vertically", () => {
  const { world, p, r } = rain(),
    old = r.rainPositions.slice(),
    oldFade = r.rainFade.slice();
  r.update(
    world,
    { ...p, x: p.x + 0.2, y: p.y + 0.3, z: p.z + 0.2 },
    0,
    1,
    true,
  );
  let stable = 0;
  for (let i = 0; i < r.count; i++)
    if (oldFade[i * 2] > 0.9 && r.rainFade[i * 2] > 0.9) {
      assert.deepEqual(
        r.rainPositions.slice(i * 6, i * 6 + 6),
        old.slice(i * 6, i * 6 + 6),
      );
      stable++;
    }
  assert(stable > 100);
  const previous = r.rainPositions.slice();
  r.update(world, p, 0.01, 1.01, true);
  assert(Math.abs(r.rainPositions[1] - previous[1]) > 0.05);
});
test("precipitation wraps only at faded edges, including negative coordinates; paused geometry stays steady", () => {
  assert.equal(wrapWeatherCoordinate(2, 127, 36), 110);
  assert.equal(wrapWeatherCoordinate(2, -127, 36), -142);
  const { world, p, r } = rain(),
    before = r.rainPositions.slice();
  r.update(world, p, 0, 1, true);
  assert.deepEqual(r.rainPositions, before);
  let recycled = 0;
  r.update(world, { ...p, x: p.x + 0.6 }, 0, 1, true);
  for (let i = 0; i < r.count; i++)
    if (before[i * 6] !== r.rainPositions[i * 6]) {
      assert(r.rainFade[i * 2] < 0.21);
      recycled++;
    }
  assert(recycled > 0);
});
test("weather roof cache stays warm while walking and immediately hides precipitation below edited roofs", () => {
  const { world, p, r } = rain();
  r.update(world, { ...p, x: p.x + 0.1, z: p.z + 0.1 }, 0, 1, true);
  assert(r.stats.roofQueries <= 4); // Only recycled edge columns can be new.
  r.update(world, { ...p, x: p.x + 0.1, z: p.z + 0.1 }, 0, 1, true);
  assert.equal(r.stats.roofQueries, 0);
  world.skyHeight = () => 200;
  for (let z = -12; z <= 12; z++)
    for (let x = -12; x <= 12; x++) world.revisions.set(`${x},${z}`, 1);
  for (let i = 0; i < 25; i++) {
    r.update(world, p, 0.016, 1 + i * 0.016, true);
    assert(r.stats.roofQueries <= 32);
  }
  assert(r.rainFade.every((x) => x === 0));
});
test("rain/snow/hail transitions fade instead of toggling buffers and graphics toggles hide weather immediately", () => {
  const { world, p, r } = rain();
  world.terrain = () => ({ h: 60, biome: "alpine" });
  r.nextSample = 0;
  r.update(world, p, 0.016, 2, true);
  assert(r.rain.visible && r.snow.visible);
  assert(r.weights.snow > 0 && r.weights.snow < 0.2);
  assert.notEqual(r.hail.geometry, r.snow.geometry);
  for (let i = 0; i < 50; i++) r.update(world, p, 0.016, 2 + i * 0.016, true);
  assert(!r.rain.visible && r.snow.visible);
  world.weather.kind = "hail";
  r.update(world, p, 0.016, 3, true);
  assert(r.hail.visible && r.snow.visible);
  r.settings.weatherEffects = false;
  r.update(world, p, 0.016, 3.02, true);
  assert(!r.rain.visible && !r.snow.visible && !r.hail.visible);
  assert.equal(r.stats.roofQueries, 0);
});
