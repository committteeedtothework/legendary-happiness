import * as T from "three";
import { makeChaosEmerald, sonicSuper } from "./titan-transformation.js";
import { sonicLength } from "./titan-metrics.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
const texCache = new Map();
function pixelTexture(base, accent) {
  const key = base + accent;
  if (texCache.has(key)) return texCache.get(key);
  const data = new Uint8Array(16 * 16 * 4),
    a = new T.Color(base),
    b = new T.Color(accent);
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const c = (x * 3 + y * 5) % 19 < 3 ? b : a;
      let n = (y * 16 + x) * 4;
      data.set(
        [
          Math.round(c.r * 255),
          Math.round(c.g * 255),
          Math.round(c.b * 255),
          255,
        ],
        n,
      );
    }
  const t = new T.DataTexture(data, 16, 16, T.RGBAFormat);
  t.magFilter = t.minFilter = T.NearestFilter;
  t.generateMipmaps = false;
  t.colorSpace = T.LinearSRGBColorSpace;
  t.needsUpdate = true;
  texCache.set(key, t);
  return t;
}
function material(color, accent = color, metal = 0, glow = 0) {
  return new T.MeshStandardMaterial({
    color: "#ffffff",
    map: pixelTexture(color, accent),
    metalness: metal,
    roughness: 0.65,
    flatShading: true,
    emissive: new T.Color(color),
    emissiveIntensity: glow,
  });
}
function mesh(parent, geo, mat, pos = [0, 0, 0], scale = [1, 1, 1]) {
  const m = new T.Mesh(geo, mat);
  m.position.set(...pos);
  m.scale.set(...scale);
  m.castShadow = m.receiveShadow = true;
  parent.add(m);
  return m;
}
const ball = (p, m, pos, scale) =>
    mesh(p, new T.SphereGeometry(1, 12, 8), m, pos, scale),
  box = (p, m, pos, size) => mesh(p, new T.BoxGeometry(...size), m, pos);
