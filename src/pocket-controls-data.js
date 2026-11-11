export const POCKET_STORAGE = "dcsmcraft-mobile-controls";
export function pocketConfig(raw = {}) {
  if (!raw || typeof raw !== "object") raw = {};
  const clamp = (value, fallback, lo, hi) => Number.isFinite(value)
    ? Math.max(lo, Math.min(hi, value)) : fallback;
  return {
    layout: raw.layout === "dpad" ? "dpad" : "joystick",
    size: clamp(raw.size, 1, 0.85, 1.3),
    sprint: raw.sprint !== false,
    toggleCrouch: raw.toggleCrouch !== false,
    floating: raw.floating === true,
    leftHanded: raw.leftHanded === true,
  };
}
export function pocketStick(x, y, radius, autoSprint = true) {
  const length = Math.hypot(x, y), amount = Math.min(1, length / radius);
  const scale = amount < 0.12 ? 0 : (amount - 0.12) / 0.88 / (length || 1);
  return { x: x * scale, y: y * scale,
    sprint: autoSprint && y < -radius * 1.08 && Math.abs(x) < -y * 0.7 };
}
export function pocketDpad(x, y, radius) {
  let dx = Math.abs(x) > radius * 0.28 ? Math.sign(x) : 0;
  let dy = Math.abs(y) > radius * 0.28 ? Math.sign(y) : 0;
  const n = Math.hypot(dx, dy) || 1;
  return { x: dx / n, y: dy / n };
}
export function pocketWorldMoves(g) {
  const id = g.inventory.held?.id;
  const moves = [];
  if (id === "devin_sword") moves.push(["weapon", "Seeker"]);
  if (id === "matthew_dual_pistols") moves.push(["weapon", "Air Trick"]);
  for (const [name, code] of Object.entries(g.settings.standKeys || {}))
    if (g.player.standData?.id || name === "info")
      moves.push(["stand:" + code, name === "info" ? "Stand" : name]);
  return moves;
}
