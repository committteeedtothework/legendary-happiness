import { B, BLOCKS, ATLAS_COLS } from "./data.js";
import { suppliedBlockFaces } from "./supplied-pack.js";

// An append-only cosmetic pass. Classic, authored Renewed terrain, and native
// supplied tiles stay intact. State variants continue to share their old tiles.
// Keep the established wool weave and quiet water faces from the earlier
// painters. The completion pass's cloth noise and stepped fluid bands replaced
// already-authored textures; they are not missing artwork.
const preserveEstablishedArt = (b) =>
  /(?:^|_)wool$/.test(b.materialKey || b.key) ||
  /^water(?:_flow_\d+)?$/.test(b.key);
const LEGACY_KEYS = new Set([
  "crafting_table",
  "furnace",
  "chest",
  "glass",
  "torch",
  "crop",
  "wool",
  "bed",
  "portal",
  "emberglass",
  "wild_grass",
  "poppy",
  "cornflower",
  "oak_door",
  "enchanting_table",
  "sugar_cane",
  "cactus",
  "fern",
  "ice",
  "ash",
  "glow_crystal",
  "bamboo",
  "coal_block",
  "iron_block",
  "copper_block",
  "gold_block",
  "diamond_block",
  "lapis_block",
  "emerald_block",
  "raw_iron_block",
  "raw_copper_block",
  "raw_gold_block",
  "smooth_stone",
  "granite",
  "diorite",
  "andesite",
  "packed_ice",
  "matthew_altar",
  "riftstone",
  "trial_exit",
  "cobweb",
]);
export const COMPLETED_BLOCK_IDS = BLOCKS.flatMap((b, id) =>
  !preserveEstablishedArt(b) &&
  ((id < 199 &&
    (LEGACY_KEYS.has(b.key) || b.door || b.fluid || id >= B.prismarine)) ||
    (b.edition &&
      b.artOwner &&
      (b.editionBase === undefined || b.editionBase === id)))
    ? [id]
    : [],
);
const COLORS = {
  melon: "#6c9b3e",
  netherite_block: "#51474d",
  potent_sulfur: "#bcb45c",
  sulfur: "#cbc46b",
  cinnabar: "#a85850",
  resin_block: "#c77836",
  prismarine: "#6baba5",
  dark_prismarine: "#375d55",
  prismarine_bricks: "#80b4aa",
  pumpkin: "#c37c33",
  cauldron: "#576169",
  ladder: "#b38a53",
  note_block: "#986743",
  smithing_table: "#5b5354",
  stonecutter: "#b9bab0",
  smoker: "#756956",
  blast_furnace: "#81898c",
  barrel: "#ac8351",
  ochre_froglight: "#d9c981",
  pearlescent_froglight: "#cab2c8",
  verdant_froglight: "#b0cda3",
  sponge: "#c8bc60",
  wet_sponge: "#a29d4b",
  bone_block: "#d8d2b6",
  honeycomb_block: "#d59b39",
  nether_wart_block: "#9f3c46",
  warped_wart_block: "#347d78",
  coarse_dirt: "#8c654a",
  mud: "#626263",
  packed_mud: "#8e765b",
  soul_soil: "#695449",
  soul_sand: "#766252",
  white_concrete: "#d9d8ce",
  white_concrete_powder: "#d5d2c5",
  white_terracotta: "#c7b4a6",
  ancient_debris: "#725448",
  netherrack: "#854e4d",
  flower_pot: "#a9694f",
  pale_moss_block: "#a7ad88",
  pale_moss_carpet: "#a7ad88",
  cobweb: "#d7d8c9",
  ash: "#787276",
  glow_crystal: "#b87bd3",
};
const hash = (x, y, s = 0) =>
  (Math.imul(x + 19, 374761393) ^
    Math.imul(y + 43, 668265263) ^
    Math.imul(s + 7, 1274126177)) >>>
  0;
