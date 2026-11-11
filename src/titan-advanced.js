import { sonicLength } from "./titan-metrics.js";
const clamp = (x) => Math.max(0, Math.min(1, x)),
  ease = (x) => {
    x = clamp(x);
    return x * x * x * (x * (x * 6 - 15) + 10);
  };
export const TITAN_SPIN = Object.freeze({ tell: 2.1, strike: 2.4, turns: 2 });
export function spinAngle(s, time = s.attackTime) {
  if (s.attack !== "spin" || s.stage !== "combat") return 0;
  const tell =
    TITAN_SPIN.tell *
    ({ easy: 1.25, normal: 1, hard: 0.85 }[s.config.difficulty] || 1);
  return (
    ease((time - tell) / TITAN_SPIN.strike) * Math.PI * 2 * TITAN_SPIN.turns
  );
}
export function techniquePosition(s, a, time) {
  const u = clamp(time / a.duration),
    f = a.motionFrom,
    q = a.motionTarget;
  if (!f || !q) return null;
  const w = ease(u / 0.55),
    p = {
      x: f.x + (q.x - f.x) * w,
      y: f.y + (q.y - f.y) * w,
      z: f.z + (q.z - f.z) * w,
    };
  if (a.move === "stomp")
    p.y += Math.sin(Math.PI * clamp(time / 0.58)) * sonicLength(s, 5);
  if (a.move === "cyclone") {
    const r = Math.sin(Math.PI * u) * sonicLength(s, 3);
    p.x += Math.cos(u * Math.PI * 4) * r;
    p.z += Math.sin(u * Math.PI * 4) * r;
    p.y += Math.sin(Math.PI * u) * sonicLength(s, 8);
  }
  if (a.move === "cross") {
    const n=a.motionNormal, side=Math.sin(u*Math.PI*4)*sonicLength(s,3.2)*Math.sin(Math.PI*u);
    p.x += n.z*side;
    p.z -= n.x*side;
    p.y += Math.sin(Math.PI*u)*sonicLength(s,2);
  }
  return p;
}
export function approachTitanMelee(s, target, dt) {
  const a = s.strike;
  if (
    !a ||
    !["punch", "combo", "heavy", "finisher", "spin", "counter"].includes(
      a.move,
    ) ||
    !s.lock
  )
    return;
  const p = s.avatar,
    dx = target.point.x - p.x,
    dy = target.point.y - p.y - sonicLength(s, 1.8),
    dz = target.point.z - p.z,
    d = Math.hypot(dx, dy, dz) || 1;
  if (d > (a.move === "counter" ? 32 : 16) || d < sonicLength(s, 2.5)) return;
  const speed = Math.min(
    sonicLength(s, a.move === "counter" ? 180 : 92),
    (d - sonicLength(s, 2.3)) / dt,
  );
  p.vx = p.vx * 0.25 + (dx / d) * speed;
  p.vy = p.vy * 0.25 + (dy / d) * speed;
  p.vz = p.vz * 0.25 + (dz / d) * speed;
}
