import { B, BLOCKS, MOB_INFO } from "./data.js";
import { farmScale } from "./livestock-data.js";
import { collides, moveBody } from "./physics.js";

export const MATTHEW = "matthew_dual_pistols";
export const holdsPistols = (g) => g.inventory.held?.id === MATTHEW;
export function pistolUsesStyle(g) {
  if (!holdsPistols(g)) return false;
  if (g.player.crouching) return true;
  const id = g.target?.id;
  return (
    !BLOCKS[id]?.door &&
    !BLOCKS[id]?.relic &&
    ![
      B.matthew_altar,
      B.crafting_table,
      B.jukebox,
      B.chest,
      B.furnace,
      B.enchanting_table,
      B.bed,
    ].includes(id) &&
    g.targetEntity?.()?.type !== "villager"
  );
}

const direction = (p) => ({
  x: -Math.sin(p.yaw) * Math.cos(p.pitch),
  y: Math.sin(p.pitch),
  z: -Math.cos(p.yaw) * Math.cos(p.pitch),
});
const eye = (p) => ({ x: p.x, y: p.y + (p.crouching ? 1.35 : 1.62), z: p.z });
// Slab intersection against the entire creature body, including small animals.
export function rayBody(origin, dir, e, reach) {
  const half = ((MOB_INFO[e.type]?.width || 0.6) * farmScale(e)) / 2;
  const min = { x: e.x - half, y: e.y, z: e.z - half },
    max = {
      x: e.x + half,
      y: e.y + (MOB_INFO[e.type]?.height || 1.8) * farmScale(e),
      z: e.z + half,
    };
  let near = 0,
    far = reach;
  for (const a of ["x", "y", "z"]) {
    if (Math.abs(dir[a]) < 1e-9) {
      if (origin[a] < min[a] || origin[a] > max[a]) return null;
      continue;
    }
    let lo = (min[a] - origin[a]) / dir[a],
      hi = (max[a] - origin[a]) / dir[a];
    if (lo > hi) [lo, hi] = [hi, lo];
    near = Math.max(near, lo);
    far = Math.min(far, hi);
    if (near > far) return null;
  }
  return near;
}
export function firePistols(g, damage) {
  const p = g.player;
  if (
    !holdsPistols(g) ||
    p.health <= 0 ||
    (p.matthewShotTick || 0) > g.tickCount
  )
    return false;
  const from = eye(p),
    dir = direction(p),
    wall = g.world.raycast(from, dir, 40, true);
  let distance = wall?.distance ?? 40,
    victim = null;
  for (const e of g.entities) {
    if (e.hp <= 0) continue;
    const t = rayBody(from, dir, e, distance);
    if (t !== null && t < distance) {
      distance = t;
      victim = e;
    }
  }
  p.matthewShotTick = g.tickCount + 4;
  p.matthewHand = 1 - (p.matthewHand || 0);
  const to = {
    x: from.x + dir.x * distance,
    y: from.y + dir.y * distance,
    z: from.z + dir.z * distance,
  };
  // Muzzle-to-impact obstruction also matters when the barrel is beside a wall.
  const side = p.matthewHand ? 1 : -1,
    muzzle = {
      x: from.x + Math.cos(p.yaw) * 0.24 * side,
      y: from.y - 0.14,
      z: from.z - Math.sin(p.yaw) * 0.24 * side,
    };
  const len =
    Math.hypot(to.x - muzzle.x, to.y - muzzle.y, to.z - muzzle.z) || 1;
  const md = {
    x: (to.x - muzzle.x) / len,
    y: (to.y - muzzle.y) / len,
    z: (to.z - muzzle.z) / len,
  };
  const blocked = g.world.raycast(muzzle, md, len, true);
  if (blocked && blocked.distance < len - 0.04) {
    victim = null;
    for (const a of ["x", "y", "z"])
      to[a] = muzzle[a] + md[a] * blocked.distance;
  }
  if (victim)
    damage(g, victim, 5, { kind: "bullet", knockback: 0.12, source: { ...p } });
  (g.pistolTraces ||= []).push({
    from: muzzle,
    to,
    life: 3,
    hand: p.matthewHand,
  });
  if (g.pistolTraces.length > 24) g.pistolTraces.shift();
  g.renderer?.action?.("fire");
  g.audio?.tone?.("pistol", p.matthewHand ? "silver" : "black");
  return true;
}
export function tickPistolTraces(g) {
  g.pistolTraces = (g.pistolTraces || []).filter((q) => --q.life > 0);
}
export function styleCharges(p, tick) {
  p.tricksterRecharges = (p.tricksterRecharges || [])
    .filter((t) => Number.isFinite(t) && t > tick)
    .slice(0, 2);
  return 2 - p.tricksterRecharges.length;
}
function spend(g) {
  (g.player.tricksterRecharges ||= []).push(g.tickCount + 40);
}
export function tricksterMove(g, blink = false) {
  const p = g.player,
    w = g.world;
  if (!holdsPistols(g) || p.health <= 0 || p.flying || p.inWater || p.inLava)
    return false;
  if (p.tricksterDash || !styleCharges(p, g.tickCount)) {
    g.ui?.toast?.("Trickster · recharging");
    return false;
  }
  const start = { x: p.x, y: p.y, z: p.z, yaw: p.yaw };
  let visualKind = blink ? "air-trick" : p.onGround ? "dash" : "sky-star";
  if (blink) {
    if ((p.tricksterBlinkTick || 0) > g.tickCount) return false;
    const from = eye(p),
      dir = direction(p),
      wall = w.raycast(from, dir, 18, true);
    let target = null,
      nearest = wall?.distance ?? 18;
    for (const e of g.entities) {
      if (e.hp <= 0) continue;
      const hit = rayBody(from, dir, e, nearest);
      if (hit !== null && hit < nearest) {
        nearest = hit;
        target = e;
      }
    }
    let end;
    if (target) {
      const d = Math.hypot(target.x - p.x, target.z - p.z) || 1;
      end = {
        x: target.x + ((p.x - target.x) / d) * 1.8,
        y: target.y,
        z: target.z + ((p.z - target.z) / d) * 1.8,
      };
    } else {
      // Free aim uses the same range and cooldown as target acquisition. Looking
      // down while grounded follows the ground plane instead of entering the floor.
      const reach = Math.max(
        0,
        Math.min(18, (wall?.distance ?? 18) - (wall ? 0.35 : 0)),
      );
      const free = { ...dir, y: p.onGround && dir.y < 0 ? 0 : dir.y };
      const steps = Math.max(1, Math.ceil(reach / 0.12));
      end = { x: p.x, y: p.y, z: p.z };
      for (let i = 1; i <= steps; i++) {
        const next = {
          x: p.x + (free.x * reach * i) / steps,
          y: p.y + (free.y * reach * i) / steps,
          z: p.z + (free.z * reach * i) / steps,
        };
        if (collides(w, next, p.crouching ? 1.5 : 1.8)) break;
        end = next;
      }
      if (Math.hypot(end.x - p.x, end.y - p.y, end.z - p.z) < 0.6) {
        g.ui?.toast?.("Air Trick · not enough clear space");
        return false;
      }
    }
    const length = Math.hypot(end.x - p.x, end.y - p.y, end.z - p.z),
      n = Math.max(1, Math.ceil(length / 0.12));
    for (let i = 1; i <= n; i++)
      if (
        collides(
          w,
          {
            x: p.x + ((end.x - p.x) * i) / n,
            y: p.y + ((end.y - p.y) * i) / n,
            z: p.z + ((end.z - p.z) * i) / n,
          },
          p.crouching ? 1.5 : 1.8,
        )
      ) {
        g.ui?.toast?.("Air Trick · the path is obstructed");
        return false;
      }
    const old = { ...p };
    Object.assign(p, end, { vx: 0, vy: 0, vz: 0, onGround: false });
    p.fallStart = Math.max(p.fallStart ?? old.y, p.y);
    p.tricksterBlinkTick = g.tickCount + 100;
    g.renderer?.arcane?.burst?.(old, 20);
    g.renderer?.arcane?.burst?.(p, 20);
    g.ui?.toast?.("AIR TRICK");
  } else {
    if (p.onGround) {
      p.tricksterAirUsed = false;
      p.tricksterWallUsed = false;
    }
    const nearWall = [
      [-0.14, 0],
      [0.14, 0],
      [0, -0.14],
      [0, 0.14],
    ].some(([x, z]) =>
      collides(w, { ...p, x: p.x + x, z: p.z + z }, p.crouching ? 1.5 : 1.8),
    );
    if (
      !p.onGround &&
      g.keys?.has("Space") &&
      nearWall &&
      !p.tricksterWallUsed
    ) {
      visualKind = "wall-hike";
      p.tricksterWallUsed = true;
      p.vy = 11;
      g.ui?.toast?.("WALL HIKE");
    } else {
      if (!p.onGround && p.tricksterAirUsed) {
        g.ui?.toast?.("Sky Star · land before another air dash");
        return false;
      }
      const f = (g.keys?.has("KeyW") ? 1 : 0) - (g.keys?.has("KeyS") ? 1 : 0),
        s = (g.keys?.has("KeyD") ? 1 : 0) - (g.keys?.has("KeyA") ? 1 : 0),
        n = Math.hypot(f, s) || 1;
      const forward = f === 0 && s === 0 ? 1 : f;
      p.tricksterDash = {
        x: (-Math.sin(p.yaw) * forward + Math.cos(p.yaw) * s) / n,
        z: (-Math.cos(p.yaw) * forward - Math.sin(p.yaw) * s) / n,
        left: 0.2,
      };
      if (!p.onGround) {
        p.tricksterAirUsed = true;
        p.vy = Math.max(0, p.vy);
      }
      g.ui?.toast?.(p.onGround ? "DASH" : "SKY STAR");
    }
  }
  spend(g);
  g.renderer?.tricksterEffect?.(visualKind, start, p, p.tricksterDash);
  g.renderer?.action?.("use");
  g.audio?.tone?.("trickster");
  return true;
}
// Runs at the same fixed 60 Hz as walking. Small sweeps prevent tunnelling.
export function updateTrickster(g, dt) {
  const p = g.player;
  if (p.onGround) {
    p.tricksterAirUsed = false;
    p.tricksterWallUsed = false;
  }
  const dash = p.tricksterDash;
  if (!dash) return;
  if (!holdsPistols(g) || p.health <= 0 || !g.running) {
    delete p.tricksterDash;
    return;
  }
  const from = { x: p.x, y: p.y, z: p.z, yaw: p.yaw };
  const distance = Math.min(dt, dash.left) * 21,
    n = Math.max(1, Math.ceil(distance / 0.12));
  for (let i = 0; i < n; i++)
    moveBody(
      g.world,
      p,
      (dash.x * distance) / n,
      0,
      (dash.z * distance) / n,
      p.crouching ? 1.5 : 1.8,
      0.6,
      0,
    );
  g.renderer?.tricksterTrail?.(from, p);
  dash.left -= dt;
  if (dash.left <= 0) delete p.tricksterDash;
}