const code = (s) =>
  [...s].reduce((a, c) => (Math.imul(a, 31) + c.charCodeAt(0)) >>> 0, 0);
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const shade = (hex, k) =>
  "#" +
  rgb(hex)
    .map((v) =>
      Math.max(0, Math.min(255, Math.round(v * k)))
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");
const clean = (b) =>
  (b.materialKey || b.key)
    .replace(/^waxed_/, "")
    .replace(/__\d+$/, "")
    .replace(/_(brick|tile)_(slab|stairs|wall)$/, "_$1s");
export function completedBlockKind(b) {
  const k = clean(b);
  if (/^(water|lava)(?:_flow_\d+)?$/.test(k)) return "fluid";
  if (b.crop || k === "crop") return "crop";
  if (
    b.plant ||
    /vine/.test(k) ||
    /^(wild_grass|poppy|cornflower|fern|sugar_cane|bamboo|torch)$/.test(k)
  )
    return "plant";
  if (/leaves/.test(k)) return "leaves";
  if (b.pickles) return "pickles";
  if (b.eggs) return "eggs";
  if (/glass|ice/.test(k)) return "glass";
  if (k === "cobweb") return "web";
  if (k === "ladder") return "ladder";
  if (
    /lantern|froglight|glowstone|shroomlight|glow_crystal|conduit|bulb/.test(k)
  )
    return "light";
  if (
    /table|furnace|smoker|barrel|chest|stonecutter|cauldron|brewing_stand|altar|heavy_core|note_block|flower_pot/.test(
      k,
    )
  )
    return "workstation";
  if (k === "bed") return "bed";
  if (/portal|riftstone|trial_exit/.test(k)) return "rune";
  if (k === "cactus") return "cactus";
  if (/melon|pumpkin|hay_bale|bamboo_block/.test(k)) return "stalk";
  if (/wool|carpet/.test(k) && !/moss/.test(k)) return "cloth";
  if (/(?:^|_)ore$/.test(k)) return "ore";
  if (/mosaic/.test(k)) return "mosaic";
  if (b.shape === "door" || b.door) return "door";
  if (b.shape === "trapdoor") return "trapdoor";
  if (/planks|fence|gate|petrified_oak/.test(k)) return "planks";
  if (/(?:log|wood|stem|hyphae)$/.test(k)) return "log";
  if (/bars|chain/.test(k)) return "metalwork";
  if (
    /(?:copper|iron|gold|diamond|emerald|lapis|netherite)_block$/.test(k) ||
    /^(exposed|weathered|oxidized)_copper$/.test(k)
  )
    return /^raw_/.test(k) ? "raw" : "metal";
  if (/copper/.test(k)) return /cut|chiseled/.test(k) ? "tiles" : "metal";
  if (/raw_/.test(k)) return "raw";
  if (/mushroom_block/.test(k)) return "mushroom";
  if (/sponge/.test(k)) return "sponge";
  if (/honeycomb/.test(k)) return "honeycomb";
  if (
    k === "magma_block" ||
    k === "crying_obsidian" ||
    k === "gilded_blackstone"
  )
    return "hotrock";
  if (/amethyst/.test(k)) return "crystal";
  if (/bone_block|quartz_pillar|basalt/.test(k)) return "pillar";
  if (/chiseled|reinforced/.test(k)) return "carved";
  if (/bricks?|tiles|cut_/.test(k)) return "tiles";
  if (/concrete/.test(k)) return /powder/.test(k) ? "granular" : "smooth";
  if (/terracotta|polished|smooth|quartz_block/.test(k)) return "smooth";
  if (/dirt|mud|soil|sand|nylium|mycelium|podzol|moss|ash/.test(k))
    return "ground";
  if (/coral_block/.test(k)) return "coral";
  if (/kelp_block/.test(k)) return "kelp";
  return "rock";
}
export function completedBlockPixels(id, face = 0) {
  if (!COMPLETED_BLOCK_IDS.includes(id)) return null;
  const b = BLOCKS[id],
    k = clean(b),
    kind = completedBlockKind(b),
    seed = code(k),
    base = COLORS[k] || b.color,
    p = {
      d: shade(base, 0.55),
      s: shade(base, 0.78),
      m: base,
      l: shade(base, 1.16),
      h: shade(base, 1.32),
      w: "#dfd8bd",
      g: "#618944",
      G: "#93b765",
      a: "#be8752",
      A: "#e3b76e",
      r: "#c45b52",
      i: "#424851",
      I: "#9faeb2",
      c: "#7ec9c4",
      o: "#eadc9e",
      t: "#77563c",
    },
    grid = Array.from({ length: 16 }, () => Array(16).fill("m"));
  const put = (x, y, c) => {
      if (grid[y]?.[x] !== undefined) grid[y][x] = c;
    },
    rect = (x, y, w, h, c) => {
      for (let j = y; j < y + h; j++)
        for (let i = x; i < x + w; i++) put(i, j, c);
    },
    clear = () => grid.forEach((row) => row.fill(".")),
    frame = (x, y, w, h, c) => {
      rect(x, y, w, 1, c);
      rect(x, y + h - 1, w, 1, c);
      rect(x, y, 1, h, c);
      rect(x + w - 1, y, 1, h, c);
    },
    clusters = (spread = 7) => {
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 16; x++) {
          const n = hash(x >> 1, y >> 1, seed) % spread;
          put(x, y, n === 0 ? "s" : n === 1 ? "l" : "m");
        }
    },
    plank = () => {
      clusters(13);
      for (let y = 0; y < 16; y++) {
        const row = y >> 2;
        for (let x = 0; x < 16; x++) {
          if (y % 4 === 0 || (x + row * 5) % 16 === 0) put(x, y, "s");
          else if (y % 4 === 1) put(x, y, "l");
          else if (hash(x >> 2, row, seed) % 9 === 0) put(x, y, "s");
        }
      }
    };
  if (kind === "fluid") {
    p.m = b.fluid.type === "lava" ? "#d8652e" : "#447fac";
    p.s = b.fluid.type === "lava" ? "#a6462b" : "#386c9d";
    p.l = b.fluid.type === "lava" ? "#efaa47" : "#5799ba";
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const line = (y + Math.floor(x / 4) * 2) % 8;
        put(x, y, line === 0 ? "l" : line === 1 ? "s" : "m");
      }
  } else if (kind === "crop") {
    clear();
    const age = b.crop?.age ?? 3,
      top = 12 - age * 3,
      berry = /berry/.test(k);
    for (let n = 0; n < 3; n++) {
      const x = 3 + n * 4;
      rect(x, top, 1, 16 - top, "g");
      for (let y = top + 2; y < 15; y += 3) {
        rect(x - 1, y, 3, 1, "G");
        put(x + (n % 2 ? 1 : -1), y - 1, "g");
      }
      if (age === 3) {
        if (berry) {
          rect(x - 1, 9, 2, 2, "r");
          put(x + 1, 13, "r");
        } else if (/carrot/.test(k)) {
          rect(x - 1, 13, 3, 2, "a");
        } else if (/beetroot/.test(k)) {
          rect(x - 1, 13, 3, 2, "r");
        } else if (!/potato/.test(k)) rect(x - 1, top, 3, 3, "o");
      }
    }
  } else if (kind === "plant") {
    clear();
    const dead = /dead|dry/.test(k),
      stem = dead ? "a" : "g",
      bloom =
        /flower|dandelion|tulip|orchid|allium|daisy|bluet|poppy|peony|lilac|rose|lily|eyeblossom/.test(
          k,
        ),
      mushroom = /mushroom|fungus/.test(k);
    if (k === "torch") {
      rect(7, 5, 2, 11, "t");
      rect(7, 5, 2, 4, "A");
      rect(6, 3, 4, 3, "a");
      rect(7, 2, 2, 3, "o");
    } else if (mushroom) {
      p.r = /brown/.test(k)
        ? "#a48a70"
        : /warped/.test(k)
          ? "#3a9c98"
          : "#b94f48";
      rect(7, 8, 2, 8, "w");
      rect(3, 5, 10, 4, "r");
      rect(5, 3, 6, 2, "r");
      rect(4, 5, 2, 2, "w");
      rect(9, 4, 2, 1, "w");
      rect(10, 7, 2, 1, "w");
    } else if (/lichen|vine|roots|litter|petals/.test(k)) {
      for (let n = 0; n < 5; n++) {
        let x = 2 + (hash(n, 0, seed) % 12);
        for (let y = hash(n, 1, seed) % 5; y < 16; y += 2) {
          put(x, y, stem);
          put(x + ((y % 3) - 1), y + 1, bloom ? "r" : "G");
        }
      }
    } else if (b.sapling || /azalea|bush|dripleaf/.test(k)) {
      rect(7, 6, 2, 10, "t");
      for (let y = 1; y < 12; y++)
        for (let x = 1; x < 15; x++)
          if (
            Math.abs(x - 7.5) + Math.abs(y - 6) < 7 &&
            hash(x, y, seed) % 7 !== 0
          )
            put(x, y, hash(x >> 1, y >> 1, seed) % 3 ? "g" : "G");
      if (/flower|firefly/.test(k))
        for (const [x, y] of [
          [4, 4],
          [10, 3],
          [8, 8],
        ])
          rect(x, y, 2, 2, /firefly/.test(k) ? "o" : "r");
    } else if (bloom) {
      const flower = /blue|cornflower|orchid|allium|lilac/.test(k)
        ? "#a38cd1"
        : /orange|torchflower/.test(k)
          ? "#dc9549"
          : /wither_rose/.test(k)
            ? "#51454f"
            : /white|lily|daisy|bluet/.test(k)
              ? "#e6e4d6"
              : /yellow|sunflower|dandelion|torchflower/.test(k)
                ? "#e3bf52"
                : /pink|peony|cherry|spore/.test(k)
                  ? "#d793ae"
                  : "#c56359";
      p.r = flower;
      rect(7, 5, 1, 11, stem);
      rect(4, 10, 3, 2, "g");
      rect(8, 8, 3, 2, "G");
      if (/lily/.test(k)) {
        for (const [x, y] of [
          [9, 3],
          [10, 7],
          [8, 10],
        ]) {
          rect(x - 1, y, 3, 2, "r");
          put(x, y + 2, "w");
        }
        rect(8, 2, 1, 9, stem);
      } else {
        rect(4, 3, 7, 3, "r");
        rect(6, 1, 3, 7, "r");
        rect(6, 3, 3, 3, "o");
        put(4, 3, "l");
      }
    } else if (/sugar_cane|bamboo/.test(k)) {
      for (const x of [3, 8, 12]) {
        rect(x, 1, 2, 15, "g");
        for (const y of [3, 8, 13]) {
          rect(x, y, 2, 1, "G");
          rect(x - 2, y - 1, 2, 1, "g");
        }
      }
    } else {
      const fan = b.coral?.form === "fan";
      for (let x = 2; x < 15; x += 3) {
        const top = 3 + (hash(x, 0, seed) % 6);
        for (let y = top; y < 16; y++) {
          const offset = Math.floor((15 - y) / 5) * (x < 8 ? -1 : 1);
          put(x + offset, y, b.coral ? "m" : stem);
          if (y % 3 === 0)
            put(x + offset + (x < 8 ? -1 : 1), y - 1, b.coral ? "l" : "G");
        }
      }
      if (fan) for (let x = 2; x < 14; x++) put(x, 14, "m");
    }
  } else if (kind === "leaves") {
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        const n = hash(x >> 1, y >> 1, seed) % 7;
        put(
          x,
          y,
          n === 0 && x % 2 === 0 && y % 2 === 0
            ? "."
            : n < 2
              ? "s"
              : n < 4
                ? "l"
                : "m",
        );
      }
    if (/flower/.test(k))
      for (const [x, y] of [
        [3, 4],
        [11, 9],
      ])
        rect(x, y, 2, 2, "r");
  } else if (kind === "glass") {
    const ice = /ice/.test(k);
    if (!ice) clear();
    else clusters(17);
    frame(0, 0, 16, 16, "s");
    rect(1, 1, 14, 1, "l");
    for (let n = 0; n < 6; n++) {
      put(3 + n, 12 - n, "l");
      put(9 + n, 8 - n, "l");
    }
    if (/packed|blue/.test(k)) {
      for (let y = 4; y < 16; y += 6) rect(0, y, 16, 1, "s");
    }
  } else if (kind === "web") {
    clear();
    for (let n = 0; n < 16; n++) {
      put(n, n, "w");
      put(15 - n, n, "w");
      put(7, n, "w");
      put(n, 7, "w");
    }
    for (const r of [3, 6])
      for (let d = -r; d <= r; d++) {
        put(7 + d, 7 + r - Math.abs(d), "w");
        put(7 + d, 7 - r + Math.abs(d), "w");
      }
  } else if (kind === "ladder") {
    clear();
    rect(2, 0, 2, 16, "s");
    rect(12, 0, 2, 16, "s");
    rect(3, 0, 1, 16, "l");
    rect(13, 0, 1, 16, "l");
    for (let y = 2; y < 16; y += 4) {
      rect(4, y, 8, 2, "m");
      rect(4, y, 8, 1, "l");
    }
  } else if (
    kind === "planks" ||
    kind === "door" ||
    kind === "trapdoor" ||
    kind === "mosaic"
  ) {
    plank();
    if (kind === "mosaic") {
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 16; x++) {
          if ((y < 8 ? x : y) % 4 === 0) put(x, y, "s");
          else if ((y < 8 ? x : y) % 4 === 1) put(x, y, "l");
        }
      frame(0, 0, 16, 16, "s");
    }
    if (kind === "door" || kind === "trapdoor") {
      frame(1, 1, 14, 14, "d");
      frame(2, 2, 12, 12, "l");
      if (kind === "door") {
        frame(4, 3, 8, 6, "s");
        rect(5, 4, 6, 4, "d");
        rect(11, 10, 2, 2, "I");
      } else {
        for (const [x, y] of [
          [4, 4],
          [9, 4],
          [4, 9],
          [9, 9],
        ])
          rect(x, y, 3, 3, ".");
        rect(2, 12, 2, 2, "I");
      }
    }
  } else if (kind === "log") {
    const stripped = /stripped/.test(k);
    if (face === 1 || /_wood$|hyphae/.test(k)) {
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 16; x++) {
          const n = hash(x >> 1, y >> 3, seed) % 5;
          put(x, y, x % 4 === 0 ? "s" : n === 0 ? "l" : "m");
        }
      if (!stripped && /birch/.test(k)) {
        p.m = "#d2d0bd";
        p.s = "#a2a18e";
        for (const [x, y, w] of [
          [2, 3, 4],
          [9, 10, 5],
          [0, 14, 3],
        ])
          rect(x, y, w, 1, "d");
      }
    } else {
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 16; x++) {
          const ring = Math.floor(
            Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5)),
          );
          put(
            x,
            y,
            ring === 7
              ? "d"
              : ring % 3 === 0
                ? "s"
                : ring % 3 === 1
                  ? "l"
                  : "m",
          );
        }
    }
  } else if (kind === "ore" || kind === "raw") {
    clusters(8);
    p.m = /deepslate/.test(k)
      ? "#51555d"
      : /nether/.test(k)
        ? "#80504e"
        : "#858b87";
    p.s = shade(p.m, 0.79);
    p.l = shade(p.m, 1.12);
    p.a = base;
    p.A = shade(base, 1.32);
    p.t = shade(base, 0.7);
    for (const [x, y] of [
      [3, 3],
      [11, 5],
      [6, 11],
      [13, 13],
    ]) {
      rect(x - 1, y, 3, 2, "a");
      put(x - 1, y, "A");
      put(x + 1, y + 1, "t");
      if (kind === "raw") rect(x - 2, y - 2, 3, 3, "a");
    }
  } else if (kind === "hotrock") {
    clusters(13);
    p.a =
      k === "magma_block"
        ? "#ef9c42"
        : k === "crying_obsidian"
          ? "#ad74cd"
          : "#d2a84d";
    p.m = k === "magma_block" ? "#69392f" : "#3b3745";
    p.s = shade(p.m, 0.76);
    p.l = shade(p.m, 1.2);
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++)
        if (
          k === "magma_block"
            ? y % 6 === 0 || (x + Math.floor(y / 6) * 3) % 7 === 0
            : hash(x >> 1, y >> 1, seed) % 9 === 0
        )
          put(x, y, "a");
  } else if (kind === "metal" || kind === "metalwork") {
    clusters(29);
    frame(0, 0, 16, 16, "s");
    rect(1, 1, 14, 1, "l");
    rect(1, 2, 1, 12, "l");
    rect(2, 14, 13, 1, "d");
    if (kind === "metalwork") {
      clear();
      if (/chain/.test(k)) {
        for (let y = 0; y < 16; y += 8) {
          frame(6, y, 4, 6, "m");
          rect(6, y + 1, 1, 4, "l");
        }
      } else {
        for (let x = 2; x < 16; x += 5) {
          rect(x, 0, 2, 16, "m");
          rect(x, 0, 1, 16, "l");
        }
        rect(0, 5, 16, 1, "s");
        rect(0, 11, 16, 1, "s");
      }
    }
  } else if (
    kind === "tiles" ||
    kind === "rock" ||
    kind === "carved" ||
    kind === "coral"
  ) {
    clusters(kind === "rock" ? 9 : 17);
    if (kind === "tiles") {
      const h = /tile/.test(k) ? 4 : 8;
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 16; x++) {
          if (y % h === 0 || (x + (Math.floor(y / h) % 2) * 8) % 16 === 0)
            put(x, y, "s");
          else if (y % h === 1) put(x, y, "l");
        }
      if (/cracked/.test(k))
        for (let y = 2; y < 14; y++) put(6 + (Math.floor(y / 3) % 3), y, "d");
      if (/mossy/.test(k))
        for (const [x, y] of [
          [2, 5],
          [10, 13],
        ])
          rect(x, y, 3, 2, "g");
    } else if (kind === "carved") {
      frame(1, 1, 14, 14, "s");
      frame(3, 3, 10, 10, "l");
      frame(5, 5, 6, 6, "s");
      rect(7, 6, 2, 4, "d");
    } else if (kind === "coral") {
      for (let y = 2; y < 16; y += 5)
        for (let x = 2 + (y % 2); x < 16; x += 5) {
          rect(x, y, 2, 2, "s");
          put(x, y, "d");
          put(x + 2, y + 2, "l");
        }
    } else {
      for (let y = 3; y < 16; y += 6) {
        let start = hash(y, 0, seed) % 8;
        rect(start, y, 5, 1, "s");
        rect(start, y - 1, 4, 1, "l");
      }
    }
  } else if (kind === "cloth") {
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++)
        put(x, y, (x + y) % 4 === 0 ? "s" : (x - y + 16) % 4 === 1 ? "l" : "m");
  } else if (kind === "smooth" || kind === "granular" || kind === "ground") {
    clusters(kind === "smooth" ? 29 : 9);
    if (kind === "smooth") {
      p.s = shade(base, 0.94);
      p.l = shade(base, 1.04);
    }
    if (kind === "ground" && /nylium|mycelium|podzol/.test(k)) {
      if (face === 1) {
        rect(0, 0, 16, 4, "g");
        for (let x = 0; x < 16; x += 3) rect(x, 4, 2, 2, "g");
      } else if (face === 0) {
        for (let y = 0; y < 16; y++)
          for (let x = 0; x < 16; x++)
            put(x, y, hash(x >> 1, y >> 1, seed) % 3 ? "g" : "G");
      }
    }
  } else if (kind === "pillar" || kind === "stalk" || kind === "cactus") {
    clusters(19);
    if (face === 1) {
      for (let x = 1; x < 16; x += 4) {
        rect(x, 0, 1, 16, "s");
        rect(x + 1, 0, 1, 16, "l");
      }
      if (kind === "cactus")
        for (const [x, y] of [
          [3, 4],
          [11, 9],
          [7, 14],
        ])
          rect(x, y, 2, 1, "d");
    } else {
      frame(1, 1, 14, 14, "s");
      frame(4, 4, 8, 8, "l");
      rect(7, 6, 2, 4, "s");
    }
  } else if (
    kind === "sponge" ||
    kind === "honeycomb" ||
    kind === "crystal" ||
    kind === "mushroom" ||
    kind === "kelp"
  ) {
    clusters(23);
    if (kind === "sponge")
      for (let y = 2; y < 16; y += 5)
        for (let x = 1 + (y % 3); x < 16; x += 5) {
          rect(x, y, 3, 2, "s");
          put(x, y, "d");
        }
    if (kind === "honeycomb")
      for (let y = 1; y < 16; y += 6)
        for (let x = 1 + (y % 2) * 3; x < 16; x += 6) {
          frame(x, y, 5, 5, "l");
          rect(x + 1, y + 1, 3, 3, "s");
        }
    if (kind === "crystal")
      for (const [x, y] of [
        [3, 3],
        [10, 6],
        [5, 12],
      ]) {
        rect(x, y, 3, 2, "l");
        put(x + 1, y - 1, "h");
        put(x + 3, y + 2, "s");
      }
    if (kind === "mushroom") {
      p.m = /red/.test(k) ? "#b34f48" : "#9e846d";
      for (const [x, y] of [
        [2, 2],
        [10, 7],
        [5, 13],
      ])
        rect(x, y, 3, 2, "w");
    }
    if (kind === "kelp")
      for (let x = 0; x < 16; x += 4) {
        rect(x, 0, 1, 16, "s");
        rect(x + 1, 0, 1, 16, "l");
      }
  } else if (kind === "light") {
    frame(0, 0, 16, 16, "s");
    frame(1, 1, 14, 14, "l");
    if (/lantern/.test(k)) {
      rect(3, 2, 10, 12, "i");
      rect(4, 4, 8, 7, "o");
      rect(6, 4, 1, 7, "A");
      rect(9, 4, 1, 7, "A");
      rect(6, 0, 4, 2, "i");
    } else if (/conduit/.test(k)) {
      rect(3, 3, 10, 10, "c");
      frame(5, 5, 6, 6, "w");
      rect(7, 7, 2, 2, "i");
    } else if (/bulb/.test(k)) {
      frame(3, 3, 10, 10, "d");
      rect(4, 4, 8, 8, "o");
      rect(6, 6, 4, 4, "w");
    } else {
      for (let y = 2; y < 14; y++)
        for (let x = 2; x < 14; x++)
          put(x, y, hash(x >> 1, y >> 1, seed) % 5 ? "l" : "h");
    }
  } else if (kind === "workstation") {
    p.a = "#a5794d";
    p.A = "#d0aa70";
    plank();
    if (
      /furnace|smoker|cauldron|stonecutter|smithing|brewing|heavy_core/.test(k)
    ) {
      rect(0, 0, 16, 16, "i");
      frame(0, 0, 16, 16, "I");
      rect(2, 2, 12, 12, "s");
    }
    if (face === 0) {
      if (/crafting/.test(k)) {
        rect(2, 2, 12, 12, "a");
        for (const v of [2, 6, 10, 14]) {
          rect(v, 2, 1, 13, "t");
          rect(2, v, 13, 1, "t");
        }
      } else if (k === "note_block") {
        rect(1, 1, 14, 14, "a");
        for (let y = 2; y < 15; y += 3)
          for (let x = 2; x < 15; x += 3) rect(x, y, 2, 2, "t");
        frame(0, 0, 16, 16, "A");
      } else if (/cauldron|flower_pot/.test(k)) {
        rect(2, 2, 12, 12, "d");
        frame(1, 1, 14, 14, /flower_pot/.test(k) ? "l" : "I");
      } else if (/smithing/.test(k)) {
        rect(2, 2, 12, 12, "i");
        rect(4, 4, 7, 2, "I");
        rect(7, 6, 2, 6, "a");
        put(4, 5, "w");
      } else if (/smoker/.test(k)) {
        rect(1, 1, 14, 14, "a");
        frame(2, 2, 12, 12, "t");
        rect(5, 5, 6, 6, "i");
      } else if (/blast_furnace/.test(k)) {
        for (let y = 3; y < 14; y += 3) rect(3, y, 10, 1, "i");
      } else if (k === "furnace") {
        rect(1, 1, 14, 14, "m");
        rect(2, 3, 7, 1, "s");
        rect(8, 10, 6, 1, "l");
      } else if (/chest|barrel/.test(k)) {
        frame(1, 1, 14, 14, "d");
        rect(2, 2, 12, 1, "A");
        if (/barrel/.test(k)) rect(4, 5, 8, 6, "t");
      } else if (/enchanting|altar/.test(k)) {
        rect(0, 0, 16, 16, "i");
        frame(2, 2, 12, 12, "r");
        rect(4, 5, 8, 6, "w");
        rect(7, 5, 1, 6, "a");
      } else {
        frame(3, 3, 10, 10, "i");
        rect(5, 5, 6, 6, "I");
        rect(6, 6, 4, 4, "d");
      }
    } else if (k === "note_block") {
      rect(1, 1, 14, 14, "t");
      for (let y = 2; y < 15; y += 2)
        for (let x = 2; x < 15; x += 2) put(x, y, "a");
      frame(0, 0, 16, 16, "a");
    } else if (k === "flower_pot") {
      rect(0, 0, 16, 16, "m");
      rect(0, 0, 16, 3, "l");
      rect(0, 3, 16, 1, "s");
      rect(2, 13, 12, 2, "s");
    } else if (/chest/.test(k)) {
      frame(0, 0, 16, 16, "d");
      rect(0, 5, 16, 2, "d");
      if (face === 1) {
        rect(7, 5, 2, 5, "I");
        put(7, 6, "w");
      }
    } else if (/furnace|smoker/.test(k)) {
      rect(3, 3, 10, 3, "i");
      rect(3, 9, 10, 4, "i");
      rect(4, 10, 8, 2, "d");
      rect(2, 14, 12, 1, "I");
    } else if (/barrel/.test(k)) {
      rect(0, 2, 16, 2, "i");
      rect(0, 12, 16, 2, "i");
    } else if (/cauldron/.test(k)) {
      frame(2, 2, 12, 11, "i");
      rect(3, 13, 3, 3, "i");
      rect(10, 13, 3, 3, "i");
    } else if (/stonecutter/.test(k)) {
      rect(0, 8, 16, 8, "I");
      for (let x = 2; x < 15; x += 3) rect(x, 2, 2, 6, "w");
    } else {
      frame(1, 1, 14, 14, "d");
      rect(3, 4, 3, 7, "I");
      rect(9, 4, 4, 3, "i");
      rect(10, 7, 2, 5, "a");
    }
  } else if (kind === "bed") {
    clusters(23);
    rect(0, 0, 16, 4, "w");
    rect(0, 4, 16, 1, "s");
    if (face === 1) rect(0, 12, 16, 4, "a");
  } else if (kind === "rune") {
    p.m = /portal/.test(k) ? "#593d86" : "#463d58";
    p.s = "#302c46";
    p.l = "#9b67c9";
    clusters(13);
    for (let n = 2; n < 14; n++) {
      put(n, 2, "l");
      put(13, n, "l");
      put(4, n, "s");
    }
    rect(7, 6, 4, 1, "c");
    rect(7, 6, 1, 5, "c");
  } else if (kind === "pickles" || kind === "eggs") {
    clear();
    const count = b.pickles || b.eggs || 1;
    for (let n = 0; n < count; n++) {
      const x = 2 + (n % 2) * 7,
        y = 2 + Math.floor(n / 2) * 7;
      rect(x, y + 1, 5, 5, kind === "eggs" ? "w" : "g");
      rect(x + 1, y, 3, 1, kind === "eggs" ? "l" : "o");
      put(x + 2, y + 2, b.eggStage ? "s" : "G");
    }
  }
  return { id, key: b.key, kind, grid, palette: p };
}
export function paintCompletedBlocks(canvas, pack = "renewed") {
  if (pack === "classic") return;
  const ctx = canvas.getContext("2d");
  for (const id of COMPLETED_BLOCK_IDS) {
    const b = BLOCKS[id];
    if (pack === "supplied" && !b.edition && suppliedBlockFaces(b)) continue;
    for (let face = 0; face < 3; face++) {
      const art = completedBlockPixels(id, face),
        image = ctx.createImageData(16, 16);
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 16; x++) {
          const color = art.palette[art.grid[y][x]];
          if (!color) continue;
          image.data.set([...rgb(color), 255], (y * 16 + x) * 4);
        }
      const tile = (b.artTile ?? id * 3) + face;
      ctx.putImageData(
        image,
        (tile % ATLAS_COLS) * 16,
        Math.floor(tile / ATLAS_COLS) * 16,
      );
    }
  }
}
