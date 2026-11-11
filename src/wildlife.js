import { B, BLOCKS, SEA, HOSTILE_TYPES, MOB_INFO } from "./data.js";
import { hash } from "./random.js";
import { collides } from "./physics.js";
import { wildlifeForBiome } from "./ecology.js";
export const OVERWORLD_WILDLIFE_CAP = 48;
export function wildlifeCount(game) {
  const p = game.player;
  return game.entities.filter(
    (e) =>
      e.hp > 0 &&
      !HOSTILE_TYPES.has(e.type) &&
      !["villager", "iron_golem", "watcher", "boat"].includes(e.type) &&
      Math.hypot(e.x - p.x, e.z - p.z) < 96,
  ).length;
}
export function spawnOverworldWildlife(game, createEntity, initial = false) {
  if (game.dimension && game.dimension !== "overworld") return 0;
  if (!initial && game.tickCount % 120 !== 0) return 0;
  let count = wildlifeCount(game),
    added = 0;
  const limit = Math.min(initial ? 16 : 4, OVERWORLD_WILDLIFE_CAP - count);
  const p = game.player,
    seed = game.world.seedInt,
    tick = game.tickCount || 0;
  for (
    let attempt = 0;
    attempt < (initial ? 48 : 24) && added < limit;
    attempt++
  ) {
    const angle = hash(tick, attempt + 2301, 1, seed) * Math.PI * 2;
    const radius = initial
      ? 10 + hash(tick, attempt, 2, seed) * 19
      : 18 + hash(tick, attempt, 3, seed) * 24;
    const x = Math.floor(p.x + Math.cos(angle) * radius),
      z = Math.floor(p.z + Math.sin(angle) * radius);
    const t = game.world.terrain(x, z);
    if (t.h < SEA || Math.abs(t.h + 1 - p.y) > 48 || t.structure) continue;
    const n = attempt + Math.floor(tick / 120);
    let type = wildlifeForBiome(t.biome, n);
    // Peaceful applies to the initial population as well as later waves.
    if (
      HOSTILE_TYPES.has(type) &&
      (game.difficulty === "peaceful" ||
        initial ||
        hash(tick, attempt, 411, seed) > 0.18 ||
        game.entities.filter((e) => e.hp > 0 && HOSTILE_TYPES.has(e.type))
          .length >= 14)
    )
      type = "cow";
    const e = createEntity(game, type, x, z),
      m = MOB_INFO[type];
    const support = game.world.get(e.x, e.y - 0.01, e.z);
    if (
      !BLOCKS[support]?.solid ||
      BLOCKS[support]?.door ||
      BLOCKS[support]?.fluid ||
      game.world.get(e.x, e.y, e.z) === B.fire ||
      collides(game.world, e, m.height, m.width)
    )
      continue;
    if (
      [p, ...game.entities, ...(game.multiplayer?.occupants?.() || [])].some(
        (v) =>
          v.hp !== 0 &&
          Math.hypot(v.x - e.x, v.z - e.z) <
            (m.width + (MOB_INFO[v.type]?.width || 0.6)) * 0.5 + 0.25 &&
          v.y < e.y + m.height &&
          v.y + (MOB_INFO[v.type]?.height || 1.8) > e.y,
      )
    )
      continue;
    game.entities.push(e);
    added++;
    count++;
  }
  return added;
}
