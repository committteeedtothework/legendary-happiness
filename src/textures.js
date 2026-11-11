import { paintCompletedBlocks } from "./completed-block-art.js";
import { paintCompletedItem } from "./completed-item-art.js";
import { paintRefinedItem, visualInventoryItem } from "./refined-item-art.js";
import { paintArmorIcon } from "./armor-art.js";
import { paintWeaponIcon } from "./weapon-art.js";
import { paintEditionAtlas, paintEditionItem } from "./edition-art.js";
import { paintAquaticAtlas, paintAquaticItem } from "./aquatic-art.js";
import { paintItemArt } from "./item-art.js";
import { paintInventoryArt } from "./inventory-art.js";
import { paintContentAtlas } from "./content-textures.js";
import { paintRenewedAtlas } from "./renewed-textures.js";
import * as THREE from "three";
import { makeClassicAtlas } from "./classic-textures.js";
import { BLOCKS, ITEMS, ATLAS_COLS, ATLAS_ROWS } from "./data.js";
import { hash } from "./random.js";
import { paintSuppliedAtlas, suppliedItemImage } from "./supplied-pack.js";
import { EXTRA_ART } from "./block-art.js";
export const TILE = 16,
  COLS = ATLAS_COLS,
  ROWS = ATLAS_ROWS;
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
let atlasCanvas,
  activePack = "renewed";
