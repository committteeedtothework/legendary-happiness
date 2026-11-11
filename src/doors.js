import { B, BLOCKS, MIN_Y, MAX_Y, MOB_INFO } from "./data.js";
export const DOOR_THICKNESS = 3 / 16;
export function doorId(
  facing = 0,
  open = false,
  upper = false,
  base = B.oak_door,
) {
  return base + (((facing % 4) + 4) % 4) * 4 + Number(open) * 2 + Number(upper);
}
export function blockBounds(id) {
  if (BLOCKS[id]?.bounds) return BLOCKS[id].bounds;
  if (id === B.chest) return [1 / 16, 0, 1 / 16, 15 / 16, 14 / 16, 15 / 16];
  if (id === B.cactus) return [1 / 16, 0, 1 / 16, 15 / 16, 1, 15 / 16];
  if (BLOCKS[id]?.relic === "base") return [0.1, 0, 0.1, 0.9, 0.65, 0.9];
  if (BLOCKS[id]?.relic === "blade") return [0.2, 0, 0.38, 0.8, 1, 0.62];
  const d = BLOCKS[id]?.door;
  if (!d) return [0, 0, 0, 1, 1, 1];
  const facing = (d.facing + (d.open ? 3 : 0)) % 4,
    t = DOOR_THICKNESS;
  return [
    [0, 0, 0, 1, 1, t],
    [1 - t, 0, 0, 1, 1, 1],
    [0, 0, 1 - t, 1, 1, 1],
    [0, 0, 0, t, 1, 1],
  ][facing];
}
export function overlapsPanel(
  body,
  x,
  y,
  z,
  bounds,
  height = body.crouching ? 1.5 : 1.8,
  width = 0.6,
) {
  return (
    body.x + width / 2 > x + bounds[0] &&
    body.x - width / 2 < x + bounds[3] &&
    body.y + height > y + bounds[1] &&
    body.y < y + bounds[4] &&
    body.z + width / 2 > z + bounds[2] &&
    body.z - width / 2 < z + bounds[5]
  );
}
export function doorAt(world, x, y, z) {
  x = Math.floor(x);
  y = Math.floor(y);
  z = Math.floor(z);
  const state = BLOCKS[world.get(x, y, z)]?.door;
  if (!state) return null;
  y -= Number(state.upper);
  if (
    world.get(x, y, z) !==
      doorId(state.facing, state.open, false, state.base) ||
    world.get(x, y + 1, z) !==
      doorId(state.facing, state.open, true, state.base)
  )
    return null;
  return {
    x,
    y,
    z,
    facing: state.facing,
    open: state.open,
    ...(state.base === undefined ? {} : { base: state.base, item: state.item }),
  };
}
function blocked(occupants, x, y, z, id) {
  return occupants.some(
    (p) =>
      (p.hp === undefined || p.hp > 0) &&
      overlapsPanel(
        p,
        x,
        y,
        z,
        blockBounds(id),
        p.height ||
          MOB_INFO[p.type]?.height ||
          (p.standData?.transformed
            ? 1.25
            : p.crouching
              ? 1.5
              : p.type
                ? 1.95
                : 1.8),
        p.width ||
          MOB_INFO[p.type]?.width ||
          (p.standData?.transformed ? 0.9 : 0.6),
      ),
  );
}
export function placeDoor(
  world,
  x,
  y,
  z,
  yaw,
  occupants = [],
  base = B.oak_door,
) {
  if (
    y <= MIN_Y ||
    y + 1 > MAX_Y ||
    world.get(x, y, z) !== B.air ||
    world.get(x, y + 1, z) !== B.air ||
    !world.solid(x, y - 1, z) ||
    BLOCKS[world.get(x, y - 1, z)].door
  )
    return false;
  const facing = ((Math.round(-yaw / (Math.PI / 2)) % 4) + 4) % 4;
  const lower = doorId(facing, false, false, base),
    upper = doorId(facing, false, true, base);
  if (
    blocked(occupants, x, y, z, lower) ||
    blocked(occupants, x, y + 1, z, upper)
  )
    return false;
  world.set(x, y, z, lower);
  world.set(x, y + 1, z, upper);
  return true;
}
export function setDoorOpen(world, x, y, z, open, occupants = []) {
  const d = doorAt(world, x, y, z);
  if (!d || d.open === open) return false;
  const lower = doorId(d.facing, open, false, d.base),
    upper = doorId(d.facing, open, true, d.base);
  if (
    blocked(occupants, d.x, d.y, d.z, lower) ||
    blocked(occupants, d.x, d.y + 1, d.z, upper)
  )
    return false;
  world.set(d.x, d.y, d.z, lower);
  world.set(d.x, d.y + 1, d.z, upper);
  return true;
}
export function removeDoor(world, x, y, z) {
  const d = doorAt(world, x, y, z);
  if (!d) return null;
  world.set(d.x, d.y, d.z, B.air);
  world.set(d.x, d.y + 1, d.z, B.air);
  return d;
}
// Slab intersection is shared by targeting; holes around an open door stay usable.
export function rayBounds(origin, direction, x, y, z, bounds, reach) {
  let near = -Infinity,
    far = Infinity,
    normal = { x: 0, y: 0, z: 0 };
  for (let i = 0; i < 3; i++) {
    const axis = ["x", "y", "z"][i],
      base = [x, y, z][i],
      lo = base + bounds[i],
      hi = base + bounds[i + 3],
      v = direction[axis],
      o = origin[axis];
    if (Math.abs(v) < 1e-12) {
      if (o < lo || o > hi) return null;
      continue;
    }
    let a = (lo - o) / v,
      b = (hi - o) / v;
    if (a > b) [a, b] = [b, a];
    if (a > near) {
      near = a;
      normal = { x: 0, y: 0, z: 0 };
      normal[axis] = v > 0 ? -1 : 1;
    }
    far = Math.min(far, b);
    if (near > far) return null;
  }
  return far >= 0 && near <= reach
    ? { distance: Math.max(0, near), normal }
    : null;
}
