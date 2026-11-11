import { MOB_INFO } from "./data.js";
import { collides } from "./physics.js";
import {
  relicSite,
  TEMPLE_GUARDIANS,
  guardianDefeatCount,
  templeGuardiansDefeated,
  openTempleSeal,
  openTempleApproach,
} from "./relic.js";
import {
  populateInfernalEncounter,
  recordInfernalDeath,
} from "./infernal-encounters.js";
import { nearbyCinderSites } from "./cinderworld.js";

export function populateEncounters(game, createEntity) {
  const w = game.world,
    p = game.player;
  if (w.generationVersion < 7) return;
  if (w.dimension === "overworld") {
    const site = relicSite(w);
    if (
      !site?.temple ||
      w.relicClaimed ||
      Math.hypot(p.x - site.x, p.z - site.z) > 80
    )
      return;
    let record = w.settlements["devin-temple"];
    if (!record)
      record = w.settlements["devin-temple"] = { created: [], defeated: [] };
    if (templeGuardiansDefeated(game)) openTempleSeal(w);
    if (
      record.attuned ||
      game.mode === "creative" ||
      game.difficulty === "peaceful"
    )
      openTempleApproach(w);
    for (let i = 0; i < TEMPLE_GUARDIANS; i++) {
      if (record.created.includes(i) || record.defeated.includes(i)) continue;
      const [dx, dz] = (
          w.generationVersion >= 10
            ? [
                [-11, 4],
                [11, 4],
                [0, -12],
              ]
            : w.generationVersion >= 9
              ? [
                  [-9, 5],
                  [9, 5],
                  [0, -10],
                ]
              : [
                  [-6, 3],
                  [6, 3],
                  [0, -7],
                ]
        )[i],
        e = createEntity(
          game,
          "devin_guardian",
          site.x + dx,
          site.z + dz,
          `devin-guardian:${i}`,
        );
      Object.assign(e, {
        y: site.y,
        persistent: true,
        encounter: "devin-temple",
        guardianIndex: i,
        home: { x: site.x + dx + 0.5, z: site.z + dz + 0.5, y: site.y },
        anchor: { x: site.x + 0.5, z: site.z + 0.5 },
      });
      const info = MOB_INFO[e.type];
      if (!collides(w, e, info.height, info.width)) {
        game.entities.push(e);
        record.created.push(i);
      }
    }
  } else {
    for (const s of nearbyCinderSites(w, p.x, p.z, 72)) {
      if (w.generationVersion >= 11) {
        populateInfernalEncounter(game, s, createEntity, collides, MOB_INFO);
        continue;
      }
      if (game.difficulty === "peaceful") continue;
      const record = (w.settlements[s.id] ||= { created: [] });
      const guards =
        s.kind === "bastion"
          ? [
              [-6, 5, "cinder_wraith"],
              [6, 5, "basalt_crawler"],
              [0, -6, "emberling"],
            ]
          : s.kind === "shrine"
            ? [[0, 5, "cinder_wraith"]]
            : [];
      for (let i = 0; i < guards.length; i++) {
        if (record.created.includes(i)) continue;
        const [dx, dz, type] = guards[i],
          e = createEntity(game, type, s.x + dx, s.z + dz, `${s.id}:${i}`);
        Object.assign(e, { y: s.y + 1, persistent: true, encounter: s.id });
        if (
          !collides(
            w,
            e,
            MOB_INFO[type]?.height || 1.95,
            MOB_INFO[type]?.width || 0.6,
          )
        ) {
          game.entities.push(e);
          record.created.push(i);
        }
      }
    }
  }
}
export function recordGuardianDeath(world, entity) {
  recordInfernalDeath(world, entity);
  if (
    entity.type !== "devin_guardian" ||
    entity.encounter !== "devin-temple" ||
    !(entity.hp <= 0) ||
    !Number.isInteger(entity.guardianIndex) ||
    entity.guardianIndex < 0 ||
    entity.guardianIndex >= TEMPLE_GUARDIANS
  )
    return;
  const record = world.settlements?.["devin-temple"];
  if (
    record &&
    Number.isInteger(entity.guardianIndex) &&
    !record.defeated.includes(entity.guardianIndex)
  ) {
    record.defeated.push(entity.guardianIndex);
    if (guardianDefeatCount(world) === TEMPLE_GUARDIANS) openTempleSeal(world);
  }
}
