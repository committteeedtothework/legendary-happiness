import { BLOCKS, ATLAS_COLS, ITEMS } from "./data.js";
import { blockArtTile } from "./block-art.js";
import { blockParts, shapeSurfaces } from "./block-shapes.js";
const rgb = (hex) => [1, 3, 5].map((n) => parseInt(hex.slice(n, n + 2), 16));
const mix = (c, k) =>
  c.map((v) => Math.max(0, Math.min(255, Math.round(v * k))));
// Original 16px motifs, drawn independently of Mojang artwork and models.
export function paintEditionAtlas(canvas) {
  const ctx = canvas.getContext("2d");
  for (const [id, b] of BLOCKS.entries()) {
    if (
      !b.edition ||
      !b.artOwner ||
      (b.internal && !b.crop) ||
      (b.editionBase !== undefined && b.editionBase !== id)
    )
      continue;
    for (let face = 0; face < 3; face++) {
      const image = ctx.createImageData(16, 16),
        color = rgb(b.color),
        key = b.materialKey || b.key;
      const noise = (x, y) =>
        (((x * 167 + y * 359 + id * 47) ^ (x * y * 31)) & 31) / 31;
      const set = (x, y, c, alpha = 255) => {
        const i = (y * 16 + x) * 4;
        image.data.set([...c, alpha], i);
      };
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 16; x++) {
          let k = 0.89 + noise(x >> 1, y >> 1) * 0.18,
            alpha = 255;
          if (b.plant) {
            const age = b.crop?.age ?? 3,
              stem = x >= 7 && x <= 8 && y >= 3 + (3 - age) * 3;
            const leaf =
              ((x >= 3 && x <= 6 && y >= 9 && y <= 11) ||
                (x >= 9 && x <= 12 && y >= 6 && y <= 9)) &&
              age > 0;
            const flower =
              !b.sapling &&
              !b.crop &&
              !/grass|roots|fern|bush|vine|lichen|litter/.test(key) &&
              Math.abs(x - 8) + Math.abs(y - 4) <= 4;
            const sapling =
              b.sapling && y < 10 && Math.abs(x - 8) + Math.abs(y - 5) < 7;
            const grain =
              b.crop &&
              age === 3 &&
              y > 2 &&
              y < 8 &&
              x > 3 &&
              x < 13 &&
              (x + y) % 3 !== 0;
            if (!(stem || leaf || flower || sapling || grain)) alpha = 0;
            let c = flower
              ? rgb(
                  /blue|orchid|allium/.test(key)
                    ? "#9c91d2"
                    : /dandelion|sunflower|torchflower/.test(key)
                      ? "#edbe53"
                      : /lily|oxeye|azure/.test(key)
                        ? "#eee5d7"
                        : "#d87794",
                )
              : rgb(
                  grain
                    ? "#d7a34e"
                    : b.sapling && x >= 7 && x <= 8 && y > 8
                      ? "#866248"
                      : "#72974c",
                );
            set(x, y, mix(c, k), alpha);
            continue;
          }
          if (
            /planks|bamboo|shelf/.test(key) ||
            ["gate", "fence", "trapdoor", "door"].includes(b.shape)
          ) {
            k *= y % 4 === 0 ? 0.7 : (x + (y >> 2) * 5) % 13 === 0 ? 0.79 : 1;
            if (
              (b.shape === "trapdoor" || b.shape === "door") &&
              x > 3 &&
              x < 12 &&
              y > 2 &&
              y < 11
            ) {
              if (b.shape === "trapdoor" && (x === 7 || y === 7)) k *= 0.65;
              else k *= 0.82;
            }
            if (b.shape === "door" && x === 12 && y === 9) k = 1.5;
          } else if (/log|wood|stem|hyphae/.test(key)) {
            if (face === 1)
              k *= (x + Math.floor(noise(0, y >> 2) * 3)) % 5 === 0 ? 0.62 : 1;
            else {
              const r = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
              k *= Math.floor(r) % 3 === 0 ? 0.78 : 1.08;
            }
          } else if (/leaves/.test(key)) {
            k *= 0.72 + noise(x, y) * 0.46;
            if (noise(x, y) < 0.1) alpha = 0;
          } else if (/glass/.test(key)) {
            alpha = x === 0 || y === 0 || x === 15 || y === 15 ? 225 : 58;
            if (x === y || x === y + 1) alpha = 140;
          } else if (/wool|carpet/.test(key))
            k *= (x + y) % 3 === 0 ? 0.91 : 1.04;
          else if (/brick|tile|polished|cut_/.test(key))
            k *= y % 8 === 0 || (x + (y < 8 ? 0 : 8)) % 16 === 0 ? 0.66 : 1;
          else if (/ore/.test(key)) {
            const ore =
              (x * 3 + y * 7 + id) % 23 < 3 || (x * 5 + y * 11 + id) % 37 < 3;
            set(
              x,
              y,
              mix(
                ore
                  ? color
                  : rgb(
                      /deepslate/.test(key)
                        ? "#55575d"
                        : /nether/.test(key)
                          ? "#77474a"
                          : "#8a8c87",
                    ),
                ore ? 1.13 : k,
              ),
            );
            continue;
          } else if (/block|metal|copper|iron|gold|netherite/.test(key))
            k *= x === 0 || y === 0 ? 1.14 : x === 15 || y === 15 ? 0.76 : 1;
          else if (/lantern/.test(key)) {
            k *= x < 4 || x > 11 || y < 3 || y > 12 ? 0.4 : 1.38;
          } else if (/barrel|smoker|blast_furnace/.test(key)) {
            if (face === 1 && x > 2 && x < 13 && y > 5 && y < 12) k *= 0.35;
            if (y % 5 === 0) k *= 0.75;
          } else if (/stone|slate|tuff/.test(key))
            k *= (x + (y >> 2) * 5) % 15 === 0 && y % 4 === 0 ? 0.71 : 1;
          set(x, y, mix(color, k), alpha);
        }
      const tile = b.artTile + face;
      ctx.putImageData(
        image,
        (tile % ATLAS_COLS) * 16,
        Math.floor(tile / ATLAS_COLS) * 16,
      );
    }
  }
}
export function paintEditionItem(ctx, id, item, atlas) {
  if (!item?.edition) return false;
  if (item.block !== undefined) {
    const b = BLOCKS[item.block];
    if (b.plant || b.shape === "ladder" || b.shape === "door") {
      const tile = blockArtTile(item.block, 4);
      ctx.drawImage(
        atlas,
        (tile % ATLAS_COLS) * 16,
        Math.floor(tile / ATLAS_COLS) * 16,
        16,
        16,
        b.shape === "door" ? 8 : 2,
        1,
        b.shape === "door" ? 16 : 28,
        30,
      );
      return true;
    }
    const points = [
      [1, 0, 1],
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
    ];
    const vertices = [
      points,
      [
        [0, 0, 0],
        [0, 0, 1],
        [0, 1, 1],
        [0, 1, 0],
      ],
      [
        [0, 1, 1],
        [1, 1, 1],
        [1, 1, 0],
        [0, 1, 0],
      ],
      [],
      [
        [0, 0, 1],
        [1, 0, 1],
        [1, 1, 1],
        [0, 1, 1],
      ],
      [],
    ];
    const project = ([x, y, z]) => [
      16 + (x - z) * 13,
      2 + (x + z) * 6 + (1 - y) * 14,
    ];
    const faces = shapeSurfaces(blockParts(item.block))
      .filter((q) => [0, 2, 4].includes(q.face))
      .sort(
        (a, b) =>
          a.bounds[0] +
          a.bounds[2] +
          a.bounds[1] -
          (b.bounds[0] + b.bounds[2] + b.bounds[1]),
      );
    for (const { face, bounds: p } of faces) {
      const poly = vertices[face].map((v) =>
        project(v.map((n, a) => p[a] + n * (p[a + 3] - p[a]))),
      );
      ctx.save();
      ctx.beginPath();
      poly.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.clip();
      const tile = blockArtTile(item.block, face),
        q = poly[0],
        u = poly[1],
        v = poly[3];
      ctx.transform(
        (u[0] - q[0]) / 16,
        (u[1] - q[1]) / 16,
        (v[0] - q[0]) / 16,
        (v[1] - q[1]) / 16,
        q[0],
        q[1],
      );
      ctx.drawImage(
        atlas,
        (tile % ATLAS_COLS) * 16,
        Math.floor(tile / ATLAS_COLS) * 16,
        16,
        16,
        0,
        0,
        16,
        16,
      );
      ctx.fillStyle =
        face === 2 ? "#00000000" : face === 0 ? "#00000024" : "#00000045";
      ctx.fillRect(0, 0, 16, 16);
      ctx.restore();
    }
    return true;
  }
  if (["bow", "crossbow", "shield", "arrow", "mace"].includes(id)) {
    const f = (color, x, y, w, h) => {
      ctx.fillStyle = color;
      ctx.fillRect(x, y, w, h);
    };
    if (id === "shield") {
      f("#b3bbc0", 6, 3, 20, 21);
      f("#b3bbc0", 9, 24, 14, 4);
      f("#b3bbc0", 12, 28, 8, 2);
      f("#947142", 8, 5, 16, 17);
      f("#947142", 11, 22, 10, 4);
      for (const x of [11, 16, 21]) f("#b99359", x, 6, 1, 16);
      f("#d8dddd", 8, 5, 2, 3);
    } else if (id === "arrow") {
      for (let i = 0; i < 23; i++) f("#b19464", 4 + i, 27 - i, 2, 2);
      f("#bdc7cd", 23, 2, 7, 7);
      f("#e8e7d7", 2, 22, 8, 7);
      f("#989d99", 5, 21, 2, 6);
    } else if (id === "mace") {
      f("#7b6850", 14, 12, 4, 17);
      f("#b4a17b", 14, 14, 2, 13);
      f("#636d7d", 5, 3, 22, 12);
      f("#a3b6c7", 6, 4, 20, 2);
      f("#8798aa", 7, 7, 4, 7);
      f("#424e61", 22, 6, 4, 8);
    } else if (id === "bow") {
      for (const [x, y, w, h] of [
        [8, 2, 8, 3],
        [6, 5, 4, 6],
        [4, 11, 4, 10],
        [6, 21, 4, 6],
        [8, 27, 8, 3],
      ])
        f("#af8952", x, y, w, h);
      f("#d9c79a", 5, 12, 2, 8);
      f("#e6e3d0", 17, 3, 1, 26);
      f("#6c4c32", 8, 14, 3, 6);
    } else {
      for (let i = 0; i < 22; i++) {
        f("#8e6d47", 5 + i, 25 - i, 4, 4);
        f("#d5c18a", 4 + i, 7 + i * 0.7, 3, 2);
      }
      f("#c7c5b6", 20, 5, 6, 5);
      f("#7b6550", 3, 23, 5, 7);
    }
    return true;
  }
  if (item.tool || item.armorSlot !== undefined) return false;
  const fill = (c, x, y, w, h) => {
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
  };
  if (item.food) {
    if (/carrot/.test(id)) {
      for (let y = 6; y < 28; y++)
        fill("#dd8f38", 8 + (y >> 2), y, Math.max(2, 12 - (y >> 1)), 1);
      fill("#6d9e49", 6, 2, 5, 8);
      fill("#8bb859", 12, 1, 4, 9);
    } else if (/berries/.test(id)) {
      for (const [x, y] of [
        [8, 12],
        [16, 10],
        [12, 19],
        [20, 18],
      ]) {
        fill(/glow/.test(id) ? "#e9b84d" : "#b95361", x, y, 6, 7);
        fill("#e9a58e", x + 1, y + 1, 2, 2);
      }
      fill("#6d984e", 10, 5, 14, 4);
    } else if (/stew|soup/.test(id)) {
      fill("#9b6d43", 4, 16, 24, 8);
      fill("#63432d", 7, 24, 18, 3);
      fill("#c19155", 4, 12, 24, 5);
      fill("#728a47", 9, 13, 4, 3);
    } else if (/beef|chicken|pork|mutton|rabbit/.test(id)) {
      fill(/cooked/.test(id) ? "#9d684a" : "#cf8a86", 5, 8, 22, 17);
      fill("#f0c9a0", 6, 22, 18, 4);
      fill("#e2aa83", 9, 9, 8, 4);
    } else {
      const c = /golden/.test(id)
        ? "#e8c052"
        : /beetroot/.test(id)
          ? "#af4964"
          : /potato/.test(id)
            ? "#c6a16b"
            : /cookie|pie/.test(id)
              ? "#b8874c"
              : "#d5b683";
      fill(c, 7, 5, 18, 22);
      fill(c, 4, 11, 24, 11);
      fill("#ffffff40", 9, 7, 5, 6);
    }
  } else if (/seeds/.test(id)) {
    for (let i = 0; i < 7; i++)
      fill("#b9bd70", 5 + ((i * 7) % 21), 6 + ((i * 11) % 19), 4, 5);
  } else if (/dye/.test(id)) {
    for (let i = 0; i < 8; i++)
      fill(item.color, 4 + ((i * 7) % 22), 8 + ((i * 9) % 17), 6, 5);
  } else if (/ingot|scrap/.test(id)) {
    fill(item.color, 4, 12, 24, 12);
    fill("#ffffff55", 8, 9, 18, 4);
    fill("#00000033", 4, 24, 24, 3);
  } else if (id === "shears") {
    fill("#cbd0d1", 7, 3, 4, 17);
    fill("#e4e4db", 20, 3, 4, 17);
    fill("#8d6447", 4, 20, 9, 9);
    fill("#8d6447", 19, 20, 9, 9);
    fill("#8c9b9b", 12, 15, 8, 5);
    fill("#161c2255", 6, 23, 4, 3);
    fill("#161c2255", 21, 23, 4, 3);
  } else if (id === "spyglass") {
    fill("#ad7e45", 10, 3, 12, 26);
    fill("#e7c776", 8, 3, 16, 4);
    fill("#80c3cc", 10, 4, 12, 2);
    fill("#e7c776", 9, 24, 14, 4);
  } else if (id === "compass" || id === "clock") {
    fill("#777d83", 6, 4, 20, 24);
    fill(id === "clock" ? "#d4bb6d" : "#bfc7c4", 3, 8, 26, 16);
    fill("#303e4c", 7, 8, 18, 16);
    fill(id === "clock" ? "#e5ca65" : "#d35c59", 14, 8, 4, 11);
    fill("#e7e6d6", 14, 18, 4, 7);
  } else {
    fill(item.color, 11, 4, 11, 6);
    fill(item.color, 6, 10, 19, 12);
    fill(item.color, 10, 22, 11, 6);
    fill("#ffffff40", 11, 8, 4, 7);
  }
  return true;
}
