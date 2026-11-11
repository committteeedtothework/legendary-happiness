// CPU-only reproduction; optionally point --baseline at an installed source tree.
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import * as THREE from "three";
const arg = process.argv.indexOf("--baseline"),
  root =
    arg >= 0
      ? resolve(process.argv[arg + 1])
      : resolve(import.meta.dirname, "..");
const { World } = await import(pathToFileURL(resolve(root, "src/world.js"))),
  { tickWeather, setWeather } = await import(
    pathToFileURL(resolve(root, "src/weather.js"))
  ),
  { WeatherRenderer } = await import(
    pathToFileURL(resolve(root, "src/weather-renderer.js"))
  );
const median = (a) => a.sort((a, b) => a - b)[Math.floor(a.length / 2)];
let chunks = [],
  roofCounts = [],
  ticks = [];
for (let run = 0; run < 5; run++) {
  const w = new World("Storm benchmark"),
    p = { x: 8, y: 201, z: 8, health: 20 };
  w.ensure(0, 0);
  setWeather(w, "tornado");
  Object.assign(w.weather, {
    intensity: 1,
    nextStrike: 1e9,
    funnel: { x: 8, z: 8, age: 0, seed: 123, heading: 0, drift: 0 },
  });
  w.tick = 4;
  const g = {
    world: w,
    player: p,
    mode: "creative",
    difficulty: "normal",
    entities: Array.from({ length: 96 }, (_, i) => ({
      id: "remote" + i,
      type: "cow",
      x: 10000 + i * 32,
      y: 200,
      z: 10000,
      hp: 20,
      vy: 0,
    })),
    drops: [],
  };
  let roofs = 0;
  const sky = w.skyHeight.bind(w);
  w.skyHeight = (...a) => {
    roofs++;
    return sky(...a);
  };
  const n = w.chunks.size,
    start = performance.now();
  tickWeather(g);
  ticks.push(performance.now() - start);
  chunks.push(w.chunks.size - n);
  roofCounts.push(roofs);
}
const renderer = [];
for (const particles of ["all", "minimal"]) {
  const world = {
      tick: 1,
      dimension: "overworld",
      weather: {
        kind: "tornado",
        intensity: 1,
        funnel: { x: 8, z: 8, seed: 123 },
      },
      terrain: () => ({ h: 80, biome: "meadow" }),
      skyHeight: () => 80,
    },
    p = { x: 8, y: 201, z: 8 },
    r = new WeatherRenderer(new THREE.Scene(), {
      particles,
      weatherEffects: true,
    }),
    times = [];
  for (let i = 0; i < 600; i++) {
    const start = performance.now();
    r.update(world, p, 1 / 60, i / 60, true);
    if (i >= 50) times.push(performance.now() - start);
  }
  const sorted = times.toSorted((a, b) => a - b);
  renderer.push({
    particles,
    medianUpdateMs: median(times),
    p95UpdateMs: sorted[Math.floor(sorted.length * 0.95)],
    funnelPoints:
      r.funnel.geometry.drawRange.count === Infinity
        ? r.funnelCount
        : r.funnel.geometry.drawRange.count,
    debris: r.debris.count,
  });
}
console.log(
  JSON.stringify(
    {
      scope:
        "Node CPU-only, five fresh tornado ticks with 96 remote saved creatures; renderer 550 warm frames. No hardware FPS claim.",
      baseline: arg >= 0,
      tornado: {
        medianTickMs: median(ticks),
        newChunksEachTick: chunks,
        roofChecksEachTick: roofCounts,
      },
      renderer,
    },
    null,
    2,
  ),
);
