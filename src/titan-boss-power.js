export const TITAN_BOSS_POWER = Object.freeze({
  easy: 16,
  normal: 26,
  hard: 38,
});
export function titanBossImpact(s, move = s.attack) {
  const weight =
    {
      swat: 1.15,
      sweep: 1.15,
      spin: 1.2,
      uppercut: 1.25,
      stomp: 1.3,
      pulse: 0.85,
      dorsal: 0.7,
      beam: 1.5,
      crunch: 1.5,
    }[move] || 1;
  const strength =
    weight * (s.phase === 2 ? 1.15 : 1) * (s.config.bossPower ?? 1);
  return {
    move,
    strength,
    ringLoss: Math.round(TITAN_BOSS_POWER[s.config.difficulty] * strength),
  };
}
