import { freezeTitanSky } from "./titan-ending.js";
import { sonicLength } from "./titan-metrics.js";
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const TITAN_RETURN = {
  open: 0.9,
  fade: 0.45,
  distance: 18,
  radius: 1.9,
};
export function openTitanReturn(s, saved) {
  if (s.stage !== "victory" || !s.won) return null;
  freezeTitanSky(s);
  if (s.returnPortal) return s.returnPortal;
  const p = s.avatar,
    b = s.boss || { x: 0, z: 0, yaw: 0 },
    dx = p.x - b.x,
    dz = p.z - b.z,
    d = Math.hypot(dx, dz) || 1;
  const nx = d > 1e-6 ? -dx / d : Math.sin(b.yaw),
    nz = d > 1e-6 ? -dz / d : Math.cos(b.yaw);
  const q = {
    x: p.x - nx * sonicLength(s, TITAN_RETURN.distance),
    y: p.y + sonicLength(s, 1.8),
    z: p.z - nz * sonicLength(s, TITAN_RETURN.distance),
    nx,
    nz,
    age: 0,
    fade: 0,
    crossed: false,
  };
  if (
    saved &&
    [
      saved.x,
      saved.y,
      saved.z,
      saved.nx,
      saved.nz,
      saved.age,
      saved.fade,
    ].every(Number.isFinite) &&
    Math.hypot(saved.x, saved.z) < 230 &&
    saved.y >= 1 &&
    saved.y <= 130 &&
    Math.hypot(saved.nx, saved.nz) > 0.9 &&
    Math.hypot(saved.nx, saved.nz) < 1.1
  ) {
    Object.assign(q, saved, {
      age: clamp(saved.age, 0, 1e7),
      fade: clamp(saved.fade, 0, TITAN_RETURN.fade),
      crossed: saved.crossed === true,
    });
    const n = Math.hypot(q.nx, q.nz);
    q.nx /= n;
    q.nz /= n;
    if (
      !saved.entry ||
      ![saved.entry.x, saved.entry.y, saved.entry.z].every(Number.isFinite) ||
      Math.hypot(saved.entry.x, saved.entry.z) > 230 ||
      saved.entry.y < 0 ||
      saved.entry.y > 130
    )
      delete q.entry;
  } else {
    p.yaw = Math.atan2(nx, nz);
    p.pitch = 0.08;
  }
  s.returnPortal = q;
  s.lock = false;
  s.action = "idle";
  s.actionTime = 0;
  s.strike = null;
  s.qte = null;
  s.counterScene = null;
  s.projectiles = [];
  s.knockback = null;
  p.vx = p.vy = p.vz = 0;
  p.onGround = false;
  return q;
}
export function crossesTitanReturn(s, from, to) {
  const q = s.returnPortal;
  if (!q || q.age < TITAN_RETURN.open || q.crossed) return false;
  const signed = (p) => (p.x - q.x) * q.nx + (p.z - q.z) * q.nz,
    a = signed(from),
    b = signed(to);
  if (a * b > 0 || Math.abs(a - b) < 1e-9) return false;
  const t = a / (a - b),
    x = from.x + (to.x - from.x) * t - q.x,
    z = from.z + (to.z - from.z) * t - q.z,
    y = from.y + (to.y - from.y) * t + sonicLength(s, 1.8) - q.y;
  return (
    Math.hypot(x * q.nz - z * q.nx, y) <= sonicLength(s, TITAN_RETURN.radius)
  );
}
export function stepTitanReturn(s, input, dt) {
  const q = openTitanReturn(s);
  if (!q) return;
  q.age += dt;
  const p = s.avatar;
  if (q.crossed) {
    q.fade = Math.min(TITAN_RETURN.fade, q.fade + dt);
    p.vx = p.vy = p.vz = 0;
    s.boosting = false;
    return;
  }
  const from = { x: p.x, y: p.y, z: p.z },
    f = +!!input.forward - +!!input.back,
    r = +!!input.right - +!!input.left,
    u = +!!input.up - +!!input.down,
    n = Math.max(1, Math.hypot(f, r, u)),
    boost = input.boost && Math.hypot(f, r, u) > 0;
  s.boosting = !!boost;
  const speed = sonicLength(s, boost ? 38 : 14),
    a = 1 - Math.exp(-dt * 9),
    yaw = p.yaw;
  p.vx += (((r * Math.cos(yaw) - f * Math.sin(yaw)) / n) * speed - p.vx) * a;
  p.vz += (((-r * Math.sin(yaw) - f * Math.cos(yaw)) / n) * speed - p.vz) * a;
  p.vy += ((u / n) * speed - p.vy) * a;
  p.x += p.vx * dt;
  p.z += p.vz * dt;
  p.y = clamp(p.y + p.vy * dt, sonicLength(s, 1), 120);
  const length = Math.hypot(p.x, p.z);
  if (length > 210) {
    p.x *= 210 / length;
    p.z *= 210 / length;
  }
  if (crossesTitanReturn(s, from, p)) {
    q.crossed = true;
    q.entry = from;
    s.boosting = false;
    p.vx = p.vy = p.vz = 0;
  }
}
export const titanReturnReady = (s) =>
  s?.stage === "victory" &&
  s.won &&
  s.returnPortal?.crossed === true &&
  s.returnPortal.fade >= TITAN_RETURN.fade - 1e-8;
export function resetTitanReturn(s) {
  const q = s?.returnPortal;
  if (!q) return;
  q.crossed = false;
  q.fade = 0;
  // A failed save must not cause an automatic retry loop while inside the gate.
  Object.assign(
    s.avatar,
    q.entry || {
      x: q.x + q.nx * sonicLength(s, 2),
      y: q.y - sonicLength(s, 1.8),
      z: q.z + q.nz * sonicLength(s, 2),
    },
    { vx: 0, vy: 0, vz: 0 },
  );
  delete q.entry;
}
