import {titanTargetContact,toggleTitanTarget,tickTitanTarget} from "./titan-targeting.js";
import {sonicCollider} from "./sonic-collider.js";
import {TITAN_HOMING,makeTitanHoming,steerTitanHoming,finishTitanHoming,homingBlocked} from './titan-homing.js';
import {titanBoulderBounds} from "./titan-landscape.js";
import {constrainBoxes} from "./titan-collision.js";
import {sonicTraversalInput,applySonicTraversal,restoreSonicTraversal} from "./sonic-traversal.js";
import {sweepTitanMotion} from "./titan-collision.js";
import { sonicHandling, sonicJump, tickSonicMovement, clearSuperCooldowns, superMoveReady, restoreSonicMovement } from "./sonic-movement.js";
import { registerTitanHit, tickTitanCombo, breakTitanCombo, restoreTitanCombo, TITAN_COMBO } from "./titan-combo.js";
import { WYVERN_SCALE, wyvernDamageGate, wyvernDamageTransition } from "./wyvern-space.js";
import { titanEmeraldPoint } from "./titan-metrics.js";
import { bufferTitanMove, takeTitanMove } from "./titan-chain.js";
import { titanBossImpact } from "./titan-boss-power.js";
import { cinemaRate, TITAN_MOVIES } from "./titan-cinema-rate.js";
import {
  TITAN_SPIN,
  techniquePosition,
  approachTitanMelee,
} from "./titan-advanced.js";
import {
  freshGrassCyloop,
  advanceGrassCyloop,
  restoreGrassCyloop,
} from "./titan-grass-cyloop.js";
import {
  TITAN_BALANCE,
  TITAN_HEALTH,
  upgradeTitanCombat,
} from "./titan-balance.js";
import { freezeTitanSky } from "./titan-ending.js";
import { openTitanReturn, stepTitanReturn } from "./titan-return.js";
import { TITAN_SWEEP, titanSweepHand } from "./titan-sweep.js";
import {
  freshTitanTactics,
  updateTitanTactics,
  titanGuarding,
  recordTitanPressure,
  titanRecovery,
  chooseTitanTactic,
  titanPulse,
} from "./titan-tactics.js";
import {
  tickTransformation,
  TRANSFORM_EVENTS,
} from "./titan-transformation.js";
import { sonicLength, sonicContact } from "./titan-metrics.js";
import { makeTitanShot, steerTitanShot, TITAN_SHOT } from "./titan-shot.js";
import {
  armorMode,
  armorAttached,
  freshArmorState,
  attachArmor,
  releaseArmor,
  advanceArmor,
  armorFocus,
  recoverArmor,
  restoreArmorState,
  collideArmor,
} from "./titan-climb.js";
import {
  TITAN_COUNTER,
  TITAN_FINALE,
  makeTitanCounter,
  titanCounterPosition,
  titanCounterContact,
  tickTitanFinaleCues,
  elapsedFinaleCues,
  restoreTitanCounter,
} from "./titan-cinematics.js";
import { makeTitanRush, titanRushVelocity } from "./titan-rush.js";
import {
  freshTitanBody,
  tickTitanBody,
  beginTitanStep,
} from "./titan-mobility.js";
import { titanWorldPoint, titanLocalPoint } from "./titan-space.js";
import { titanDorsalRay, titanDorsalState } from "./titan-dorsal.js";
import {
  TITAN_CYLOOP,
  makeTitanCyloop,
  titanCyloopPosition,
} from "./titan-cyloop.js";
import { ARENA_DEFAULTS, arenaConfig } from "./titan-settings.js";
import {
  TITAN_DAMAGE,
  TITAN_ACTIONS,
  titanDamageConfig,
} from "./titan-combat.js";
import {
  point,
  distance,
  nearestTitanSurface,
  sweptTitanContact,
  constrainTitanBody,
  titanArmPath,
  titanAttackSide,
  closestSegment,
  titanBodyRegions,
  titanStompWave,
  titanCanGrab,
  titanGrabTouches,
  titanSweepTouches,
  titanFinalePosition,
} from "./titan-contact.js";
// Fixed-step arena simulation. No renderer, DOM, inventory or world mutation.
export const TITAN_DEFAULTS = Object.freeze({
  ...ARENA_DEFAULTS,
  bossMobility: true,
  climbMode: "armor",
  enabled: true,
  spawnChance: 0.32,
  cooldown: 900,
  particles: true,
  lighting: true,
  audio: true,
  music: true,
  difficulty: "normal",
  rings: 400,
  drain: 1,
  checkpoints: true,
  cinematics: true,
  strictParry: false,
  damage: TITAN_DAMAGE,
  combatRevision: TITAN_BALANCE,
  healthMultiplier: 1,
  shadowQuality: "auto",
  postProcessing: true,
});
export function titanConfig(raw = {}) {
  const n = (k, a, b) =>
    Math.max(
      a,
      Math.min(b, Number.isFinite(+raw[k]) ? +raw[k] : TITAN_DEFAULTS[k]),
    );
  return {
    ...TITAN_DEFAULTS,
    ...arenaConfig(raw),
    ...Object.fromEntries(
      [
        "bossMobility",
        "enabled",
        "particles",
        "lighting",
        "audio",
        "music",
        "checkpoints",
        "cinematics",
        "strictParry",
        "postProcessing",
      ].map((k) => [
        k,
        typeof raw[k] === "boolean" ? raw[k] : TITAN_DEFAULTS[k],
      ]),
    ),
    climbMode: raw.climbMode === "ruins" ? "ruins" : "armor",
    damage: titanDamageConfig(raw.damage),
    mandatoryCinematics: raw.mandatoryCinematics === true,
    ...(raw.mandatoryCinematics === true ? { cinematics: true } : {}),
    healthMultiplier: n("healthMultiplier", 0.5, 2),
    shadowQuality: ["auto", "off", "low", "high"].includes(raw.shadowQuality)
      ? raw.shadowQuality
      : "auto",
    spawnChance: n("spawnChance", 0, 1),
    cooldown: n("cooldown", 10, 7200),
    rings: Math.round(n("rings", 100, 999)),
    drain: n("drain", 0, 3),
    difficulty: ["easy", "normal", "hard"].includes(raw.difficulty)
      ? raw.difficulty
      : "normal",
  };
}
export const TITAN_ROUTE = [
  [0, 0, 78],
  [0, 5, 59],
  [12, 12, 43],
  [26, 20, 27],
  [32, 28, 9],
  [30, 36, -9],
  [22, 44, -25],
  [4, 52, -33],
  [-18, 60, -25],
  [-28, 68, -2],
  [-18, 76, 19],
  [-4, 84, 18],
  [0, 92, 0],
].map(([x, y, z]) => ({ x, y, z, w: 14 }));
export const TITAN_MOVES = Object.freeze({
  spin: {
    label: "SPIN · CHANGE ALTITUDE OR PARRY",
    tell: TITAN_SPIN.tell,
    strike: TITAN_SPIN.strike,
    recover: 3.8,
  },
  uppercut: {
    label: "UPPERCUT · DODGE OR PARRY",
    tell: 1.8,
    strike: 1.05,
    recover: 3.5,
  },
  pulse: {
    label: "RING WAVE · CHANGE ALTITUDE",
    tell: 1.55,
    strike: 1.2,
    recover: 2.4,
  },
  stomp: {
    label: "STOMP · RISE OR DODGE",
    tell: 1.65,
    strike: 1.05,
    recover: 3.4,
  },
  sweep: {
    label: "DOUBLE SWEEP",
    tell: 1.7,
    strike: TITAN_SWEEP.strike,
    recover: 3.3,
  },
  swat: {
    label: "SWATTING HAND · DODGE OR PARRY",
    tell: 1.25,
    strike: 0.55,
    recover: 3.2,
  },
  swing: {
    label: "LEFT ARM SWING",
    tell: 1.5,
    strike: 0.65,
    recover: 3.1,
    side: -1,
  },
  slap: {
    label: "RIGHT ARM SLAP",
    tell: 1.2,
    strike: 0.55,
    recover: 2.9,
    side: 1,
  },
  beam: {
    label: "MOUTH BEAM · STRUGGLE",
    tell: 1.8,
    strike: 4.5,
    recover: 3.8,
    qte: true,
  },
  crunch: {
    label: "GRAB AND CRUNCH",
    tell: 1.75,
    strike: 4.2,
    recover: 3.6,
    qte: true,
  },
});
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)),
  dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z),
  lerp = (a, b, t) => a + (b - a) * t;
export const TITAN_CHEST = { x: 0, y: 57, z: 17 },
  TITAN_EMERALD = { x: 0, y: 95, z: 0 };

