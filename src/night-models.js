import { attachNPCWeapon } from "./npc-weapon.js";
// Original palettes, silhouettes and markings; articulated cuboid rigs.
export function buildNightModel(type, { g, head, box, limb, material }) {
  if (!["zombie", "creeper", "skeleton", "spider"].includes(type)) return false;
  const skin = material(
    type === "skeleton"
      ? "#d2ceb6"
      : type === "spider"
        ? "#343039"
        : type === "creeper"
          ? "#658c4c"
          : "#74815a",
  );
  const dark = material(type === "skeleton" ? "#756f65" : "#292b2d"),
    eye = material(type === "spider" ? "#d85a48" : "#252a27");
  if (type === "spider") {
    box(g, 0.6, 0.43, 0.85, 0, 0.47, 0.22, skin);
    box(g, 0.48, 0.34, 0.42, 0, 0.5, -0.28, skin);
    head.position.set(0, 0.5, -0.61);
    box(head, 0.46, 0.3, 0.36, 0, 0, 0, skin);
    for (const x of [-0.16, -0.06, 0.06, 0.16])
      box(head, 0.055, 0.06, 0.02, x, 0.04, -0.19, eye);
    g.userData.spiderLegs = [];
    for (const side of [-1, 1])
      for (let i = 0; i < 4; i++) {
        const joint = limb(
          0.09,
          0.52,
          0.09,
          side * 0.23,
          0.5,
          -0.36 + i * 0.23,
          skin,
        );
        joint.rotation.z = side * 1.05;
        joint.rotation.y = side * (i - 1.5) * 0.38;
        const lower = box(joint, 0.08, 0.42, 0.08, side * 0.13, -0.57, 0, skin);
        lower.rotation.z = -side * 0.7;
        g.userData.spiderLegs.push({
          joint,
          side,
          index: i,
          base: joint.rotation.y,
        });
      }
    for (const x of [-0.1, 0.1])
      box(head, 0.05, 0.14, 0.06, x, -0.15, -0.19, dark);
    return true;
  }
  if (type === "creeper") {
    box(g, 0.46, 0.77, 0.34, 0, 0.86, 0, skin);
    head.position.set(0, 1.38, 0);
    box(head, 0.59, 0.5, 0.51, 0, 0, 0, skin);
    const moss = material("#9ba866");
    for (const [x, y] of [
      [-0.21, 0.16],
      [0.17, 0.05],
      [-0.05, -0.17],
    ])
      box(head, 0.1, 0.08, 0.018, x, y, -0.263, moss);
    for (const x of [-0.14, 0.14])
      box(head, 0.11, 0.12, 0.026, x, 0.055, -0.269, eye);
    box(head, 0.12, 0.15, 0.026, 0, -0.08, -0.269, eye);
    for (const x of [-0.1, 0.1])
      box(head, 0.08, 0.09, 0.026, x, -0.16, -0.269, eye);
    for (const x of [-0.2, 0.2])
      for (const z of [-0.18, 0.18])
        g.userData.legs.push(limb(0.22, 0.43, 0.25, x, 0.43, z, skin));
    return true;
  }
  const skeleton = type === "skeleton",
    shirt = material("#4d7778"),
    pants = material("#565574");
  if (skeleton) {
    box(g, 0.1, 0.7, 0.13, 0, 1.02, 0.06, skin);
    for (let i = 0; i < 4; i++)
      box(g, 0.43, 0.07, 0.23, 0, 1.3 - i * 0.14, 0, skin);
    box(g, 0.34, 0.16, 0.21, 0, 0.66, 0, skin);
  } else {
    box(g, 0.49, 0.72, 0.3, 0, 1.01, 0, shirt);
    for (const [x, y] of [
      [-0.16, 0.76],
      [0.12, 1.12],
    ])
      box(g, 0.1, 0.12, 0.015, x, y, -0.16, skin);
  }
  head.position.set(0, 1.64, 0);
  box(head, 0.49, 0.47, 0.45, 0, 0, 0, skin);
  for (const x of [-0.13, 0.13])
    box(head, skeleton ? 0.13 : 0.09, 0.095, 0.025, x, 0.04, -0.236, eye);
  box(head, 0.17, 0.045, 0.027, 0, -0.13, -0.237, dark);
  if (skeleton) box(head, 0.05, 0.07, 0.027, 0, -0.055, -0.238, dark);
  g.userData.arms = [-1, 1].map((side) =>
    limb(
      skeleton ? 0.1 : 0.17,
      0.66,
      skeleton ? 0.1 : 0.19,
      side * 0.34,
      1.37,
      0,
      skeleton ? skin : shirt,
    ),
  );
  g.userData.legs = [-1, 1].map((side) =>
    limb(
      skeleton ? 0.12 : 0.2,
      0.64,
      skeleton ? 0.12 : 0.23,
      side * 0.14,
      0.64,
      0,
      skeleton ? skin : pants,
    ),
  );
  if (skeleton) {
    g.userData.bow = attachNPCWeapon(
      g.userData.arms[1],
      "bow",
      [0, -0.6, -0.03],
      0.9,
    );
  }
  return true;
}
