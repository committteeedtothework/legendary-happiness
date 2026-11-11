import { caveDarkness } from "./cave-life.js";
import { survivalPlayers } from "./coop-players.js";
import { HOSTILE_TYPES } from "./data.js";
export function combatClear(world, from, target) {
  const origin = { x: from.x, y: from.y + 1.2, z: from.z },
    dx = target.x - from.x,
    dy = target.y + 1 - origin.y,
    dz = target.z - from.z;
  const length = Math.hypot(dx, dy, dz);
  if (length < 0.01 || !world.raycast) return true;
  const hit = world.raycast(
    origin,
    { x: dx / length, y: dy / length, z: dz / length },
    length,
    true,
  );
  return !hit || hit.distance >= length - 0.25;
}
export function hostileTarget(game, e) {
  if (
    e.type === "spider" &&
    !e.flee &&
    !caveDarkness(game.world, e) &&
    game.time % 24000 < 13000 &&
    game.dimension !== "cinderwild" &&
    !(game.world.weather?.intensity > 0.65)
  )
    return null;
  const candidates = game.entities.filter(
    (t) => t.hp > 0 && (t.type === "villager" || t.type === "iron_golem"),
  );
  candidates.push(...survivalPlayers(game));
  return candidates
    .filter(
      (t) =>
        (!e.anchor ||
          e.type !== "devin_guardian" ||
          Math.hypot(t.x - e.anchor.x, t.z - e.anchor.z) <=
            (game.world.generationVersion >= 10
              ? 48
              : game.world.generationVersion >= 9
                ? 34
                : 25)) &&
        (!e.home ||
          e.encounter !== "matthew-incursion" ||
          Math.hypot(t.x - e.home.x, t.z - e.home.z) <= 38) &&
        (!e.encounter?.startsWith("infernal:") ||
          !e.anchor ||
          Math.hypot(t.x - e.anchor.x, t.z - e.anchor.z) <= 54) &&
        Math.abs(t.y - e.y) < 8 &&
        Math.hypot(t.x - e.x, t.z - e.z) < (e.type === "tiger" ? 12 : 36),
    )
    .sort(
      (a, b) =>
        Math.hypot(a.x - e.x, a.z - e.z) - Math.hypot(b.x - e.x, b.z - e.z),
    )[0];
}
export function golemTarget(game, e) {
  return game.entities
    .filter(
      (t) =>
        t.hp > 0 &&
        HOSTILE_TYPES.has(t.type) &&
        Math.abs(t.y - e.y) < 6 &&
        Math.hypot(t.x - e.x, t.z - e.z) < 24 &&
        (!e.village || Math.hypot(t.x - e.village.x, t.z - e.village.z) < 50),
    )
    .sort(
      (a, b) =>
        Math.hypot(a.x - e.x, a.z - e.z) - Math.hypot(b.x - e.x, b.z - e.z),
    )[0];
}
