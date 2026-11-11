// An explicit E ability: continuous approach, one revolution, settle at closure.
// The physical avatar and rendered rig share this path; Q can cancel anywhere.
export const TITAN_CYLOOP = Object.freeze({
  approach: 0.35,
  orbit: 2.4,
  return: 0.35,
  radius: 48,
  centerZ: -7.5,
  duration: 3.1,
  contact: 2.75,
});
const clamp = (x) => Math.max(0, Math.min(1, x));
const ease = (x) => {
  x = clamp(x);
  return x * x * (3 - 2 * x);
};
const mix = (a, b, t) => a + (b - a) * t;
export function makeTitanCyloop(p, center = { x: 0, z: TITAN_CYLOOP.centerZ }, options = {}) {
  return {
    center: { x: center.x, y: center.y, z: center.z },
    plane: options.plane || "xz",
    radius: options.radius || TITAN_CYLOOP.radius,
    from: { x: p.x, y: p.y, z: p.z },
    angle: options.plane === "xy" ? Math.atan2(p.x - center.x, p.y - center.y) : Math.atan2(p.x - center.x, p.z - center.z),
    height: Math.max(24, Math.min(100, p.y)),
  };
}
export function titanCyloopPosition(orbit, time) {
  const center = orbit.center || { x: 0, z: TITAN_CYLOOP.centerZ };
  const c = TITAN_CYLOOP,
    progress = clamp((time - c.approach) / c.orbit),
    angle = orbit.angle + progress * Math.PI * 2,
    radius = orbit.radius || c.radius,
    at = (angle) => orbit.plane === "xy"
      ? {x:center.x + Math.sin(angle)*radius, y:center.y + Math.cos(angle)*radius, z:center.z}
      : {x:center.x + Math.sin(angle)*radius, y:orbit.height, z:center.z + Math.cos(angle)*radius},
    edge = at(orbit.angle);
  if (time < c.approach) {
    const t = ease(time / c.approach);
    return {
      x: mix(orbit.from.x, edge.x, t),
      y: mix(orbit.from.y, edge.y, t),
      z: mix(orbit.from.z, edge.z, t),
      progress: 0,
    };
  }
  if (time > c.contact) {
    return {
      x: edge.x,
      y: edge.y,
      z: edge.z,
      progress: 1,
    };
  }
  return {
    ...at(angle),
    progress,
  };
}
export function titanCyloopLift(s) {
  const remaining = s?.cyloopHold || 0;
  return s?.titan === "wyvern" || !remaining ? 0
    : 4 * ease((4 - remaining) / 0.35) * ease(remaining / 0.65);
}
