import { playWorldSound } from "./spatial-audio.js";
import { weatherColumnLoaded } from "./weather-spatial.js";
import { tickLivestock, livestockMotion } from "./livestock.js";
import { farmScale } from "./livestock-data.js";
import { nearestPlayerDistance } from "./render-budget.js";
import { playerEye } from "./player-body.js";
import { tickAquaticGear } from "./aquatic-gear.js";
import { awardXP } from "./equipment.js";
import {
  tickAquaticWorld,
  tickAquaticEntity,
  tickOceanPlayer,
  aquaticDrops,
  bubbleColumn,
} from "./aquatic.js";
import { spawnOverworldWildlife } from "./wildlife.js";
import { spawnCaveHostiles, spawnWatcher, tickWatcher } from "./cave-life.js";
import { tickBoats } from "./boats.js";
import { spawnFliers, tickFlier, cinderThreatCap } from "./cinder-flight.js";
import { tickRiftTrial, recordTitanDeath } from "./rift-trial.js";
import { survivalPlayers, isPlayer, damagePlayer } from "./coop-players.js";
import { tickInvasion, recordInvaderDeath, INVASION } from "./invasion.js";
import { tickPistolTraces } from "./matthew.js";
import {
  isWater,
  isLava,
  cactusContact,
  fluidCurrent,
} from "./block-dynamics.js";
import {
  creeperExplosion,
  nightHostile,
  enemyCombat,
  tickHostileProjectiles,
} from "./hostile-combat.js";
import { tickSeekers } from "./seeker.js";
import { tickWeather } from "./weather.js";
import { populateEncounters, recordGuardianDeath } from "./encounters.js";
import { combatClear, hostileTarget, golemTarget } from "./defenders.js";
import { enchantLevel } from "./equipment.js";
import { tickPortals } from "./portals.js";
import { uniqueId } from "./compat.js";
import {
  B,
  BLOCKS,
  ITEMS,
  FUELS,
  SMELTS,
  makeStack,
  SEA,
  HOSTILE_TYPES,
  CYCLE_EVENTS,
  MOB_INFO,
  attackCooldown,
} from "./data.js";
import { coordKey } from "./world.js";
import { moveBody, collides } from "./physics.js";
import { hash } from "./random.js";
import {
  populateVillages,
  wildlifeForBiome,
  villagerMotion,
  updateVillageDoor,
} from "./ecology.js";
export function createEntity(game, type, x, z, id) {
  const t = game.world.terrain(x, z);
  return {
    id: id || uniqueId(),
    type,
    x: x + 0.5,
    y: t.h + 1,
    z: z + 0.5,
    vx: 0,
    vy: 0,
    vz: 0,
    onGround: false,
    hp:
      MOB_INFO[type]?.health ||
      (type === "emberling" ? 24 : HOSTILE_TYPES.has(type) ? 20 : 10),
    yaw: 0,
    age: 0,
    attack: 0,
    hurt: 0,
    turn: 0,
    dir: 0,
    speed: 0,
  };
}
export function seedCreatures(game) {
  const p = game.player;
  if (game.dimension !== "cinderwild")
    spawnOverworldWildlife(game, createEntity, true);
  else
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI * 2) / 8,
        r = 10 + (i % 3) * 4,
        x = Math.floor(p.x + Math.cos(a) * r),
        z = Math.floor(p.z + Math.sin(a) * r);
      if (
        game.world.terrain(x, z).h >
          (game.dimension === "cinderwild" ? 70 : SEA) &&
        !game.world.solid(x, game.world.terrain(x, z).h + 1, z)
      ) {
        const spawned = createEntity(
          game,
          wildlifeForBiome(game.world.terrain(x, z).biome, i),
          x,
          z,
        );
        if (
          collides(
            game.world,
            spawned,
            MOB_INFO[spawned.type]?.height || 1.95,
            MOB_INFO[spawned.type]?.width || 0.6,
          )
        )
          continue;
        game.entities.push(spawned);
      }
    }
  populateVillages(game, createEntity);
  populateEncounters(game, createEntity);
}
export function dropItem(game, stack, x, y, z, delay = 10) {
  if (!stack || stack.count <= 0 || ITEMS[stack.id]?.creativeOnly) return;
  game.drops.push({
    ...stack,
    uid: uniqueId(),
    x,
    y,
    z,
    vy: 2,
    age: 0,
    delay,
  });
}
export function spawnSurfaceHostiles(game, night = true) {
  const p = game.player,
    cinder = game.dimension === "cinderwild";
  const cap = cinder ? cinderThreatCap(game.difficulty) : 14;
  if (
    game.tickCount % (cinder ? 60 : 100) === 0 &&
    night &&
    game.difficulty !== "peaceful" &&
    game.entities.filter(
      (e) =>
        e.hp > 0 &&
        HOSTILE_TYPES.has(e.type) &&
        (!cinder || Math.hypot(e.x - p.x, e.z - p.z) < 96),
    ).length < cap
  ) {
    let count = 0;
    for (let attempt = 0; attempt < (cinder ? 12 : 6); attempt++) {
      const angle =
          hash(game.tickCount, attempt, 0, game.world.seedInt) * Math.PI * 2,
        radius = 24 + hash(game.tickCount, attempt, 1, game.world.seedInt) * 14;
      const x = Math.floor(p.x + Math.cos(angle) * radius),
        z = Math.floor(p.z + Math.sin(angle) * radius),
        t = game.world.terrain(x, z),
        y = t.h + 1;
      if (
        t.h <= (cinder ? 69 : SEA) ||
        !game.world.solid(x, y - 1, z) ||
        game.world.solid(x, y, z) ||
        game.world.solid(x, y + 1, z)
      )
        continue;
      let lit = false;
      for (const [pos, id] of [
        ...game.world.edits,
        ...[...(game.world.generatedLights || [])].map((pos) => [pos, B.torch]),
      ])
        if (id === B.torch) {
          const [tx, ty, tz] = pos.split(",").map(Number);
          if (
            Math.hypot(tx - x, tz - z, ty - y) < 9 &&
            game.world.get(tx, ty, tz) === B.torch
          ) {
            lit = true;
            break;
          }
        }
      if (lit) continue;
      const spawned = createEntity(
        game,
        cinder
          ? game.world.generationVersion >= 7
            ? (game.world.generationVersion >= 11
                ? [
                    "dread_knight",
                    "soul_reaver",
                    "magma_maw",
                    "emberling",
                    "basalt_crawler",
                    "cinder_wraith",
                  ]
                : ["emberling", "basalt_crawler", "cinder_wraith"])[
                (Math.floor(game.tickCount / 100) + attempt) %
                  (game.world.generationVersion >= 11 ? 6 : 3)
              ]
            : "emberling"
          : nightHostile(Math.floor(game.tickCount / 100), attempt),
        x,
        z,
      );
      if (
        collides(
          game.world,
          spawned,
          MOB_INFO[spawned.type]?.height || 1.95,
          MOB_INFO[spawned.type]?.width || 0.6,
        )
      )
        continue;
      if (!cinder && spawned.type === "zombie" && t.biome === "desert")
        spawned.type = "husk";
      if (
        !cinder &&
        spawned.type === "skeleton" &&
        ["alpine", "snowy_taiga"].includes(t.biome)
      )
        spawned.type = "stray";
      game.entities.push(spawned);
      count++;
      if (
        cinder
          ? count >= 3 ||
            game.entities.filter(
              (e) =>
                e.hp > 0 &&
                HOSTILE_TYPES.has(e.type) &&
                Math.hypot(e.x - p.x, e.z - p.z) < 96,
            ).length >= cap
          : attempt >= 1
      )
        break;
    }
  }
}
export function tickSurvival(game) {
  if (tickRiftTrial(game, createEntity)) {
    game.tickCount++;
    return;
  }
  const p = game.player;
  game.time++;
  if ((game.dimension || "overworld") === "overworld")
    for (const event of CYCLE_EVENTS)
      if (game.time % 24000 === event.tick) {
        game.ui?.announce?.(event.title, game.settings.cycleText?.[event.key]);
        game.audio?.tone(
          event.key === "dayStart" || event.key === "nightEnd"
            ? "dawn"
            : "dusk",
        );
      }
  game.world.simulate(p, Math.min(96, (game.settings.renderDistance + 1) * 16));
  if (game.tickCount % 8 === 0) {
    const listener = game.multiplayer?.game?.player || p;
    let nearest = null,
      best = 16 * 16;
    for (const [key, timer] of Object.entries(game.world.blockTimers || {})) {
      if (timer.kind !== "tnt") continue;
      const [x, y, z] = key.split(",").map(Number);
      const d =
        (x - listener.x) ** 2 + (y - listener.y) ** 2 + (z - listener.z) ** 2;
      if (d < best) {
        best = d;
        nearest = { x, y, z };
      }
    }
    if (nearest) playWorldSound(game, "fuse", nearest);
  }
  for (const blast of game.world.dynamicBursts?.splice(0) || [])
    creeperExplosion(game, blast, damageEntity, dropItem);
  for (const d of game.world.dynamicDrops?.splice(0) || [])
    dropItem(game, makeStack(d.id), d.x, d.y, d.z);
  tickWeather(game);
  tickBoats(game);
  spawnFliers(game, createEntity);
  if (game.tickCount % 40 === 0) populateVillages(game, createEntity);
  if (game.tickCount % 40 === 0) populateEncounters(game, createEntity);
  game.tickCount++;
  tickPistolTraces(game);
  tickInvasion(game, createEntity);
  tickSeekers(game, damageEntity);
  tickHostileProjectiles(game, damageEntity);
  tickAquaticWorld(game, { createEntity, dropItem, damageEntity });
  tickAquaticGear(game);
  tickPlayerSurvival(game);
  const activeDistance = Math.min(96, (game.settings.renderDistance + 1) * 16);
  for (const [key, c] of Object.entries(game.world.containers)) {
    const [x, y, z] = key.split(",").map(Number);
    if (
      Math.abs(p.x - x) > activeDistance ||
      Math.abs(p.z - z) > activeDistance ||
      c.type !== "furnace"
    )
      continue;
    const [input, fuel, output] = c.slots,
      result = SMELTS[input?.id],
      can =
        !!result &&
        (!c.station || c.station === "smoker"
          ? !c.station || !!ITEMS[result]?.food
          : /ore|raw_|scrap|ingot|ancient_debris/.test(input?.id || "")) &&
        (!output || (output.id === result && output.count < 64));
    if (c.burn > 0) c.burn--;
    if (can) {
      if (!c.burn && FUELS[fuel?.id]) {
        c.burn = FUELS[fuel.id];
        c.fuelMax = c.burn;
        playWorldSound(game, "ignite", { x, y, z });
        fuel.count--;
        if (fuel.count <= 0)
          c.slots[1] = fuel.id === "lava_bucket" ? makeStack("bucket") : null;
      }
      if (c.burn > 0) {
        c.progress = (c.progress || 0) + 1;
        if (c.progress >= (c.station ? 100 : 200)) {
          c.progress = 0;
          input.count--;
          if (input.count <= 0) c.slots[0] = null;
          if (output) output.count++;
          else c.slots[2] = makeStack(result);
          c.xp = (c.xp || 0) + 0.7;
          playWorldSound(game, "smelt", { x, y, z });
        }
      } else c.progress = Math.max(0, (c.progress || 0) - 2);
    } else c.progress = 0;
  }
  const dropPlayers = [
    p,
    ...survivalPlayers(game).filter((player) => player !== p),
  ];
  for (const d of game.drops) {
    if (
      !dropPlayers.some(
        (player) =>
          Math.hypot(d.x - player.x, d.z - player.z) <= activeDistance,
      ) ||
      !weatherColumnLoaded(game.world, d.x, d.z)
    )
      continue;
    d.age++;
    d.delay--;
    if (
      isLava(game.world.get(d.x, d.y, d.z)) ||
      game.world.get(d.x, d.y, d.z) === B.fire ||
      cactusContact(game.world, d, 0.2, 0.2)
    ) {
      if (d.id !== "devin_sword") d.count = 0;
    }
    if (isWater(game.world.get(d.x, d.y, d.z))) {
      const column = bubbleColumn(game.world, d.x, d.y, d.z);
      d.vy = column ? column * 2 : Math.min(1.3, Math.max(0.3, d.vy + 0.12));
      const [cx, cz] = fluidCurrent(game.world, d.x, d.y, d.z);
      if (!game.world.solid(d.x + cx * 0.03, d.y, d.z)) d.x += cx * 0.03;
      if (!game.world.solid(d.x, d.y, d.z + cz * 0.03)) d.z += cz * 0.03;
    } else d.vy = Math.max(-15, d.vy - 0.04 * 20);
    const next = d.y + d.vy / 20;
    if (game.world.solid(d.x, next, d.z)) {
      d.y = Math.floor(next) + 1.03;
      d.vy = 0;
    } else d.y = next;
    if (
      d.delay <= 0 &&
      p.health > 0 &&
      Math.hypot(d.x - p.x, d.y - p.y - 0.5, d.z - p.z) < 1.7
    ) {
      const before = d.count;
      d.count = game.inventory.add(d);
      if (d.count < before) {
        playWorldSound(game, "pickup", d);
        game.ui?.updateHotbar();
      }
    }
  }
  game.drops = game.drops.filter((d) => d.count > 0 && d.age < 6000);
  const cinder = game.dimension === "cinderwild";
  const night =
    cinder ||
    (game.time % 24000 >= 13000 && game.time % 24000 < 23000) ||
    (["thunder", "tornado", "hail"].includes(game.world.weather?.kind) &&
      game.world.weather.intensity > 0.65);
  spawnSurfaceHostiles(game, night);
  if (!cinder) spawnOverworldWildlife(game, createEntity);
  if (
    cinder &&
    game.world.generationVersion >= 7 &&
    game.tickCount % 240 === 0 &&
    game.entities.filter(
      (e) =>
        !HOSTILE_TYPES.has(e.type) &&
        e.type !== "villager" &&
        e.type !== "iron_golem" &&
        e.type !== "watcher" &&
        e.type !== "boat" &&
        Math.hypot(e.x - p.x, e.z - p.z) < 96,
    ).length < 24
  ) {
    const a = hash(game.tickCount, 1, 0, game.world.seedInt) * 6.28,
      x = Math.floor(p.x + Math.cos(a) * 35),
      z = Math.floor(p.z + Math.sin(a) * 35),
      t = game.world.terrain(x, z);
    if (
      t.h > (cinder ? 70 : SEA) &&
      !game.world.solid(x, t.h + 1, z) &&
      !game.world.solid(x, t.h + 2, z)
    )
      for (let i = 0; i < 3; i++) {
        const ex = x + i * 2,
          ez = z + (i % 2) * 2,
          et = game.world.terrain(ex, ez);
        if (et.h > (cinder ? 70 : SEA) && !game.world.solid(ex, et.h + 1, ez))
          game.entities.push(
            createEntity(
              game,
              game.difficulty === "peaceful" && t.biome === "savanna"
                ? "cow"
                : cinder && game.world.generationVersion < 7
                  ? "grazer"
                  : wildlifeForBiome(t.biome, (game.tickCount / 240 + i) | 0),
              ex,
              ez,
            ),
          );
      }
  }
  spawnCaveHostiles(game, createEntity);
  spawnWatcher(game, createEntity);
  for (const e of game.entities) {
    if (e.hp <= 0) continue;
    e.turn ??= 0;
    e.dir ??= 0;
    e.age ??= 0;
    e.vy ??= 0;
    e.hurt ??= 0;
    e.attack ??= 0;
    if (e.type === "boat" || (e.type === "skeleton_horse" && e.rider)) continue;
    if (tickAquaticEntity(game, e, { createEntity, dropItem, damageEntity }))
      continue;
    if (e.type === "watcher") {
      tickWatcher(game, e);
      continue;
    }
    e.age++;
    e.gesture = Math.max(0, (e.gesture || 0) - 0.05);
    e.hurt = Math.max(0, e.hurt - 0.05);
    e.attack = Math.max(0, e.attack - 0.05);
    const dist = nearestPlayerDistance(e, dropPlayers),
      hostile = HOSTILE_TYPES.has(e.type);
    if (dist > 128 && !e.persistent) {
      e.hp = 0;
      continue;
    }
    if (hostile && game.difficulty === "peaceful") {
      if (
        ["devin_guardian", "mad_titan"].includes(e.type) ||
        e.encounter === INVASION ||
        e.encounter?.startsWith("infernal:")
      ) {
        e.speed = 0;
        e.special = null;
        e.specialTicks = 0;
        e.windup = 0;
        e.castTicks = 0;
        e.mawDashTicks = 0;
        continue;
      }
      e.hp = 0;
      continue;
    }
    if (dist > activeDistance) {
      e.special = null;
      e.specialTicks = 0;
      e.fuse = 0;
      e.castTicks = 0;
      e.mawDashTicks = 0;
      continue;
    }
    if (!weatherColumnLoaded(game.world, e.x, e.z)) continue;
    tickLivestock(game, e);
    if (e.baneSlowTicks > 0) e.baneSlowTicks--;
    if (e.burningTicks > 0) {
      if (
        MOB_INFO[e.type]?.cinder ||
        isWater(game.world.get(e.x, e.y + 0.3, e.z))
      )
        e.burningTicks = 0;
      else {
        e.burningTicks--;
        if (e.burningTicks % 20 === 0)
          damageEntity(game, e, 1, {
            reward: false,
            kind: "fire",
            knockback: 0,
          });
      }
      if (e.hp <= 0) continue;
    }
    if (
      e.age % 10 === 0 &&
      cactusContact(
        game.world,
        e,
        MOB_INFO[e.type]?.height || 1.8,
        MOB_INFO[e.type]?.width || 0.6,
      )
    )
      damageEntity(game, e, 1, { reward: false, knockback: 0 });
    if (
      e.age % 20 === 0 &&
      !MOB_INFO[e.type]?.cinder &&
      (isLava(game.world.get(e.x, e.y + 0.2, e.z)) ||
        game.world.get(e.x, e.y + 0.2, e.z) === B.fire)
    )
      damageEntity(game, e, 4, { reward: false, knockback: 0 });
    if (e.hp <= 0) continue;
    if (e.type === "villager") updateVillageDoor(game, e);
    if (MOB_INFO[e.type]?.flying) {
      tickFlier(game, e);
      continue;
    }
    if (
      hostile &&
      !night &&
      !cinder &&
      !MOB_INFO[e.type]?.noSunBurn &&
      !isWater(game.world.get(e.x, e.y + 1.5, e.z)) &&
      e.age % 20 === 0 &&
      (game.world.skyHeight
        ? game.world.skyHeight(e.x, e.z) < e.y + 1.9
        : game.world.get(e.x, e.y + 2, e.z) === B.air)
    )
      e.hp--;
    let dx = 0,
      dz = 0;
    if (dist < 32 && game.tickCount >= (e.nextVoiceTick || 0)) {
      e.nextVoiceTick =
        game.tickCount + 65 + Math.floor(hash(e.age, e.x | 0, e.z | 0) * 110);
      game.audio?.voice?.(game, e, "idle");
    }
    if (MOB_INFO[e.type]?.neutral && e.flee > 0) e.flee--;
    const prey = hostile
      ? hostileTarget(game, e)
      : MOB_INFO[e.type]?.neutral &&
          e.flee > 0 &&
          dist < 8 &&
          game.mode !== "creative" &&
          game.difficulty !== "peaceful"
        ? p
        : null;
    if (!prey) {
      e.castTicks = 0;
      e.mawDashTicks = 0;
      if (e.type === "creeper") e.fuse = Math.max(0, (e.fuse || 0) - 2);
      if (["devin_guardian", "mad_titan"].includes(e.type) && e.special) {
        e.special = null;
        e.specialTicks = 0;
        e.specialCooldown = 100;
      }
    }
    if (e.type === "iron_golem") {
      const enemy = golemTarget(game, e);
      const dest = enemy || e.village;
      const distance = dest ? Math.hypot(dest.x - e.x, dest.z - e.z) : 0;
      e.speed = enemy ? 2.4 : distance > 14 ? 1.1 : 0;
      if (dest && distance > 0.01) {
        dx = (dest.x - e.x) / distance;
        dz = (dest.z - e.z) / distance;
      }
      if (
        enemy &&
        distance < 2.6 &&
        Math.abs(enemy.y - e.y) < 2 &&
        !e.attack &&
        combatClear(game.world, e, enemy)
      ) {
        damageEntity(game, enemy, 12, {
          source: e,
          reward: false,
          knockback: 0.5,
        });
        enemy.vy = Math.max(enemy.vy, 4);
        e.attack = 1.2;
        game.audio?.voice?.(game, e, "attack");
      }
    } else if (prey) {
      const distance = Math.max(0.01, Math.hypot(prey.x - e.x, prey.z - e.z));
      dx = (prey.x - e.x) / distance;
      dz = (prey.z - e.z) / distance;
      e.speed =
        MOB_INFO[e.type]?.speed ||
        (e.type === "stalker" ? 3.7 : e.type === "emberling" ? 3.2 : 2.6);
      const specialMotion = enemyCombat(
        game,
        e,
        prey,
        distance,
        dx,
        dz,
        damageEntity,
        dropItem,
      );
      dx = specialMotion.dx ?? dx;
      dz = specialMotion.dz ?? dz;
      e.speed = specialMotion.speed ?? e.speed;
      if (e.runicSlow > 0) {
        e.speed *= 0.5;
        e.runicSlow--;
      }
      if (
        !specialMotion.skipMelee &&
        ["devin_guardian", "mad_titan"].includes(e.type) &&
        distance < 2.8 &&
        !e.attack &&
        !e.windup &&
        combatClear(game.world, e, prey)
      ) {
        e.windup = 14;
        e.attack = 1.6;
      }
      const winding =
        ["devin_guardian", "mad_titan"].includes(e.type) && e.windup > 0;
      if (winding) {
        e.windup--;
        e.speed = 0;
      }
      const reach = prey.type === "iron_golem" ? 1.9 : 1.4;
      if (
        !specialMotion.skipMelee &&
        distance <
          (["devin_guardian", "mad_titan"].includes(e.type) ? 2.4 : reach) &&
        Math.abs(prey.y - e.y) < 1.8 &&
        (["devin_guardian", "mad_titan"].includes(e.type)
          ? winding && e.windup === 0
          : !e.attack) &&
        combatClear(game.world, e, prey)
      ) {
        const baseDamage =
          MOB_INFO[e.type]?.damage || (e.type === "shade" ? 3 : 4);
        const damage = Math.round(
          baseDamage *
            (e.encounter === INVASION ? 1.2 : 1) *
            (game.difficulty === "hard"
              ? 1.5
              : game.difficulty === "easy"
                ? 0.65
                : 1),
        );
        if (isPlayer(game, prey)) {
          damagePlayer(
            game,
            prey,
            damage,
            e.type === "shade"
              ? "a night shade"
              : e.type === "stalker"
                ? "a dusk stalker"
                : MOB_INFO[e.type]?.name || "an emberling",
          );
          prey.vx += dx * 5;
          prey.vz += dz * 5;
          prey.vy = Math.max(prey.vy, 2);
        } else
          damageEntity(game, prey, damage, {
            source: e,
            reward: false,
            knockback: 0.25,
          });
        e.attack = ["devin_guardian", "mad_titan"].includes(e.type) ? 1.1 : 1;
        game.audio?.voice?.(game, e, "attack");
      }
    } else if (
      (["devin_guardian", "mad_titan"].includes(e.type) ||
        e.encounter === INVASION ||
        e.encounter?.startsWith("infernal:")) &&
      e.home
    ) {
      const d = Math.hypot(e.home.x - e.x, e.home.z - e.z);
      e.speed = d > 1 ? 1.5 : 0;
      dx = (e.home.x - e.x) / Math.max(d, 0.01);
      dz = (e.home.z - e.z) / Math.max(d, 0.01);
    } else if (e.type === "villager" && e.home) {
      const motion = villagerMotion(game, e, night);
      dx = motion?.dx || 0;
      dz = motion?.dz || 0;
    } else {
      if (e.turn <= 0) {
        e.dir =
          hash(Math.floor(e.age / 60), e.x | 0, e.z | 0, game.world.seedInt) *
          Math.PI *
          2;
        e.turn = 40 + hash(e.age, 1, 0) * 70;
        e.speed =
          hash(e.age, 2, 0) > 0.35 ? MOB_INFO[e.type]?.speed || 0.85 : 0;
      }
      e.turn--;
      dx = Math.sin(e.dir);
      dz = Math.cos(e.dir);
      if (e.flee > 0) {
        dx = (e.x - p.x) / Math.max(dist, 0.1);
        dz = (e.z - p.z) / Math.max(dist, 0.1);
        e.speed = 3;
        e.flee--;
      }
    }
    const farmMotion = !prey && !e.flee ? livestockMotion(game, e) : null;
    if (farmMotion) {
      dx = farmMotion.dx;
      dz = farmMotion.dz;
      e.speed = farmMotion.speed;
    }
    if (e.baneSlowTicks > 0) e.speed *= 0.15;
    e.vx = dx * e.speed;
    e.vz = dz * e.speed;
    e.yaw =
      ["devin_guardian", "mad_titan"].includes(e.type) &&
      e.special &&
      e.specialTarget
        ? Math.atan2(e.x - e.specialTarget.x, e.z - e.specialTarget.z)
        : Math.atan2(-dx, -dz);
    if (
      e.type === "spider" &&
      prey &&
      game.world.solid(e.x + dx * 0.8, e.y + 0.4, e.z + dz * 0.8)
    )
      e.vy = 5;
    if (e.type === "rabbit" && e.onGround && e.speed > 0 && e.age % 24 === 0)
      e.vy = 5;
    e.vy = Math.max(e.type === "chicken" ? -3 : -30, e.vy - 1.6);
    const frontX = e.x + dx * 0.65,
      frontZ = e.z + dz * 0.65;
    if (
      e.onGround &&
      game.world.solid(frontX, e.y + 0.4, frontZ) &&
      !game.world.solid(frontX, e.y + 1.5, frontZ)
    )
      e.vy = 8;
    moveBody(
      game.world,
      e,
      e.vx / 20,
      e.vy / 20,
      e.vz / 20,
      (MOB_INFO[e.type]?.height || (hostile ? 1.95 : 1.2)) * farmScale(e),
      (MOB_INFO[e.type]?.width || (hostile ? 0.6 : 0.85)) * farmScale(e),
    );
    if (isWater(game.world.get(e.x, e.y + 1.8, e.z))) {
      if (["husk", "zombie"].includes(e.type)) {
        e.submergedTicks = (e.submergedTicks || 0) + 1;
        if (e.submergedTicks >= 900) {
          e.type = e.type === "husk" ? "zombie" : "drowned";
          e.submergedTicks = 0;
          e.trident = false;
        }
      } else if (
        !MOB_INFO[e.type]?.undead &&
        !["skeleton", "stray"].includes(e.type) &&
        e.age % 20 === 0
      )
        e.hp--;
    } else e.submergedTicks = 0;
    if (e.hp <= 0) recordInvaderDeath(game.world, e);
  }
  for (const e of game.entities)
    if (e.hp <= 0) {
      aquaticDrops(game, e, dropItem);
      recordGuardianDeath(game.world, e);
      recordTitanDeath(game, e);
    }
  game.entities = game.entities.filter((e) => e.hp > 0);
  if (game.tickCount % 10 === 0) game.ui?.updateHUD();
  tickPortals(game);
}
export function hitEntity(game, e) {
  if (e.hp <= 0) return;
  const p = game.player,
    item = ITEMS[game.inventory.held?.id],
    cooldown = attackCooldown(game.inventory.held?.id),
    elapsed = game.elapsed - (game.lastAttack ?? -10),
    strength = Math.min(1, elapsed / cooldown),
    crit = !p.onGround && p.vy < 0 && !p.inWater;
  const damage = (p.standData?.transformed ? Math.round : Math.floor)(
    ((item?.attack || 1) +
      (item?.tool === "mace" && p.vy < 0
        ? Math.min(40, Math.max(0, (p.fallStart || p.y) - p.y) * 3)
        : 0) +
      (item?.tool === "trident" && MOB_INFO[e.type]?.aquatic
        ? enchantLevel(game.inventory.held, "impaling") * 2.5
        : 0) +
      ([
        "zombie",
        "skeleton",
        "husk",
        "stray",
        "drowned",
        "skeleton_horse",
      ].includes(e.type)
        ? enchantLevel(game.inventory.held, "smite") * 2.5
        : 0) +
      (e.type === "spider"
        ? enchantLevel(game.inventory.held, "bane_of_arthropods") * 2.5
        : 0) +
      (enchantLevel(game.inventory.held, "sharpness")
        ? enchantLevel(game.inventory.held, "sharpness") * 0.5 + 0.5
        : 0)) *
      (0.2 + strength * strength * 0.8) *
      (crit ? 1.5 : 1) *
      (p.standData?.transformed ? 1.5 : 1),
  );
  game.lastAttack = game.elapsed;
  p.exhaustion += 0.1;
  const stack = game.inventory.held;
  if (game.mode !== "creative") game.inventory.damageTool();
  const dealt = damageEntity(game, e, damage, {
    critical: crit,
    knockback: 0.35 + enchantLevel(stack, "knockback") * 0.5,
    looting: enchantLevel(stack, "looting"),
  });
  if (dealt > 0 && e.hp > 0) {
    if (strength > 0.9 && !MOB_INFO[e.type]?.cinder)
      e.burningTicks = Math.max(
        e.burningTicks || 0,
        enchantLevel(stack, "fire_aspect") * 80,
      );
    if (e.type === "spider" && enchantLevel(stack, "bane_of_arthropods"))
      e.baneSlowTicks = 20 + enchantLevel(stack, "bane_of_arthropods") * 10;
  }
  if (item?.tool === "mace" && dealt > 0 && p.vy < 0) {
    p.fallStart = p.y;
    p.vy = Math.max(p.vy, -2);
  }
  if (stack?.id === "devin_sword" && strength >= 0.95 && dealt > 0) {
    p.health = Math.min(20, p.health + 1);
    game.ui?.updateHUD();
  }
  return dealt;
}
export function damageEntity(
  game,
  e,
  damage,
  {
    critical: crit = false,
    knockback = 0.35,
    source = game.player,
    reward = true,
    kind = "melee",
    looting = 0,
  } = {},
) {
  if (e.hp <= 0 || e.type === "watcher") return 0;
  if (e.type === "boat") {
    e.hp -= damage;
    if (e.hp <= 0)
      dropItem(game, makeStack("oak_boat"), e.x, e.y + 0.5, e.z, 20);
    playWorldSound(game, "break", e, "planks");
    return damage;
  }
  if (["devin_guardian", "mad_titan"].includes(e.type) && kind === "bullet") {
    game.renderer?.guardianWave?.(e, 0.8);
    playWorldSound(game, "guardian-impact", e);
    if ((game.guardianBulletHint || -1) < (game.tickCount || 0)) {
      game.ui?.toast?.(
        e.type === "mad_titan"
          ? "The Titan shatters bullets. Use a blade, spear or magic."
          : "Guardian armor deflects bullets. Use a blade, spear or magic.",
      );
      game.guardianBulletHint = (game.tickCount || 0) + 80;
    }
    return 0;
  }
  if (e.type === "devin_guardian") damage *= 0.65;
  if (e.type === "mad_titan") damage *= 0.75;
  if (e.type === "dread_knight") damage *= 0.75;
  if (e.type === "cinderback" || e.type === "basalt_crawler") damage *= 0.85;
  const p = game.player;
  e.hp -= damage;
  e.hurt = 0.3;
  e.flee = 80;
  const d = Math.max(0.1, Math.hypot(e.x - source.x, e.z - source.z));
  const pushX = (e.x - source.x) / d,
    pushZ = (e.z - source.z) / d;
  for (let step = 0; step < Math.ceil(knockback / 0.2); step++)
    moveBody(
      game.world,
      e,
      pushX * (knockback / Math.ceil(knockback / 0.2)),
      0,
      pushZ * (knockback / Math.ceil(knockback / 0.2)),
      (MOB_INFO[e.type]?.height || 1.95) * farmScale(e),
      (MOB_INFO[e.type]?.width || 0.6) * farmScale(e),
    );
  game.renderer?.combatImpact?.(e, { critical: crit, killed: e.hp <= 0 });
  if (reward) game.hitFeedback = { critical: crit, until: game.elapsed + 0.16 };
  playWorldSound(game, "hit", e);
  game.audio?.voice?.(game, e, e.hp <= 0 ? "death" : "hurt");
  if (e.hp <= 0) {
    const lootBonus =
      reward && kind === "melee" && looting > 0
        ? Math.floor(Math.random() * (Math.min(3, Math.max(0, looting)) + 1))
        : 0;
    aquaticDrops(game, e, dropItem);
    recordGuardianDeath(game.world, e);
    recordInvaderDeath(game.world, e);
    if (recordTitanDeath(game, e))
      dropItem(game, makeStack("hellfire_ingot", 4), e.x, e.y + 0.5, e.z);
    if (
      !e.baby &&
      !HOSTILE_TYPES.has(e.type) &&
      !MOB_INFO[e.type]?.aquatic &&
      e.type !== "skeleton_horse" &&
      e.type !== "villager" &&
      e.type !== "iron_golem" &&
      !["panda", "koala", "cinderback", "polar_bear", "snow_leopard"].includes(
        e.type,
      )
    ) {
      dropItem(
        game,
        makeStack(
          {
            pig: "porkchop",
            grazer: "porkchop",
            chicken: "chicken",
            rabbit: "rabbit",
            woolling: "mutton",
          }[e.type] || "raw_meat",
          2 + lootBonus,
        ),
        e.x,
        e.y + 0.5,
        e.z,
      );
      if (e.type === "cow")
        dropItem(
          game,
          makeStack("leather", 2 + lootBonus),
          e.x,
          e.y + 0.5,
          e.z,
        );
      if (e.type === "chicken")
        dropItem(
          game,
          makeStack("feather", 1 + lootBonus),
          e.x,
          e.y + 0.5,
          e.z,
        );
      if (e.type === "woolling" && !e.sheared)
        dropItem(game, makeStack("wool", 2), e.x, e.y + 0.5, e.z);
    }
    if (["zombie", "skeleton", "creeper", "spider"].includes(e.type)) {
      const loot = {
        zombie: "rotten_flesh",
        skeleton: "bone",
        creeper: "gunpowder",
        spider: "string",
      };
      dropItem(
        game,
        makeStack(loot[e.type], 1 + lootBonus),
        e.x,
        e.y + 0.5,
        e.z,
      );
    }
    if (e.type === "iron_golem")
      dropItem(game, makeStack("iron_ingot", 3), e.x, e.y + 0.5, e.z);
    if (reward)
      awardXP(
        game,
        ["villager", "iron_golem"].includes(e.type) || farmScale(e) < 1
          ? 0
          : HOSTILE_TYPES.has(e.type)
            ? 5
            : 2,
      );
    if (e.type === "basalt_crawler")
      dropItem(game, makeStack("brimstone"), e.x, e.y + 0.5, e.z);
    if (e.type === "cinder_wraith")
      dropItem(game, makeStack("raw_hellfire"), e.x, e.y + 0.5, e.z);
    if (["dread_knight", "soul_reaver", "magma_maw"].includes(e.type))
      dropItem(
        game,
        makeStack(
          e.type === "dread_knight"
            ? "hellfire_ingot"
            : e.type === "soul_reaver"
              ? "raw_hellfire"
              : "brimstone",
          2,
        ),
        e.x,
        e.y + 0.5,
        e.z,
      );
    if (e.type === "devin_guardian")
      dropItem(game, makeStack("runestone", 2), e.x, e.y + 0.5, e.z);
    if (e.type === "emberling")
      dropItem(game, makeStack("emberglass", 1), e.x, e.y + 0.5, e.z);
    if (MOB_INFO[e.type]?.flying && Math.random() < 0.35)
      dropItem(game, makeStack("breeze_rod"), e.x, e.y + 0.5, e.z);
    if (MOB_INFO[e.type]?.flying)
      dropItem(
        game,
        makeStack(e.type === "ember_ray" ? "brimstone" : "raw_hellfire", 2),
        e.x,
        e.y + 0.5,
        e.z,
      );
    if (reward)
      game.ui?.toast(
        HOSTILE_TYPES.has(e.type)
          ? "Hostile defeated · +5 XP"
          : "Gather the drops before they disappear",
      );
  }
  game.ui?.updateHotbar();
  return damage;
}
export function devinPulse(game) {
  const p = game.player;
  if (game.inventory.held?.id !== "devin_sword" || p.health <= 0) return false;
  const remaining = (p.devinReadyTick || 0) - (game.tickCount || 0);
  if (remaining > 0) {
    game.ui?.toast(
      `Devin's Pulse recharges in ${Math.ceil(remaining / 20)} seconds.`,
    );
    return false;
  }
  p.devinReadyTick = (game.tickCount || 0) + 200;
  let hits = 0;
  for (const e of game.entities) {
    if (!HOSTILE_TYPES.has(e.type) || e.hp <= 0) continue;
    const dx = e.x - p.x,
      dy = e.y + 1 - p.y - 1.3,
      dz = e.z - p.z,
      d = Math.hypot(dx, dy, dz);
    if (d > 7 || d < 0.01) continue;
    const wall = game.world.raycast(
      { x: p.x, y: p.y + 1.3, z: p.z },
      { x: dx / d, y: dy / d, z: dz / d },
      d,
    );
    if (wall && wall.distance < d - 0.2) continue;
    damageEntity(game, e, 8, { knockback: 2 });
    hits++;
  }
  game.renderer?.pulseEffect?.(p);
  game.renderer?.action("use");
  playWorldSound(game, "pulse", game.player);
  game.ui?.toast(
    `Devin's Pulse · ${hits} hostile${hits === 1 ? "" : "s"} struck`,
  );
  game.ui?.updateHUD();
  return true;
}
export function interactContainer(world, target) {
  const key = coordKey(target.x, target.y, target.z),
    type = BLOCKS[target.id].key;
  if (!world.containers[key])
    world.containers[key] = {
      type,
      slots: Array(type === "furnace" ? 3 : 27).fill(null),
      progress: 0,
      burn: 0,
      fuelMax: 0,
      xp: 0,
    };
  return world.containers[key];
}

