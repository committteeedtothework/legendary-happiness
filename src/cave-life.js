import { B, BLOCKS, MOB_INFO } from "./data.js";
import { hash } from "./random.js";
import { collides, moveBody } from "./physics.js";
import { combatClear } from "./defenders.js";
import { survivalPlayers } from "./coop-players.js";
const lightIds = new Set([
  B.torch,
  B.sea_lantern,
  B.sea_pickle_1,
  B.sea_pickle_2,
  B.sea_pickle_3,
  B.sea_pickle_4,
  B.glow_crystal,
  B.emberglass,
  B.fire,
  B.lava,
]);
export function underground(w, p) {
  return (
    w.dimension === "overworld" &&
    p.y <= w.terrain(p.x, p.z).h - 5 &&
    w.skyHeight(p.x, p.z) >= p.y + 2
  );
}
export function caveDarkness(w, p) {
  if (!underground(w, p)) return false;
  const x = Math.floor(p.x),
    y = Math.floor(p.y),
    z = Math.floor(p.z),
    key = `${x},${y},${z}:${w.tick >> 5}`;
  const cache = (w.caveLightCache ||= new Map());
  if (cache.has(key)) return cache.get(key);
  if (cache.size > 512) cache.clear();
  let lit = false;
  const check = (sx, sy, sz, id) =>
    lightIds.has(id) &&
    Math.hypot(x - sx, y - sy, z - sz) < (id === B.torch ? 9 : 7) &&
    w.get(sx, sy, sz) === id;
  for (
    let cz = Math.floor((z - 9) / 16);
    cz <= Math.floor((z + 9) / 16) && !lit;
    cz++
  )
    for (
      let cx = Math.floor((x - 9) / 16);
      cx <= Math.floor((x + 9) / 16) && !lit;
      cx++
    )
      for (const [sx, sy, sz, id] of w.editChunks.get(`${cx},${cz}`) || [])
        if (check(sx, sy, sz, id)) {
          lit = true;
          break;
        }
  if (!lit)
    for (const pos of w.generatedLights || []) {
      const a = pos.split(",").map(Number);
      if (check(...a, w.get(...a))) {
        lit = true;
        break;
      }
    }
  if (!lit)
    for (let dx = -6; dx <= 6 && !lit; dx += 2)
      for (let dz = -6; dz <= 6 && !lit; dz += 2) {
        if (
          !w.chunks.has(
            `${Math.floor((x + dx) / 16)},${Math.floor((z + dz) / 16)}`,
          )
        )
          continue;
        for (let dy = -4; dy <= 4; dy += 2)
          if (check(x + dx, y + dy, z + dz, w.get(x + dx, y + dy, z + dz))) {
            lit = true;
            break;
          }
      }
  cache.set(key, !lit);
  return !lit;
}
export function findCaveFloor(w, x, z, nearY, type = "zombie") {
  if (!w.chunks.has(`${Math.floor(x / 16)},${Math.floor(z / 16)}`)) return null;
  const m = MOB_INFO[type];
  for (let n = 0; n <= 20; n++) {
    const y = Math.floor(nearY) + (n % 2 ? Math.ceil(n / 2) : -n / 2),
      p = { x: Math.floor(x) + 0.5, y, z: Math.floor(z) + 0.5 };
    const feet = w.get(p.x, y, p.z);
    if (
      !w.solid(p.x, y - 1, p.z) ||
      BLOCKS[feet]?.fluid ||
      feet === B.fire ||
      collides(w, p, m.height, m.width)
    )
      continue;
    if (caveDarkness(w, p)) return p;
  }
  return null;
}
export function spawnCaveHostiles(g, createEntity) {
  if (
    g.multiplayer?.isGuest ||
    g.mode !== "survival" ||
    g.difficulty === "peaceful" ||
    g.tickCount % 100 ||
    !underground(g.world, g.player)
  )
    return;
  if (
    g.entities.filter(
      (e) =>
        e.hp > 0 &&
        ["zombie", "creeper", "spider", "skeleton"].includes(e.type),
    ).length >= 14
  )
    return;
  let spawned = 0;
  for (let a = 0; a < 12 && spawned < 2; a++) {
    const type = ["zombie", "creeper", "spider", "skeleton"][
      (Math.floor(g.tickCount / 100) + a) % 4
    ];
    const angle = hash(g.tickCount, a, 411, g.world.seedInt) * Math.PI * 2,
      r = 24 + hash(g.tickCount, a, 412, g.world.seedInt) * 12;
    const pos = findCaveFloor(
      g.world,
      g.player.x + Math.cos(angle) * r,
      g.player.z + Math.sin(angle) * r,
      g.player.y,
      type,
    );
    if (
      !pos ||
      survivalPlayers(g).some(
        (p) => Math.hypot(p.x - pos.x, p.y - pos.y, p.z - pos.z) < 24,
      ) ||
      g.entities.some(
        (e) =>
          e.hp > 0 && Math.hypot(e.x - pos.x, e.y - pos.y, e.z - pos.z) < 2,
      )
    )
      continue;
    const e = createEntity(g, type, pos.x - 0.5, pos.z - 0.5);
    Object.assign(e, pos, { caveSpawn: true });
    g.entities.push(e);
    spawned++;
  }
}
export function watcherSeen(p, e, cameraMode = 0, w) {
  const yaw = p.yaw + (cameraMode === 2 ? Math.PI : 0),
    pitch = p.pitch || 0,
    dx = e.x - p.x,
    dy = e.y + 2.4 - (p.y + 1.62),
    dz = e.z - p.z,
    d = Math.max(0.01, Math.hypot(dx, dy, dz));
  const dot =
    (-Math.sin(yaw) * Math.cos(pitch) * dx +
      Math.sin(pitch) * dy -
      Math.cos(yaw) * Math.cos(pitch) * dz) /
    d;
  return (
    dot > 0.965 &&
    combatClear(
      w,
      { x: p.x, y: p.y + 0.42, z: p.z },
      { x: e.x, y: e.y + 1.4, z: e.z },
    )
  );
}
export function tickWatcher(g, e) {
  e.age = (e.age || 0) + 1;
  e.hurt = 0;
  e.hp = 1000;
  e.attack = 0;
  e.speed = 0;
  const targets = [...new Set([g.player, ...survivalPlayers(g)])].filter(
    (p) => p.health > 0,
  );
  const target = targets.sort(
    (a, b) =>
      Math.hypot(a.x - e.x, a.z - e.z) - Math.hypot(b.x - e.x, b.z - e.z),
  )[0];
  if (
    !target ||
    g.world.dimension !== "overworld" ||
    Math.hypot(target.x - e.x, target.y - e.y, target.z - e.z) > 72 ||
    (!e.creativeSpawn &&
      (!caveDarkness(g.world, e) || g.difficulty === "peaceful"))
  ) {
    e.hp = 0;
    return;
  }
  const dx = target.x - e.x,
    dz = target.z - e.z,
    d = Math.max(0.01, Math.hypot(dx, dz));
  e.yaw = Math.atan2(-dx, -dz);
  const watched = targets.some((p) =>
    watcherSeen(p, e, p === g.player ? g.cameraMode || 0 : 0, g.world),
  );
  if (watched) {
    if (!e.spottedAt) {
      e.spottedAt = g.tickCount || 1;
      if (g.tickCount >= (e.nextLaughTick || 0)) {
        g.audio?.voice?.(g, e, "laugh");
        e.laughSerial = (e.laughSerial || 0) + 1;
        e.nextLaughTick = g.tickCount + 160;
      }
      e.laughed = true;
    }
    if (g.tickCount - e.spottedAt > 50 && !e.creativeSpawn) e.hp = 0;
  } else if (d > 18) {
    e.spottedAt = 0;
    const next = {
      x: e.x + (dx / d) * 0.065,
      y: e.y,
      z: e.z + (dz / d) * 0.065,
    };
    if (
      g.world.solid(next.x, next.y - 1, next.z) &&
      !collides(g.world, next, 3.6, 0.55) &&
      (e.creativeSpawn || caveDarkness(g.world, next))
    ) {
      moveBody(g.world, e, (dx / d) * 0.065, 0, (dz / d) * 0.065, 3.6, 0.55);
      e.speed = 1.3;
    }
  }
  if (!watched) e.spottedAt = 0;
  if (d < 7 && !e.creativeSpawn) e.hp = 0;
  if (e.age > 2400 && !e.creativeSpawn) e.hp = 0;
}
export function spawnWatcher(g, createEntity) {
  if (
    g.multiplayer?.isGuest ||
    g.mode !== "survival" ||
    g.difficulty === "peaceful" ||
    g.world.dimension !== "overworld" ||
    !caveDarkness(g.world, g.player)
  )
    return;
  const state = (g.world.settlements["cave-watcher"] ||= {
    nextCheck: g.tickCount + 600,
    checks: 0,
  });
  if (g.tickCount < state.nextCheck) return;
  state.nextCheck = g.tickCount + 200;
  state.checks++;
  if (
    g.entities.some((e) => e.type === "watcher" && e.hp > 0) ||
    hash(state.checks, 722, 1, g.world.seedInt) > 0.12
  )
    return;
  for (let a = 0; a < 10; a++) {
    const angle =
        g.player.yaw +
        (hash(state.checks, a, 730, g.world.seedInt) - 0.5) * 1.8,
      r = 18 + hash(a, state.checks, 731, g.world.seedInt) * 10;
    const pos = findCaveFloor(
      g.world,
      g.player.x + Math.sin(angle) * r,
      g.player.z + Math.cos(angle) * r,
      g.player.y,
      "watcher",
    );
    if (
      !pos ||
      !combatClear(g.world, pos, g.player) ||
      watcherSeen(g.player, pos, g.cameraMode || 0, g.world)
    )
      continue;
    const e = createEntity(g, "watcher", pos.x - 0.5, pos.z - 0.5);
    Object.assign(e, pos, { persistent: true, age: 0 });
    g.entities.push(e);
    state.nextCheck = g.tickCount + 1600;
    break;
  }
}
