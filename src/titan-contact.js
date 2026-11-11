import { wyvernRegions } from "./wyvern-space.js";
import { titanPiercePosition } from "./titan-finale.js";
import { sonicLength } from "./titan-metrics.js";
import { TITAN_SWEEP, titanSweepHand } from "./titan-sweep.js";
import {
  titanWorldPoint,
  titanLocalPoint,
  titanWorldVector,
  titanPose,
  titanTurn,
} from "./titan-space.js";
import { titanWalkingFoot, titanWalkingKnee } from "./titan-mobility.js";
// Shared analytic rig/contact geometry, in arena metres. Rendering and the
// fixed-step simulation use the same arm paths; no renderer state drives hits.
const mix = (a, b, t) => a + (b - a) * t;
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const point = (x, y, z) => ({ x, y, z });
export const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export function closestSegment(p, a, b) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    dz = b.z - a.z;
  const t = clamp(
    ((p.x - a.x) * dx + (p.y - a.y) * dy + (p.z - a.z) * dz) /
      (dx * dx + dy * dy + dz * dz || 1),
  );
  return point(a.x + dx * t, a.y + dy * t, a.z + dz * t);
}
export function titanAttackSide(s) {
  return ["swat", "uppercut"].includes(s.attack)
    ? s.swatSide || "L"
    : s.attack === "swing"
      ? "L"
      : "R";
}
function localArmPose(s, side, clock = s.attackTime) {
  const sign = side === "L" ? 1 : -1,
    neutral = point(sign * 18, 25, -10.5);
  if (s.stage === "combat" && s.attack === "spin") {
    const tell =
        2.1 * ({ easy: 1.25, normal: 1, hard: 0.85 }[s.config.difficulty] || 1),
      u = clamp(clock / tell),
      w = u * u * (3 - 2 * u);
    return point(
      mix(neutral.x, sign * 56, w),
      mix(neutral.y, Math.max(30, Math.min(80, s.attackAim?.y || 62)), w),
      mix(neutral.z, -8, w),
    );
  }
  if (
    s.stage === "combat" &&
    s.attack === "uppercut" &&
    side === titanAttackSide(s)
  ) {
    const tell =
        1.8 * ({ easy: 1.25, normal: 1, hard: 0.85 }[s.config.difficulty] || 1),
      u = clamp((clock - tell) / 1.05),
      aim = s.attackAim || point(0, 60, 30),
      w = clamp(clock / tell);
    return point(
      mix(neutral.x, sign * 28, w) - sign * 24 * Math.sin(u * Math.PI),
      mix(neutral.y, 30, w) + 65 * u,
      mix(neutral.z, 25, w) + 15 * Math.sin(u * Math.PI),
    );
  }
  if (s.stage === "combat" && s.tactics?.guard > 0) {
    const t =
        clamp((1.25 - s.tactics.guard) / 0.25) * clamp(s.tactics.guard / 0.22),
      w = t * t * (3 - 2 * t);
    return point(
      mix(neutral.x, sign * 9, w),
      mix(neutral.y, 76, w),
      mix(neutral.z, 12, w),
    );
  }
  if (s.stage === "combat" && s.attack === "pulse") {
    const tell =
      1.55 * ({ easy: 1.25, normal: 1, hard: 0.85 }[s.config.difficulty] || 1);
    const t = clamp(clock / tell),
      u = clamp((clock - tell) / 0.5);
    return point(sign * (18 + 18 * t), 25 + 50 * t - 8 * u, -10.5 + 26 * t);
  }
  if (
    !["swing", "slap", "crunch", "swat", "sweep"].includes(s.attack) ||
    s.stage !== "combat"
  )
    return neutral;
  const tell =
    { swing: 1.5, slap: 1.2, crunch: 1.75, swat: 1.25, sweep: 1.7 }[s.attack] *
    { easy: 1.25, normal: 1, hard: 0.85 }[s.config.difficulty];
  if (s.attack === "crunch") {
    const target =
        s.qte?.kind === "crunch" ? s.avatar : s.attackAim || point(0, 57, 30),
      t = clamp(clock / tell),
      e = t * t * (3 - 2 * t);
    return point(
      mix(neutral.x, target.x + sign * (s.qte?.kind === "crunch" ? 6 : 3), e),
      mix(neutral.y, target.y + 2, e),
      mix(neutral.z, target.z, e),
    );
  }
  if (s.attack === "sweep") {
    const raised = point(sign * 44, 68, 10),
      u = titanSweepHand(s, side, clock).progress;
    if (clock < tell) {
      const e = clamp(clock / tell);
      return point(
        mix(neutral.x, raised.x, e),
        mix(neutral.y, raised.y, e),
        mix(neutral.z, raised.z, e),
      );
    }
    const e = u * u * (3 - 2 * u);
    return point(
      sign * (44 - 70 * e),
      68 - 14 * Math.sin(u * Math.PI),
      10 + 25 * Math.sin(u * Math.PI),
    );
  }
  if (side !== titanAttackSide(s)) return neutral;
  if (s.attack === "swat") {
    const aim = s.attackAim || point(0, 57, 5),
      contact = point(aim.x, aim.y + sonicLength(s, 1.8), aim.z),
      raised = point(
        sign * 36,
        Math.max(35, Math.min(96, contact.y + 14)),
        contact.z - 6,
      );
    const u = clamp((clock - tell) / 0.55),
      end = point(contact.x - sign * 24, contact.y + 6, contact.z + 17);
    const a = clock < tell ? neutral : u < 0.5 ? raised : contact,
      b = clock < tell ? raised : u < 0.5 ? contact : end;
    const t =
        clock < tell ? clamp(clock / tell) : u < 0.5 ? u * 2 : (u - 0.5) * 2,
      e = t * t * (3 - 2 * t);
    return point(mix(a.x, b.x, e), mix(a.y, b.y, e), mix(a.z, b.z, e));
  }
  const strike = s.attack === "swing" ? 0.65 : 0.55;
  const raised = point(sign * 50, 62, 15);
  if (clock < tell) {
    const t = clamp(clock / tell);
    return point(
      mix(neutral.x, raised.x, t),
      mix(neutral.y, raised.y, t),
      mix(neutral.z, raised.z, t),
    );
  }
  const u = clamp((clock - tell) / strike),
    e = u * u * (3 - 2 * u);
  return point(
    sign * (50 - 75 * e),
    62 - 9 * Math.sin(u * Math.PI),
    15 + 21 * Math.sin(u * Math.PI),
  );
}
function localArmPath(s, side, clock = s.attackTime) {
  const q = localArmPose(s, side, clock),
    a = point((side === "L" ? 1 : -1) * 17.74, 74.23, -8.565),
    r = distance(q, a);
  return r > 48.9
    ? point(
        a.x + ((q.x - a.x) * 48.9) / r,
        a.y + ((q.y - a.y) * 48.9) / r,
        a.z + ((q.z - a.z) * 48.9) / r,
      )
    : q;
}
export function titanCanGrab(s, p = s.avatar) {
  const proposal = { ...s, attack: "crunch", attackAim: p, stage: "combat" },
    clock =
      1.75 * ({ easy: 1.25, normal: 1, hard: 0.85 }[s.config.difficulty] || 1);
  return titanGrabTouches(proposal, p, clock);
}
export function titanGrabTouches(s, p, clock = s.attackTime) {
  const body = point(p.x, p.y + sonicLength(s, 1.8), p.z);
  return ["L", "R"].some(
    (side) => distance(body, titanArmPath(s, side, clock)) < 8,
  );
}
function localFootPath(s, side, clock = s.attackTime) {
  const sign = side === "L" ? 1 : -1,
    // Normalized ankle joints in the supplied rig; the sole is at Y0.
    neutral = point(sign * 4.84, 1.48, -6.02);
  if (
    s.stage !== "combat" ||
    s.attack !== "stomp" ||
    side !== (s.swatSide || "L")
  )
    return neutral;
  const tell =
    1.65 * ({ easy: 1.25, normal: 1, hard: 0.85 }[s.config.difficulty] || 1);
  const lift =
    clock < tell ? clamp(clock / tell) : 1 - clamp((clock - tell) / 0.28);
  const ease = lift * lift * (3 - 2 * lift);
  return point(
    neutral.x + sign * 7 * ease,
    neutral.y + 18 * ease,
    neutral.z + 12 * ease,
  );
}
function localState(s, pose = titanPose(s)) {
  return {
    ...s,
    avatar:
      s.qte?.kind === "crunch" ? titanLocalPoint(s, s.avatar, pose) : s.avatar,
    attackAim: s.attackAim ? titanLocalPoint(s, s.attackAim, pose) : null,
  };
}
export function titanArmPath(
  s,
  side,
  clock = s.attackTime,
  pose = titanPose(s),
) {
  return titanWorldPoint(
    s,
    localArmPath(localState(s, pose), side, clock),
    pose,
  );
}
export function titanFootPath(
  s,
  side,
  clock = s.attackTime,
  pose = titanPose(s),
) {
  return (
    titanWalkingFoot(s, side, pose) ||
    titanWorldPoint(s, localFootPath(s, side, clock), pose)
  );
}
export function titanBodyRegions(s, clock = s.attackTime, pose = titanPose(s)) {
  if (s.titan === "wyvern") return wyvernRegions(s);
  return localBodyRegions(localState(s, pose), clock).map((r) => {
    if (r.axes)
      return {
        ...r,
        center: titanWorldPoint(s, r.center, pose),
        yaw: pose.yaw || 0,
      };
    const q = {
      ...r,
      a: titanWorldPoint(s, r.a, pose),
      b: titanWorldPoint(s, r.b, pose),
    };
    if (r.id.endsWith(" shin")) q.b = titanFootPath(s, r.id[0], clock, pose);
    if (pose.walk && (r.id.endsWith(" shin") || r.id.endsWith(" thigh"))) {
      const chain = titanWalkingKnee(s, r.id[0], pose);
      q.a = r.id.endsWith(" thigh") ? chain.hip : chain.knee;
      q.b = r.id.endsWith(" thigh") ? chain.knee : chain.foot;
    }
    return q;
  });
}
export function titanStompWave(s, clock = s.attackTime) {
  const tell =
    1.65 * ({ easy: 1.25, normal: 1, hard: 0.85 }[s.config.difficulty] || 1);
  const elapsed = clock - tell - 0.28;
  return {
    active: s.attack === "stomp" && elapsed >= 0 && elapsed < 0.77,
    center: titanWorldPoint(
      s,
      point((s.swatSide === "R" ? -1 : 1) * 4.84, 0.15, -6.02),
    ),
    radius: Math.max(0, elapsed * 80),
  };
}
function localBodyRegions(s, clock = s.attackTime) {
  const regions = [
    { id: "torso", center: point(0, 63, -7.5), axes: point(16, 20, 8.5) },
    { id: "hips", center: point(0, 53, -7.5), axes: point(10, 10, 7) },
    { id: "head", center: point(0, 85, 7), axes: point(11, 11, 11) },
  ];
  for (const side of ["L", "R"]) {
    const sign = side === "L" ? 1 : -1,
      shoulder = point(sign * 20, 73, -8.5),
      hand = localArmPath(s, side, clock);
    const elbow = point(
      mix(shoulder.x, hand.x, 0.54) + sign * 3,
      mix(shoulder.y, hand.y, 0.54),
      mix(shoulder.z, hand.z, 0.54),
    );
    regions.push(
      {
        id: side + " shoulder",
        a: point(sign * 13, 74, -7),
        b: shoulder,
        r: 12,
      },
      { id: side + " upper arm", a: shoulder, b: elbow, r: 7 },
      { id: side + " forearm", a: elbow, b: hand, r: 5.5 },
      { id: side + " hand", a: hand, b: hand, r: 5 },
      {
        id: side + " thigh",
        a: point(sign * 5, 51, -6),
        b: point(sign * 5, 27, -6),
        r: 7,
      },
      {
        id: side + " shin",
        a: point(sign * 5, 27, -6),
        b: localFootPath(s, side, clock),
        r: 5,
      },
    );
  }
  return regions;
}
export function regionContact(region, p) {
  if (region.axes) {
    const keys = ["x", "y", "z"],
      relative = titanLocalPoint(null, p, {
        x: region.center.x,
        z: region.center.z,
        yaw: region.yaw || 0,
      }),
      q = [relative.x, p.y - region.center.y, relative.z],
      rr = keys.map((k) => region.axes[k] ** 2),
      unit = Math.sqrt(q.reduce((sum, v, i) => sum + (v * v) / rr[i], 0));
    let v;
    if (unit <= 1) {
      v = unit > 1e-8 ? q.map((x) => x / unit) : [0, 0, region.axes.z];
    } else {
      let lo = 0,
        hi = Math.sqrt(q.reduce((sum, v, i) => sum + v * v * rr[i], 0));
      for (let i = 0; i < 22; i++) {
        const mid = (lo + hi) / 2,
          f = q.reduce(
            (sum, v, j) => sum + (rr[j] * v * v) / (mid + rr[j]) ** 2,
            0,
          );
        if (f > 1) lo = mid;
        else hi = mid;
      }
      v = q.map((x, i) => (rr[i] * x) / ((lo + hi) / 2 + rr[i]));
    }
    const c = titanWorldPoint(null, point(v[0], v[1] + region.center.y, v[2]), {
        x: region.center.x,
        z: region.center.z,
        yaw: region.yaw || 0,
      }),
      n = v.map((x, i) => x / rr[i]),
      l = Math.hypot(...n) || 1;
    return {
      id: region.id,
      point: c,
      normal: titanWorldVector(null, point(n[0] / l, n[1] / l, n[2] / l), {
        yaw: region.yaw || 0,
      }),
      inside: unit < 1,
      distance: unit < 1 ? 0 : distance(p, c),
    };
  }
  const c = closestSegment(p, region.a, region.b),
    d = distance(p, c),
    ax = region.b.x-region.a.x,
    az = region.b.z-region.a.z,
    horizontal = Math.hypot(ax,az),
    n =
      d > 1e-6
        ? point((p.x - c.x) / d, (p.y - c.y) / d, (p.z - c.z) / d)
        : horizontal>1e-6 ? point(az/horizontal,0,-ax/horizontal) : point(0, 0, 1);
  return {
    id: region.id,
    point: point(
      c.x + n.x * region.r,
      c.y + n.y * region.r,
      c.z + n.z * region.r,
    ),
    normal: n,
    inside: d < region.r,
    distance: Math.max(0, d - region.r),
  };
}
export function nearestTitanSurface(s, p, clock = s.attackTime) {
  let best = null;
  for (const region of titanBodyRegions(s, clock)) {
    const c = regionContact(region, p);
    if (!best || c.distance < best.distance) best = c;
  }
  return best;
}
export function sweptTitanContact(s, from, to, reach, oldClock = s.attackTime) {
  const old = titanBodyRegions(s, oldClock, s.boss?.previous || titanPose(s)),
    now = titanBodyRegions(s),
    travel = distance(from, to);
  const samples = Math.min(24, Math.max(4, Math.ceil(travel / 1.5)));
  let best = null;
  for (let i = 0; i <= samples; i++) {
    const t = i / samples,
      p = point(
        mix(from.x, to.x, t),
        mix(from.y, to.y, t),
        mix(from.z, to.z, t),
      );
    for (let j = 0; j < now.length; j++) {
      const r = now[j].axes
        ? {
            ...now[j],
            center: point(
              mix(old[j].center.x, now[j].center.x, t),
              mix(old[j].center.y, now[j].center.y, t),
              mix(old[j].center.z, now[j].center.z, t),
            ),
            yaw:
              (old[j].yaw || 0) +
              titanTurn(old[j].yaw || 0, now[j].yaw || 0) * t,
          }
        : {
            ...now[j],
            a: point(
              mix(old[j].a.x, now[j].a.x, t),
              mix(old[j].a.y, now[j].a.y, t),
              mix(old[j].a.z, now[j].a.z, t),
            ),
            b: point(
              mix(old[j].b.x, now[j].b.x, t),
              mix(old[j].b.y, now[j].b.y, t),
              mix(old[j].b.z, now[j].b.z, t),
            ),
          };
      const c = regionContact(r, p);
      if (c.distance <= reach && (!best || c.distance < best.distance))
        best = c;
    }
  }
  return best;
}
export function constrainTitanBody(p, s = {}, regions = null) {
  const solid=(regions || titanBodyRegions(s)).filter(r=>s.titan==='wyvern'?true:!r.id.endsWith(' hand'));
  const floor=s.titan==='wyvern'?-600:0.05;
  const samples=[[1.8,1.45],[0.7,0.72],[3.0,0.8]];
  for(let pass=0;pass<5;pass++)for(const [height,radius] of samples)for(const region of solid){
    const h=sonicLength(s,height),padding=sonicLength(s,radius),q=point(p.x,p.y+h,p.z);
    if(region.axes){const r=Math.max(region.axes.x,region.axes.z)+padding;if(Math.abs(q.x-region.center.x)>r||Math.abs(q.z-region.center.z)>r||Math.abs(q.y-region.center.y)>region.axes.y+padding)continue;}
    else {const r=region.r+padding;if(q.x<Math.min(region.a.x,region.b.x)-r||q.x>Math.max(region.a.x,region.b.x)+r||q.y<Math.min(region.a.y,region.b.y)-r||q.y>Math.max(region.a.y,region.b.y)+r||q.z<Math.min(region.a.z,region.b.z)-r||q.z>Math.max(region.a.z,region.b.z)+r)continue;}
    const c=regionContact(region,q);
    if(!c.inside&&c.distance>=padding)continue;
    let x=c.point.x+c.normal.x*padding,y=c.point.y+c.normal.y*padding-h,z=c.point.z+c.normal.z*padding;
    if(y<floor){
      const origin=region.a?closestSegment(q,region.a,region.b):region.center,dx=p.x-origin.x,dz=p.z-origin.z,l=Math.hypot(dx,dz)||1;
      const r=(region.r ?? Math.max(region.axes.x,region.axes.z))+padding;
      x=origin.x+(dx/l || 0)*r;z=origin.z+(l===1&&dx===0&&dz===0?1:dz/l)*r;y=floor;
    }
    p.x=x;p.y=y;p.z=z;
    const dot=(p.vx||0)*c.normal.x+(p.vy||0)*c.normal.y+(p.vz||0)*c.normal.z;
    if(dot<0){p.vx=(p.vx||0)-c.normal.x*dot;p.vy=(p.vy||0)-c.normal.y*dot;p.vz=(p.vz||0)-c.normal.z*dot;}
  }
  p.y=Math.max(floor,p.y);
}

