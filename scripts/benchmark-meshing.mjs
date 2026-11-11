import { World } from "../src/world.js";
import { meshChunk } from "../src/mesher.js";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
function measure(W, mesh) {
  const w = new W("Wildflower", {}, "overworld", 3),
    chunks = [
      [0, 0],
      [2, -1],
      [-1, 3],
    ].map(([x, z]) => w.ensure(x, z));
  for (const c of chunks) mesh(w, c, { biomeBlend: 2 });
  const samples = [];
  let calls = 0,
    vertices = 0;
  const original = w.terrain.bind(w);
  w.terrain = (...args) => {
    calls++;
    return original(...args);
  };
  for (let run = 0; run < 7; run++) {
    calls = 0;
    vertices = 0;
    const start = performance.now();
    for (const c of chunks)
      for (const g of mesh(w, c, { biomeBlend: 2 }))
        if (g) vertices += g.position.length / 3;
    samples.push(performance.now() - start);
  }
  return {
    medianMs: +samples.sort((a, b) => a - b)[3].toFixed(2),
    terrainQueries: calls,
    vertices,
  };
}
const results = { current: measure(World, meshChunk) };
const baseline = process.argv
  .find((a) => a.startsWith("--baseline="))
  ?.slice(11);
if (baseline) {
  const root = pathToFileURL(resolve(baseline) + "/");
  const { World: W } = await import(new URL("src/world.js", root));
  const { meshChunk: mesh } = await import(new URL("src/mesher.js", root));
  results.baseline = measure(W, mesh);
  results.cpuRatio = +(
    results.baseline.medianMs / results.current.medianMs
  ).toFixed(2);
}
console.log(JSON.stringify(results, null, 2));
