import {
  createRangedWeapon,
  animateRangedWeapon,
} from "./ranged-weapon-models.js";
import * as THREE from "three";
import { blockParts, shapeSurfaces } from "./block-shapes.js";
import { blockArtUV } from "./block-art.js";
import { ITEMS, BLOCKS } from "./data.js";
const verts = [
  [
    [1, 0, 1],
    [1, 0, 0],
    [1, 1, 0],
    [1, 1, 1],
  ],
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
  [
    [0, 0, 0],
    [1, 0, 0],
    [1, 0, 1],
    [0, 0, 1],
  ],
  [
    [0, 0, 1],
    [1, 0, 1],
    [1, 1, 1],
    [0, 1, 1],
  ],
  [
    [1, 0, 0],
    [0, 0, 0],
    [0, 1, 0],
    [1, 1, 0],
  ],
];
const normals = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];
export function editionBlockModel(id, atlas) {
  const item = ITEMS[id],
    b = BLOCKS[item?.block];
  if (!b?.edition || b.plant) return null;
  const parts = blockParts(item.block);
  const centerParts = parts.filter(
    (p) => p[0] <= 0.5 && p[3] >= 0.5 && p[2] <= 0.5 && p[5] >= 0.5,
  );
  const anchor =
    centerParts[0] ||
    parts.reduce(
      (best, p) =>
        Math.hypot((p[0] + p[3]) / 2 - 0.5, (p[2] + p[5]) / 2 - 0.5) <
        Math.hypot((best[0] + best[3]) / 2 - 0.5, (best[2] + best[5]) / 2 - 0.5)
          ? p
          : best,
      parts[0],
    );
  const ax = centerParts.length ? 0.5 : (anchor[0] + anchor[3]) / 2,
    az = centerParts.length ? 0.5 : (anchor[2] + anchor[5]) / 2;
  const support = Math.min(
    ...parts
      .filter((p) => p[0] <= 0.5 && p[3] >= 0.5 && p[2] <= 0.5 && p[5] >= 0.5)
      .map((p) => p[1]),
  );
  const oy = (Number.isFinite(support) ? support : anchor[1]) + 0.5;
  const offset = [ax, oy, az];
  const p = [],
    n = [],
    uv = [],
    indices = [];
  for (const q of shapeSurfaces(blockParts(item.block))) {
    const start = p.length / 3;
    for (let i = 0; i < 4; i++) {
      const v = verts[q.face][i].map(
        (c, a) => q.bounds[a] + c * (q.bounds[a + 3] - q.bounds[a]),
      );
      p.push(...v.map((c, a) => (c - offset[a]) * 0.235));
      n.push(...normals[q.face]);
      uv.push(
        ...blockArtUV(
          item.block,
          q.face,
          [0, 1, 1, 0][i],
          [0, 0, 1, 1][i],
          atlas.pack,
        ),
      );
    }
    indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  geometry.setAttribute("normal", new THREE.Float32BufferAttribute(n, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  const material = new THREE.MeshLambertMaterial({
    map: atlas.texture,
    alphaTest: 0.5,
  });
  material.userData.sharedMap = true;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.voxelParts = parts.map((p) =>
    p.map((v, a) => (v - offset[a % 3]) * 0.235),
  );
  mesh.position.set(-0.025, 0.015, -0.14);
  mesh.rotation.y = -0.35;
  const g = new THREE.Group();
  g.add(mesh);
  g.userData.kind = "block";
  g.userData.item = id;
  return g;
}
export const editionWeaponModel = createRangedWeapon;
export const animateEditionWeapon = animateRangedWeapon;
