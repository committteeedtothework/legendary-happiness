import { embedArrow, tickEmbeddedArrows } from "./embedded-arrows.js";
import { playWorldSound } from "./spatial-audio.js";
import { blockShieldProjectile } from "./edition-combat.js";
import { farmScale } from "./livestock-data.js";
import { isWater } from "./block-dynamics.js";
import { survivalPlayers, isPlayer, damagePlayer } from "./coop-players.js";
import { primeTnt } from "./block-dynamics.js";
import {
  B,
  BLOCKS,
  ITEMS,
  MOB_INFO,
  HOSTILE_TYPES,
  makeStack,
} from "./data.js";
import { combatClear } from "./defenders.js";
import { hash } from "./random.js";

export function upgradeNightEnemies(entities = [], dimension = "overworld") {
  return entities.map((e) =>
    dimension === "overworld" && ["shade", "stalker"].includes(e.type)
      ? { ...e, type: e.type === "shade" ? "zombie" : "skeleton" }
      : e,
  );
}
export const NIGHT_HOSTILES = ["zombie", "creeper", "spider", "skeleton"];
export const nightHostile = (wave, attempt = 0) =>
  NIGHT_HOSTILES[(((wave + attempt) % 4) + 4) % 4];
function hurt(game, target, damage, source, damageEntity, knockback = 0.4) {
  if (source.encounter === "matthew-incursion") damage *= 1.2;
  if (isPlayer(game, target)) {
    damagePlayer(
      game,
      target,
      damage,
      (MOB_INFO[source.type]?.name
        ? MOB_INFO[source.type].name +
          (source.damageKind ? " " + source.damageKind : "")
        : null) ||
        (source.type === "tnt"
          ? "a TNT explosion"
          : source.type === "sealed_pistols"
            ? "the sealed pistols"
            : "a runic bolt"),
    );
    const d = Math.max(
      0.1,
      Math.hypot(target.x - source.x, target.z - source.z),
    );
    target.vx += ((target.x - source.x) / d) * 3;
    target.vz += ((target.z - source.z) / d) * 3;
  } else
    damageEntity(game, target, damage, { source, reward: false, knockback });
}
export function fireHostileProjectile(
  game,
  source,
  target,
  angle = 0,
  arcane = false,
) {
  const list = (game.hostileProjectiles ||= []);
  if (list.length >= 48) return;
  const x = source.x,
    y = source.y + 1.35,
    z = source.z;
  const dx = target.x - x,
    dy = target.y + 0.9 - y,
    dz = target.z - z,
    d = Math.max(0.1, Math.hypot(dx, dy, dz));
  const speed = arcane ? 0.55 : 0.8,
    c = Math.cos(angle),
    s = Math.sin(angle);
  list.push({
    id: `${source.id}:${game.tickCount}:${list.length}`,
    x,
    y,
    z,
    vx: ((dx * c - dz * s) / d) * speed,
    vy: (dy / d) * speed + (arcane ? 0 : 0.025),
    vz: ((dz * c + dx * s) / d) * speed,
    source: source.id,
    sourceType: source.type,
    encounter: source.encounter,
    age: 0,
    arcane,
    damage: arcane
      ? source.type === "mad_titan"
        ? 10
        : source.type === "devin_guardian"
          ? 8
          : source.type === "soul_reaver"
            ? 7
            : 5
      : 4,
  });
  playWorldSound(game, arcane ? "rune" : "arrow", source);
}
export function tickHostileProjectiles(game, damageEntity) {
  tickEmbeddedArrows(game);
  const remaining = [];
  for (const q of game.hostileProjectiles || []) {
    if (game.difficulty === "peaceful" && !q.playerArrow) continue;
    q.age++;
    if (
      q.age > (q.playerArrow ? 240 : q.fireball ? 180 : 90) ||
      Math.min(
        Math.hypot(q.x - game.player.x, q.z - game.player.z),
        ...survivalPlayers(game).map((t) => Math.hypot(q.x - t.x, q.z - t.z)),
      ) > 128
    )
      continue;
    const from = { x: q.x, y: q.y, z: q.z },
      length = Math.hypot(q.vx, q.vy, q.vz);
    const wall = game.world.raycast?.(
      from,
      { x: q.vx / length, y: q.vy / length, z: q.vz / length },
      length,
      true,
    );
    let victim = null,
      closest = wall ? wall.distance / length : 1.01;
    const targets = game.entities.filter(
      (e) =>
        e.hp > 0 &&
        e.id !== q.source &&
        (q.playerArrow
          ? true
          : q.reflected
            ? HOSTILE_TYPES.has(e.type)
            : ["villager", "iron_golem"].includes(e.type)),
    );
    if (!q.reflected && !q.playerArrow) targets.push(...survivalPlayers(game));
    for (const t of targets) {
      // Swept samples prevent fast arrows tunnelling through a body.
      const h = t.standData?.transformed
          ? 1.25
          : (MOB_INFO[t.type]?.height || 1.8) * farmScale(t),
        w =
          (t.standData?.transformed
            ? 0.9
            : (MOB_INFO[t.type]?.width || 0.6) * farmScale(t)) /
            2 +
          0.12;
      for (let i = 0; i <= 8; i++) {
        const f = i / 8;
        if (f >= closest) break;
        const x = from.x + q.vx * f,
          y = from.y + q.vy * f,
          z = from.z + q.vz * f;
        if (
          Math.abs(x - t.x) < w &&
          Math.abs(z - t.z) < w &&
          y >= t.y &&
          y <= t.y + h
        ) {
          victim = t;
          closest = f;
          break;
        }
      }
    }
    if (victim) {
      if (q.playerArrow) {
        const peer = [...(game.multiplayer?.peers?.values?.() || [])].find(
          (p) => p.player.aquaticId === q.owner,
        );
        damageEntity(peer?.context || game, victim, q.damage, {
          kind: "arrow",
          reward: true,
          knockback: 0.3,
        });
        continue;
      }
      if (blockShieldProjectile(game, victim, q)) continue;
      if (q.reflected) {
        const peer = [...(game.multiplayer?.peers?.values?.() || [])].find(
          (p) => p.id === q.deflectorId,
        );
        damageEntity(peer?.context || game, victim, q.damage, {
          kind: "fireball",
          reward: true,
          knockback: 0.3,
        });
        game.renderer?.explosionEffect?.(q);
        playWorldSound(game, "explosion", q);
        continue;
      }
      const scale =
        game.difficulty === "easy"
          ? 0.65
          : game.difficulty === "hard"
            ? 1.5
            : 1;
      hurt(
        game,
        victim,
        q.damage * scale,
        {
          x: q.x,
          y: q.y,
          z: q.z,
          type: q.sourceType,
          encounter: q.encounter,
          damageKind: q.fireball ? "fireball projectile" : "projectile",
        },
        damageEntity,
      );
      continue;
    }
    if (wall) {
      if (!q.arcane && !q.fireball && !q.orbBullet && length > 0)
        embedArrow(game, q, wall, from, length);
      if (q.fireball) {
        game.renderer?.explosionEffect?.(q);
        playWorldSound(game, "explosion", q);
      }
      if (q.arcane)
        game.renderer?.arcane?.burst({ x: q.x, y: q.y - 1, z: q.z }, 8);
      continue;
    }
    q.x += q.vx;
    q.y += q.vy;
    q.z += q.vz;
    if (!q.arcane && !q.orbBullet) q.vy -= 0.008;
    remaining.push(q);
  }
  game.hostileProjectiles = remaining;
}
export function creeperExplosion(game, e, damageEntity, dropItem) {
  const targets = game.entities.filter((t) => t.hp > 0 && t !== e);
  targets.push(...survivalPlayers(game));
  for (const t of targets) {
    const d = Math.hypot(t.x - e.x, t.y - e.y, t.z - e.z);
    if (d < 5 && combatClear(game.world, e, t))
      hurt(
        game,
        t,
        Math.ceil(
          (1 - d / 5) *
            (game.difficulty === "easy"
              ? 12
              : game.difficulty === "hard"
                ? 28
                : 20),
        ),
        e,
        damageEntity,
        0.8,
      );
  }
  // Container inventories and indestructible/temple blocks are protected.
  for (let dz = -3; dz <= 3; dz++)
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -3; dx <= 3; dx++) {
        if (dx * dx + dy * dy + dz * dz > 7) continue;
        const x = Math.floor(e.x) + dx,
          y = Math.floor(e.y) + dy,
          z = Math.floor(e.z) + dz,
          id = game.world.get(x, y, z),
          b = BLOCKS[id];
        if (id === B.tnt) {
          primeTnt(
            game.world,
            x,
            y,
            z,
            10 + Math.floor(hash(x, y, z, game.tickCount) * 20),
          );
          continue;
        }
        if (
          !b?.solid ||
          b.hardness > 3 ||
          b.relic ||
          b.door ||
          game.world.containers?.[`${x},${y},${z}`] ||
          ["chest", "furnace", "bed", "runestone", "glow_crystal"].includes(
            b.key,
          )
        )
          continue;
        game.world.set(x, y, z, B.air);
        if (ITEMS[b.drop] && hash(x, y, z, game.tickCount) > 0.7)
          dropItem(game, makeStack(b.drop), x + 0.5, y + 0.3, z + 0.5, 20);
      }
  e.hp = 0;
  game.renderer?.explosionEffect?.(e);
  playWorldSound(game, "explosion", e);
}
// Returns motion overrides; damage and cooldowns remain on the 20 Hz simulation.
export function enemyCombat(
  game,
  e,
  prey,
  distance,
  dx,
  dz,
  damageEntity,
  dropItem,
) {
  const clear = combatClear(game.world, e, prey);
  if (["dread_knight", "soul_reaver", "magma_maw"].includes(e.type)) {
    if (e.mawDashTicks > 0) {
      e.mawDashTicks--;
      if (!e.mawHit && distance < 2 && clear) {
        hurt(game, prey, 9, e, damageEntity);
        e.mawHit = true;
      }
      return { dx: e.mawX, dz: e.mawZ, speed: 9, skipMelee: true };
    }
    if (
      !e.castTicks &&
      !e.attack &&
      clear &&
      distance <
        (e.type === "soul_reaver" ? 20 : e.type === "magma_maw" ? 10 : 5)
    ) {
      e.castTicks = e.type === "dread_knight" ? 32 : 24;
      e.castTarget = { x: prey.x, y: prey.y, z: prey.z };
      playWorldSound(game, "guardian-charge", e);
    }
    if (e.castTicks > 0) {
      if (--e.castTicks === 0) {
        if (e.type === "soul_reaver") {
          for (const angle of [-0.16, 0, 0.16])
            fireHostileProjectile(game, e, e.castTarget, angle, true);
        } else if (e.type === "dread_knight") {
          game.renderer?.guardianWave?.(e, 4.5);
          if (distance < 4.5 && prey.y < e.y + 0.85 && clear)
            hurt(game, prey, 11, e, damageEntity);
          playWorldSound(game, "guardian-impact", e);
        } else {
          const d = Math.max(
            0.1,
            Math.hypot(e.castTarget.x - e.x, e.castTarget.z - e.z),
          );
          e.mawX = (e.castTarget.x - e.x) / d;
          e.mawZ = (e.castTarget.z - e.z) / d;
          e.mawDashTicks = 8;
          e.mawHit = false;
        }
        e.attack = 2.8;
      }
      return { speed: 0, skipMelee: true };
    }
    if (e.type === "soul_reaver")
      return { speed: distance < 13 && clear ? 0 : 2.5, skipMelee: true };
  }
  if (
    e.encounter === "matthew-incursion" &&
    e.type === "cinder_wraith" &&
    distance < 16 &&
    clear &&
    !e.attack
  ) {
    for (const angle of [-0.15, 0, 0.15])
      fireHostileProjectile(game, e, prey, angle, true);
    e.attack = 1.8;
  }
  if (e.type === "creeper") {
    if (distance < 3 && Math.abs(prey.y - e.y) < 2 && clear) {
      if (!e.fuse || e.fuse % 8 === 0) playWorldSound(game, "fuse", e);
      e.fuse = Math.min(30, (e.fuse || 0) + 1);
    } else e.fuse = Math.max(0, (e.fuse || 0) - 2);
    if (e.fuse >= 30) creeperExplosion(game, e, damageEntity, dropItem);
    return { speed: e.fuse > 0 ? 0 : 2.1, skipMelee: true };
  }
  if (
    (e.type === "skeleton" ||
      e.type === "stray" ||
      (e.type === "drowned" && e.trident)) &&
    !isWater(game.world.get(e.x, e.y + 1.5, e.z))
  ) {
    if (distance < 18 && clear && !e.attack) {
      fireHostileProjectile(game, e, prey);
      e.attack = 1.8;
    }
    const retreat = distance < 5,
      hold = distance >= 7 && distance <= 13 && clear;
    return {
      dx: retreat ? -dx : dx,
      dz: retreat ? -dz : dz,
      speed: hold ? 0 : 2.4,
      skipMelee: true,
    };
  }
  if (!["devin_guardian", "mad_titan"].includes(e.type)) return {};
  const titan = e.type === "mad_titan";
  e.specialCooldown = Math.max(0, (e.specialCooldown ?? 70) - 1);
  if (!e.special && !e.specialCooldown && !e.windup && clear && distance < 16) {
    const role = (((e.guardianIndex || 0) % 3) + 3) % 3;
    const move = (e.specialCycle || 0) % 2;
    e.specialCycle = (e.specialCycle || 0) + 1;
    e.special = titan
      ? ["shockwave", "lunge", "sigil", "barrage"][(e.specialCycle - 1) % 4]
      : [
          ["shockwave", "cleave"],
          ["barrage", "sigil"],
          ["lunge", "fan"],
        ][role][move];
    e.specialTicks =
      e.special === "lunge"
        ? 24
        : ["cleave", "sigil"].includes(e.special)
          ? 40
          : 32;
    e.specialTarget = { x: prey.x, y: prey.y, z: prey.z };
    playWorldSound(game, "guardian-charge", e);
  }
  if (!e.special) return {};
  const kind = e.special;
  if (kind === "dash") {
    e.specialTicks--;
    if (distance < 2 && clear && !e.dashHit) {
      hurt(game, prey, titan ? 14 : 12, e, damageEntity);
      e.dashHit = true;
    }
    if (e.specialTicks <= 0) {
      e.special = null;
      e.specialCooldown = 160;
    }
    return { dx: e.dashX, dz: e.dashZ, speed: 10, skipMelee: true };
  }
  e.specialTicks--;
  if (e.specialTicks <= 0) {
    if (kind === "cleave" || kind === "sigil") {
      const mark = e.specialTarget;
      const targets = [
        ...game.entities.filter(
          (t) => t.hp > 0 && ["villager", "iron_golem"].includes(t.type),
        ),
        ...survivalPlayers(game),
      ];
      const ax = mark.x - e.x,
        az = mark.z - e.z,
        ad = Math.max(0.01, Math.hypot(ax, az));
      for (const t of targets) {
        const dx = t.x - e.x,
          dz = t.z - e.z,
          d = Math.max(0.01, Math.hypot(dx, dz));
        const hit =
          kind === "sigil"
            ? Math.hypot(t.x - mark.x, t.z - mark.z) < 2.8 &&
              Math.abs(t.y - mark.y) < 2
            : d < 4.5 &&
              (dx * ax + dz * az) / (d * ad) > 0.35 &&
              Math.abs(t.y - e.y) < 2;
        if (hit && combatClear(game.world, e, t)) {
          hurt(
            game,
            t,
            kind === "cleave" ? 13 : titan ? 13 : 10,
            e,
            damageEntity,
            0.6,
          );
          if (kind === "sigil") t.runicSlow = 30;
        }
      }
      game.renderer?.guardianWave?.(
        kind === "sigil" ? mark : e,
        kind === "sigil" ? 2.8 : 4.5,
      );
      playWorldSound(game, "guardian-impact", kind === "sigil" ? mark : e);
    } else if (kind === "fan") {
      for (const angle of [-0.35, -0.175, 0, 0.175, 0.35])
        fireHostileProjectile(game, e, e.specialTarget, angle, true);
    } else if (kind === "shockwave") {
      game.renderer?.guardianWave?.(e, 6);
      for (const t of [
        ...survivalPlayers(game),
        ...game.entities.filter(
          (t) => ["villager", "iron_golem"].includes(t.type) && t.hp > 0,
        ),
      ])
        if (
          t.health !== 0 &&
          Math.hypot(t.x - e.x, t.z - e.z) < 6 &&
          t.y < e.y + 0.85 &&
          Math.abs(t.y - e.y) < 2 &&
          combatClear(game.world, e, t)
        )
          hurt(game, t, titan ? 14 : 11, e, damageEntity, 0.8);
      playWorldSound(game, "guardian-impact", e);
    } else if (kind === "barrage")
      for (const angle of [-0.18, 0, 0.18])
        fireHostileProjectile(game, e, e.specialTarget, angle, true);
    else {
      const d = Math.max(
        0.1,
        Math.hypot(e.specialTarget.x - e.x, e.specialTarget.z - e.z),
      );
      e.dashX = (e.specialTarget.x - e.x) / d;
      e.dashZ = (e.specialTarget.z - e.z) / d;
      e.special = "dash";
      e.specialTicks = 8;
      e.dashHit = false;
      return { speed: 0, skipMelee: true };
    }
    e.special = null;
    e.specialCooldown = (e.hp <= 50 ? 100 : 140) + (e.guardianIndex || 0) * 20;
  }
  return { speed: 0, skipMelee: true };
}
