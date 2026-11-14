import {finishVillageWorkshops,villageWorkstation} from "./village-expansion.js";
import { B, makeStack } from "./data.js";
import { doorId } from "./doors.js";
export const VILLAGE_STYLES = {
  meadow: {
    name: "Meadow hamlet",
    wall: B.planks,
    frame: B.log,
    roof: B.planks,
    shape: "gable",
    robe: "#6e7951",
    trim: "#d7ba78",
  },
  birch: {
    name: "Birch garden village",
    wall: B.birch_log,
    frame: B.log,
    roof: B.planks,
    shape: "steep",
    robe: "#657e8e",
    trim: "#d6d7c4",
  },
  pine: {
    name: "Pine lodge village",
    wall: B.pine_log,
    frame: B.cobble,
    roof: B.planks,
    shape: "steep",
    robe: "#5b6960",
    trim: "#b8a181",
  },
  snow: {
    name: "Snowbound settlement",
    wall: B.pine_log,
    frame: B.cobble,
    roof: B.snow,
    shape: "steep",
    robe: "#546b80",
    trim: "#eee7d3",
  },
  desert: {
    name: "Dune courtyard village",
    wall: B.sandstone,
    frame: B.terracotta,
    roof: B.sandstone,
    shape: "terrace",
    robe: "#b29b78",
    trim: "#dbd0b3",
  },
  badlands: {
    name: "Mesa adobe village",
    wall: B.terracotta,
    frame: B.basalt,
    roof: B.sandstone,
    shape: "terrace",
    robe: "#975840",
    trim: "#e4b779",
  },
  savanna: {
    name: "Savanna canopy village",
    wall: B.terracotta,
    frame: B.log,
    roof: B.planks,
    shape: "canopy",
    robe: "#ac7847",
    trim: "#d9bc69",
  },
  marsh: {
    name: "Marsh stilt village",
    wall: B.planks,
    frame: B.moss,
    roof: B.pine_log,
    shape: "hip",
    robe: "#5b7660",
    trim: "#a0ad83",
    lift: 1,
  },
};
export function styleForBiome(biome) {
  return biome === "birch_woodland"
    ? "birch"
    : biome === "snowy_taiga" || biome === "alpine"
      ? "snow"
      : biome === "pine_forest"
        ? "pine"
        : biome === "desert"
          ? "desert"
          : biome === "badlands"
            ? "badlands"
            : biome === "savanna"
              ? "savanna"
              : biome === "marsh"
                ? "marsh"
                : "meadow";
}
export function regionalVillage(world, chunk, put, v) {
  const p = VILLAGE_STYLES[v.style],
    set = (x, y, z, id) => put(x - chunk.cx * 16, y, z - chunk.cz * 16, id),
    r = (v.radius||42)-1;
  for (
    let z = Math.max(v.z - r, chunk.cz * 16);
    z <= Math.min(v.z + r, chunk.cz * 16 + 15);
    z++
  )
    for (
      let x = Math.max(v.x - r, chunk.cx * 16);
      x <= Math.min(v.x + r, chunk.cx * 16 + 15);
      x++
    ) {
      for (let y = v.y + 1; y <= v.y + 11; y++) set(x, y, z, B.air);
      if (Math.abs(x - v.x) <= 2 || Math.abs(z - v.z) <= 2)
        set(x, v.y, z, B.path);
    }
  for (const h of v.houses) {
    const floor = h.floor ?? v.y;
    for (let x = Math.min(v.x, h.doorX); x <= Math.max(v.x, h.doorX); x++)
      for (let w = -1; w <= 1; w++) set(x, v.y, h.doorZ + 2 + w, B.path);
    for (let dz = 0; dz <= 6; dz++)
      for (let dx = 0; dx <= 6; dx++) {
        set(h.x + dx, floor, h.z + dz, B.planks);
        if (floor > v.y && (dx === 0 || dx === 6) && (dz === 0 || dz === 6))
          set(h.x + dx, v.y + 1, h.z + dz, p.frame);
        for (let dy = 1; dy <= 4; dy++) {
          const edge = dx === 0 || dx === 6 || dz === 0 || dz === 6,
            corner = (dx === 0 || dx === 6) && (dz === 0 || dz === 6),
            door = dz === 6 && dx === 3 && dy <= 2,
            window =
              edge &&
              !corner &&
              dy === 2 &&
              (dx === 2 || dx === 4 || dz === 2 || dz === 4);
          set(
            h.x + dx,
            floor + dy,
            h.z + dz,
            door
              ? doorId(2, false, dy === 2)
              : corner
                ? p.frame
                : edge
                  ? window
                    ? B.glass
                    : p.wall
                  : B.air,
          );
        }
      }
    if (floor > v.y) {
      set(h.doorX, floor, h.doorZ + 1, B.planks);
      set(h.doorX, v.y, h.doorZ + 2, B.path);
    }
    if (p.shape === "terrace" || p.shape === "canopy") {
      for (let dx = -1; dx <= 7; dx++)
        for (let dz = -1; dz <= 7; dz++)
          set(h.x + dx, floor + 5, h.z + dz, p.roof);
      if (p.shape === "terrace") {
        for (let dx = 0; dx <= 6; dx++)
          for (let dz = 0; dz <= 6; dz++)
            if (
              (dx === 0 || dx === 6 || dz === 0 || dz === 6) &&
              (dx + dz) % 2 === 0
            )
              set(h.x + dx, floor + 6, h.z + dz, p.frame);
      } else {
        for (let dx = 0; dx <= 6; dx++)
          for (let dz = 0; dz <= 6; dz++)
            set(h.x + dx, floor + 6, h.z + dz, p.roof);
      }
    } else if (p.shape === "hip") {
      for (let tier = 0; tier < 4; tier++)
        for (let dx = tier - 1; dx <= 7 - tier; dx++)
          for (let dz = tier - 1; dz <= 7 - tier; dz++)
            if (
              dx === tier - 1 ||
              dx === 7 - tier ||
              dz === tier - 1 ||
              dz === 7 - tier
            )
              set(h.x + dx, floor + 5 + tier, h.z + dz, p.roof);
      set(h.x + 3, floor + 9, h.z + 3, p.roof);
    } else {
      for (let tier = 0; tier < 4; tier++)
        for (let dz = -1; dz <= 7; dz++)
          for (const dx of [tier - 1, 7 - tier])
            set(h.x + dx, floor + 5 + tier, h.z + dz, p.roof);
      for (let dy = 5; dy < 8; dy++)
        for (let dx = dy - 4; dx <= 10 - dy; dx++)
          for (const dz of [0, 6]) set(h.x + dx, floor + dy, h.z + dz, p.wall);
      for (let dz = -1; dz <= 7; dz++)
        set(h.x + 3, floor + 9, h.z + dz, p.roof);
    }
    // Biome-specific porches/awnings/chimneys remain actual placeable world blocks.
    if (p.shape === "terrace" || p.shape === "canopy")
      for (let dx = 1; dx <= 5; dx++) set(h.x + dx, floor + 3, h.z + 7, p.roof);
    if (["pine", "snow", "birch"].includes(v.style))
      for (let dy = 4; dy <= 8; dy++)
        set(h.x + 1, floor + dy, h.z + 1, B.brick);
    set(h.x + 1, floor + 1, h.z + 1, B.bed);
    set(
      h.x + 5,
      floor + 1,
      h.z + 1,
      v.expansion?villageWorkstation(h.profession):h.profession === "mason" ? B.furnace : B.crafting_table,
    );
    set(h.x + 1, floor + 1, h.z + 5, B.chest);
    set(h.doorX, floor + 3, h.z + 5, B.torch);
    const pos = `${h.x + 1},${floor + 1},${h.z + 5}`;
    if (
      Math.floor((h.x + 1) / 16) === chunk.cx &&
      Math.floor((h.z + 5) / 16) === chunk.cz &&
      !world.containers[pos] &&
      !world.edits.has(pos)
    ) {
      const slots = Array(27).fill(null);
      slots[0] = makeStack("bread", 3);
      slots[1] = makeStack(v.style === "snow" ? "coal" : "apple", 2);
      slots[2] = makeStack("seeds", 5);
      world.containers[pos] = { type: "chest", slots };
      world.containers[pos].facing = 1;
    }
    if (
      world.containers[pos]?.type === "chest" &&
      world.containers[pos].facing === undefined &&
      !world.edits.has(pos)
    )
      world.containers[pos].facing = 1;
  }
  for (let dx = -2; dx <= 2; dx++)
    for (let dz = -2; dz <= 2; dz++) {
      set(
        v.x + dx,
        v.y,
        v.z + dz,
        Math.abs(dx) < 2 && Math.abs(dz) < 2 ? B.water : p.frame,
      );
      if (Math.abs(dx) === 2 && Math.abs(dz) === 2)
        for (let y = 1; y <= 3; y++) set(v.x + dx, v.y + y, v.z + dz, p.frame);
      set(v.x + dx, v.y + 4, v.z + dz, p.roof);
    }
  for (const fx of [-26, 19])
    for (let dx = 0; dx < 8; dx++)
      for (let dz = -4; dz <= 4; dz++) {
        const x = v.x + fx + dx,
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
    [-22, 36],
    [22, 36],
  ]) {
    for (let y = 1; y <= 3; y++) set(v.x + dx, v.y + y, v.z + dz, p.frame);
    set(v.x + dx, v.y + 4, v.z + dz, B.torch);
  }
  if(v.expansion)finishVillageWorkshops(world,chunk,put,v);
}
