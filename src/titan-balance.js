export const TITAN_BALANCE = 6;
export const TITAN_HEALTH = Object.freeze({
  easy: 80000,
  normal: 120000,
  hard: 160000,
});
export const TITAN_POWER_SCALE = 5;
const previous = {
  homing: 90,
  shot: 45,
  cross: 125,
  basic: 34,
  combo: 42,
  heavy: 62,
  finisher: 120,
  boom: 145,
  rush: 95,
  loop: 185,
  counter: 300,
  perfectCounter: 460,
  struggle: 300,
};
export const TITAN_POWER = Object.freeze({
  homing: 500,
  shot: 210,
  cross: 680,
  basic: 180,
  combo: 235,
  heavy: 360,
  finisher: 760,
  boom: 300,
  stomp: 1300,
  spin: 300,
  cyclone: 420,
  rush: 540,
  loop: 1400,
  counter: 1900,
  perfectCounter: 2900,
  struggle: 2300,
});
// Apply once at the save boundary. Preserve player-authored relative tuning.
export function upgradeTitanCombat(raw = {}) {
  raw = raw && typeof raw === "object" ? raw : {};
  if (raw.combatRevision === TITAN_BALANCE) return raw;
  return {
    ...raw,
    combatRevision: TITAN_BALANCE,
    ...(raw.damage
      ? {
          damage: Object.fromEntries(
            Object.entries(TITAN_POWER).map(([k, v]) => [
              k,
              Number.isFinite(raw.damage[k])
                ? (raw.damage[k] * v) /
                  (raw.combatRevision >= 5
                    ? TITAN_POWER[k]
                    : raw.combatRevision === 4
                      ? {
                          homing: 500,
                          shot: 210,
                          cross: 680,
                          basic: 180,
                          combo: 235,
                          heavy: 360,
                          finisher: 760,
                          boom: 820,
                          rush: 540,
                          loop: 1400,
                          counter: 1900,
                          perfectCounter: 2900,
                          struggle: 2300,
                        }[k] || v
                      : previous[k] || v)
                : v,
            ]),
          ),
        }
      : {}),
  };
}
