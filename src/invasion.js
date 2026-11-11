import { playWorldSound } from "./spatial-audio.js";
import { nearbyVillages } from "./villages.js";
import { B, BLOCKS, ITEMS, MOB_INFO, makeStack } from "./data.js";
import { hash } from "./random.js";
import { collides } from "./physics.js";
import { MATTHEW } from "./matthew.js";

export const INVASION = "matthew-incursion";
export const INVASION_ANNOUNCEMENT =
  "Hellspawn from Cinderworld have surfed in the overworld! Defeat them and claim a powerful weapon.";
export const INVADERS = [
  ["soul_reaver", -4, -3, 84],
  ["dread_knight", 4, -3, 120],
  ["magma_maw", -4, 3, 88],
  ["soul_reaver", 4, 3, 84],
];
export const invasionState = (w) => w.settlements?.[INVASION];
export function invasionPlan(site) {
  const cells = new Map(),
    put = (x, y, z, id) => cells.set(`${x},${y},${z}`, [x, y, z, id]);
  for (let x = -6; x <= 6; x++)
    for (let z = -6; z <= 6; z++) {
      const r = Math.max(Math.abs(x), Math.abs(z));
      if (r <= 5 || Math.abs(x) <= 1 || Math.abs(z) <= 1) {
        put(x, -1, z, r === 5 ? B.basalt : B.cinder_bricks);
        for (let y = 0; y <= 5; y++) put(x, y, z, B.air);
      }
    }
  for (const x of [-5, 5])
    for (const z of [-5, 5]) {
      for (let y = 0; y <= 5; y++)
        put(x, y, z, y === 4 ? B.runestone : B.basalt);
      put(x, 6, z, B.emberglass);
      for (const dx of [-1, 0, 1]) put(x + dx, 4, z, B.cinder_bricks);
    }
  for (let x = -2; x <= 2; x++)
    for (let z = -2; z <= 2; z++) put(x, 0, z, B.basalt);
  put(0, 1, 0, B.matthew_altar);
  return [...cells.values()].map(([x, y, z, id]) => [
    site.x + x,
    site.y + y,
    site.z + z,
    id,
  ]);
}
// An incursion never overwrites player edits, villages, water, or unloaded land.
export function findInvasionSite(g) {
  const w = g.world,
    p = g.player;
  for (let a = 0; a < 24; a++) {
    const angle = hash(a, (g.tickCount / 600) | 0, 73, w.seedInt) * Math.PI * 2,
      r = 24 + hash(a, 4, 19, w.seedInt) * 10;
    const x = Math.floor(p.x + Math.cos(angle) * r),
      z = Math.floor(p.z + Math.sin(angle) * r);
    if (
      nearbyVillages(w, x, z, 12).some(
        (v) => Math.abs(v.x - x) < 45 && Math.abs(v.z - z) < 45,
      )
    )
      continue;
    let min = Infinity,
      max = -Infinity,
      valid = true;
    for (let dx = -7; dx <= 7 && valid; dx++)
      for (let dz = -7; dz <= 7; dz++) {
        if (
          !w.chunks.has(
            `${Math.floor((x + dx) / 16)},${Math.floor((z + dz) / 16)}`,
          )
        ) {
          valid = false;
          break;
        }
        const h = w.terrain(x + dx, z + dz).h;
        min = Math.min(min, h);
        max = Math.max(max, h);
        if (h < 63 || h > 285 || max - min > 3) {
          valid = false;
          break;
        }
        for (let y = h; y <= h + 7; y++) {
          const id = w.get(x + dx, y, z + dz),
            b = BLOCKS[id];
          if (
            b?.fluid ||
            b?.door ||
            b?.container ||
            [
              "planks",
              "runestone",
              "cobble",
              "log",
              "birch_log",
              "pine_log",
              "bamboo",
              "cinder_bricks",
            ].includes(b?.key) ||
            b?.foliage
          ) {
            valid = false;
            break;
          }
        }
        if (!valid) break;
      }
    if (!valid) continue;
    for (
      let cz = Math.floor((z - 8) / 16);
      cz <= Math.floor((z + 8) / 16) && valid;
      cz++
    )
      for (
        let cx = Math.floor((x - 8) / 16);
        cx <= Math.floor((x + 8) / 16) && valid;
        cx++
      )
        for (const [ex, , ez] of w.editChunks.get(`${cx},${cz}`) || []) {
          if (Math.abs(ex - x) <= 8 && Math.abs(ez - z) <= 8) {
            valid = false;
            break;
          }
        }
    if (valid) return { x, y: max + 1, z };
  }
  return null;
}
export function beginInvasion(g, site = findInvasionSite(g)) {
  const old = invasionState(g.world);
  if (
    g.world.dimension !== "overworld" ||
    (old && old.phase !== "waiting") ||
    !site
  )
    return false;
  g.world.settlements[INVASION] = {
    ...site,
    phase: "emerging",
    age: 0,
    opened: false,
    created: [],
    defeated: [],
  };
  g.ui?.announce?.("CINDERWORLD INCURSION", INVASION_ANNOUNCEMENT);
  g.ui?.toast?.(INVASION_ANNOUNCEMENT, 14000);
  playWorldSound(g, "incursion", invasionState(g.world));
  return true;
}
export function recordInvaderDeath(w, e) {
  const s = invasionState(w);
  if (
    !s ||
    e.encounter !== INVASION ||
    !Number.isInteger(e.invasionIndex) ||
    e.invasionIndex < 0 ||
    e.invasionIndex >= INVADERS.length
  )
    return;
  if (!s.defeated.includes(e.invasionIndex)) s.defeated.push(e.invasionIndex);
}
export function tickInvasion(g, createEntity) {
  const w = g.world,
    p = g.player;
  if (w.dimension !== "overworld" || g.multiplayer?.isGuest) return;
  w.settlements ||= {};
  if (!Number.isFinite(w.tick)) return;
  let s = invasionState(w);
  if (!s)
    s = w.settlements[INVASION] = {
      phase: "waiting",
      nextCheck: w.tick + 1200,
      attempts: 0,
    };
  if (s.phase === "waiting") {
    if (w.tick < s.nextCheck || g.difficulty === "peaceful") return;
    s.nextCheck = w.tick + 600;
    s.attempts++;
    if (hash(s.attempts, 91, 41, w.seedInt) < 0.25) beginInvasion(g);
    return;
  }
  if (
    s.phase === "claimed" ||
    g.difficulty === "peaceful" ||
    Math.hypot(p.x - s.x, p.z - s.z) > 96
  )
    return;
  if (s.phase === "emerging") {
    // Hold the opening/build transition if a body is standing in the footprint.
    if (
      (s.age === 39 || s.age >= 179) &&
      [p, ...g.entities, ...(g.multiplayer?.occupants?.() || [])].some(
        (e) =>
          e.hp !== 0 &&
          Math.abs(e.x - s.x) < 7.5 &&
          Math.abs(e.z - s.z) < 7.5 &&
          e.y < s.y + 8,
      )
    ) {
      if (g.tickCount % 60 === 0)
        g.ui?.toast?.("Step outside the fissure so the shrine can rise.");
      return;
    }
    s.age++;
    if (s.age >= 40 && !s.opened) {
      for (let x = -2; x <= 2; x++)
        for (let z = -2; z <= 2; z++) {
          w.set(s.x + x, s.y - 4, s.z + z, B.basalt);
          for (let y = -3; y <= 0; y++) w.set(s.x + x, s.y + y, s.z + z, B.air);
        }
      s.opened = true;
      playWorldSound(g, "incursion", invasionState(g.world));
    }
    if (s.age < 180) return;
    for (const cell of invasionPlan(s)) w.set(...cell);
    s.phase = "battle";
    playWorldSound(g, "guardian-impact", s);
  }
  if (s.phase === "battle") {
    // Upgrade living legacy guards once, proportionally, without reviving deaths.
    const oldHP = [42, 36, 30, 42];
    for (const e of g.entities)
      if (
        e.encounter === INVASION &&
        !e.incursionBalance &&
        e.hp > 0 &&
        Number.isInteger(e.invasionIndex) &&
        e.invasionIndex >= 0 &&
        e.invasionIndex < 4
      ) {
        e.hp = Math.min(
          INVADERS[e.invasionIndex][3],
          (e.hp / oldHP[e.invasionIndex]) * INVADERS[e.invasionIndex][3],
        );
        e.incursionBalance = 2;
      }
    tickOrbGunfire(g, s);
    for (let i = 0; i < INVADERS.length; i++) {
      if (s.created.includes(i) || s.defeated.includes(i)) continue;
      const [type, dx, dz, hp] = INVADERS[i],
        e = createEntity(g, type, s.x + dx, s.z + dz, `${INVASION}:${i}`);
      Object.assign(e, {
        y: s.y,
        hp,
        incursionBalance: 2,
        persistent: true,
        encounter: INVASION,
        invasionIndex: i,
        home: { x: s.x + dx + 0.5, y: s.y, z: s.z + dz + 0.5 },
      });
      if (
        !collides(
          w,
          e,
          MOB_INFO[e.type]?.height || 2.1,
          MOB_INFO[e.type]?.width || 1,
        )
      ) {
        g.entities.push(e);
        s.created.push(i);
      }
    }
    if (s.defeated.length >= INVADERS.length) {
      s.phase = "ready";
      g.hostileProjectiles = (g.hostileProjectiles || []).filter(
        (q) => !q.orbBullet,
      );
      g.ui?.announce?.(
        "THE RIFT IS SILENT",
        "Matthew's Dual Wielded Pistols await. Right-click the altar to claim them.",
      );
      g.audio?.tone?.("rune");
    }
  }
}
export function claimPistols(g, t) {
  if (!t || t.id !== B.matthew_altar) return false;
  const s = invasionState(g.world),
    p = g.player;
  if (!s || t.x !== s.x || t.y !== s.y + 1 || t.z !== s.z) return true;
  if (g.multiplayer?.isGuest) {
    g.ui?.toast?.("The unique incursion reward is host-controlled.");
    return true;
  }
  if (
    Math.hypot(p.x - (s.x + 0.5), p.y + 1.5 - (s.y + 1.5), p.z - (s.z + 0.5)) >
    4.5
  )
    return true;
  if (s.phase !== "ready") {
    g.ui?.toast?.(
      s.phase === "claimed"
        ? "This altar has already been claimed."
        : `Defeat the Hellspawn · ${s.defeated.length} / ${INVADERS.length}`,
    );
    return true;
  }
  // Inventory.add is all-or-nothing for this nonstackable item. Never mark a
  // reward claimed until an actual slot receives it. No drops on a full bag.
  if (g.inventory.add(makeStack(MATTHEW))) {
    g.ui?.toast?.("Make one inventory slot free before claiming the pistols.");
    return true;
  }
  s.phase = "claimed";
  g.ui?.updateHotbar?.();
  g.ui?.toast?.(
    "Matthew's Dual Wielded Pistols · hold left click to fire · right-click Dash · R Air Trick",
    12000,
  );
  g.audio?.matthewClaim?.();
  g.save?.().catch?.(() =>
    g.ui?.toast?.("Save failed. Export a backup before closing."),
  );
  return true;
}

