import { playerEye } from "./player-body.js";
import { ITEMS, MOB_INFO, B, BLOCKS } from "./data.js";
import { collides } from "./physics.js";
import { createEntity } from "./simulation.js";
export function useSpawnEgg(g) {
  const item = ITEMS[g.inventory.held?.id];
  if (!item?.spawnType) return false;
  if (g.mode !== "creative") {
    g.ui?.toast?.("Spawn eggs can only be used in Creative.");
    return true;
  }
  const m = MOB_INFO[item.spawnType];
  const t =
    g.target ||
    (m.aquatic && g.direction
      ? g.world.raycast(
          { x: g.player.x, y: g.player.y + playerEye(g.player), z: g.player.z },
          g.direction(),
          6,
          false,
          true,
        )
      : null);
  if (!t || !t.normal) {
    g.ui?.toast?.("Aim at a block face to use this spawn egg.");
    return true;
  }
  if (
    Math.hypot(
      g.player.x - t.x - 0.5,
      g.player.y + 1.62 - t.y - 0.5,
      g.player.z - t.z - 0.5,
    ) > 6
  )
    return true;
  if (
    g.entities.length >= 256 ||
    (item.spawnType === "watcher" &&
      g.entities.some((e) => e.type === "watcher" && e.hp > 0))
  ) {
    g.ui?.toast?.("Creature limit reached.");
    return true;
  }
  const x = t.x + t.normal.x + 0.5,
    z = t.z + t.normal.z + 0.5,
    y = t.y + (m.aquatic && BLOCKS[t.id]?.fluid ? 0 : t.normal.y > 0 ? 1 : 0);
  for (let dy = 0; dy <= 2; dy++) {
    const p = { x, y: y + dy, z };
    if (
      (!m.aquatic && !g.world.solid(x, p.y - 1, z)) ||
      (!m.aquatic && BLOCKS[g.world.get(x, p.y, z)]?.fluid) ||
      g.world.get(x, p.y, z) === B.fire ||
      collides(g.world, p, m.height, m.width)
    )
      continue;
    const bodies = [
      g.player,
      ...g.entities,
      ...(g.multiplayer?.occupants?.() || []),
    ];
    if (
      bodies.some(
        (e) =>
          e.hp !== 0 &&
          Math.abs(e.x - x) <
            (m.width + (MOB_INFO[e.type]?.width || 0.6)) / 2 &&
          Math.abs(e.z - z) <
            (m.width + (MOB_INFO[e.type]?.width || 0.6)) / 2 &&
          e.y < p.y + m.height &&
          e.y + (MOB_INFO[e.type]?.height || 1.8) > p.y,
      )
    )
      continue;
    const e = createEntity(g, item.spawnType, x - 0.5, z - 0.5);
    Object.assign(e, p, { creativeSpawn: true, persistent: true });
    if (e.type === "villager")
      Object.assign(e, {
        profession: "farmer",
        villageStyle: "plains",
        tradeUses: [0, 0],
      });
    g.entities.push(e);
    g.renderer?.action?.("use");
    g.audio?.tone?.("pop");
    g.ui?.toast?.(`Spawned ${m.name}`);
    return true;
  }
  g.ui?.toast?.("There is not enough clear space for this creature.");
  return true;
}
