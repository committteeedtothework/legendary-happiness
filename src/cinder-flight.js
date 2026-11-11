import { playWorldSound } from "./spatial-audio.js";
import { MOB_INFO, HOSTILE_TYPES } from "./data.js";
import { hash } from "./random.js";
import { moveBody, collides } from "./physics.js";
import { survivalPlayers } from "./coop-players.js";

export const cinderThreatCap = (difficulty) =>
  difficulty === "easy" ? 18 : difficulty === "hard" ? 32 : 26;

export function spawnFliers(game, createEntity) {
  if (
    game.dimension !== "cinderwild" ||
    game.difficulty === "peaceful" ||
    game.tickCount % 100 !== 0
  )
    return;
  if (
    game.entities.filter(
      (e) =>
        MOB_INFO[e.type]?.flying &&
        e.hp > 0 &&
        Math.hypot(e.x - game.player.x, e.z - game.player.z) < 96,
    ).length >= (game.difficulty === "easy" ? 4 : 6)
  )
    return;
  if (
    game.entities.filter(
      (e) =>
        e.hp > 0 &&
        HOSTILE_TYPES.has(e.type) &&
        Math.hypot(e.x - game.player.x, e.z - game.player.z) < 96,
    ).length >= cinderThreatCap(game.difficulty)
  )
    return;
  const a = hash(game.tickCount, 6, 0, game.world.seedInt) * Math.PI * 2;
  const x = Math.floor(game.player.x + Math.cos(a) * 34),
    z = Math.floor(game.player.z + Math.sin(a) * 34);
  const e = createEntity(
    game,
    hash(game.tickCount, 8, 0, game.world.seedInt) < 0.55
      ? "ember_ray"
      : "cinder_roc",
    x,
    z,
  );
  e.y = Math.max(69, game.world.skyHeight(x, z)) + 9;
  if (collides(game.world, e, 1.6, 2.4)) return;
  e.home = { x: e.x, y: e.y, z: e.z };
  game.entities.push(e);
}
export function tickFlier(game, e) {
  const w = game.world;
  const target = survivalPlayers(game)
    .filter(
      (p) => Math.hypot(p.x - e.x, p.z - e.z) < 48 && Math.abs(p.y - e.y) < 35,
    )
    .sort(
      (a, b) =>
        Math.hypot(a.x - e.x, a.z - e.z) - Math.hypot(b.x - e.x, b.z - e.z),
    )[0];
  e.home ||= { x: e.x, y: e.y, z: e.z };
  const destination = target || {
    x: e.home.x + Math.sin(e.age / 100) * 10,
    z: e.home.z + Math.cos(e.age / 100) * 10,
  };
  const dx = destination.x - e.x,
    dz = destination.z - e.z,
    d = Math.max(0.1, Math.hypot(dx, dz));
  e.yaw = Math.atan2(-dx, -dz);
  const altitude =
    Math.max(69, w.skyHeight(e.x, e.z)) + 7 + Math.sin(e.age / 25) * 1.5;
  const speed =
    target && d < 14 ? -1.5 : target && d < 23 ? 0 : MOB_INFO[e.type].speed;
  const oy = e.y;
  moveBody(
    w,
    e,
    ((dx / d) * speed) / 20,
    Math.max(-0.13, Math.min(0.13, (altitude - e.y) * 0.05)),
    ((dz / d) * speed) / 20,
    1.6,
    2.4,
    0,
  );
  e.vy = (e.y - oy) * 20;
  e.onGround = false;
  e.speed = Math.abs(speed);
  if (!target) {
    e.castTicks = 0;
    return;
  }
  const from = { x: e.x, y: e.y + 0.8, z: e.z },
    tx = target.x - from.x,
    ty =
      target.y +
      (target.standData?.transformed ? 1 : target.crouching ? 1.3 : 1.45) -
      from.y,
    tz = target.z - from.z,
    len = Math.max(0.1, Math.hypot(tx, ty, tz));
  const hit = w.raycast(
    from,
    { x: tx / len, y: ty / len, z: tz / len },
    len,
    true,
  );
  if (hit && hit.distance < len - 0.3) {
    e.castTicks = 0;
    return;
  }
  if (!e.attack && !e.castTicks) {
    e.castTicks = e.type === "cinder_roc" ? 24 : 32;
    game.audio?.voice?.(game, e, "attack");
  }
  if (e.castTicks > 0 && --e.castTicks === 0) {
    const speed = e.type === "cinder_roc" ? 0.34 : 0.28;
    if ((game.hostileProjectiles ||= []).length < 48)
      game.hostileProjectiles.push({
        id: `${e.id}:fire:${game.tickCount}`,
        x: from.x,
        y: from.y,
        z: from.z,
        vx: (tx / len) * speed,
        vy: (ty / len) * speed,
        vz: (tz / len) * speed,
        source: e.id,
        sourceType: e.type,
        age: 0,
        arcane: true,
        fireball: true,
        damage: e.type === "cinder_roc" ? 8 : 6,
      });
    e.attack = e.type === "cinder_roc" ? 3.2 : 4;
    playWorldSound(game, "ignite", e);
  }
}
export function deflectFireball(game) {
  const p = game.player;
  if (p.health <= 0 || (game.tickCount || 0) < (p.fireballDeflectTick || 0))
    return false;
  const eye = p.standData?.transformed ? 1.1 : p.crouching ? 1.35 : 1.62;
  const cp = Math.cos(p.pitch),
    dir = {
      x: -Math.sin(p.yaw) * cp,
      y: Math.sin(p.pitch),
      z: -Math.cos(p.yaw) * cp,
    };
  let selected = null,
    closest = 3.5;
  for (const q of game.hostileProjectiles || []) {
    if (!q.fireball) continue;
    const dx = q.x - p.x,
      dy = q.y - p.y - eye,
      dz = q.z - p.z,
      t = dx * dir.x + dy * dir.y + dz * dir.z;
    if (
      t < 0 ||
      t > closest ||
      Math.hypot(dx - dir.x * t, dy - dir.y * t, dz - dir.z * t) > 0.65
    )
      continue;
    const wall = game.world.raycast(
      { x: p.x, y: p.y + eye, z: p.z },
      dir,
      t,
      true,
    );
    if (wall && wall.distance < t) continue;
    selected = q;
    closest = t;
  }
  if (!selected) return false;
  const publicId = game.multiplayer?.peerForPlayer?.(p)?.id || "host";
  Object.assign(selected, {
    vx: dir.x * 0.95,
    vy: dir.y * 0.95,
    vz: dir.z * 0.95,
    reflected: true,
    age: 0,
    damage: 18,
    source: `player:${publicId}`,
    deflectorId: publicId,
  });
  p.fireballDeflectTick = (game.tickCount || 0) + 6;
  game.lastAttack = game.elapsed || 0;
  game.renderer?.action?.("attack");
  playWorldSound(game, "guardian-impact", selected);
  return true;
}
