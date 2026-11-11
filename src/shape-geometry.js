import * as THREE from "three";
import { shapeSurfaces } from "./block-shapes.js";
const vertices = [
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
export function shapeGeometry(parts) {
  const p = [],
    uv = [],
    index = [];
  for (const q of shapeSurfaces(parts)) {
    const start = p.length / 3;
    for (let i = 0; i < 4; i++) {
      p.push(
        ...vertices[q.face][i].map(
          (v, a) => q.bounds[a] + v * (q.bounds[a + 3] - q.bounds[a]),
        ),
      );
      uv.push([0, 1, 1, 0][i], [0, 0, 1, 1][i]);
    }
    index.push(start, start + 1, start + 2, start, start + 2, start + 3);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(index);
  g.computeVertexNormals();
  return g;
}