function joint(p, name, pos) {
  const b = new T.Bone();
  b.name = name;
  b.position.set(...pos);
  p.add(b);
  return b;
}
export function makeSonic() {
  const root = new T.Group(),
    blue = material("#1b55bd", "#2873df"),
    skin = material("#e0bd8b", "#f0d1a1"),
    white = material("#eeeedd", "#c9d7da"),
    red = material("#c83943", "#e65b57"),
    black = material("#202a3b"),
    green = material("#4ea66a"),
    gold = material("#f4cd35", "#fff6a2", 0.15, 0.45),
    bones = {};
  const hip = (bones.hip = joint(root, "hip", [0, 1.15, 0]));
  ball(hip, blue, [0, 0.15, 0], [0.43, 0.63, 0.35]);
  ball(hip, skin, [0, 0.18, 0.29], [0.29, 0.4, 0.1]);
  const head = (bones.head = joint(hip, "head", [0, 0.92, 0]));
  ball(head, blue, [0, 0, 0], [0.64, 0.63, 0.54]);
  const quills = [];
  for (let n = 0; n < 6; n++) {
    const q = mesh(head, new T.ConeGeometry(0.33, 0.95, 7), blue, [
      Math.sin(n * 1.1) * 0.38,
      -0.05 - Math.floor(n / 2) * 0.15,
      -0.4 - Math.floor(n / 2) * 0.13,
    ]);
    const side = n % 2 ? 1 : -1,
      row = Math.floor(n / 2);
    q.position.set(
      side * (0.29 + row * 0.08),
      0.1 - row * 0.16,
      -0.4 - row * 0.08,
    );
    q.rotation.set(-1.85 - row * 0.22, 0, -side * (0.45 + row * 0.18));
    q.scale.set(1, 1.08 + row * 0.13, 1);
    q.userData.baseRotation = q.rotation.clone();
    q.userData.basePosition = q.position.clone();
    q.userData.superRotation = new T.Euler(
      -0.25 - row * 0.13,
      0,
      -side * (0.28 + row * 0.22),
    );
    quills.push(q);
  }
  for (const side of [-1, 1]) {
    const ear = mesh(head, new T.ConeGeometry(0.24, 0.5, 3), blue, [
      side * 0.41,
      0.5,
      0,
    ]);
    ear.rotation.z = -side * 0.22;
    const inside = mesh(head, new T.ConeGeometry(0.13, 0.29, 3), skin, [
      side * 0.41,
      0.52,
      0.08,
    ]);
    inside.rotation.z = -side * 0.22;
    ball(head, white, [side * 0.21, 0.08, 0.44], [0.3, 0.34, 0.13]);
    ball(head, green, [side * 0.19, 0.05, 0.554], [0.085, 0.17, 0.035]);
    ball(head, black, [side * 0.18, 0.06, 0.581], [0.037, 0.13, 0.02]);
    ball(head, white, [side * 0.19, 0.14, 0.596], [0.017, 0.04, 0.01]);
    const brow = ball(
      head,
      blue,
      [side * 0.22, 0.3, 0.54],
      [0.33, 0.095, 0.16],
    );
    brow.rotation.z = side * 0.24;
  }
  ball(head, skin, [0, -0.26, 0.47], [0.5, 0.24, 0.22]);
  ball(head, black, [0, -0.12, 0.72], [0.13, 0.105, 0.14]);
  const smile = box(head, black, [0.25, -0.3, 0.64], [0.15, 0.025, 0.012]);
  smile.rotation.z = 0.12;
  for (const side of [-1, 1]) {
    const arm = (bones[side < 0 ? "armL" : "armR"] = joint(hip, "upper_arm", [
      side * 0.42,
      0.48,
      0,
    ]));
    ball(arm, blue, [side * 0.03, -0.25, 0], [0.12, 0.34, 0.13]);
    const elbow = (bones[side < 0 ? "elbowL" : "elbowR"] = joint(arm, "elbow", [
      side * 0.05,
      -0.49,
      0,
    ]));
    ball(elbow, skin, [0, -0.2, 0], [0.105, 0.25, 0.11]);
    ball(elbow, white, [0, -0.43, 0], [0.21, 0.12, 0.2]);
    ball(elbow, white, [0, -0.59, 0.04], [0.23, 0.24, 0.2]);
    ball(elbow, white, [-side * 0.18, -0.55, 0.12], [0.11, 0.13, 0.11]);
    const leg = (bones[side < 0 ? "legL" : "legR"] = joint(hip, "thigh", [
      side * 0.22,
      -0.38,
      0,
    ]));
    ball(leg, blue, [0, -0.25, 0], [0.12, 0.35, 0.13]);
    const knee = (bones[side < 0 ? "kneeL" : "kneeR"] = joint(
      leg,
      "knee",
      [0, -0.48, 0],
    ));
    ball(knee, blue, [0, -0.14, 0], [0.105, 0.23, 0.1]);
    ball(knee, white, [0, -0.32, 0], [0.23, 0.13, 0.22]);
    ball(knee, red, [0, -0.44, 0.18], [0.27, 0.18, 0.48]);
    box(knee, white, [0, -0.38, 0.17], [0.48, 0.08, 0.2]);
    box(knee, white, [0, -0.56, 0.18], [0.51, 0.1, 0.8]);
    box(knee, gold, [side * 0.22, -0.37, 0.1], [0.04, 0.15, 0.18]);
    for (let k = 0; k < 5; k++)
      box(knee, black, [0, -0.616, -0.1 + k * 0.14], [0.36, 0.012, 0.025]);
  }
  root.userData = {
    bones,
    blue,
    gold,
    quills,
    materials: [blue, skin, white, red, black, green, gold],
    super: false,
  };
  return root;
}
const ease = (a, b, dt) => T.MathUtils.lerp(a, b, 1 - Math.exp(-dt * 14));
export function poseSonic(root, s, dt) {
  root.scale.setScalar(sonicLength(s, 1));
  const b = root.userData.bones,
    p = s.avatar,
    superForm = sonicSuper(s),
    t = s.time,
    run = Math.min(1, Math.hypot(p.vx, p.vz) / 18),
    wave = Math.sin(t * (run > 0.8 ? 22 : 13));
  if (root.userData.super !== superForm) {
    root.userData.super = superForm;
    root.userData.quills.forEach((q, n) => {
      q.rotation.copy(
        superForm ? q.userData.superRotation : q.userData.baseRotation,
      );
      q.position.copy(q.userData.basePosition);
      if (superForm) q.position.y += 0.35 + Math.floor(n / 2) * 0.13;
    });
    root.traverse((m) => {
      if (m.isMesh && m.material === root.userData.blue)
        m.material = superForm ? root.userData.gold : root.userData.blue;
    });
  }
  root.position.set(p.x, p.y + 0.4, p.z);
  root.scale.setScalar(1.3);
  let facing = p.yaw + Math.PI;
  if (Math.hypot(p.vx, p.vz) > 1 && !superForm) facing = Math.atan2(p.vx, p.vz);
  if (superForm && s.lock) facing = Math.atan2(-p.x, -p.z);
  const turn = Math.atan2(
    Math.sin(facing - root.rotation.y),
    Math.cos(facing - root.rotation.y),
  );
  root.rotation.y = ease(root.rotation.y, root.rotation.y + turn, dt);
  b.hip.position.y = ease(
    b.hip.position.y,
    superForm
      ? 1.2 + Math.sin(t * 3) * 0.06
      : 1.15 + Math.abs(wave) * run * 0.05,
    dt,
  );
  let hipX = superForm ? -0.12 : run * 0.25,
    armLX = wave * run,
    armRX = -wave * run,
    armLZ = 0.18,
    armRZ = -0.18,
    legLX = -wave * run,
    legRX = wave * run,
    elbowL = -0.2,
    elbowR = -0.2,
    kneeL = Math.max(0, wave) * run * 0.5,
    kneeR = Math.max(0, -wave) * run * 0.5;
  if (!superForm && !p.onGround) {
    hipX = -0.2;
    armLX = -0.5;
    armRX = -0.5;
    legLX = 0.5;
    legRX = -0.4;
    kneeL = 0.8;
  }
  if (superForm) {
    armLX = -0.3;
    armRX = -0.3;
    armLZ = 0.35;
    armRZ = -0.35;
    legLX = 0.1;
    legRX = -0.2;
    kneeR = 0.3;
  }
  if (s.action === "punch" || s.action === "counter") {
    const q = Math.sin(
        (1 - s.actionTime / (s.action === "counter" ? 1.2 : 0.28)) * Math.PI,
      ),
      side = s.combo % 2;
    armLX = side ? -1.5 * q : -0.4;
    armRX = side ? -0.4 : -1.5 * q;
    elbowL = elbowR = -0.6;
    hipX = -q * 0.25;
  }
  if (s.parryHeld || s.action === "parry") {
    armLX = armRX = -1.4;
    elbowL = elbowR = -0.75;
    armLZ = -0.15;
    armRZ = 0.15;
  }
  if (s.action === "boom") {
    legRX = -1.25;
    kneeR = -0.1;
    armLX = 0.6;
    armRX = -0.8;
  }
  if (s.action === "dodge") {
    root.rotation.z = Math.sin((s.dodge / 0.5) * Math.PI) * 1.5;
    armLX = armRX = -0.8;
  } else root.rotation.z = ease(root.rotation.z, 0, dt);
  if (s.action === "rush" || s.action === "loop") {
    hipX = -0.9;
    armLX = armRX = 0.8;
    legLX = 0.8;
    legRX = -0.8;
    root.rotation.y += Math.sin(t * 18) * 0.08;
  }
  if (s.action === "hurt") {
    hipX = 0.5;
    armLX = armRX = -1.7;
    legLX = -0.7;
    legRX = 0.7;
  }
  b.hip.rotation.x = ease(b.hip.rotation.x, hipX, dt);
  for (const [k, v] of Object.entries({
    armL: armLX,
    armR: armRX,
    legL: legLX,
    legR: legRX,
    elbowL,
    kneeL,
    elbowR,
    kneeR,
  }))
    b[k].rotation.x = ease(b[k].rotation.x, v, dt);
  b.armL.rotation.z = ease(b.armL.rotation.z, armLZ, dt);
  b.armR.rotation.z = ease(b.armR.rotation.z, armRZ, dt);
  b.head.rotation.y = ease(b.head.rotation.y, Math.sin(t * 0.5) * 0.04, dt);
}
// Original reference-guided Titan armor: broad mantle, recessed face, narrow
// waist and long blade-like forearms. Details are merged per animated bone.
function taper(parent, mat, pos, top, bottom, height, depth = 1, sides = 8) {
  return mesh(
    parent,
    new T.CylinderGeometry(top, bottom, height, sides),
    mat,
    pos,
    [1, 1, depth],
  );
}
function batchRigidDetails(root) {
  root.traverse((p) => {
    const byMat = new Map();
    for (const m of [...p.children])
      if (m.isMesh && !m.isInstancedMesh) {
        m.updateMatrix();
        const g = m.geometry.clone().applyMatrix4(m.matrix);
        if (!byMat.has(m.material)) byMat.set(m.material, []);
        byMat.get(m.material).push(g);
        m.geometry.dispose();
        p.remove(m);
      }
    for (const [mat, geos] of byMat) {
      const g = mergeGeometries(geos);
      geos.forEach((g) => g.dispose());
      if (g) mesh(p, g, mat);
    }
  });
}
export function makeGiganto() {
  const root = new T.Group(),
    shell = material("#17232d", "#303e48", 0.48),
    dark = material("#0c131d", "#1d2835", 0.35),
    red = material("#801f38", "#e2475c", 0.15, 0.55),
    black = material("#060b12"),
    bone = material("#aab4ad", "#d2d7c5", 0.3),
    bones = {};
  root.name = "Giganto — obsidian mantle";
  const hip = (bones.hip = joint(root, "titan_hip", [0, 34, 0]));
  taper(hip, dark, [0, 0, 0], 10, 6, 10, 0.65);
  const chest = (bones.chest = joint(hip, "titan_spine", [0, 4, 0]));
  taper(chest, shell, [0, 18, 0], 23, 8, 33, 0.57, 10);
  ball(chest, dark, [0, 29, -2], [22, 11, 12]);
  // Overlapping mantle plates are dark, with small red fractures instead of a
  // bright chest core. The bare white metal belongs mainly to the jaw/claws.
  for (const side of [-1, 1]) {
    for (let n = 0; n < 5; n++) {
      const plate = box(
        chest,
        n % 2 ? shell : dark,
        [side * (9 + n * 1.9), 26 - n * 4, 6.5 - n * 0.7],
        [9, 6.5, 3],
      );
      plate.rotation.z = -side * (0.28 + n * 0.025);
      const seam = box(
        chest,
        red,
        [side * (7 + n * 2), 28 - n * 4, 8.2 - n * 0.7],
        [0.22, 2.3, 0.12],
      );
      seam.rotation.z = side * 0.4;
    }
    taper(chest, shell, [side * 6, 2, 0], 5, 2, 11, 0.8, 5).rotation.z =
      side * 0.3;
  }
  const head = (bones.head = joint(chest, "titan_neck", [0, 39, 4]));
  ball(head, dark, [0, 3, 0], [7, 6.8, 6]);
  taper(head, shell, [0, 4, 1], 5.8, 4.3, 9, 1, 6);
  box(head, black, [0, 2.5, 5.1], [9, 2.2, 1.2]);
  box(head, red, [0, 3.1, 5.8], [4.5, 0.35, 0.25]);
  for (const side of [-1, 1]) {
    const ridge = box(head, shell, [side * 4.1, 3, 4.8], [1.8, 9, 3]);
    ridge.rotation.z = side * 0.17;
    const horn = mesh(head, new T.ConeGeometry(1.3, 7, 5), shell, [
      side * 6.1,
      6,
      -1,
    ]);
    horn.rotation.z = -side * 0.9;
    const cheek = box(head, bone, [side * 5, -1, 5.1], [1.2, 5, 2]);
    cheek.rotation.z = -side * 0.3;
  }
  const jaw = (bones.jaw = joint(head, "jaw", [0, -1.5, 3.4]));
  taper(jaw, bone, [0, -1.8, 1.1], 5.7, 3.3, 4.5, 0.6, 7);
  box(jaw, black, [0, 0.25, 2.5], [8, 1.6, 2.3]);
  for (let x = -4; x <= 4; x += 1.3) {
    mesh(jaw, new T.ConeGeometry(0.38, 1.5, 4), bone, [x, 0.7, 3.4]);
    const tooth = mesh(head, new T.ConeGeometry(0.4, 1.5, 4), bone, [
      x,
      -0.8,
      6.3,
    ]);
    tooth.rotation.x = Math.PI;
  }
  // Small etched rings and red pin lights are original geometry, merged with
  // each plate. They give the surface scale without noisy full-screen glow.
  function etch(parent, side, y, z) {
    for (let n = 0; n < 4; n++) {
      const a = box(
        parent,
        red,
        [side * (2 + n * 0.53), y - n * 0.9, z],
        [0.18, 0.7, 0.15],
      );
      a.rotation.z = side * 0.25;
    }
    const ring = mesh(parent, new T.TorusGeometry(0.8, 0.12, 3, 6), bone, [
      side * 3,
      y + 1,
      z,
    ]);
    ring.rotation.z = 0.5;
  }
  for (const side of [-1, 1]) {
    const arm = (bones[side < 0 ? "armL" : "armR"] = joint(
      chest,
      "titan_shoulder",
      [side * 18, 32, 0],
    ));
    ball(arm, shell, [side * 3, -1, -1], [12, 12, 10]);
    ball(arm, dark, [side * 4, 2, 0], [10.8, 9, 10.4]);
    taper(arm, shell, [side * 2, -13, 0], 6.5, 3.5, 22, 0.85, 6).rotation.z =
      -side * 0.12;
    etch(arm, side, -1, 9.8);
    const elbow = (bones[side < 0 ? "elbowL" : "elbowR"] = joint(
      arm,
      "titan_elbow",
      [side * 3, -23, 0],
    ));
    ball(elbow, black, [0, 0, 0], [3.3, 3.3, 3.4]);
    taper(elbow, shell, [0, -13, 0], 4.5, 2.3, 27, 0.9, 5);
    const fin = box(elbow, dark, [side * 2.5, -10, -1], [2, 19, 4]);
    fin.rotation.z = -side * 0.1;
    box(elbow, red, [0, -12, 3.4], [0.25, 15, 0.15]);
    etch(elbow, side, -3, 3.7);
    const hand = joint(elbow, "titan_wrist", [0, -27, 0]);
    taper(hand, dark, [0, -2, 0], 3, 2.2, 5, 0.7, 6);
    for (let n = 0; n < 3; n++) {
      const finger = joint(hand, "titan_finger", [-2 + n * 2, -3, 0.1]);
      taper(finger, n === 1 ? shell : bone, [0, -3, 0], 0.7, 0.16, 6, 0.65, 4);
      finger.rotation.x = -0.24;
    }
    const thumb = mesh(hand, new T.ConeGeometry(0.9, 5, 4), bone, [
      -side * 3.2,
      -3.5,
      1,
    ]);
    thumb.rotation.z = -side * 0.5;
    thumb.rotation.x = Math.PI;
    const leg = (bones[side < 0 ? "legL" : "legR"] = joint(hip, "titan_thigh", [
      side * 7,
      -3,
      0,
    ]));
    taper(leg, shell, [0, -7, 0], 5.5, 3, 15, 0.85, 6).rotation.z = side * 0.08;
    const knee = (bones[side < 0 ? "kneeL" : "kneeR"] = joint(
      leg,
      "titan_knee",
      [side, -15, 0],
    ));
    ball(knee, dark, [0, 0, 0], [3.2, 3.4, 3.2]);
    taper(knee, shell, [0, -7.2, 0], 3.2, 1.3, 15, 0.8, 5);
    taper(knee, dark, [0, -13.6, 1.6], 2.1, 1.1, 3, 0.9, 5);
    etch(knee, side, -2, 2.9);
  }
  const rods = [];
  for (let n = 0; n < 10; n++) {
    const side = n < 5 ? -1 : 1,
      k = n % 5;
    const rod = joint(chest, "dorsal_emitter", [
      side * (4 + k * 3.7),
      35 - k * 1.25,
      -7,
    ]);
    taper(rod, dark, [0, 5, 0], 1.05, 1.8, 11, 1, 6);
    taper(rod, red, [0, 10.7, 0], 0.85, 0.85, 1.7, 1, 6);
    rod.rotation.z = -side * (0.1 + k * 0.12);
    rod.rotation.x = -0.28;
    rods.push(rod);
  }
  batchRigidDetails(root);
  root.userData = {
    bones,
    rods,
    materials: [shell, dark, red, black, bone],
    red,
  };
  return root;
}
export function poseGiganto(root, s, dt) {
  const b = root.userData.bones,
    t = s.time;
  let chestY = 0,
    armLX = 0.08,
    armRX = 0.08,
    armLZ = 0.15,
    armRZ = -0.15,
    elbowL = -0.1,
    elbowR = -0.1,
    jaw = 0;
  if (["intro", "traversal"].includes(s.stage)) {
    chestY = Math.sin(t * 0.55) * 0.015;
  }
  if (s.stage === "combat" && s.attack !== "idle") {
    const tell =
        { swing: 1.5, slap: 1.2, beam: 1.8, crunch: 1.75 }[s.attack] *
        { easy: 1.25, normal: 1, hard: 0.85 }[s.config.difficulty],
      u = Math.min(1, s.attackTime / tell),
      strike = Math.max(0, Math.min(1, (s.attackTime - tell) / 0.3));
    if (s.attack === "swing") {
      armLX = -u * 0.4 - strike * 0.9;
      armLZ = -u * 1.2 + strike * 2;
      elbowL = -u * 0.8;
      chestY = u * 0.3 - strike * 0.55;
    }
    if (s.attack === "slap") {
      armRX = -u * 0.5 - strike * 1.2;
      armRZ = u * 1.1 - strike * 1.9;
      elbowR = -u * 0.7;
    }
    if (s.attack === "beam") {
      jaw = u * 0.75;
      chestY = Math.sin(t * 0.2) * 0.1;
      armLZ = 0.35;
      armRZ = -0.35;
    }
    if (s.attack === "crunch") {
      armLX = armRX = -u * 0.85 - strike * 0.35;
      armLZ = -u * 0.7 + strike * 0.8;
      armRZ = u * 0.7 - strike * 0.8;
      elbowL = elbowR = -strike * 1.1;
      jaw = 0.45;
    }
  }
  if (s.stagger > 0) {
    armLX = armRX = 0.3;
    b.head.rotation.x = ease(b.head.rotation.x, 0.2, dt);
  } else b.head.rotation.x = ease(b.head.rotation.x, 0, dt);
  b.chest.rotation.y = ease(b.chest.rotation.y, chestY, dt);
  for (const [k, v] of Object.entries({
    armL: armLX,
    armR: armRX,
    elbowL,
    elbowR,
  }))
    b[k].rotation.x = ease(b[k].rotation.x, v, dt);
  b.armL.rotation.z = ease(b.armL.rotation.z, armLZ, dt);
  b.armR.rotation.z = ease(b.armR.rotation.z, armRZ, dt);
  b.jaw.rotation.x = ease(b.jaw.rotation.x, jaw, dt);
  root.position.y =
    s.stagger > 0 && s.action === "loop"
      ? Math.sin((1 - s.actionTime / 1.6) * Math.PI) * 5
      : 0;
  root.rotation.x =
    s.stage === "finale"
      ? Math.min(1, s.stageTime / 6) * 0.35
      : s.stage === "victory"
        ? 0.35
        : 0;
  root.userData.rods.forEach(
    (r) => (r.scale.y = ease(r.scale.y, s.phase === 2 ? 1.6 : 1, dt)),
  );
  root.userData.red.emissiveIntensity =
    0.45 + Math.sin(t * 3) * 0.2 + (s.stage === "phase" ? 0.8 : 0);
}
export function makeTitanArena(route) {
  const group = new T.Group(),
    geos = [],
    color = new T.Color();
  function add(g, pos, c) {
    g.translate(...pos);
    color.set(c);
    const a = new Float32Array(g.attributes.position.count * 3);
    for (let n = 0; n < a.length; n += 3) a.set([color.r, color.g, color.b], n);
    g.setAttribute("color", new T.BufferAttribute(a, 3));
    geos.push(g);
  }
  const floor = new T.CircleGeometry(180, 96);
  floor.rotateX(-Math.PI / 2);
  add(floor, [0, 0, 0], "#627f3d");
  // A closed stratified cliff basin, with irregular silhouettes beyond the
  // flight/camera boundary. All decorative terrain is merged in one draw call.
  for (let n = 0; n < 72; n++) {
    const a = (n / 72) * Math.PI * 2,
      radius = 215 + Math.sin(n * 2.4) * 14,
      h = 37 + Math.sin(n * 0.8) * 12 + Math.cos(n * 1.7) * 9;
    for (let band = 0; band < 3; band++) {
      const cliff = new T.CylinderGeometry(17 - band, 21 - band, h / 3 + 2, 5);
      cliff.rotateY(a * 0.5);
      add(
        cliff,
        [
          Math.sin(a) * radius,
          h / 6 + (band * h) / 3 - 2,
          Math.cos(a) * radius,
        ],
        band === 2 ? "#69854e" : band === 1 ? "#80826c" : "#586359",
      );
    }
    if (n % 4 === 0) {
      const mountain = new T.ConeGeometry(35, 65 + (n % 6) * 6, 6);
      add(
        mountain,
        [Math.sin(a) * (radius + 55), 18, Math.cos(a) * (radius + 55)],
        "#758d81",
      );
    }
  }
  // A forest ring and dry streambed make a readable valley from the air. Trees
  // stay beyond the movement bounds, so decorative trunks cannot trap Sonic.
  for (let n = 0; n < 240; n++) {
    const a = n * 2.399963,
      radius = 172 + (n % 9) * 3.4,
      x = Math.sin(a) * radius,
      z = Math.cos(a) * radius,
      h = 6 + (n % 7);
    add(new T.CylinderGeometry(0.55, 0.8, h, 5), [x, h / 2, z], "#534e3b");
    add(
      new T.ConeGeometry(3 + (n % 3), h, 6),
      [x, h, z],
      n % 3 ? "#365c38" : "#507544",
    );
  }
  for (let n = 0; n < 210; n++) {
    const a = n * 2.399963,
      rr = 20 + Math.sqrt(n / 210) * 139,
      x = Math.sin(a) * rr,
      z = Math.cos(a) * rr;
    const patch = new T.CircleGeometry(1 + (n % 4), 5);
    patch.rotateX(-Math.PI / 2);
    add(patch, [x, 0.012, z], n % 4 ? "#719044" : "#859a50");
  }
  for (let n = 0; n < 26; n++) {
    const z = -170 + n * 13,
      x = 85 + Math.sin(n * 0.4) * 25;
    const bed = new T.PlaneGeometry(8, 18);
    bed.rotateX(-Math.PI / 2);
    add(bed, [x, 0.022, z], "#8e9275");
  }
  const platformStart = geos.length;
  for (const p of route.slice(1))
    add(new T.BoxGeometry(p.w, 1.5, p.w), [p.x, p.y - 0.75, p.z], "#273c45");
  const platforms = mesh(
    group,
    mergeGeometries(geos.splice(platformStart)),
    new T.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.8,
      flatShading: true,
    }),
  );
  const merged = mergeGeometries(geos);
  geos.forEach((g) => g.dispose());
  group.add(
    new T.Mesh(
      merged,
      new T.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.95,
        flatShading: true,
      }),
    ),
  );
  const ringMat = new T.MeshBasicMaterial({ color: "#42ddd6" });
  const rings = [];
  for (const p of route) {
    const m = new T.Mesh(
      new T.TorusGeometry(2.5, 0.13, 5, 24),
      ringMat.clone(),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(p.x, p.y + 0.08, p.z);
    group.add(m);
    rings.push(m);
  }
  group.userData.rings = rings;
  group.userData.platforms = platforms;
  group.children[1].receiveShadow = true;
  return group;
}
export function makeEmerald() {
  const group = makeChaosEmerald();
  const light = new T.PointLight("#42e6d8", 6, 15, 2);
  group.add(light);
  return group;
}
export function disposeTitanObject(root) {
  const materials = new Set(),
    geos = new Set();
  root.traverse((n) => {
    if (n.isInstancedMesh) n.dispose();
    if (n.geometry) geos.add(n.geometry);
    for (const m of Array.isArray(n.material) ? n.material : [n.material])
      if (m) materials.add(m);
  });
  geos.forEach((g) => {
    if (!g.userData.dcsmShared) g.dispose();
  });
  materials.forEach((m) => m.dispose());
  root.removeFromParent();
}
