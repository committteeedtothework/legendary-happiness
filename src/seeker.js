import { HOSTILE_TYPES, MOB_INFO } from "./data.js";

const center = (e) => ({
  x: e.x,
  y: e.y + (MOB_INFO[e.type]?.height || 1.8) * 0.55,
  z: e.z,
});
function visible(world, from, to) {
  const dx = to.x - from.x,
    dy = to.y - from.y,
    dz = to.z - from.z;
  const d = Math.hypot(dx, dy, dz);
  if (d < 0.01) return true;
  const wall = world.raycast(
    from,
    { x: dx / d, y: dy / d, z: dz / d },
    d,
    true,
  );
  return !wall || wall.distance >= d - 0.08;
}
function acquire(game, from, range) {
  let best,
    distance = range;
  for (const e of game.entities) {
    if (e.hp <= 0 || !HOSTILE_TYPES.has(e.type)) continue;
    const c = center(e),
      d = Math.hypot(c.x - from.x, c.y - from.y, c.z - from.z);
    if (d < distance && visible(game.world, from, c)) {
      best = e;
      distance = d;
    }
  }
  return best;
}
export function launchSeeker(game) {
  const p = game.player;
  if (game.inventory.held?.id !== "devin_sword" || p.health <= 0) return false;
  const remaining = (p.devinSeekerTick || 0) - game.tickCount;
  if (remaining > 0) {
    game.ui?.toast(
      `Devin's Seeker recharges in ${Math.ceil(remaining / 20)} seconds.`,
    );
    return false;
  }
  const origin = { x: p.x, y: p.y + 1.35, z: p.z },
    target = acquire(game, origin, 28);
  if (!target) {
    game.ui?.toast("Devin's Seeker · no visible hostile within 28 blocks.");
    return false;
  }
  const c = center(target),
    d = Math.hypot(c.x - origin.x, c.y - origin.y, c.z - origin.z) || 1;
  (game.seekers ||= []).push({
    ...origin,
    ox: origin.x,
    oy: origin.y,
    oz: origin.z,
    vx: (c.x - origin.x) / d,
    vy: (c.y - origin.y) / d,
    vz: (c.z - origin.z) / d,
    target: target.id,
    life: 80,
  });
  p.devinSeekerTick = game.tickCount + 280;
  game.renderer?.action("use");
  game.audio?.tone("seeker");
  game.ui?.toast("Devin's Seeker · tracking a hostile");
  return true;
}
// Fixed 20 Hz swept collision: steering never teleports a bolt through a wall.
export function tickSeekers(game, damage) {
  game.seekers = (game.seekers || []).filter((q) => {
    if (--q.life <= 0) return false;
    let target = game.entities.find(
      (e) => e.id === q.target && e.hp > 0 && HOSTILE_TYPES.has(e.type),
    );
    if (!target) {
      target = acquire(game, q, 12);
      if (target) q.target = target.id;
    }
    if (target) {
      const c = center(target),
        dx = c.x - q.x,
        dy = c.y - q.y,
        dz = c.z - q.z,
        d = Math.hypot(dx, dy, dz) || 1;
      q.vx = q.vx * 0.66 + (dx / d) * 0.34;
      q.vy = q.vy * 0.66 + (dy / d) * 0.34;
      q.vz = q.vz * 0.66 + (dz / d) * 0.34;
    }
    const n = Math.hypot(q.vx, q.vy, q.vz) || 1;
    q.vx /= n;
    q.vy /= n;
    q.vz /= n;
    const step = 0.9,
      wall = game.world.raycast(q, { x: q.vx, y: q.vy, z: q.vz }, step, true);
    let hit,
      nearest = wall ? wall.distance : step + 0.001;
    for (const e of game.entities) {
      if (e.hp <= 0 || !HOSTILE_TYPES.has(e.type)) continue;
      const c = center(e),
        along = Math.max(
          0,
          Math.min(
            step,
            (c.x - q.x) * q.vx + (c.y - q.y) * q.vy + (c.z - q.z) * q.vz,
          ),
        );
      const radius = Math.max(0.35, (MOB_INFO[e.type]?.width || 0.6) * 0.6);
      if (
        along < nearest &&
        Math.hypot(
          c.x - q.x - q.vx * along,
          c.y - q.y - q.vy * along,
          c.z - q.z - q.vz * along,
        ) < radius
      ) {
        hit = e;
        nearest = along;
      }
    }
    q.x += q.vx * Math.min(step, nearest);
    q.y += q.vy * Math.min(step, nearest);
    q.z += q.vz * Math.min(step, nearest);
    if (hit || wall) {
      if (hit) damage(game, hit, 12, { knockback: 2.5 });
      game.renderer?.arcane?.burst({ x: q.x, y: q.y - 1, z: q.z }, 24);
      return false;
    }
    if (game.settings?.particles !== "minimal")
      for (let i = 0; i < 4; i++)
        game.renderer?.arcane?.emit(
          q.x - q.vx * i * 0.2,
          q.y - q.vy * i * 0.2,
          q.z - q.vz * i * 0.2,
          0,
          0.05,
          0,
          0.28,
          i % 2 ? [0.65, 0.4, 1] : [0.3, 1, 1],
        );
    return Math.hypot(q.x - q.ox, q.y - q.oy, q.z - q.oz) < 42;
  });
}
