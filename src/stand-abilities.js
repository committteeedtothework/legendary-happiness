import { STANDS, STAND_ARTIFACTS } from "./stands-data.js";
import { HOSTILE_TYPES, MOB_INFO } from "./data.js";
import { collides, moveBody } from "./physics.js";
import { doorAt, setDoorOpen, rayBounds } from "./doors.js";

export function standRecord(player) {
  if (
    !player.standData ||
    typeof player.standData !== "object" ||
    Array.isArray(player.standData)
  )
    player.standData = {};
  const s = player.standData;
  if (!STANDS[s.id]) s.id = null;
  if (typeof s.summoned !== "boolean") s.summoned = false;
  for (const [key, value] of Object.entries({
    energy: 100,
    level: 1,
    xp: 0,
    serial: 0,
    failures: 0,
  }))
    if (!Number.isFinite(s[key]) || s[key] < 0) s[key] = value;
  s.energy = Math.min(130, s.energy);
  s.level = Math.max(1, Math.min(5, Math.floor(s.level)));
  if (
    !s.cooldowns ||
    typeof s.cooldowns !== "object" ||
    Array.isArray(s.cooldowns)
  )
    s.cooldowns = {};
  if (s.trial === undefined) s.trial = null;
  return s;
}
export function standMaxEnergy(g, p = g.player) {
  const artifacts = Object.entries(STAND_ARTIFACTS).reduce(
    (sum, [id, def]) =>
      sum +
      (g.inventory?.slots?.some((s) => s?.id === id)
        ? def.energyBonus || 0
        : 0),
    0,
  );
  return (
    100 +
    Math.min(4, Math.max(0, (p.standData?.level || 1) - 1)) * 5 +
    artifacts
  );
}
export function standHeight(p) {
  return p.standData?.transformed ? 1.25 : p.crouching ? 1.5 : 1.8;
}
export function standWidth(p) {
  return p.standData?.transformed ? 0.9 : 0.6;
}
export function standLocked(g) {
  return (g.player.standData?.awakeningUntil || 0) > (g.tickCount || 0);
}
const direction = (p) => ({
  x: -Math.sin(p.yaw) * Math.cos(p.pitch),
  y: Math.sin(p.pitch),
  z: -Math.cos(p.yaw) * Math.cos(p.pitch),
});
const eye = (p) => ({
  x: p.x,
  y: p.y + (p.standData?.transformed ? 1.05 : 1.5),
  z: p.z,
});
export function standVisible(world, a, b) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    dz = b.z - a.z,
    d = Math.hypot(dx, dy, dz);
  if (d < 0.01) return true;
  const hit = world.raycast(a, { x: dx / d, y: dy / d, z: dz / d }, d, true);
  return !hit || hit.distance >= d - 0.1;
}
export function protectedPoint(g, p) {
  const trial = (
    g.dimension === "cinderwild" ? g.realms?.overworld?.world : g.world
  )?.settlements?.["matthew-incursion"]?.trial;
  if (trial && ["active", "victory"].includes(trial.phase)) return true;
  return (g.world.protectedAreas || []).some(
    (r) => Math.hypot(p.x - r.x, p.z - r.z) < r.radius,
  );
}
export function standTravel(g, destination, maxDistance) {
  const p = g.player,
    dx = destination.x - p.x,
    dy = destination.y - p.y,
    dz = destination.z - p.z,
    d = Math.hypot(dx, dy, dz);
  if (d < 0.3 || d > maxDistance + 0.01 || protectedPoint(g, p)) return false;
  const height = standHeight(p),
    width = standWidth(p),
    count = Math.ceil(d / 0.15),
    start = { x: p.x, y: p.y, z: p.z };
  let steps = 0;
  for (let i = 1; i <= count; i++) {
    const q = {
      x: start.x + (dx * i) / count,
      y: start.y + (dy * i) / count,
      z: start.z + (dz * i) / count,
    };
    if (protectedPoint(g, q) || collides(g.world, q, height, width)) break;
    steps = i;
  }
  if ((steps / count) * d < 0.5) return false;
  Object.assign(p, {
    x: start.x + (dx * steps) / count,
    y: start.y + (dy * steps) / count,
    z: start.z + (dz * steps) / count,
    vx: 0,
    vy: 0,
    vz: 0,
    onGround: false,
    fallStart: p.y,
  });
  p.fallStart = p.y;
  g.standTeleported?.();
  return true;
}
function effect(g, kind, target) {
  const s = standRecord(g.player);
  s.effect = {
    kind,
    tick: g.tickCount,
    x: target?.x ?? g.player.x,
    y: target?.y ?? g.player.y,
    z: target?.z ?? g.player.z,
  };
  g.audio?.standSound?.(kind);
  g.renderer?.action?.("use");
}
function fire(g, spread = 0, damage = 6) {
  const p = g.player,
    d = direction(p),
    a = p.yaw + spread;
  d.x = -Math.sin(a) * Math.cos(p.pitch);
  d.z = -Math.cos(a) * Math.cos(p.pitch);
  (g.standProjectiles ||= []).push({
    ...eye(p),
    vx: d.x * 1.2,
    vy: d.y * 1.2,
    vz: d.z * 1.2,
    life: 20,
    damage,
    owner: p.standData.soul,
    spin: 0,
  });
}
function targeted(g, range, filter) {
  const p = g.player,
    a = eye(p),
    d = direction(p);
  return g.entities
    .filter((e) => e.hp > 0 && filter(e))
    .map((e) => {
      const b = {
          x: e.x,
          y: e.y + (MOB_INFO[e.type]?.height || 1.8) * 0.5,
          z: e.z,
        },
        dx = b.x - a.x,
        dy = b.y - a.y,
        dz = b.z - a.z,
        along = dx * d.x + dy * d.y + dz * d.z;
      return {
        e,
        b,
        along,
        miss: Math.hypot(dx - d.x * along, dy - d.y * along, dz - d.z * along),
      };
    })
    .filter(
      (o) =>
        o.along > 0 &&
        o.along < range &&
        o.miss < 1 &&
        standVisible(g.world, a, o.b),
    )
    .sort((a, b) => a.along - b.along)[0]?.e;
}
export const STAND_ACTIONS = {
  tusk: [
    (g) => {
      fire(g);
      return true;
    },
    (g) => {
      for (const a of [-0.12, 0, 0.12]) fire(g, a, 4);
      return true;
    },
  ],
  lonesome: [
    (g) => {
      const p = g.player,
        a = eye(p),
        d = direction(p);
      const drops = g.drops
        .filter(
          (o) =>
            o.count > 0 &&
            Math.hypot(o.x - p.x, o.y - p.y, o.z - p.z) < 12 &&
            standVisible(g.world, a, o),
        )
        .sort(
          (a, b) =>
            Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z),
        );
      for (const drop of drops) {
        const old = drop.count;
        drop.count = g.inventory.add(drop);
        if (drop.count < old) {
          effect(g, "rope", drop);
          g.ui?.updateHotbar?.();
          return true;
        }
      }
      const target = g.world.raycast(a, d, 12, true),
        door = target && doorAt(g.world, target.x, target.y, target.z);
      if (
        door &&
        !protectedPoint(g, { x: target.x, y: target.y, z: target.z })
      ) {
        setDoorOpen(g.world, door, !door.open);
        effect(g, "rope", target);
        return true;
      }
      return false;
    },
    (g) => {
      const a = eye(g.player),
        d = direction(g.player),
        t = g.world.raycast(a, d, 12, true);
      if (!t) return false;
      const distance = Math.max(0, t.distance - 0.9),
        point = {
          x: g.player.x + d.x * distance,
          y: g.player.y + d.y * distance,
          z: g.player.z + d.z * distance,
        };
      if (!standTravel(g, point, 12)) return false;
      effect(g, "rope", t);
      return true;
    },
  ],
  monsters: [
    (g) => {
      const s = standRecord(g.player);
      if (s.transformed) {
        s.transformUntil = 0;
        return true;
      }
      if (collides(g.world, g.player, 1.25, 0.9)) return false;
      s.transformed = true;
      s.transformUntil = g.tickCount + 300;
      return true;
    },
    (g, damage) => {
      let n = 0;
      for (const e of g.entities)
        if (
          e.hp > 0 &&
          HOSTILE_TYPES.has(e.type) &&
          Math.hypot(e.x - g.player.x, e.y - g.player.y, e.z - g.player.z) <
            4 &&
          standVisible(g.world, eye(g.player), { x: e.x, y: e.y + 1, z: e.z })
        ) {
          damage(g, e, 5, { kind: "stand", knockback: 0.8 });
          n++;
        }
      return n > 0;
    },
  ],
  cream: [
    (g) => {
      if (g.player.health >= 20) return false;
      g.player.health = Math.min(20, g.player.health + 4);
      return true;
    },
    (g) => {
      const a = eye(g.player),
        friends = (g.standFriends?.() || []).filter(
          (p) =>
            p !== g.player &&
            p.health > 0 &&
            p.health < 20 &&
            Math.hypot(p.x - g.player.x, p.y - g.player.y, p.z - g.player.z) <
              4 &&
            standVisible(g.world, a, { x: p.x, y: p.y + 1, z: p.z }),
        );
      if (friends[0]) {
        friends[0].health = Math.min(20, friends[0].health + 4);
        return true;
      }
      const e = targeted(g, 4, (e) => !HOSTILE_TYPES.has(e.type));
      if (!e) return false;
      const max = MOB_INFO[e.type]?.health || 10;
      if (e.hp >= max) return false;
      e.hp = Math.min(max, e.hp + 4);
      return true;
    },
  ],
  d4c: [
    (g) => {
      const p = g.player,
        d = direction(p),
        start = { x: p.x, y: p.y, z: p.z };
      if (
        !standTravel(
          g,
          { x: p.x + d.x * 9, y: p.y + d.y * 9, z: p.z + d.z * 9 },
          9,
        )
      )
        return false;
      standRecord(p).rift = { ...start, until: g.tickCount + 100 };
      effect(g, "rift", start);
      return true;
    },
    (g) => {
      const s = standRecord(g.player),
        r = s.rift;
      if (!r || r.until < g.tickCount || !standTravel(g, r, 12)) return false;
      delete s.rift;
      return true;
    },
  ],
};
export function grantCreativeStand(g, id) {
  if (g.mode !== "creative" || !STANDS[id] || g.player.health <= 0)
    return false;
  if (
    g.player.standData?.transformed &&
    collides(g.world, g.player, 1.8, 0.6)
  ) {
    g.ui?.toast?.("Find headroom before changing your transformed body.");
    return false;
  }
  const s = standRecord(g.player);
  Object.assign(s, {
    id,
    summoned: true,
    energy: 100,
    level: 1,
    xp: 0,
    cooldowns: {},
    trial: null,
    transformed: false,
    awakeningUntil: 0,
    rift: null,
    effect: null,
  });
  g.save?.()?.catch?.(() => g.ui?.toast?.("Could not save Stand selection."));
  return true;
}
export function activateStand(g, slot, damage) {
  const p = g.player,
    s = standRecord(p),
    stand = STANDS[s.id];
  const fail = (message) => {
    g.ui?.toast?.(message);
    return false;
  };
  if (!stand || p.health <= 0 || standLocked(g))
    return fail("No awakened Stand is ready.");
  if (slot === "summon") {
    s.summoned = !s.summoned;
    effect(g, s.summoned ? "summon" : "dismiss");
    g.save?.()?.catch?.(() => {});
    return true;
  }
  if (!s.summoned) return fail("Summon your Stand first.");
  if (!["primary", "secondary"].includes(slot)) return false;
  const a = stand[slot],
    ready = s.cooldowns?.[slot] || 0;
  if (ready > g.tickCount)
    return fail(
      `${a.name}: ${Math.ceil((ready - g.tickCount) / 20)}s cooldown.`,
    );
  if (s.energy < a.cost) return fail(`${a.name}: needs ${a.cost} energy.`);
  if (!STAND_ACTIONS[s.id]?.[slot === "primary" ? 0 : 1]?.(g, damage))
    return fail(`${a.name}: no valid target, clear path or healing needed.`);
  s.energy -= a.cost;
  (s.cooldowns ||= {})[slot] = g.tickCount + a.cooldown;
  s.xp = (s.xp || 0) + 1;
  s.level = Math.min(5, 1 + Math.floor(s.xp / 20));
  const target = s.effect?.tick === g.tickCount ? { ...s.effect } : null;
  effect(
    g,
    s.id === "lonesome"
      ? "rope"
      : s.id === "d4c"
        ? "rift"
        : s.id === "cream"
          ? "heal"
          : s.id === "monsters"
            ? "roar"
            : "nail",
    target,
  );
  g.ui?.toast?.(`${stand.name} · ${a.name}`);
  g.ui?.updateHUD?.();
  return true;
}
export function tickStand(g) {
  const s = g.player.standData;
  if (!s) return;
  if (g.player.health <= 0) {
    s.summoned = false;
    s.transformUntil = 0;
    s.transformed = false;
    s.trial = null;
    return;
  }
  if (s.id)
    s.energy = Math.min(standMaxEnergy(g), Math.max(0, (s.energy || 0) + 0.12));
  if (s.transformed && g.tickCount >= s.transformUntil) {
    if (!collides(g.world, g.player, 1.8, 0.6)) s.transformed = false;
    else {
      // Never restore a tall collision body into a low ceiling.
      s.transformUntil = g.tickCount + 10;
      s.returnBlocked = true;
    }
  } else s.returnBlocked = false;
  if (s.awakeningUntil && g.tickCount >= s.awakeningUntil)
    delete s.awakeningUntil;
}
export function tickStandProjectiles(game, damage) {
  game.standProjectiles = (game.standProjectiles || []).filter((q) => {
    if (--q.life < 0) return false;
    const a = { x: q.x, y: q.y, z: q.z },
      d = Math.hypot(q.vx, q.vy, q.vz),
      v = { x: q.vx / d, y: q.vy / d, z: q.vz / d },
      wall = game.world.raycast(a, v, d, true);
    let hit,
      near = wall?.distance ?? d + 0.01;
    for (const e of game.entities) {
      if (e.hp <= 0 || !HOSTILE_TYPES.has(e.type)) continue;
      const height = MOB_INFO[e.type]?.height || 1.8,
        width = (MOB_INFO[e.type]?.width || 0.6) / 2;
      const contact = rayBounds(
        a,
        v,
        e.x,
        e.y,
        e.z,
        [-width, 0, -width, width, height, width],
        d,
      );
      if (contact && contact.distance <= near) {
        hit = e;
        near = contact.distance;
      }
    }
    if (hit) {
      const source =
        game.player.standData?.soul === q.owner
          ? game
          : [...(game.multiplayer?.peers?.values() || [])].find(
              (p) => p.player.standData?.soul === q.owner,
            )?.context;
      if (source && source.player.health > 0)
        damage(source, hit, q.damage, {
          kind: "stand",
          source: source.player,
          knockback: 0.18,
        });
      return false;
    }
    if (wall) {
      game.renderer?.arcane?.emit?.(
        q.x + v.x * wall.distance,
        q.y + v.y * wall.distance,
        q.z + v.z * wall.distance,
        -v.x * 0.25,
        0.35,
        -v.z * 0.25,
        0.25,
        [1, 0.8, 0.5],
      );
      return false;
    }
    q.x += q.vx;
    q.y += q.vy;
    q.z += q.vz;
    q.spin += 0.8;
    return true;
  });
}
