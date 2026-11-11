// Shared timing for the two hands; no renderer or timer callbacks drive damage.
export const TITAN_SWEEP = Object.freeze({
  windup: 1.7,
  offset: 0.9,
  swing: 0.6,
  activeStart: 0.08,
  activeEnd: 0.56,
  strike: 1.55,
  recovery: 0.45,
  radius: 6.5,
});
export function titanSweepHand(s, side, clock = s.attackTime) {
  const tell =
      TITAN_SWEEP.windup *
      ({ easy: 1.25, normal: 1, hard: 0.85 }[s.config.difficulty] || 1),
    start = tell + (side === "R" ? TITAN_SWEEP.offset : 0),
    age = clock - start;
  return {
    start,
    end: start + TITAN_SWEEP.swing,
    age,
    progress: Math.max(0, Math.min(1, age / TITAN_SWEEP.swing)),
    active: age >= TITAN_SWEEP.activeStart && age <= TITAN_SWEEP.activeEnd,
  };
}
export function titanSweepPrompt(s) {
  const left = titanSweepHand(s, "L"),
    right = titanSweepHand(s, "R");
  return left.age < 0
    ? "DOUBLE SWEEP · LEFT THEN RIGHT"
    : right.age < 0
      ? "LEFT SWEEP · RIGHT FOLLOWS"
      : right.age < TITAN_SWEEP.swing
        ? "RIGHT SWEEP · DODGE OR PARRY"
        : "RECOVERY";
}