// Golden ring clusters are authored on the flat playable floor. Every cluster
// has a stable save ID, five visible rings, and a single atomic 10-ring award.
export const TITAN_RING_TRAILS = Array.from({ length: 36 }, (_, i) => {
  const row = Math.floor(i / 12),
    angle = ((i % 12) / 12) * Math.PI * 2 + row * 0.12;
  const radius = 35 + row * 28;
  return {
    id: i,
    x: Math.sin(angle) * radius,
    y: 1.25,
    z: Math.cos(angle) * radius,
    value: 10,
  };
});
export function collectTitanRings(s) {
  if (s.stage !== "traversal" || s.rings >= s.config.rings) return 0;
  s.ringPickups ||= [];
  let count = 0;
  for (const ring of TITAN_RING_TRAILS) {
    if (s.ringPickups.includes(ring.id)) continue;
    if (
      Math.hypot(
        s.avatar.x - ring.x,
        s.avatar.y + 1 - ring.y,
        s.avatar.z - ring.z,
      ) < 3.8
    ) {
      s.ringPickups.push(ring.id);
      s.rings = Math.min(s.config.rings, s.rings + ring.value);
      count += ring.value;
      emit(s, "ring", { count: ring.value, x: ring.x, y: ring.y, z: ring.z });
      if (s.rings >= s.config.rings) break;
    }
  }
  return count;
}

export function titanSession(config = {}, portalId = "trial") {
  const c = titanConfig(config),
    hp = TITAN_HEALTH[c.difficulty] * c.healthMultiplier;
  return {
    schema: 1,
    id: portalId,
    stage: c.cinematics ? "intro" : "traversal",
    cinemaRate: c.cinematicPace,
    boss: freshTitanBody(),
    stageTime: 0,
    battleMusic: null,
    preludeMusic: null,
    transformCues: 0,
    tactics: freshTitanTactics(),
    time: 0,
    config: c,
    avatar: {
      x: 0,
      y: 0.1,
      z: 78,
      vx: 0,
      vy: 0,
      vz: 0,
      yaw: 0,
      pitch: 0.1,
      onGround: true,
    },
    route: 0,
    climb: freshArmorState(),
    emerald: false,
    checkpoint: "traversal",
    phase: 1,
    hp,
    maxHp: hp,
    rings: Math.min(80, c.rings),
    ringPickups: [],
    grassCyloop: freshGrassCyloop(),
    preparedRings: 0,
    balance: TITAN_BALANCE,
    strike: null,
    queuedMove: null,
    projectiles: [],
    recentAttacks: [],
    knockback: null,
    boosting: false,
    strikeSerial: 0,
    comboStep: 0,
    phantomRest: 0,
    staggerRest: 0,
    perfectCounter: false,
    attackAim: null,
    cinematicFrom: null,
    hitFeedback: null,
    combo: 0,
    comboTime: 0,
    phantom: 0,
    phantomCharge: 0,
    cyloopCharge: 1,
    cyloopHold: 0,
    attack: "idle",
    attackTime: 0,
    sequence: 0,
    idle: 2.5,
    stagger: 0,
    iframes: 0,
    dodge: 0,
    action: "idle",
    actionTime: 0,
    parryAge: 0,
    parryHeld: false,
    qte: null,
    counterScene: null,
    finaleCues: 0,
    hitDone: false,
    cooldowns: {
      stomp: 0,
      spin: 0,
      cyclone: 0,
      homing: 0,
      shot: 0,
      cross: 0,
      hit: 0,
      boom: 0,
      rush: 0,
      loop: 0,
      dodge: 0,
    },
    events: [],
    collected: [],
    counter: 0,
    pulseCooldown: 0,
    lock: true,
    won: false,
  };
}
const emit = (s, type, data = {}) =>
  s.events.push({
    type,
    ...data,
    at: s.time,
    eventId: `${s.id}:${s.attempt || 0}:${(s.eventSerial = (s.eventSerial || 0) + 1)}`,
  });