// Player-only state advances once per world tick for host-authoritative co-op.
export function tickPlayerSurvival(game) {
  tickOceanPlayer(game);
  const p = game.player;
  if (game.mode !== "creative" && p.health > 0) {
    if (p.exhaustion >= 4) {
      p.exhaustion -= 4;
      if (p.saturation > 0) p.saturation = Math.max(0, p.saturation - 1);
      else if (game.difficulty !== "peaceful") p.food = Math.max(0, p.food - 1);
    }
    if (p.underwater) {
      const respiration = enchantLevel(
        game.inventory.equipment?.[0],
        "respiration",
      );
      // Deterministic bounded air savings; avoids frame-rate-dependent random rolls.
      if (game.tickCount % (respiration + 1) === 0) p.oxygen--;
    } else p.oxygen = Math.min(300, p.oxygen + 4);
    if (p.oxygen < -20) {
      p.oxygen = 0;
      game.damage(2, "drowning");
    }
    if (
      game.tickCount % 20 === 0 &&
      game.world.solid(p.x, p.y + playerEye(p), p.z) &&
      !BLOCKS[game.world.get(p.x, p.y + playerEye(p), p.z)]?.door
    )
      game.damage(1, "suffocation");
    if (game.tickCount % 80 === 0) {
      if ((p.food >= 18 || game.difficulty === "peaceful") && p.health < 20) {
        p.health++;
        p.exhaustion += 6;
      } else if (
        p.food <= 0 &&
        game.difficulty !== "peaceful" &&
        p.health >
          (game.difficulty === "hard" ? 0 : game.difficulty === "easy" ? 10 : 1)
      )
        game.damage(1, "starvation");
    }
    if (game.difficulty === "peaceful" && game.tickCount % 20 === 0)
      p.food = Math.min(20, p.food + 1);
  }
  const feet = game.world.get(p.x, p.y + 0.2, p.z);
  const wet = isWater(feet) || p.inWater;
  if (wet || game.mode === "creative") p.burning = 0;
  else if (isLava(feet)) p.burning = Math.max(p.burning || 0, 300);
  else if (feet === B.fire || game.world.get(p.x, p.y + 1, p.z) === B.fire)
    p.burning = Math.max(p.burning || 0, 100);
  if (game.mode !== "creative" && p.health > 0) {
    if (
      game.tickCount % 10 === 0 &&
      cactusContact(
        game.world,
        p,
        p.standData?.transformed ? 1.25 : p.crouching ? 1.5 : 1.8,
      )
    )
      game.damage(1, "a cactus");
    if (game.tickCount % 20 === 0 && isLava(feet)) game.damage(4, "lava");
    else if (game.tickCount % 20 === 0 && p.burning > 0) game.damage(1, "fire");
    p.burning = Math.max(0, (p.burning || 0) - 1);
  }
}
