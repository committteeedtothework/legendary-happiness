import { sonicSuper } from "./titan-transformation.js";
// A bounded ribbon history, never copies of the character or previous frames.
export function advanceTitanTrails(history, previous, position, s, dt) {
  const active =
    s.config.particles &&
    !sonicSuper(s) &&
    !s.counterScene &&
    s.config.speedTrails !== false &&
    ["traversal", "combat"].includes(s.stage) &&
    (s.boosting || ["dodge", "rush", "loop", "homing"].includes(s.action));
  const distance = previous
    ? Math.hypot(
        position.x - previous.x,
        position.y - previous.y,
        position.z - previous.z,
      )
    : 0;
  if (
    !active ||
    distance > 18 ||
    (history.time != null && s.time < history.time)
  )
    history.segments = [];
  history.time = s.time;
  history.segments = (history.segments || []).filter((q) => (q.life -= dt) > 0);
  history.clock = (history.clock || 0) + Math.max(0, dt);
  if (
    active &&
    previous &&
    dt > 0 &&
    distance > 0.02 &&
    distance < 18 &&
    history.clock >= 1 / 30
  ) {
    history.segments.push({
      a: { ...previous },
      b: { ...position },
      life: 0.14,
    });
    history.clock %= 1 / 30;
  }
  history.segments = history.segments.slice(-8);
  return history.segments;
}
