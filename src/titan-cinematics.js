import { cinemaRate } from "./titan-cinema-rate.js";
import { TITAN_POWER } from "./titan-balance.js";
import { titanCameraTrack as cameraTrack } from "./titan-shot-flow.js";
import { TITAN_CHEST_BREACH } from "./titan-finale.js";
import {
  titanWorldPoint,
  titanLocalPoint,
  titanWorldVector,
} from "./titan-space.js";
import { sonicLength } from "./titan-metrics.js";
export const TITAN_COUNTER = { duration: 1.65, launch: 0.2, impact: 0.85 };
export const TITAN_FINALE = {
  duration: 7,
  contact: 3.6,
  rupture: 4.8,
  cues: [
    ["charge", 0.35],
    ["launch", 1.9],
    ["contact", 3.6],
    ["rupture", 4.8],
    ["detonate", 5.45],
  ],
};
const clamp = (x) => Math.max(0, Math.min(1, x)),
  ease = (x) => {
    x = clamp(x);
    return x * x * (3 - 2 * x);
  };
export function makeTitanCounter(s, kind, contact) {
  return {
    kind,
    elapsed: 0,
    from: { x: s.avatar.x, y: s.avatar.y, z: s.avatar.z },
    aim: {
      id: contact.id,
      point: titanLocalPoint(s, contact.point),
      normal: titanLocalPoint(s, contact.normal, {
        x: 0,
        z: 0,
        yaw: s.boss?.yaw || 0,
      }),
    },
    landed: false,
    launched: false,
    damage: s.config.damage.struggle,
    serial: ++s.strikeSerial,
  };
}
export function titanCounterContact(s, c = s.counterScene) {
  return {
    id: c.aim.id,
    point: titanWorldPoint(s, c.aim.point),
    normal: titanWorldVector(s, c.aim.normal),
  };
}
export function titanCounterPosition(s, c = s.counterScene, time = c.elapsed) {
  const q = titanCounterContact(s, c),
    a = ease(time / TITAN_COUNTER.impact),
    r = ease(
      (time - TITAN_COUNTER.impact) /
        (TITAN_COUNTER.duration - TITAN_COUNTER.impact),
    );
  return {
    x:
      c.from.x +
      (q.point.x + q.normal.x * sonicLength(s, 3) - c.from.x) * a +
      q.normal.x * r * 10,
    y: Math.max(
      0.05,
      c.from.y +
        (q.point.y +
          q.normal.y * sonicLength(s, 3) -
          sonicLength(s, 1.8) -
          c.from.y) *
          a +
        q.normal.y * r * 10 +
        Math.sin(r * Math.PI) * 2,
    ),
    z:
      c.from.z +
      (q.point.z + q.normal.z * sonicLength(s, 3) - c.from.z) * a +
      q.normal.z * r * 10,
  };
}
// Consumed cues are persisted. Clock jumps cross each cue once; rendering never
// invents impact/audio events. A resumed movie suppresses already elapsed cues.
export function tickTitanFinaleCues(s, emit) {
  for (let i = 0; i < TITAN_FINALE.cues.length; i++) {
    const [cue, at] = TITAN_FINALE.cues[i],
      bit = 1 << i;
    if (s.stageTime >= at && !((s.finaleCues || 0) & bit)) {
      s.finaleCues = (s.finaleCues || 0) | bit;
      emit(s, "cinematic-cue", {
        cue,
        cinematic: "finale",
        age: (s.stageTime - at) / cinemaRate(s),
        point: titanWorldPoint(s, TITAN_CHEST_BREACH),
        normal: titanWorldVector(s, { x: 0, y: 0, z: 1 }),
      });
    }
  }
}
export function elapsedFinaleCues(time) {
  return TITAN_FINALE.cues.reduce(
    (mask, [, at], i) => mask | (time >= at ? 1 << i : 0),
    0,
  );
}
export function restoreTitanCounter(s, raw) {
  if (
    !raw ||
    !["beam", "crunch"].includes(raw.kind) ||
    typeof raw.landed !== "boolean" ||
    !Number.isFinite(raw.elapsed) ||
    raw.elapsed < 0 ||
    raw.elapsed >= TITAN_COUNTER.duration
  )
    return null;
  const point = (p) =>
    p &&
    ["x", "y", "z"].every(
      (k) => Number.isFinite(p[k]) && Math.abs(p[k]) <= 250,
    );
  if (!point(raw.from) || !point(raw.aim?.point) || !point(raw.aim?.normal))
    return null;
  const length = Math.hypot(
    raw.aim.normal.x,
    raw.aim.normal.y,
    raw.aim.normal.z,
  );
  if (length < 0.5 || length > 1.5) return null;
  // No old cue is replayed. Preserve whether damage has already been awarded.
  return {
    kind: raw.kind,
    elapsed: raw.elapsed,
    from: { ...raw.from },
    aim: {
      id: String(raw.aim.id || "torso").slice(0, 30),
      point: { ...raw.aim.point },
      normal: Object.fromEntries(
        ["x", "y", "z"].map((k) => [k, raw.aim.normal[k] / length]),
      ),
    },
    landed: raw.landed,
    launched: raw.elapsed >= TITAN_COUNTER.launch,
    damage: Math.max(
      1,
      Math.min(
        TITAN_POWER.struggle * 3,
        Number.isFinite(raw.damage) ? raw.damage : s.config.damage.struggle,
      ),
    ),
    serial: Number.isSafeInteger(raw.serial) ? raw.serial : ++s.strikeSerial,
  };
}

