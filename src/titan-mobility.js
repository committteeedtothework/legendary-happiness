import { titanWorldPoint, titanTurn } from "./titan-space.js";
const clamp = (x) => Math.max(0, Math.min(1, x)),
  ease = (x) => {
    x = clamp(x);
    return x * x * (3 - 2 * x);
  };
export const TITAN_ANKLE = Object.freeze({ x: 4.84, y: 1.48, z: -6.02 });
export function freshTitanBody() {
  return { x: 0, z: 0, yaw: 0, steps: 0, walk: null };
}
export function titanStepProgress(s) {
  return s.boss?.walk ? clamp((s.boss.walk.elapsed - 0.45) / 2.4) : 0;
}
export function titanWalkingFoot(s, side, pose = s.boss) {
  const w = pose?.walk;
  if (!w) return null;
  const t = clamp((w.elapsed - 0.45) / 2.4),
    u = clamp((t - (side === "L" ? 0.04 : 0.5)) / 0.44),
    a = ease(u),
    local = {
      x: TITAN_ANKLE.x * (side === "L" ? 1 : -1),
      y: TITAN_ANKLE.y,
      z: TITAN_ANKLE.z,
    },
    from = titanWorldPoint(s, local, w.from),
    to = titanWorldPoint(s, local, w.to);
  return {
    x: from.x + (to.x - from.x) * a,
    y: local.y + Math.sin(u * Math.PI) * 6,
    z: from.z + (to.z - from.z) * a,
  };
}
export function titanFootYaw(s, side) {
  const b = s.boss,
    w = b?.walk;
  if (!w) return b?.yaw || 0;
  const t = clamp((w.elapsed - 0.45) / 2.4),
    a = ease((t - (side === "L" ? 0.04 : 0.5)) / 0.44);
  return w.from.yaw + titanTurn(w.from.yaw, w.to.yaw) * a;
}
export function titanWalkingKnee(s, side, pose = s.boss) {
  const foot = titanWalkingFoot(s, side, pose);
  if (!foot) return null;
  const sign = side === "L" ? 1 : -1,
    a = titanWorldPoint(
      s,
      { x: sign * 4.76197, y: 53.57016, z: -6.02013 },
      pose,
    ),
    pole = titanWorldPoint(s, { x: sign * 16, y: 20, z: 28 }, pose),
    l1 = 27.04838,
    l2 = 25.04548,
    vx = foot.x - a.x,
    vy = foot.y - a.y,
    vz = foot.z - a.z,
    length = Math.hypot(vx, vy, vz) || 1,
    d = Math.max(Math.abs(l1 - l2) + 0.001, Math.min(l1 + l2 - 0.001, length)),
    u = { x: vx / length, y: vy / length, z: vz / length },
    px = pole.x - a.x,
    py = pole.y - a.y,
    pz = pole.z - a.z,
    dot = px * u.x + py * u.y + pz * u.z,
    sideV = { x: px - dot * u.x, y: py - dot * u.y, z: pz - dot * u.z },
    sl = Math.hypot(sideV.x, sideV.y, sideV.z) || 1,
    along = (l1 * l1 - l2 * l2 + d * d) / (2 * d),
    height = Math.sqrt(Math.max(0, l1 * l1 - along * along));
  return {
    hip: a,
    knee: {
      x: a.x + u.x * along + (sideV.x / sl) * height,
      y: a.y + u.y * along + (sideV.y / sl) * height,
      z: a.z + u.z * along + (sideV.z / sl) * height,
    },
    foot,
  };
}
export function beginTitanStep(s) {
  const b = (s.boss ||= freshTitanBody());
  if (
    s.config.bossMobility === false ||
    b.walk ||
    s.strike?.move === "loop" ||
    s.stagger > 0 ||
    s.qte ||
    s.counterScene ||
    s.stage !== "combat"
  )
    return false;
  const dx = s.avatar.x - b.x,
    dz = s.avatar.z - b.z,
    r = Math.hypot(dx, dz) || 1;
  let x = dx / r,
    z = dz / r;
  if (r < 40) {
    x = -x;
    z = -z;
  } else if (r < 75) {
    const sign = b.steps % 2 ? 1 : -1;
    [x, z] = [z * sign, -x * sign];
  }
  const to = {
    x: b.x + x * 8,
    z: b.z + z * 8,
    yaw:
      b.yaw +
      Math.max(-0.45, Math.min(0.45, titanTurn(b.yaw, Math.atan2(dx, dz)))),
  };
  const edge = Math.hypot(to.x, to.z);
  if (edge > 32) {
    to.x *= 32 / edge;
    to.z *= 32 / edge;
  }
  b.walk = { from: { x: b.x, z: b.z, yaw: b.yaw }, to, elapsed: 0, planted: 0 };
  b.steps++;
  return true;
}
export function tickTitanBody(s, dt) {
  const b = (s.boss ||= freshTitanBody());
  b.previous = {
    x: b.x,
    z: b.z,
    yaw: b.yaw,
    walk: b.walk ? { ...b.walk } : null,
  };
  const w = b.walk,
    events = [];
  if (
    !w ||
    s.stage !== "combat" ||
    s.qte ||
    s.counterScene ||
    s.stagger > 0 ||
    s.strike?.move === "loop"
  )
    return events;
  w.elapsed = Math.min(2.85, w.elapsed + dt);
  const u = ease((w.elapsed - 0.45) / 2.4);
  b.x = w.from.x + (w.to.x - w.from.x) * u;
  b.z = w.from.z + (w.to.z - w.from.z) * u;
  b.yaw = w.from.yaw + titanTurn(w.from.yaw, w.to.yaw) * u;
  for (const [i, at, side] of [
    [1, 0.48, "L"],
    [2, 0.94, "R"],
  ])
    if (titanStepProgress(s) >= at && w.planted < i) {
      w.planted = i;
      events.push({
        side,
        point: { ...titanWalkingFoot(s, side), y: 0.18 },
        normal: { x: 0, y: 1, z: 0 },
      });
    }
  if (w.elapsed >= 2.85) {
    b.walk = null;
    s.idle = Math.max(s.idle, 1.4);
  }
  return events;
}
