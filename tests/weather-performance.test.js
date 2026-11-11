import { tickSurvival } from "../src/simulation.js";
import { Inventory } from "../src/inventory.js";
import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { World } from "../src/world.js";
import { B, MOB_INFO } from "../src/data.js";
import { createPlayer, collides } from "../src/physics.js";
import {
  tickWeather,
  tickWeatherDamage,
  setWeather,
  weatherAt,
} from "../src/weather.js";
import { WeatherRenderer, stormVisualBudget } from "../src/weather-renderer.js";
import { snowColumn } from "../src/snow.js";
function game() {
  const w = new World("Weather performance"),
    p = createPlayer({ x: 8.5, y: 201, z: 8.5 });
  w.ensure(0, 0);
  setWeather(w, "tornado");
  Object.assign(w.weather, {
    intensity: 1,
    nextStrike: 1e9,
    funnel: { x: 8, z: 8, seed: 123, heading: 0, drift: 0, age: 0 },
  });
  return {
    world: w,
    player: p,
    mode: "creative",
    difficulty: "normal",
    entities: [],
    drops: [],
    damage(n) {
      this.player.health -= n;
    },
  };
}
function visual() {
  const w = {
    tick: 10,
    dimension: "overworld",
    weather: { kind: "tornado", intensity: 1, funnel: { x: 0, z: 0, seed: 7 } },
    revisions: new Map(),
    terrain: () => ({ h: 80, biome: "meadow" }),
    skyHeight: () => 80,
  };
  const settings = {
    particles: "all",
    renderDistance: 4,
    weatherEffects: true,
    lightningFlashes: true,
  };
  return {
    world: w,
    p: createPlayer({ x: 0, y: 85, z: 30 }),
    settings,
    r: new WeatherRenderer(new THREE.Scene(), settings),
  };
}
test("a travelling tornado never loads terrain or checks roofs for remote saved mobs/drops, including after unloads", () => {
  const g = game(),
    w = g.world;
  g.entities = Array.from({ length: 128 }, (_, i) => ({
    type: "cow",
    hp: 20,
    x: 10000 + i * 32,
    y: 201,
    z: 10000,
    vy: 0,
  }));
  g.drops = [{ id: "diamond", count: 1, x: -10000, y: 201, z: -10000 }];
  let roofs = 0;
  const sky = w.skyHeight.bind(w);
  w.skyHeight = (...a) => {
    if (Math.abs(a[0]) > 100 || Math.abs(a[1]) > 100) roofs++;
    return sky(...a);
  };
  const chunks = w.chunks.size;
  for (let t = 4; t <= 48; t += 4) {
    w.tick = t;
    tickWeather(g);
    w.unload(0, 0, 1);
  }
  assert.equal(roofs, 0);
  assert.equal(w.chunks.size, chunks);
  assert.equal(g.entities[0].x, 10000);
  assert.equal(g.drops[0].x, -10000);
});
test("nearby wind moves exposed bodies, preserves shelter and real mob bounds, and suspends movement at unloaded edges", () => {
  const g = game(),
    w = g.world;
  w.set(12, 200, 8, B.stone);
  const e = {
    type: "polar_bear",
    hp: 30,
    x: 12.5,
    y: 201,
    z: 8.5,
    vy: 0,
    onGround: true,
  };
  g.entities = [e];
  assert.equal(
    collides(w, e, MOB_INFO[e.type].height, MOB_INFO[e.type].width),
    false,
  );
  w.tick = 4;
  tickWeather(g);
  assert.ok(Math.hypot(e.x - 12.5, e.z - 8.5) > 0.1);
  assert.equal(collides(w, e, 1.45, 1.1), false);
  assert.ok(e.vy > 0);
  w.set(12, 204, 8, B.planks);
  Object.assign(e, { x: 12.5, y: 201, z: 8.5, vy: 0 });
  w.tick = 8;
  tickWeather(g);
  assert.equal(e.x, 12.5);
  assert.equal(e.vy, 0);
  Object.assign(w.weather.funnel, { x: 17, z: 8 });
  Object.assign(e, { x: 15.9, y: 201, z: 8.5 });
  const before = w.chunks.size;
  w.tick = 12;
  tickWeather(g);
  assert.equal(e.x, 15.9);
  assert.equal(w.chunks.size, before);
});
test("snow heat checks at chunk corners and weather views of unloaded positions do not stream neighbor chunks", () => {
  const g = game(),
    w = g.world;
  w.set(15, 200, 15, B.stone);
  const n = w.chunks.size;
  assert.ok(snowColumn(w, 15, 15, true, true));
  assert.equal(w.chunks.size, n);
  weatherAt(w, { x: 20000, y: 201, z: 20000 });
  assert.equal(w.chunks.size, n);
});
test("storm quality and distance budgets reduce work, cap close particle size, and reuse static GPU buffers", () => {
  const { r, world, p, settings } = visual();
  const pos = r.funnel.geometry.attributes.position,
    version = pos.version;
  r.update(world, p, 1 / 60, 0, true);
  assert.equal(r.stats.funnelParticles, 512);
  assert.equal(r.debris.count, 48);
  assert.equal(r.shell.material.forceSinglePass, true);
  assert.equal(r.funnel.frustumCulled, true);
  assert.equal(r.debris.frustumCulled, true);
  settings.particles = "decreased";
  r.update(world, p, 1 / 60, 0.02, true);
  assert.equal(r.stats.funnelParticles, 256);
  settings.particles = "minimal";
  r.update(world, p, 1 / 60, 0.04, true);
  assert.equal(r.stats.funnelParticles, 96);
  assert.equal(r.debris.count, 8);
  assert.equal(r.funnel.material.uniforms.maxPointPixels.value, 4);
  for (let i = 0; i < 200; i++) r.update(world, p, 1 / 60, i / 60, true);
  assert.equal(pos.version, version);
  assert.equal(r.funnel.geometry.attributes.position, pos);
  assert.ok(stormVisualBudget(settings, 110).points < 96);
  assert.deepEqual(stormVisualBudget(settings, 1000), { points: 0, debris: 0 });
  r.update(world, { ...p, z: 1000 }, 1 / 60, 4, true);
  assert.equal(r.shell.visible, false);
  assert.equal(r.debris.count, 0);
});
test("precipitation roof sampling is budgeted, reuses warmed columns, and invalidates immediately on roof edits", () => {
  const { r, world, p } = visual();
  let checks = 0,
    roof = 80;
  world.skyHeight = () => {
    checks++;
    return roof;
  };
  for (let i = 0; i < 30; i++) {
    r.update(world, p, 1 / 60, i / 60, true);
    assert.ok(r.stats.roofQueries <= 32);
  }
  const before = checks;
  r.update(world, p, 1 / 60, 0.51, true);
  assert.equal(checks, before);
  assert.equal(r.stats.roofQueries, 0);
  assert.ok(r.roofs.size <= 1024);
  roof = 100;
  for (let z = -2; z <= 2; z++)
    for (let x = -2; x <= 2; x++) world.revisions.set(`${x},${z}`, 1);
  r.update(world, p, 1 / 60, 0.52, true);
  assert.equal(r.sample(world, p, 0.52).exposed, false);
  assert.ok(r.stats.roofQueries > 0 && r.stats.roofQueries <= 32);
});
test("paused weather reuses debris matrices; all weather and lightning toggles hide their respective visuals", () => {
  const { r, world, p, settings } = visual();
  r.update(world, p, 0.05, 0, true);
  const version = r.debris.instanceMatrix.version;
  for (let i = 0; i < 30; i++) r.update(world, p, 0, 0, true);
  assert.equal(r.debris.instanceMatrix.version, version);
  world.weather.strike = { x: 0, y: 80, z: 0, tick: 10, seed: 1 };
  r.update(world, p, 0, 0, true);
  assert.equal(r.bolt.visible, true);
  settings.lightningFlashes = false;
  r.update(world, p, 0, 0, true);
  assert.equal(r.bolt.visible, false);
  settings.weatherEffects = false;
  r.update(world, p, 0.05, 1, true);
  for (const o of [r.rain, r.snow, r.hail, r.shell, r.funnel, r.debris, r.bolt])
    assert.equal(o.visible, false);
  assert.equal(r.stats.roofQueries, 0);
  assert.equal(r.debris.count, 0);
});
test("lightning geometry is reused and refreshes for same-tick strikes and realm changes", () => {
  const { r, world, p } = visual();
  const geo = r.bolt.geometry;
  world.weather.strike = { x: 1, y: 80, z: 0, tick: 10 };
  r.update(world, p, 0, 0, true);
  assert.equal(r.boltPositions[0], 1);
  world.weather.strike = { x: 22, y: 80, z: 0, tick: 10 };
  r.update(world, p, 0, 0, true);
  assert.equal(r.boltPositions[0], 22);
  const other = {
    ...world,
    weather: { ...world.weather, strike: { x: 40, y: 80, z: 0, tick: 10 } },
  };
  r.update(other, p, 0, 0, true);
  assert.equal(r.boltPositions[0], 40);
  assert.equal(r.bolt.geometry, geo);
  r.update({ ...other, dimension: "cinderwild" }, p, 0, 0, true);
  assert.equal(r.bolt.visible, false);
});
test("low swimming poses stay sheltered, while exposed players still receive wind and debris damage", () => {
  const g = game(),
    w = g.world;
  g.mode = "survival";
  w.terrain = () => ({ h: 199, biome: "meadow" });
  w.set(8, 201, 8, B.stone);
  Object.assign(g.player, { y: 200, swimming: true });
  assert.equal(weatherAt(w, g.player).exposed, false);
  w.tick = 40;
  tickWeatherDamage(g);
  assert.equal(g.player.health, 20);
  assert.equal(g.player.x, 8.5);
  w.set(8, 201, 8, B.air);
  Object.assign(g.player, { y: 201, swimming: false });
  assert.equal(weatherAt(w, g.player).exposed, true);
  tickWeatherDamage(g);
  assert.equal(g.player.health, 19);
  assert.notEqual(g.player.x, 8.5);
});

