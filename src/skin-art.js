import { paintSkinPixel } from "./skin-pixels.js";
// Original pixel artwork, painted onto square body surfaces rather than raised
// boxes. A face strip keeps the same texel density on every side of each part.
import * as THREE from "three";
import { skinFor } from "./skins.js";
import { faceTexture, faceBoxGeometry } from "./pixel-surfaces.js";
const cache = new Map();
const dimensions = {
  head: [8, 8, 8],
  body: [8, 12, 4],
  leg: [4, 12, 4],
  arm: [4, 12, 4],
};
export function skinPartTexture(id, part, side = 1, cover = {}) {
  const s = skinFor(id),
    canonical = ["sleeve", "hand"].includes(part) ? "arm" : part;
  const key = `${s.style}:${canonical}:${side}:${!!cover.leggings}:${!!cover.boots}`;
  if (cache.has(key)) return cache.get(key);
  const map = faceTexture(
    dimensions[canonical],
    (face, x, y, w, h) => {
      if (canonical === "leg") {
        if ((face === 2 && cover.leggings) || (face === 3 && cover.boots))
          return null;
        if (
          face !== 2 &&
          face !== 3 &&
          ((cover.leggings && y + 0.5 < 8.5) || (cover.boots && y + 0.5 >= 8.1))
        )
          return null;
      }
      return paintSkinPixel(s, canonical, face, x, y, w, h, side);
    },
    { skin: s.style, part: canonical, side, cover: { ...cover } },
  );
  cache.set(key, map);
  return map;
}
export const skinBoxGeometry = faceBoxGeometry;
export function skinMaterial(id, part, side = 1, cover = {}) {
  const m = new THREE.MeshLambertMaterial({
    map: skinPartTexture(id, part, side, cover),
    color: "#ffffff",
    alphaTest: 0.5,
  });
  m.userData.sharedMap = true;
  return m;
}