export function titanFinalePosition(from, time, s = {}) {
  return titanPiercePosition(from, time, s);
}

export function titanSweepTouches(s, side, from, to, oldClock) {
  const window = titanSweepHand(s, side),
    lo = Math.max(oldClock, window.start + TITAN_SWEEP.activeStart),
    hi = Math.min(s.attackTime, window.start + TITAN_SWEEP.activeEnd);
  if (hi < lo) return false;
  for (let sample = 0; sample <= 6; sample++) {
    const clock = mix(lo, hi, sample / 6),
      t = clamp((clock - oldClock) / (s.attackTime - oldClock || 1)),
      previous = s.boss.previous || s.boss,
      root = {
        x: mix(previous.x, s.boss.x, t),
        z: mix(previous.z, s.boss.z, t),
        yaw: previous.yaw + titanTurn(previous.yaw, s.boss.yaw) * t,
      },
      arm = titanBodyRegions(s, clock, root).find(
        (q) => q.id === side + " forearm",
      ),
      body = point(
        mix(from.x, to.x, t),
        mix(from.y, to.y, t) + sonicLength(s, 1.8),
        mix(from.z, to.z, t),
      );
    if (distance(body, closestSegment(body, arm.a, arm.b)) < TITAN_SWEEP.radius)
      return true;
  }
  return false;
}
