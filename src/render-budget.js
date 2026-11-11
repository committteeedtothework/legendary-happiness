import { B, BLOCKS } from "./data.js";
import { weatherColumnLoaded } from "./weather-spatial.js";

// Select only from the existing loaded light index. Never scan a world's entire
// edit history or load terrain merely to draw a light. Keep at most four ranks.
export function nearbyBlockLights(world, player, count = 4, radius = 20) {
  const nearest = [];
  if (count <= 0) return nearest;
  for (const pos of world.generatedLights || []) {
    const [x, y, z] = pos.split(",").map(Number),
      dx = x - player.x,
      dz = z - player.z,
      dy = y - player.y;
    const rank = dx * dx + dz * dz;
    if (rank + dy * dy >= radius * radius || !weatherColumnLoaded(world, x, z))
      continue;
    if (nearest.length >= count && rank >= nearest.at(-1).rank) continue;
    const id = world.get(x, y, z);
    if (id !== B.torch && id !== B.glow_crystal && !BLOCKS[id]?.light) continue;
    let at = nearest.findIndex((n) => n.rank > rank);
    if (at < 0) at = nearest.length;
    nearest.splice(at, 0, { x, y, z, rank });
    if (nearest.length > count) nearest.pop();
  }
  return nearest;
}
export function nearestPlayerDistance(body, players) {
  let best = Infinity;
  for (const p of players) {
    const x = body.x - p.x,
      z = body.z - p.z;
    best = Math.min(best, x * x + z * z);
  }
  return Math.sqrt(best);
}
export function applyDisplayResolution(
  renderer,
  settings,
  width,
  height,
  deviceRatio = 1,
) {
  const level = Math.max(1, Math.min(5, Math.round(settings.graphics || 3)));
  const ratio =
    Math.min(deviceRatio || 1, settings.maxPixelRatio ?? 2) *
    [0.5, 0.7, 1, 1.25, 1.5][level - 1];
  if (renderer.displayRatio !== ratio) renderer.gl.setPixelRatio(ratio);
  if (renderer.displayWidth !== width || renderer.displayHeight !== height)
    renderer.gl.setSize(width, height);
  renderer.displayRatio = ratio;
  renderer.displayWidth = width;
  renderer.displayHeight = height;
}
