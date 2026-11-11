import * as T from "three";
const CELL = 4;
const key = (x, y, z) => `${x},${y},${z}`;
let activeSurface = null;
export function installTitanClimbSurface(surface) {
  activeSurface = surface;
}
export const getTitanClimbSurface = () => activeSurface;
const a = new T.Vector3(),
  b = new T.Vector3(),
  c = new T.Vector3(),
  query = new T.Vector3(),
  hit = new T.Vector3(),
  normal = new T.Vector3(),
  tri = new T.Triangle();
export function createTitanClimbSurface(vertices) {
  const data =
      vertices instanceof Float32Array ? vertices : new Float32Array(vertices),
    cells = new Map(),
    normals = new Float32Array(data.length / 3);
  for (let n = 0; n < data.length; n += 9) {
    a.fromArray(data, n);
    b.fromArray(data, n + 3);
    c.fromArray(data, n + 6);
    tri.set(a, b, c);
    tri.getNormal(normal);
    normal.toArray(normals, n / 3);
    const min = [
        Math.floor(Math.min(a.x, b.x, c.x) / CELL),
        Math.floor(Math.min(a.y, b.y, c.y) / CELL),
        Math.floor(Math.min(a.z, b.z, c.z) / CELL),
      ],
      max = [
        Math.floor(Math.max(a.x, b.x, c.x) / CELL),
        Math.floor(Math.max(a.y, b.y, c.y) / CELL),
        Math.floor(Math.max(a.z, b.z, c.z) / CELL),
      ];
    for (let x = min[0]; x <= max[0]; x++)
      for (let y = min[1]; y <= max[1]; y++)
        for (let z = min[2]; z <= max[2]; z++) {
          const k = key(x, y, z);
          if (!cells.has(k)) cells.set(k, []);
          cells.get(k).push(n / 9);
        }
  }
  return { data, normals, cells, triangles: data.length / 9 };
}
export function extractTitanClimbSurface(root, sample = null) {
  root.updateMatrixWorld(true);
  const out = [],
    bindings = [],
    p = new T.Vector3(),
    q = new T.Vector3(),
    r = new T.Vector3();
  root.traverse((o) => {
    if (!o.isMesh || o.name.startsWith("dorsal_")) return;
    const g = o.geometry,
      idx = g.index,
      pos = g.attributes.position;
    if (o.isSkinnedMesh) o.skeleton.update();
    const vertex = (i, v) => {
      v.fromBufferAttribute(pos, i);
      if (o.isSkinnedMesh) o.applyBoneTransform(i, v);
      return v.applyMatrix4(o.matrixWorld);
    };
    const binding = {
      mesh: o,
      ids: [],
      offset: out.length,
      positions: new Float32Array(pos.count * 3),
    };
    for (let j = 0; j < (idx ? idx.count : pos.count); j += 3) {
      const ids = [0, 1, 2].map((k) => (idx ? idx.getX(j + k) : j + k));
      vertex(ids[0], p);
      vertex(ids[1], q);
      vertex(ids[2], r);
      tri.set(p, q, r);
      if (tri.getArea() < 0.00001) continue;
      tri.getNormal(normal);
      if (o.matrixWorld.determinant() < 0) {
        const t = q.clone();
        q.copy(r);
        r.copy(t);
        [ids[1], ids[2]] = [ids[2], ids[1]];
      }
      binding.ids.push(...ids);
      out.push(...p.toArray(), ...q.toArray(), ...r.toArray());
    }
    bindings.push(binding);
  });
  const surface = createTitanClimbSurface(out);
  if (sample) makeDeformingSurface(surface, root, bindings, sample);
  return surface;
}
export function nearestArmorPoint(
  p,
  radius = 3,
  options = {},
  surface = activeSurface,
) {
  if (!surface) return null;
  query.set(p.x, p.y, p.z);
  const seen = new Set();
  let best = null,
    score = Infinity;
  const lo = [p.x - radius, p.y - radius, p.z - radius].map((v) =>
      Math.floor(v / CELL),
    ),
    hi = [p.x + radius, p.y + radius, p.z + radius].map((v) =>
      Math.floor(v / CELL),
    );
  for (let x = lo[0]; x <= hi[0]; x++)
    for (let y = lo[1]; y <= hi[1]; y++)
      for (let z = lo[2]; z <= hi[2]; z++)
        for (const id of candidates(surface, x, y, z)) {
          if (seen.has(id)) continue;
          seen.add(id);
          normal.fromArray(surface.normals, id * 3);
          if (options.normal && normal.dot(options.normal) < -0.15) continue;
          const off = id * 9;
          a.fromArray(surface.data, off);
          b.fromArray(surface.data, off + 3);
          c.fromArray(surface.data, off + 6);
          tri.set(a, b, c).closestPointToPoint(query, hit);
          const d = hit.distanceTo(query);
          if (d > radius) continue;
          if (
            options.from &&
            hit.distanceTo(options.from) > (options.step || 0) + 0.75
          )
            continue;
          const value =
            d * d - (options.upward && d < 0.25 ? normal.y * 0.008 : 0);
          if (value < score) {
            score = value;
            best = {
              point: { x: hit.x, y: hit.y, z: hit.z },
              normal: { x: normal.x, y: normal.y, z: normal.z },
              triangle: id,
              distance: d,
              barycentric: barycentric(hit, a, b, c),
            };
          }
        }
  return best;
}
export function armorSurfaceStep(
  contact,
  delta,
  surface = activeSurface,
  corner = false,
) {
  if (!surface) return null;
  let result = contact;
  const total = Math.hypot(delta.x, delta.y, delta.z),
    parts = Math.max(1, Math.ceil(total / 0.28));
  if (total < 1e-8) return { ...contact };
  let direction = new T.Vector3(delta.x, delta.y, delta.z).normalize();
  const rotation = new T.Quaternion();
  for (let part = 0; part < parts; part++) {
    const p = new T.Vector3(result.point.x, result.point.y, result.point.z),
      old = new T.Vector3(result.normal.x, result.normal.y, result.normal.z),
      step = total / parts,
      seen = new Set();
    let picked = null,
      score = Infinity;
    const lo = [p.x - 0.8, p.y - 0.8, p.z - 0.8].map((v) =>
        Math.floor(v / CELL),
      ),
      hi = [p.x + 0.8, p.y + 0.8, p.z + 0.8].map((v) => Math.floor(v / CELL));
    for (let x = lo[0]; x <= hi[0]; x++)
      for (let y = lo[1]; y <= hi[1]; y++)
        for (let z = lo[2]; z <= hi[2]; z++)
          for (const id of candidates(surface, x, y, z)) {
            if (seen.has(id)) continue;
            seen.add(id);
            const n = new T.Vector3().fromArray(surface.normals, id * 3),
              dot = old.dot(n);
            if (dot < (corner ? -0.85 : -0.1)) continue;
            rotation.setFromUnitVectors(old, n);
            const dir = direction.clone().applyQuaternion(rotation).normalize(),
              target = p.clone().addScaledVector(dir, step),
              off = id * 9;
            a.fromArray(surface.data, off);
            b.fromArray(surface.data, off + 3);
            c.fromArray(surface.data, off + 6);
            tri.set(a, b, c).closestPointToPoint(target, hit);
            const move = hit.clone().sub(p),
              distance = move.length(),
              progress = move.dot(dir);
            if (distance > step + 0.3 || progress < step * 0.15) continue;
            const value =
              hit.distanceToSquared(target) +
              (1 - dot) * 0.006 +
              Math.max(0, step - distance) ** 2;
            if (value < score) {
              score = value;
              picked = {
                point: { x: hit.x, y: hit.y, z: hit.z },
                normal: { x: n.x, y: n.y, z: n.z },
                triangle: id,
                distance: 0,
                barycentric: barycentric(hit, a, b, c),
                dir,
              };
            }
          }
    if (!picked) break;
    direction = picked.dir;
    delete picked.dir;
    result = picked;
  }
  return result;
}

