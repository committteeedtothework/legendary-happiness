import {expandVillagePlan} from "./village-expansion.js";
import {
  regionalVillage,
  styleForBiome,
  VILLAGE_STYLES,
} from "./village-styles.js";
import { B, SEA, makeStack } from "./data.js";
import { hash } from "./random.js";
import { doorId } from "./doors.js";
export const VILLAGE_SPACING = 512;
export const villageSpacing = (world) =>
  world.generationVersion >= 13
    ? 1536
    : world.generationVersion >= 6
      ? VILLAGE_SPACING
      : 192;
const houses = [
  [-17, -15],
  [9, -15],
  [-17, 10],
  [9, 10],
];
export function villageAt(world, rx, rz) {
  if (world.dimension !== "overworld" || world.generationVersion < 3)
    return null;
  const key = `${rx},${rz}`;
  world.villagePlans ||= new Map();
  if (world.villagePlans.has(key)) return world.villagePlans.get(key);
  const expanded = world.generationVersion >= 5;
  const layout = expanded
    ? [...houses, [-32, -28], [24, -28], [-32, 24], [24, 24]]
    : houses;
  const spacing = villageSpacing(world),
    regional = world.generationVersion >= 6;
  const s = world.seedInt;
  let result = null;
  for (let attempt = 0; attempt < (regional ? 12 : 6); attempt++) {
    const x =
      rx * spacing +
      (world.generationVersion >= 13 ? 512 : regional ? 192 : 48) +
      Math.floor(
        hash(rx, attempt, rz, s + 2107) *
          (world.generationVersion >= 13 ? 512 : regional ? 128 : 96),
      );
    const z =
      rz * spacing +
      (world.generationVersion >= 13 ? 512 : regional ? 192 : 48) +
      Math.floor(
        hash(rz, attempt, rx, s + 2911) *
          (world.generationVersion >= 13 ? 512 : regional ? 128 : 96),
      );
    const t = world.baseTerrain(x, z);
    const margin = world.generationVersion >= 13 ? 50 : 26;
    const corners = [
      [-margin, -margin],
      [margin, -margin],
      [-margin, margin],
      [margin, margin],
    ].map(([a, b]) => world.baseTerrain(x + a, z + b).h);
    if (
      t.h > SEA + 3 &&
      t.h < (regional ? 115 : 100) &&
      corners.every((h) => h > SEA && Math.abs(h - t.h) < (regional ? 14 : 9))
    ) {
      result = {
        id: `village:${key}`,
        x,
        z,
        y: t.h,
        biome: t.biome,
        ...(regional ? { style: styleForBiome(t.biome) } : {}),
        ...(expanded ? { radius: 42 } : {}),
        houses: layout.map(([dx, dz], i) => ({
          ...(regional
            ? {
                floor: t.h + (VILLAGE_STYLES[styleForBiome(t.biome)].lift || 0),
              }
            : {}),
          x: x + dx,
          z: z + dz,
          doorX: x + dx + 3,
          doorZ: z + dz + 6,
          profession: ["farmer", "mason", "shepherd", "farmer"][i % 4],
        })),
      };
      break;
    }
  }
  result=expandVillagePlan(world,result);
  world.villagePlans.set(key, result);
  return result;
}
export function nearbyVillages(world, x, z, radius = 64) {
  const villages = [],
    spacing = villageSpacing(world);
  for (
    let rz = Math.floor((z - radius) / spacing);
    rz <= Math.floor((z + radius) / spacing);
    rz++
  )
    for (
      let rx = Math.floor((x - radius) / spacing);
      rx <= Math.floor((x + radius) / spacing);
      rx++
    ) {
      const v = villageAt(world, rx, rz);
      if (
        v &&
        Math.abs(x - v.x) < radius + 70 &&
        Math.abs(z - v.z) < radius + 70
      )
        villages.push(v);
    }
  return villages;
}
export function villageTerrain(world, x, z, base) {
  for (const v of nearbyVillages(
    world,
    x,
    z,
    world.generationVersion >=16?74:world.generationVersion >= 5 ? 50 : 36,
  )) {
    const d = Math.max(Math.abs(x - v.x), Math.abs(z - v.z));
    const radius = v.radius || 28;
    if (d <= radius) return { ...base, h: v.y, village: v.id };
    if (d < radius + 8)
      return {
        ...base,
        h: Math.round(v.y + ((base.h - v.y) * (d - radius)) / 8),
      };
  }
  return base;
}
export function generateVillages(world, chunk, put) {
  for (const v of nearbyVillages(
    world,
    chunk.cx * 16 + 8,
    chunk.cz * 16 + 8,
    world.generationVersion >=16?82:world.generationVersion >= 5 ? 58 : 42,
  )) {
    if (v.style) {
      regionalVillage(world, chunk, put, v);
      continue;
    }
    const set = (x, y, z, id) =>
      put(x - chunk.cx * 16, y, z - chunk.cz * 16, id);
    // Branching lanes, a central well and a communal green.
    const radius = (v.radius || 28) - 1;
    for (
      let dz = Math.max(-radius, chunk.cz * 16 - v.z);
      dz <= Math.min(radius, chunk.cz * 16 + 15 - v.z);
      dz++
    )
      for (
        let dx = Math.max(-radius, chunk.cx * 16 - v.x);
        dx <= Math.min(radius, chunk.cx * 16 + 15 - v.x);
        dx++
      ) {
        if (
          Math.abs(dx) <= 2 ||
          Math.abs(dz) <= 2 ||
          (Math.abs(dx) < 22 && (dz === -7 || dz === 17))
        )
          set(v.x + dx, v.y, v.z + dz, B.path);
        for (let dy = 1; dy <= 8; dy++)
          set(v.x + dx, v.y + dy, v.z + dz, B.air);
      }
    if (v.radius) {
      for (const h of v.houses) {
        const dz = h.doorZ - v.z + 2;
        for (let x = Math.min(h.doorX, v.x); x <= Math.max(h.doorX, v.x); x++) {
          for (let w = -1; w <= 1; w++) set(x, v.y, v.z + dz + w, B.path);
        }
        set(h.doorX, v.y, h.doorZ + 1, B.path);
      }
      // Stone seating, planted borders and extra lantern posts give the green a center.
      for (const dx of [-8, 8])
        for (let dz = -2; dz <= 2; dz++)
          set(v.x + dx, v.y + 1, v.z + dz, B.cobble);
      for (const dx of [-6, 6])
        for (const dz of [-9, 9]) {
          set(v.x + dx, v.y + 1, v.z + dz, B.leaves);
          set(v.x + dx, v.y + 2, v.z + dz, B.fern);
        }
      for (const dx of [-22, 22])
        for (const dz of [-4, 36]) {
          for (let dy = 1; dy <= 3; dy++)
            set(v.x + dx, v.y + dy, v.z + dz, B.log);
          set(v.x + dx, v.y + 4, v.z + dz, B.torch);
        }
    }
    for (const h of v.houses) {
      for (let dz = 0; dz < 7; dz++)
        for (let dx = 0; dx < 7; dx++) {
          set(h.x + dx, v.y, h.z + dz, B.cobble);
          for (let dy = 1; dy <= 4; dy++) {
            const corner = (dx === 0 || dx === 6) && (dz === 0 || dz === 6),
              edge = dx === 0 || dx === 6 || dz === 0 || dz === 6;
            const desert = v.biome === "desert";
            const door = dz === 6 && dx === 3 && dy <= 2;
            const window =
              edge &&
              !corner &&
              dy === 2 &&
              (dx === 2 || dx === 4 || dz === 2 || dz === 4);
            set(
              h.x + dx,
              v.y + dy,
              h.z + dz,
              door
                ? doorId(2, false, dy === 2)
                : corner
                  ? desert
                    ? B.sandstone
                    : B.log
                  : edge
                    ? window
                      ? B.glass
                      : desert
                        ? B.sandstone
                        : B.planks
                    : B.air,
            );
          }
        }
      if (v.biome === "desert") {
        for (let dz = -1; dz <= 7; dz++)
          for (let dx = -1; dx <= 7; dx++)
            set(h.x + dx, v.y + 5, h.z + dz, B.sandstone);
        for (const dx of [0, 6])
          for (const dz of [0, 6])
            set(h.x + dx, v.y + 6, h.z + dz, B.sandstone);
      } else {
        // A pitched block roof with a projecting eave, not a solid roof slab.
        for (let layer = 0; layer < 4; layer++)
          for (let dz = -1; dz <= 7; dz++)
            for (const dx of [layer - 1, 7 - layer])
              set(h.x + dx, v.y + 5 + layer, h.z + dz, B.planks);
        for (let dx = 0; dx < 7; dx++)
          for (let dy = 5; dy < 8; dy++)
            if (dx > dy - 6 && dx < 12 - dy) {
              set(h.x + dx, v.y + dy, h.z, B.planks);
              set(h.x + dx, v.y + dy, h.z + 6, B.planks);
            }
      }
      set(h.x + 1, v.y + 1, h.z + 1, B.bed);
      set(
        h.x + 5,
        v.y + 1,
        h.z + 1,
        h.profession === "mason" ? B.furnace : B.crafting_table,
      );
      set(h.x + 1, v.y + 1, h.z + 5, B.chest);
      const pos = `${h.x + 1},${v.y + 1},${h.z + 5}`;
      if (
        Math.floor((h.x + 1) / 16) === chunk.cx &&
        Math.floor((h.z + 5) / 16) === chunk.cz &&
        !world.containers[pos] &&
        !world.edits.has(pos)
      ) {
        world.containers[pos] = {
          type: "chest",
          facing: 1,
          slots: Array(27).fill(null),
        };
        world.containers[pos].slots[0] = makeStack("bread", 3);
        world.containers[pos].slots[1] = makeStack("apple", 2);
        world.containers[pos].slots[2] = makeStack("seeds", 5);
      }
      if (
        world.containers[pos]?.type === "chest" &&
        world.containers[pos].facing === undefined &&
        !world.edits.has(pos)
      )
        world.containers[pos].facing = 1;
      set(h.x + 3, v.y + 3, h.z + 5, B.torch);
    }
    for (let dz = -2; dz <= 2; dz++)
      for (let dx = -2; dx <= 2; dx++) {
        set(v.x + dx, v.y, v.z + dz, B.cobble);
        if (Math.abs(dx) < 2 && Math.abs(dz) < 2)
          set(v.x + dx, v.y, v.z + dz, B.water);
        if (Math.abs(dx) === 2 && Math.abs(dz) === 2)
          for (let dy = 1; dy <= 3; dy++)
            set(v.x + dx, v.y + dy, v.z + dz, B.log);
        set(v.x + dx, v.y + 4, v.z + dz, B.planks);
      }
    // Hydrated communal wheat plot with persisted harvest/growth state.
    for (const farmX of v.radius ? [19, -26] : [19])
      for (let dz = -4; dz <= 4; dz++)
        for (let dx = 0; dx < 8; dx++) {
          const x = v.x + farmX + dx,
            z = v.z + dz,
            pos = `${x},${v.y + 1},${z}`;
          set(x, v.y, z, dx === 3 ? B.water : B.farmland);
          if (dx !== 3) {
            set(x, v.y + 1, z, B.crop);
            if (
              Math.floor(x / 16) === chunk.cx &&
              Math.floor(z / 16) === chunk.cz &&
              !world.cropTicks[pos] &&
              !world.edits.has(pos)
            )
              world.cropTicks[pos] = { age: 7 };
          }
        }
    for (const [dx, dz] of [
      [-5, -5],
      [5, -5],
      [-5, 5],
      [5, 5],
    ]) {
      for (let dy = 1; dy <= 3; dy++) set(v.x + dx, v.y + dy, v.z + dz, B.log);
      set(v.x + dx, v.y + 4, v.z + dz, B.torch);
    }
  }
}
