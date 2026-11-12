import { sonicLength } from "./titan-metrics.js";
export function sonicCurled(s) {
  return (
    (s.strike?.homing && s.strike.homing.phase !== "recovery") ||
    (s.stage === "traversal" &&
      !s.emerald &&
      !s.climb?.attached &&
      !["wall_run", "stomp"].includes(s.action) &&
      (!s.avatar.onGround || s.traversalKit?.roll > 0))
  );
}
export function sonicCollider(s) {
  return {
    radius: sonicLength(s, sonicCurled(s) ? 1.02 : 0.8),
    height: sonicLength(s, sonicCurled(s) ? 2.2 : 3.7),
  };
}
