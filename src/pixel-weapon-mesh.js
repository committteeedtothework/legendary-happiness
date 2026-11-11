import * as THREE from "three";
// One rigid mesh, hidden pixel side faces removed; identical palette on front,
// back and true stepped edges. 1 texel per source pixel, no mipmap/filtering.
export function pixelWeaponMesh(p) {
  const positions = [],
    uvs = [],
    normals = [],
    indices = [],
    data = new Uint8Array(p.width * p.height * 4);
  for (let y = 0; y < p.height; y++)
    for (let x = 0; x < p.width; x++) {
      const c = p.palette[p.grid[y][x]];
      if (c) {
        const n = parseInt(c.slice(1), 16),
          i = (y * p.width + x) * 4;
        data.set([n >> 16, (n >> 8) & 255, n & 255, 255], i);
      }
    }
  const map = new THREE.DataTexture(data, p.width, p.height, THREE.RGBAFormat);
  map.magFilter = map.minFilter = THREE.NearestFilter;
  map.generateMipmaps = false;
  map.colorSpace = THREE.SRGBColorSpace;
  map.flipY = true;
  map.needsUpdate = true;
  const faces = [
    [
      [0, 0, 1],
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1],
      [0, 0, 1],
    ],
    [
      [1, 0, 0],
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
      [0, 0, -1],
    ],
    [
      [0, 0, 0],
      [0, 0, 1],
      [0, 1, 1],
      [0, 1, 0],
      [-1, 0, 0],
    ],
    [
      [1, 0, 1],
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
      [1, 0, 0],
    ],
    [
      [0, 1, 1],
      [1, 1, 1],
      [1, 1, 0],
      [0, 1, 0],
      [0, 1, 0],
    ],
    [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [0, 0, 1],
      [0, -1, 0],
    ],
  ];
  const has = (x, y) => !!p.palette[p.grid[y]?.[x]];
  for (let y = 0; y < p.height; y++)
    for (let x = 0; x < p.width; x++)
      if (has(x, y))
        for (let f = 0; f < 6; f++) {
          if (
            (f === 2 && has(x - 1, y)) ||
            (f === 3 && has(x + 1, y)) ||
            (f === 4 && has(x, y - 1)) ||
            (f === 5 && has(x, y + 1))
          )
            continue;
          const start = positions.length / 3;
          for (let i = 0; i < 4; i++) {
            const [a, b, c] = faces[f][i];
            positions.push(
              (x + a - p.anchor[0]) * p.unit,
              (p.anchor[1] - y - 1 + b) * p.unit,
              (c - 0.5) * p.depth,
            );
            normals.push(...faces[f][4]);
            uvs.push((x + 0.5) / p.width, 1 - (y + 0.5) / p.height);
          }
          indices.push(
            start,
            start + 1,
            start + 2,
            start,
            start + 2,
            start + 3,
          );
        }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  g.setIndex(indices);
  g.computeBoundingBox();
  const m = new THREE.Mesh(
    g,
    new THREE.MeshLambertMaterial({ map, alphaTest: 0.5 }),
  );
  m.castShadow = m.receiveShadow = true;
  return m;
}
export function pixelRootData(p) {
  return {
    kind: p.kind,
    item: p.id,
    weaponModel: p.id,
    pixelProfile: true,
    gripOrigin: [0, 0, 0],
    pixelSize: p.unit,
    sourcePixels: [p.width, p.height],
    centerToGrip: [
      (p.anchor[0] - p.width / 2) * p.unit,
      (p.height / 2 - p.anchor[1]) * p.unit,
      0,
    ],
  };
}
