import * as THREE from "three";
import { STANDS } from "./stands-data.js";
function part(parent, blocks) {
  const positions = [],
    colors = [];
  for (const [x, y, z, w, h, d, color] of blocks) {
    const geo = new THREE.BoxGeometry(w, h, d).toNonIndexed();
    geo.translate(x, y, z);
    const a = geo.attributes.position.array,
      c = new THREE.Color(color);
    positions.push(...a);
    for (let i = 0; i < a.length; i += 3) colors.push(c.r, c.g, c.b);
    geo.dispose();
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(
    g,
    new THREE.MeshLambertMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      depthWrite: true,
    }),
  );
  parent.add(m);
  return m;
}
export function createDinosaurModel() {
  const root = new THREE.Group(),
    head = new THREE.Group(),
    tail = new THREE.Group(),
    legs = [];
  part(root, [
    [0, 0.65, 0, 0.65, 0.55, 0.9, "#43828b"],
    [0, 0.5, -0.28, 0.42, 0.3, 0.4, "#c1c291"],
    [-0.35, 0.72, -0.28, 0.12, 0.22, 0.12, "#d9cf99"],
    [0.35, 0.72, -0.28, 0.12, 0.22, 0.12, "#d9cf99"],
  ]);
  head.position.set(0, 0.92, -0.44);
  root.add(head);
  part(head, [
    [0, 0, -0.06, 0.4, 0.34, 0.48, "#58a2a6"],
    [0, -0.1, -0.32, 0.42, 0.16, 0.22, "#d9cf99"],
    [-0.205, 0.07, -0.14, 0.025, 0.08, 0.1, "#171e2d"],
    [0.205, 0.07, -0.14, 0.025, 0.08, 0.1, "#171e2d"],
  ]);
  tail.position.set(0, 0.72, 0.39);
  root.add(tail);
  part(tail, [
    [0, 0, 0.22, 0.3, 0.26, 0.5, "#43828b"],
    [0, 0.05, 0.52, 0.17, 0.17, 0.25, "#d3b868"],
  ]);
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(side * 0.25, 0.48, 0.1);
    root.add(leg);
    part(leg, [
      [0, -0.15, 0, 0.18, 0.3, 0.24, "#356773"],
      [0, -0.38, -0.09, 0.2, 0.17, 0.4, "#d9cf99"],
    ]);
    legs.push(leg);
  }
  root.userData = { dinosaur: true, head, tail, legs };
  root.traverse((o) => {
    if (o.material) {
      o.material.opacity = 1;
      o.material.transparent = false;
    }
  });
  return root;
}
export function createStandModel(id) {
  const def = STANDS[id];
  if (!def) return null;
  if (id === "monsters") {
    const m = createDinosaurModel();
    m.traverse((o) => {
      if (o.material) {
        o.material.opacity = 0.85;
        o.material.transparent = true;
      }
    });
    m.scale.setScalar(0.9);
    m.userData.standId = id;
    return m;
  }
  const root = new THREE.Group(),
    arms = [],
    head = new THREE.Group();
  root.add(head);
  head.position.y = 1.35;
  const c = def.color,
    a = def.accent;
  if (id === "cream") {
    part(root, [
      [0, 0.65, 0, 0.35, 0.6, 0.3, c],
      [0, 0.97, 0, 0.43, 0.12, 0.34, a],
      [0.15, 1.09, 0, 0.28, 0.12, 0.16, "#837562"],
      [0.33, 1.09, 0, 0.1, 0.1, 0.13, a],
    ]);
    part(head, [
      [0, -0.18, 0, 0.27, 0.18, 0.28, c],
      [-0.08, -0.15, -0.15, 0.045, 0.045, 0.03, "#251d35"],
      [0.08, -0.15, -0.15, 0.045, 0.045, 0.03, "#251d35"],
    ]);
  } else {
    part(root, [
      [0, 0.84, 0, 0.5, 0.6, 0.29, c],
      [0, 0.57, 0, 0.46, 0.13, 0.33, a],
      [0, 0.99, -0.16, 0.24, 0.23, 0.04, a],
    ]);
    const skull = id === "tusk" ? 0.39 : 0.43;
    const blocks = [
      [0, 0, 0, skull, 0.4, 0.35, c],
      [-0.1, 0.03, -0.19, 0.075, 0.07, 0.04, "#241a37"],
      [0.1, 0.03, -0.19, 0.075, 0.07, 0.04, "#241a37"],
      [0, -0.1, -0.2, 0.11, 0.035, 0.035, a],
    ];
    if (id === "d4c")
      blocks.push(
        [-0.15, 0.38, 0, 0.12, 0.55, 0.15, c],
        [0.15, 0.38, 0, 0.12, 0.55, 0.15, c],
        [-0.15, 0.38, -0.085, 0.05, 0.34, 0.025, a],
        [0.15, 0.38, -0.085, 0.05, 0.34, 0.025, a],
      );
    if (id === "tusk")
      blocks.push(
        [-0.24, 0.07, 0, 0.12, 0.28, 0.23, a],
        [0.24, 0.07, 0, 0.12, 0.28, 0.23, a],
        [0, 0.26, 0, 0.25, 0.12, 0.25, a],
      );
    if (id === "lonesome")
      blocks.push(
        [0, 0.23, 0, 0.64, 0.09, 0.45, "#684d35"],
        [0, 0.34, 0, 0.4, 0.17, 0.3, c],
      );
    part(head, blocks);
    for (const side of [-1, 1]) {
      const arm = new THREE.Group();
      arm.position.set(side * 0.36, 1.08, 0);
      root.add(arm);
      part(arm, [
        [0, -0.18, 0, 0.19, 0.42, 0.22, c],
        [0, -0.43, -0.015, 0.2, 0.16, 0.23, a],
        [0, -0.12, 0, 0.22, 0.09, 0.25, a],
      ]);
      arms.push(arm);
      part(root, [
        [side * 0.15, 0.3, 0, 0.19, 0.48, 0.23, c],
        [side * 0.15, 0.07, -0.055, 0.22, 0.12, 0.34, a],
      ]);
    }
  }
  root.userData = { standId: id, arms, head };
  return root;
}
export function animateStandModel(model, time, kick = 0) {
  const u = model.userData;
  if (u.dinosaur) {
    u.tail.rotation.y = Math.sin(time * 2) * 0.13;
    u.head.rotation.x = Math.sin(time * 1.7) * 0.04;
    u.legs.forEach(
      (l, i) => (l.rotation.x = Math.sin(time * 4 + i * Math.PI) * kick * 0.5),
    );
  } else {
    u.head.rotation.y = Math.sin(time * 0.8) * 0.12;
    u.arms.forEach((a, i) => {
      a.rotation.x =
        -0.1 - Math.sin(time * 1.6 + i) * 0.07 - kick * (i === 1 ? 1.3 : 0.4);
      a.rotation.z = (i ? -0.08 : 0.08) + Math.sin(time) * 0.025;
    });
  }
}
export function createCorpseModel() {
  const root = new THREE.Group();
  part(root, [
    [0, 0.09, 0, 0.055, 0.19, 0.055, "#e4dfc4"],
    [-0.035, 0.19, 0, 0.065, 0.06, 0.065, "#f6efcf"],
    [0.035, 0.19, 0, 0.065, 0.06, 0.065, "#f6efcf"],
    [-0.035, -0.01, 0, 0.065, 0.06, 0.065, "#dbd2ae"],
    [0.035, -0.01, 0, 0.065, 0.06, 0.065, "#dbd2ae"],
    [0, 0.09, 0, 0.09, 0.035, 0.09, "#c9a04c"],
    [0, 0.09, -0.052, 0.025, 0.025, 0.015, "#74c3c9"],
  ]);
  root.traverse((o) => {
    if (o.material) {
      o.material.opacity = 1;
      o.material.transparent = false;
    }
  });
  root.userData = { kind: "artifact", artifactModel: "saint_corpse_part" };
  return root;
}
