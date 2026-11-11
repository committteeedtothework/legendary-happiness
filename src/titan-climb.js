import { sonicLength } from "./titan-metrics.js";
import {
  getTitanClimbSurface,
  nearestArmorPoint,
  armorSurfaceStep,
  raycastArmor,
  armorContactAt,
  updateTitanClimbSurface,
} from "./titan-climb-surface.js";
import {
  titanWorldPoint,
  titanLocalPoint,
  titanWorldVector,
} from "./titan-space.js";
const clamp = (x, a, b) => Math.max(a, Math.min(b, x)),
  length = (v) => Math.hypot(v.x, v.y, v.z),
  unit = (v) => {
    const l = length(v) || 1;
    return { x: v.x / l, y: v.y / l, z: v.z / l };
  };
export const armorMode = (s) => s.config.climbMode === "armor";
export const armorAttached = (s) =>
  armorMode(s) && s.stage === "traversal" && !!s.climb?.attached;
export const freshArmorState = () => ({
  attached: false,
  cooldown: 0,
  point: null,
  normal: null,
  checkpoint: null,
  mount: 1,
  travel: 0,
  step: 0,
  speed: 0,
});
export function armorUp(contact, guided = true) {
  const p = contact.point,
    n = contact.normal,
    guide = guided ? getTitanClimbSurface()?.guide : null,
    next = p.y > 40 ? guide?.find((q) => q.point.y > p.y + 2) : null,
    aim = next
      ? { x: next.point.x - p.x, y: next.point.y - p.y, z: next.point.z - p.z }
      : p.y > 40
        ? { x: -p.x, y: 95 - p.y, z: -p.z }
        : { x: 0, y: 1, z: 0 },
    d = aim.x * n.x + aim.y * n.y + aim.z * n.z;
  const v = { x: aim.x - d * n.x, y: aim.y - d * n.y, z: aim.z - d * n.z };
  if (length(v) > 0.001) return unit(v);
  const target = {
      x: p.y > 40 ? 0 : Math.sign(p.x || 1) * 4.8,
      y: p.y,
      z: p.y > 40 ? 0 : -6.02,
    },
    fallback = { x: target.x - p.x, y: 0, z: target.z - p.z };
  return length(fallback) > 0.001 ? unit(fallback) : { x: 0, y: 0, z: -1 };
}
export function makeArmorGuide(surface = getTitanClimbSurface()) {
  let c = nearestArmorPoint({ x: 4.8, y: 2, z: 1 }, 8, {}, surface);
  if (!c) throw Error("Armor surface has no foot contact");
  const guide = [c];
  for (let i = 0; i < 600 && guide.length < 13; i++) {
    const up = armorUp(c, false),
      next = armorSurfaceStep(
        c,
        { x: up.x * 0.25, y: up.y * 0.25, z: up.z * 0.25 },
        surface,
      );
    if (!next) break;
    c = next;
    if (c.point.y >= guide.length * 7.4) guide.push(c);
  }
  if (c.point.y < 85) throw Error("Armor ascent does not reach the crown");
  while (guide.length < 13) guide.push(c);
  return guide;
}
export function armorFocus(s) {
  if (armorAttached(s)) {
    const n = titanWorldVector(s, s.climb.normal);
    return {
      x: s.avatar.x + n.x * sonicLength(s, 1.8),
      y: s.avatar.y + n.y * sonicLength(s, 1.8),
      z: s.avatar.z + n.z * sonicLength(s, 1.8),
    };
  }
  return { x: s.avatar.x, y: s.avatar.y + sonicLength(s, 2.2), z: s.avatar.z };
}
export function attachArmor(s, forced = false) {
  if (
    !armorMode(s) ||
    s.stage !== "traversal" ||
    s.climb?.attached ||
    s.climb?.cooldown > 0
  )
    return false;
  updateTitanClimbSurface(s.time);
  const local = titanLocalPoint(s, {
      x: s.avatar.x,
      y: s.avatar.y + 1.15,
      z: s.avatar.z,
    }),
    q = nearestArmorPoint(local, 2.3);
  if (!q) return false;
  const c = (s.climb ||= freshArmorState());
  Object.assign(c, {
    ...q,
    attached: true,
    speed: 0,
    mount: 0,
    from: { x: s.avatar.x, y: s.avatar.y, z: s.avatar.z },
    step: Math.floor(c.travel / 4),
    highWater: q.point.y,
    stalled: 0,
    escape: null,
  });
  s.avatar.onGround = false;
  s.avatar.vx = s.avatar.vy = s.avatar.vz = 0;
  return true;
}
export function releaseArmor(s, jump = false) {
  if (!armorAttached(s)) return false;
  const n = titanWorldVector(s, s.climb.normal);
  s.climb.attached = false;
  s.climb.cooldown = 0.45;
  Object.assign(s.avatar, {
    vx: n.x * (jump ? 9 : 5),
    vy: jump ? 17 : 3,
    vz: n.z * (jump ? 9 : 5),
    onGround: false,
  });
  s.action = "jump";
  s.actionTime = 0.4;
  return true;
}
const copyAnchor = (q) => ({
  point: { ...q.point },
  normal: { ...q.normal },
  ...(Number.isInteger(q.triangle) && q.barycentric
    ? { triangle: q.triangle, barycentric: { ...q.barycentric } }
    : {}),
});
export function restoreArmorState(s, raw) {
  const c = freshArmorState();
  if (!raw) return c;
  c.cooldown = clamp(Number(raw.cooldown) || 0, 0, 0.6);
  c.travel = clamp(Number(raw.travel) || 0, 0, 10000);
  c.step = Math.floor(c.travel / 4);
  const validNormal = (n) => n && length(n) > 0.5 && length(n) < 1.5;
  const point = (p) =>
    p &&
    ["x", "y", "z"].every((k) => Number.isFinite(p[k]) && Math.abs(p[k]) < 120);
  if (
    point(raw.checkpoint?.point) &&
    point(raw.checkpoint?.normal) &&
    validNormal(raw.checkpoint.normal)
  )
    c.checkpoint = {
      point: { ...raw.checkpoint.point },
      normal: unit(raw.checkpoint.normal),
      triangle: raw.checkpoint.triangle,
      barycentric: raw.checkpoint.barycentric
        ? { ...raw.checkpoint.barycentric }
        : null,
    };
  if (
    raw.attached &&
    point(raw.point) &&
    point(raw.normal) &&
    validNormal(raw.normal)
  ) {
    Object.assign(c, {
      point: { ...raw.point },
      normal: unit(raw.normal),
      triangle: raw.triangle,
      barycentric: raw.barycentric ? { ...raw.barycentric } : null,
      attached: true,
      mount: 1,
      needsValidation: true,
    });
  }
  return c;
}
export function advanceArmor(s, input, dt, emit) {
  const p = s.avatar,
    c = (s.climb ||= freshArmorState());
  c.cooldown = Math.max(0, c.cooldown - dt);
  if (c.attached || nearArmor(s)) updateTitanClimbSurface(s.time);
  if (c.attached) {
    const moved = armorContactAt(c);
    if (moved) Object.assign(c, moved, { needsValidation: false });
  }
  if (c.checkpoint) {
    const moved = armorContactAt(c.checkpoint);
    if (moved) c.checkpoint = copyAnchor(moved);
  }
  if (c.attached && c.needsValidation) {
    const q = nearestArmorPoint(c.point, 1);
    if (q) Object.assign(c, q, { needsValidation: false });
    else {
      c.attached = false;
      c.checkpoint = null;
    }
  }
  // Independently animated joints deform the triangle surface above; both rigs
  // additionally share this deterministic moving root.
  s.boss.x = Math.sin(s.time * 0.1) * 1.5;
  s.boss.z = Math.sin(s.time * 0.08) * 0.8;
  s.boss.yaw = Math.sin(s.time * 0.14) * 0.09;
  if (!c.attached) {
    if (input.forward && nearArmor(s) && attachArmor(s)) emit("armor-grip");
    if (!c.attached) return false;
  }
  if (
    c.mount >= 1 &&
    c.point.z < -12 &&
    c.point.y > 30 &&
    c.point.y < 75 &&
    s.time % 6 > 4 &&
    s.time % 6 < 4.5 &&
    s.pulseCooldown <= 0
  ) {
    s.pulseCooldown = 2;
    emit("pulse");
    if (!input.boost) {
      releaseArmor(s);
      const n = titanWorldVector(s, c.normal);
      p.vx = n.x * 14;
      p.vz = n.z * 14;
      p.vy = 6;
      return false;
    }
  }
  const before = { x: p.x, y: p.y, z: p.z },
    previousTravel = c.travel;
  if (c.mount < 1) {
    c.mount = Math.min(1, c.mount + dt / 0.14);
    const t = c.mount * c.mount * (3 - 2 * c.mount),
      w = titanWorldPoint(s, c.point),
      n = titanWorldVector(s, c.normal);
    for (const k of ["x", "y", "z"])
      p[k] = c.from[k] + (w[k] + n[k] * 0.14 - c.from[k]) * t;
  } else {
    let forward = +!!input.forward - +!!input.back,
      side = +!!input.right - +!!input.left,
      l = Math.hypot(forward, side);
    if (l) {
      forward /= l;
      side /= l;
    }
    const up = armorUp(c),
      right = unit({
        x: c.normal.y * up.z - c.normal.z * up.y,
        y: c.normal.z * up.x - c.normal.x * up.z,
        z: c.normal.x * up.y - c.normal.y * up.x,
      }),
      speed = input.boost ? 25 : 15;
    if (l) {
      let next = armorSurfaceStep(c, {
        x: (up.x * forward + right.x * side) * speed * dt,
        y: (up.y * forward + right.y * side) * speed * dt,
        z: (up.z * forward + right.z * side) * speed * dt,
      });
      // Traverse a sharp lip sideways briefly if pure uphill movement has
      // stopped gaining height. Every step still contacts an actual triangle;
      // manual lateral input immediately takes priority over this assistance.
      if (forward > 0 && !side && c.stalled > 0.65) {
        if (!c.escape || c.escape.age > 0.65) {
          const inward = right.x * -c.point.x + right.z * -c.point.z;
          c.escape = {
            side: c.escape ? -c.escape.side : Math.sign(inward) || 1,
            age: 0,
          };
        }
        c.escape.age += dt;
        const escape = armorSurfaceStep(
          c,
          {
            x: right.x * c.escape.side * speed * dt,
            y: right.y * c.escape.side * speed * dt,
            z: right.z * c.escape.side * speed * dt,
          },
          undefined,
          true,
        );
        if (escape) next = escape;
      }
      if (next) {
        c.travel += Math.hypot(
          next.point.x - c.point.x,
          next.point.y - c.point.y,
          next.point.z - c.point.z,
        );
        Object.assign(c, next);
      }
    }
    const w = titanWorldPoint(s, c.point),
      n = titanWorldVector(s, c.normal);
    for (const k of ["x", "y", "z"]) p[k] = w[k] + n[k] * 0.14;
    s.boosting = !!(l && input.boost);
    if (c.highWater == null || c.point.y > c.highWater + 0.04) {
      c.highWater = c.point.y;
      c.stalled = 0;
      c.escape = null;
    } else if (forward > 0 && !side) c.stalled = (c.stalled || 0) + dt;
    else {
      c.highWater = c.point.y;
      c.stalled = 0;
      c.escape = null;
    }
    const height = clamp(Math.floor(c.point.y / 7.4), 0, 12);
    while (s.route < height) {
      s.route++;
      if (!s.collected.includes(s.route)) {
        s.collected.push(s.route);
        s.rings = Math.min(s.config.rings, s.rings + 5);
        emit("ring", { count: 5 });
      }
      c.checkpoint = copyAnchor(c);
      emit("checkpoint");
    }
    if (Math.floor(c.travel / 4) > c.step) {
      c.step = Math.floor(c.travel / 4);
      emit("armor-step");
    }
  }
  p.vx = (p.x - before.x) / dt;
  p.vy = (p.y - before.y) / dt;
  p.vz = (p.z - before.z) / dt;
  p.onGround = false;
  c.speed = Math.max(0, c.travel - previousTravel) / dt;
  s.action = c.speed > 0.2 ? "wall_run" : "wall_idle";
  return true;
}
export function recoverArmor(s, emit) {
  const c = (s.climb ||= freshArmorState());
  if (!c.checkpoint) return false;
  updateTitanClimbSurface(s.time);
  const safe =
    armorContactAt(c.checkpoint) || nearestArmorPoint(c.checkpoint.point, 1);
  if (!safe) {
    c.checkpoint = null;
    return false;
  }
  Object.assign(c, copyAnchor(safe));
  c.attached = true;
  c.mount = 1;
  c.cooldown = 0;
  c.highWater = c.point.y;
  c.stalled = 0;
  c.escape = null;
  const w = titanWorldPoint(s, c.point),
    n = titanWorldVector(s, c.normal);
  for (const k of ["x", "y", "z"]) s.avatar[k] = w[k] + n[k] * 0.14;
  s.avatar.vx = s.avatar.vy = s.avatar.vz = 0;
  s.iframes = 1;
  emit("return-pad");
  return true;
}

