// Jobs run serially in each worker. Reuse overlapping 3×3 neighborhoods, bounded
// to a 5×5 ring. Exact per-chunk edit stamps invalidate removed edits as well.
export function prepareWorkerChunks(world, job, stamps) {
  const grouped = new Map();
  for (const [pos, id] of Object.entries(job.edits || {})) {
    const [x, y, z] = pos.split(",").map(Number),
      key = `${Math.floor(x / 16)},${Math.floor(z / 16)}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push([x, y, z, id]);
  }
  for (let dz = -1; dz <= 1; dz++)
    for (let dx = -1; dx <= 1; dx++) {
      const key = `${job.cx + dx},${job.cz + dz}`,
        stamp = JSON.stringify(
          (grouped.get(key) || []).sort(
            (a, b) => a[1] - b[1] || a[2] - b[2] || a[0] - b[0],
          ),
        );
      if (stamps.get(key) !== stamp) {
        world.chunks.delete(key);
        stamps.set(key, stamp);
      }
    }
  world.unload(job.cx, job.cz, 2);
  for (const key of stamps.keys()) {
    const [x, z] = key.split(",").map(Number);
    if (Math.abs(x - job.cx) > 2 || Math.abs(z - job.cz) > 2)
      stamps.delete(key);
  }
}
