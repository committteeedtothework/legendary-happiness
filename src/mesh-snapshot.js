import { chunkLightSources } from "./block-light.js";
// Worker input never detaches or mutates authoritative game chunk buffers.
// The one-chunk ring supplies all neighbor faces, shape connections and AO.
export function snapshotMeshChunks(world, cx, cz) {
  const chunks = [],
    transfers = [];
  for (let dz = -1; dz <= 1; dz++)
    for (let dx = -1; dx <= 1; dx++) {
      const c = world.chunks.get(`${cx + dx},${cz + dz}`);
      if (!c) continue;
      const data = c.data.slice();
      chunks.push({
        key: c.key,
        cx: c.cx,
        cz: c.cz,
        maxY: c.maxY,
        lightSources: chunkLightSources(c),
        data,
      });
      transfers.push(data.buffer);
    }
  return { chunks, transfers };
}
export function applyMeshSnapshot(world, chunks = []) {
  for (const c of chunks) world.chunks.set(c.key, c);
}
