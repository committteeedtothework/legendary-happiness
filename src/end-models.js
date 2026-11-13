import * as T from "three";
export function buildEndModel(entity, { g, head, box, limb, material }) {
  const dark = material("#211d29"),
    edge = material("#42364c"),
    eye = material("#df83f7");
  eye.emissive?.set("#9923bd");
  eye.emissiveIntensity = 0.8;
  if (entity.type === "enderman") {
    box(g, 0.43, 1.02, 0.3, 0, 1.66, 0, dark);
    head.position.set(0, 2.58, 0);
    box(head, 0.56, 0.5, 0.51, 0, 0.05, 0, dark);
    for (const x of [-0.15, 0.15]) {
      box(head, 0.2, 0.06, 0.025, x, 0.04, -0.265, eye);
      box(head, 0.05, 0.065, 0.03, x, 0.04, -0.28, material("#fff2ff"));
    }
    g.userData.legs = [
      limb(0.13, 1.3, 0.14, -0.15, 1.3, 0, dark),
      limb(0.13, 1.3, 0.14, 0.15, 1.3, 0, dark),
    ];
    g.userData.arms = [
      limb(0.12, 1.35, 0.13, -0.35, 2.18, 0, dark),
      limb(0.12, 1.35, 0.13, 0.35, 2.18, 0, dark),
    ];
    g.userData.endKind = "enderman";
    return true;
  }
  if (entity.type === "end_crystal") {
    const glass = new T.MeshBasicMaterial({
      color: "#f0b7f4",
      wireframe: true,
      transparent: true,
      opacity: 0.75,
    });
    const cage = new T.Mesh(new T.BoxGeometry(1.5, 1.5, 1.5), glass);
    cage.position.y = 1;
    g.add(cage);
    const core = new T.Mesh(
      new T.OctahedronGeometry(0.43),
      new T.MeshStandardMaterial({
        color: "#f5a3eb",
        emissive: "#d826af",
        emissiveIntensity: 2,
      }),
    );
    core.position.y = 1;
    g.add(core);
    g.userData.endKind = "crystal";
    g.userData.cage = cage;
    g.userData.core = core;
    box(g, 1.5, 0.15, 1.5, 0, 0.07, 0, edge);
    return true;
  }
  if (entity.type !== "dragoon") return false;
  g.userData.endKind = "dragoon";
  box(g, 4.8, 4.2, 9, 0, 2.6, 0, dark);
  box(g, 2.4, 0.3, 7, 0, 4.85, 0, edge);
  const necks = [];
  let root = g;
  for (let i = 0; i < 4; i++) {
    const n = new T.Group();
    n.position.set(0, i === 0 ? 3.4 : 0, i === 0 ? -4.3 : -1.7);
    root.add(n);
    box(n, 1.6, 1.6, 2.1, 0, 0, -0.7, dark);
    box(n, 0.45, 0.5, 0.4, 0, 1, -0.9, edge);
    necks.push(n);
    root = n;
  }
  head.removeFromParent();
  root.add(head);
  head.position.set(0, 0, -2);
  box(head, 2.6, 2, 3, 0, 0.25, -0.8, dark);
  box(head, 2.5, 0.7, 2.8, 0, -0.75, -0.9, edge);
  for (const x of [-1.1, 1.1]) {
    box(head, 0.4, 0.28, 0.08, x, 0.7, -2.35, eye);
    box(head, 0.25, 0.8, 0.3, x, 1.65, 0, edge);
  }
  const jaw = new T.Group();
  jaw.position.set(0, -0.65, -0.2);
  head.add(jaw);
  box(jaw, 2.35, 0.28, 2.8, 0, -0.32, -1, dark);
  const wings = [];
  for (const sign of [-1, 1]) {
    const wing = new T.Group();
    wing.position.set(sign * 2, 3.7, -2);
    g.add(wing);
    box(wing, 10, 0.35, 0.4, sign * 4.5, 0, 0, edge);
    box(wing, 0.35, 0.35, 8, sign * 8.7, 0, 3.5, edge);
    const positions = new Float32Array([
      0,
      0,
      0,
      sign * 9,
      0,
      0,
      sign * 8.5,
      0,
      8,
      0,
      0,
      0,
      sign * 8.5,
      0,
      8,
      sign * 1.5,
      0,
      5,
    ]);
    const geo = new T.BufferGeometry();
    geo.setAttribute("position", new T.BufferAttribute(positions, 3));
    geo.computeVertexNormals();
    const membrane = new T.Mesh(
      geo,
      new T.MeshLambertMaterial({ color: "#3c284b", side: T.DoubleSide }),
    );
    wing.add(membrane);
    for (let i = 1; i <= 3; i++)
      box(wing, 0.18, 0.12, 5 + i * 0.7, sign * i * 2, 0, 2.7, edge);
    wings.push(wing);
  }
  const tail = [];
  root = g;
  for (let i = 0; i < 8; i++) {
    const n = new T.Group();
    n.position.set(0, i ? 0 : 2.8, i ? 1.5 : 4.4);
    root.add(n);
    const size = 1.8 - i * 0.15;
    box(n, size, size, 1.9, 0, 0, 0.6, dark);
    box(n, 0.35, 0.5, 0.35, 0, size * 0.55, 0.5, edge);
    tail.push(n);
    root = n;
  }
  const legs = [];
  for (const x of [-1.8, 1.8])
    for (const z of [-2.5, 2.8]) {
      const n = new T.Group();
      n.position.set(x, 1.5, z);
      g.add(n);
      box(n, 0.8, 1.9, 0.9, 0, -0.7, 0.3, dark);
      box(n, 1.2, 0.5, 1.8, 0, -1.5, -0.1, edge);
      legs.push(n);
    }
  Object.assign(g.userData, {
    endWings: wings,
    endTail: tail,
    endNeck: necks,
    endJaw: jaw,
    endLegs: legs,
  });
  return true;
}
export function animateEndModel(m, e, time, dt, enabled = true) {
  const u = m.userData;
  if (!u.endKind) return;
  u.endClock ??= (e.age || 0) / 20;
  if (enabled)
    u.endClock +=
      ((e.age || 0) / 20 - u.endClock) * (1 - Math.exp(-Math.max(0, dt) * 18));
  time = u.endClock;
  if (u.endKind === "crystal") {
    u.cage.rotation.set(time * 0.7, time * 0.6, time * 0.45);
    u.core.rotation.set(time * 0.9, -time * 0.6, time);
    u.core.position.y = 1 + Math.sin(time * 2) * 0.13;
    return;
  }
  if (u.endKind === "enderman") {
    if (e.angry > 0) {
      u.head.position.y = 2.63 + Math.sin(time * 24) * 0.03;
      u.arms?.forEach(
        (a, i) => (a.rotation.x = -0.6 + Math.sin(time * 6 + i) * 0.2),
      );
    }
    return;
  }
  const flap = enabled ? Math.sin(time * (e.mode === "perch" ? 2 : 4.6)) : 0,
    perch = e.mode === "perch" || e.mode === "approach";
  u.endWings.forEach(
    (w, i) => (w.rotation.z = (i ? 1 : -1) * (0.12 + flap * 0.65)),
  );
  u.endTail.forEach((n, i) => {
    n.rotation.y = Math.sin(time * 1.7 - i * 0.45) * 0.13;
    n.rotation.x = Math.sin(time * 1.2 - i * 0.35) * 0.035;
  });
  u.endNeck.forEach((n, i) => {
    n.rotation.y = Math.sin(time * 1.3 - i * 0.5) * 0.055;
    n.rotation.x = perch ? -0.18 : -0.025;
  });
  u.endJaw.rotation.x =
    e.mode === "perch" ? 0.2 + Math.sin(time * 3) * 0.15 : 0.04;
  u.endLegs.forEach(
    (n, i) => (n.rotation.x = perch ? 0 : 0.45 + Math.sin(time * 2 + i) * 0.08),
  );
  m.rotation.z = e.dying
    ? Math.sin(time * 3) * 0.08
    : e.mode === "charge"
      ? Math.sin(time) * 0.1
      : Math.sin(time * 0.7) * 0.025;
}
