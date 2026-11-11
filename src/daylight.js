const smooth = (a, b, v) => {
  const x = Math.max(0, Math.min(1, (v - a) / (b - a)));
  return x * x * (3 - 2 * x);
};
// Continuous across midnight and tick boundaries. World time remains authoritative.
export function daylightAt(time) {
  const phase = ((((time % 24000) + 24000) % 24000) / 24000) * Math.PI * 2;
  const altitude = Math.sin(phase),
    daylight = smooth(-0.24, 0.24, altitude);
  const warmth = Math.exp(-Math.pow(altitude / 0.24, 2));
  return {
    phase,
    altitude,
    daylight,
    warmth,
    sun: Math.max(0, altitude) * 1.15,
    moon: 0.12 * Math.max(0, -altitude),
    stars: 1 - smooth(-0.38, 0.04, altitude),
  };
}

// Roof and terrain depth distinguish underground chambers from houses and open shafts.
export function caveExposure(world, player) {
  if (!world || world.dimension !== "overworld") return 0;
  const depth = world.terrain(player.x, player.z).h - player.y - 4;
  if (depth <= 0 || world.skyHeight(player.x, player.z) <= player.y + 2)
    return 0;
  return Math.max(0, Math.min(1, depth / 12));
}
