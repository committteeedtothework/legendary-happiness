import { bubbleColumn } from "./aquatic.js";
import { B } from "./data.js";
import { uniqueId } from "./compat.js";
import { isWater, isLava, fluidSurfaceHeight } from "./block-dynamics.js";
import { collides, moveBody } from "./physics.js";

// Public peer IDs may be replicated. Private reconnect tokens must never enter entities.
const owner = (g) => g.multiplayer?.peerForPlayer?.(g.player)?.id || "host";
const aim = (p) => ({
  x: -Math.sin(p.yaw) * Math.cos(p.pitch),
  y: Math.sin(p.pitch),
  z: -Math.cos(p.yaw) * Math.cos(p.pitch),
});
export function boatInReach(game) {
  const p = game.player,
    d = aim(p),
    eye = { x: p.x, y: p.y + 1.62, z: p.z };
  let result = null,
    best = 4.5;
  for (const b of game.entities || []) {
    if (b.type !== "boat" || b.hp <= 0) continue;
    const x = b.x - eye.x,
      y = b.y + 0.25 - eye.y,
      z = b.z - eye.z;
    const t = x * d.x + y * d.y + z * d.z;
    const off = Math.hypot(x - d.x * t, y - d.y * t, z - d.z * t);
    if (t < 0 || t > best || off > 0.85) continue;
    const wall = game.world.raycast(eye, d, t, true);
    if (wall && wall.distance < t - 0.8) continue;
    result = b;
    best = t;
  }
  return result;
}
export function leaveBoat(game) {
  const p = game.player,
    b = (game.entities || []).find(
      (e) => e.id === p.boatId && e.type === "boat",
    );
  if (!b) {
    delete p.boatId;
    return true;
  }
  for (const distance of [1.6, 2.2])
    for (const angle of [Math.PI / 2, -Math.PI / 2, Math.PI, 0]) {
      const x = b.x + Math.sin(b.yaw + angle) * distance,
        z = b.z + Math.cos(b.yaw + angle) * distance;
      const ground = game.world.skyHeight(x, z) + 1;
      const y = Math.max(b.y + 0.15, Math.min(ground, b.y + 1.2));
      if (collides(game.world, { x, y, z }, 1.8, 0.6)) continue;
      Object.assign(p, {
        x,
        y,
        z,
        vx: 0,
        vy: 0,
        vz: 0,
        fallStart: y,
        onGround: false,
      });
      delete p.boatId;
      delete b.rider;
      return true;
    }
  game.ui?.toast?.("No room to dismount here. Move into open water.");
  return false;
}
export function useBoat(game) {
  const p = game.player;
  if (p.health <= 0) return false;
  if (p.boatId) {
    leaveBoat(game);
    return true;
  }
  const b = boatInReach(game);
  if (b) {
    if (b.rider && b.rider !== owner(game)) {
      game.ui?.toast?.("This boat already has a rider.");
      return true;
    }
    if (collides(game.world, { x: b.x, y: b.y + 0.15, z: b.z }, 1.8, 0.6)) {
      game.ui?.toast?.("There is no room to board beneath that obstacle.");
      return true;
    }
    b.rider = owner(game);
    p.boatId = b.id;
    p.flying = false;
    p.vx = p.vy = p.vz = 0;
    Object.assign(p, { x: b.x, y: b.y + 0.15, z: b.z, fallStart: b.y });
    game.ui?.toast?.("W/S: paddle · A/D: steer · Shift: dismount");
    return true;
  }
  if (game.inventory.held?.id !== "oak_boat") return false;
  if (game.entities.filter((e) => e.type === "boat" && e.hp > 0).length >= 32) {
    game.ui?.toast?.(
      "Recover an existing boat before launching another (32 boat limit).",
    );
    return true;
  }
  const target = game.world.raycast(
    { x: p.x, y: p.y + 1.62, z: p.z },
    aim(p),
    5,
    false,
    true,
  );
  if (!target || !isWater(target.id)) {
    game.ui?.toast?.("Aim at open water to place your boat.");
    return true;
  }
  const x = target.x + 0.5,
    z = target.z + 0.5;
  const y =
    target.y + fluidSurfaceHeight(game.world, x, target.y, z, target.id) - 0.28;
  if (
    collides(game.world, { x, y, z }, 0.8, 1.3) ||
    game.entities.some(
      (e) =>
        e.type === "boat" && e.hp > 0 && Math.hypot(e.x - x, e.z - z) < 1.5,
    )
  ) {
    game.ui?.toast?.("The boat needs a clear patch of water.");
    return true;
  }
  game.entities.push({
    id: uniqueId(),
    type: "boat",
    x,
    y,
    z,
    yaw: p.yaw,
    vx: 0,
    vy: 0,
    vz: 0,
    hp: 8,
    age: 0,
    persistent: true,
    speed: 0,
  });
  if (game.mode !== "creative") game.inventory.consume();
  game.audio?.tone?.("swim");
  game.ui?.updateHotbar?.();
  return true;
}
export function stepBoat(game, b, keys, dt) {
  const w = game.world;
  let surface = null;
  for (let y = Math.floor(b.y) + 1; y >= Math.floor(b.y) - 1; y--) {
    const id = w.get(b.x, y, b.z);
    if (isWater(id)) {
      surface = y + fluidSurfaceHeight(w, b.x, y, b.z, id);
      break;
    }
  }
  b.yaw += ((keys.has("KeyA") ? 1 : 0) - (keys.has("KeyD") ? 1 : 0)) * 1.5 * dt;
  const thrust = (keys.has("KeyW") ? 8 : 0) - (keys.has("KeyS") ? 3 : 0);
  const ice = w.get(b.x, b.y - 0.1, b.z),
    onIce = [B.ice, B.packed_ice, B.blue_ice].includes(ice);
  const response =
    1 - Math.exp(-(onIce ? 0.8 : surface === null ? 9 : 2.4) * dt);
  const target = onIce
    ? thrust * (ice === B.blue_ice ? 5 : 3.5)
    : surface === null
      ? 0
      : thrust;
  b.vx += (-Math.sin(b.yaw) * target - b.vx) * response;
  b.vz += (-Math.cos(b.yaw) * target - b.vz) * response;
  b.vy =
    surface === null
      ? Math.max(-18, (b.vy || 0) - 20 * dt)
      : Math.max(-3, Math.min(3, (surface - 0.28 - b.y) * 9));
  const column = bubbleColumn(w, b.x, b.y, b.z);
  if (column) b.vy = column * 3;
  const steps = Math.max(
    1,
    Math.ceil(
      Math.max(Math.abs(b.vx * dt), Math.abs(b.vy * dt), Math.abs(b.vz * dt)) /
        0.3,
    ),
  );
  for (let i = 0; i < steps; i++)
    moveBody(
      w,
      b,
      (b.vx * dt) / steps,
      (b.vy * dt) / steps,
      (b.vz * dt) / steps,
      b.rider ? 2 : 0.5,
      1.3,
      0,
    );
  b.speed = Math.hypot(b.vx, b.vz);
}
export function updateRidingBoat(game, keys, dt) {
  const p = game.player;
  if (!p.boatId) return false;
  const guest = game.multiplayer?.isGuest;
  const b = game.entities.find(
    (e) => e.id === p.boatId && e.type === "boat" && e.hp > 0,
  );
  if (!b) {
    delete p.boatId;
    return false;
  }
  if (!guest && b.rider && b.rider !== owner(game)) {
    const root = game.multiplayer?.game || game;
    const people = [
      root.player,
      ...(root.multiplayer?.peers?.values?.() || []),
    ].map((p) => p.player || p);
    if (people.some((t) => t !== p && t.health > 0 && t.boatId === b.id)) {
      delete p.boatId;
      return false;
    }
  }
  if (!guest) b.rider = owner(game);
  if (guest) {
    stepBoat(game, b, keys, dt);
    Object.assign(p, {
      x: b.x,
      y: b.y + 0.15,
      z: b.z,
      inWater: false,
      inLava: false,
      underwater: false,
      vy: 0,
      fallStart: b.y,
    });
    return keys.has("KeyW") || keys.has("KeyS");
  }
  if ((keys.has("ShiftLeft") || keys.has("ShiftRight")) && leaveBoat(game))
    return false;
  if (!game.multiplayer?.isGuest) stepBoat(game, b, keys, dt);
  Object.assign(p, {
    x: b.x,
    y: b.y + 0.15,
    z: b.z,
    vx: b.vx,
    vy: 0,
    vz: b.vz,
    fallStart: b.y,
    onGround: false,
    inWater: false,
    inLava: false,
    underwater: false,
    flying: false,
    sprinting: false,
    crouching: false,
  });
  p.hurt = Math.max(0, (p.hurt || 0) - dt);
  return keys.has("KeyW") || keys.has("KeyS");
}
export function tickBoats(game) {
  const players = [
    game.player,
    ...(game.multiplayer?.peers?.values?.() || []),
  ].map((p) => p.player || p);
  for (const b of game.entities)
    if (b.type === "boat" && b.hp > 0) {
      if (
        Math.hypot(b.x - game.player.x, b.z - game.player.z) < 96 &&
        isLava(game.world.get(b.x, b.y, b.z))
      ) {
        b.hp = 0;
        delete b.rider;
        continue;
      }
      const rider = players.find((p) => p.health > 0 && p.boatId === b.id);
      if (!rider) {
        delete b.rider;
        if (Math.hypot(b.x - game.player.x, b.z - game.player.z) < 96)
          stepBoat(game, b, new Set(), 0.05);
      }
    }
}
