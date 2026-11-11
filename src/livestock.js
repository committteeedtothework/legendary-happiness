import { B, MOB_INFO, makeStack } from "./data.js";
import {
  FARM_FOODS,
  FARM_GROW_TICKS,
  FARM_BREED_COOLDOWN,
} from "./livestock-data.js";
import { weatherColumnLoaded } from "./weather-spatial.js";
import { collides } from "./physics.js";
import { createEntity, dropItem } from "./simulation.js";
import { hash } from "./random.js";

function feedback(g, text) {
  g.renderer?.action?.("use");
  g.audio?.tone?.("pop");
  g.ui?.updateHotbar?.();
  if (text) g.ui?.toast?.(text);
}
export function useLivestock(g) {
  const inv = g.inventory,
    held = inv.held,
    e = g.targetEntity?.();
  if (held?.id === "milk_bucket") {
    if (g.mode !== "creative") inv.slots[inv.selected] = makeStack("bucket");
    g.player.effects = {};
    feedback(g, "Milk cleared your status effects.");
    g.ui?.updateHUD?.();
    return true;
  }
  if (!e || e.hp <= 0) return false;
  if (held?.id === "bucket" && e.type === "cow" && !e.baby) {
    {
      if (held.count === 1) inv.slots[inv.selected] = makeStack("milk_bucket");
      else {
        // A full inventory leaves both the bucket stack and the cow untouched.
        if (inv.add(makeStack("milk_bucket"))) {
          g.ui?.toast?.("Make room for a milk bucket.");
          return true;
        }
        inv.consume();
      }
    }
    feedback(g, "Milked the cow.");
    return true;
  }
  if (!FARM_FOODS[e.type]?.includes(held?.id)) return false;
  if (e.baby) {
    if (e.growTicks === 0) return true;
    e.growTicks = Math.max(
      1,
      Math.floor((e.growTicks ?? FARM_GROW_TICKS) * 0.9),
    );
  } else {
    if (e.breedCooldown > 0 || e.love > 0) return true;
    e.love = 600;
  }
  e.persistent = true;
  if (g.mode !== "creative") inv.consume();
  feedback(g);
  return true;
}
function safeChildPosition(g, a, b) {
  const m = MOB_INFO[a.type],
    width = m.width * 0.5,
    height = m.height * 0.5;
  for (const [dx, dz] of [
    [0, 0],
    [0.7, 0],
    [-0.7, 0],
    [0, 0.7],
    [0, -0.7],
  ]) {
    const p = {
      x: (a.x + b.x) / 2 + dx,
      y: Math.max(a.y, b.y),
      z: (a.z + b.z) / 2 + dz,
    };
    if (
      ![
        [-width, -width],
        [width, width],
      ].every(([x, z]) => weatherColumnLoaded(g.world, p.x + x, p.z + z))
    )
      continue;
    if (
      g.world.solid(p.x, p.y - 0.1, p.z) &&
      !collides(g.world, p, height, width) &&
      ![B.water, B.lava, B.fire].includes(g.world.get(p.x, p.y + 0.1, p.z))
    )
      return p;
  }
  return null;
}
export function tickLivestock(g, e) {
  if (!FARM_FOODS[e.type]) return;
  if (e.breedCooldown > 0) e.breedCooldown--;
  if (e.love > 0) e.love--;
  if (e.baby) {
    e.growTicks = Math.max(0, (e.growTicks ?? FARM_GROW_TICKS) - 1);
    if (
      !e.growTicks &&
      !collides(g.world, e, MOB_INFO[e.type].height, MOB_INFO[e.type].width)
    )
      e.baby = false;
    return;
  }
  if (e.type === "chicken") {
    e.eggTicks ??=
      6000 +
      Math.floor(hash(e.x | 0, e.z | 0, e.age || 0, g.world.seedInt) * 6000);
    if (--e.eggTicks <= 0) {
      dropItem(g, makeStack("egg"), e.x, e.y + 0.3, e.z);
      e.eggTicks =
        6000 +
        Math.floor(hash(e.age || 0, e.x | 0, e.z | 0, g.world.seedInt) * 6000);
    }
  }
  if (e.type === "woolling" && e.sheared) {
    if (e.grazeTicks > 0) {
      if (--e.grazeTicks === 0) {
        const p = e.grazeAt;
        if (
          p &&
          Math.hypot(e.x - p.x - 0.5, e.z - p.z - 0.5) < 1.2 &&
          g.world.get(p.x, p.y, p.z) === p.id
        ) {
          g.world.set(p.x, p.y, p.z, p.id === B.grass ? B.dirt : B.air);
          e.sheared = false;
        }
        delete e.grazeAt;
      }
    } else if (
      g.tickCount % 20 === 0 &&
      hash(e.age || 0, e.x | 0, e.z | 0, g.world.seedInt) < 0.02
    ) {
      const x = Math.floor(e.x),
        z = Math.floor(e.z),
        y = Math.floor(e.y);
      const p =
        g.world.get(x, y, z) === B.wild_grass
          ? { x, y, z, id: B.wild_grass }
          : { x, y: y - 1, z, id: B.grass };
      if (g.world.get(p.x, p.y, p.z) === p.id) {
        e.grazeTicks = 40;
        e.grazeAt = p;
      }
    }
  }
  if (
    !e.love ||
    e.breedCooldown ||
    g.tickCount % 20 ||
    g.entities.length >= 256
  )
    return;
  // Pair scans run once a second, only inside the existing loaded simulation area.
  const local = g.entities.filter(
    (b) =>
      b.hp > 0 && FARM_FOODS[b.type] && Math.hypot(b.x - e.x, b.z - e.z) < 48,
  );
  if (local.length >= 64) return;
  const mate = local.find(
    (b) =>
      b !== e &&
      b.type === e.type &&
      !b.baby &&
      b.love > 0 &&
      !b.breedCooldown &&
      weatherColumnLoaded(g.world, b.x, b.z) &&
      Math.hypot(b.x - e.x, b.z - e.z) < 2.5 &&
      Math.abs(b.y - e.y) < 1 &&
      [0.25, 0.5, 0.75].every(
        (f) =>
          !g.world.solid(
            e.x + (b.x - e.x) * f,
            Math.min(e.y, b.y) + 0.4,
            e.z + (b.z - e.z) * f,
          ),
      ),
  );
  if (!mate) return;
  const pos = safeChildPosition(g, e, mate);
  if (!pos) return;
  const child = createEntity(g, e.type, pos.x - 0.5, pos.z - 0.5);
  Object.assign(child, pos, {
    baby: true,
    growTicks: FARM_GROW_TICKS,
    persistent: true,
  });
  e.love = mate.love = 0;
  e.breedCooldown = mate.breedCooldown = FARM_BREED_COOLDOWN;
  g.entities.push(child);
}
export function livestockMotion(g, e) {
  if (!FARM_FOODS[e.type]) return null;
  if (e.grazeTicks > 0) return { dx: 0, dz: 0, speed: 0 };
  let target;
  if (e.baby)
    target = g.entities.find(
      (b) =>
        b !== e &&
        b.hp > 0 &&
        b.type === e.type &&
        !b.baby &&
        Math.hypot(b.x - e.x, b.z - e.z) < 12,
    );
  else if (e.love > 0)
    target = g.entities.find(
      (b) =>
        b !== e &&
        b.hp > 0 &&
        b.type === e.type &&
        !b.baby &&
        b.love > 0 &&
        Math.hypot(b.x - e.x, b.z - e.z) < 12,
    );
  if (!target) {
    const players = [
      { player: g.player, inventory: g.inventory },
      ...[...(g.multiplayer?.peers?.values?.() || [])],
    ];
    let nearest = 10;
    for (const p of players) {
      const d = Math.hypot(p.player.x - e.x, p.player.z - e.z);
      if (
        p.player.health > 0 &&
        d < nearest &&
        FARM_FOODS[e.type].includes(p.inventory?.held?.id)
      ) {
        target = p.player;
        nearest = d;
      }
    }
  }
  if (!target) return null;
  const dx = target.x - e.x,
    dz = target.z - e.z,
    distance = Math.hypot(dx, dz);
  return {
    dx: dx / Math.max(distance, 0.01),
    dz: dz / Math.max(distance, 0.01),
    speed: distance < (e.baby ? 2 : 1.3) ? 0 : 1.25 * (e.baby ? 1.2 : 1),
  };
}
