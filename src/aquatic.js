import {
  B,
  BLOCKS,
  ITEMS,
  MOB_INFO,
  HOSTILE_TYPES,
  SEA,
  makeStack,
} from "./data.js";
import { isWater, peek } from "./block-dynamics.js";
import { hash } from "./random.js";
import { moveBody, collides } from "./physics.js";
import { nearbyOceanSites } from "./ocean-generation.js";
import { enchantLevel } from "./equipment.js";
const sides = [
  [1, 0, 0],
  [-1, 0, 0],
  [0, 1, 0],
  [0, -1, 0],
  [0, 0, 1],
  [0, 0, -1],
];
export const aquaticCell = (id) =>
  BLOCKS[id]?.aquatic ||
  BLOCKS[id]?.coral ||
  BLOCKS[id]?.eggs ||
  BLOCKS[id]?.wart ||
  id === B.conduit;
export function registerAquatic(w, c) {
  w.aquaticCells ||= new Map();
  for (let y = -63; y <= c.maxY; y++)
    for (let z = 0; z < 16; z++)
      for (let x = 0; x < 16; x++) {
        const id = c.data[(y + 64) * 256 + z * 16 + x];
        if (aquaticCell(id))
          w.aquaticCells.set(`${c.cx * 16 + x},${y},${c.cz * 16 + z}`, id);
      }
}
export function setAquaticCell(w, x, y, z, id) {
  if (!w.aquaticCells) return;
  const key = `${x},${y},${z}`;
  if (aquaticCell(id)) w.aquaticCells.set(key, id);
  else w.aquaticCells.delete(key);
}
export function aquaticState(w) {
  return (w.aquatic ||= { growth: {}, projectiles: [], achievements: {} });
}
export function awardAquatic(g, id, text) {
  const a = aquaticState(g.world).achievements;
  if (a[id]) return;
  a[id] = g.tickCount || 1;
  g.ui?.toast?.(`Ocean journal · ${text}`, 5000);
  g.audio?.tone?.("enchant");
}
export function effect(p, id, ticks, level = 1) {
  p.effects ||= {};
  p.effects[id] = { ticks: Math.max(ticks, p.effects[id]?.ticks || 0), level };
}
export const hasEffect = (p, id) => (p.effects?.[id]?.ticks || 0) > 0;
export function bubbleColumn(w, x, y, z) {
  if (!w.chunks) return 0;
  x = Math.floor(x);
  y = Math.floor(y);
  z = Math.floor(z);
  if (!isWater(peek(w, x, y, z))) return 0;
  for (let d = 1; d <= 64 && y - d > -64; d++) {
    const id = peek(w, x, y - d, z);
    if (id === B.soul_sand) return 1;
    if (id === B.magma_block) return -1;
    if (!isWater(id) || !BLOCKS[id]?.fluid?.source) return 0;
  }
  return 0;
}
export const CONDUIT_FRAME = (() => {
  const p = [];
  for (let y = -2; y <= 2; y++)
    for (let z = -2; z <= 2; z++)
      for (let x = -2; x <= 2; x++)
        if (
          (x === 0 && Math.max(Math.abs(y), Math.abs(z)) === 2) ||
          (y === 0 && Math.max(Math.abs(x), Math.abs(z)) === 2) ||
          (z === 0 && Math.max(Math.abs(x), Math.abs(y)) === 2)
        )
          p.push([x, y, z]);
  return p;
})();
export function conduitStatus(w, x, y, z) {
  for (let dy = -1; dy <= 1; dy++)
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++)
        if ((dx || dy || dz) && !isWater(peek(w, x + dx, y + dy, z + dz)))
          return { active: false, frame: 0, radius: 0 };
  const frame = CONDUIT_FRAME.filter(([dx, dy, dz]) =>
    [
      B.prismarine,
      B.prismarine_bricks,
      B.dark_prismarine,
      B.sea_lantern,
    ].includes(peek(w, x + dx, y + dy, z + dz)),
  ).length;
  return {
    active: frame >= 16,
    frame,
    radius: frame >= 16 ? Math.min(96, Math.floor(frame / 7) * 16) : 0,
  };
}
export function tickOceanPlayer(g) {
  const p = g.player;
  for (const [id, s] of Object.entries(p.effects || {})) {
    s.ticks--;
    if (s.ticks <= 0) delete p.effects[id];
  }
  if (!p.underwater && g.inventory.equipment?.[0]?.id === "turtle_shell")
    effect(p, "water_breathing", 200);
  if (p.inWater)
    for (const c of g.world.activeConduits || [])
      if (Math.hypot(c.x - p.x, c.y - p.y, c.z - p.z) <= c.radius) {
        effect(p, "conduit_power", 260);
        awardAquatic(g, "conduit", "Moskstraumen · Conduit Power");
      }
  if (
    p.underwater &&
    (hasEffect(p, "water_breathing") || hasEffect(p, "conduit_power"))
  )
    p.oxygen = Math.min(300, p.oxygen + 5);
  const column = bubbleColumn(g.world, p.x, p.y + 0.2, p.z);
  if (column) {
    p.vy = Math.max(-5, Math.min(11, (p.vy || 0) + column * 0.45));
    p.oxygen = Math.min(300, p.oxygen + 6);
    p.fallStart = p.y;
  }
  if (g.mode !== "creative" && p.health > 0 && g.tickCount % 20 === 0) {
    if (g.world.get(p.x, p.y - 0.05, p.z) === B.magma_block && !p.crouching)
      g.damage(1, "hot magma");
    if (hasEffect(p, "poison") && p.health > 1)
      g.damage(Math.min(1, p.health - 1), "poison");
  }
}
export function tickAquaticWorld(g, { createEntity, dropItem, damageEntity }) {
  const w = g.world,
    state = aquaticState(w),
    p = g.player;
  if (g.tickCount % 40 === 0) {
    w.activeConduits = [];
    for (const [key, id] of w.aquaticCells || []) {
      const [x, y, z] = key.split(",").map(Number);
      if (!w.chunks.has(`${Math.floor(x / 16)},${Math.floor(z / 16)}`)) {
        w.aquaticCells.delete(key);
        continue;
      }
      if (Math.hypot(p.x - x, p.z - z) > 96) continue;
      const b = BLOCKS[id];
      if (id === B.conduit) {
        const status = conduitStatus(w, x, y, z);
        if (status.active) {
          w.activeConduits.push({
            x: x + 0.5,
            y: y + 0.5,
            z: z + 0.5,
            ...status,
          });
          if (status.frame === 42) {
            const e = g.entities.find(
              (e) =>
                e.hp > 0 &&
                HOSTILE_TYPES.has(e.type) &&
                isWater(
                  peek(
                    w,
                    Math.floor(e.x),
                    Math.floor(e.y + 0.5),
                    Math.floor(e.z),
                  ),
                ) &&
                Math.hypot(e.x - x, e.y - y, e.z - z) <= 8,
            );
            if (e) damageEntity(g, e, 4, { kind: "conduit", knockback: 0 });
          }
        }
      }
      if (
        b?.coral &&
        !b.coral.dead &&
        !sides.some(([dx, dy, dz]) => isWater(peek(w, x + dx, y + dy, z + dz)))
      ) {
        w.set(x, y, z, B[`dead_${b.key}`]);
        continue;
      }
      if (
        id === B.kelp &&
        peek(w, x, y - 1, z) !== B.kelp &&
        !BLOCKS[peek(w, x, y - 1, z)]?.solid
      ) {
        w.set(x, y, z, B.water);
        dropItem(g, makeStack("kelp"), x + 0.5, y + 0.5, z + 0.5);
        continue;
      }
      if (
        id === B.kelp &&
        hash(x, g.tickCount, z, w.seedInt) < 0.025 &&
        peek(w, x, y + 1, z) === B.water
      ) {
        let n = 1;
        while (n < 26 && peek(w, x, y - n, z) === B.kelp) n++;
        if (n < 26) w.set(x, y + 1, z, B.kelp);
      }
      if (b?.eggs && peek(w, x, y - 1, z) === B.sand) {
        const trampler = [p, ...g.entities].find(
          (e) =>
            (e === p || !["turtle", "dolphin", "boat"].includes(e.type)) &&
            e.onGround &&
            e.y >= y &&
            e.y < y + 0.6 &&
            Math.hypot(e.x - x - 0.5, e.z - z - 0.5) < 0.65,
        );
        if (trampler && hash(x, g.tickCount, z, w.seedInt) < 0.35) {
          w.set(
            x,
            y,
            z,
            b.eggs > 1 ? B[`turtle_egg_${b.eggs - 1}_${b.eggStage}`] : B.air,
          );
          continue;
        }

        const clock = state.growth[key] || { ticks: 0 };
        state.growth[key] = clock;
        clock.ticks += 40;
        if (clock.ticks >= 2400 && g.time % 24000 >= 22000) {
          clock.ticks = 0;
          if (b.eggStage < 2)
            w.set(x, y, z, B[`turtle_egg_${b.eggs}_${b.eggStage + 1}`]);
          else {
            w.set(x, y, z, B.air);
            delete state.growth[key];
            for (let i = 0; i < b.eggs; i++) {
              const e = createEntity(g, "turtle", x, z);
              Object.assign(e, {
                y,
                baby: true,
                growTicks: 24000,
                home: { x, y, z },
                persistent: true,
              });
              g.entities.push(e);
            }
            awardAquatic(g, "hatch", "A new tide · turtle hatchlings");
          }
        }
      }
      if (b?.wart && b.wart < 4 && hash(x, g.tickCount, z, w.seedInt) < 0.09)
        w.set(x, y, z, B[`nether_wart_${b.wart}`]);
    }
  }
  // Population is independent from land wildlife, with a bounded local budget.
  if (w.dimension !== "overworld" || g.tickCount % 120 !== 0) return;
  if (
    w.weather?.kind === "thunder" &&
    g.tickCount % 600 === 0 &&
    hash(g.tickCount, 915, 0, w.seedInt) < 0.1 &&
    !g.entities.some((e) => e.type === "skeleton_horse" && e.hp > 0)
  ) {
    const x = Math.floor(p.x + 22),
      z = Math.floor(p.z + 8),
      t = w.terrain(x, z);
    if (t.h > SEA) {
      const horse = createEntity(g, "skeleton_horse", x, z);
      g.entities.push(horse);
    }
  }
  let count = g.entities.filter(
    (e) =>
      e.hp > 0 &&
      (MOB_INFO[e.type]?.aquatic || e.type === "drowned") &&
      Math.hypot(e.x - p.x, e.z - p.z) < 96,
  ).length;
  for (let attempt = 0; attempt < 18 && count < 30; attempt++) {
    const a = hash(g.tickCount, attempt, 4, w.seedInt) * Math.PI * 2,
      r = 18 + hash(g.tickCount, attempt, 7, w.seedInt) * 32,
      x = Math.floor(p.x + Math.sin(a) * r),
      z = Math.floor(p.z + Math.cos(a) * r),
      t = w.terrain(x, z);
    if (t.h >= SEA - 3) continue;
    const n = hash(x, g.tickCount, z, w.seedInt),
      type =
        n < 0.08
          ? "dolphin"
          : n < 0.15
            ? "turtle"
            : n < 0.22
              ? "squid"
              : n < 0.33 && g.difficulty !== "peaceful"
                ? "drowned"
                : t.biome.includes("warm")
                  ? n < 0.6
                    ? "pufferfish"
                    : "tropical_fish"
                  : t.biome.includes("cold") || t.biome.includes("frozen")
                    ? "salmon"
                    : "cod";
    const y =
      type === "drowned"
        ? t.h + 1
        : type === "turtle"
          ? SEA - 1
          : t.h + 2 + hash(x, 2, z, w.seedInt) * (SEA - t.h - 4);
    const spawn = type === "turtle" ? nearestTurtleBeach(w, x, z) : { x, y, z };
    if (!spawn) continue;
    if (
      (type !== "turtle" && !isWater(w.get(spawn.x, spawn.y, spawn.z))) ||
      collides(
        w,
        { x: spawn.x + 0.5, y: spawn.y, z: spawn.z + 0.5 },
        MOB_INFO[type].height,
        MOB_INFO[type].width,
      )
    )
      continue;
    if (type === "turtle" && w.get(spawn.x, spawn.y - 1, spawn.z) !== B.sand)
      continue;
    const e = createEntity(g, type, spawn.x, spawn.z);
    Object.assign(e, {
      y: spawn.y,
      home: { x: spawn.x, y: spawn.y, z: spawn.z },
      aquaticNatural: true,
    });
    if (type === "drowned") {
      e.trident = hash(x, g.tickCount, 33, w.seedInt) < 0.0625;
      e.shell = hash(x, g.tickCount, 34, w.seedInt) < 0.03;
    }
    g.entities.push(e);
    count++;
  }
}
export function nearestTurtleBeach(w, x, z, radius = 96) {
  for (let r = 0; r <= radius; r += 8)
    for (let i = 0; i < (r ? 12 : 1); i++) {
      const a = (i * Math.PI) / 6,
        bx = Math.floor(x + Math.sin(a) * r),
        bz = Math.floor(z + Math.cos(a) * r),
        t = w.terrain(bx, bz);
      if (t.h >= SEA && t.h <= SEA + 2 && !t.village && !t.structure)
        return { x: bx, y: t.h + 1, z: bz };
    }
  return null;
}
export function tickAquaticEntity(
  g,
  e,
  { createEntity, dropItem, damageEntity },
) {
  const m = MOB_INFO[e.type],
    w = g.world,
    p = g.player;
  if (!m?.aquatic) return false;
  e.age++;
  e.hurt = Math.max(0, (e.hurt || 0) - 0.05);
  if (Math.hypot(e.x - p.x, e.z - p.z) > 128 && !e.persistent) {
    e.hp = 0;
    return true;
  }
  if (!w.chunks.has(`${Math.floor(e.x / 16)},${Math.floor(e.z / 16)}`))
    return true;
  const wet = isWater(w.get(e.x, e.y + 0.15, e.z));
  if (e.baby) {
    e.growTicks--;
    if (e.growTicks <= 0) {
      e.baby = false;
      if (!e.scuteDropped) {
        e.scuteDropped = true;
        dropItem(g, makeStack("scute"), e.x, e.y + 0.3, e.z);
      }
      awardAquatic(g, "scute", "Shell keeper · a turtle grew up");
    }
  }
  let target = e.guide || e.waterGoal;
  if (e.type === "dolphin" && wet) {
    if (p.inWater && Math.hypot(p.x - e.x, p.y - e.y, p.z - e.z) < 9)
      effect(p, "dolphins_grace", 100);
    if (e.guide && Math.hypot(e.guide.x - e.x, e.guide.z - e.z) < 4) {
      e.guide = null;
      awardAquatic(g, "dolphin_guide", "Dolphin’s grace · found an ocean ruin");
    }
  }
  if (e.love > 0) e.love--;
  if (e.breedCooldown > 0) e.breedCooldown--;
  if (e.type === "turtle" && e.love > 0 && !e.baby && !e.breedCooldown) {
    const mate = g.entities.find(
      (t) =>
        t !== e &&
        t.type === "turtle" &&
        t.hp > 0 &&
        !t.baby &&
        t.love > 0 &&
        !t.breedCooldown &&
        Math.hypot(t.x - e.x, t.z - e.z) < 8,
    );
    if (mate) {
      target = { x: mate.x, y: mate.y, z: mate.z };
      if (Math.hypot(mate.x - e.x, mate.z - e.z) < 2) {
        e.pregnant = true;
        e.love = mate.love = 0;
        e.breedCooldown = mate.breedCooldown = 6000;
      }
    }
  }
  if (e.type === "turtle" && e.pregnant) {
    const h = e.home || { x: e.x, z: e.z };
    for (let r = 0; r <= 32; r += 4) {
      const x = Math.floor(h.x + r),
        z = Math.floor(h.z),
        t = w.terrain(x, z);
      if (t.h >= SEA && t.h <= SEA + 3 && w.get(x, t.h, z) === B.sand) {
        target = { x: x + 0.5, y: t.h + 1, z: z + 0.5 };
        if (Math.hypot(e.x - target.x, e.z - target.z) < 2) {
          const key = `${x},${t.h + 1},${z}`;
          if (w.get(x, t.h + 1, z) === B.air) {
            w.set(
              x,
              t.h + 1,
              z,
              B[
                `turtle_egg_${1 + Math.floor(hash(x, g.tickCount, z, w.seedInt) * 4)}_0`
              ],
            );
            aquaticState(w).growth[key] = { ticks: 0 };
            e.pregnant = false;
          }
        }
        break;
      }
    }
  }
  if (!target || (e.age % 160 === 0 && !e.guide && !e.pregnant)) {
    const a =
      hash(Math.floor(e.x), e.age, Math.floor(e.z), w.seedInt) * Math.PI * 2;
    e.waterGoal = target = {
      x: e.x + Math.sin(a) * 8,
      y: Math.min(
        SEA - 1,
        Math.max(
          w.terrain(e.x, e.z).h + 1,
          e.y + (hash(e.age, 9, 0, w.seedInt) - 0.5) * 5,
        ),
      ),
      z: e.z + Math.cos(a) * 8,
    };
  }
  let dx = target.x - e.x,
    dz = target.z - e.z,
    dy = target.y - e.y,
    d = Math.max(0.1, Math.hypot(dx, dy, dz));
  e.yaw = Math.atan2(-dx, -dz);
  e.speed = m.speed * (e.baby ? 0.6 : 1);
  e.vx = (dx / d) * e.speed;
  e.vz = (dz / d) * e.speed;
  if (e.type === "turtle" && !wet && !e.pregnant && e.age % 80 === 0) {
    const b = nearestTurtleBeach(w, e.x, e.z, 16);
    e.waterGoal = {
      x: e.x + Math.sin(e.yaw) * 4,
      y: Math.min(SEA - 1, e.y),
      z: e.z + Math.cos(e.yaw) * 4,
    };
  }
  if (wet) {
    e.air = (e.air ?? 4800) - 1;
    if (m.breathes && e.air < 100) {
      dy = SEA - 0.7 - e.y;
      if (!isWater(w.get(e.x, e.y + 0.6, e.z))) e.air = 4800;
    }
    e.vy =
      Math.max(-1, Math.min(1, dy * 0.6)) +
      bubbleColumn(w, e.x, e.y, e.z) * 0.8;
  } else {
    e.vy = Math.max(-12, (e.vy || 0) - 1.6);
    if (m.fish || e.type === "squid") {
      if (e.age % 20 === 0)
        damageEntity(g, e, 1, { reward: false, knockback: 0 });
      if (e.onGround && e.age % 16 === 0) {
        e.vy = 3;
        e.vx *= 2;
      }
    }
  }
  if (e.type === "pufferfish") {
    e.inflated = Math.hypot(p.x - e.x, p.y - e.y, p.z - e.z) < 2;
    if (
      e.inflated &&
      Math.hypot(p.x - e.x, p.y - e.y, p.z - e.z) < 1 &&
      g.mode !== "creative" &&
      e.age % 20 === 0
    ) {
      g.damage(2, "a pufferfish");
      effect(p, "poison", 140);
    }
  }
  moveBody(
    w,
    e,
    e.vx * 0.05,
    e.vy * 0.05,
    e.vz * 0.05,
    m.height * (e.baby ? 0.35 : 1),
    m.width * (e.baby ? 0.35 : 1),
    e.type === "turtle" ? 0.6 : 0,
  );
  if (
    e.type === "dolphin" &&
    e.age % 120 === 0 &&
    Math.hypot(p.x - e.x, p.z - e.z) < 24
  )
    g.audio?.voice?.(g, e, "idle");
  return true;
}
export function aquaticDrops(g, e, dropItem) {
  const item = {
    cod: "cod",
    salmon: "salmon",
    tropical_fish: "tropical_fish",
    pufferfish: "pufferfish",
    squid: "ink_sac",
    drowned: "rotten_flesh",
    husk: "rotten_flesh",
    stray: "bone",
  }[e.type];
  if (item)
    dropItem(
      g,
      makeStack(item, e.type === "squid" ? 2 : 1),
      e.x,
      e.y + 0.3,
      e.z,
    );
  if (e.type === "drowned") {
    if (e.shell) dropItem(g, makeStack("nautilus_shell"), e.x, e.y + 0.4, e.z);
    if (e.trident && hash(e.x, g.tickCount, e.z, g.world.seedInt) < 0.085)
      dropItem(g, makeStack("trident"), e.x, e.y + 0.4, e.z);
  }
  if (e.type === "magma_maw")
    dropItem(g, makeStack("blaze_rod", 1), e.x, e.y + 0.4, e.z);
}
