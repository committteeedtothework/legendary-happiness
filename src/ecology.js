import { playWorldSound } from "./spatial-audio.js";
import { awardXP } from "./equipment.js";
import { collides } from "./physics.js";
import {
  B,
  BLOCKS,
  HOSTILE_TYPES,
  MOB_INFO,
  VILLAGER_TRADES,
  makeStack,
} from "./data.js";
import { doorAt, setDoorOpen } from "./doors.js";
import { hash } from "./random.js";
import { Inventory } from "./inventory.js";
export function populateVillages(game, createEntity) {
  if (game.dimension === "cinderwild" || !game.world.nearbyVillages) return;
  for (const v of game.world.nearbyVillages(game.player.x, game.player.z, 72)) {
    game.world.settlements ||= {};
    const record = game.world.settlements[v.id];
    let newGuard;
    if (!record?.guardCreated) {
      for (const [dx, dz] of [
        [4, 6],
        [4, 12],
        [-4, 6],
        [-4, 12],
      ]) {
        const guard = createEntity(
          game,
          "iron_golem",
          v.x + dx,
          v.z + dz,
          `${v.id}:guard`,
        );
        Object.assign(guard, {
          y: v.y + 1,
          persistent: true,
          village: { id: v.id, x: v.x + 0.5, z: v.z + 0.5 },
        });
        const info = MOB_INFO.iron_golem;
        if (
          !collides(game.world, guard, info.height, info.width) &&
          game.world.solid(guard.x, guard.y - 0.01, guard.z)
        ) {
          newGuard = guard;
          break;
        }
      }
      if (record && newGuard) record.guardCreated = true;
    }
    if (record) {
      if (newGuard) game.entities.push(newGuard);
      continue;
    }
    game.world.settlements[v.id] = {
      inhabited: true,
      guardCreated: !!newGuard,
    };
    v.houses.forEach((home, i) => {
      const e = createEntity(
        game,
        "villager",
        home.doorX,
        home.doorZ + 1,
        `${v.id}:resident:${i}`,
      );
      Object.assign(e, {
        y: (home.floor ?? v.y) + 1,
        style: v.style,
        home: {
          x: home.x + 3.5,
          y: (home.floor ?? v.y) + 1,
          z: home.z + 3.5,
          doorX: home.doorX + 0.5,
          doorZ: home.doorZ + 0.5,
          expanded: !!v.radius,
        },
        village: { id: v.id, x: v.x + 0.5, z: v.z + 0.5 },
        profession: home.profession,
        persistent: true,
        tradeUses: [0, 0],
        restockDay: Math.floor(game.time / 24000),
      });
      game.entities.push(e);
    });
    if (newGuard) game.entities.push(newGuard);
  }
}
export function wildlifeForBiome(biome, n) {
  if (["alpine", "snowy_taiga"].includes(biome))
    return [
      "rabbit",
      "woolling",
      "snow_leopard",
      "polar_bear",
      "rabbit",
      "woolling",
    ][n % 6];
  if (biome === "stony_peaks") return ["woolling", "rabbit"][n % 2];
  if (biome === "jungle")
    return ["panda", "koala", "chicken", "panda", "koala"][n % 5];
  if (biome === "savanna")
    return ["grazer", "tiger", "cow", "woolling", "tiger"][n % 5];
  if (
    [
      "ash_wastes",
      "emberwood",
      "basalt_ridges",
      "sulfur_basin",
      "bloodlands",
      "soul_vale",
    ].includes(biome)
  )
    return n % 2 ? "cinderback" : "ash_deer";
  return biome === "desert"
    ? ["rabbit"][0]
    : biome === "alpine"
      ? ["woolling", "rabbit"][n % 2]
      : ["grazer", "cow", "chicken", "woolling", "rabbit"][n % 5];
}
export function updateVillageDoor(game, e) {
  if (!e.home) return;
  const x = Math.floor(e.home.doorX),
    y = Math.floor(e.home.y),
    z = Math.floor(e.home.doorZ);
  const door = doorAt(game.world, x, y, z);
  if (!door) return;
  const distance = Math.hypot(e.x - x - 0.5, e.z - z - 0.5);
  const open = distance < 2.1 && e.speed > 0.1 ? true : door.open;
  if (
    setDoorOpen(game.world, x, y, z, open, [game.player, ...game.entities]) &&
    Math.hypot(game.player.x - x, game.player.z - z) < 16
  )
    playWorldSound(game, open ? "door-open" : "door-close", { x, y, z });
}
export function villagerMotion(game, e, night) {
  if (game.ui?.screen === "trading" && game.ui.tradingEntity?.id === e.id) {
    e.speed = 0;
    return { dx: 0, dz: 0 };
  }
  const danger = game.entities.find(
    (m) =>
      m.hp > 0 &&
      HOSTILE_TYPES.has(m.type) &&
      Math.hypot(e.x - m.x, e.z - m.z) < 8,
  );
  if (danger || e.flee > 0) {
    const target = danger || game.player,
      d = Math.max(0.1, Math.hypot(e.x - target.x, e.z - target.z));
    e.speed = 3;
    e.flee = Math.max(0, (e.flee || 0) - 1);
    return { dx: (e.x - target.x) / d, dz: (e.z - target.z) / d };
  }
  if (!e.home || !e.village) return null;
  const day = Math.floor(game.time / 24000);
  if (!night && e.restockDay !== day) {
    e.tradeUses = [0, 0];
    e.restockDay = day;
  }
  const state = night ? "home" : "village";
  if (e.routine !== state || !e.route?.length) {
    const h = e.home;
    if (night) {
      if (Math.hypot(e.x - h.x, e.z - h.z) < 0.7) {
        e.speed = 0;
        return { dx: 0, dz: 0 };
      }
      const inside = Math.abs(e.x - h.x) < 2.3 && Math.abs(e.z - h.z) < 2.3;
      e.route = inside
        ? [{ x: h.x, z: h.z }]
        : [
            ...(h.expanded
              ? [
                  { x: e.village.x, z: e.z },
                  { x: e.village.x, z: h.doorZ + 2.5 },
                ]
              : []),
            { x: h.doorX, z: h.doorZ + 1.7 },
            { x: h.doorX, z: h.doorZ - 1.2 },
            { x: h.x, z: h.z },
          ];
    } else {
      const i = Math.floor(
        hash(e.age | 0, e.x | 0, e.z | 0, game.world.seedInt) * 4,
      );
      const target = [
        { x: e.village.x, z: e.village.z - 7 },
        { x: e.village.x, z: e.village.z + 17 },
        { x: e.village.x - 18, z: e.village.z },
        { x: e.village.x + 17, z: e.village.z },
      ][i];
      const inside = Math.abs(e.x - h.x) < 2.3 && Math.abs(e.z - h.z) < 2.3;
      e.route = inside
        ? [
            { x: h.doorX, z: h.doorZ - 1 },
            { x: h.doorX, z: h.doorZ + 2.5 },
            ...(h.expanded ? [{ x: e.village.x, z: h.doorZ + 2.5 }] : []),
            target,
          ]
        : [target];
    }
    e.routine = state;
  }
  const target = e.route[0],
    d = Math.hypot(target.x - e.x, target.z - e.z);
  if (d < 0.5) {
    e.route.shift();
    e.speed = 0;
    return { dx: 0, dz: 0 };
  }
  e.speed = night ? 1.8 : 1.1;
  return { dx: (target.x - e.x) / d, dz: (target.z - e.z) / d };
}
export function tradeWithVillager(game, e, index) {
  if (
    !e ||
    e.type !== "villager" ||
    e.hp <= 0 ||
    Math.hypot(e.x - game.player.x, e.y - game.player.y, e.z - game.player.z) >
      5
  )
    return { ok: false, message: "The villager is too far away." };
  const recipe = VILLAGER_TRADES[e.profession]?.[index];
  if (!recipe) return { ok: false, message: "That trade is unavailable." };
  e.tradeUses ||= [0, 0];
  if (e.tradeUses[index] >= 12)
    return { ok: false, message: "Sold out. Come back after sunrise." };
  const working = new Inventory(game.inventory.export());
  if (
    working.slots.reduce(
      (n, s) => n + (s?.id === recipe.input ? s.count : 0),
      0,
    ) < recipe.cost
  )
    return {
      ok: false,
      message: `You need ${recipe.cost} ${recipe.input.replaceAll("_", " ")}.`,
    };
  let left = recipe.cost;
  for (let i = 0; i < 36 && left; i++)
    if (working.slots[i]?.id === recipe.input) {
      const n = Math.min(left, working.slots[i].count);
      working.consume(i, n);
      left -= n;
    }
  if (working.add(makeStack(recipe.output, recipe.count)))
    return { ok: false, message: "Make room in your inventory first." };
  game.inventory.slots = working.slots;
  e.tradeUses[index]++;
  e.gesture = 0.65;
  awardXP(game, 2);
  game.audio?.tone("trade");
  game.ui?.updateHotbar();
  return { ok: true, message: "Trade completed · +2 XP" };
}