function nearArmor(s) {
  return (
    Math.hypot(s.avatar.x - (s.boss?.x || 0), s.avatar.z - (s.boss?.z || 0)) <
    (s.avatar.y < 3 ? 20 : 65)
  );
}
export function collideArmor(s) {
  // A voluntary wall jump must clear the surface before capsule projection can
  // act again; otherwise the nearest overhang snaps it back into adhesion.
  if (s.climb?.cooldown > 0 || !nearArmor(s)) return;
  const p = s.avatar,
    center = titanLocalPoint(s, {
      x: p.x,
      y: p.y + sonicLength(s, 1.3),
      z: p.z,
    }),
    q = nearestArmorPoint(center, 1.6);
  if (!q) return;
  const signed =
    (center.x - q.point.x) * q.normal.x +
    (center.y - q.point.y) * q.normal.y +
    (center.z - q.point.z) * q.normal.z;
  if (signed >= 0.65) return;
  const w = titanWorldPoint(s, {
    x: q.point.x + q.normal.x * 0.65,
    y: q.point.y + q.normal.y * 0.65,
    z: q.point.z + q.normal.z * 0.65,
  });
  p.x = w.x;
  p.y = Math.max(0.05, w.y - sonicLength(s, 1.3));
  p.z = w.z;
}

export function clearArmorCamera(s, focus, desired) {
  const localFocus = titanLocalPoint(s, focus),
    test = (p) => raycastArmor(localFocus, titanLocalPoint(s, p));
  if (!test(desired)) return desired;
  const dx = desired.x - focus.x,
    dz = desired.z - focus.z;
  for (const angle of [0.6, -0.6, 1.1, -1.1, 1.5, -1.5]) {
    const c = Math.cos(angle),
      n = Math.sin(angle),
      candidate = {
        x: focus.x + dx * c + dz * n,
        y: Math.max(2.5, desired.y),
        z: focus.z + dz * c - dx * n,
      };
    if (!test(candidate)) return candidate;
  }
  const hit = test(desired),
    t = Math.max(
      0.02,
      (hit.distance - 0.6) /
        Math.hypot(
          desired.x - focus.x,
          desired.y - focus.y,
          desired.z - focus.z,
        ),
    );
  return {
    x: focus.x + (desired.x - focus.x) * t,
    y: Math.max(2.5, focus.y + (desired.y - focus.y) * t),
    z: focus.z + (desired.z - focus.z) * t,
  };
}
