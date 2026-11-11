// Point-source ranges are separate from local UI/music and biome ambience.
export const WORLD_SOUND_RANGES = Object.freeze({
  mob: 16,
  hit: 16,
  fuse: 16,
  arrow: 24,
  pistol: 32,
  explosion: 48,
  thunder: 160,
  incursion: 48,
  "guardian-charge": 24,
  "guardian-impact": 24,
  pulse: 24,
  rune: 24,
  open: 12,
  close: 12,
  "door-open": 12,
  "door-close": 12,
});
export function distanceGain(distance, range = 16, near = 1.5) {
  if (!Number.isFinite(distance) || distance >= range) return 0;
  const t = Math.max(0, (distance - near) / (range - near));
  return (1 - t) ** 2;
}
export function soundListenerGame(game) {
  return game.multiplayer?.game || game;
}
export function positionMix(player, source, type = "hit", occluded = false) {
  if (!source || ![source.x, source.z].every(Number.isFinite))
    return { gain: 0, pan: 0, cutoff: 18000, distance: Infinity };
  const dx = source.x - player.x,
    dz = source.z - player.z,
    dy = (Number.isFinite(source.y) ? source.y : player.y) - player.y,
    distance = Math.hypot(dx, dy, dz),
    range = WORLD_SOUND_RANGES[type] || 16;
  return {
    distance,
    gain: distanceGain(distance, range) * (occluded ? 0.35 : 1),
    pan:
      distance > 0.01
        ? Math.max(
            -1,
            Math.min(
              1,
              (dx * Math.cos(player.yaw || 0) -
                dz * Math.sin(player.yaw || 0)) /
                distance,
            ),
          )
        : 0,
    cutoff: occluded ? 1000 : Math.max(1800, 18000 - distance * 420),
  };
}
export function tornadoInfluence(player, funnel) {
  if (!funnel) return 0;
  const base = Number.isFinite(funnel.y) ? funnel.y : player.y;
  const height = funnel.height ?? 58;
  const dy =
    player.y < base ? base - player.y : Math.max(0, player.y - base - height);
  return distanceGain(
    Math.hypot(funnel.x - player.x, dy, funnel.z - player.z),
    96,
    10,
  );
}
export function playWorldSound(game, type, source, surface) {
  if (game.audio?.world) return game.audio.world(game, type, source, surface);
  return game.audio?.tone?.(type, surface);
}
