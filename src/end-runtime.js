import { B, BLOCKS, MIN_Y, makeStack } from "./data.js";
import { hash } from "./random.js";
import {
  nearestStronghold,
  strongholds,
  portalFrames,
  END_PILLARS,
} from "./end-terrain.js";
import { selectRealm } from "./realms.js";
import { moveBody } from "./physics.js";
import { playWorldSound } from "./spatial-audio.js";
import { recordAchievement } from "./achievements.js";
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export function endState(world) {
  if (
    !world.endgame ||
    typeof world.endgame !== "object" ||
    Array.isArray(world.endgame)
  )
    world.endgame = {};
  const s = world.endgame;
  s.version = 1;
  s.defeated = !!s.defeated;
  s.kills = Math.max(0, Math.min(10000, Math.floor(s.kills || 0)));
  for (const key of ["orbs", "clouds"]) if (!Array.isArray(s[key])) s[key] = [];
  if (!Array.isArray(s.broken)) s.broken = [];
  s.broken = [
    ...new Set(s.broken.filter((n) => Number.isInteger(n) && n >= 0 && n < 10)),
  ];
  s.orbs = s.orbs.slice(-32);
  s.clouds = s.clouds
    .filter(
      (c) =>
        c &&
        Number.isFinite(c.x + c.y + c.z) &&
        Number.isFinite(c.radius) &&
        c.radius > 0 &&
        c.radius <= 12,
    )
    .slice(-16);
  for (const c of s.clouds)
    c.age = Number.isFinite(c.age) ? Math.max(0, c.age) : 0;
  return s;
}
function cue(g, type, p) {
  playWorldSound(g, type, p);
}
function consume(g) {
  if (g.mode !== "creative") {
    const held = g.inventory.held;
    if (!held) return false;
    if (--held.count <= 0) g.inventory.slots[g.inventory.selected] = null;
  }
  g.ui?.updateHotbar?.();
  return true;
}
function particles(g, p) {
  g.renderer?.guardianWave?.(p, 0.7);
  cue(g, "portal", p);
}
export function safeEndTeleport(w, x, y, z, height = 1.8) {
  x = Math.floor(x);
  z = Math.floor(z);
  if (!w.chunks.has(`${Math.floor(x / 16)},${Math.floor(z / 16)}`)) return null;
  for (
    let fy = Math.min(318, Math.floor(y) + 5);
    fy >= Math.max(MIN_Y + 1, Math.floor(y) - 20);
    fy--
  ) {
    if (!w.solid(x, fy - 1, z) || BLOCKS[w.get(x, fy - 1, z)]?.fluid) continue;
    let clear = true;
    for (let h = 0; h < Math.ceil(height); h++)
      if (w.solid(x, fy + h, z) || BLOCKS[w.get(x, fy + h, z)]?.fluid)
        clear = false;
    if (clear) return { x: x + 0.5, y: fy + 0.02, z: z + 0.5 };
  }
  return null;
}
function placePlayer(g, q) {
  Object.assign(g.player, q, {
    vx: 0,
    vy: 0,
    vz: 0,
    fallStart: q.y,
    onGround: false,
    flying: false,
  });
  g.renderer?.loadAround?.(q.x, q.z, 2, 5);
}
export function enterEnd(g) {
  if (g.multiplayer?.connected || g.multiplayer?.isGuest) {
    g.ui?.toast?.("Leave multiplayer to enter The End.");
    return false;
  }
  if (g.dimension !== "overworld") return false;
  const p = g.player;
  p.endReturn = { x: p.x, y: p.y, z: p.z, yaw: p.yaw, dimension: "overworld" };
  selectRealm(g, "end");
  for (let x = 94; x <= 98; x++)
    for (let z = -2; z <= 2; z++) {
      g.world.set(x, 50, z, B.obsidian);
      for (let y = 51; y <= 54; y++) g.world.set(x, y, z, B.air);
    }
  placePlayer(g, { x: 96.5, y: 51.02, z: 0.5, yaw: Math.PI / 2, pitch: 0 });
  g.endTravelCooldown = 60;
  recordAchievement(g, "dimension", { key: "end" });
  g.ui?.announce?.("THE END", "");
  g.audio?.tone?.("portal");
  g.save?.()?.catch?.(() => {});
  return true;
}
export function leaveEnd(g) {
  if (g.dimension !== "end" || !endState(g.world).defeated) return false;
  const back = g.spawn || g.player.endReturn;
  selectRealm(g, "overworld");
  const x = back.x,
    z = back.z,
    y = back.y;
  g.world.ensure(Math.floor(x / 16), Math.floor(z / 16));
  const q = safeEndTeleport(g.world, x, y, z) || {
    x: g.spawn.x,
    y: g.spawn.y,
    z: g.spawn.z,
  };
  placePlayer(g, { ...q, yaw: back.yaw || 0, pitch: 0 });
  g.endTravelCooldown = 60;
  g.ui?.announce?.("OVERWORLD", "");
  g.audio?.tone?.("portal");
  g.save?.()?.catch?.(() => {});
  return true;
}
export function useEndItem(g) {
  const held = g.inventory.held,
    t = g.target,
    p = g.player,
    w = g.world;
  if (
    held?.id === "eye_of_ender" &&
    t &&
    [B.end_portal_frame, B.end_portal_frame_filled].includes(t.id)
  ) {
    if (t.id === B.end_portal_frame_filled) return true;
    let site = strongholds(w).find((s) =>
      portalFrames(s).some((q) => q.x === t.x && q.y === t.y && q.z === t.z),
    );
    if (!site)
      for (let dx = -2; dx <= 2; dx++)
        for (let dz = -2; dz <= 2; dz++) {
          const q = { x: t.x + dx, y: t.y - 1, z: t.z + dz };
          if (
            portalFrames(q).every((p) =>
              [B.end_portal_frame, B.end_portal_frame_filled].includes(
                w.get(p.x, p.y, p.z),
              ),
            )
          )
            site = q;
        }
    if (!site) {
      g.ui?.toast?.("Place the Eye in a stronghold portal frame.");
      return true;
    }
    consume(g);
    w.set(t.x, t.y, t.z, B.end_portal_frame_filled);
    cue(g, "equip", t);
    g.renderer?.action?.("use");
    if (
      portalFrames(site).every(
        (q) => w.get(q.x, q.y, q.z) === B.end_portal_frame_filled,
      )
    ) {
      for (let x = -1; x <= 1; x++)
        for (let z = -1; z <= 1; z++)
          w.set(site.x + x, site.y + 1, site.z + z, B.end_portal);
      cue(g, "portal", site);
      recordAchievement(g, "end-event", { key: "portal" });
      g.ui?.announce?.("PORTAL OPEN", "");
    }
    return true;
  }
  if (held?.id === "end_crystal") {
    if (
      !t ||
      ![B.obsidian, B.bedrock].includes(t.id) ||
      w.solid(t.x, t.y + 1, t.z) ||
      w.solid(t.x, t.y + 2, t.z)
    )
      return true;
    if (
      g.entities.some(
        (e) =>
          e.hp > 0 &&
          e.type === "end_crystal" &&
          Math.hypot(e.x - t.x - 0.5, e.y - t.y - 1, e.z - t.z - 0.5) < 1.5,
      )
    )
      return true;
    consume(g);
    g.entities.push({
      id: `placed-crystal:${g.tickCount}:${g.entities.length}`,
      type: "end_crystal",
      x: t.x + 0.5,
      y: t.y + 1,
      z: t.z + 0.5,
      hp: 1,
      yaw: 0,
      age: 0,
      persistent: true,
      placed: true,
    });
    cue(g, "equip", t);
    return true;
  }
  if (!["eye_of_ender", "ender_pearl", "chorus_fruit"].includes(held?.id))
    return false;
  if (g.multiplayer?.isGuest) {
    g.ui?.toast?.("This item is host-controlled.");
    return true;
  }
  if ((p.enderCooldown || 0) > g.tickCount) return true;
  if (held.id === "chorus_fruit") {
    for (let i = 0; i < 16; i++) {
      const q = safeEndTeleport(
        w,
        p.x + (hash(g.tickCount, i, 1, w.seedInt) - 0.5) * 16,
        p.y,
        p.z + (hash(g.tickCount, i, 2, w.seedInt) - 0.5) * 16,
      );
      if (q) {
        consume(g);
        particles(g, p);
        placePlayer(g, q);
        p.food = Math.min(20, p.food + 4);
        p.enderCooldown = g.tickCount + 20;
        g.renderer?.action?.("eat");
        return true;
      }
    }
    return true;
  }
  const kind = held.id === "eye_of_ender" ? "eye" : "pearl";
  if (kind === "eye" && g.dimension !== "overworld") {
    g.ui?.toast?.("Eyes of Ender guide you in the Overworld.");
    return true;
  }
  const s = endState(w),
    from = { x: p.x, y: p.y + 1.55, z: p.z },
    dir = g.direction?.() || {
      x: -Math.sin(p.yaw) * Math.cos(p.pitch),
      y: Math.sin(p.pitch),
      z: -Math.cos(p.yaw) * Math.cos(p.pitch),
    };
  const orb = {
    id: `${kind}:${g.tickCount}`,
    kind,
    ...from,
    from: { ...from },
    age: 0,
  };
  if (kind === "eye") {
    const site = nearestStronghold(w, p),
      dx = site.x - p.x,
      dz = site.z - p.z,
      n = Math.max(0.001, Math.hypot(dx, dz));
    orb.to = {
      x: n < 16 ? site.x : p.x + (dx / n) * 12,
      y: n < 16 ? site.y + 2 : p.y + 8,
      z: n < 16 ? site.z : p.z + (dz / n) * 12,
    };
    s.lastStronghold = site;
    recordAchievement(g, "end-event", { key: "eye" });
  } else {
    Object.assign(orb, {
      vx: dir.x * 1.5,
      vy: dir.y * 1.5 + 0.1,
      vz: dir.z * 1.5,
    });
    recordAchievement(g, "end-event", { key: "pearl" });
  }
  consume(g);
  p.enderCooldown = g.tickCount + (kind === "pearl" ? 20 : 8);
  s.orbs.push(orb);
  g.renderer?.action?.("use");
  cue(g, "throw", p);
  return true;
}
function tickOrbs(g, api, s) {
  const w = g.world,
    p = g.player,
    keep = [];
  for (const o of s.orbs) {
    if (
      !o ||
      !Number.isFinite(o.x + o.y + o.z) ||
      !["eye", "pearl", "breath"].includes(o.kind)
    )
      continue;
    o.age = (o.age || 0) + 1;
    if (o.kind === "eye") {
      if (!o.from || !o.to) continue;
      const u = Math.min(1, o.age / 45),
        ease = u * u * (3 - 2 * u);
      for (const key of ["x", "y", "z"])
        o[key] = o.from[key] + (o.to[key] - o.from[key]) * ease;
      if (o.age >= 65) {
        if (
          hash(Math.floor(o.x), g.tickCount, Math.floor(o.z), w.seedInt) >= 0.2
        )
          api.dropItem(g, makeStack("eye_of_ender"), o.x, o.y, o.z, 10);
        else particles(g, o);
        continue;
      }
    } else {
      const old = { x: o.x, y: o.y, z: o.z };
      if (o.kind === "pearl") o.vy -= 0.03;
      const n = Math.max(1, Math.ceil(Math.hypot(o.vx, o.vy, o.vz) / 0.2));
      let hit = null;
      for (let i = 0; i < n; i++) {
        o.x += o.vx / n;
        o.y += o.vy / n;
        o.z += o.vz / n;
        if (w.solid(o.x, o.y, o.z)) {
          hit = { ...old };
          break;
        }
      }
      if (hit) {
        if (o.kind === "pearl") {
          // Try the incoming side first; never move the player through a wall.
          const q =
            safeEndTeleport(w, hit.x, hit.y, hit.z) ||
            safeEndTeleport(w, o.x - o.vx, o.y - o.vy, o.z - o.vz);
          if (q) {
            particles(g, p);
            placePlayer(g, q);
            g.damage?.(5, "an ender pearl");
            particles(g, q);
          }
        } else
          s.clouds.push({ x: o.x, y: o.y + 0.3, z: o.z, age: 0, radius: 4 });
        continue;
      }
      if (
        o.kind === "breath" &&
        distance(o, { x: p.x, y: p.y + 1, z: p.z }) < 2
      ) {
        s.clouds.push({ x: o.x, y: p.y + 0.05, z: o.z, age: 0, radius: 4 });
        continue;
      }
      if (o.age > 160 || o.y < MIN_Y - 15) continue;
    }
    keep.push(o);
  }
  s.orbs = keep.slice(-32);
}
function crystalEntity(p) {
  return {
    id: `end-crystal:${p.id}`,
    type: "end_crystal",
    x: p.x + 0.5,
    y: p.top + 2,
    z: p.z + 0.5,
    hp: 1,
    age: 0,
    yaw: 0,
    persistent: true,
    pillar: p.id,
  };
}
function seedDragon(g, respawn = false) {
  const s = endState(g.world);
  if (s.defeated && !respawn) return;
  for (const p of END_PILLARS)
    if (
      !s.broken.includes(p.id) &&
      !g.entities.some((e) => e.hp > 0 && e.id === `end-crystal:${p.id}`)
    )
      g.entities.push(crystalEntity(p));
  if (!g.entities.some((e) => e.type === "dragoon" && e.hp > 0))
    g.entities.push({
      id: "dragoon",
      type: "dragoon",
      x: 45,
      y: 90,
      z: 0,
      hp: Math.min(200, s.hp || 200),
      yaw: 0,
      age: 0,
      mode: "orbit",
      modeAge: 0,
      cycles: 0,
      persistent: true,
    });
}
export function startDragonDeath(g, e) {
  if (e.dying) return;
  e.dying = 1;
  e.mode = "dying";
  e.modeAge = 0;
  e.hp = 1;
  endState(g.world).hp = 0;
  g.ui?.announce?.("DRAGOON", "");
  cue(g, "explosion", e);
}
function completeDragon(g, e, api) {
  const s = endState(g.world);
  if (s.defeated) {
    e.hp = 0;
    return;
  }
  s.defeated = true;
  s.hp = 0;
  s.kills++;
  s.clouds = [];
  s.orbs = s.orbs.filter((o) => o.kind === "eye");
  e.hp = 0;
  for (let x = -2; x <= 2; x++)
    for (let z = -2; z <= 2; z++)
      if ((x || z) && Math.hypot(x, z) < 3) g.world.set(x, 61, z, B.end_exit);
  if (s.kills === 1) g.world.set(0, 65, 0, B.dragon_egg);
  g.world.set(75, 65, 0, B.end_gateway);
  g.world.set(75, 64, 0, B.bedrock);
  api.dropItem(g, makeStack("dragoon_trophy"), 0, 66, 0, 20);
  g.player.xp += s.kills === 1 ? 12000 : 500;
  recordAchievement(g, "end-event", { key: "victory" });
  g.ui?.announce?.("DRAGOON DEFEATED", "");
  g.save?.()?.catch?.(() => {});
}
function tickDragon(g, e, api, s) {
  const p = g.player;
  e.age = (e.age || 0) + 1;
  e.modeAge = (e.modeAge || 0) + 1;
  e.hurt = Math.max(0, (e.hurt || 0) - 0.05);
  if (e.dying) {
    e.y += 0.08;
    e.yaw += 0.035;
    if (e.modeAge % 10 === 0)
      g.renderer?.explosionEffect?.({
        x: e.x + (hash(e.age, 2, 0) * 2 - 1) * 7,
        y: e.y + 2,
        z: e.z + (hash(e.age, 3, 0) * 2 - 1) * 7,
      });
    if (e.modeAge >= 100) completeDragon(g, e, api);
    return;
  }
  s.hp = e.hp;
  s.phase = e.hp <= 100 ? 2 : 1;
  const crystals = g.entities.filter(
      (c) => c.type === "end_crystal" && c.hp > 0 && !c.placed,
    ),
    near = crystals.sort((a, b) => distance(a, e) - distance(b, e))[0];
  s.healing = near && distance(near, e) < 35 ? near.id : null;
  if (s.healing && e.age % 10 === 0) e.hp = Math.min(200, e.hp + 1);
  const turn = (mode) => {
    e.mode = mode;
    e.modeAge = 0;
  };
  if (!e.mode) e.mode = "orbit";
  if (e.mode === "orbit") {
    const a = e.age * (s.phase === 2 ? 0.017 : 0.012),
      target = {
        x: Math.cos(a) * 59,
        y: 88 + Math.sin(a * 1.4) * 10,
        z: Math.sin(a) * 59,
      };
    for (const k of ["x", "y", "z"]) e[k] += (target[k] - e[k]) * 0.08;
    e.yaw = Math.atan2(-Math.cos(a), Math.sin(a));
    if (e.age % (s.phase === 2 ? 36 : 60) === 0) {
      const dx = p.x - e.x,
        dy = p.y + 1 - e.y,
        dz = p.z - e.z,
        n = Math.hypot(dx, dy, dz) || 1;
      s.orbs.push({
        id: `breath:${e.age}`,
        kind: "breath",
        x: e.x,
        y: e.y + 2,
        z: e.z,
        age: 0,
        vx: (dx / n) * 0.9,
        vy: (dy / n) * 0.9,
        vz: (dz / n) * 0.9,
      });
      cue(g, "guardian-cast", e);
    }
    if (e.modeAge > 200) {
      e.cycles = (e.cycles || 0) + 1;
      if (e.cycles % 2) {
        e.charge = { x: p.x, y: p.y + 2, z: p.z };
        turn("charge");
      } else turn("approach");
    }
  } else if (e.mode === "charge") {
    if (e.modeAge <= 25) {
      e.y += 0.12;
    } else {
      const q = e.charge || p,
        dx = q.x - e.x,
        dy = q.y - e.y,
        dz = q.z - e.z,
        n = Math.max(1, Math.hypot(dx, dy, dz));
      e.x += (dx / n) * 1.5;
      e.y += (dy / n) * 1.5;
      e.z += (dz / n) * 1.5;
      e.yaw = Math.atan2(-dx, -dz);
      if (n < 6 || e.modeAge > 100) turn("orbit");
    }
  } else if (e.mode === "approach") {
    e.x += (0 - e.x) * 0.045;
    e.z += (0 - e.z) * 0.045;
    e.y += (61.5 - e.y) * 0.045;
    e.yaw +=
      Math.atan2(Math.sin(Math.PI - e.yaw), Math.cos(Math.PI - e.yaw)) * 0.05;
    if (e.modeAge >= 80) turn("perch");
  } else if (e.mode === "perch") {
    e.x *= 0.8;
    e.z *= 0.8;
    e.y += (61.5 - e.y) * 0.2;
    if (e.modeAge === 40) {
      s.clouds.push({
        x: 0,
        y: g.world.terrain(0, 10).h + 1.05,
        z: 10,
        age: 0,
        radius: 5,
      });
      cue(g, "fire", e);
    }
    if (e.modeAge > 140) turn("orbit");
  }
  e.speed = e.mode === "charge" ? 7 : 3;
  if (
    g.mode !== "creative" &&
    distance({ x: e.x, y: e.y + 2, z: e.z }, p) < 9 &&
    e.age % 20 === 0
  ) {
    g.damage?.(g.difficulty === "hard" ? 12 : 8, "DRAGOON");
    const d = Math.max(1, Math.hypot(p.x - e.x, p.z - e.z));
    p.vx += ((p.x - e.x) / d) * 12;
    p.vz += ((p.z - e.z) / d) * 12;
    p.vy = Math.max(p.vy, 7);
  }
}
export function tickEndWorld(g, api) {
  const s = endState(g.world),
    p = g.player;
  tickOrbs(g, api, s);
  g.endTravelCooldown = Math.max(0, (g.endTravelCooldown || 0) - 1);
  const contact = g.world.get(p.x, p.y + 0.1, p.z);
  if (contact !== B.end_gateway) g.endGatewayLatched = false;
  if (!g.endTravelCooldown) {
    const id = contact;
    if (id === B.end_portal && enterEnd(g)) return true;
    if (id === B.end_exit && leaveEnd(g)) return true;
    if (
      id === B.end_gateway &&
      !g.endGatewayLatched &&
      g.dimension === "end" &&
      s.defeated
    ) {
      const outer = Math.hypot(p.x, p.z) > 700,
        to = outer ? { x: 75.5, y: 65, z: 0.5 } : { x: 900.5, y: 75, z: 0.5 };
      g.world.ensure(Math.floor(to.x / 16), Math.floor(to.z / 16));
      const floor = g.world.terrain(to.x, to.z);
      if (floor.void) {
        for (let x = 898; x <= 902; x++)
          for (let z = -2; z <= 2; z++) g.world.set(x, 64, z, B.end_stone);
        to.y = 65;
      } else to.y = floor.h + 1.05;
      placePlayer(g, to);
      if (!outer) {
        s.outerGateY = Math.floor(to.y);
        g.world.set(900, Math.floor(to.y), 0, B.end_gateway);
        g.world.set(900, Math.floor(to.y) - 1, 0, B.bedrock);
        recordAchievement(g, "end-event", { key: "outer" });
      }
      g.endGatewayLatched = true;
      g.endTravelCooldown = 60;
    }
  }
  if (g.dimension === "end") {
    g.world.weather.kind = "clear";
    g.world.weather.intensity = 0;
    for (const e of g.entities)
      if (e.type === "end_crystal" && e.hp > 0) e.age = (e.age || 0) + 1;
    seedDragon(g);
    for (const e of g.entities)
      if (e.hp > 0 && e.type === "dragoon") tickDragon(g, e, api, s);
    for (const cloud of s.clouds) {
      cloud.age++;
      if (
        g.mode !== "creative" &&
        cloud.age % 10 === 0 &&
        Math.hypot(p.x - cloud.x, p.z - cloud.z) < cloud.radius &&
        Math.abs(p.y - cloud.y) < 3
      )
        g.damage?.(3, "dragon breath");
    }
    s.clouds = s.clouds.filter((c) => c.age < 180);
    if (s.defeated && g.tickCount % 20 === 0) {
      const crystals = g.entities.filter(
          (e) => e.type === "end_crystal" && e.placed && e.hp > 0,
        ),
        ritual = [
          [3, 0],
          [-3, 0],
          [0, 3],
          [0, -3],
        ].map(([x, z]) =>
          crystals.find(
            (c) =>
              Math.hypot(c.x - x - 0.5, c.z - z - 0.5) < 1.1 &&
              Math.abs(c.y - 61) < 2,
          ),
        );
      if (ritual.every(Boolean)) {
        for (const e of ritual) e.hp = 0;
        s.defeated = false;
        s.broken = [];
        s.hp = 200;
        for (let x = -2; x <= 2; x++)
          for (let z = -2; z <= 2; z++)
            if (g.world.get(x, 61, z) === B.end_exit)
              g.world.set(x, 61, z, B.air);
        seedDragon(g, true);
        cue(g, "portal", p);
        g.ui?.announce?.("DRAGOON", "");
      }
    }
  }
  spawnEndermen(g, api.createEntity);
  return false;
}
export function spawnEndermen(g, create) {
  const end = g.dimension === "end",
    night =
      g.dimension === "overworld" &&
      g.time % 24000 >= 13000 &&
      g.time % 24000 < 23000;
  if (
    (!end && !night) ||
    g.difficulty === "peaceful" ||
    g.tickCount % (end ? 80 : 400) ||
    g.entities.filter((e) => e.hp > 0 && e.type === "enderman").length >=
      (end ? 12 : 3)
  )
    return;
  for (let i = 0; i < 6; i++) {
    const a = hash(g.tickCount, i, 1, g.world.seedInt) * 6.28,
      r = 24 + hash(g.tickCount, i, 2, g.world.seedInt) * 22,
      x = g.player.x + Math.sin(a) * r,
      z = g.player.z + Math.cos(a) * r;
    if (!g.world.chunks.has(`${Math.floor(x / 16)},${Math.floor(z / 16)}`))
      continue;
    const t = g.world.terrain(x, z);
    if (t.void) continue;
    const q = safeEndTeleport(g.world, x, t.h + 1, z, 2.9);
    if (!q) continue;
    const e = create(g, "enderman", Math.floor(q.x), Math.floor(q.z));
    Object.assign(e, q);
    g.entities.push(e);
    break;
  }
}
export function teleportEnderman(g, e, away = false) {
  const p = g.player;
  for (let i = 0; i < 16; i++) {
    const a = hash(e.age || 0, i, 3, g.world.seedInt) * 6.28,
      r = away
        ? 12 + hash(i, e.age, 4, g.world.seedInt) * 12
        : 4 + hash(i, e.age, 5, g.world.seedInt) * 10,
      center = away ? e : p;
    const q = safeEndTeleport(
      g.world,
      center.x + Math.sin(a) * r,
      center.y,
      center.z + Math.cos(a) * r,
      2.9,
    );
    if (q) {
      particles(g, e);
      Object.assign(e, q, { vx: 0, vy: 0, vz: 0 });
      e.teleported = g.tickCount;
      return true;
    }
  }
  return false;
}
export function tickEnderman(g, e, api) {
  e.age = (e.age || 0) + 1;
  e.hurt = Math.max(0, (e.hurt || 0) - 0.05);
  e.attack = Math.max(0, (e.attack || 0) - 0.05);
  const p = g.player,
    w = g.world,
    dx = p.x - e.x,
    dz = p.z - e.z,
    d = Math.hypot(dx, dz),
    dy = e.y + 2.65 - (p.y + 1.62),
    len = Math.hypot(dx, dy, dz) || 1;
  if (g.difficulty === "peaceful") {
    e.angry = 0;
    return;
  }
  const wet =
    BLOCKS[w.get(e.x, e.y, e.z)]?.fluid?.type === "water" ||
    (w.dimension === "overworld" &&
      w.weather?.kind !== "clear" &&
      w.weather?.intensity > 0.3 &&
      w.skyHeight(e.x, e.z) < e.y);
  if (wet) {
    if (e.age % 20 === 0)
      api.damageEntity(g, e, 1, { kind: "water", reward: false, knockback: 0 });
    teleportEnderman(g, e, true);
  }
  const vx = -Math.sin(p.yaw) * Math.cos(p.pitch),
    vy = Math.sin(p.pitch),
    vz = -Math.cos(p.yaw) * Math.cos(p.pitch),
    dot = (-dx * vx + dy * vy - dz * vz) / len;
  if (g.mode !== "creative" && d < 48 && dot > 0.985) {
    const hit = w.raycast(
      { x: p.x, y: p.y + 1.62, z: p.z },
      { x: -dx / len, y: dy / len, z: -dz / len },
      len,
    );
    if (!hit || hit.distance >= len - 0.6) e.stared = (e.stared || 0) + 1;
  } else e.stared = Math.max(0, (e.stared || 0) - 2);
  if (e.stared >= 16 && !e.angry) {
    e.angry = 600;
    cue(g, "guardian-cast", e);
  }
  if (e.angry > 0 && g.mode !== "creative") {
    e.angry--;
    e.yaw = Math.atan2(-dx, -dz);
    e.speed = d > 2 ? 4.7 : 0;
    moveBody(
      w,
      e,
      ((dx / Math.max(0.1, d)) * e.speed) / 20,
      0,
      ((dz / Math.max(0.1, d)) * e.speed) / 20,
      2.9,
      0.6,
    );
    if (d > 15 && e.age % 35 === 0) teleportEnderman(g, e);
    if (d < 2.4 && Math.abs(p.y - e.y) < 2 && !e.attack) {
      g.damage?.(
        g.difficulty === "easy" ? 4 : g.difficulty === "hard" ? 10 : 7,
        "an Enderman",
      );
      e.attack = 1;
    }
  } else {
    e.speed = 0.6;
    e.yaw = e.dir || 0;
    if (e.age % 80 === 0) e.dir = hash(e.age, 1, 3, w.seedInt) * 6.28;
    moveBody(
      w,
      e,
      -Math.sin(e.yaw) * 0.03,
      0,
      -Math.cos(e.yaw) * 0.03,
      2.9,
      0.6,
    );
  }
  e.vy = (e.vy || 0) - 0.04;
  moveBody(w, e, 0, e.vy, 0, 2.9, 0.6);
  if (e.onGround) e.vy = 0;
  if (e.y < MIN_Y - 10) e.hp = 0;
}
// Null delegates to the standard damage path; a number means fully handled.
export function endEntityDamage(g, e, damage, options, api) {
  if (e.type === "enderman") {
    e.angry = 600;
    if (["arrow", "bullet", "projectile", "trident"].includes(options.kind)) {
      teleportEnderman(g, e, true);
      return 0;
    }
    return null;
  }
  if (e.type === "dragoon") {
    if (e.dying) return 0;
    if (e.mode === "perch" && ["arrow", "bullet"].includes(options.kind))
      return 0;
    if (e.hp - damage <= 0) {
      const dealt = e.hp;
      startDragonDeath(g, e);
      return dealt;
    }
    return null;
  }
  if (e.type === "end_crystal") {
    if (e.hp <= 0) return 0;
    e.hp = 0;
    const s = endState(g.world);
    if (Number.isInteger(e.pillar) && !s.broken.includes(e.pillar))
      s.broken.push(e.pillar);
    recordAchievement(g, "end-crystal", { key: String(e.pillar ?? e.id) });
    g.renderer?.explosionEffect?.(e);
    cue(g, "explosion", e);
    for (const other of g.entities)
      if (
        other !== e &&
        other.hp > 0 &&
        other.type !== "end_crystal" &&
        distance(other, e) < 12
      )
        api.damageEntity(
          g,
          other,
          other.type === "dragoon" ? 10 : Math.max(1, 12 - distance(other, e)),
          { source: e, kind: "explosion", reward: false, knockback: 0 },
        );
    if (g.mode !== "creative" && distance(g.player, e) < 8)
      g.damage?.(
        Math.ceil((1 - distance(g.player, e) / 8) * 14),
        "an end crystal",
      );
    return 1;
  }
  return null;
}
export function endEntityLoot(g, e, drop) {
  if (
    e.type === "enderman" &&
    hash(Math.floor(e.x), e.age || 0, Math.floor(e.z), g.world.seedInt) > 0.5
  )
    drop(
      g,
      makeStack("ender_pearl", 1 + (e.looting || 0)),
      e.x,
      e.y + 0.5,
      e.z,
    );
}
