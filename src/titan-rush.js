import { sonicLength } from "./titan-metrics.js";
import {
  titanLocalPoint,
  titanWorldPoint,
  titanWorldVector,
} from "./titan-space.js";
const clamp = (x) => Math.max(0, Math.min(1, x)),
  ease = (x) => {
    x = clamp(x);
    return x * x * (3 - 2 * x);
  };
export function makeTitanRush(s, contact, direction) {
  const p = s.avatar,
    locked = s.lock && contact.distance <= 32,
    end = locked
      ? {
          x: contact.point.x + contact.normal.x * sonicLength(s, 2.8),
          y:
            contact.point.y +
            contact.normal.y * sonicLength(s, 2.8) -
            sonicLength(s, 1.8),
          z: contact.point.z + contact.normal.z * sonicLength(s, 2.8),
        }
      : {
          x: p.x + direction.x * 26,
          y: p.y + direction.y * 26,
          z: p.z + direction.z * 26,
        },
    normal = locked ? contact.normal : direction,
    length = Math.hypot(normal.x, normal.z) || 1,
    tangent = { x: normal.z / length, y: 0, z: -normal.x / length };
  return {
    from: { x: p.x, y: p.y, z: p.z },
    end: locked ? titanLocalPoint(s, end) : end,
    tangent: locked
      ? titanLocalPoint(s, tangent, { x: 0, z: 0, yaw: s.boss?.yaw || 0 })
      : tangent,
    locked,
  };
}
export function titanRushVelocity(s, rush, time, dt) {
  if (time > 0.8) return null;
  const end = rush.locked ? titanWorldPoint(s, rush.end) : rush.end,
    tangent = rush.locked ? titanWorldVector(s, rush.tangent) : rush.tangent,
    advance = ease(time / 0.2),
    side =
      Math.sin((time / 0.64) * Math.PI * 6) *
      sonicLength(s, 4.5) *
      ease(time / 0.1) *
      (1 - ease((time - 0.54) / 0.1)),
    target = {
      x: rush.from.x + (end.x - rush.from.x) * advance + tangent.x * side,
      y: rush.from.y + (end.y - rush.from.y) * advance,
      z: rush.from.z + (end.z - rush.from.z) * advance + tangent.z * side,
    },
    dx = (target.x - s.avatar.x) / dt,
    dy = (target.y - s.avatar.y) / dt,
    dz = (target.z - s.avatar.z) / dt,
    scale = Math.min(1, 70 / Math.max(0.001, Math.hypot(dx, dy, dz)));
  return { x: dx * scale, y: dy * scale, z: dz * scale };
}