export function raycastArmor(from, to, surface = activeSurface) {
  if (!surface) return null;
  const origin = new T.Vector3(from.x, from.y, from.z),
    dir = new T.Vector3(to.x - from.x, to.y - from.y, to.z - from.z),
    limit = dir.length();
  if (limit < 0.001) return null;
  dir.divideScalar(limit);
  const ray = new T.Ray(origin, dir),
    cell = [from.x, from.y, from.z].map((v) => Math.floor(v / CELL)),
    end = [to.x, to.y, to.z].map((v) => Math.floor(v / CELL)),
    sign = [dir.x, dir.y, dir.z].map(Math.sign),
    delta = [dir.x, dir.y, dir.z].map((v) =>
      v ? CELL / Math.abs(v) : Infinity,
    ),
    max = [0, 1, 2].map((k) =>
      sign[k]
        ? ((cell[k] + (sign[k] > 0 ? 1 : 0)) * CELL - origin.getComponent(k)) /
          dir.getComponent(k)
        : Infinity,
    ),
    seen = new Set();
  let best = null;
  for (let count = 0; count < 256; count++) {
    for (const id of candidates(surface, ...cell)) {
      if (seen.has(id)) continue;
      seen.add(id);
      const off = id * 9;
      a.fromArray(surface.data, off);
      b.fromArray(surface.data, off + 3);
      c.fromArray(surface.data, off + 6);
      const p = ray.intersectTriangle(a, b, c, false, new T.Vector3());
      if (!p) continue;
      const distance = p.distanceTo(origin);
      if (
        distance > 0.2 &&
        distance <= limit &&
        (!best || distance < best.distance)
      )
        best = { point: { x: p.x, y: p.y, z: p.z }, distance };
    }
    if (cell.every((v, k) => v === end[k])) break;
    let axis = 0;
    if (max[1] < max[axis]) axis = 1;
    if (max[2] < max[axis]) axis = 2;
    if (max[axis] > limit || !Number.isFinite(max[axis])) break;
    cell[axis] += sign[axis];
    max[axis] += delta[axis];
  }
  return best;
}