test("normal survival ticks also suspend remote persistent NPC contact checks and unloaded item physics, resuming items when loaded", () => {
  const g = game(),
    w = g.world;
  g.inventory = new Inventory();
  g.settings = { renderDistance: 2 };
  g.audio = { tone() {}, voice() {} };
  g.ui = { updateHUD() {}, updateHotbar() {}, toast() {}, announce() {} };
  g.time = 1000;
  g.tickCount = 9;
  g.elapsed = 1;
  w.simulate = () => w.tick++;
  g.entities = [
    {
      id: "far-villager",
      type: "villager",
      hp: 20,
      persistent: true,
      x: 10000.5,
      y: 201,
      z: 0.5,
      age: 9,
      turn: 0,
      dir: 0,
      vx: 0,
      vy: 0,
      vz: 0,
      hurt: 0,
      attack: 0,
    },
  ];
  g.drops = [
    {
      uid: "far-drop",
      id: "diamond",
      count: 1,
      x: 10002.5,
      y: 201,
      z: 0.5,
      vy: 0,
      age: 7,
      delay: 0,
    },
  ];
  const n = w.chunks.size;
  tickSurvival(g);
  assert.equal(w.chunks.size, n);
  assert.equal(g.entities[0].hp, 20);
  assert.equal(g.drops[0].age, 7);
  assert.equal(g.drops[0].y, 201);
  w.ensure(625, 0);
  g.mode = "survival";
  g.multiplayer = {
    connected: true,
    isGuest: false,
    peers: new Map([
      ["guest", { player: createPlayer({ x: 10000.5, y: 201, z: 0.5 }) }],
    ]),
  };
  tickSurvival(g);
  assert.equal(g.drops[0].age, 8);
  assert.ok(g.drops[0].y < 201);
  g.multiplayer = null;
  Object.assign(g.player, { x: 10000.5, y: 201, z: 0.5 });
  tickSurvival(g);
  assert.equal(g.drops[0].age, 9);
  assert.ok(g.drops[0].y < 201);
});
