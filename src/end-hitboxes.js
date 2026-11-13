// Rendered perch necks lower the head to striking height. Keep the head region
// distinct from the body so the visible snout can be hit without aiming inside.
export function dragoonHead(e) {
  const perch = e.mode === "perch" || e.mode === "approach";
  return {
    x: e.x - Math.sin(e.yaw || 0) * 11,
    y: e.y + (perch ? 0.8 : 3.8),
    z: e.z - Math.cos(e.yaw || 0) * 11,
  };
}
