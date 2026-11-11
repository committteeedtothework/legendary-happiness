import { nearestTitanSurface } from "./titan-contact.js";
import { sonicLength } from "./titan-metrics.js";
export const TITAN_SHOT = Object.freeze({
  count: 6,
  speed: 78,
  turnRate: 5,
  range: 65,
});
const unit = (v) => {
  const n = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / n, y: v.y / n, z: v.z / n };
};
export function titanShotOrigin(s, index, charge = 1) {
  const a = (index / TITAN_SHOT.count) * Math.PI * 2,
    p = s.avatar,
    target = s.lock
      ? nearestTitanSurface(s, p).point
      : { x: p.x - Math.sin(p.yaw), z: p.z - Math.cos(p.yaw) },
    dx = target.x - p.x,
    dz = target.z - p.z,
    l = Math.hypot(dx, dz) || 1;
  const q = {
    x: p.x + (dz / l) * Math.cos(a) * sonicLength(s,2.6) * charge,
    y: p.y + sonicLength(s,3.4) + Math.sin(a) * sonicLength(s,1.5) * charge,
    z: p.z - (dx / l) * Math.cos(a) * sonicLength(s,2.6) * charge,
  };
  const c=nearestTitanSurface(s,q), padding=sonicLength(s,0.7);
  return c.inside || c.distance<padding
    ? {x:c.point.x+c.normal.x*padding,y:c.point.y+c.normal.y*padding,z:c.point.z+c.normal.z*padding} : q;
}
export function makeTitanShot(s, strike, index) {
  const a = (index / TITAN_SHOT.count) * Math.PI * 2,
    source = titanShotOrigin(s, index),
    target = nearestTitanSurface(s, source).point,
    aim = s.lock
      ? unit({
          x: target.x - source.x,
          y: target.y - source.y,
          z: target.z - source.z,
        })
      : strike.direction,
    tangent = { x: aim.z, y: 0, z: -aim.x },
    d = unit({
      x: aim.x * 0.55 + tangent.x * Math.cos(a) * 0.65,
      y: aim.y * 0.55 + 0.45 + Math.sin(a) * 0.3,
      z: aim.z * 0.55 + tangent.z * Math.cos(a) * 0.65,
    });
  return {
    ...source,
    vx: d.x * TITAN_SHOT.speed,
    vy: d.y * TITAN_SHOT.speed,
    vz: d.z * TITAN_SHOT.speed,
    life: 2,
    remaining: TITAN_SHOT.range,
    kind: "shot",
    guided: s.lock,
    serial: strike.serial,
    contact: index + 1,
  };
}
export function steerTitanShot(s, q, dt) {
  if (!q.guided) return;
  const target = nearestTitanSurface(s, q).point,
    to = unit({ x: target.x - q.x, y: target.y - q.y, z: target.z - q.z }),
    from = unit({ x: q.vx, y: q.vy, z: q.vz }),
    dot = Math.max(
      -1,
      Math.min(1, from.x * to.x + from.y * to.y + from.z * to.z),
    ),
    angle = Math.acos(dot),
    turn = Math.min(angle, TITAN_SHOT.turnRate * dt);
  if (angle < 1e-6) return;
  let axis = {
    x: from.y * to.z - from.z * to.y,
    y: from.z * to.x - from.x * to.z,
    z: from.x * to.y - from.y * to.x,
  };
  if (Math.hypot(axis.x, axis.y, axis.z) < 1e-6)
    axis = { x: -from.z, y: 0, z: from.x };
  if (Math.hypot(axis.x, axis.y, axis.z) < 1e-6) axis = { x: 1, y: 0, z: 0 };
  axis = unit(axis);
  const c = Math.cos(turn),
    n = Math.sin(turn),
    d = axis.x * from.x + axis.y * from.y + axis.z * from.z,
    rotated = {
      x:
        from.x * c +
        (axis.y * from.z - axis.z * from.y) * n +
        axis.x * d * (1 - c),
      y:
        from.y * c +
        (axis.z * from.x - axis.x * from.z) * n +
        axis.y * d * (1 - c),
      z:
        from.z * c +
        (axis.x * from.y - axis.y * from.x) * n +
        axis.z * d * (1 - c),
    };
  q.vx = rotated.x * TITAN_SHOT.speed;
  q.vy = rotated.y * TITAN_SHOT.speed;
  q.vz = rotated.z * TITAN_SHOT.speed;
}
