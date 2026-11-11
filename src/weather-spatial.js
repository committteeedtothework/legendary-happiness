// Weather is a consumer of loaded terrain. It must never stream remote chunks.
export function weatherChunkKey(x, z) {
  return `${Math.floor(x / 16)},${Math.floor(z / 16)}`;
}
export function weatherColumnLoaded(world, x, z) {
  return !world.chunks?.has || world.chunks.has(weatherChunkKey(x, z));
}
export function weatherRoof(world, x, z) {
  if (!weatherColumnLoaded(world, x, z)) return null;
  return world.skyHeight?.(Math.floor(x), Math.floor(z)) ?? null;
}
export function weatherBodyLoaded(world, body, dx, dz, width = 0.6) {
  if (!world.chunks?.has) return true;
  const half = width / 2;
  for (const x of [
    body.x - half,
    body.x + half,
    body.x + dx - half,
    body.x + dx + half,
  ])
    for (const z of [
      body.z - half,
      body.z + half,
      body.z + dz - half,
      body.z + dz + half,
    ])
      if (!weatherColumnLoaded(world, x, z)) return false;
  return true;
}
