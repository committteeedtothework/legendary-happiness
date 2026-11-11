import { B, BLOCKS, MIN_Y, MAX_Y, makeStack } from "./data.js";
import { playWorldSound } from "./spatial-audio.js";
export const EMBEDDED_ARROW_LIMIT = 256,
  EMBEDDED_ARROW_LIFETIME = 1200;
export function restoreEmbeddedArrows(data) {
  if (!Array.isArray(data)) return [];
  return data
    .slice(-EMBEDDED_ARROW_LIMIT)
    .filter(
      (q) =>
        q &&
        q.stuck === true &&
        typeof q.id === "string" &&
        q.id.length <= 120 &&
        [
          q.x,
          q.y,
          q.z,
          q.hit?.x,
          q.hit?.y,
          q.hit?.z,
          q.direction?.x,
          q.direction?.y,
          q.direction?.z,
        ].every(Number.isFinite) &&
        q.y >= MIN_Y - 1 &&
        q.y <= MAX_Y + 2 &&
        Math.hypot(q.direction.x, q.direction.y, q.direction.z) > 0.5,
    )
    .map((q) => ({
      id: q.id,
      x: q.x,
      y: q.y,
      z: q.z,
      stuck: true,
      direction: (() => {
        const n = Math.hypot(q.direction.x, q.direction.y, q.direction.z);
        return {
          x: q.direction.x / n,
          y: q.direction.y / n,
          z: q.direction.z / n,
        };
      })(),
      hit: {
        x: Math.floor(q.hit.x),
        y: Math.floor(q.hit.y),
        z: Math.floor(q.hit.z),
        id: q.hit.id,
      },
      age: Math.max(0, Math.min(EMBEDDED_ARROW_LIFETIME, Number(q.age) || 0)),
      delay: Math.max(0, Math.min(7, Number(q.delay) || 0)),
      playerArrow: q.playerArrow === true,
      recoverable: q.playerArrow === true && q.recoverable === true,
      owner: typeof q.owner === "string" ? q.owner : undefined,
      source: q.source,
      sourceType: q.sourceType,
      encounter: q.encounter,
      damage: Number.isFinite(q.damage) ? q.damage : 4,
    }));
}
export function embedArrow(game, q, wall, from, length) {
  const direction = { x: q.vx / length, y: q.vy / length, z: q.vz / length },
    distance = wall.distance;
  const point = {
    x: from.x + direction.x * distance,
    y: from.y + direction.y * distance,
    z: from.z + direction.z * distance,
  };
  const list = (game.world.embeddedArrows ||= []);
  list.push({
    ...q,
    recoverable: q.playerArrow === true && q.recoverable === true,
    x: point.x - direction.x * 0.27,
    y: point.y - direction.y * 0.27,
    z: point.z - direction.z * 0.27,
    direction,
    hit: {
      x: Number.isFinite(wall.x)
        ? wall.x
        : Math.floor(point.x + direction.x * 0.005),
      y: Number.isFinite(wall.y)
        ? wall.y
        : Math.floor(point.y + direction.y * 0.005),
      z: Number.isFinite(wall.z)
        ? wall.z
        : Math.floor(point.z + direction.z * 0.005),
      id: wall.id,
    },
    stuck: true,
    vx: 0,
    vy: 0,
    vz: 0,
    age: 0,
    delay: 7,
  });
  if (list.length > EMBEDDED_ARROW_LIMIT)
    list.splice(0, list.length - EMBEDDED_ARROW_LIMIT);
}
export function tickEmbeddedArrows(game) {
  if (game.multiplayer?.isGuest) return;
  const list = game.world.embeddedArrows;
  if (!list?.length) return;
  const actors = [
    { player: game.player, inventory: game.inventory, ui: game.ui },
    ...(game.multiplayer?.connected && !game.multiplayer.isGuest
      ? [...game.multiplayer.peers.values()]
      : []),
  ].filter((a) => a.player?.health > 0 && a.inventory);
  const next = [];
  for (const q of list) {
    const near = actors.some(
      (a) => Math.hypot(a.player.x - q.x, a.player.z - q.z) < 64,
    );
    const loaded =
      !game.world.chunks ||
      game.world.chunks.has(
        `${Math.floor(q.hit.x / 16)},${Math.floor(q.hit.z / 16)}`,
      );
    if (!near || !loaded) {
      next.push(q);
      continue;
    }
    q.age++;
    q.delay = Math.max(0, (q.delay || 0) - 1);
    if (q.age >= EMBEDDED_ARROW_LIFETIME) continue;
    const id = game.world.get(q.hit.x, q.hit.y, q.hit.z);
    if (id !== q.hit.id) {
      const wall =
        id !== B.air &&
        BLOCKS[id]?.solid &&
        game.world.raycast?.(q, q.direction, 0.46, true);
      if (
        !wall ||
        wall.x !== q.hit.x ||
        wall.y !== q.hit.y ||
        wall.z !== q.hit.z
      ) {
        const flying = {
          ...q,
          vx: q.direction.x * 0.06,
          vy: Math.min(-0.04, q.direction.y * 0.06),
          vz: q.direction.z * 0.06,
          age: 0,
        };
        delete flying.stuck;
        delete flying.hit;
        delete flying.direction;
        delete flying.delay;
        (game.hostileProjectiles ||= []).push(flying);
        continue;
      }
      q.hit.id = id;
    }
    let picked = false;
    if (q.recoverable && q.delay === 0)
      for (const a of actors) {
        const p = a.player,
          dy = q.y < p.y ? p.y - q.y : Math.max(0, q.y - p.y - 1.8);
        if (
          Math.hypot(p.x - q.x, dy, p.z - q.z) <= 0.9 &&
          a.inventory.add(makeStack("arrow")) === 0
        ) {
          picked = true;
          playWorldSound(game, "pickup", q);
          a.ui?.updateHotbar?.();
          break;
        }
      }
    if (!picked) next.push(q);
  }
  game.world.embeddedArrows = next;
}
