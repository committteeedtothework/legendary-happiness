import { playWorldSound } from "./spatial-audio.js";
import { useSkeletonHorse } from "./aquatic-mount.js";
import {
  B,
  BLOCKS,
  ITEMS,
  MOB_INFO,
  HOSTILE_TYPES,
  makeStack,
} from "./data.js";
import { isWater, peek } from "./block-dynamics.js";
import { effect, hasEffect, aquaticState, awardAquatic } from "./aquatic.js";
import { nearbyOceanSites } from "./ocean-generation.js";
import { createEntity, dropItem, damageEntity } from "./simulation.js";
import { enchantLevel, wear, awardXP } from "./equipment.js";
import { uniqueId } from "./compat.js";
const aim = (p) => ({
  x: -Math.sin(p.yaw) * Math.cos(p.pitch),
  y: Math.sin(p.pitch),
  z: -Math.cos(p.yaw) * Math.cos(p.pitch),
});
const playerOwner = (p) => (p.aquaticId ||= uniqueId());
const owner = (g) => playerOwner(g.player);
const finish = (g) => {
  g.renderer?.action?.("use");
  g.audio?.tone?.("bucket");
  g.ui?.updateHotbar?.();
};
export function useAquatic(g) {
  const inv = g.inventory,
    p = g.player,
    w = g.world,
    h = inv.held,
    id = h?.id,
    t = g.target,
    e = g.targetEntity?.();
  if (useSkeletonHorse(g, e)) return true;
  if (e?.type === "dolphin" && ["cod", "salmon"].includes(id)) {
    const site = nearbyOceanSites(w, e.x, e.z, 1600)[0];
    if (site) {
      e.guide = { x: site.x + 0.5, y: site.y + 2, z: site.z + 0.5 };
      g.ui?.toast?.("Follow the dolphin to an ocean discovery.");
    } else g.ui?.toast?.("This dolphin could not find nearby ocean ruins.");
    if (g.mode !== "creative") inv.consume();
    finish(g);
    return true;
  }
  if (e?.type === "turtle" && id === "seagrass") {
    if (e.baby) e.growTicks = Math.max(1, Math.floor(e.growTicks * 0.9));
    else if (!e.breedCooldown) e.love = 600;
    if (g.mode !== "creative") inv.consume();
    finish(g);
    return true;
  }
  if (e && MOB_INFO[e.type]?.fish && id === "water_bucket") {
    inv.slots[inv.selected] = {
      ...makeStack(`${e.type}_bucket`),
      fishData: { type: e.type, hp: e.hp },
    };
    e.hp = 0;
    finish(g);
    awardAquatic(
      g,
      "fish_bucket",
      "Tactical fishing · caught a fish in a bucket",
    );
    return true;
  }
  if (ITEMS[id]?.fishBucket) {
    const target =
      t ||
      w.raycast({ x: p.x, y: p.y + 1.5, z: p.z }, aim(p), 4.5, false, true);
    if (!target) return true;
    const wet = isWater(target.id);
    const x = target.x + (wet ? 0 : target.normal.x),
      y = target.y + (wet ? 0 : target.normal.y),
      z = target.z + (wet ? 0 : target.normal.z),
      old = w.get(x, y, z);
    if (w.dimension !== "overworld" || (old !== B.air && !isWater(old)))
      return true;
    if (!isWater(old)) w.set(x, y, z, B.water);
    const fish = createEntity(g, ITEMS[id].fishBucket, x, z);
    Object.assign(fish, {
      y: y + 0.1,
      persistent: true,
      hp: h.fishData?.hp || 3,
    });
    g.entities.push(fish);
    // A released bucket is always empty, including Creative: no accidental fish cloning.
    inv.slots[inv.selected] = makeStack("bucket");
    finish(g);
    return true;
  }
  if (id === "glass_bottle") {
    const ray = w.raycast(
      { x: p.x, y: p.y + 1.5, z: p.z },
      aim(p),
      4.5,
      false,
      true,
    );
    if (ray && isWater(ray.id)) {
      // Reserve room before taking a bottle from a stack.
      if (h.count > 1 && !inv.slots.some((s) => !s)) {
        g.ui?.toast?.("Make room for a water bottle.");
        return true;
      }
      inv.consume();
      inv.add(makeStack("water_bottle"));
      finish(g);
    }
    return true;
  }
  if (id === "turtle_master_potion") {
    effect(p, "resistance", 400, 3);
    effect(p, "slowness", 400, 4);
    if (g.mode !== "creative")
      inv.slots[inv.selected] = makeStack("glass_bottle");
    finish(g);
    awardAquatic(g, "turtle_master", "Turtle Master · slow and steadfast");
    return true;
  }
  if (id === "pufferfish" && (p.food < 20 || g.mode === "creative")) {
    effect(p, "poison", 1200);
    effect(p, "nausea", 300);
    return false;
  }
  if (id === "treasure_map") {
    if (!h.mapTarget) {
      g.ui?.toast?.(
        "This blank Creative map has no treasure. Find a map in a shipwreck or ocean ruin.",
      );
      return true;
    }
    const q = h.mapTarget;
    // Coordinates are visible even in multiplayer contexts without local menus.
    g.ui?.toast?.(
      `Buried treasure · X ${q.x} / Y ${q.y} / Z ${q.z}. You: X ${Math.floor(p.x)} / Z ${Math.floor(p.z)}`,
      12000,
    );
    awardAquatic(g, "map", "Treasure hunter · an ocean chart");
    return true;
  }
  if (t?.id === B.brewing_stand && !p.crouching) {
    const key = `${t.x},${t.y},${t.z}`,
      c = (w.containers[key] ||= {
        type: "brewing_stand",
        slots: Array(5).fill(null),
        progress: 0,
        fuel: 0,
      });
    g.openInventory("brewing_stand", c, t);
    return true;
  }
  if (id === "fishing_rod") {
    useFishingRod(g);
    return true;
  }
  if (id === "trident") {
    if (g.multiplayer?.isGuest) return true;
    g.tridentCharge = { slot: inv.selected, start: g.tickCount, stack: h };
    g.renderer?.action?.("use");
    return true;
  }
  if (
    t &&
    ((id === "sea_pickle_1" && BLOCKS[t.id]?.pickles < 4) ||
      (id === "turtle_egg_1_0" && BLOCKS[t.id]?.eggs < 4))
  ) {
    const b = BLOCKS[t.id],
      next = b.pickles
        ? B[`sea_pickle_${b.pickles + 1}`]
        : B[`turtle_egg_${b.eggs + 1}_${b.eggStage}`];
    w.set(t.x, t.y, t.z, next);
    if (g.mode !== "creative") inv.consume();
    finish(g);
    return true;
  }
  if (
    t &&
    id === "bone_meal" &&
    (t.id === B.seagrass || BLOCKS[t.id]?.pickles)
  ) {
    if (g.mode !== "creative") inv.consume();
    for (let dx = -2; dx <= 2; dx++)
      for (let dz = -2; dz <= 2; dz++)
        if (
          w.get(t.x + dx, t.y, t.z + dz) === B.water &&
          BLOCKS[w.get(t.x + dx, t.y - 1, t.z + dz)]?.solid
        )
          w.set(
            t.x + dx,
            t.y,
            t.z + dz,
            BLOCKS[t.id]?.pickles ? B.sea_pickle_1 : B.seagrass,
          );
    finish(g);
    return true;
  }
  if (t && BLOCKS[ITEMS[id]?.block]?.aquaticWater) {
    const x = t.x + t.normal.x,
      y = t.y + t.normal.y,
      z = t.z + t.normal.z;
    if (!isWater(w.get(x, y, z))) {
      g.ui?.toast?.("Place this aquatic plant in water.");
      return true;
    }
  }
  if (t && BLOCKS[ITEMS[id]?.block]?.eggs) {
    const y = t.y + t.normal.y;
    if (w.get(t.x + t.normal.x, y - 1, t.z + t.normal.z) !== B.sand) {
      g.ui?.toast?.("Turtle eggs need sand.");
      return true;
    }
  }
  if (t && id === "nether_wart") {
    const x = t.x + t.normal.x,
      y = t.y + t.normal.y,
      z = t.z + t.normal.z;
    if (w.get(x, y - 1, z) === B.soul_sand && w.get(x, y, z) === B.air) {
      w.set(x, y, z, B.nether_wart_0);
      if (g.mode !== "creative") inv.consume();
      finish(g);
    }
    return true;
  }
  return false;
}
export function useFishingRod(g) {
  const p = g.player,
    inv = g.inventory;
  if (p.fishing) {
    const f = p.fishing;
    delete p.fishing;
    if (
      g.tickCount >= f.bite &&
      g.tickCount < f.bite + 40 &&
      isWater(g.world.get(f.x, f.y, f.z))
    ) {
      const luck = enchantLevel(inv.held, "luck_of_the_sea"),
        roll = Math.random(),
        fish =
          roll < 0.6
            ? "cod"
            : roll < 0.85
              ? "salmon"
              : roll < 0.87
                ? "tropical_fish"
                : "pufferfish";
      const open = [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ].every(
        ([x, z]) =>
          isWater(g.world.get(f.x + x, f.y, f.z + z)) &&
          !g.world.solid(f.x + x, f.y + 1, f.z + z),
      );
      const item =
        open && Math.random() < 0.05 + luck * 0.02 ? "nautilus_shell" : fish;
      dropItem(g, makeStack(item), p.x, p.y + 0.6, p.z, 0);
      awardXP(g, 1 + Math.floor(Math.random() * 6));
      awardAquatic(g, "fishing", "Fishy business · a successful catch");
    }
    if (g.mode !== "creative") inv.damageTool();
    finish(g);
    return;
  }
  const d = aim(p),
    o = { x: p.x, y: p.y + 1.5, z: p.z },
    ray = g.world.raycast(o, d, 24, false, true);
  if (!ray || !isWater(ray.id)) {
    g.ui?.toast?.(
      "Aim at open water to cast. Right-click again when the bobber dips.",
    );
    return;
  }
  p.fishing = {
    x: ray.x + 0.5,
    y: ray.y + 0.8,
    z: ray.z + 0.5,
    bite:
      g.tickCount +
      Math.max(
        40,
        100 +
          Math.floor(Math.random() * 500) -
          enchantLevel(inv.held, "lure") * 100,
      ),
    slot: inv.selected,
  };
  finish(g);
}
export function releaseTrident(g) {
  const c = g.tridentCharge;
  delete g.tridentCharge;
  if (!c || (g.ui?.screen && g.ui.screen !== "play")) return false;
  const inv = g.inventory,
    p = g.player,
    s = inv.held;
  if (
    g.tickCount - c.start < 10 ||
    inv.selected !== c.slot ||
    s !== c.stack ||
    p.health <= 0
  )
    return false;
  const r = enchantLevel(s, "riptide"),
    wet =
      p.inWater ||
      (["rain", "thunder"].includes(g.world.weather?.kind) &&
        g.world.skyHeight(p.x, p.z) < p.y + 2);
  if (r) {
    if (!wet) {
      g.ui?.toast?.("Riptide needs water or rain.");
      return false;
    }
    const d = aim(p);
    p.riptide = {
      x: d.x * (12 + 6 * r),
      y: d.y * (12 + 6 * r),
      z: d.z * (12 + 6 * r),
      ticks: 20,
    };
    p.vy = d.y * (12 + 6 * r);
    p.fallStart = p.y;
    if (g.mode !== "creative") inv.damageTool();
    awardAquatic(g, "riptide", "Barrel roll · Riptide");
    finish(g);
    return true;
  }
  const d = aim(p),
    q = {
      uid: uniqueId(),
      owner: owner(g),
      x: p.x,
      y: p.y + 1.5,
      z: p.z,
      vx: d.x * 1.25,
      vy: d.y * 1.25,
      vz: d.z * 1.25,
      age: 0,
      stack: structuredClone(s),
      creative: g.mode === "creative",
      loyalty: enchantLevel(s, "loyalty"),
    };
  if (wear(q.stack, 1)) return false;
  if (g.mode !== "creative") inv.consume();
  aquaticState(g.world).projectiles.push(q);
  finish(g);
  return true;
}
export function tickAquaticGear(g) {
  const p = g.player,
    w = g.world,
    state = aquaticState(w);
  if (p.riptide?.ticks > 0) {
    p.riptide.hitIds ||= [];
    for (const e of g.entities)
      if (
        e.hp > 0 &&
        e.type !== "boat" &&
        !p.riptide.hitIds.includes(e.id) &&
        Math.hypot(e.x - p.x, e.y - p.y, e.z - p.z) < 1.8
      ) {
        damageEntity(g, e, 9, { kind: "riptide" });
        p.riptide.hitIds.push(e.id);
      }
  }

  if (p.fishing) {
    if (
      g.inventory.held?.id !== "fishing_rod" ||
      g.inventory.selected !== p.fishing.slot ||
      Math.hypot(p.x - p.fishing.x, p.z - p.fishing.z) > 32
    )
      delete p.fishing;
    else if (g.tickCount === p.fishing.bite) {
      g.audio?.tone?.("swim");
      g.ui?.toast?.("A bite! Reel in now.", 2000);
    } else if (g.tickCount > p.fishing.bite + 40)
      p.fishing.bite = g.tickCount + 100 + Math.floor(Math.random() * 300);
  }
  const players = [
    { player: p, inventory: g.inventory, id: playerOwner(p) },
    ...[...(g.multiplayer?.peers?.values?.() || [])].map((v) => ({
      player: v.player,
      inventory: v.inventory,
      id: playerOwner(v.player),
      context: v.context,
    })),
  ];
  const keep = [];
  for (const q of state.projectiles || []) {
    if (!w.chunks.has(`${Math.floor(q.x / 16)},${Math.floor(q.z / 16)}`)) {
      keep.push(q);
      continue;
    }
    q.age++;
    if (q.age > 6000) continue;
    const target = players.find((v) => v.id === q.owner);
    if (
      q.loyalty &&
      (q.hit || q.age > 80) &&
      target &&
      target.player.health > 0
    ) {
      q.returning = true;
      const t = target.player,
        dx = t.x - q.x,
        dy = t.y + 1 - q.y,
        dz = t.z - q.z,
        d = Math.hypot(dx, dy, dz);
      if (d < 1) {
        if (q.creative || target.inventory.add(q.stack) === 0) continue;
        q.hit = true;
      } else {
        const speed = 0.4 + q.loyalty * 0.15;
        q.x += (dx / d) * speed;
        q.y += (dy / d) * speed;
        q.z += (dz / d) * speed;
      }
    } else if (!q.hit) {
      const speed = Math.hypot(q.vx, q.vy, q.vz),
        hit = w.raycast(
          q,
          { x: q.vx / speed, y: q.vy / speed, z: q.vz / speed },
          speed,
          true,
        );
      let victim = null,
        best = hit ? hit.distance / speed : 1.01;
      for (const e of g.entities) {
        if (e.hp <= 0 || e.type === "boat") continue;
        const m = MOB_INFO[e.type];
        for (let i = 0; i <= 10; i++) {
          const f = i / 10;
          if (f >= best) break;
          if (
            Math.abs(q.x + q.vx * f - e.x) < (m?.width || 0.6) / 2 + 0.1 &&
            Math.abs(q.z + q.vz * f - e.z) < (m?.width || 0.6) / 2 + 0.1 &&
            q.y + q.vy * f > e.y &&
            q.y + q.vy * f < e.y + (m?.height || 1.8)
          ) {
            victim = e;
            best = f;
            break;
          }
        }
      }
      if (victim) {
        const dmg =
          8 +
          (MOB_INFO[victim.type]?.aquatic
            ? enchantLevel(q.stack, "impaling") * 2.5
            : 0);
        damageEntity(target?.context || g, victim, dmg, {
          kind: "trident",
          source: target?.player || q,
        });
        q.hit = true;
        if (
          enchantLevel(q.stack, "channeling") &&
          w.weather?.kind === "thunder" &&
          w.skyHeight(victim.x, victim.z) < victim.y + 2
        ) {
          damageEntity(target?.context || g, victim, 5, {
            kind: "lightning",
            source: q,
          });
          w.weather.strike = {
            x: Math.floor(victim.x),
            y: victim.y,
            z: Math.floor(victim.z),
            tick: w.tick,
          };
          g.renderer?.pulseEffect?.(victim);
          playWorldSound(g, "thunder", victim);
        }
        awardAquatic(g, "trident", "A throw to remember · trident hit");
      } else if (hit) {
        q.x += q.vx * best;
        q.y += q.vy * best;
        q.z += q.vz * best;
        q.hit = true;
      } else {
        q.x += q.vx;
        q.y += q.vy;
        q.z += q.vz;
        q.vy -= 0.05;
        const drag = isWater(w.get(q.x, q.y, q.z)) ? 0.99 : 0.99;
        q.vx *= drag;
        q.vy *= drag;
        q.vz *= drag;
      }
    }
    if (q.hit && !q.loyalty && !q.creative) {
      const who = players.find(
        (v) =>
          v.player.health > 0 &&
          Math.hypot(v.player.x - q.x, v.player.y + 1 - q.y, v.player.z - q.z) <
            1.5,
      );
      if (who && who.inventory.add(q.stack) === 0) continue;
    }
    if (q.creative && q.hit && q.age > 120) continue;
    keep.push(q);
  }
  state.projectiles = keep;
  for (const [key, c] of Object.entries(w.containers))
    if (c.type === "brewing_stand") {
      const [x, y, z] = key.split(",").map(Number);
      if (Math.hypot(x - p.x, z - p.z) > 96) continue;
      if (!(c.fuel > 0) && c.slots[4]?.id === "blaze_powder") {
        c.slots[4].count--;
        if (!c.slots[4].count) c.slots[4] = null;
        c.fuel = 20;
      }
      const ingredient = c.slots[3]?.id,
        recipe =
          ingredient === "nether_wart"
            ? ["water_bottle", "awkward_potion"]
            : ingredient === "turtle_shell"
              ? ["awkward_potion", "turtle_master_potion"]
              : null;
      if (
        !recipe ||
        !c.slots.slice(0, 3).some((s) => s?.id === recipe[0]) ||
        !c.fuel
      ) {
        c.progress = 0;
        c.brewIngredient = null;
        continue;
      }
      if (c.brewIngredient !== ingredient) {
        c.progress = 0;
        c.brewIngredient = ingredient;
      }
      if (++c.progress >= 400) {
        for (let i = 0; i < 3; i++)
          if (c.slots[i]?.id === recipe[0]) c.slots[i] = makeStack(recipe[1]);
        c.slots[3].count--;
        if (!c.slots[3].count) c.slots[3] = null;
        c.fuel--;
        c.progress = 0;
        playWorldSound(g, "smelt", { x, y, z });
      }
    }
}
export function brewingSlotAccepts(index, stack) {
  return (
    !stack ||
    (index < 3
      ? ["water_bottle", "awkward_potion", "turtle_master_potion"].includes(
          stack.id,
        )
      : index === 3
        ? ["nether_wart", "turtle_shell"].includes(stack.id)
        : index === 4 && stack.id === "blaze_powder")
  );
}
