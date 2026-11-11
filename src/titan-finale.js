import { titanLocalPoint, titanWorldPoint } from "./titan-space.js";
import { sonicLength } from "./titan-metrics.js";
export const TITAN_CHEST_BREACH = Object.freeze({
  x: 0,
  y: 64,
  z: -7.5,
  radius: 7.8,
});
const clamp = (x) => Math.max(0, Math.min(1, x));
export const cinemaEase = (x) => {
  x = clamp(x);
  return x * x * x * (x * (x * 6 - 15) + 10);
};
// C1 Hermite flight: braking pullback, uninterrupted chest transit, exit/brake.
export function titanPierceLocal(from, time, s) {
  const y = 64 - sonicLength(s, 1.8),
    keys = [
      [0, from, { x: 0, y: 0, z: 0 }],
      [1.9, { x: -8, y: 74, z: 96 }, { x: 0, y: 0, z: 0 }],
      [3.6, { x: 0, y, z: 1 }, { x: 0, y: 0, z: -42 }],
      [4.35, { x: 0, y, z: -20 }, { x: 0, y: 2, z: -42 }],
      [4.8, { x: 0, y: 69, z: -70 }, { x: -2, y: 12, z: -105 }],
      [7, { x: -8, y: 83, z: -110 }, { x: 0, y: 0, z: 0 }],
    ];
  time = Math.max(0, Math.min(7, time));
  if (time <= 1.9) {
    const u = time / 1.9,
      w = cinemaEase(u),
      start = Math.atan2(from.x, from.z + 7.5),
      end = Math.atan2(-8, 103.5),
      turn = Math.atan2(Math.sin(end - start), Math.cos(end - start)),
      angle = start + turn * cinemaEase((u - 0.15) / 0.85),
      radius =
        Math.hypot(from.x, from.z + 7.5) * (1 - w) + Math.hypot(8, 103.5) * w;
    return {
      x: Math.sin(angle) * radius,
      y:
        from.y +
        (74 - from.y) * w +
        Math.sin(Math.PI * u) ** 2 * 30 * Math.min(1, Math.abs(turn)),
      z: Math.cos(angle) * radius - 7.5,
    };
  }
  let i = 0;
  while (i < keys.length - 2 && time > keys[i + 1][0]) i++;
  const [ta, a, va] = keys[i],
    [tb, b, vb] = keys[i + 1],
    d = tb - ta,
    u = (time - ta) / d;
  const p = {};
  for (const k of ["x", "y", "z"])
    p[k] =
      (2 * u ** 3 - 3 * u * u + 1) * a[k] +
      (u ** 3 - 2 * u * u + u) * d * va[k] +
      (-2 * u ** 3 + 3 * u * u) * b[k] +
      (u ** 3 - u * u) * d * vb[k];
  return p;
}
export function titanPiercePosition(from, time, s = {}) {
  return titanWorldPoint(
    s,
    titanPierceLocal(titanLocalPoint(s, from), time, s),
  );
}
export function titanPierceMotion(s, time = s.stageTime) {
  const from = s.cinematicFrom || s.avatar,
    a = titanPiercePosition(from, Math.max(0, time - 0.005), s),
    b = titanPiercePosition(from, Math.min(7, time + 0.005), s);
  return { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z };
}
export function titanDefeatPose(time) {
  const impact = cinemaEase((time - 3.6) / 0.25),
    fall = cinemaEase((time - 4.35) / 2.65);
  return {
    recoil:
      Math.sin(Math.min(1, Math.max(0, (time - 3.6) / 0.65)) * Math.PI) * 0.09,
    fall,
    tilt: -fall * 0.66,
    lift: fall * 23,
    radius: 7.8 * cinemaEase((time - 3.6) / 0.8),
    impact,
  };
}
export function lockTitanCinematics(s) {
  s.config.cinematics = true;
  s.config.mandatoryCinematics = true;
  return s;
}
