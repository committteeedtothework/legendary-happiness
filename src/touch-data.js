export function touchConfig(raw = {}) {
  return {
    mode: ["auto", "on", "off"].includes(raw.mode) ? raw.mode : "auto",
    sensitivity: Number.isFinite(raw.sensitivity)
      ? Math.max(0.001, Math.min(0.008, raw.sensitivity))
      : 0.003,
    opacity: Number.isFinite(raw.opacity)
      ? Math.max(0.3, Math.min(1, raw.opacity))
      : 0.8,
  };
}
export function touchVector(x, y, radius = 52) {
  const length = Math.hypot(x, y),
    strength = Math.min(1, length / radius);
  if (strength < 0.12) return { x: 0, y: 0 };
  const m = (strength - 0.12) / 0.88 / (length || 1);
  return { x: x * m, y: y * m };
}
export function touchMovement(g) {
  if (g.touch?.active) return g.touch.move;
  return g.controller?.lastDevice === "controller" ? g.controller.move : null;
}
export function isTouchDevice() {
  return (
    typeof window !== "undefined" &&
    ((navigator.maxTouchPoints > 0 &&
      matchMedia("(pointer: coarse)").matches) ||
      /iPhone|iPad|Android/i.test(navigator.userAgent))
  );
}
export const MOBILE_DEFAULTS = Object.freeze({
  graphics: 1,
  renderDistance: 3,
  distantTerrain: false,
  shadows: false,
  ambientOcclusion: false,
  frameLimit: 30,
  maxPixelRatio: 1,
  particles: "decreased",
  entityDistance: 0.65,
  droppedItemDistance: 0.5,
  blockEntityDistance: 24,
  clouds: false,
});
