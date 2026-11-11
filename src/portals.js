import { B } from "./data.js";
import { coordKey } from "./world.js";
export const frameKey = (p) => coordKey(p.x, p.y, p.z) + ":" + p.axis;
export function frameCell(frame, u, v) {
  return {
    x: frame.x + (frame.axis === "x" ? u : 0),
    y: frame.y + v,
    z: frame.z + (frame.axis === "z" ? u : 0),
  };
}
export function validFrame(world, f) {
  for (let u = 0; u < 4; u++)
    for (let v = 0; v < 5; v++) {
      const edge = u === 0 || u === 3 || v === 0 || v === 4,
        corner = (u === 0 || u === 3) && (v === 0 || v === 4);
      if (corner) continue;
      const p = frameCell(f, u, v),
        id = world.get(p.x, p.y, p.z);
      if (edge ? id !== B.obsidian : id !== B.air && id !== B.portal)
        return false;
    }
  return true;
}
export function ignitePortal(world, target) {
  for (const axis of ["x", "z"])
    for (let u = 0; u < 4; u++)
      for (let v = 0; v < 5; v++) {
        const f = {
          x: target.x - (axis === "x" ? u : 0),
          y: target.y - v,
          z: target.z - (axis === "z" ? u : 0),
          axis,
        };
        if (!validFrame(world, f)) continue;
        for (let i = 1; i <= 2; i++)
          for (let j = 1; j <= 3; j++) {
            const p = frameCell(f, i, j);
            world.set(p.x, p.y, p.z, B.portal);
          }
        world.portals[frameKey(f)] = f;
        return f;
      }
  return null;
}
export function buildPortal(world, f) {
  for (let u = 0; u < 4; u++)
    for (let v = 0; v < 5; v++) {
      const p = frameCell(f, u, v);
      world.set(
        p.x,
        p.y,
        p.z,
        u === 0 || u === 3 || v === 0 || v === 4 ? B.obsidian : B.air,
      );
    }
  return ignitePortal(world, frameCell(f, 0, 1));
}
export function portalContains(f, p) {
  const u = f.axis === "x" ? p.x - f.x : p.z - f.z,
    depth = f.axis === "x" ? p.z - f.z : p.x - f.x;
  return (
    u > 0.7 &&
    u < 3.3 &&
    depth > -0.25 &&
    depth < 1.25 &&
    p.y + 1.5 > f.y + 1 &&
    p.y < f.y + 4
  );
}
export function tickPortals(game) {
  if (!game.world.portals || !game.travelDimension) return;
  game.portalCooldown = Math.max(0, (game.portalCooldown || 0) - 1);
  let inside = null;
  for (const [key, f] of Object.entries(game.world.portals)) {
    if (Math.hypot(game.player.x - f.x, game.player.z - f.z) > 12) continue;
    if (!validFrame(game.world, f)) {
      for (let u = 1; u <= 2; u++)
        for (let v = 1; v <= 3; v++) {
          const p = frameCell(f, u, v);
          if (game.world.get(p.x, p.y, p.z) === B.portal)
            game.world.set(p.x, p.y, p.z, B.air);
        }
      delete game.world.portals[key];
      continue;
    }
    if (portalContains(f, game.player)) inside = f;
  }
  if (!inside || game.portalCooldown || game.player.health <= 0) {
    game.portalCharge = 0;
    return;
  }
  game.portalCharge = (game.portalCharge || 0) + 1;
  if (game.portalCharge >= (game.mode === "creative" ? 1 : 80)) {
    game.portalCharge = 0;
    game.travelDimension(inside);
  }
}