// Smooth keyed composition in arena metres; movie clocks are owned by simulation.
export function titanCinematicShot(s, p = s.avatar) {
  if (s.qte?.kind === "crunch") {
    const offset = titanWorldVector(s, {
      x: sonicLength(s, 16),
      y: sonicLength(s, 5),
      z: sonicLength(s, 22),
    });
    return {
      position: { x: p.x + offset.x, y: p.y + offset.y, z: p.z + offset.z },
      target: { x: p.x, y: p.y + sonicLength(s, 1.8), z: p.z },
      fov: 54,
    };
  }
  if (s.stage === "intro") {
    const q = cameraTrack(
      [
        [0, 86, 14, 156, 0, 52, 0, 62],
        [1.8, 64, 25, 130, 0, 53, 0, 64],
        [3.35, 18, 7, 104, 0, 4, 76, 65],
        [4.5, 0, 3.2, 90.5, 0, 1.4, 78, 67],
      ],
      s.stageTime,
    );
    return {
      position: titanWorldPoint(s, { x: q[0], y: q[1], z: q[2] }),
      target: titanWorldPoint(s, { x: q[3], y: q[4], z: q[5] }),
      fov: q[6],
    };
  }
  if (s.stage === "transform") {
    const q = cameraTrack(
      [
        [0, -6, 2.2, 8, 1.8, 48],
        [1.8, 5, 1.8, 7, 2.2, 46],
        [3.7, 8, 3, 10, 2.1, 53],
        [6, 12, 6, 21, 2, 65],
      ],
      s.stageTime,
    );
    return {
      position: {
        x: p.x + sonicLength(s, q[0]),
        y: p.y + sonicLength(s, q[1]),
        z: p.z + sonicLength(s, q[2]),
      },
      target: { x: p.x, y: p.y + sonicLength(s, q[3]), z: p.z },
      fov: q[4],
    };
  }
  if (s.stage === "phase") {
    const a =
        Math.atan2(p.x - (s.boss?.x || 0), p.z - (s.boss?.z || 0)) -
        (s.boss?.yaw || 0),
      q = cameraTrack(
        [
          [0, 62, 78, 0.06, 70],
          [1.5, 86, 88, 0.18, 67],
          [4, 108, 80, 0.24, 65],
        ],
        s.stageTime,
      );
    return {
      position: titanWorldPoint(s, {
        x: Math.sin(a + q[2]) * q[0],
        y: q[1],
        z: Math.cos(a + q[2]) * q[0],
      }),
      target: titanWorldPoint(s, { x: 0, y: 78, z: -3 }),
      fov: q[3],
    };
  }

  if (s.qte || s.counterScene) {
    const center = titanWorldPoint(s, { x: 0, y: 75, z: -7.5 }),
      dx = p.x - center.x,
      dz = p.z - center.z,
      length = Math.hypot(dx, dz) || 1,
      n = { x: dx / length, z: dz / length };
    const contact = s.counterScene
      ? titanCounterContact(s).point
      : titanWorldPoint(s, { x: 0, y: 85, z: 18 });
    const timing = s.counterScene
      ? cameraTrack(
          [
            [0, 27, 13, 9, 59],
            [0.55, 23, 15, 6, 54],
            [0.85, 26, 18, 8, 56],
            [1.65, 35, 13, 12, 65],
          ],
          s.counterScene.elapsed,
        )
      : [27, 13, 9, 59];
    return {
      target: {
        x: p.x * 0.72 + contact.x * 0.28,
        y: (p.y + 2) * 0.72 + contact.y * 0.28,
        z: p.z * 0.72 + contact.z * 0.28,
      },
      position: {
        x: p.x + n.x * timing[0] + n.z * timing[1],
        y: p.y + timing[2],
        z: p.z + n.z * timing[0] - n.x * timing[1],
      },
      fov: timing[3],
    };
  }
  if (s.stage !== "finale" && s.stage !== "victory") return null;
  const t = s.stage === "victory" ? 7 : s.stageTime;
  const q = cameraTrack(
    [
      [0, 36, 78, 116, 0, 68, 23, 57],
      [1.9, 17, 76, 113, -3, 68, 47, 50],
      [3.6, 64, 82, 96, 0, 64, -4, 54],
      [4.35, 88, 89, -80, 0, 65, -10, 58],
      [4.8, 86, 94, -144, 0, 68, -31, 57],
      [5.45, 65, 90, -142, 0, 70, -17, 58],
      [6.3, 30, 88, -145, -2, 79, -60, 59],
      [7, -3, 86, -97, -8, 84, -112, 55],
    ],
    t,
  );
  return {
    position: titanWorldPoint(s, { x: q[0], y: q[1], z: q[2] }),
    target: titanWorldPoint(s, { x: q[3], y: q[4], z: q[5] }),
    fov: q[6],
  };
}

export function titanCheckpointEvent(e) {
  return (
    [
      "stage",
      "checkpoint",
      "qte-win",
      "counter-end",
      "cinematic-skip",
    ].includes(e.type) ||
    (e.type === "hit" && e.kind === "struggle")
  );
}
