import { B, BLOCKS, MIN_Y, MAX_Y } from "./data.js";
import { hash } from "./random.js";
export function explosionCells(world, origin, power = 4, serial = world.tick) {
  const hit = new Map(),
    n = 12,
    limit = 512;
  for (let iz = 0; iz < n; iz++)
    for (let iy = 0; iy < n; iy++)
      for (let ix = 0; ix < n; ix++) {
        if (ix && ix < n - 1 && iy && iy < n - 1 && iz && iz < n - 1) continue;
        let dx = (ix / (n - 1)) * 2 - 1,
          dy = (iy / (n - 1)) * 2 - 1,
          dz = (iz / (n - 1)) * 2 - 1,
          d = Math.hypot(dx, dy, dz);
        dx /= d;
        dy /= d;
        dz /= d;
        let energy =
            power * (0.7 + hash(ix, iy + serial, iz, world.seedInt) * 0.6),
          x = origin.x,
          y = origin.y + 0.4,
          z = origin.z;
        for (
          let step = 0;
          energy > 0 && step < 32;
          step++, x += dx * 0.3, y += dy * 0.3, z += dz * 0.3
        ) {
          const px = Math.floor(x),
            py = Math.floor(y),
            pz = Math.floor(z);
          if (
            py <= MIN_Y ||
            py > MAX_Y ||
            !world.chunks.has(`${Math.floor(px / 16)},${Math.floor(pz / 16)}`)
          )
            break;
          const id = world.get(px, py, pz),
            b = BLOCKS[id],
            key = `${px},${py},${pz}`;
          if (
            b?.hardness === Infinity ||
            b?.relic ||
            world.containers?.[key] ||
            ["chest", "furnace", "bed", "runestone", "glow_crystal"].includes(
              b?.key,
            )
          )
            break;
          if (id && b?.solid)
            energy -= Math.max(0.1, b.hardness || 0) * 0.2 + 0.2;
          if (
            energy > 0 &&
            id &&
            b?.solid &&
            !b.door &&
            b.hardness <= 5 &&
            hit.size < limit
          )
            hit.set(key, { x: px, y: py, z: pz, id });
          energy -= 0.225;
        }
      }
  return [...hit.values()];
}