export function makeAtlas(pack = "renewed") {
  const atlas = makeClassicAtlas(),
    { canvas, texture } = atlas;
  if (pack !== "classic") {
    const c = canvas.getContext("2d"),
      original = c.getImageData(0, 0, canvas.width, canvas.height),
      out = c.createImageData(canvas.width, canvas.height);
    // Preserve silhouettes, cutouts and crisp pixels while reducing speckle.
    // Filtering stays inside each atlas tile, so unrelated textures never bleed.
    for (let y = 0; y < canvas.height; y++)
      for (let x = 0; x < canvas.width; x++) {
        const i = (y * canvas.width + x) * 4,
          lx = x % 16,
          ly = y % 16,
          id = Math.floor((Math.floor(y / 16) * COLS + Math.floor(x / 16)) / 3),
          key = BLOCKS[id]?.key || "";
        out.data[i + 3] = original.data[i + 3];
        if (!original.data[i + 3]) continue;
        for (let ch = 0; ch < 3; ch++) {
          let total = 0,
            weight = 0;
          for (let dy = -1; dy <= 1; dy++)
            for (let dx = -1; dx <= 1; dx++) {
              if (lx + dx < 0 || lx + dx > 15 || ly + dy < 0 || ly + dy > 15)
                continue;
              const j = ((y + dy) * canvas.width + x + dx) * 4;
              if (original.data[j + 3] !== original.data[i + 3]) continue;
              const w = dx === 0 && dy === 0 ? 5 : 1;
              total += original.data[j + ch] * w;
              weight += w;
            }
          // Ore, tool, pane and workstation markings retain their sharp detail.
          const structural = /ore|table|door|chest|furnace|glass|relic/.test(
              key,
            ),
            mix = structural ? 0.2 : 0.66;
          const value =
            original.data[i + ch] * (1 - mix) +
            (total / Math.max(1, weight)) * mix;
          out.data[i + ch] = Math.max(
            0,
            Math.min(255, (value - 100) * 0.96 + 106),
          );
        }
      }
    c.putImageData(out, 0, 0);
  }
  if (pack === "renewed" || pack === "supplied") paintRenewedAtlas(canvas);
  paintContentAtlas(canvas);
  if (pack === "supplied") paintSuppliedAtlas(canvas, BLOCKS, COLS);
  paintAquaticAtlas(canvas);
  paintEditionAtlas(canvas);
  paintCompletedBlocks(canvas, pack);
  atlasCanvas = canvas;
  activePack = pack;
  icons.clear();
  iconCanvases.clear();
  texture.needsUpdate = true;
  atlas.pack = pack;
  return atlas;
}
export function crackTextures() {
  return Array.from({ length: 10 }, (_, stage) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 16;
    const c = canvas.getContext("2d");
    c.fillStyle = "#151515";
    for (let branch = 0; branch <= stage + 1; branch++) {
      let x = 8,
        y = 8;
      for (let n = 0; n < 3 + stage; n++) {
        x += hash(n, branch, 11) > 0.5 ? 1 : -1;
        y += hash(n, branch, 22) > 0.5 ? 1 : -1;
        c.fillRect(
          Math.max(0, Math.min(15, x)),
          Math.max(0, Math.min(15, y)),
          stage > 6 && branch % 3 === 0 ? 2 : 1,
          1,
        );
      }
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = tex.minFilter = THREE.NearestFilter;
    return tex;
  });
}
const icons = new Map();
const iconCanvases = new Map();
export function itemIconCanvas(id) {
  iconURL(id);
  return iconCanvases.get(id);
}
export function iconURL(id) {
  if (icons.has(id)) return icons.get(id);
  const item = visualInventoryItem(id);
  if (!item) return "";
  if (item.block !== undefined && !atlasCanvas) makeAtlas(activePack);
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const c = canvas.getContext("2d");
  c.imageSmoothingEnabled = false;
  const fill = (color, x, y, w, h) => {
    c.fillStyle = color;
    c.fillRect(x, y, w, h);
  };
  const supplied = activePack === "supplied" ? suppliedItemImage(id) : null;
  if (paintArmorIcon(c, id)) {
    // Equipped surfaces and icons share the same original armor palette.
  } else if (paintWeaponIcon(c, id)) {
    // Weapon visuals/icons stay original and consistent across all packs.
  } else if (supplied) {
    c.drawImage(supplied, 0, 0, 32, 32);
  } else if (activePack !== "classic" && paintCompletedItem(c, id)) {
  } else if (paintRefinedItem(c, id)) {
  } else if (paintInventoryArt(c, id, item)) {
  } else if (
    item.block === undefined &&
    !item.tool &&
    (activePack !== "classic" || id === "netherite_ingot") &&
    paintItemArt(c, id, item)
  ) {
    // Prefer already-refined native sprites over legacy edition placeholders.
  } else if (item.edition && paintEditionItem(c, id, item, atlasCanvas)) {
  } else if (paintAquaticItem(c, id, item)) {
  } else if (
    (activePack === "renewed" ||
      activePack === "supplied" ||
      item.musicDisc ||
      id === "palm_tablet" ||
      id === "saint_corpse_part") &&
    paintItemArt(c, id, item)
  ) {
    // Native supplied icons take priority; custom fallback art stays original.
  } else if (item.spawnType) {
    for (let y = 4; y < 29; y++)
      for (let x = 6; x < 26; x++) {
        const nx = (x - 15.5) / (y < 12 ? 7 : 10),
          ny = (y - 17) / 12;
        if (nx * nx + ny * ny < 1) {
          fill(item.color, x, y, 1, 1);
          if ((x * 7 + y * 11) % 17 < 3) fill("#413e50", x, y, 2, 2);
        }
      }
    fill("#ffffff50", 10, 10, 3, 5);
  } else if (id === "cinder_sigil") {
    for (let y = 3; y < 29; y++)
      for (let x = 3; x < 29; x++) {
        const d = Math.abs(x - 16) + Math.abs(y - 16);
        if (d <= 13) fill(d > 10 ? "#d68a42" : "#3d243b", x, y, 1, 1);
      }
    fill("#ffce75", 14, 7, 4, 18);
    fill("#ff9b41", 9, 12, 14, 4);
    fill("#fff0bc", 14, 12, 4, 4);
  } else if (item.armorSlot !== undefined) {
    const color = item.color;
    if (item.armorSlot === 0) {
      fill(color, 5, 6, 22, 11);
      fill(color, 5, 16, 6, 9);
      fill(color, 21, 16, 6, 9);
    }
    if (item.armorSlot === 1) {
      fill(color, 7, 5, 18, 23);
      fill(color, 2, 7, 6, 11);
      fill(color, 24, 7, 6, 11);
      fill("#27313b", 12, 4, 8, 6);
    }
    if (item.armorSlot === 2) {
      fill(color, 6, 4, 20, 9);
      fill(color, 6, 12, 8, 17);
      fill(color, 18, 12, 8, 17);
    }
    if (item.armorSlot === 3) {
      fill(color, 5, 7, 8, 20);
      fill(color, 19, 7, 8, 20);
      fill(color, 2, 22, 11, 6);
      fill(color, 16, 22, 11, 6);
    }
    fill("#ffffff60", 7, 8, 3, 8);
  } else if (item.block !== undefined) {
    if (!atlasCanvas) makeAtlas(activePack);
    const tile = (face, front = false) => {
      const extra = EXTRA_ART[item.key + "_front"];
      const index =
        activePack === "supplied" && front && extra !== undefined
          ? extra
          : (BLOCKS[item.block].artTile ?? item.block * 3) + face;
      return { x: (index % COLS) * 16, y: Math.floor(index / COLS) * 16 };
    };
    const draw = (face, transform, dark = 0, front = false) => {
      const t = tile(face, front);
      c.save();
      c.transform(...transform);
      c.drawImage(atlasCanvas, t.x, t.y, 16, 16, 0, 0, 16, 16);
      if (dark) {
        c.fillStyle = `rgba(0,0,0,${dark})`;
        c.fillRect(0, 0, 16, 16);
      }
      c.restore();
    };
    if (BLOCKS[item.block].door) {
      for (let half = 0; half < 2; half++) {
        const t =
          (BLOCKS[item.block].artTile ?? (item.block + 1 - half) * 3) + 1;
        c.drawImage(
          atlasCanvas,
          (t % COLS) * 16,
          Math.floor(t / COLS) * 16,
          16,
          16,
          8,
          2 + half * 14,
          16,
          14,
        );
      }
    } else if (
      [
        "torch",
        "wild_grass",
        "poppy",
        "cornflower",
        "crop",
        "sugar_cane",
        "fern",
        "bamboo",
        "cobweb",
        "mine_rail",
      ].includes(item.key) ||
      BLOCKS[item.block].plant
    ) {
      const t = tile(1);
      c.drawImage(atlasCanvas, t.x, t.y, 16, 16, 2, 1, 28, 30);
    } else {
      draw(1, [0.8125, 0.4375, 0, 0.875, 3, 9], 0.08, true);
      draw(1, [0.8125, -0.4375, 0, 0.875, 16, 16], 0.25);
      draw(0, [0.8125, 0.4375, -0.8125, 0.4375, 16, 2]);
    }
  } else if (item.tool === "pistols") {
    for (const [x, y, dark] of [
      [2, 4, false],
      [12, 17, true],
    ]) {
      fill(dark ? "#343942" : "#bac4cb", x, y, 18, 5);
      fill(dark ? "#68717a" : "#e1e6e8", x + 1, y, 17, 1);
      fill("#171b21", x + 1, y + 5, 17, 1);
      for (let i = 0; i < 3; i++) fill("#171b21", x + 2 + i * 2, y + 1, 1, 3);
      fill("#171b21", x + 15, y - 1, 2, 1);
      fill("#875237", x + 1, y + 6, 5, 7);
      fill("#633b29", x, y + 11, 5, 2);
      fill("#b6a36b", x + 2, y + 8, 2, 2);
      fill(dark ? "#68717a" : "#bac4cb", x + 6, y + 9, 5, 1);
      fill(dark ? "#68717a" : "#bac4cb", x + 10, y + 6, 1, 3);
    }
  } else if (item.tool) {
    c.save();
    c.translate(16, 17);
    c.rotate(0.65);
    fill("#644b36", -2, -1, 5, 17);
    fill("#b89964", -2, 0, 3, 15);
    if (item.legendary) {
      fill("#ac7726", -2, 6, 5, 10);
      fill("#f7d879", -2, 6, 2, 10);
      fill("#e9bc55", -8, 2, 17, 4);
      fill("#35aabc", -4, -16, 9, 18);
      fill("#6ff5fb", -2, -18, 5, 20);
      fill("#e6fbfc", 0, -15, 2, 14);
      fill("#7bfaff", -2, 4, 5, 4);
    } else if (item.tool === "spear") {
      fill("#8a6038", -1, -9, 3, 28);
      fill(item.color, -4, -18, 9, 11);
      fill(item.color, -2, -22, 5, 5);
    } else if (item.tool === "sword") {
      fill("#3c514e", -6, 2, 13, 3);
      fill(item.color, -2, -14, 5, 16);
      fill("#ffffff50", -2, -13, 2, 14);
    } else if (item.tool === "pickaxe") {
      fill(item.color, -10, -8, 20, 5);
      fill(item.color, -11, -5, 4, 6);
      fill(item.color, 7, -5, 4, 6);
    } else if (item.tool === "axe") {
      fill(item.color, -9, -9, 13, 12);
      fill(item.color, -10, -6, 4, 6);
    } else if (item.tool === "hoe") {
      fill(item.color, -9, -8, 16, 4);
      fill(item.color, -10, -8, 4, 9);
    } else {
      fill(item.color, -5, -11, 10, 12);
      fill(item.color, -3, 1, 6, 3);
    }
    c.restore();
  } else {
    if (id === "bone") {
      fill("#ddd8bc", 13, 6, 6, 21);
      for (const [x, y] of [
        [9, 3],
        [16, 3],
        [9, 24],
        [16, 24],
      ])
        fill("#e7e1c9", x, y, 8, 6);
      fill("#a9a58d", 17, 10, 2, 13);
    } else if (id === "string") {
      for (let i = 0; i < 4; i++) {
        fill("#d9d5c9", 6 + i * 3, 4 + i * 2, 2, 22 - i * 2);
        fill("#eeeadf", 6 + i * 3, 4 + i * 2, 17 - i * 5, 2);
        fill("#b3afa7", 6 + i * 3, 24, 17 - i * 4, 2);
      }
    } else if (id === "bone_meal" || id === "gunpowder") {
      for (let i = 0; i < 14; i++)
        fill(
          item.color,
          5 + Math.floor(hash(i, 0, 51) * 20),
          8 + Math.floor(hash(i, 1, 51) * 17),
          4,
          4,
        );
      fill(id === "bone_meal" ? "#faf1da" : "#828079", 10, 11, 4, 3);
    } else if (id === "rotten_flesh") {
      fill("#8b7353", 7, 7, 16, 19);
      fill("#7d543f", 4, 12, 24, 10);
      fill("#ad9560", 9, 7, 4, 6);
      fill("#58613e", 17, 15, 7, 7);
    } else if (id.endsWith("bucket")) {
      fill("#6d7f87", 5, 7, 22, 5);
      fill("#ced9d9", 6, 10, 20, 14);
      fill("#7f969e", 9, 24, 14, 3);
      fill(
        id === "bucket"
          ? "#4f6066"
          : id === "water_bucket"
            ? "#568bc8"
            : "#ed8737",
        9,
        11,
        14,
        8,
      );
      fill("#e5eeea", 7, 11, 2, 10);
    } else if (id === "flint_and_steel") {
      fill("#d0d5df", 4, 7, 5, 17);
      fill("#d0d5df", 8, 4, 12, 5);
      fill("#d0d5df", 8, 22, 12, 5);
      fill("#747b86", 17, 8, 5, 5);
      fill("#4b4b60", 19, 13, 9, 14);
      fill("#ffbb65", 12, 12, 3, 3);
    } else if (id === "stick") {
      c.translate(16, 16);
      c.rotate(0.65);
      fill("#b29160", -2, -13, 4, 27);
    } else if (id.includes("ingot")) {
      fill(item.color, 5, 12, 22, 11);
      fill("#ffffff70", 8, 9, 17, 4);
      fill("#718381", 5, 23, 22, 3);
    } else if (id === "seeds" || id === "wheat") {
      for (let i = 0; i < 5; i++) {
        fill("#759648", 8 + i * 3, 12, 2, 17);
        fill(
          id === "wheat" ? "#d8bb6a" : "#a3ba68",
          6 + i * 3,
          5 + (i % 3) * 3,
          5,
          10,
        );
      }
    } else {
      fill("#00000030", 6, 9, 21, 20);
      fill(item.color, 7, 5, 18, 21);
      fill(item.color, 4, 10, 24, 12);
      fill("#ffffff40", 9, 7, 5, 6);
      if (id === "apple") fill("#73914e", 16, 1, 7, 5);
    }
  }
  const url = canvas.toDataURL();
  icons.set(id, url);
  iconCanvases.set(id, canvas);
  return url;
}