// Barycentric anchors remain on the same triangle as every contributing skin
// joint moves. No projection onto an old bind-pose shell, no renderer feedback.
function barycentric(p, a, b, c) {
  const v = T.Triangle.getBarycoord(p, a, b, c, new T.Vector3());
  return v ? { x: v.x, y: v.y, z: v.z } : null;
}
export function armorContactAt(anchor, surface = activeSurface) {
  const w = anchor?.barycentric,
    id = anchor?.triangle;
  if (
    !surface ||
    !Number.isInteger(id) ||
    id < 0 ||
    id >= surface.triangles ||
    !w ||
    ![w.x, w.y, w.z].every(
      (v) => Number.isFinite(v) && v >= -0.001 && v <= 1.001,
    ) ||
    Math.abs(w.x + w.y + w.z - 1) > 0.001
  )
    return null;
  const n = id * 9,
    d = surface.data;
  return {
    triangle: id,
    barycentric: { ...w },
    distance: 0,
    point: {
      x: d[n] * w.x + d[n + 3] * w.y + d[n + 6] * w.z,
      y: d[n + 1] * w.x + d[n + 4] * w.y + d[n + 7] * w.z,
      z: d[n + 2] * w.x + d[n + 5] * w.y + d[n + 8] * w.z,
    },
    normal: {
      x: surface.normals[id * 3],
      y: surface.normals[id * 3 + 1],
      z: surface.normals[id * 3 + 2],
    },
  };
}
export function updateTitanClimbSurface(clock, surface = activeSurface) {
  surface?.update?.(clock);
  return surface;
}
function candidates(surface, x, y, z) {
  if (!surface.tree) return surface.cells.get(key(x, y, z)) || [];
  const out = [],
    lo = [x * CELL, y * CELL, z * CELL],
    hi = lo.map((v) => v + CELL);
  const visit = (node) => {
    if (node.lo.some((v, k) => v > hi[k] || node.hi[k] < lo[k])) return;
    if (node.ids) out.push(...node.ids);
    else {
      visit(node.left);
      visit(node.right);
    }
  };
  visit(surface.tree);
  return out;
}
function makeDeformingSurface(surface, root, bindings, sample) {
  const d = surface.data;
  const bounds = new Float32Array(surface.triangles * 6);
  const refresh = () => {
    for (let id = 0; id < surface.triangles; id++) {
      const off = id * 9,
        k = id * 6;
      for (let axis = 0; axis < 3; axis++) {
        bounds[k + axis] = Math.min(
          d[off + axis],
          d[off + axis + 3],
          d[off + axis + 6],
        );
        bounds[k + axis + 3] = Math.max(
          d[off + axis],
          d[off + axis + 3],
          d[off + axis + 6],
        );
      }
      const ax = d[off + 6] - d[off + 3],
        ay = d[off + 7] - d[off + 4],
        az = d[off + 8] - d[off + 5],
        bx = d[off] - d[off + 3],
        by = d[off + 1] - d[off + 4],
        bz = d[off + 2] - d[off + 5],
        nx = ay * bz - az * by,
        ny = az * bx - ax * bz,
        nz = ax * by - ay * bx,
        inv = 1 / (Math.hypot(nx, ny, nz) || 1);
      surface.normals[id * 3] = nx * inv;
      surface.normals[id * 3 + 1] = ny * inv;
      surface.normals[id * 3 + 2] = nz * inv;
    }
  };
  refresh();
  const refit = (node) => {
    node.lo.fill(Infinity);
    node.hi.fill(-Infinity);
    if (node.ids) {
      for (const id of node.ids)
        for (let k = 0; k < 3; k++) {
          node.lo[k] = Math.min(node.lo[k], bounds[id * 6 + k]);
          node.hi[k] = Math.max(node.hi[k], bounds[id * 6 + k + 3]);
        }
    } else {
      refit(node.left);
      refit(node.right);
      for (let k = 0; k < 3; k++) {
        node.lo[k] = Math.min(node.left.lo[k], node.right.lo[k]);
        node.hi[k] = Math.max(node.left.hi[k], node.right.hi[k]);
      }
    }
  };
  const build = (ids) => {
    const node = {
      lo: [Infinity, Infinity, Infinity],
      hi: [-Infinity, -Infinity, -Infinity],
    };
    for (const id of ids)
      for (let k = 0; k < 3; k++) {
        node.lo[k] = Math.min(node.lo[k], bounds[id * 6 + k]);
        node.hi[k] = Math.max(node.hi[k], bounds[id * 6 + k + 3]);
      }
    if (ids.length <= 12) node.ids = ids;
    else {
      let axis = 0;
      for (let k = 1; k < 3; k++)
        if (node.hi[k] - node.lo[k] > node.hi[axis] - node.lo[axis]) axis = k;
      ids.sort(
        (i, j) =>
          bounds[i * 6 + axis] +
          bounds[i * 6 + axis + 3] -
          bounds[j * 6 + axis] -
          bounds[j * 6 + axis + 3],
      );
      const half = ids.length >> 1;
      node.left = build(ids.slice(0, half));
      node.right = build(ids.slice(half));
    }
    return node;
  };
  surface.tree = build(Array.from({ length: surface.triangles }, (_, i) => i));
  surface.deforming = true;
  const rigMeshes = new WeakMap();
  surface.contactOnRig = (anchor, target) => {
    const id = anchor.triangle,
      w = anchor.barycentric;
    if (!Number.isInteger(id) || !w) return null;
    const binding = bindings.find(
      (v) => id * 9 >= v.offset && id * 9 < v.offset + v.ids.length * 3,
    );
    if (!binding) return null;
    let cache = rigMeshes.get(target);
    if (!cache) {
      cache = new Map();
      target.traverse((m) => {
        if (m.isMesh) cache.set(m.geometry, m);
      });
      rigMeshes.set(target, cache);
    }
    const mesh = cache.get(binding.mesh.geometry);
    if (!mesh) return null;
    const first = (id * 9 - binding.offset) / 3;
    const points = [a, b, c];
    for (let k = 0; k < 3; k++) {
      const i = binding.ids[first + k],
        v = points[k];
      v.fromBufferAttribute(mesh.geometry.attributes.position, i);
      if (mesh.isSkinnedMesh) mesh.applyBoneTransform(i, v);
      v.applyMatrix4(mesh.matrixWorld);
    }
    tri.set(a, b, c).getNormal(normal);
    return {
      point: {
        x: a.x * w.x + b.x * w.y + c.x * w.z,
        y: a.y * w.x + b.y * w.y + c.y * w.z,
        z: a.z * w.x + b.z * w.y + c.z * w.z,
      },
      normal: { x: normal.x, y: normal.y, z: normal.z },
    };
  };
  const v = new T.Vector3(),
    prefix = new T.Matrix4(),
    joint = new T.Matrix4();
  // Bake bind-space vertices and four influences once. Bulk linear skinning
  // avoids per-vertex Matrix4 reconstruction and matches Three's shader math.
  for (const binding of bindings) {
    const o = binding.mesh,
      pos = o.geometry.attributes.position;
    if (!o.isSkinnedMesh) continue;
    binding.bind = new Float64Array(pos.count * 3);
    binding.joints = new Uint16Array(pos.count * 4);
    binding.weights = new Float32Array(pos.count * 4);
    binding.matrices = new Float64Array(o.skeleton.bones.length * 16);
    const si = o.geometry.attributes.skinIndex,
      sw = o.geometry.attributes.skinWeight;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i)
        .applyMatrix4(o.bindMatrix)
        .toArray(binding.bind, i * 3);
      for (let k = 0; k < 4; k++) {
        binding.joints[i * 4 + k] = si.getComponent(i, k);
        binding.weights[i * 4 + k] = sw.getComponent(i, k);
      }
    }
  }
  surface.update = (clock) => {
    if (!Number.isFinite(clock) || surface.clock === clock) return;
    sample(clock);
    root.updateMatrixWorld(true);
    for (const binding of bindings) {
      const o = binding.mesh,
        pos = o.geometry.attributes.position,
        values = binding.positions;
      if (o.isSkinnedMesh) {
        o.skeleton.update();
        prefix.multiplyMatrices(o.matrixWorld, o.bindMatrixInverse);
        const matrices = binding.matrices,
          boneMatrices = o.skeleton.boneMatrices;
        for (let j = 0; j < o.skeleton.bones.length; j++) {
          joint
            .fromArray(boneMatrices, j * 16)
            .premultiply(prefix)
            .toArray(matrices, j * 16);
        }
        const src = binding.bind,
          weights = binding.weights,
          joints = binding.joints;
        for (let i = 0; i < pos.count; i++) {
          const k = i * 3,
            x = src[k],
            y = src[k + 1],
            z = src[k + 2];
          let px = 0,
            py = 0,
            pz = 0;
          for (let slot = 0; slot < 4; slot++) {
            const w = weights[i * 4 + slot];
            if (!w) continue;
            const m = joints[i * 4 + slot] * 16;
            px +=
              (matrices[m] * x +
                matrices[m + 4] * y +
                matrices[m + 8] * z +
                matrices[m + 12]) *
              w;
            py +=
              (matrices[m + 1] * x +
                matrices[m + 5] * y +
                matrices[m + 9] * z +
                matrices[m + 13]) *
              w;
            pz +=
              (matrices[m + 2] * x +
                matrices[m + 6] * y +
                matrices[m + 10] * z +
                matrices[m + 14]) *
              w;
          }
          values[k] = px;
          values[k + 1] = py;
          values[k + 2] = pz;
        }
      } else
        for (let i = 0; i < pos.count; i++) {
          v.fromBufferAttribute(pos, i)
            .applyMatrix4(o.matrixWorld)
            .toArray(values, i * 3);
        }
      let off = binding.offset;
      for (const id of binding.ids) {
        const k = id * 3;
        d[off++] = values[k];
        d[off++] = values[k + 1];
        d[off++] = values[k + 2];
      }
    }
    refresh();
    refit(surface.tree);
    for (const q of surface.guide || []) {
      const moved = armorContactAt(q, surface);
      if (moved) Object.assign(q, moved);
    }
    surface.clock = clock;
  };
}
