import { MOB_INFO } from "./data.js";
import { moveBody, collides } from "./physics.js";
import { isWater } from "./block-dynamics.js";
export function useSkeletonHorse(g, e) {
  if (e?.type !== "skeleton_horse") return false;
  if (g.player.horseId === e.id) return true;
  if (
    e.rider &&
    e.rider !== (g.multiplayer?.peerForPlayer?.(g.player)?.id || "host")
  )
    return true;
  e.rider = g.multiplayer?.peerForPlayer?.(g.player)?.id || "host";
  e.persistent = true;
  g.player.horseId = e.id;
  return true;
}
export function updateRidingHorse(g, keys, dt) {
  const p = g.player,
    e = g.entities.find((e) => e.id === p.horseId && e.hp > 0);
  if (!e) {
    delete p.horseId;
    return false;
  }
  if (keys.has("ShiftLeft") || keys.has("ShiftRight")) {
    for (const angle of [Math.PI / 2, -Math.PI / 2, Math.PI, 0]) {
      const x = e.x + Math.sin(e.yaw + angle) * 1.8,
        z = e.z + Math.cos(e.yaw + angle) * 1.8;
      if (!collides(g.world, { x, y: e.y, z }, 1.8, 0.6)) {
        Object.assign(p, { x, y: e.y, z, vx: 0, vz: 0, vy: 0 });
        delete p.horseId;
        delete e.rider;
        return false;
      }
    }
  }
  const f = Number(keys.has("KeyW")) - Number(keys.has("KeyS")),
    s = Number(keys.has("KeyD")) - Number(keys.has("KeyA")),
    d = Math.max(1, Math.hypot(f, s));
  e.yaw = p.yaw;
  e.vx = ((-Math.sin(p.yaw) * f + Math.cos(p.yaw) * s) / d) * 4.2;
  e.vz = ((-Math.cos(p.yaw) * f - Math.sin(p.yaw) * s) / d) * 4.2;
  e.vy = Math.max(-20, (e.vy || 0) - 32 * dt);
  if (keys.has("Space") && e.onGround) e.vy = 8;
  moveBody(
    g.world,
    e,
    e.vx * dt,
    e.vy * dt,
    e.vz * dt,
    MOB_INFO.skeleton_horse.height,
    1.2,
    1,
  );
  Object.assign(p, {
    x: e.x,
    y: e.y + 1.15,
    z: e.z,
    vx: e.vx,
    vz: e.vz,
    vy: 0,
    fallStart: e.y,
    inWater: isWater(g.world.get(e.x, e.y + 1, e.z)),
    underwater: isWater(g.world.get(e.x, e.y + 2.77, e.z)),
    swimming: false,
    crouching: false,
  });
  return !!(f || s);
}
