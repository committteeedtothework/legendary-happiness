import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import * as THREE from "three";
import { B, BLOCKS } from "./data.js";
import { blockArtUV } from "./block-art.js";
import { worldVisualKind } from "./world-interactions.js";
export { worldVisualKind };
export function createWorldAnimation(t, atlas) {
  const root = new THREE.Group();
  root.position.set(t.x, t.y, t.z);
  const kind = worldVisualKind(t.id);
  root.userData = { kind, descriptor: t, openness: 0 };
  const solid = (color) => new THREE.MeshLambertMaterial({ color });
  let texturedMaterial;
  const textured = (id, size) => {
    const geometry = new THREE.BoxGeometry(...size),
      uv = geometry.attributes.uv;
    for (let face = 0; face < 6; face++)
      for (let i = face * 4; i < face * 4 + 4; i++) {
        const [u, v] = blockArtUV(id, face, uv.getX(i), uv.getY(i), atlas.pack);
        uv.setXY(i, u, v);
      }
    const material = (texturedMaterial ||= new THREE.MeshLambertMaterial({
      map: atlas.texture,
      alphaTest: 0.5,
    }));
    material.userData.sharedMap = true;
    return new THREE.Mesh(geometry, material);
  };
  const box = (p, size, at, m) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), m);
    mesh.position.set(...at);
    p.add(mesh);
    return mesh;
  };
  if (kind === "chest") {
    const pivot = new THREE.Group(),
      shell = new THREE.Group();
    pivot.position.set(0.5, 0, 0.5);
    pivot.rotation.y = (-(t.facing ?? 0) * Math.PI) / 2;
    shell.position.set(-0.5, 0, -0.5);
    root.add(pivot);
    pivot.add(shell);
    root.userData.chestPivot = pivot;
    root.userData.chestShell = shell;
    const rim = solid("#5a3b25"),
      inside = solid("#352a23");
    const part = (parent, size, at, closedAt = at) => {
      const mesh = textured(B.chest, size),
        uv = mesh.geometry.attributes.uv;
      // Continuous closed-chest coordinates: body/lid each sample only their
      // own height band. Side wood has no duplicated latch/front painted on it.
      for (let face = 0; face < 6; face++)
        for (let i = face * 4; i < face * 4 + 4; i++) {
          const pos = mesh.geometry.attributes.position;
          const x = pos.getX(i) + closedAt[0],
            y = pos.getY(i) + closedAt[1],
            z = pos.getZ(i) + closedAt[2];
          const u = face < 2 ? (z - 0.0625) / 0.875 : (x - 0.0625) / 0.875;
          const v = face === 2 || face === 3 ? (z - 0.0625) / 0.875 : y / 0.875;
          const [au, av] = blockArtUV(
            B.chest,
            face === 2 ? 2 : face !== 3 && atlas.pack === "supplied" ? 0 : 3,
            Math.max(0, Math.min(1, u)),
            Math.max(0, Math.min(1, v)),
            atlas.pack,
          );
          uv.setXY(i, au, av);
        }
      mesh.position.set(...at);
      parent.add(mesh);
      return mesh;
    };
    part(shell, [0.875, 0.09, 0.875], [0.5, 0.045, 0.5]);
    for (const x of [0.105, 0.895])
      part(shell, [0.085, 0.52, 0.875], [x, 0.34, 0.5]);
    for (const z of [0.105, 0.895])
      part(shell, [0.71, 0.52, 0.085], [0.5, 0.34, z]);
    box(shell, [0.7, 0.025, 0.7], [0.5, 0.1, 0.5], inside);
    for (const z of [0.057, 0.943])
      box(shell, [0.875, 0.06, 0.025], [0.5, 0.58, z], rim);
    const hinge = new THREE.Group();
    hinge.position.set(0.5, 0.6, 0.9);
    shell.add(hinge);
    part(hinge, [0.875, 0.275, 0.875], [0, 0.1375, -0.4], [0.5, 0.7375, 0.5]);
    box(hinge, [0.12, 0.18, 0.045], [0, 0.025, -0.852], solid("#d6c17a"));
    root.userData.hinge = hinge;
  } else if (kind === "furnace") {
    const fire = new THREE.Group();
    root.add(fire);
    fire.visible = false;
    const hot = new THREE.MeshBasicMaterial({
      color: "#ffb33f",
      transparent: true,
      opacity: 0.9,
    });
    for (let i = 0; i < 3; i++)
      box(fire, [0.11, 0.19, 0.013], [0.35 + i * 0.15, 0.3, -0.01], hot);
    const sparks = new THREE.Group();
    root.add(sparks);
    for (let i = 0; i < 3; i++)
      box(
        sparks,
        [0.025, 0.025, 0.025],
        [0.3 + i * 0.2, 0.5, -0.07],
        new THREE.MeshBasicMaterial({ color: "#f5ca70" }),
      );
    root.userData.fire = fire;
    root.userData.sparks = sparks;
  } else if (kind === "enchanting_table") {
    const book = new THREE.Group();
    root.add(book);
    box(book, [0.09, 0.1, 0.4], [0, 0, 0], solid("#6e3843"));
    const pages = [];
    for (const side of [-1, 1]) {
      const page = new THREE.Group();
      book.add(page);
      box(page, [0.28, 0.045, 0.38], [side * 0.14, 0.03, 0], solid("#ede3bb"));
      box(page, [0.31, 0.026, 0.42], [side * 0.15, 0, 0], solid("#814552"));
      pages.push(page);
    }
    const leaf = new THREE.Group();
    leaf.position.set(0, 0.057, 0);
    book.add(leaf);
    box(leaf, [0.26, 0.008, 0.35], [0.13, 0, 0], solid("#fff0c9"));
    root.userData.book = book;
    root.userData.pages = pages;
    root.userData.leaf = leaf;
  } else if (kind === "jukebox") {
    const disc = new THREE.Group();
    disc.position.set(0.5, 1.025, 0.5);
    root.add(disc);
    const circle = new THREE.Mesh(
      new THREE.CylinderGeometry(0.25, 0.25, 0.025, 16),
      solid("#30333f"),
    );
    disc.add(circle);
    const label = new THREE.Mesh(
      new THREE.CylinderGeometry(0.075, 0.075, 0.029, 12),
      solid("#d5a65b"),
    );
    disc.add(label);
    box(disc, [0.025, 0.012, 0.16], [0.13, 0.02, 0], solid("#656b7e"));
    root.userData.disc = disc;
  }
  // Batch rigid chest walls; lids, flames and pages stay articulated.
  for (const parent of [
    root,
    ...(kind === "chest" ? [root.userData.chestShell] : []),
  ]) {
    const batches = new Map();
    for (const m of [...parent.children])
      if (m.isMesh) {
        if (!batches.has(m.material)) batches.set(m.material, []);
        batches.get(m.material).push(m);
      }
    for (const [material, meshes] of batches)
      if (meshes.length > 1) {
        const geometries = meshes.map((m) => {
          m.updateMatrix();
          return m.geometry.clone().applyMatrix4(m.matrix);
        });
        const geometry = mergeGeometries(geometries);
        for (const mesh of meshes) {
          mesh.geometry.dispose();
          mesh.removeFromParent();
        }
        geometries.forEach((g) => g.dispose());
        parent.add(new THREE.Mesh(geometry, material));
      }
  }
  root.traverse((m) => {
    if (m.isMesh) {
      m.castShadow = true;
      m.receiveShadow = true;
    }
  });
  return root;
}
export function disposeWorldAnimation(model) {
  const materials = new Set();
  model.traverse((m) => {
    m.geometry?.dispose();
    if (m.material) materials.add(m.material);
  });
  for (const m of materials) m.dispose();
  model.removeFromParent();
}
