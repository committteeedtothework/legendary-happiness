import { B, BLOCKS, MIN_Y, SEA } from "./data.js";
import { hash, noise3 } from "./random.js";
const index = (x, y, z) => (y - MIN_Y) * 256 + z * 16 + x;
const woodByBiome = {
  jungle: ["jungle", "mangrove"],
  savanna: ["acacia"],
  woodland: ["oak", "dark_oak"],
  birch_woodland: ["birch", "cherry"],
  meadow: ["oak", "cherry", "poplar"],
  pine_forest: ["spruce"],
  snowy_taiga: ["spruce"],
  swamp: ["mangrove"],
};
function woodFor(w, x, z, biome) {
  const a = woodByBiome[biome] || ["oak"];
  return a[
    Math.min(
      a.length - 1,
      Math.floor(
        hash(Math.floor(x / 80), 901, Math.floor(z / 80), w.seedInt) * a.length,
      ),
    )
  ];
}
// This pass changes resources/decorations only. Existing terrain silhouettes,
// structures, custom quest sites, and generations 2–15 remain intact.
export function generateEdition(w, c, put) {
  if (w.generationVersion < 16) return;
  const { cx, cz, data } = c,
    seed = w.seedInt,
    cinder = w.dimension === "cinderwild";
  if (cinder)
    for (const [key, container] of Object.entries(w.containers)) {
      const [x, y, z] = key.split(",").map(Number);
      if (
        Math.floor(x / 16) !== cx ||
        Math.floor(z / 16) !== cz ||
        container.editionLoot ||
        w.edits.has(key)
      )
        continue;
      const slot = container.slots.findIndex((s) => !s);
      if (slot >= 0) {
        container.slots[slot] = {
          id: "netherite_upgrade_smithing_template",
          count: 1,
        };
        const next = container.slots.findIndex((s) => !s);
        if (next >= 0 && hash(x, y, z, seed + 5000) < 0.25)
          container.slots[next] = { id: "heavy_core", count: 1 };
        container.editionLoot = true;
      }
    }
  for (let z = 0; z < 16; z++)
    for (let x = 0; x < 16; x++) {
      const wx = cx * 16 + x,
        wz = cz * 16 + z,
        t = w.terrain(wx, wz),
        wood = woodFor(w, wx, wz, t.biome);
      for (
        let y = w.surfaceOnly ? Math.max(MIN_Y, t.h - 18) : MIN_Y + 1;
        y <= c.maxY;
        y++
      ) {
        const i = index(x, y, z),
          id = data[i];
        if (!cinder && !t.village && y > t.h && y < t.h + 16) {
          if (id === B.log && wood !== "oak" && B[wood + "_log"] !== undefined)
            put(x, y, z, B[wood + "_log"]);
          if (
            id === B.leaves &&
            wood !== "oak" &&
            B[wood + "_leaves"] !== undefined
          )
            put(x, y, z, B[wood + "_leaves"]);
        }
        if (id === B.stone) {
          if (y < 0) {
            const ore = BLOCKS[id].key;
            put(x, y, z, B.deepslate ?? id);
          }
          if (y < t.h - 5) {
            const gx = Math.floor(wx / 9),
              gy = Math.floor(y / 9),
              gz = Math.floor(wz / 9),
              n = hash(gx, gy, gz, seed + 5001);
            const center = [
              gx * 9 + 2 + Math.floor(hash(gx, gy, gz, seed + 5002) * 5),
              gy * 9 + 2 + Math.floor(hash(gx, gy, gz, seed + 5003) * 5),
              gz * 9 + 2 + Math.floor(hash(gx, gy, gz, seed + 5004) * 5),
            ];
            const d =
              Math.abs(wx - center[0]) +
              Math.abs(y - center[1]) +
              Math.abs(wz - center[2]);
            if (d <= 2 && n < 0.55) {
              const rock = [
                B.tuff,
                B.calcite,
                B.diorite,
                B.andesite,
                B.granite,
                B.dripstone_block,
              ][Math.floor((n / 0.55) * 6)];
              if (rock !== undefined) put(x, y, z, rock);
            }
            // Redstone veins are uncommon, deeply buried and spatially separated.
            if (y < 16 && d <= 1 && n > 0.89 && n < 0.95)
              put(x, y, z, y < 0 ? B.deepslate_redstone_ore : B.redstone_ore);
          }
        } else if (!cinder && y < 0 && BLOCKS[id]?.key.endsWith("_ore")) {
          const deeper = B["deepslate_" + BLOCKS[id].key];
          if (deeper !== undefined) put(x, y, z, deeper);
        }
        if (
          cinder &&
          [B.cinderstone, B.basalt].includes(id) &&
          y < t.h - 5 &&
          y > MIN_Y + 5
        ) {
          const gx = Math.floor(wx / 14),
            gy = Math.floor(y / 14),
            gz = Math.floor(wz / 14),
            n = hash(gx, gy, gz, seed + 5010);
          const dx =
              wx -
              (gx * 14 + 4 + Math.floor(hash(gx, gy, gz, seed + 5011) * 6)),
            dy =
              y - (gy * 14 + 4 + Math.floor(hash(gx, gy, gz, seed + 5012) * 6)),
            dz =
              wz -
              (gz * 14 + 4 + Math.floor(hash(gx, gy, gz, seed + 5013) * 6));
          const d = Math.abs(dx) + Math.abs(dy) + Math.abs(dz);
          if (d <= 2 && n < 0.32) put(x, y, z, B.nether_quartz_ore);
          else if (d <= 1 && n < 0.45) put(x, y, z, B.nether_gold_ore);
          else if (d <= 1 && n > 0.8 && n < 0.88 && y < 32)
            put(x, y, z, B.ancient_debris);
        }
      }
      if (
        t.village ||
        t.structure ||
        t.h <= SEA + 1 ||
        data[index(x, t.h + 1, z)] !== B.air
      )
        continue;
      const n = hash(wx, 5110, wz, seed);
      if (cinder) {
        if (n < 0.018)
          put(
            x,
            t.h + 1,
            z,
            B[
              [
                "crimson_fungus",
                "warped_fungus",
                "crimson_roots",
                "warped_roots",
              ][Math.floor((n / 0.018) * 4)]
            ],
          );
        continue;
      }
      const ground = data[index(x, t.h, z)];
      if (![B.grass, B.dirt, B.moss].includes(ground)) continue;
      if (
        n < 0.012 &&
        !["desert", "badlands", "alpine", "stony_peaks"].includes(t.biome)
      ) {
        const flowers =
          t.biome === "jungle"
            ? ["blue_orchid", "allium", "azalea"]
            : t.biome === "snowy_taiga"
              ? ["sweet_berry_bush__0"]
              : [
                  "dandelion",
                  "oxeye_daisy",
                  "azure_bluet",
                  "lily_of_the_valley",
                  "pink_petals",
                  "wildflowers",
                ];
        const key =
          flowers[Math.floor(hash(wx, 5111, wz, seed) * flowers.length)];
        if (B[key] !== undefined) put(x, t.h + 1, z, B[key]);
      } else if (n > 0.994) {
        const crops = ["carrots__0", "potatoes__0", "beetroots__0"];
        const key = crops[Math.floor(hash(wx, 5112, wz, seed) * crops.length)];
        // Small wild vegetable patches give survival access to seeds and roots.
        if (B[key] !== undefined) {
          put(x, t.h, z, B.farmland);
          put(x, t.h + 1, z, B[key] + 3);
        }
      } else if (n > 0.985 && n <= 0.994 && B[wood + "_sapling"] !== undefined)
        put(x, t.h + 1, z, B[wood + "_sapling"]);
    }
}