function change(s, stage) {
  s.queuedMove = null;
  s.stage = stage;
  s.stageTime = 0;
  if (TITAN_MOVIES.includes(stage)) s.cinemaRate = s.config.cinematicPace;
  if (["transform", "phase", "finale"].includes(stage))
    s.avatar.vx = s.avatar.vy = s.avatar.vz = 0;
  if (stage !== "combat") {
    s.projectiles = [];
    s.counterScene = null;
  }
  if (stage === "finale") s.finaleCues = 0;
  if (stage === "transform") s.transformCues = 0;
  if (stage === "phase") s.phaseStartedAt = s.time;
  emit(s, "stage", { stage });
}
export function retryTitan(s) {
  const checkpoint = s.config.checkpoints ? s.checkpoint : "traversal",
    c = s.config,
    id = s.id,
    original = s.original,
    preparedRings = s.preparedRings,
    attempt = (s.attempt || 0) + 1;
  Object.assign(s, titanSession(c, id));
  s.attempt = attempt;
  s.original = original;
  s.checkpoint = checkpoint;
  if (checkpoint !== "traversal") {
    s.emerald = true;
    s.route = TITAN_ROUTE.length - 1;
    s.phase = checkpoint === "phase2" ? 2 : 1;
    s.hp = s.phase === 2 ? s.maxHp * 0.5 : s.maxHp;
    s.rings = Math.max(
      Math.min(180, s.config.rings),
      Math.min(s.config.rings, preparedRings || 0),
    );
    s.preparedRings = s.rings;
    startCombat(s);
  } else {
    s.stage = "traversal";
  }
  emit(s, "retry");
}
function startCombat(s) {
  change(s, "combat");
  const end = titanWorldPoint(s, { x: 0, y: 68, z: 38 });
  // End the transformation at its continuous flight endpoint. Checkpoint
  // retries deliberately spawn at that same safe position.
  Object.assign(s.avatar, end, { vx: 0, vy: 0, vz: 0, onGround: false });
  s.strike = null;
  s.action = "idle";
  s.actionTime = 0;
  s.cinematicFrom = null;
  s.attack = "idle";
  s.attackTime = 0;
  s.idle = 2.5;
  s.iframes = 1;
  s.preparedRings = Math.max(s.preparedRings || 0, s.rings);
}
export function skipTitanCinematic(s) {
  if (s.counterScene) {
    landTitanCounter(s, s.counterScene);
    s.counterScene = null;
    s.action = "idle";
    s.actionTime = 0;
    s.iframes = 1;
    s.idle = Math.max(s.idle, 2.5);
    emit(s, "cinematic-skip");
    return;
  }
  if (["intro", "transform", "phase", "finale"].includes(s.stage)) {
    s.strike = null;
    s.qte = null;
    s.action = "idle";
    s.actionTime = 0;
  }
  if (s.stage === "intro") change(s, "traversal");
  else if (s.stage === "transform") startCombat(s);
  else if (s.stage === "phase") {
    change(s, "combat");
    s.attack = "idle";
    s.idle = 2.5;
    s.strike = null;
    s.action = "idle";
    s.actionTime = 0;
    s.iframes = 1;
  } else if (s.stage === "finale") {
    s.cinematicFrom ||= { ...s.avatar };
    Object.assign(s.avatar, titanFinalePosition(s.cinematicFrom, 7, s), {
      vx: 0,
      vy: 0,
      vz: 0,
      onGround: false,
    });
    s.finaleCues = 31;
    s.won = true;
    freezeTitanSky(s);
    change(s, "victory");
    openTitanReturn(s);
  }
}
function hurt(s, swat = false, move = s.attack) {
  if (s.iframes > 0 || s.stage !== "combat") return false;
  s.iframes = 1.25;
  const centre = titanWorldPoint(s, point(0, 0, -7.5)),
    rx = s.avatar.x - centre.x,
    rz = s.avatar.z - centre.z,
    radius = Math.hypot(rx, rz) || 1;
  const impact = titanBossImpact(s, move);
  s.avatar.vx += (rx / radius) * 26;
  s.avatar.vz += (rz / radius) * 26;
  s.rings = Math.max(0, s.rings - impact.ringLoss);
  s.strike = null;
  s.queuedMove = null;
  s.hitFeedback = { until: s.time + 0.45, kind: "hurt" };
  s.avatar.vy += 5;
  breakTitanCombo(s);
  s.action = "hurt";
  s.actionTime = 0.5;
  s.idle = Math.max(s.idle, 2.2);
  if (swat) {
    const r = radius;
    s.knockback = {
      x: (rx / r) * 66,
      y: 18,
      z: (rz / r) * 66,
      left: 0.65,
      duration: 0.65,
    };
    s.avatar.vx = s.knockback.x;
    s.avatar.vy = 18;
    s.avatar.vz = s.knockback.z;
  }
  emit(s, "impact", {
    ...impact,
    swat,
    point: point(s.avatar.x, s.avatar.y + sonicLength(s, 1.8), s.avatar.z),
    normal: point(rx / radius, 0.2, rz / radius),
  });
  return true;
}
function bossDamage(
  s,
  amount,
  contact = nearestTitanSurface(s, s.avatar),
  kind = "struggle",
  serial = s.strike?.serial,
) {
  if (
    s.stage !== "combat" ||
    (s.attack === "beam" && s.qte) ||
    (s.attack === "crunch" && s.qte)
  )
    return false;
  if (s.titan === "wyvern" && !wyvernDamageGate(s, emit)) return false;
  const blocked =
    s.titan === "wyvern" ? false : titanGuarding(s, contact, kind);
  const damage = amount * (s.phantom > 0 ? 1.2 : 1) * (blocked ? 0.25 : 1);
  if (!blocked) recordTitanPressure(s, damage);
  s.hp = Math.max(0, s.hp - damage);
  if (!blocked) registerTitanHit(s, emit);
  s.hitFeedback = {
    until: s.time + 0.3,
    amount: damage,
    kind: blocked ? "blocked" : kind,
  };
  if (blocked) emit(s, "block", { point: contact.point, amount: damage });
  emit(s, "hit", {
    amount: damage,
    kind,
    point: contact.point,
    normal: contact.normal,
    region: contact.id,
    serial,
  });
  if (s.titan === "wyvern") return wyvernDamageTransition(s, emit);
  if (s.phase === 1 && s.hp <= s.maxHp * 0.5) {
    s.hp = s.maxHp * 0.5;
    s.phase = 2;
    s.checkpoint = "phase2";
    s.qte = null;
    s.strike = null;
    s.action = "idle";
    s.actionTime = 0;
    s.attack = "idle";
    change(s, "phase");
    if (!s.config.cinematics) skipTitanCinematic(s);
  } else if (s.hp <= 0) {
    s.qte = null;
    s.strike = null;
    s.cinematicFrom = { ...s.avatar };
    s.attack = "idle";
    change(s, "finale");
    if (!s.config.cinematics) skipTitanCinematic(s);
  }
  return true;
}
export function titanInput(s, action, held = false) {
  clearSuperCooldowns(s);
  if (action === "skip") {
    if (s.config.mandatoryCinematics) return false;
    skipTitanCinematic(s);
    return true;
  }
  if (action === "retry" && s.stage === "defeat") {
    retryTitan(s);
    return true;
  }
  if (s.qte && (action === "jump" || action === "hit")) {
    if (s.time - (s.qte.lastTap ?? -10) > 0.055) {
      s.qte.lastTap = s.time;
      s.qte.hits++;
      emit(s, "struggle");
    }
    return true;
  }
  if (s.stage === "traversal" && armorMode(s)) {
    if (action === "climb")
      return armorAttached(s) ? releaseArmor(s) : attachArmor(s, true);
    if (action === "jump" && armorAttached(s)) return releaseArmor(s, true);
  }
  if (s.stage === "traversal" && action === "jump" && s.avatar.onGround) {
    if (!sonicJump(s,24)) return false;
    emit(s, "jump");
    return true;
  }
  if(s.stage==='traversal'&&sonicTraversalInput(s,action,TITAN_RING_TRAILS.map(r=>({...r,y:0.5})),(type,data)=>emit(s,type,data)))return true;
  if (s.stage !== "combat" || s.counterScene) return false;
  if (action === "target") {
    toggleTitanTarget(s);
    if(s.strike?.homing){s.strike=null;s.queuedMove=null;s.actionTime=0;s.action="idle";}
    return true;
  }
  if (action === "dodge" && s.cooldowns.dodge <= 0 && s.dodge <= 0 && !s.qte) {
    if (s.strike?.move === "loop") {
      const speed = Math.hypot(s.avatar.vx, s.avatar.vy, s.avatar.vz);
      if (speed > 54)
        for (const k of ["vx", "vy", "vz"]) s.avatar[k] *= 54 / speed;
    }
    s.knockback = null;
    s.queuedMove = null;
    s.dodge = 0.42;
    s.iframes = 0.48;
    s.cooldowns.dodge = superMoveReady(s) ? 0 : 0.85;
    s.strike = null;
    s.action = "dodge";
    s.actionTime = 0.42;
    emit(s, "dodge");
    return true;
  }
  if (action === "jump" && s.avatar.onGround) {
    s.avatar.vy = 18;
    s.avatar.onGround = false;
    return true;
  }
  if (s.qte || s.action === "hurt" || s.dodge > 0) return false;
  if (s.strike) return bufferTitanMove(s, action, held);
  if (action === "hit" && s.counter > 0) {
    if (nearestTitanSurface(s, s.avatar).distance > 32) return false;
    s.counter = 0;
    return beginStrike(
      s,
      "counter",
      s.perfectCounter ? "perfectCounter" : "counter",
    );
  }
  if (action === "hit" && s.cooldowns.hit <= 0) {
    const kind = ["basic", "combo", "heavy", "finisher"][s.comboStep % 4];
    return beginStrike(s, kind === "basic" ? "punch" : kind, kind);
  }
  if (
    [
      "boom",
      "rush",
      "loop",
      "homing",
      "cross",
      "shot",
      "stomp",
      "spin",
      "cyclone",
    ].includes(action) &&
    s.cooldowns[action] <= 0
  )
    return beginStrike(s, action, action);

  return false;
}
function beginStrike(s, move, damageKind, parryHoming=false) {
  const m = TITAN_ACTIONS[move];
  if (move === "loop" && ((s.cyloopCharge ?? 1) < 1-1e-8 || (s.titan === "wyvern" && s.wyvern.open <= 0))) return false;
  const homing=move==="homing"?makeTitanHoming(s,parryHoming):null;
  if(move==="homing"&&!homing)return false;
  if (move === "loop" && nearestTitanSurface(s, s.avatar).distance > 32)
    return false;
  if (
    move === "shot" &&
    s.lock &&
    nearestTitanSurface(s, s.avatar).distance > 60
  )
    return false;
  if (
    ["stomp", "spin", "cyclone"].includes(move) &&
    nearestTitanSurface(s, s.avatar).distance > 16
  )
    return false;
  if (move === "loop") s.cyloopCharge = Math.max(0, (s.cyloopCharge ?? 1) - 1);
  s.cooldowns[
    ["punch", "combo", "heavy", "finisher"].includes(move) ? "hit" : move
  ] = superMoveReady(s) ? 0 : m.cooldown;
  s.action = ["punch", "combo", "heavy", "finisher"].includes(move)
    ? "punch"
    : move;
  s.actionTime = m.duration;
  const target = titanTargetContact(s, s.avatar);
  const dx = s.lock ? target.point.x - s.avatar.x : -Math.sin(s.avatar.yaw),
    dy = s.lock ? target.point.y - (s.avatar.y + sonicLength(s, 1.8)) : 0,
    dz = s.lock ? target.point.z - s.avatar.z : -Math.cos(s.avatar.yaw),
    l = Math.hypot(dx, dy, dz) || 1;
  s.strike = {
    move,
    kind: damageKind,
    elapsed: 0,
    duration: m.duration,
    next: 0,
    serial: ++s.strikeSerial,
    ...(homing?{homing}:{}),
    hand: s.comboStep % 2 ? "L" : "R",
    direction: point(dx / l, dy / l, dz / l),
  };
  if(homing){s.strike.duration=(homing.parry?TITAN_HOMING.parryWindup:TITAN_HOMING.windup)+homing.limit+TITAN_HOMING.recovery;s.actionTime=s.strike.duration;}
  if (["stomp", "cyclone"].includes(move) || (move === "cross" && s.lock && target.distance < 16)) {
    s.strike.motionFrom = { ...s.avatar };
    const n = target.normal;
    s.strike.motionNormal = {...n};
    s.strike.motionTarget = {
      x: target.point.x + n.x * sonicLength(s, 2),
      y: target.point.y + n.y * sonicLength(s, 2) - sonicLength(s, 1.8),
      z: target.point.z + n.z * sonicLength(s, 2),
    };
  }
  if (move === "loop")
    s.strike.orbit = makeTitanCyloop(
      s.avatar,
      s.titan === "wyvern" ? {x:0,y:66-sonicLength(s,1.8),z:0} : titanWorldPoint(s, point(0, 0, -7.5)),
      s.titan === "wyvern" ? {plane:"xy",radius:18*WYVERN_SCALE} : {},
    );
  if (move === "rush")
    s.strike.rushPath = makeTitanRush(s, target, s.strike.direction);
  if (move === "rush") s.iframes = Math.max(s.iframes, 0.28);
  emit(s, "attack-start", { kind: damageKind });
  if (["rush", "loop", "counter"].includes(move)) emit(s, move);
  return true;
}
export function beginParryHoming(s){
 if(s.stage!=="combat"||s.qte||s.counterScene)return false;
 s.strike=null;s.queuedMove=null;s.knockback=null;
 return beginStrike(s,"homing","homing",true);
}
function advanceStrike(s, from, dt, oldClock) {
  const a = s.strike;
  if (!a) return;
  const m = TITAN_ACTIONS[a.move];
  a.elapsed += dt;
  if(a.homing){
    const h=a.homing;
    if(h.phase==='flight'&&h.flightAge>=TITAN_HOMING.minFlight){
      const c=sweptTitanContact(s,sonicContact(s,from),sonicContact(s),sonicLength(s,2.9),oldClock);
      if(c){a.connected=bossDamage(s,s.config.damage.homing,c,'homing');if(s.strike!==a)return;finishTitanHoming(s,c,emit);}
      else if(homingBlocked(s,dt))finishTitanHoming(s,null,emit);
    }
    if(h.phase==='recovery'&&h.recoveryAge>=TITAN_HOMING.recovery){s.strike=null;s.action='idle';s.actionTime=0;}
    return;
  }
  while (a.next < m.contacts.length && a.elapsed >= m.contacts[a.next]) {
    a.next++;
    if (a.move === "shot") {
      const q = makeTitanShot(s, a, a.next - 1);
      s.projectiles.push(q);
      emit(s, "shot", {
        point: point(q.x, q.y, q.z),
        normal: point(
          q.vx / TITAN_SHOT.speed,
          q.vy / TITAN_SHOT.speed,
          q.vz / TITAN_SHOT.speed,
        ),
        index: a.next,
        age: Math.max(0, a.elapsed - m.contacts[a.next - 1]),
      });
      continue;
    }
    if (["boom", "cross"].includes(a.move)) {
      const source = point(
          s.avatar.x,
          s.avatar.y + sonicLength(s, 1.8),
          s.avatar.z,
        ),
        target = titanTargetContact(s, source).point;
      const aim = s.lock
        ? point(target.x - source.x, target.y - source.y, target.z - source.z)
        : a.direction;
      const length = Math.hypot(aim.x, aim.y, aim.z) || 1;
      const projectile = {
        ...source,
        vx: (aim.x / length) * 150,
        vy: (aim.y / length) * 150,
        vz: (aim.z / length) * 150,
        life: m.reach / 150,
        kind: a.kind,
        serial: a.serial,
        contact: a.next,
      };
      s.projectiles.push(projectile);
      emit(s, a.move, {
        point: source,
        normal: point(aim.x / length, aim.y / length, aim.z / length),
        serial: a.serial,
      });
      continue;
    }
    const source = point(
        s.avatar.x,
        s.avatar.y + sonicLength(s, 1.8),
        s.avatar.z,
      ),
      previous = point(from.x, from.y + sonicLength(s, 1.8), from.z);
    const c =
      a.move === "loop" && a.orbit
        ? nearestTitanSurface(s, {
            ...a.orbit.from,
            y: a.orbit.from.y + sonicLength(s, 1.8),
          })
        : sweptTitanContact(
            s,
            previous,
            source,
            sonicLength(s, m.reach),
            oldClock,
          );
    let facing = true;
    if (c && !s.lock && a.move !== "loop") {
      const dx = c.point.x - source.x,
        dz = c.point.z - source.z,
        l = Math.hypot(dx, dz);
      facing =
        l < 1 ||
        (-Math.sin(s.avatar.yaw) * dx - Math.cos(s.avatar.yaw) * dz) / l >
          -0.15;
    }
    if (c && facing) {
      if (bossDamage(s, s.config.damage[a.kind], c, a.kind)) {
        a.connected = true;
        if (["punch", "combo", "heavy", "finisher"].includes(a.move))
          s.comboStep = (s.comboStep + 1) % 4;
        if (a.move === "loop" && s.titan !== "wyvern" && s.cyloopHold > 0) {
          s.cyloopHold = Math.min(s.cyloopHold,0.65);
          s.stagger = Math.min(s.stagger,0.65);
          s.idle = Math.min(s.idle,1);
        } else if (a.move === "loop" && s.titan !== "wyvern" && s.staggerRest <= 0 && s.stage === "combat") {
          s.cyloopHold = TITAN_COMBO.liftDuration;
          s.stagger = TITAN_COMBO.liftDuration;
          s.staggerRest = 12;
          s.attack = "idle";
          s.attackTime = 0;
          s.idle = TITAN_COMBO.liftDuration + 0.4;
          emit(s, "stagger");
        }
      }
    } else {
      s.comboStep = 0;
      emit(s, "miss", { kind: a.kind });
    }
  }
  if (a.elapsed >= a.duration && s.strike === a) {
    if (a.move === "loop") s.avatar.vx = s.avatar.vy = s.avatar.vz = 0;
    s.strike = null;
  }
}
function advanceProjectiles(s, dt, oldClock) {
  for (const q of s.projectiles) {
    const from = point(q.x, q.y, q.z),
      travel = Math.min(
        dt,
        q.life,
        q.kind === "shot" ? q.remaining / TITAN_SHOT.speed : Infinity,
      );
    if (q.kind === "shot") {
      steerTitanShot(s, q, travel);
      q.remaining = Math.max(0, q.remaining - TITAN_SHOT.speed * travel);
    }
    q.x += q.vx * travel;
    q.y += q.vy * travel;
    q.z += q.vz * travel;
    q.life -= dt;
    if (q.kind === "shot" && q.remaining <= 1e-5) q.life = 0;
    const c = sweptTitanContact(s, from, q, 0.9, oldClock);
    if (c) {
      q.life = 0;
      bossDamage(s, s.config.damage[q.kind], c, q.kind, q.serial);
    }
    if (s.stage !== "combat") break;
  }
  s.projectiles =
    s.stage === "combat"
      ? s.projectiles.filter((q) => q.life > 0).slice(-8)
      : [];
}
export function chooseTitanAttack(s) {
  const p = s.avatar,
    local = titanLocalPoint(s, p);
  let choices =
    s.phase === 1
      ? ["swing", "slap", "swat", "sweep", "stomp", "pulse", "spin", "uppercut"]
      : [
          "beam",
          "swing",
          "crunch",
          "swat",
          "sweep",
          "stomp",
          "pulse",
          "spin",
          "uppercut",
        ];
  if (s.config.adaptiveBoss === false)
    choices = choices.filter((k) => k !== "pulse");
  choices = choices.filter(
    (k) => k !== "stomp" || (p.y < 18 && Math.hypot(local.x, local.z) < 70),
  );
  choices = choices.filter(
    (k) =>
      k !== "swat" ||
      (nearestTitanSurface(s, p).distance < 18 &&
        distance(
          titanWorldPoint(s, point((local.x >= 0 ? 1 : -1) * 18, 74, -8.5)),
          point(p.x, p.y + sonicLength(s, 1.8), p.z),
        ) < 47),
  );
  choices = choices.filter((k) => k !== "crunch" || titanCanGrab(s, p));
  const recent = s.recentAttacks || [];
  const fresh = choices.filter((k) => !recent.slice(-2).includes(k));
  const pool = fresh.length ? fresh : choices;
  // Stable across fixed-step rates; context and recent moves prevent loops.
  const n = Math.imul(s.sequence + 1, 2654435761) >>> 0;
  const move =
    s.config.adaptiveBoss === false
      ? pool[n % pool.length]
      : chooseTitanTactic(s, pool);
  s.recentAttacks = [...recent, move].slice(-2);
  return move;
}
function parried(s) {
  s.queuedMove = null;
  s.attack = "idle";
  s.attackTime = 0;
  s.idle = 2.8;
  s.stagger = 1.8;
  s.strike = null;
  s.perfectCounter = s.parryAge < 0.22;
  s.counter = 2.4;
  s.action = "parry";
  s.actionTime = 0.7;
  emit(s, "parry", { perfect: s.perfectCounter });
  beginParryHoming(s);
}
function canParry(s) {
  return s.parryHeld && (!s.config.strictParry || s.parryAge < 0.3);
}
function beamHazards(s) {
  const active = titanDorsalState(s).active;
  if (active && !s.dorsalActive) emit(s, "pulse");
  s.dorsalActive = active;
  if (!active) s.dorsalHit = false;
  if (!active || s.iframes > 0 || s.dorsalHit) return;
  const p = point(s.avatar.x, s.avatar.y + sonicLength(s, 1.8), s.avatar.z);
  for (let i = 0; i < 30; i++) {
    const { from, to } = titanDorsalRay(i, s),
      closest = closestSegment(p, from, to);
    // Socket motion is decorative within the proximal 12m. No invisible low
    // rear-quadrant damage or rays extending beyond their visible endpoints.
    if (distance(closest, from) > 12 && distance(p, closest) < 2.5) {
      s.dorsalHit = true;
      if (canParry(s)) parried(s);
      else hurt(s, false, "dorsal");
      break;
    }
  }
}
export function stepTitan(s, input = {}, dt = 1 / 60) {
  if (!Number.isFinite(dt) || dt <= 0) return;
  dt = Math.min(dt, 1 / 30);
  if (TITAN_MOVIES.includes(s.stage)) dt *= cinemaRate(s);
  s.events = [];
  s.boosting = false;
  if (s.knockback) {
    s.knockback.left = Math.max(0, s.knockback.left - dt);
    if (!s.knockback.left) s.knockback = null;
  }
  if(s.stage!=="victory")s.skyClock=(s.skyClock ?? s.time)+dt;
  s.time += dt;
  s.stageTime += dt;
  if (s.stage === "victory") {
    stepTitanReturn(s, input, dt);
    return;
  }
  updateTitanTactics(s, dt, emit);
  for (const e of tickTitanBody(s, dt)) emit(s, "footstep", e);
  for (const k of Object.keys(s.cooldowns))
    s.cooldowns[k] = Math.max(0, s.cooldowns[k] - dt);
  for (const k of [
    "iframes",
    "dodge",
    "stagger",
    "counter",
    "actionTime",
    "pulseCooldown",
    "phantomRest",
    "staggerRest",
  ])
    s[k] = Math.max(0, s[k] - dt);
  tickTitanCombo(s, dt);
  clearSuperCooldowns(s);
  tickTitanTarget(s,dt);
  tickSonicMovement(s,input,dt);
  if (s.actionTime === 0 && !s.strike) s.action = "idle";
  if (input.parry) {
    s.parryAge = s.parryHeld ? s.parryAge + dt : 0;
    s.parryHeld = true;
  } else {
    s.parryHeld = false;
    s.parryAge = 0;
  }
  if (s.stage === "intro") {
    if (s.stageTime >= 4.5) change(s, "traversal");
    return;
  }
  if (s.stage === "transform") {
    tickTransformation(s, emit);
    s.cinematicFrom ||= { ...s.avatar };
    const from = s.cinematicFrom,
      end = titanWorldPoint(s, { x: 0, y: 68, z: 38 }),
      collect = titanWorldPoint(s, {
        x: 0,
        y: titanEmeraldPoint(s, TITAN_EMERALD).y - sonicLength(s, 2.3),
        z: sonicLength(s, 0.8),
      }),
      take = clamp(s.stageTime / 0.55, 0, 1),
      takeEase = take * take * (3 - 2 * take),
      anchor = {
        x: lerp(from.x, collect.x, takeEase),
        y: lerp(from.y, collect.y, takeEase),
        z: lerp(from.z, collect.z, takeEase),
      },
      u = clamp((s.stageTime - 4.45) / 1.55, 0, 1),
      e = u * u * (3 - 2 * u);
    const lift = clamp(u / 0.25, 0, 1),
      travel = clamp((u - 0.25) / 0.4, 0, 1),
      fall = clamp((u - 0.65) / 0.35, 0, 1),
      ease = (v) => v * v * (3 - 2 * v);
    s.avatar.x = lerp(anchor.x, end.x, ease(travel));
    s.avatar.y = lerp(lerp(anchor.y, 104, ease(lift)), 68, ease(fall));
    s.avatar.z = lerp(anchor.z, end.z, ease(travel));
    if (s.stageTime >= 6) startCombat(s);
    return;
  }
  if (s.stage === "phase") {
    if (s.stageTime + 1e-8 >= 4) skipTitanCinematic(s);
    return;
  }
  if (s.stage === "finale") {
    s.cinematicFrom ||= { ...s.avatar };
    Object.assign(
      s.avatar,
      titanFinalePosition(s.cinematicFrom, s.stageTime, s),
      { vx: 0, vy: 0, vz: 0, onGround: false },
    );
    tickTitanFinaleCues(s, emit);
    if (s.stageTime + 1e-8 >= TITAN_FINALE.duration) {
      s.won = true;
      freezeTitanSky(s);
      change(s, "victory");
      openTitanReturn(s);
    }
    return;
  }
  if (!["traversal", "combat"].includes(s.stage)) return;
  if (s.counterScene) {
    advanceTitanCounter(s, dt);
    return;
  }
  if (s.stage === "traversal" && armorMode(s)) {
    collectTitanRings(s);
    const held = advanceArmor(s, input, dt, (type, data) =>
      emit(s, type, data),
    );
    const focus = armorFocus(s),
      emerald = titanWorldPoint(s, titanEmeraldPoint(s, TITAN_EMERALD));
    if (s.route >= 11 && s.avatar.y > 84 && dist(focus, emerald) < 4.8) {
      while (s.route < 12) {
        s.route++;
        if (!s.collected.includes(s.route)) {
          s.collected.push(s.route);
          s.rings = Math.min(s.config.rings, s.rings + 5);
        }
      }
      s.emerald = true;
      s.checkpoint = "combat";
      s.climb.attached = false;
      change(s, "transform");
      emit(s, "emerald");
      if (!s.config.cinematics) startCombat(s);
      return;
    }
    if (held) {
      advanceGrassCyloop(s, input, dt, emit);
      return;
    }
  }
  const p = s.avatar,
    from = { ...p },
    oldClock = s.attackTime;
  if (s.stage === "combat" && s.attack !== "idle" && !s.qte) s.attackTime += dt;
  let x = Number.isFinite(input.moveX)
      ? input.moveX
      : +!!input.right - +!!input.left,
    z = Number.isFinite(input.moveY)
      ? input.moveY
      : +!!input.forward - +!!input.back,
    length = Math.hypot(x, z);
  if (length > 1 || (length && !Number.isFinite(input.moveX))) {
    x /= length;
    z /= length;
  }
  const yaw = p.yaw,
    boost = !!input.boost,
    speed = boost ? (s.stage === "combat" ? sonicHandling(s).flightBoost : sonicHandling(s).boost) : (s.stage === "combat" ? sonicHandling(s).flight : sonicHandling(s).run),
    dx = x * Math.cos(yaw) - z * Math.sin(yaw),
    dz = -x * Math.sin(yaw) - z * Math.cos(yaw),
    acc = 1 - Math.exp(-dt * (s.stage === "combat" ? 7 : p.onGround ? 18 : 12));
  s.boosting = !!(
    boost &&
    (length > 0 || (s.stage === "combat" && (input.up || input.down))) &&
    !s.qte &&
    !s.knockback &&
    s.strike?.move !== "loop"
  );
  p.vx = lerp(p.vx, dx * speed, acc);
  p.vz = lerp(p.vz, dz * speed, acc);
  if (s.dodge > 0) {
    const side = x || (!length ? 1 : 0),
      fwd = z;
    p.vx += (side * Math.cos(yaw) - fwd * Math.sin(yaw)) * dt * 180;
    p.vz += (-side * Math.sin(yaw) - fwd * Math.cos(yaw)) * dt * 180;
  }
  if (s.stage === "traversal") {
    collectTitanRings(s);
    const pulsePhase = s.time % 6;
    if (
      !armorMode(s) &&
      p.z < -12 &&
      p.y > 30 &&
      p.y < 75 &&
      pulsePhase > 4 &&
      pulsePhase < 4.5 &&
      (s.pulseCooldown || 0) <= 0
    ) {
      const radius = Math.max(1, Math.hypot(p.x, p.z));
      p.vx += (p.x / radius) * 14;
      p.vz += (p.z / radius) * 14;
      p.vy = Math.max(p.vy, 4);
      s.pulseCooldown = 2;
      emit(s, "pulse");
    }
    const oldY = p.y;
    const gravity=applySonicTraversal(s,input,dt,(type,data)=>emit(s,type,data));
    p.vy -= 26 * dt*gravity;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.z += p.vz * dt;
    p.onGround = false;
    const surfaces = [
      { x: 0, y: 0, z: 0, w: 360 },
      ...(armorMode(s) ? [] : TITAN_ROUTE.slice(1)),
    ];
    for (const q of surfaces)
      if (
        p.vy <= 0 &&
        oldY >= q.y - 0.01 &&
        p.y <= q.y &&
        Math.abs(p.x - q.x) < q.w / 2 + 0.3 &&
        Math.abs(p.z - q.z) < q.w / 2 + 0.3
      ) {
        p.y = q.y;
        p.vy = 0;
        p.onGround = true;
      }
    sweepTitanMotion(s,from,q=>constrainBoxes(q,titanBoulderBounds(),sonicCollider(s).radius,sonicCollider(s).height,from.y>=-0.1&&Math.abs(q.x)<180&&Math.abs(q.z)<180?0:-Infinity));
    const next = TITAN_ROUTE[s.route + 1];
    if (
      !armorMode(s) &&
      next &&
      p.onGround &&
      Math.abs(p.y - next.y) < 0.2 &&
      dist(p, next) < 8
    ) {
      s.route++;
      emit(s, "checkpoint");
      if (!s.collected.includes(s.route)) {
        s.collected.push(s.route);
        s.rings = Math.min(s.config.rings, s.rings + 5);
        emit(s, "ring", { count: 5 });
      }
    }
    if (
      !armorMode(s) &&
      s.route >= TITAN_ROUTE.length - 1 &&
      dist({ ...p, y: p.y + 1 }, TITAN_EMERALD) < 5
    ) {
      s.emerald = true;
      s.checkpoint = "combat";
      change(s, "transform");
      emit(s, "emerald");
      if (!s.config.cinematics) startCombat(s);
    }
    const bodyRadius = Math.hypot(p.x, p.z);
    if (!armorMode(s) && p.y < 88 && bodyRadius < 18) {
      const a = Math.atan2(p.x, p.z);
      p.x = Math.sin(a) * 18;
      p.z = Math.cos(a) * 18;
    }
    if (armorMode(s)) {
      collideArmor(s);
      advanceGrassCyloop(s, input, dt, emit);
      if (p.y < -0.2 || Math.hypot(p.x, p.z) > 175) {
        if (!recoverArmor(s, (type, data) => emit(s, type, data)))
          Object.assign(p, {
            x: 0,
            y: 0.05,
            z: 78,
            vx: 0,
            vy: 0,
            vz: 0,
            onGround: true,
          });
      }
      return;
    }
    const safePad = TITAN_ROUTE[s.route];
    advanceGrassCyloop(s, input, dt, emit);
    const missedPad =
      s.route > 0 &&
      ((p.onGround && p.y < safePad.y - 0.25) || p.y < safePad.y - 12);
    if (p.y < -0.2 || Math.hypot(p.x, p.z) > 175 || missedPad) {
      const q = TITAN_ROUTE[s.route];
      Object.assign(p, { x: q.x, y: q.y + 0.1, z: q.z, vx: 0, vy: 0, vz: 0 });
      emit(s, "return-pad");
    }
    return;
  }
  if (s.qte) {
    s.qte.left -= dt;
    p.vx = p.vy = p.vz = 0;
    if (s.qte.kind === "crunch") {
      s.qte.from ||= { ...p };
      const at = titanWorldPoint(s, point(0, 82, 29)),
        u = clamp((4.2 - s.qte.left) / 0.65, 0, 1),
        w = u * u * (3 - 2 * u);
      p.x = lerp(s.qte.from.x, at.x, w);
      p.y = lerp(s.qte.from.y, at.y - sonicLength(s, 1.8), w);
      p.z = lerp(s.qte.from.z, at.z, w);
    }
    if (s.qte.hits >= s.qte.need) {
      const kind = s.qte.kind;
      s.qte = null;
      s.attack = "idle";
      s.stagger = 3;
      s.idle = 3.5;
      s.attackTime = 0;
      s.strike = null;
      s.projectiles = [];
      s.knockback = null;
      s.boosting = false;
      s.counterScene = makeTitanCounter(
        s,
        kind,
        nearestTitanSurface(s, { ...p, y: p.y + sonicLength(s, 1.8) }),
      );
      s.action = "cinematic_counter";
      s.actionTime = TITAN_COUNTER.duration;
      emit(s, "qte-win");
      if (!s.config.cinematics) {
        landTitanCounter(s, s.counterScene);
        s.counterScene = null;
        s.action = "idle";
        s.actionTime = 0;
      }
    } else if (s.qte.left <= 0) {
      const thrown = s.qte.kind === "crunch";
      s.qte = null;
      s.attack = "idle";
      s.idle = 3.5;
      s.attackTime = 0;
      s.rings = Math.max(
        0,
        s.rings - titanBossImpact(s, thrown ? "crunch" : "beam").ringLoss,
      );
      s.iframes = 2;
      s.action = "hurt";
      s.queuedMove = null;
      s.actionTime = 1;
      if (thrown) {
        const root = titanWorldPoint(s, point(0, 0, -7.5)),
          dx = p.x - root.x,
          dz = p.z - root.z,
          r = Math.hypot(dx, dz) || 1;
        s.knockback = {
          x: (dx / r) * 65,
          y: 18,
          z: (dz / r) * 65,
          left: 0.85,
          duration: 0.85,
        };
        emit(s, "grab-throw", { point: sonicContact(s, p) });
      }
      emit(s, "qte-miss");
      if (s.rings <= 0) {
        change(s, "defeat");
        emit(s, "defeat");
      }
    }
    return;
  }
  s.rings = Math.max(
    0,
    s.rings -
      dt *
        s.config.drain *
        { easy: 0.65, normal: 1, hard: 1.3 }[s.config.difficulty],
  );
  if (s.rings <= 0) {
    change(s, "defeat");
    emit(s, "defeat");
    return;
  }
  p.vy = lerp(p.vy, (+!!input.up - +!!input.down) * speed, acc);
  approachTitanMelee(s, titanTargetContact(s, sonicContact(s)), dt);
  if (s.strike && ["stomp", "cyclone", "cross"].includes(s.strike.move)) {
    const q = techniquePosition(s, s.strike, s.strike.elapsed + dt);
    if (q) {
      p.vx = (q.x - p.x) / dt;
      p.vy = (q.y - p.y) / dt;
      p.vz = (q.z - p.z) / dt;
    }
  }
  if (s.strike?.move === "rush" && s.strike.rushPath) {
    const v = titanRushVelocity(
      s,
      s.strike.rushPath,
      s.strike.elapsed + dt,
      dt,
    );
    if (v) {
      p.vx = p.vx * 0.2 + v.x * 0.8;
      p.vy = p.vy * 0.2 + v.y * 0.8;
      p.vz = p.vz * 0.2 + v.z * 0.8;
    }
  }
  steerTitanHoming(s,dt,emit);
  if (s.strike?.move === "loop" && s.strike.orbit) {
    const elapsed = s.strike.elapsed + dt,
      q = titanCyloopPosition(s.strike.orbit, elapsed);
    p.vx = (q.x - p.x) / dt;
    p.vy = (q.y - p.y) / dt;
    p.vz = (q.z - p.z) / dt;
    p.x = q.x;
    p.y = q.y;
    p.z = q.z;
    p.onGround = false;
    if (elapsed >= TITAN_CYLOOP.approach && elapsed <= TITAN_CYLOOP.contact)
      s.iframes = Math.max(s.iframes, 0.1);
  } else {
    if (s.knockback) {
      const k = s.knockback,
        w = k.left / k.duration;
      p.vx = dx * speed * (1 - w * 0.65) + k.x * w;
      p.vz = dz * speed * (1 - w * 0.65) + k.z * w;
      p.vy = (+!!input.up - +!!input.down) * speed * (1 - w * 0.65) + k.y * w;
    }
    p.x += p.vx * dt;
    p.y = clamp(p.y + p.vy * dt, 0.05, 130);
    p.z += p.vz * dt;
    p.onGround = p.y <= 0.051;
  }
  sweepTitanMotion(s,from,(q,regions)=>{constrainTitanBody(q,s,regions);constrainBoxes(q,titanBoulderBounds(),sonicCollider(s).radius,sonicCollider(s).height,from.y>=-0.1&&Math.abs(q.x)<180&&Math.abs(q.z)<180?0:-Infinity);});
  const r = Math.hypot(p.x, p.z);
  if (r > 145) {
    p.x *= 145 / r;
    p.z *= 145 / r;
  }
  advanceProjectiles(s, dt, oldClock);
  if (s.stage !== "combat") return;
  advanceStrike(s, from, dt, oldClock);
  if (s.stage !== "combat") return;
  const queued = takeTitanMove(s);
  if (queued) titanInput(s, queued);
  beamHazards(s, dt);
  if (input.hit) titanInput(s, "hit", true);
  if (s.attack === "idle") {
    if (s.tactics?.guard > 0) return;
    if (s.boss.walk) return;
    s.idle -= dt;
    if (s.idle <= 0) {
      if (
        s.sequence > 0 &&
        (s.tactics?.retaliation || 0) <= 0 &&
        s.sequence % 3 === 0 &&
        s.boss.steps < Math.floor(s.sequence / 3) &&
        beginTitanStep(s)
      ) {
        // Re-enabling movement must not replay cycles skipped while disabled.
        s.boss.steps = Math.floor(s.sequence / 3);
        emit(s, "reposition");
        return;
      }
      s.attack = chooseTitanAttack(s);
      s.sequence++;
      s.swatSide = titanLocalPoint(s, p).x >= 0 ? "L" : "R";
      s.released = false;
      s.attackTime = 0;
      s.hitDone = false;
      s.stompReleased = false;
      s.sweepFollowup = false;
      s.sweepConsumed = 0;
      s.sweepDamaged = false;
      s.attackAim = point(p.x, p.y, p.z);
      emit(s, "telegraph", { move: s.attack });
    }
    return;
  }
  const m = TITAN_MOVES[s.attack],
    scale = { easy: 1.25, normal: 1, hard: 0.85 }[s.config.difficulty],
    tell = m.tell * scale;
  if (
    !s.released &&
    s.attackAim &&
    s.attackTime < Math.max(0, Math.min(tell * 0.5, tell - 0.55))
  ) {
    const follow = 1 - Math.exp(-dt * 5);
    for (const k of ["x", "y", "z"])
      s.attackAim[k] = lerp(s.attackAim[k], p[k], follow);
  }
  if (!s.released && s.attackTime >= tell) {
    s.released = true;
    emit(s, "boss-release", { move: s.attack });
  }
  if (s.attack === "sweep") {
    if (!s.sweepFollowup && s.attackTime >= titanSweepHand(s, "R").start) {
      s.sweepFollowup = true;
      emit(s, "boss-followup", {
        move: "sweep",
        side: "R",
        point: titanArmPath(s, "R"),
      });
    }
    if (!s.sweepDamaged) {
      for (const [side, bit] of [
        ["L", 1],
        ["R", 2],
      ]) {
        if ((s.sweepConsumed || 0) & bit) continue;
        if (titanSweepTouches(s, side, from, p, oldClock)) {
          s.sweepConsumed = (s.sweepConsumed || 0) | bit;
          if (canParry(s)) {
            parried(s);
            break;
          }
          if (hurt(s, true)) {
            s.sweepDamaged = true;
            break;
          }
        }
      }
    }
  }
  if (
    s.attack !== "idle" &&
    s.attack !== "sweep" &&
    !s.hitDone &&
    s.attackTime >= tell &&
    oldClock <= tell + m.strike
  ) {
    const aim = s.attackAim || point(p.x, p.y, p.z);
    if (s.attack === "pulse") {
      const wave = titanPulse(s),
        old = titanPulse(s, oldClock),
        radial = Math.hypot(p.x - wave.center.x, p.z - wave.center.z),
        before = Math.hypot(from.x - wave.center.x, from.z - wave.center.z);
      if (
        wave.active &&
        Math.abs(p.y - wave.center.y) < 5 &&
        Math.min(radial - wave.radius, before - old.radius) <= 3 &&
        Math.max(radial - wave.radius, before - old.radius) >= -3
      ) {
        s.hitDone = true;
        if (canParry(s) && s.parryAge < 0.3) parried(s);
        else hurt(s, true);
      }
    } else if (s.attack === "spin") {
      let contact = false;
      for (let i = 0; i <= 8; i++) {
        const t = i / 8,
          clock = oldClock + (s.attackTime - oldClock) * t,
          base = s.boss?.previous || s.boss,
          proposal = {
            ...s,
            attackTime: clock,
            boss: {
              ...s.boss,
              x: (base.x || 0) + ((s.boss.x || 0) - (base.x || 0)) * t,
              z: (base.z || 0) + ((s.boss.z || 0) - (base.z || 0)) * t,
            },
          },
          body = point(
            lerp(from.x, p.x, t),
            lerp(from.y, p.y, t) + sonicLength(s, 1.8),
            lerp(from.z, p.z, t),
          );
        for (const side of ["L", "R"]) {
          const regions = titanBodyRegions(proposal, clock),
            r = regions.find((r) => r.id === side + " forearm");
          if (distance(body, closestSegment(body, r.a, r.b)) < 8)
            contact = true;
        }
      }
      if (contact) {
        s.hitDone = true;
        if (canParry(s)) parried(s);
        else hurt(s, true);
      }
    } else if (s.attack === "beam") {
      s.hitDone = true;
      const mouth = titanWorldPoint(s, point(0, 85, 18)),
        end = point(aim.x, aim.y + sonicLength(s, 1.8), aim.z);
      const gap = distance(
        point(p.x, p.y + sonicLength(s, 1.8), p.z),
        closestSegment(point(p.x, p.y + sonicLength(s, 1.8), p.z), mouth, end),
      );
      if (gap < 6 && distance(p, mouth) < 110 && s.iframes <= 0) {
        s.queuedMove = null;
        s.qte = {
          kind: "beam",
          left: 4.5,
          need: { easy: 8, normal: 12, hard: 16 }[s.config.difficulty],
          hits: 0,
        };
        emit(s, "beam");
      } else emit(s, "beam-miss", { point: end });
    } else if (s.attack === "crunch") {
      s.hitDone = true;
      if (distance(p, aim) < 10 && titanGrabTouches(s, p)) {
        if (canParry(s)) parried(s);
        else if (s.iframes <= 0) {
          s.queuedMove = null;
          s.qte = {
            kind: "crunch",
            from: { ...p },
            left: 4.2,
            need: { easy: 8, normal: 11, hard: 14 }[s.config.difficulty],
            hits: 0,
          };
          emit(s, "grab");
        }
      }
    } else if (s.attack === "stomp") {
      const wave = titanStompWave(s);
      if (wave.active && !s.stompReleased) {
        s.stompReleased = true;
        emit(s, "stomp", { point: wave.center });
      }
      const radial = Math.hypot(p.x - wave.center.x, p.z - wave.center.z),
        oldRadial = Math.hypot(from.x - wave.center.x, from.z - wave.center.z),
        oldWave = titanStompWave(s, oldClock);
      if (
        wave.active &&
        Math.min(p.y, from.y) < 6 &&
        Math.min(radial - wave.radius, oldRadial - oldWave.radius) <= 3 &&
        Math.max(radial - wave.radius, oldRadial - oldWave.radius) >= -3
      ) {
        s.hitDone = true;
        if (canParry(s)) parried(s);
        else hurt(s, true);
      }
    } else {
      for (const side of s.attack === "sweep"
        ? ["L", "R"]
        : [titanAttackSide(s)]) {
        const before = titanBodyRegions(
            s,
            Math.max(oldClock, tell),
            s.boss.previous,
          ).find((q) => q.id === side + " forearm"),
          after = titanBodyRegions(s).find((q) => q.id === side + " forearm");
        let contact = false;
        for (let sample = 0; sample <= 4; sample++) {
          const t = sample / 4,
            a = point(
              lerp(before.a.x, after.a.x, t),
              lerp(before.a.y, after.a.y, t),
              lerp(before.a.z, after.a.z, t),
            ),
            b = point(
              lerp(before.b.x, after.b.x, t),
              lerp(before.b.y, after.b.y, t),
              lerp(before.b.z, after.b.z, t),
            ),
            body = point(
              lerp(from.x, p.x, t),
              lerp(from.y, p.y, t) + sonicLength(s, 1.8),
              lerp(from.z, p.z, t),
            );
          if (distance(body, closestSegment(body, a, b)) < 9) contact = true;
        }
        if (contact) {
          s.hitDone = true;
          if (canParry(s)) parried(s);
          else hurt(s, s.attack === "swat");
          break;
        }
      }
    }
  }
  if (s.attack !== "idle" && s.attackTime >= tell + m.strike) {
    s.attack = "idle";
    s.attackTime = 0;
    s.idle = titanRecovery(s, m.recover);
  }
}
function landTitanCounter(s, c) {
  if (c.landed) return;
  c.landed = true;
  bossDamage(s, c.damage, titanCounterContact(s, c), "struggle", c.serial);
}
function advanceTitanCounter(s, dt) {
  const c = s.counterScene;
  c.elapsed = Math.min(TITAN_COUNTER.duration, c.elapsed + dt);
  Object.assign(s.avatar, titanCounterPosition(s, c), {
    vx: 0,
    vy: 0,
    vz: 0,
    onGround: false,
  });
  s.iframes = Math.max(s.iframes, 0.2);
  s.boosting = false;
  if (!c.launched && c.elapsed >= TITAN_COUNTER.launch) {
    c.launched = true;
    emit(s, "cinematic-cue", {
      cinematic: "counter",
      cue: "launch",
      kind: c.kind,
    });
  }
  if (c.elapsed >= TITAN_COUNTER.impact) landTitanCounter(s, c);
  if (s.counterScene && c.elapsed >= TITAN_COUNTER.duration) {
    s.counterScene = null;
    s.action = "idle";
    s.actionTime = 0;
    s.iframes = 1;
    s.idle = 3.5;
    s.stagger = 3;
    emit(s, "counter-end");
  }
}
export function restoreTitanSession(raw) {
  if (
    !raw ||
    raw.schema !== 1 ||
    typeof raw.id !== "string" ||
    raw.id.length > 150 ||
    !raw.original ||
    ![
      "intro",
      "traversal",
      "transform",
      "combat",
      "phase",
      "finale",
      "victory",
      "defeat",
    ].includes(raw.stage)
  )
    return null;
  const c = upgradeTitanCombat(raw.config);
  if (!c.climbMode && ["intro", "traversal"].includes(raw.stage))
    c.climbMode = "ruins";
  const s = titanSession(c, raw.id);
  s.cinemaRate = Number.isFinite(raw.cinemaRate)
    ? Math.max(0.4, Math.min(1, raw.cinemaRate))
    : 1;
  s.original = raw.original;
  if (
    raw.boss &&
    [raw.boss.x, raw.boss.z, raw.boss.yaw].every(Number.isFinite)
  ) {
    s.boss.x = clamp(raw.boss.x, -32, 32);
    s.boss.z = clamp(raw.boss.z, -32, 32);
    const radius = Math.hypot(s.boss.x, s.boss.z);
    if (radius > 32) {
      s.boss.x *= 32 / radius;
      s.boss.z *= 32 / radius;
    }
    s.boss.yaw = Math.atan2(Math.sin(raw.boss.yaw), Math.cos(raw.boss.yaw));
  }
  for (const k of ["stage", "checkpoint"])
    if (raw[k] !== undefined) s[k] = raw[k];
  for (const k of ["emerald", "won", "lock"])
    if (typeof raw[k] === "boolean") s[k] = raw[k];
  for (const [k, a, b] of [
    ["route", 0, 12],
    ["stageTime", 0, 1e7],
    ["time", 0, 1e7],
    ["phase", 1, 2],
    ["maxHp", 100, TITAN_HEALTH.hard * 2],
    ["hp", 0, TITAN_HEALTH.hard * 2],
    ["preparedRings", 0, 999],
    ["rings", 0, 999],
    ["sequence", 0, 1e7],
  ])
    if (Number.isFinite(raw[k])) s[k] = clamp(raw[k], a, b);
  if (Number.isFinite(raw.phaseStartedAt))
    s.phaseStartedAt = clamp(raw.phaseStartedAt, 0, s.time);
  if (s.stage === "transform")
    s.transformCues = TRANSFORM_EVENTS.reduce(
      (mask, [, at], i) => mask | (s.stageTime >= at ? 1 << i : 0),
      0,
    );
  if (raw.tactics) {
    for (const [k, max] of [
      ["pressure", 2],
      ["chain", 99],
      ["guard", 1.25],
      ["guardCooldown", 12],
      ["retaliation", 4],
      ["camp", 8],
    ])
      if (Number.isFinite(raw.tactics[k]))
        s.tactics[k] = clamp(raw.tactics[k], 0, max);
    if (Number.isFinite(raw.tactics.lastHit))
      s.tactics.lastHit = Math.min(s.time, Math.max(-100, raw.tactics.lastHit));
  }
  s.ringPickups = Array.isArray(raw.ringPickups)
    ? [
        ...new Set(
          raw.ringPickups.filter(
            (n) =>
              Number.isInteger(n) && n >= 0 && n < TITAN_RING_TRAILS.length,
          ),
        ),
      ]
    : [];
  // Upgrade an in-progress legacy encounter by preserving its health fraction.
  if (raw.balance !== TITAN_BALANCE) {
    const ratio = s.maxHp > 0 ? s.hp / s.maxHp : 1;
    s.maxHp = TITAN_HEALTH[s.config.difficulty] * s.config.healthMultiplier;
    s.hp = Math.max(0, s.maxHp * ratio);
  }
  s.balance = TITAN_BALANCE;
  restoreTitanCombo(s, raw);
  s.grassCyloop = restoreGrassCyloop(raw.grassCyloop);
  const music = raw.battleMusic;
  if (
    Number.isFinite(raw.preludeMusic?.offset) &&
    raw.preludeMusic.offset >= 0 &&
    raw.preludeMusic.offset <= 900
  )
    s.preludeMusic = { offset: raw.preludeMusic.offset };
  if (
    music &&
    ["phaseOne", "phaseTwo", "transition", "finale"].includes(music.section) &&
    Number.isFinite(music.offset) &&
    music.offset >= 0 &&
    music.offset <= 900
  )
    s.battleMusic = {
      section: music.section,
      offset: music.offset,
      ...(typeof music.track === "string" &&
      /^(supplied|titan:[\w-]{1,80})$/.test(music.track)
        ? { track: music.track }
        : {}),
    };
  if (raw.cinematicFrom && ["transform", "finale"].includes(s.stage)) {
    s.cinematicFrom = Object.fromEntries(
      ["x", "y", "z"].map((k) => [
        k,
        Number.isFinite(raw.cinematicFrom[k])
          ? clamp(raw.cinematicFrom[k], -180, 180)
          : s.avatar[k],
      ]),
    );
  }
  s.boss.steps = Math.floor(s.sequence / 3);
  s.recentAttacks = Array.isArray(raw.recentAttacks)
    ? raw.recentAttacks.filter((k) => TITAN_MOVES[k]).slice(-2)
    : [];
  s.route = Math.floor(s.route);
  s.phase = Math.floor(s.phase);
  s.hp = Math.min(s.hp, s.maxHp);
  s.collected = Array.isArray(raw.collected)
    ? [
        ...new Set(
          raw.collected.filter((n) => Number.isInteger(n) && n > 0 && n <= 12),
        ),
      ]
    : [];
  for (const k of ["x", "y", "z", "yaw", "pitch"])
    if (Number.isFinite(raw.avatar?.[k]))
      s.avatar[k] = clamp(
        raw.avatar[k],
        k === "y" ? -1 : -180,
        k === "y" ? 131 : 180,
      );
  for (const k of Object.keys(s.cooldowns)) {
    const maximum =
      k === "hit"
        ? 0.55
        : k === "dodge"
          ? 0.85
          : TITAN_ACTIONS[k]?.cooldown || 0;
    if (Number.isFinite(raw.cooldowns?.[k]))
      s.cooldowns[k] = clamp(raw.cooldowns[k], 0, maximum);
  }
  if (s.stage === "combat") {
    s.attack = "idle";
    s.idle = 3;
    s.iframes = 2;
    s.qte = null;
  }
  if (!["traversal", "combat", "phase2"].includes(s.checkpoint))
    s.checkpoint = "traversal";
  if (s.stage === "combat") {
    s.counterScene = restoreTitanCounter(
      s,
      raw.counterScene && raw.balance !== TITAN_BALANCE
        ? {
            ...raw.counterScene,
            damage: Number.isFinite(raw.counterScene.damage)
              ? (raw.counterScene.damage * s.config.damage.struggle) /
                (raw.config?.damage?.struggle || 300)
              : s.config.damage.struggle,
          }
        : raw.counterScene,
    );
    if (s.counterScene) {
      s.strikeSerial = Math.max(s.strikeSerial, s.counterScene.serial);
      s.action = "cinematic_counter";
      s.actionTime = TITAN_COUNTER.duration - s.counterScene.elapsed;
      s.stagger = 3;
    }
  }
  if (s.stage === "finale") s.finaleCues = elapsedFinaleCues(s.stageTime);
  if (s.stage === "traversal" && armorMode(s))
    s.climb = restoreArmorState(s, raw.climb);
  if (s.stage === "victory") {
    freezeTitanSky(s, raw.defeatSky);
    openTitanReturn(s, raw.returnPortal);
  }
  const oldSkyCycle=Number.isFinite(raw.config?.arenaDayLength)?raw.config.arenaDayLength:240;
  s.skyClock=Number.isFinite(raw.skyClock)?clamp(raw.skyClock,0,1e9):s.time*s.config.arenaDayLength/Math.max(1,oldSkyCycle);
  restoreSonicMovement(s,raw);restoreSonicTraversal(s,raw);
  return s;
}

// Shared, contact-timed Sonic attacks used by both Titan encounters.
export { advanceStrike, advanceProjectiles };
