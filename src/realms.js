import { recordAchievement } from "./achievements.js";
import { restoreEmbeddedArrows } from "./embedded-arrows.js";
import { upgradeNightEnemies } from "./hostile-combat.js";
import { restoreWeather } from "./weather.js";
import { World } from "./world.js";
import { B, GENERATION_VERSION } from "./data.js";
import { buildPortal, validFrame, frameKey } from "./portals.js";
import { createEntity } from "./simulation.js";
export function realmState(game) {
  return { world: game.world, entities: game.entities, drops: game.drops };
}
export function exportRealm(state) {
  const w = state.world;
  return {
    edits: w.exportEdits(),
    palm: w.palm,
    protectedAreas: w.protectedAreas || [],
    generationVersion: w.generationVersion,
    weather: w.weather,
    relicClaimed: w.relicClaimed,
    settlements: w.settlements,
    containers: w.containers,
    crops: w.cropTicks,
    aquatic: w.aquatic,
    portals: w.portals,
    worldTick: w.tick,
    blockTimers: w.blockTimers,
    entities: state.entities,
    drops: state.drops,
    embeddedArrows: w.embeddedArrows || [],
  };
}
export function restoreRealm(seed, dimension, data = {}) {
  const world = new World(
    seed,
    data.edits || {},
    dimension,
    data.generationVersion ??
      (Object.keys(data).length ? 2 : GENERATION_VERSION),
  );
  world.embeddedArrows = restoreEmbeddedArrows(data.embeddedArrows);
  world.palm = data.palm || null;
  world.protectedAreas = data.protectedAreas || [];
  world.weather = restoreWeather(data.weather, world.seedInt);
  world.relicClaimed = !!data.relicClaimed;
  world.settlements = data.settlements || {};
  world.containers = data.containers || {};
  world.cropTicks = data.crops || {};
  world.aquatic = data.aquatic || {
    growth: {},
    projectiles: [],
    achievements: {},
  };
  world.portals = data.portals || {};
  world.tick = data.worldTick || 0;
  world.restoreDynamics(data.blockTimers);
  return {
    world,
    entities: upgradeNightEnemies(data.entities, dimension),
    drops: data.drops || [],
  };
}
export function selectRealm(game, dimension) {
  game.standProjectiles = [];
  game.sharedStandProjectiles = [];
  game.seekers = [];
  game.pistolTraces = [];
  delete game.player.tricksterDash;
  game.hostileProjectiles = [];
  game.realms = game.realms || {};
  game.realms[game.dimension || "overworld"] = realmState(game);
  if (!game.realms[dimension])
    game.realms[dimension] = restoreRealm(game.world.seed, dimension);
  const state = game.realms[dimension];
  game.dimension = dimension;
  game.world = state.world;
  game.entities = state.entities;
  game.drops = state.drops;
  game.renderer.setWorld(game.world);
}
export function travel(game, source) {
  const from = game.dimension || "overworld",
    to = from === "overworld" ? "cinderwild" : "overworld",
    key = `${from}:${frameKey(source)}`;
  game.portalLinks = game.portalLinks || {};
  let dest = game.portalLinks[key]?.frame;
  selectRealm(game, to);
  recordAchievement(game,"dimension",{key:to});
  if (!dest || !validFrame(game.world, dest)) {
    let x = Math.floor(source.x * (to === "cinderwild" ? 1 / 8 : 8)),
      z = Math.floor(source.z * (to === "cinderwild" ? 1 / 8 : 8));
    for (let r = 0; r < 32; r += 4) {
      const t = game.world.terrain(x + r, z);
      if (t.h > (to === "cinderwild" ? 70 : 64)) {
        x += r;
        break;
      }
    }
    const y = Math.max(
      game.world.terrain(x, z).h + 1,
      to === "cinderwild" ? 70 : 64,
    );
    dest = { x, y, z, axis: "x" };
    for (let dx = -2; dx <= 5; dx++)
      for (let dz = -3; dz <= 4; dz++) {
        game.world.set(
          x + dx,
          y,
          z + dz,
          to === "cinderwild" ? B.cinderstone : B.cobble,
        );
        for (let dy = 1; dy <= 6; dy++)
          game.world.set(x + dx, y + dy, z + dz, B.air);
      }
    buildPortal(game.world, dest);
    game.portalLinks[key] = { dimension: to, frame: dest };
    game.portalLinks[`${to}:${frameKey(dest)}`] = {
      dimension: from,
      frame: source,
    };
  }
  const p = game.player;
  Object.assign(p, {
    x: dest.x + (dest.axis === "x" ? 1.5 : 2.5),
    y: dest.y + 1.01,
    z: dest.z + (dest.axis === "x" ? 2.5 : 1.5),
    yaw: dest.axis === "x" ? 0 : Math.PI / 2,
    pitch: 0,
    vx: 0,
    vy: 0,
    vz: 0,
    fallStart: dest.y + 1,
    onGround: false,
    flying: false,
  });
  // An exit cannot spawn inside a solid block or over an unbounded drop.
  const fx = Math.floor(p.x),
    fz = Math.floor(p.z),
    fy = Math.floor(p.y);
  for (let y = fy; y <= fy + 2; y++)
    if (game.world.solid(fx, y, fz)) game.world.set(fx, y, fz, B.air);
  if (!game.world.solid(fx, fy - 1, fz))
    game.world.set(fx, fy - 1, fz, B.obsidian);
  game.portalCooldown = 100;
  game.portalCharge = 0;
  if (to === "cinderwild" && !game.entities.length)
    for (let i = 0; i < 5; i++) {
      const e = createEntity(
        game,
        game.world.generationVersion >= 7
          ? [
              "ash_deer",
              "cinderback",
              "basalt_crawler",
              "cinder_wraith",
              "emberling",
            ][i]
          : "emberling",
        fx + 12 + i * 4,
        fz + 8 + (i % 2) * 8,
      );
      if (game.world.get(e.x, e.y, e.z) !== B.lava) game.entities.push(e);
    }
  game.renderer.loadAround(p.x, p.z, 2, 5);
  game.audio.tone("portal");
  game.ui.play();
  game.ui.announce(
    to === "cinderwild" ? "CINDERWORLD" : "OVERWORLD",
    to === "cinderwild"
      ? "Seek Hellfire and Brimstone at Y 15–70. Open Cinderworld Expedition in the pause menu."
      : "Home beneath an open sky.",
  );
  game.save().catch((e) => game.ui.toast("Save failed: " + e.message));
}
