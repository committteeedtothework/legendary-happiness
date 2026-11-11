import { B, BLOCKS, ATLAS_COLS, ATLAS_ROWS } from "./data.js";
import { hash } from "./random.js";
// New content receives original readable pixel motifs in every resource pack.
// No legacy tile is touched; Classic's earlier artwork stays byte-identical.
export function paintContentAtlas(canvas) {
  const c = canvas.getContext("2d");
  for (let id = B.copper_ore; id < 199; id++)
    for (let face = 0; face < 3; face++) {
      const b = BLOCKS[id],
        k = b.key,
        ox = ((id * 3 + face) % ATLAS_COLS) * 16,
        oy = Math.floor((id * 3 + face) / ATLAS_COLS) * 16;
      if (b.fluid) continue;
      const base = [1, 3, 5].map((i) => parseInt(b.color.slice(i, i + 2), 16));
      c.clearRect(ox, oy, 16, 16);
      if (k === "cobweb") {
        c.strokeStyle = "#dddcd3";
        c.lineWidth = 1;
        c.beginPath();
        for (const [x, z] of [
          [0, 0],
          [8, 0],
          [16, 0],
          [16, 8],
          [16, 16],
          [8, 16],
          [0, 16],
          [0, 8],
        ]) {
          c.moveTo(ox + 8, oy + 8);
          c.lineTo(ox + x, oy + z);
        }
        for (const r of [3, 6]) {
          c.moveTo(ox + 8 - r, oy + 8);
          c.lineTo(ox + 8, oy + 8 - r);
          c.lineTo(ox + 8 + r, oy + 8);
          c.lineTo(ox + 8, oy + 8 + r);
          c.closePath();
        }
        c.stroke();
        continue;
      }
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 16; x++) {
          let color = base,
            n = (hash(x, y, id, 112) - 0.5) * 16;
          if (k === "jukebox") {
            color = [121, 83, 53];
            if (x === 0 || x === 15 || y === 0 || y === 15) {
              color = [67, 46, 36];
              n = 0;
            } else if (face === 0) {
              const r = Math.hypot(x - 7.5, y - 7.5);
              if (r < 5.5) {
                color = r < 1.5 ? [87, 192, 192] : [39, 36, 44];
                n = (Math.floor(r) % 2) * 11;
              }
              if (y === 2 && x > 3 && x < 12) {
                color = [40, 31, 32];
                n = 0;
              }
            } else if (face === 1 && x > 2 && x < 13 && y > 3 && y < 13) {
              color = (x + y) % 2 ? [50, 39, 35] : [153, 112, 67];
              n = 0;
              if (x === 7 && y === 8) color = [82, 213, 209];
            } else if (y % 5 === 0) n -= 24;
          } else if (k === "dripstone") {
            color = [161, 123, 96];
            n += (x % 4 === 0 ? -25 : 0) + (y % 5 === 0 ? 8 : 0);
          } else if (k === "mine_rail") {
            color = [75, 52, 37];
            n = 0;
            if (y === 4 || y === 5 || y === 11 || y === 12)
              color = [170, 166, 151];
            else if (x % 4 === 0 || x % 4 === 1) color = [126, 94, 62];
          } else if (k.endsWith("_ore")) {
            color = [126, 131, 124];
            for (const [cx, cy] of [
              [3, 4],
              [11, 3],
              [7, 10],
              [13, 13],
            ])
              if (Math.abs(x - cx) + Math.abs(y - cy) < 2) {
                color = base;
                n += x <= cx ? 24 : -13;
              }
          } else if (k === "fire") {
            if (y < 3 + Math.floor(hash(x >> 1, 0, 2) * 10)) continue;
            color = y < 10 ? [255, 210, 85] : [241, 110, 35];
            n += Math.sin(x * 2 + y) * 20;
          } else if (k === "temple_seal" || k === "infernal_seal") {
            if (x % 5 > 1 && y % 5 > 1) continue;
            color = k === "infernal_seal" ? [255, 135, 55] : [90, 225, 240];
          } else if (k === "tnt" || k === "primed_tnt") {
            color = y >= 5 && y <= 10 ? [225, 219, 190] : [184, 65, 40];
            if (x % 5 === 0) n -= 35;
            if (y === 7 && x > 3 && x < 12) color = [50, 43, 39];
          } else if (k === "bookshelf") {
            if (face !== 1 || y === 0 || y === 7 || y === 15)
              color = [158, 123, 76];
            else {
              color = [
                [165, 64, 48],
                [71, 117, 116],
                [199, 166, 82],
                [97, 81, 136],
              ][Math.floor(x / 3) % 4];
              if (x % 3 === 0) n -= 45;
            }
          } else if (k === "hay_bale") {
            if (face === 1 && (y === 3 || y === 12)) color = [123, 76, 38];
            n += x % 3 === 0 ? -22 : 8;
          } else if (
            k.endsWith("_block") &&
            !k.startsWith("raw_") &&
            k !== "coal_block"
          ) {
            if (x === 0 || y === 15) n -= 35;
            else if (x === 1 || y === 1) n += 28;
            else if (x === 3 || y === 12) n -= 8;
          } else if (k.includes("stone_bricks")) {
            const seam = y % 5 === 0 || (x + Math.floor(y / 5) * 4) % 8 === 0;
            n += seam ? -30 : 4;
            if (k.startsWith("cracked") && (x + y * 2) % 11 === 0) n -= 45;
          }
          c.fillStyle = `rgb(${color.map((v) => Math.max(0, Math.min(255, Math.round(v + n)))).join(",")})`;
          c.fillRect(ox + x, oy + y, 1, 1);
        }
    }
}
