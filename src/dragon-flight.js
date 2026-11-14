// Steering is measured in simulation ticks. Targets never assign the dragon's
// position or heading directly; transitions preserve velocity and bank.
const mix = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export function steerDragon(e, target, speed = 0.9) {
  const dx = target.x - e.x,
    dy = target.y - e.y,
    dz = target.z - e.z,
    d = Math.max(0.01, Math.hypot(dx, dy, dz));
  const rate = e.mode === "perch" ? 0.16 : 0.075;
  for (const [key, delta] of [
    ["x", dx],
    ["y", dy],
    ["z", dz],
  ]) {
    const v = "flightV" + key;
    e[v] = mix(e[v] || 0, (delta / d) * Math.min(speed, d * 0.12), rate);
    e[key] += e[v];
  }
  const heading = Math.atan2(-(e.flightVx || 0), -(e.flightVz || 0));
  const turn = Math.atan2(Math.sin(heading - e.yaw), Math.cos(heading - e.yaw));
  e.yaw += clamp(turn, -0.075, 0.075);
  e.bank = mix(e.bank || 0, clamp(-turn * 0.4, -0.42, 0.42), 0.12);
  e.flightPitch = mix(
    e.flightPitch || 0,
    -Math.atan2(
      e.flightVy || 0,
      Math.max(0.1, Math.hypot(e.flightVx || 0, e.flightVz || 0)),
    ) * 0.35,
    0.1,
  );
}
export function swoopTarget(e, p) {
  e.swoop ||= {
    start: { x: e.x, y: e.y, z: e.z },
    aim: { x: p.x, y: Math.max(62, p.y + 2), z: p.z },
  };
  const { start, aim } = e.swoop,
    dx = aim.x - start.x,
    dz = aim.z - start.z,
    n = Math.hypot(dx, dz) || 1;
  // Dive through the chosen point and climb along its tangent, instead of
  // reversing direction the moment the head reaches the player.
  if (e.modeAge <= 28)
    return {
      x: start.x - (dx / n) * 7,
      y: start.y + 8,
      z: start.z - (dz / n) * 7,
    };
  const u = clamp((e.modeAge - 28) / 95, 0, 1),
    q = u * u * (3 - 2 * u);
  return {
    x: mix(start.x, aim.x + (dx / n) * 40, q),
    y: mix(start.y, aim.y, q) + Math.max(0, (u - 0.57) * 70),
    z: mix(start.z, aim.z + (dz / n) * 40, q),
  };
}
