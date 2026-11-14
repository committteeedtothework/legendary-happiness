import { B, makeStack } from "./data.js";
import { VILLAGER_JOBS } from "./village-jobs.js";
import { hash } from "./random.js";
const roles = [
  "blacksmith",
  "toolsmith",
  "armorer",
  "librarian",
  "cleric",
  "fletcher",
  "fisherman",
  "butcher",
];
export function expandVillagePlan(w, v) {
  if (!v || w.generationVersion < 16) return v;
  const ring = [
    [-52, -20],
    [44, -20],
    [-52, 14],
    [44, 14],
    [-30, 46],
    [-10, 46],
    [10, 46],
    [30, 46],
  ];
  const shift =
    v.style === "desert" || v.style === "badlands"
      ? -3
      : v.style === "marsh"
        ? 3
        : 0;
  const reverse = ["desert", "savanna", "marsh"].includes(v.style),
    seed = w.seedInt;
  v.radius = 66;
  v.expansion = 1;
  ring.forEach(([dx, dz], i) => {
    const jitter = Math.floor(hash(v.x, i, v.z, seed) * 3) * 2;
    let x = dx,
      z = dz + shift + jitter;
    if (reverse) {
      [x, z] = [z, x];
    }
    v.houses.push({
      x: v.x + x,
      z: v.z + z,
      doorX: v.x + x + 3,
      doorZ: v.z + z + 6,
      floor: v.y + (v.style === "marsh" ? 1 : 0),
      profession: roles[i],
    });
  });
  return v;
}
export function villageWorkstation(role) {
  return B[VILLAGER_JOBS[role]?.station] ?? B.crafting_table;
}
export function finishVillageWorkshops(w, c, put, v) {
  const set = (x, y, z, id) => put(x - c.cx * 16, y, z - c.cz * 16, id);
  for (const h of v.houses) {
    const y = (h.floor ?? v.y) + 1;
    set(h.x + 5, y, h.z + 1, villageWorkstation(h.profession));
    if (h.profession === "librarian")
      for (let dx = 1; dx <= 4; dx++)
        for (let dy = 0; dy < 2; dy++)
          set(h.x + dx, y + dy, h.z + 1, B.bookshelf);
    if (["blacksmith", "armorer", "toolsmith"].includes(h.profession)) {
      for (let dx = 7; dx <= 10; dx++)
        for (let dz = 0; dz <= 4; dz++) {
          set(h.x + dx, y - 1, h.z + dz, B.cobble);
          if (dx === 7 || dx === 10 || dz === 0 || dz === 4)
            set(h.x + dx, y, h.z + dz, B.cobble);
        }
      set(h.x + 8, y, h.z + 2, B.lava);
      set(h.x + 9, y, h.z + 2, B.cobble);
      set(h.x + 8, y, h.z + 3, B.anvil ?? B.iron_block);
      for (let dy = 1; dy <= 6; dy++) set(h.x + 9, y + dy, h.z + 1, B.brick);
      const k = `${h.x + 1},${y},${h.z + 5}`,
        chest = w.containers[k];
      if (chest && !w.edits.has(k) && !chest.workshopLoot) {
        chest.slots = [
          makeStack("iron_ingot", 4),
          makeStack("bread", 3),
          makeStack("iron_pickaxe"),
          ...Array(24).fill(null),
        ];
        chest.workshopLoot = true;
      }
    }
  }
}