// Saved counters provide deterministic variation without resetting on reload.
export function tickOrbGunfire(g, s = invasionState(g.world)) {
  if (
    !s ||
    s.phase !== "battle" ||
    s.defeated.length >= INVADERS.length ||
    g.difficulty === "peaceful" ||
    g.multiplayer?.isGuest ||
    g.tickCount < (s.orbNextShot || 0)
  )
    return;
  const n = (s.orbShots = (s.orbShots || 0) + 1);
  s.orbNextShot =
    g.tickCount + 16 + Math.floor(hash(n, 18, 7, g.world.seedInt) * 20);
  const list = (g.hostileProjectiles ||= []);
  if (list.length >= 48) return;
  const a = hash(n, 71, 3, g.world.seedInt) * Math.PI * 2;
  const vy = -0.08 - hash(n, 9, 4, g.world.seedInt) * 0.14;
  list.push({
    id: `orb:${n}`,
    x: s.x + 0.5,
    y: s.y + 2.8,
    z: s.z + 0.5,
    vx: Math.cos(a) * 0.95,
    vy,
    vz: Math.sin(a) * 0.95,
    damage: 6,
    age: 0,
    arcane: false,
    orbBullet: true,
    source: "sealed-pistols",
    sourceType: "sealed_pistols",
  });
  s.orbLastShot = g.tickCount;
  playWorldSound(
    g,
    "pistol",
    { x: s.x + 0.5, y: s.y + 2.8, z: s.z + 0.5 },
    n % 2 ? "black" : "silver",
  );
}
