import * as THREE from "three";
import { BLOCKS, ATLAS_COLS, ATLAS_ROWS } from "./data.js";
import { hash } from "./random.js";
const TILE = 16,
  COLS = ATLAS_COLS,
  ROWS = ATLAS_ROWS;
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
// Frozen v0.5.0 atlas generator. Existing block pixels remain identical.
export function makeClassicAtlas() {
  const canvas = document.createElement("canvas");
  canvas.width = COLS * TILE;
  canvas.height = ROWS * TILE;
  const c = canvas.getContext("2d");
  for (const [id, b] of BLOCKS.entries())
    if (!b.edition)
      for (let face = 0; face < 3; face++) {
        const ox = ((id * 3 + face) % COLS) * 16,
          oy = Math.floor((id * 3 + face) / COLS) * 16,
          k = b.key.endsWith("_leaves")
            ? "leaves"
            : b.key.endsWith("_log")
              ? "log"
              : b.key === "fern"
                ? "wild_grass"
                : b.key;
        for (let y = 0; y < 16; y++)
          for (let x = 0; x < 16; x++) {
            const fine = hash(x, y, id * 7 + face),
              patch = hash(x >> 1, y >> 1, id + face * 77),
              cluster = hash(
                Math.floor((x + 1) / 3),
                Math.floor((y + 2) / 3),
                id + 7,
              );
            let color = rgb(b.color),
              shade = 0.82 + patch * 0.22 + fine * 0.12;
            if (k === "grass" || k === "wild_grass" || k === "leaves") {
              color = rgb(k === "leaves" ? "#48852c" : "#6fa840");
              shade = 0.72 + cluster * 0.32 + fine * 0.14;
            }
            if (k === "grass" && face !== 0) {
              color = rgb("#875e3e");
              shade = 0.78 + patch * 0.25 + fine * 0.12;
              if (face === 1 && y < 2 + Math.floor(hash(x >> 1, 0, 73) * 4)) {
                color = rgb("#65a63b");
                shade = 0.9 + fine * 0.16;
              }
            }
            if (k === "dirt" || (k === "grass" && face === 2)) {
              if (cluster > 0.78) color = rgb("#a77f55");
              if (fine > 0.94) shade = 0.55;
            }
            if (k === "stone" || k.endsWith("_ore")) {
              color = rgb("#858585");
              shade = 0.75 + cluster * 0.26 + fine * 0.14;
              if ((x + Math.floor(y / 4) * 3) % 11 === 0) shade *= 0.85;
            }
            if (k.endsWith("_ore")) {
              const r = hash(x >> 1, y >> 1, id + 9);
              if (r > 0.76) {
                color = rgb(
                  k === "hellfire_ore" || k === "brimstone_ore"
                    ? b.color
                    : k === "coal_ore"
                      ? "#242527"
                      : k === "iron_ore"
                        ? "#c7a68d"
                        : k === "lapis_ore"
                          ? "#4265d9"
                          : "#53e7d6",
                );
                shade = x % 2 === 0 && y % 2 === 0 ? 1.18 : 0.85;
              }
            }
            if (k === "log") {
              if (face === 1) {
                color = rgb("#705332");
                const line = (x + Math.floor(y / 6)) % 5;
                shade =
                  line === 0 ? 0.57 : line === 1 ? 1.15 : 0.86 + fine * 0.23;
              } else {
                color = rgb("#b89763");
                const d = Math.max(Math.abs(x - 7.5), Math.abs(y - 7.5));
                shade = Math.floor(d) % 3 === 0 ? 0.62 : 0.9 + fine * 0.14;
                if (d > 6.5) {
                  color = rgb("#725635");
                  shade = 0.8 + fine * 0.2;
                }
              }
            }
            if (["planks", "crafting_table", "chest"].includes(k)) {
              color = rgb("#b58b54");
              shade = 0.85 + fine * 0.13;
              if (y % 4 === 0) shade = 0.58;
              if ((x + (Math.floor(y / 4) % 2) * 7) % 16 === 0) shade = 0.64;
              if (y % 4 === 1) shade = 1.12;
            }
            if (b.relic) {
              color = rgb(b.relic === "base" ? "#354c61" : "#55e1ed");
              shade = 0.8 + fine * 0.25;
              if (b.relic === "base" && (x % 5 === 0 || y % 5 === 0)) {
                color = rgb("#56d8e0");
                shade = 1.2;
              }
              if (b.relic === "blade" && (x < 3 || x > 12 || y < 3))
                color = rgb("#e8bd63");
            }
            if (k === "enchanting_table") {
              color = rgb(face === 0 ? "#6b3a70" : "#28223a");
              shade = 0.8 + fine * 0.2;
              if ((x < 3 || x > 12) && (y < 3 || y > 12))
                color = rgb("#51cbd7");
              if (face === 0 && x > 3 && x < 12 && y > 3 && y < 12)
                color = rgb("#ead9af");
            }
            if (k === "sugar_cane") {
              if (x % 4 > 1) continue;
              color = rgb(x % 4 === 0 ? "#405c2b" : "#9cbf63");
              shade = 0.85 + fine * 0.16;
            }
            if (k === "hellfire_ore" || k === "brimstone_ore") {
              if (hash(x >> 1, y >> 1, id + 9) <= 0.76) color = rgb("#664951");
            }
            if (b.key === "ember_leaves") {
              color = rgb("#b65a62");
              shade = 0.7 + cluster * 0.35 + fine * 0.1;
            }
            if (k === "cinder_bricks") {
              if (y % 5 === 0 || (x + (Math.floor(y / 5) % 2) * 5) % 10 === 0)
                shade = 0.45;
            }
            if (k === "runestone") {
              if (
                x === 7 ||
                (y === 4 && x > 4 && x < 11) ||
                (y === 11 && x > 2 && x < 9)
              ) {
                color = rgb("#78d8e0");
                shade = 1.3;
              }
            }
            if (k === "glow_crystal") {
              color = rgb(x % 5 === 0 ? "#ffe0a1" : "#c98845");
              shade = 1.1 + patch * 0.3;
            }
            if (k === "bamboo") {
              if (x < 6 || x > 9) continue;
              color = rgb(y % 5 === 0 ? "#405f30" : "#9cbf63");
            }
            if (k === "ashen_log") {
              color = rgb(face === 1 ? "#584353" : "#8c7378");
              shade = 0.65 + (x % 4 === 0 ? 0 : 0.3) + fine * 0.15;
            }
            if (b.door) {
              color = rgb("#b18c55");
              shade = 0.85 + fine * 0.15;
              if (x % 4 === 0) shade = 0.64;
              if (x < 2 || x > 13 || y < 2 || y > 13) {
                color = rgb("#785632");
                shade = 0.9 + fine * 0.12;
              }
              if (
                b.door.upper &&
                ((x >= 4 && x <= 6) || (x >= 9 && x <= 11)) &&
                y >= 3 &&
                y <= 8
              ) {
                color = rgb("#b7d7d3");
                shade = 0.8 + ((x + y) % 4) * 0.07;
              }
              if (!b.door.upper && x >= 11 && x <= 12 && y >= 4 && y <= 5) {
                color = rgb("#e5c26f");
                shade = 1;
              }
            }
            if (k === "crafting_table") {
              if (face === 0) {
                color = rgb("#996439");
                if (x < 2 || y < 2 || x > 13 || y > 13) {
                  color = rgb("#bc925c");
                  shade = 1;
                } else if ((x - 2) % 4 === 0 || (y - 2) % 4 === 0) shade = 0.42;
              } else if (face === 1) {
                if (x < 2 || x > 13) shade = 0.43;
                if ((x === 5 || x === 10) && y > 7) color = rgb("#c6c5b7");
              }
            }
            if (k === "chest") {
              if (x < 2 || x > 13 || y < 2 || y > 13 || y === 5) shade = 0.38;
              if (face === 1 && x >= 7 && x <= 9 && y >= 6 && y <= 10) {
                color = rgb("#d5d5b8");
                shade = x === 7 ? 1.15 : 0.8;
              }
            }
            if (k === "cobble") {
              color = rgb("#80817e");
              const row = Math.floor(y / 5),
                xx = (x + (row % 2) * 4) % 8;
              if (y % 5 === 0 || xx === 0) shade = 0.48;
              else if (y % 5 === 1 || xx === 1) shade = 1.15;
              else shade = 0.77 + patch * 0.24;
            }
            if (k === "brick") {
              const row = y >> 2;
              if (y % 4 === 0 || (x + (row % 2) * 4) % 8 === 0) {
                color = rgb("#a5a3a0");
                shade = 0.9;
              } else shade = 0.82 + patch * 0.25;
            }
            if (k === "furnace") {
              color = rgb("#777975");
              if (x < 2 || x > 13 || y < 2 || y > 13) shade = 1.15;
              if (
                face === 1 &&
                x > 2 &&
                x < 13 &&
                ((y > 3 && y < 7) || (y > 9 && y < 13))
              ) {
                color = rgb("#222522");
                shade = 0.8 + fine * 0.18;
              }
            }
            if (k === "sandstone") {
              color = rgb("#d6c18b");
              shade = 0.88 + fine * 0.14;
              if (face === 1 && (y === 8 || y === 15)) shade = 0.72;
            }
            if (k === "sand") {
              color = rgb("#dfd09a");
              shade = 0.9 + fine * 0.1;
              if (patch > 0.9) shade = 0.77;
            }
            if (k === "gravel") {
              color = rgb("#96918d");
              shade = 0.6 + patch * 0.45 + fine * 0.1;
              if ((x + y * 3) % 9 === 0) shade = 0.48;
            }
            if (k === "path") {
              color = rgb(face === 2 ? "#845d3b" : "#a78c55");
              shade = 0.78 + patch * 0.2 + fine * 0.12;
            }
            if (k === "bed" && face === 0 && y < 5) {
              color = rgb("#eee7d8");
              shade = 0.9 + fine * 0.1;
            }
            if (k === "farmland") {
              color = rgb("#724c30");
              shade =
                (y % 4 === 0 ? 0.48 : y % 4 === 1 ? 1.12 : 0.87) + fine * 0.1;
            }
            if (k === "glass") {
              if (
                x !== 0 &&
                y !== 0 &&
                x !== 15 &&
                y !== 15 &&
                !((x === y || x === y + 1) && (x < 5 || x > 10))
              )
                continue;
              color = rgb("#d9eeef");
              shade = 0.9 + fine * 0.1;
            }
            if (k === "leaves") {
              if (hash(x, y, id + 91) > 0.79 && patch < 0.7) continue;
              shade = 0.6 + patch * 0.43 + fine * 0.13;
            }
            if (["crop", "wild_grass", "poppy", "cornflower"].includes(k)) {
              const flower = k === "poppy" || k === "cornflower";
              if (flower) {
                if (y >= 2 && y <= 7 && x >= 5 && x <= 11) {
                  color = rgb(k === "poppy" ? "#d93f37" : "#688ce8");
                  shade = 0.8 + patch * 0.35;
                } else if (
                  y > 7 &&
                  (x === 8 || x === 7 || (y === 10 && x > 3 && x < 11))
                ) {
                  color = rgb("#427632");
                  shade = 1;
                } else continue;
              } else {
                if (
                  !(
                    y > 2 &&
                    (x % 4 === 1 || x % 4 === 2) &&
                    y > Math.floor(hash(x, 0, id) * 8)
                  )
                )
                  continue;
                color = rgb(k === "crop" && y < 7 ? "#c4ac4f" : "#6b9636");
                shade = 0.7 + fine * 0.3;
              }
            }
            if (k === "obsidian") {
              color = rgb("#241b35");
              shade = 0.65 + cluster * 0.7;
              if ((x + y * 3) % 13 === 0 && patch > 0.5) {
                color = rgb("#59457b");
                shade = 1;
              }
            }
            if (k === "cinderstone") {
              color = rgb("#884c45");
              shade = 0.6 + cluster * 0.58 + fine * 0.1;
            }
            if (k === "emberglass" || k === "lava") {
              color = rgb(cluster > 0.55 ? "#ffd064" : "#e96919");
              shade = 0.8 + fine * 0.3;
            }
            if (k === "portal") {
              color = rgb("#8e35c8");
              shade =
                0.7 +
                0.4 * Math.sin(Math.hypot(x - 8, y - 8) * 1.3) +
                fine * 0.15;
            }
            if (k === "water") {
              color = rgb("#356fc6");
              shade = 0.85 + Math.sin(x * 0.8 + y * 0.5) * 0.07 + fine * 0.05;
            }
            if (k === "torch") {
              color = rgb(y < 5 ? "#ffd77a" : "#855b2e");
              shade = y < 5 ? 1.15 : 0.8 + patch * 0.3;
            }
            if (b.key === "pine_leaves" || b.key === "birch_leaves")
              color = rgb(b.color);
            if (b.key === "pine_log")
              color = rgb(face === 1 ? "#65503b" : "#b69969");
            if (b.key === "birch_log") {
              color = rgb(face === 1 ? "#dedbca" : "#c8ba8a");
              if (face === 1 && hash(x >> 1, y >> 1, 912) > 0.78) shade = 0.3;
            }
            if (b.key === "terracotta")
              shade = 0.88 + Math.floor(y / 4) * 0.035 + fine * 0.04;
            if (b.key === "cactus")
              shade = x % 4 === 0 ? 0.65 : 0.9 + fine * 0.12;
            c.fillStyle = `rgb(${color.map((v) => Math.max(0, Math.min(255, Math.floor(v * shade)))).join(",")})`;
            c.fillRect(ox + x, oy + y, 1, 1);
          }
      }
  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestMipmapLinearFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  return { texture, canvas };
}
