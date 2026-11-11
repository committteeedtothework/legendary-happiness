import { B } from "./data.js";
import { infernalGuards } from "./infernal-world.js";
import { siteOffset } from "./expedition-structures.js";

export function infernalLootBlocked(game, target) {
  if (!target || game.mode === "creative" || game.difficulty === "peaceful")
    return false;
  const chest = game.world.containers[`${target.x},${target.y},${target.z}`];
  if (!chest?.encounter || !chest.guarded) return false;
  const defeated = game.world.settlements[chest.encounter]?.defeated || [];
  if (new Set(defeated).size >= chest.guarded) return false;
  game.ui?.toast?.(
    `The vault is bound to its defenders · ${defeated.length} / ${chest.guarded} defeated.`,
  );
  return true;
}
export function openInfernalVault(world, site) {
  for (let x = -1; x <= 1; x++)
    for (let y = 1; y <= 4; y++) {
      const [dx, dz] = siteOffset(site, x, -8);
      if (world.get(site.x + dx, site.y + y, site.z + dz) === B.infernal_seal)
        world.set(site.x + dx, site.y + y, site.z + dz, B.air);
    }
}
export function recordInfernalDeath(world, entity) {
  if (
    !entity.encounter?.startsWith("infernal:") ||
    !Number.isInteger(entity.guardIndex)
  )
    return;
  const record = world.settlements[entity.encounter];
  if (!record || entity.guardIndex < 0 || entity.guardIndex >= 6) return;
  record.defeated ||= [];
  if (!record.defeated.includes(entity.guardIndex))
    record.defeated.push(entity.guardIndex);
  if (record.defeated.length >= 6 && record.site)
    openInfernalVault(world, record.site);
}
export function populateInfernalEncounter(
  game,
  site,
  createEntity,
  collides,
  mobInfo,
) {
  const record = (game.world.settlements[site.id] ||= {
    created: [],
    defeated: [],
    site,
  });
  if (
    game.mode === "creative" ||
    game.difficulty === "peaceful" ||
    record.defeated.length >= 6
  )
    openInfernalVault(game.world, site);
  if (game.difficulty === "peaceful") return;
  for (const [i, [dx, dz, type]] of infernalGuards(site).entries()) {
    if (record.created.includes(i) || record.defeated.includes(i)) continue;
    const e = createEntity(
      game,
      type,
      site.x + dx,
      site.z + dz,
      `${site.id}:guard:${i}`,
    );
    Object.assign(e, {
      y: site.y + 1,
      persistent: true,
      encounter: site.id,
      guardIndex: i,
      home: { x: site.x + dx + 0.5, y: site.y + 1, z: site.z + dz + 0.5 },
      anchor: { x: site.x + 0.5, z: site.z + 0.5 },
    });
    if (!collides(game.world, e, mobInfo[type].height, mobInfo[type].width)) {
      game.entities.push(e);
      record.created.push(i);
    }
  }
}
