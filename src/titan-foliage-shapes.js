import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
const hash = (a, b) => {
  const n = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return n - Math.floor(n);
};
// Original leaf sprays on transparent space, not painted over a solid sphere.
export function titanLeafAtlas(size = 256) {
  const data = new Uint8Array(size * size * 4);
  const stamps = Array.from({ length: 32 }, (_, i) => {
    const branch = i % 4,
      u = Math.floor(i / 4) / 8;
    return {
      x: 0.5 + Math.sin(branch * 1.57 + u * 0.7) * (0.08 + u * 0.33),
      y: 0.49 + Math.cos(branch * 1.57 + u * 0.7) * (0.08 + u * 0.33),
      a: branch * 1.57 + u * 1.1,
      r: 0.052 + hash(i, 8) * 0.035,
    };
  });
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const u = x / size,
        v = y / size,
        index = (x + y * size) * 4;
      data.set([80, 108, 39, 0], index);
      for (let i = 0; i < stamps.length; i++) {
        const s = stamps[i],
          dx = u - s.x,
          dy = v - s.y;
        const a = (dx * Math.cos(s.a) + dy * Math.sin(s.a)) / s.r;
        const b = (-dx * Math.sin(s.a) + dy * Math.cos(s.a)) / (s.r * 0.46);
        const edge = 1 - a * a - b * b;
        if (edge <= 0) continue;
        const vein = Math.exp(-Math.abs(b) * 26) * 0.16;
        const light = 0.7 + edge * 0.23 + hash(i, 13) * 0.22 + vein;
        data.set(
          [
            104 * light,
            133 * light,
            47 * light,
            Math.min(255, edge * size * 15),
          ],
          index,
        );
      }
    }
  const tex = new T.DataTexture(data, size, size);
  tex.colorSpace = T.SRGBColorSpace;
  tex.magFilter = T.LinearFilter;
  tex.minFilter = T.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.needsUpdate = true;
  tex.userData.titanFoliage = true;
  return tex;
}
export function titanCanopy(width = 16, height = 10) {
  const cards = Math.min(220, Math.round(width * height * 0.65)),
    positions = [],
    normals = [],
    uvs = [],
    colors = [],
    indices = [];
  const q = new T.Quaternion(),
    up = new T.Vector3(0, 0, 1),
    p = new T.Vector3();
  for (let i = 0; i < cards; i++) {
    const a = i * 2.399963,
      y = hash(i, 3) * 1.8 - 0.85;
    const radius =
      Math.sqrt(Math.max(0.05, 1 - y * y)) * (0.42 + hash(i, 7) * 0.6);
    const center = new T.Vector3(
      Math.sin(a) * radius,
      y * 0.9,
      Math.cos(a) * radius,
    );
    const normal = new T.Vector3(
      Math.sin(a + 0.5),
      0.45 + hash(i, 5),
      Math.cos(a + 0.5),
    ).normalize();
    q.setFromUnitVectors(up, normal);
    const w = 0.32 + hash(i, 15) * 0.3,
      h = w * (0.8 + hash(i, 6) * 0.5),
      at = positions.length / 3;
    for (const [x, z, u, v] of [
      [-1, -1, 0, 0],
      [1, -1, 1, 0],
      [-1, 1, 0, 1],
      [1, 1, 1, 1],
    ]) {
      p.set(x * w, z * h, 0)
        .applyQuaternion(q)
        .add(center);
      positions.push(p.x, p.y, p.z);
      normals.push(normal.x, normal.y, normal.z);
      uvs.push(u, v);
      const shade = 0.7 + Math.max(0, center.y) * 0.28 + hash(i, 17) * 0.2;
      colors.push(shade * 0.96, shade, shade * 0.88);
    }
    indices.push(at, at + 1, at + 2, at + 2, at + 1, at + 3);
  }
  const g = new T.BufferGeometry();
  for (const [name, data, size] of [
    ["position", positions, 3],
    ["normal", normals, 3],
    ["uv", uvs, 2],
    ["color", colors, 3],
  ])
    g.setAttribute(name, new T.Float32BufferAttribute(data, size));
  g.setIndex(indices);
  g.computeBoundingSphere();
  g.userData.leafCards = cards;
  return g;
}
export function titanTreeBranches() {
  const pieces = [],
    up = new T.Vector3(0, 1, 0);
  function branch(a, b, r0, r1) {
    const d = new T.Vector3().subVectors(b, a),
      g = new T.CylinderGeometry(
        r1,
        r0,
        d.length(),
        r0 > 0.02 ? 7 : r0 > 0.004 ? 4 : 3,
        1,
        true,
      );
    g.applyQuaternion(
      new T.Quaternion().setFromUnitVectors(up, d.clone().normalize()),
    );
    g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
    pieces.push(g);
  }
  branch(new T.Vector3(0, -0.5, 0), new T.Vector3(0.02, 0.53, 0), 0.035, 0.009);
  for (let i = 0; i < 10; i++) {
    const a = i * 2.399963,
      y = -0.09 + i * 0.05,
      r = 0.12 + hash(i, 1) * 0.13;
    const start = new T.Vector3(0, y, 0),
      tip = new T.Vector3(
        Math.sin(a) * r,
        y + 0.14 + hash(i, 3) * 0.12,
        Math.cos(a) * r,
      );
    branch(start, tip, 0.009 * (1 - i / 23), 0.002);
    for (let side of [-1, 1])
      branch(
        tip.clone().lerp(start, 0.4),
        new T.Vector3(
          tip.x + Math.cos(a) * 0.055 * side,
          tip.y + 0.06,
          tip.z - Math.sin(a) * 0.055 * side,
        ),
        0.003,
        0.0008,
      );
  }
  const g = mergeGeometries(pieces);
  pieces.forEach((p) => p.dispose());
  return g;
}
