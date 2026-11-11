const clamp = (x) => Math.max(0, Math.min(1, x));
const ease = (x) => {
  x = clamp(x);
  return x * x * (3 - 2 * x);
};
// Backswing, contact and follow-through have separate phases. These curves are
// cosmetic: they do not advance cooldowns, mining, damage or item consumption.
export function weaponActionPose(kind, progress, tool, direction = 1) {
  if (
    !["sword", "spear", "axe", "pickaxe", "shovel", "hoe", "mace"].includes(
      tool,
    ) ||
    !["attack", "mine", "use"].includes(kind)
  )
    return null;
  const p = clamp(progress),
    e = Math.sin(Math.PI * p),
    cut = ease((p - 0.2) / 0.28),
    follow = ease((p - 0.58) / 0.42);
  const pose = { x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, trail: 0 };
  if (kind === "use") {
    pose.x = -0.07 * e;
    pose.y = 0.1 * e;
    pose.z = -0.05 * e;
    pose.rx = -0.2 * e;
    pose.ry = 0.18 * e;
    pose.rz = 0.12 * e;
    return pose;
  }
  if (tool === "mace") {
    pose.x = -0.12 * e;
    pose.y = (0.2 - cut * 0.24) * e;
    pose.z = -0.11 * e;
    pose.rx = (-0.95 + cut * 1.6) * e;
    pose.ry = 0.12 * e;
    pose.rz = -0.32 * e * direction;
    pose.trail = e * 0.35;
    return pose;
  }
  if (tool === "spear") {
    const drive = Math.sin(Math.PI * ease((p - 0.12) / 0.72));
    pose.x = -0.045 * e;
    pose.y = 0.035 * e;
    pose.z = -0.39 * drive;
    pose.rx = -1.16 * e;
    pose.ry = -0.1 * e;
    pose.rz = 0.07 * e;
  } else if (tool === "sword") {
    pose.x = direction * e * (0.035 - cut * 0.19);
    pose.y = e * (0.09 - cut * 0.08);
    pose.z = -e * (0.08 + cut * 0.07);
    pose.rx = e * (0.26 - cut * 0.95 + follow * 0.12);
    pose.ry = direction * e * (0.2 - cut * 0.57);
    pose.rz = direction * e * (0.45 - cut * 1.38);
    pose.trail =
      p > 0.25 && p < 0.57 ? Math.sin((Math.PI * (p - 0.25)) / 0.32) : 0;
  } else if (tool === "axe") {
    pose.x = -0.075 * e;
    pose.y = e * (0.13 - cut * 0.18);
    pose.z = -0.16 * e;
    pose.rx = e * (0.85 - cut * 1.72);
    pose.ry = -0.18 * e;
    pose.rz = e * (0.2 - cut * 0.37);
  } else if (tool === "pickaxe") {
    pose.x = -0.065 * e;
    pose.y = e * (0.1 - cut * 0.13);
    pose.z = -0.13 * e;
    pose.rx = e * (0.64 - cut * 1.31);
    pose.ry = 0.12 * e;
    pose.rz = e * (0.17 - cut * 0.43);
  } else if (tool === "shovel") {
    pose.x = -0.045 * e;
    pose.y = -0.075 * e;
    pose.z = -0.22 * e;
    pose.rx = -0.76 * e;
    pose.ry = -0.17 * e;
    pose.rz = 0.09 * e;
  } else {
    pose.x = -0.11 * e;
    pose.y = -0.04 * e;
    pose.z = -0.19 * e;
    pose.rx = -0.57 * e;
    pose.ry = 0.22 * e;
    pose.rz = -0.15 * e;
  }
  return pose;
}
