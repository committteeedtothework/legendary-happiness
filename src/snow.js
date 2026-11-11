import { peek } from "./block-dynamics.js";
import { B, BLOCKS, MAX_Y } from "./data.js";
import { hash } from "./random.js";
// A bounded random tick pass; no distant chunks are loaded for snowfall.
export function snowColumn(world, x, z, cold, snowing, occupants = []) {
  x = Math.floor(x);
  z = Math.floor(z);
  if (!world.chunks.has(`${Math.floor(x / 16)},${Math.floor(z / 16)}`))
    return false;
  let y = world.skyHeight(x, z),
    id = world.get(x, y, z),
    layers = BLOCKS[id]?.snowLayers || 0;
  if (!layers) {
    y++;
    id = world.get(x, y, z);
  }
  if (y > MAX_Y) return false;
  const hot = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 1, 0],
    [0, 0, 1],
    [0, 0, -1],
  ].some(([dx, dy, dz]) => {
    const key = BLOCKS[peek(world, x + dx, y + dy, z + dz)]?.key || "";
    return /^(fire|torch|lava)(_|$)/.test(key);
  });
  if (layers && (!cold || hot))
    return world.set(
      x,
      y,
      z,
      layers > 1 ? B[`snow_layer_${layers - 1}`] : B.air,
    );
  if (!snowing || !cold || hot || layers >= 8 || (id !== B.air && !layers))
    return false;
  const support = BLOCKS[world.get(x, y - 1, z)];
  if (!support?.solid || support.door || support.snowLayers || support.bounds)
    return false;
  const top = y + (layers + 1) / 8;
  if (
    occupants.some(
      (p) =>
        p.x + 0.5 > x &&
        p.x - 0.5 < x + 1 &&
        p.z + 0.5 > z &&
        p.z - 0.5 < z + 1 &&
        p.y < top &&
        p.y + 1.8 > y,
    )
  )
    return false;
  return world.set(x, y, z, B[`snow_layer_${layers + 1}`]);
}
export function tickSnow(game, precipitation) {
  const w = game.world;
  if (w.dimension !== "overworld" || w.tick % 20) return;
  const people = [
    game.player,
    ...(game.multiplayer?.peers?.values?.() || []),
  ].map((p) => p.player || p);
  let changed = 0;
  for (let i = 0; i < 32 && changed < 4; i++) {
    const p = people[i % people.length],
      x = Math.floor(p.x + (hash(w.tick, i, 71, w.seedInt) - 0.5) * 40),
      z = Math.floor(p.z + (hash(w.tick, i, 73, w.seedInt) - 0.5) * 40);
    const t = w.terrain(x, z),
      cold = precipitation(t.biome, t.h) === "snow";
    if (
      snowColumn(
        w,
        x,
        z,
        cold,
        w.weather.kind !== "clear" && w.weather.intensity > 0.55,
        people,
      )
    )
      changed++;
  }
}
