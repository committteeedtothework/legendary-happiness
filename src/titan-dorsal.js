import { titanWorldPoint } from "./titan-space.js";
import { point } from "./titan-contact.js";
export function titanDorsalState(s) {
  const t = (s.stageTime || 0) % 6;
  return {
    warning: s.phase === 2 && t < 1.25,
    active: s.phase === 2 && t >= 1.25 && t < 2.6,
  };
}
// Shared authored ray envelopes. Rendering attaches the origins to the animated
// sockets; collision uses a generous finite beam rather than old invisible cones.
export function titanDorsalRay(index, s = {}) {
  const rod = Math.floor(index / 3),
    side = rod < 5 ? -1 : 1,
    k = rod % 5,
    lane = index % 3;
  const tilt = 0.12 + k * 0.1,
    length = 15.8 * 1.6;
  const from = point(
    side * (4 + k * 3.4 + Math.sin(tilt) * length),
    76 - k * 0.8 + Math.cos(tilt) * Math.cos(0.25) * length,
    -10 - Math.sin(0.25) * length,
  );
  const angle = -Math.PI / 2 + (rod / 9) * Math.PI + (lane - 1) * 0.18;
  const to = point(
    Math.sin(angle) * (100 + lane * 25),
    132 + lane * 35,
    -65 - Math.cos(angle) * 85,
  );
  return { from: titanWorldPoint(s, from), to: titanWorldPoint(s, to) };
}
