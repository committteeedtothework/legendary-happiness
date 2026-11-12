import { preserveAchievements } from "./achievements.js";
// Persistent, single-player incursion trial. The arena is an edited area of the
// real Cinderworld; its entities, supplies and progress use normal realm saves.
import { B, BLOCKS, makeStack } from "./data.js";
import { hash } from "./random.js";
import { collides, moveBody, createPlayer } from "./physics.js";
import { selectRealm, restoreRealm } from "./realms.js";
import { combatClear } from "./defenders.js";

const KEY = "matthew-incursion";
export const TITAN_HP = 320;
export function incursionAcrossRealms(g) {
  return (g.dimension === "cinderwild" ? g.realms?.overworld?.world : g.world)
    ?.settlements?.[KEY];
}
export function activeTrial(g) {
  const t = incursionAcrossRealms(g)?.trial;
  return t && ["active", "victory"].includes(t.phase) ? t : null;
}
const checkpoint = (t) => ({
  x: t.arena.x + 0.5,
  y: t.arena.y + 1.01,
  z: t.arena.z + 13.5,
});
function placePlayer(g, pos) {
  Object.assign(g.player, pos, {
    vx: 0,
    vy: 0,
    vz: 0,
    fallStart: pos.y,
    onGround: false,
    flying: false,
  });
  delete g.player.riftGrip;
  g.sprintInput?.reset();
  g.portalCooldown = 100;
  g.portalCharge = 0;
  g.renderer?.loadAround?.(pos.x, pos.z, 2, 5);
}
function persist(g) {
  g.save?.()?.catch?.(() =>
    g.ui?.toast?.("Save failed. Export a backup before closing."),
  );
}
// Never build over edits in any vertical layer, including existing sky builds.
export function findTrialSite(world, site) {
  for (let n = 0; n < 32; n++) {
    const x = Math.floor(site.x / 8) + 4096 + n * 96;
    const z = Math.floor(site.z / 8) + 4096;
    let occupied = false;
    for (
      let cx = Math.floor((x - 18) / 16);
      cx <= Math.floor((x + 18) / 16);
      cx++
    )
      for (
        let cz = Math.floor((z - 18) / 16);
        cz <= Math.floor((z + 18) / 16);
        cz++
      )
        if (
          (world.editChunks.get(`${cx},${cz}`) || []).some(
            ([ex, , ez]) => Math.abs(ex - x) <= 18 && Math.abs(ez - z) <= 18,
          )
        )
          occupied = true;
    if (!occupied) return { x, y: 244, z };
  }
  return null;
}
export function buildTrialArena(world, t) {
  const { x, y, z } = t.arena;
  for (let dx = -16; dx <= 16; dx++)
    for (let dz = -16; dz <= 16; dz++) {
      world.set(x + dx, y, z + dz, B.riftstone);
      world.set(x + dx, y + 17, z + dz, B.riftstone);
      const wall = Math.abs(dx) === 16 || Math.abs(dz) === 16;
      for (let dy = 1; dy < 17; dy++)
        world.set(x + dx, y + dy, z + dz, wall ? B.riftstone : B.air);
      if (wall && (dx % 4 === 0 || dz % 4 === 0))
        world.set(x + dx, y + 8, z + dz, B.emberglass);
    }
  for (const side of [-1, 1])
    for (let d = -12; d <= 12; d += 4) {
      world.set(x + side * 15, y + 1, z + d, B.glow_crystal);
      for (let h = 1; h <= 8; h++)
        world.set(x + side * 14, y + h, z + d, B.basalt);
      for (let a = 0; a < 5; a++)
        world.set(x + side * (14 - a), (y + 9 + a / 2) | 0, z + d, B.basalt);
    }
  // A player-width entry keeps the giant out of the recovery alcove.
  for (let dx = -4; dx <= 4; dx++)
    for (let dy = 1; dy <= 6; dy++)
      if (dx !== 0 || dy > 2) world.set(x + dx, y + dy, z + 10, B.riftstone);
  for (const dx of [-4, 4])
    for (let dz = 11; dz < 16; dz++)
      for (let dy = 1; dy <= 6; dy++)
        world.set(x + dx, y + dy, z + dz, B.riftstone);
  for (let dx = -4; dx <= 4; dx++)
    for (let dz = 10; dz < 16; dz++)
      world.set(x + dx, y + 7, z + dz, B.riftstone);
  for (const dx of [-8, 8])
    for (const dz of [-6, 4])
      for (let dy = 1; dy <= 4; dy++)
        world.set(x + dx, y + dy, z + dz, B.basalt);
  world.set(x, y + 1, z + 15, B.trial_exit);
  world.set(x + 2, y + 1, z + 13, B.chest);
  world.containers[`${x + 2},${y + 1},${z + 13}`] = {
    type: "chest",
    slots: Array.from(
      { length: 27 },
      (_, i) =>
        [
          makeStack("diamond_sword"),
          makeStack("iron_helmet"),
          makeStack("iron_chestplate"),
          makeStack("iron_leggings"),
          makeStack("iron_boots"),
          makeStack("cooked_meat", 16),
        ][i] || null,
    ),
  };
}
export function beginTitanTrial(g, createEntity) {
  const s = incursionAcrossRealms(g);
  if (
    !s ||
    s.trial ||
    g.dimension !== "overworld" ||
    g.mode !== "survival" ||
    g.multiplayer?.connected ||
    g.player.health <= 0
  )
    return false;
  g.realms ||= {};
  const state = (g.realms.cinderwild ||= restoreRealm(
    g.world.seed,
    "cinderwild",
  ));
  const arena = findTrialSite(state.world, s);
  if (!arena) {
    delete s.grab;
    delete g.player.riftGrip;
    return false;
  }
  const t = (s.trial = {
    phase: "active",
    arena,
    bossId: `mad-titan:${s.x}:${s.z}`,
    return: {
      x: g.player.x,
      y: g.player.y,
      z: g.player.z,
      yaw: g.player.yaw,
      pitch: g.player.pitch,
    },
    bossHP: TITAN_HP,
  });
  delete s.grab;
  buildTrialArena(state.world, t);
  selectRealm(g, "cinderwild");
  const e = createEntity(g, "mad_titan", arena.x, arena.z - 5, t.bossId);
  Object.assign(e, {
    y: arena.y + 1,
    hp: TITAN_HP,
    persistent: true,
    encounter: "mad-titan-trial",
    home: { x: arena.x + 0.5, y: arena.y + 1, z: arena.z - 4.5 },
    specialCooldown: 90,
  });
  g.entities.push(e);
  placePlayer(g, checkpoint(t));
  g.ui?.announce?.(
    "A MAD TITAN",
    "Bullets shatter against its hide. Take the recovery supplies; defeat the beast to unlock the return rune.",
  );
  g.audio?.tone?.("incursion");
  persist(g);
  return true;
}
export function respawnInTrial(g) {
  const t = activeTrial(g);
  if (!t || g.dimension !== "cinderwild") return false;
  const standData = g.player.standData;
  g.player = preserveAchievements(g.player,createPlayer(checkpoint(t)));
  if (standData) {
    g.player.standData = standData;
    standData.summoned = false;
    standData.transformed = false;
    standData.trial = null;
  }
  placePlayer(g, checkpoint(t));
  g.resume?.();
  g.ui?.toast?.(
    "The trial holds you here. Your dropped equipment remains in the arena.",
  );
  persist(g);
  return true;
}
export function recordTitanDeath(g, e) {
  const t = activeTrial(g);
  if (
    !t ||
    e.id !== t.bossId ||
    e.type !== "mad_titan" ||
    e.hp > 0 ||
    t.phase !== "active"
  )
    return false;
  t.phase = "victory";
  t.bossHP = 0;
  g.player.xp += 30;
  // A one-time reward, kept in the normal persistent drop list by simulation.
  g.ui?.announce?.(
    "THE TITAN FALLS",
    "The return rune in the recovery alcove is open. Right-click it to escape.",
  );
  g.audio?.tone?.("rune");
  return true;
}
export function useTrialExit(g, target) {
  const t = activeTrial(g);
  if (
    !t ||
    g.dimension !== "cinderwild" ||
    !target ||
    target.x !== t.arena.x ||
    target.y !== t.arena.y + 1 ||
    target.z !== t.arena.z + 15 ||
    g.world.get(target.x, target.y, target.z) !== B.trial_exit
  )
    return false;
  if (
    Math.hypot(
      g.player.x - target.x - 0.5,
      g.player.y + 1.5 - target.y - 0.5,
      g.player.z - target.z - 0.5,
    ) > 4.5
  )
    return true;
  if (t.phase !== "victory") {
    g.ui?.toast?.(
      "The return rune is sealed. Defeat A Mad Titan; bullets cannot hurt it.",
    );
    return true;
  }
  const s = incursionAcrossRealms(g);
  selectRealm(g, "overworld");
  // Search outside the shrine for a supported, full-body safe return.
  let point = null;
  for (let radius = 9; radius <= 96 && !point; radius += 3)
    for (let i = 0; i < 16 && !point; i++) {
      const x = Math.floor(s.x + Math.cos((i * Math.PI) / 8) * radius) + 0.5,
        z = Math.floor(s.z + Math.sin((i * Math.PI) / 8) * radius) + 0.5;
      const y = g.world.terrain(x, z).h + 1.01;
      if (
        g.world.solid(x, y - 1, z) &&
        !collides(g.world, { x, y, z }, 1.8, 0.6) &&
        !BLOCKS[g.world.get(x, y, z)]?.fluid &&
        g.world.get(x, y, z) !== B.fire
      )
        point = { x, y, z };
    }
  // The Overworld does not advance during a solo trial: the original grab
  // position is also a valid fallback when edited terrain obscures heightmaps.
  if (!point)
    for (
      let y = Math.floor(t.return.y);
      y >= Math.floor(t.return.y) - 16;
      y--
    ) {
      const { x, z } = t.return;
      if (
        g.world.solid(x, y - 1, z) &&
        !collides(g.world, { x, y: y + 0.01, z }, 1.8, 0.6) &&
        !BLOCKS[g.world.get(x, y, z)]?.fluid &&
        g.world.get(x, y, z) !== B.fire
      ) {
        point = { x, y: y + 0.01, z };
        break;
      }
    }
  if (!point) {
    // Preserve the sealed trial if the surroundings have become unsafe.
    selectRealm(g, "cinderwild");
    g.ui?.toast?.(
      "The far side is obstructed. Clear a safe landing outside the shrine.",
    );
    return true;
  }
  t.phase = "escaped";
  placePlayer(g, { ...point, yaw: t.return.yaw, pitch: t.return.pitch });
  g.ui?.announce?.(
    "ESCAPED CINDERWORLD",
    "The Hellspawn still guard the pistols. Finish the battle to claim them.",
  );
  persist(g);
  return true;
}
export function tickRiftTrial(g, createEntity) {
  if (g.multiplayer?.isGuest) return false;
  const s = incursionAcrossRealms(g),
    p = g.player,
    t = activeTrial(g);
  if (t && g.dimension === "cinderwild") {
    delete p.riftGrip;
    let boss = g.entities.find((e) => e.id === t.bossId);
    if (boss && boss.hp <= 0) recordTitanDeath(g, boss);
    if (!boss && t.phase === "active" && t.bossHP > 0) {
      boss = createEntity(g, "mad_titan", t.arena.x, t.arena.z - 5, t.bossId);
      Object.assign(boss, {
        y: t.arena.y + 1,
        hp: t.bossHP,
        persistent: true,
        encounter: "mad-titan-trial",
        specialCooldown: 90,
      });
      g.entities.push(boss);
    }
    if (
      boss &&
      boss.hp > 0 &&
      (Math.abs(boss.x - t.arena.x) > 14 ||
        Math.abs(boss.z - t.arena.z) > 14 ||
        boss.y < t.arena.y ||
        boss.y > t.arena.y + 12)
    )
      Object.assign(boss, {
        x: t.arena.x + 0.5,
        y: t.arena.y + 1,
        z: t.arena.z - 4.5,
        vx: 0,
        vy: 0,
        vz: 0,
      });
    if (boss) t.bossHP = boss.hp;
    if (
      p.health > 0 &&
      (Math.abs(p.x - t.arena.x) > 15.6 ||
        Math.abs(p.z - t.arena.z) > 15.6 ||
        p.y < t.arena.y ||
        p.y > t.arena.y + 15)
    )
      placePlayer(g, checkpoint(t));
    return false;
  }
  if (!s || g.dimension !== "overworld") {
    delete p.riftGrip;
    return false;
  }
  if (
    s.trial ||
    !["emerging", "battle"].includes(s.phase) ||
    (s.phase === "emerging" && s.age < 60) ||
    g.mode !== "survival" ||
    g.difficulty === "peaceful" ||
    p.health <= 0 ||
    g.multiplayer?.connected
  ) {
    delete s.grab;
    delete p.riftGrip;
    return false;
  }
  if (s.grab) {
    const a = s.grab,
      anchor = {
        x: s.x + Math.cos((a.arm * Math.PI) / 3) * 5.8,
        y: s.y,
        z: s.z + Math.sin((a.arm * Math.PI) / 3) * 5.8,
      };
    const distance = Math.hypot(p.x - anchor.x, p.z - anchor.z);
    if (
      Math.abs(p.y - s.y) > 4 ||
      distance > 4 ||
      !combatClear(g.world, anchor, p)
    ) {
      delete s.grab;
      delete p.riftGrip;
      return false;
    }
    a.age++;
    if (a.age < 40) return false;
    p.riftGrip = true;
    const dx = anchor.x - p.x,
      dz = anchor.z - p.z,
      d = Math.max(0.01, Math.hypot(dx, dz));
    const oldX = p.x,
      oldZ = p.z;
    if (d > 0.35)
      moveBody(g.world, p, (dx / d) * 0.18, 0, (dz / d) * 0.18, 1.8, 0.6);
    if (d > 0.5 && Math.hypot(p.x - oldX, p.z - oldZ) < 0.01)
      a.blocked = (a.blocked || 0) + 1;
    else a.blocked = 0;
    if (a.blocked >= 6) {
      delete s.grab;
      delete p.riftGrip;
      g.ui?.toast?.("Cover broke the tentacle’s grip.");
      return false;
    }
    if (a.age >= 70) return beginTitanTrial(g, createEntity);
    return false;
  }
  delete p.riftGrip;
  if (g.tickCount < (s.nextGrabTick || 0)) return false;
  s.nextGrabTick = g.tickCount + 100;
  s.grabChecks = (s.grabChecks || 0) + 1;
  for (let arm = 0; arm < 6; arm++) {
    const x = s.x + Math.cos((arm * Math.PI) / 3) * 5.8,
      z = s.z + Math.sin((arm * Math.PI) / 3) * 5.8;
    if (
      Math.hypot(p.x - x, p.z - z) < 2.8 &&
      Math.abs(p.y - s.y) < 3 &&
      combatClear(g.world, { x, y: s.y, z }, p) &&
      hash(s.grabChecks, arm, 813, g.world.seedInt) < 0.25
    ) {
      s.grab = { arm, age: 0 };
      g.ui?.announce?.(
        "TENTACLE REACHING",
        "Move away from the writhing tentacle! It can drag you into Cinderworld.",
      );
      g.audio?.tone?.("guardian-charge");
      break;
    }
  }
  return false;
}
