import { carveWildCaves } from "./wild-caves.js";
import { carveDeepCaves } from "./cave-update.js";
import { hash } from "./random.js";
import { B, MIN_Y, SEA } from "./data.js";

// A connected network of seeded chambers and sloping tunnels. Neighbouring
// chunks evaluate the same world-space segments, independent of load order.
export function caveNode(rx, rz, seed) {
  return {
    x: rx * 96 + 32 + hash(rx, 1, rz, seed + 9911) * 32,
    z: rz * 96 + 32 + hash(rx, 2, rz, seed + 9911) * 32,
    y: -36 + hash(rx, 3, rz, seed + 9911) * 64,
    radius: 8 + hash(rx, 4, rz, seed + 9911) * 9,
  };
}
export function carveCaveSystems(world, chunk, put) {
  if (world.generationVersion >= 14) return carveWildCaves(world, chunk, put);
  if (world.generationVersion >= 12) return carveDeepCaves(world, chunk, put);
  const ox = chunk.cx * 16,
    oz = chunk.cz * 16,
    seed = world.seedInt;
  const carve = (a, b, radius, chamber = false, entrance = false) => {
    if (
      Math.max(a.x, b.x) + radius < ox ||
      Math.min(a.x, b.x) - radius > ox + 15 ||
      Math.max(a.z, b.z) + radius < oz ||
      Math.min(a.z, b.z) - radius > oz + 15
    )
      return;
    const dx = b.x - a.x,
      dz = b.z - a.z,
      length2 = dx * dx + dz * dz;
    for (let z = 0; z < 16; z++)
      for (let x = 0; x < 16; x++) {
        const wx = ox + x,
          wz = oz + z,
          terrain = world.terrain(wx, wz);
        if (terrain.village) continue;
        const t = length2
          ? Math.max(
              0,
              Math.min(1, ((wx - a.x) * dx + (wz - a.z) * dz) / length2),
            )
          : 0;
        const distance = Math.hypot(wx - a.x - dx * t, wz - a.z - dz * t);
        if (distance >= radius) continue;
        const mid = a.y + (b.y - a.y) * t,
          vertical =
            (chamber ? radius * 0.65 : radius) *
            Math.sqrt(1 - (distance / radius) ** 2);
        const ceiling =
          entrance && terrain.h > SEA + 4 ? terrain.h + 1 : terrain.h - 6;
        for (
          let y = Math.max(MIN_Y + 5, Math.ceil(mid - vertical));
          y <= Math.min(ceiling, Math.floor(mid + vertical));
          y++
        )
          put(x, y, z, B.air);
      }
  };
  const rx0 = Math.floor(ox / 96),
    rz0 = Math.floor(oz / 96);
  for (let rz = rz0 - 1; rz <= rz0 + 1; rz++)
    for (let rx = rx0 - 1; rx <= rx0 + 1; rx++) {
      const a = caveNode(rx, rz, seed);
      carve(a, a, a.radius, true);
      for (const [dx, dz] of [
        [1, 0],
        [0, 1],
      ])
        carve(
          a,
          caveNode(rx + dx, rz + dz, seed),
          2.6 + hash(rx, dx + 8, rz + dz, seed) * 1.4,
        );
      if (hash(rx, 9, rz, seed) > 0.52) {
        const x = Math.floor(a.x + 24),
          z = Math.floor(a.z - 18),
          t = world.terrain(x, z);
        if (!t.village && t.h > SEA + 4)
          carve(a, { x, z, y: t.h + 1 }, 3.6, false, true);
      }
    }
}
