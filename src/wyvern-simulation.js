import {steerTitanHoming} from './titan-homing.js';
import {resolveWyvernPlatforms} from "./wyvern-platforms.js";
import {ribbonSurface} from "./wyvern-ribbon.js";
import {sonicTraversalInput,applySonicTraversal,restoreSonicTraversal,startSonicTraversalDash} from "./sonic-traversal.js";
import {sweepTitanMotion} from "./titan-collision.js";
import { sonicJump, tickSonicMovement, clearSuperCooldowns, restoreSonicMovement } from "./sonic-movement.js";
import { wyvernFloor, WYVERN_LIMITS, advectWyvernAvatar, wyvernWorldPoint, wyvernLocalPoint, constrainWyvernScenery } from "./wyvern-world.js";
import { tickTitanCombo, breakTitanCombo, restoreTitanCombo } from "./titan-combo.js";
import {
  titanSession,
  titanConfig,
  titanInput,
  beginParryHoming,
  restoreTitanSession,
  advanceStrike,
  advanceProjectiles,
} from "./giganto-simulation.js";
import { nearestTitanSurface, constrainTitanBody } from "./titan-contact.js";
import { approachTitanMelee, techniquePosition } from "./titan-advanced.js";
import { titanRushVelocity } from "./titan-rush.js";
import { titanCyloopPosition, TITAN_CYLOOP } from "./titan-cyloop.js";
import { takeTitanMove } from "./titan-chain.js";
import {
  advanceGrassCyloop,
  restoreGrassCyloop,
} from "./titan-grass-cyloop.js";
import { tickTransformation } from "./titan-transformation.js";
import { openTitanReturn, stepTitanReturn } from "./titan-return.js";
import {
  WYVERN_CINEMA,
  WYVERN_QTE,
  WYVERN_QTE_STAGES,
  wyvernCinemaPoint,
  wyvernFlightFrame,
} from "./wyvern-choreography.js";
import {
  clamp,
  ease,
  WYVERN_TOWER,
  WYVERN_GAPS,
  WYVERN_REST_LIFT,
  WYVERN_APPROACH,
  TOWER,
  runwayPoint,
  wyvernGround,
  wyvernBattleRing,
  W_HEAD,
  WYVERN_SCALE,
  wyvernPoint,
  WYVERN_RAIL_LENGTH,
  WYVERN_RING_SPACING,
} from "./wyvern-space.js";
export const WYVERN_HEALTH = { easy: 137500, normal: 220000, hard: 302500 };
export {WYVERN_GAPS} from "./wyvern-space.js";
export const WYVERN_HAZARDS = Array.from({ length: 16 }, (_, i) => ({
  id: i,
  t: ((55 + i * 26) * WYVERN_RAIL_LENGTH) / 480,
  lane: (i % 3) - 1,
}));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
export function wyvernSession(config = {}, id = "wyvern:trial") {
  const s = titanSession(
    {
      ...config,
      climbMode: "ruins",
      colossalScale: false,
      bossMobility: false,
    },
    id,
  );
  s.titan = "wyvern";
  s.maxHp = s.hp =
    WYVERN_HEALTH[s.config.difficulty] * s.config.healthMultiplier;
  Object.assign(s.avatar, {
    x: -34,
    y: wyvernGround(-34, 70) + 0.05,
    z: 70,
    yaw: 0.6,
    pitch: 0.06,
  });
  s.wyvern = {
    section: "tower",
    trackVersion: 2,
    towerVersion: 3,
    ribbonVersion: 4,
    routeVersion: 4,
    routeDistance: 0,
    routeSpeed: 0,
    cinemaLift: 0,
    railSpeed: 0,
    laneSpeed: 0,
    tower: 0,
    rail: 0,
    lane: 0,
    gate: 0,
    air: 0,
    slow: 0,
    hitHazards: [],
    ringIds: [],
    open: 0,
    cycle: 0,
    mode: "missiles",
    timer: 1.4,
    slash: 0,
    yaw: 0,
    missiles: [],
    laserClock: 0,
    lasers: [],
    loopExtended: false,
    finaleStarted: false,
    slamDone: false,
    finaleCues: 0,
    skyFreeze: null,
    musicTime: 0,
    flightTime: 0,
    pursuit: 0,
    counterUsed: false,
    counterCues: 0,
    parryUsed: false,
    parrySlow: 0,
    flickAge: 1,
    timeScale: 1,
  };
  s.boss.x = s.boss.z = s.boss.yaw = 0;
  s.lock = true;
  return s;
}
function emit(s, type, data = {}) {
  s.events.push({
    type,
    ...data,
    at: s.time,
    eventId: `${s.id}:${s.attempt || 0}:${(s.eventSerial = (s.eventSerial || 0) + 1)}`,
  });
}
function stage(s, type) {
  s.stage = type;
  s.stageTime = 0;
  s.strike = null;
  s.queuedMove = null;
  s.projectiles = [];
  s.counterScene = null;
  s.action = "idle";
  s.actionTime = 0;
  s.avatar.vx = s.avatar.vy = s.avatar.vz = 0;
  emit(s, "stage", { stage: type });
}
function hurt(s, loss = 18) {
  if (
    s.iframes > 0 ||
    s.dodge > 0 ||
    !["traversal", "combat"].includes(s.stage)
  )
    return false;
  s.rings = Math.max(0, s.rings - loss * (s.config.bossPower || 1));
  s.iframes = 1.1;
  s.action = "hurt";
  s.actionTime = 0.5;
  s.strike = null;
  s.queuedMove = null;
  breakTitanCombo(s);
  s.wyvern.slow = 1;
  s.avatar.vz += 15;
  emit(s, "impact", { point: { ...s.avatar }, strength: 1.1 });
  if (s.emerald && s.rings <= 0) stage(s, "defeat");
  return true;
}
export function wyvernParryWindow(s) {
  return s.config.strictParry ? 0.3 : {easy:0.65,normal:0.55,hard:0.45}[s.config.difficulty];
}
function parries(s) {
  return s.parryHeld && !s.wyvern.parryUsed && s.parryAge <= wyvernParryWindow(s);
}
function successfulParry(s) {
  s.perfectCounter = s.parryAge < 0.16;
  s.wyvern.parryUsed = true;
  s.wyvern.parrySlow = 0.46;
  s.wyvern.flickAge = 0;
  s.strike = null;
  s.queuedMove = null;
  s.action = "parry";
  s.actionTime = 0.2;
  emit(s, "parry", {point:{...s.avatar}, style:"flick", perfect:s.parryAge<0.16});
}
function failQte(s) {
  s.rings = Math.max(1, s.rings - 10);
  s.qte.age = 0;
  s.qte.hits = 0;
  s.qte.left = 6;
  s.qte.lastTap = -10;
  emit(s, "qte-miss");
}
function qte(s, kind) {
  s.qte = {
    kind,
    hits: 0,
    need: kind === "mash" ? 16 : 1,
    left: 6,
    age: 0,
    lastTap: -10,
  };
}
export function wyvernInput(s, action, held = false) {
  if (action === "retry" && s.stage === "defeat") {
    const original = s.original,
      prepared = s.preparedRings,
      phase = s.config.checkpoints ? s.checkpoint : "traversal",
      attempt = (s.attempt || 0) + 1,
      oldConfig = s.config,
      id = s.id;
    Object.assign(s, wyvernSession(oldConfig, id), { original, attempt });
    s.preparedRings = prepared;
    if (phase !== "traversal") {
      s.emerald = true;
      s.phase = phase === "phase2" ? 2 : 1;
      s.wyvern.yaw = Math.PI;
      s.wyvern.flightTime = s.phase === 2 ? 90 : 6;
      s.wyvern.routeDistance=s.phase===2 ? 96*90 : 0;
      s.hp = s.phase === 2 ? s.maxHp * 0.5 : s.maxHp;
      s.checkpoint = phase;
      s.rings = Math.min(s.config.rings, Math.max(220, prepared || 0));
      stage(s, "combat");
      Object.assign(s.avatar, { x: 0, y: 65, z: 560, onGround: false, yaw: 0 });
    }
    return true;
  }
  if (s.qte && ["jump", "hit"].includes(action)) {
    if (s.time - s.qte.lastTap < 0.075) return false;
    s.qte.lastTap = s.time;
    if (s.qte.kind === "timing") {
      const u = (s.qte.age % WYVERN_QTE.period) / WYVERN_QTE.period;
      if (u >= WYVERN_QTE.low && u <= WYVERN_QTE.high) {
        s.qte.hits = 1;
        emit(s, "parry", { point: { ...s.avatar } });
      } else failQte(s);
    } else {
      s.qte.hits++;
      emit(s, "struggle");
    }
    return true;
  }
  if (s.stage === "traversal") {
    const w = s.wyvern,
      p = s.avatar;
    if(w.section==='runway'&&action==='jump'){
      if(!sonicJump(s,15))return false;w.air=1.25;emit(s,'jump');return true;
    }
    if(w.section==='runway'&&action==='homing'){
      const gate=WYVERN_GAPS.findIndex(t=>Math.abs(t-w.rail)<21);
      if(gate>=0&&w.gate<=gate){
        w.gate=gate+1;w.air=1.25;s.jumpAge=0;p.onGround=false;
        startSonicTraversalDash(s,[{...runwayPoint(WYVERN_GAPS[gate]+24),y:runwayPoint(WYVERN_GAPS[gate]+24).y+2}]);
        s.action='homing';s.actionTime=0.65;emit(s,'homing');return true;
      }
    }
    if (
      w.section === "tower" &&
      ["homing", "climb"].includes(action) &&
      distance(p, WYVERN_TOWER.at(-1)) < 13
    ) {
      w.section = "boarding";
      w.boardFrom = { x: p.x, y: p.y, z: p.z };
      w.boardAge = 0;s.jumpAge=0;
      w.rail = 0;
      w.lane = 0;
      w.air = 0;
      stage(s, "traversal");
      p.onGround = false;
      emit(s, "checkpoint");
      return true;
    }
    if (action === "jump") {
      if (!sonicJump(s,15)) return false;
      emit(s, "jump");
      return true;
    }
    if (action === "target") {
      s.lock = !s.lock;
      return true;
    }
    if(sonicTraversalInput(s,action,[...WYVERN_APPROACH,...WYVERN_TOWER.filter((_,i)=>i%4===0)],(type,data)=>emit(s,type,data)))return true;
    return false;
  }
  if (s.stage !== "combat") return false;
  const result = titanInput(s, action, held);
  return result;
}
function collect(s, id, count) {
  const w = s.wyvern;
  if (w.ringIds.includes(id)) return;
  w.ringIds.push(id);
  w.ringIds = w.ringIds.slice(-512);
  s.rings = Math.min(s.config.rings, s.rings + count);
  emit(s, "ring", { count });
}
function traversal(s, input, dt) {
  const p = s.avatar,
    w = s.wyvern,
    from = { ...p };
  if (w.section === "boarding") {
    w.boardAge = Math.min(1.15, (w.boardAge || 0) + dt);
    const u = w.boardAge / 1.15,
      t = u * u * (3 - 2 * u),
      end = runwayPoint(0),
      start = w.boardFrom || p;
    for (const axis of ["x", "y", "z"])
      p[axis] = start[axis] + (end[axis] - start[axis]) * t;
    p.y += Math.sin(u * Math.PI) * 10;
    p.onGround = false;
    s.action = "homing";
    s.actionTime = 0.1;
    if (u >= 1) {
      w.section = "runway";
      p.onGround = true;
    }
    return;
  }
  if (w.section === "runway") {
    const f=input.moveY ?? +!!input.forward-+!!input.back,r=input.moveX ?? +!!input.right-+!!input.left;
    const assist=s.lock&&input.boost&&Math.hypot(f,r)<0.0001,target=runwayPoint(Math.min(WYVERN_RAIL_LENGTH,w.rail+24));
    let dx=r*Math.cos(p.yaw)-f*Math.sin(p.yaw),dz=-r*Math.sin(p.yaw)-f*Math.cos(p.yaw);
    if(assist){dx=target.x-p.x;dz=target.z-p.z;const d=Math.hypot(dx,dz)||1;dx/=d;dz/=d;
      p.facingYaw=Math.atan2(dx,dz);const angle=Math.atan2(-dx,-dz);p.yaw+=Math.atan2(Math.sin(angle-p.yaw),Math.cos(angle-p.yaw))*(1-Math.exp(-dt*5));p.lastLookYaw=p.yaw;
    }
    const n=Math.max(1,Math.hypot(dx,dz)),speed=(input.boost?58:34)*(w.slow>0?0.45:1),a=1-Math.exp(-dt*12);
    p.vx+=(dx/n*speed-p.vx)*a;p.vz+=(dz/n*speed-p.vz)*a;
    const gravity=applySonicTraversal(s,input,dt,(type,data)=>emit(s,type,data));
    p.vy-=38*dt*gravity;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=p.vz*dt;
    w.air=Math.max(0,w.air-dt);w.railSpeed=Math.hypot(p.vx,p.vz);s.boosting=!!input.boost&&w.railSpeed>1;
    const surface=ribbonSurface(p,w.rail),inGap=surface&&WYVERN_GAPS.some(t=>surface.t>=t&&surface.t<t+15);
    if(surface){w.lane=clamp((p.x-surface.x)*Math.cos(p.yaw)-(p.z-surface.z)*Math.sin(p.yaw),-9,9)/6;if(surface.distance<24&&Math.abs(p.y-surface.y)<30)w.rail=surface.t;}
    const support=resolveWyvernPlatforms(p,from);
    if(support?.kind==='road'){w.rail=support.t;w.air=0;}
    else if(support){w.section='tower';w.air=0;}
    for (const h of WYVERN_HAZARDS)
      if (
        Math.abs(w.rail - h.t) < 2.5 &&
        Math.abs(w.lane - h.lane) < 0.28 &&
        !w.hitHazards.includes(h.id) &&
        !w.air
      ) {
        w.hitHazards.push(h.id);
        hurt(s, 5);
      }
    for (let i = 1; i <= 13; i++)
      if (
        Math.abs(w.rail - i * WYVERN_RING_SPACING) < 4 &&
        Math.abs(w.lane - ((i % 3) - 1)) < 0.4
      )
        collect(s, "rail:" + i, 10);
    if(w.rail>WYVERN_RAIL_LENGTH-10&&distance(p,runwayPoint(WYVERN_RAIL_LENGTH))<12&&p.onGround){w.section='emerald';emit(s,'checkpoint');}
    return;
  }
  if (w.section === "emerald") {
    const f = input.moveY ?? +!!input.forward - +!!input.back,
      r = input.moveX ?? +!!input.right - +!!input.left;
    p.x=clamp(p.x+(r*Math.cos(p.yaw)-f*Math.sin(p.yaw))*dt*9,-10,10);
    p.z=clamp(p.z+(-r*Math.sin(p.yaw)-f*Math.cos(p.yaw))*dt*9,-4*WYVERN_SCALE,10*WYVERN_SCALE);
    const floor=66+WYVERN_REST_LIFT+7*WYVERN_SCALE;
    const gravity=applySonicTraversal(s,input,dt,(type,data)=>emit(s,type,data));p.vy-=38*dt*gravity;p.y+=p.vy*dt;
    p.onGround=p.y<=floor&&p.vy<=0;if(p.onGround){p.y=floor;p.vy=0;}
    if (Math.hypot(p.x, p.z) < 3.5) {
      s.emerald = true;
      s.checkpoint = "combat";
      s.preparedRings = s.rings;
      stage(s, "transform");
      s.cinematicFrom = { ...p };
      emit(s, "emerald");
    }
    return;
  }
  const f = input.moveY ?? +!!input.forward - +!!input.back,
    r = input.moveX ?? +!!input.right - +!!input.left,
    n = Math.max(1, Math.hypot(f, r)),
    speed = input.boost ? 24 : 13,
    dx = (r * Math.cos(p.yaw) - f * Math.sin(p.yaw)) / n,
    dz = (-r * Math.sin(p.yaw) - f * Math.cos(p.yaw)) / n,
    a = 1 - Math.exp(-dt * 12);
  s.boosting = !!input.boost && Math.hypot(f, r) > 0.1;
  p.vx += (dx * speed - p.vx) * a;
  p.vz += (dz * speed - p.vz) * a;
  const gravity=applySonicTraversal(s,input,dt,(type,data)=>emit(s,type,data));
  p.x += p.vx * dt;
  p.z += p.vz * dt;
  p.vy -= 38 * dt*gravity;
  p.y += p.vy * dt;
  const radial = Math.hypot(p.x - TOWER.x, p.z - TOWER.z);
  const coreRadius=36-10*clamp(p.y/TOWER.height,0,1)+0.7;
  if (radial < coreRadius && p.y < TOWER.height) {
    if(input.boost&&f>0.1&&!(w.wallJump>0)){p.vy=Math.max(p.vy,32);s.action='wall_run';s.actionTime=0.15;}
    p.x=TOWER.x+(radial>0.001?(p.x-TOWER.x)/radial:1)*coreRadius;
    p.z = TOWER.z + ((p.z - TOWER.z) / Math.max(0.001, radial)) * coreRadius;
  }
  const support=resolveWyvernPlatforms(p,from);
  if(support?.kind==='road'){w.section='runway';w.rail=support.t;}
  for (let i = 0; i < WYVERN_TOWER.length; i += 8)
    if (distance(p, WYVERN_TOWER[i]) < 3) {
      w.tower = Math.max(w.tower, i);
      collect(s, "tower:" + i, 5);
    }
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6,
      x = -20 + Math.sin(a) * 22,
      z = 65 + Math.cos(a) * 22;
    if (Math.hypot(p.x - x, p.z - z) < 2.8 && p.y < 3)
      collect(s, "field:" + i, 10);
  }
  WYVERN_APPROACH.forEach((q,i)=>{if(distance(p,q)<3)collect(s,'field:'+(100+i),10);});
  if (Math.hypot(p.x, p.z) > WYVERN_LIMITS.groundRadius) {
    p.x = from.x;
    p.z = from.z;
  }
  advanceGrassCyloop(s, input, dt, emit);
}
function missile(s) {
  const w = s.wyvern,
    p = s.avatar;
  w.cycle++;
  const from = wyvernPoint(s,{x:(p.x ? Math.sign(p.x) : w.cycle%2 ? 1 : -1)*28,y:22,z:-46});
  w.missiles.push({
    id: ++s.sequence,
    age: 0,
    eta: s.phase===2?2.1:2.4,
    reflected: false,
    from,
    target: { x: p.x, y: p.y + 1.8, z: p.z },
  });
  emit(s, "missile", { point: from });
}
function beginClaws(s) {
  const w = s.wyvern;
  w.mode = w.cycle % 4 === 3 ? "bite" : "claws";
  w.timer = w.mode === "bite" ? 1.9 : 1.45;
  w.slash = 0;
  w.aim = { ...s.avatar };
  w.pursuit = 0;
  w.counterUsed = false;
  s.attack = w.mode === "bite" ? "crunch" : "swing";
  s.attackTime = 0;
  emit(s, "telegraph", { move: w.mode });
}
function enemy(s, input, dt) {
  const w = s.wyvern,
    p = s.avatar;
  // Catching up is an alternative to reflecting a missile. It still requires
  // controlled, sustained boost near Wyvern, never an automatic damage opening.
  if (w.mode === "missiles" && distance(W_HEAD, p) < 62*WYVERN_SCALE && s.boosting)
    w.pursuit = Math.min(1, w.pursuit + dt * 0.8);
  else w.pursuit = Math.max(0, w.pursuit - dt * 0.08);
  if (w.mode === "missiles" && w.pursuit >= 1) {
    if(!w.missiles.length)w.timer=Math.min(w.timer,0.25);
    w.pursuit=0;
  }
  for (const m of w.missiles) {
    m.age += dt;
    if(!m.reflected) {
      if(s.dodge>0 && m.age>m.eta-0.32)m.evaded=true;
      if(!m.evaded)m.target={x:p.x,y:p.y+1.8,z:p.z};
    }
    if (m.age >= m.eta && !m.reflected) {
      if (parries(s) && m.age<=m.eta+0.14 && distance(m.target, { ...p, y: p.y + 1.8 }) < 11) {
        m.reflected = true;
        m.target={x:p.x,y:p.y+1.8,z:p.z};
        m.from=wyvernPoint(s,{x:0,y:0,z:0});
        m.age = 0;
        m.eta = 0.65;
        successfulParry(s);
        w.mode = "open";w.open=12;w.loopExtended=false;s.counter=0;
        s.iframes=Math.max(s.iframes,0.65);
        beginParryHoming(s);
      } else if(m.age>=m.eta+0.14 || m.evaded) {
        if (distance(m.target, { ...p, y: p.y + 1.8 }) < 7) hurt(s, 20);
        m.done = true;
        // Missed missiles may provoke a close strike; evading it returns to
        // pursuit. A successful reflection never requires that extra parry.
        if(w.mode==="missiles" && distance(W_HEAD,p)<82)beginClaws(s);
      }
    } else if (m.reflected && m.age >= m.eta) {
      m.done = true;
      emit(s,"counter-impact",{point:wyvernPoint(s,{x:0,y:0,z:0}),strength:0.55});
      if(w.open<=0){w.mode="missiles";w.timer=1;}
    }
  }
  w.missiles = w.missiles.filter((m) => !m.done).slice(-12);
  if (w.open > 0) {
    w.open = Math.max(0, w.open - dt);
    s.attack = "idle";
    if (!w.open) {
      w.mode = "missiles";
      w.timer = 1.35;
      w.loopExtended = false;
      s.strike = null;
      s.queuedMove = null;
      s.projectiles = [];
    }
    return;
  }
  w.timer -= dt;
  s.attackTime += dt;
  if (w.mode === "missiles" && w.timer <= 0 && distance(p,W_HEAD)<320) {
    missile(s);
    w.timer = s.phase === 2 ? 2.7 : 3.4;
  }
  if (w.mode === "bite" && w.timer <= 0) {
    const reach = distance(w.aim || p, p) < 24 && distance(W_HEAD, p) < 34*WYVERN_SCALE;
    if (parries(s) && reach) {
      w.mode = "open";
      w.open = 10;
      w.loopExtended = false;
      s.counter = 2;
      s.attack = "idle";
      successfulParry(s);
      beginParryHoming(s);
      emit(s, "stagger");
    } else {
      if (reach) hurt(s, 35);
      w.mode = "missiles";
      w.timer = 2.6;
      s.attack = "idle";
    }
  }
  if (w.mode === "claws" && w.timer <= 0) {
    const reach = distance(w.aim || p, p) < 24 && distance(W_HEAD, p) < 50*WYVERN_SCALE;
    if (parries(s) && reach) {
      successfulParry(s);
      w.slash++;
      if (w.slash >= (s.phase === 2 ? 2 : 1)) {
        w.mode = "open";
        w.open = 10;
        w.loopExtended = false;
        s.counter = 2;
        s.attack = "idle";
        beginParryHoming(s);
        emit(s, "stagger");
      } else {
        w.timer = 0.95;
        w.aim = { ...p };
        s.attack = "slap";
        s.attackTime = 0;
        emit(s, "telegraph", { move: "second-claw" });
      }
    } else {
      if (reach) hurt(s, 30);
      w.mode = "missiles";
      w.timer = 2.6;
      s.attack = "idle";
    }
  }
  if (s.phase === 2) {
    w.laserClock += dt;
    if (w.laserClock > 5.5) {
      w.laserClock = 0;
      w.lasers.push({
        age: 0,
        x: ((Math.floor(s.time / 5.5) % 3) - 1) * 22,
        y: 66,
      });
      emit(s, "beam");
    }
    for (const l of w.lasers) {
      const oldZ = 8 + (Math.max(0, l.age - 1.1) / 2.1) * 112;
      l.age += dt;
      const newZ = 8 + (Math.max(0, l.age - 1.1) / 2.1) * 112;
      if (
        !l.hit &&
        (oldZ - p.z) * (newZ - p.z) <= 0 &&
        Math.hypot(p.x - l.x, p.y + 1.8 - l.y) < 12
      ) {
        l.hit = true;
        hurt(s, 16);
      }
    }
    w.lasers = w.lasers.filter((l) => l.age < 4.3).slice(-4);
  }
}
function fly(s, input, dt) {
  const p = s.avatar,
    w = s.wyvern,
    old = { ...p },
    oldClock = s.attackTime;
  const rawForward = input.moveY ?? +!!input.forward - +!!input.back,
    r = input.moveX ?? +!!input.right - +!!input.left,
    u = +!!input.up - +!!input.down,
    catching =
      s.lock &&
      input.boost &&
      !w.open &&
      w.mode === "missiles" &&
      Math.hypot(rawForward, r, u) < 0.1,
    f = catching ? 0.8 : rawForward,
    n = Math.max(1, Math.hypot(f, r, u)),
    speed = input.boost ? 175 : 62,
    a = 1 - Math.exp(-dt * 15);
  if (catching) {
    const aim = Math.atan2(p.x, p.z),
      delta = Math.atan2(Math.sin(aim - p.yaw), Math.cos(aim - p.yaw));
    p.yaw += delta * (1 - Math.exp(-dt * 6));
  }
  s.boosting = !!input.boost && Math.hypot(f, r, u) > 0.1;
  let desired={x:((r*Math.cos(p.yaw)-f*Math.sin(p.yaw))/n)*speed,
    z:((-r*Math.sin(p.yaw)-f*Math.cos(p.yaw))/n)*speed,y:(u/n)*speed};
  if(catching){
    const behind=p.x*Math.sin(w.yaw)+p.z*Math.cos(w.yaw)<-70;
    const aim=behind ? wyvernPoint(s,{x:(p.x>0?-1:1)*60,y:30,z:-100}) : wyvernPoint(s,{x:0,y:-1.8/WYVERN_SCALE,z:43/WYVERN_SCALE});
    const target={x:aim.x-p.x,y:aim.y-p.y,z:aim.z-p.z},d=Math.max(0.001,Math.hypot(target.x,target.y,target.z)),closing=Math.min(80,d*6);
    desired={x:target.x/d*closing,y:target.y/d*closing,z:-(w.routeSpeed || 0)+target.z/d*closing};
    const magnitude=Math.hypot(desired.x,desired.y,desired.z);if(magnitude>speed)for(const key of ["x","y","z"])desired[key]*=speed/magnitude;
  }
  p.vx+=(desired.x-p.vx)*a;p.vy+=(desired.y-p.vy)*a;p.vz+=(desired.z-p.vz)*a;
  if (s.dodge > 0) p.vx += (r >= 0 ? 1 : -1) * 55 * dt;
  approachTitanMelee(s, nearestTitanSurface(s, { ...p, y: p.y + 1.8 }), dt);
  steerTitanHoming(s,dt,emit);
  if (s.strike?.rushPath) {
    const v = titanRushVelocity(
      s,
      s.strike.rushPath,
      s.strike.elapsed + dt,
      dt,
    );
    if (v) {
      p.vx = v.x;
      p.vy = v.y;
      p.vz = v.z;
    }
  }
  const q = s.strike && techniquePosition(s, s.strike, s.strike.elapsed + dt);
  if (q) {
    p.vx = (q.x - p.x) / dt;
    p.vy = (q.y - p.y) / dt;
    p.vz = (q.z - p.z) / dt;
  }
  if (s.strike?.orbit) {
    const t = titanCyloopPosition(s.strike.orbit, s.strike.elapsed + dt);
    p.vx = (t.x - p.x) / dt;
    p.vy = (t.y - p.y) / dt;
    p.vz = (t.z - p.z) / dt;
  }
  p.x += p.vx * dt;
  p.y = clamp(p.y + p.vy * dt, WYVERN_LIMITS.minY, WYVERN_LIMITS.maxY);
  p.z += p.vz * dt;
  p.onGround = false;
  const world=wyvernWorldPoint(s,p);
  if(Math.max(Math.abs(world.x),Math.abs(world.z))>3050) {
    world.x=clamp(world.x,-3050,3050);world.z=clamp(world.z,-3050,3050);
    Object.assign(p,wyvernLocalPoint(wyvernFlightFrame(s),world));
  }
  sweepTitanMotion(s,old,(q,regions)=>{constrainTitanBody(q,s,regions);constrainWyvernScenery(s,q);q.y=Math.max(q.y,wyvernFloor(s,q)+0.05);});
  p.y = Math.max(p.y, wyvernFloor(s, p) + 0.12);
  for (let i = 0; i < 3; i++) {
    const q = wyvernBattleRing(s, i);
    if (distance({ ...p, y: p.y + 1.8 }, q) < 3.5) collect(s, q.id, 8);
  }
  advanceProjectiles(s, dt, oldClock);
  if (s.stage !== "combat") return;
  advanceStrike(s, old, dt, oldClock);
  if (s.stage !== "combat") return;
  if (
    !w.counterUsed &&
    s.events.some(
      (e) => e.type === "hit" && ["counter", "perfectCounter"].includes(e.kind),
    )
  ) {
    w.counterUsed = true;
    w.cinematicFrom = { x: p.x, y: p.y, z: p.z };
    w.counterCues = 0;
    stage(s, "wyvern-counter");
    return;
  }
  if (
    s.events.some((e) => e.type === "hit" && e.kind === "loop") &&
    !w.loopExtended
  ) {
    w.open = Math.min(13, w.open + 3);
    w.loopExtended = true;
  }
  const next = takeTitanMove(s);
  if (next) wyvernInput(s, next);
  if (input.hit) wyvernInput(s, "hit", true);
  if (s.phase === 2 && w.slamDone && s.hp <= s.maxHp * 0.04) {
    stage(s, "wyvern-dive");
    qte(s, "timing");
  }
}
export function stepWyvern(s, input = {}, dt = 1 / 60) {
  if (!Number.isFinite(dt) || dt <= 0) return;
  dt = Math.min(dt, 1 / 30);
  s.events = [];
  const realDt = dt, parry = !!input.parry;
  const freshParry = parry && !s.parryHeld;
  s.parryAge = parry ? (s.parryHeld ? s.parryAge + realDt : 0) : 0;
  s.parryHeld = parry;
  if (!parry || freshParry) s.wyvern.parryUsed = false;
  if (freshParry && s.stage === "combat") {
    s.strike = null; s.queuedMove = null;
    s.action = "parry"; s.actionTime = 0.28;
  }
  s.wyvern.flickAge = Math.min(1, (s.wyvern.flickAge ?? 1) + realDt);
  s.wyvern.timeScale = s.stage === "combat" && s.wyvern.parrySlow > 0 ? 0.22 : 1;
  s.wyvern.parrySlow = Math.max(0, (s.wyvern.parrySlow || 0) - realDt);
  dt *= s.wyvern.timeScale;
  const previousFlightFrame=wyvernFlightFrame(s);
  const aerialScene=["wyvern-counter","wyvern-slam","wyvern-hold","wyvern-launch","wyvern-mouth","wyvern-missile","wyvern-barrage","wyvern-dive","wyvern-volley","finale","phase"].includes(s.stage);
  if(!["victory","defeat"].includes(s.stage))s.wyvern.cinemaLift=(s.wyvern.cinemaLift || 0)+((aerialScene?420:0)-(s.wyvern.cinemaLift || 0))*(1-Math.exp(-dt*3));
  clearSuperCooldowns(s);
  tickSonicMovement(s,input,dt);
  s.time += dt;
  s.wyvern.musicTime = (s.wyvern.musicTime || 0) + realDt;
  s.stageTime += dt;
  s.boosting = false;
  const w = s.wyvern,
    p = s.avatar;
  if(s.stage === "combat" && s.emerald)w.flightTime=Math.max(6,w.flightTime);
  if (s.emerald && !["transform", "victory", "defeat"].includes(s.stage))
    {w.skyClock=(w.skyClock ?? w.flightTime)+dt;w.flightTime += dt;}
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
  w.slow = Math.max(0, w.slow - dt);
  tickTitanCombo(s, dt);
  if (!s.actionTime && !s.strike) s.action = "idle";
  const facing=s.emerald ? Math.PI : 0;
  if(s.stage === "transform")w.yaw=Math.PI*ease((s.stageTime-WYVERN_CINEMA.transform+2)/2);
  else w.yaw+=Math.atan2(Math.sin(facing-w.yaw),Math.cos(facing-w.yaw))*(1-Math.exp(-dt*5));
  if (s.stage === "intro") {
    if (s.stageTime >= WYVERN_CINEMA.intro) stage(s, "traversal");
    return;
  }
  if (s.stage === "traversal") {
    traversal(s, input, dt);
    return;
  }
  if (s.stage === "transform") {
    const visual = {
      ...s,
      stageTime: (s.stageTime * 6) / WYVERN_CINEMA.transform,
    };
    tickTransformation(visual, (_state, type, data) =>
      emit(s, type, { ...data, age: (data.age * WYVERN_CINEMA.transform) / 6 }),
    );
    s.transformCues = visual.transformCues;
    const a = ease((s.stageTime - WYVERN_CINEMA.transform + 2) / 2),
      f = s.cinematicFrom || { x: 0, y: 73, z: 0 };
    p.x = f.x * (1 - a);
    p.y = f.y + (65 - f.y) * a;
    p.z = f.z + (560 - f.z) * a;
    w.flightTime=Math.max(w.flightTime,6*a);
    if (s.stageTime >= WYVERN_CINEMA.transform) {
      stage(s, "combat");
      w.timer = 2;
      s.rings = Math.max(100, s.rings);
      s.preparedRings = s.rings;
    }
    return;
  }
  if (s.stage === "phase") {
    w.open = 0;
    w.missiles = [];
    w.lasers = [];
    s.attack = "idle";
    if (s.stageTime >= WYVERN_CINEMA.phase) {
      stage(s, "combat");
      w.mode = "missiles";
      w.timer = 2;
      s.iframes = 1;
    }
    return;
  }
  if (s.qte) {
    const pose = wyvernCinemaPoint(s);
    if (pose) Object.assign(p, pose);
    s.qte.age += dt;
    s.qte.left -= dt;
    if (s.qte.hits >= s.qte.need) {
      s.qte = null;
      emit(s, "qte-win");
      if (s.stage === "wyvern-volley") {
        stage(s, "wyvern-slam");
        w.cinematicFrom = { ...p };
      } else if (s.stage === "wyvern-dive") {
        stage(s, "wyvern-hold");
        w.cinematicFrom = { ...p };
        qte(s, "mash");
      } else if (s.stage === "wyvern-hold") {
        stage(s, "wyvern-launch");
        w.cinematicFrom = { ...p };
      } else if (s.stage === "wyvern-barrage") {
        stage(s, "wyvern-mouth");
        w.cinematicFrom = { ...p };
        qte(s, "mash");
      } else if (s.stage === "wyvern-mouth") {
        stage(s, "wyvern-missile");
        w.cinematicFrom = { ...p };
        qte(s, "mash");
      } else if (s.stage === "wyvern-missile") {
        stage(s, "finale");
        w.cinematicFrom = { ...p };
      }
    } else if (s.qte.left <= 0) failQte(s);
    return;
  }
  if (s.stage === "wyvern-counter") {
    Object.assign(p, wyvernCinemaPoint(s));
    if (s.stageTime >= 4 && !(w.counterCues & 1)) {
      w.counterCues |= 1;
      emit(s, "counter-impact", {
        point: { x: 0, y: 54, z: -34 },
        strength: 1.1,
      });
    }
    if (s.stageTime >= WYVERN_CINEMA.counter) {
      stage(s, "combat");
      w.open = 10;
      w.mode = "open";
      s.counter = 0;
    }
    return;
  }
  if (s.stage === "wyvern-launch") {
    Object.assign(p, wyvernCinemaPoint(s));
    if (s.stageTime >= WYVERN_CINEMA.launch) {
      stage(s, "wyvern-barrage");
      qte(s, "timing");
    }
    return;
  }
  if (s.stage === "wyvern-slam") {
    Object.assign(p, wyvernCinemaPoint(s));
    if (s.stageTime >= WYVERN_CINEMA.slam) {
      stage(s, "combat");
      w.slamDone = true;
      w.open = 12;
      w.mode = "open";
    }
    return;
  }
  if (s.stage === "finale") {
    Object.assign(p, wyvernCinemaPoint(s));
    if (s.stageTime >= WYVERN_CINEMA.detonate && !(w.finaleCues & 1)) {
      w.finaleCues |= 1;
      emit(s, "wyvern-explosion", { point: W_HEAD, strength: 1.4 });
    }
    if (s.stageTime >= WYVERN_CINEMA.finale) {
      s.hp = 0;
      s.won = true;
      w.skyFreeze = s.time;
      stage(s, "victory");
      openTitanReturn(s);
    }
    return;
  }
  if (s.stage === "victory") {
    stepTitanReturn(s, input, dt);
    return;
  }
  if (s.stage === "defeat") return;
  s.rings = Math.max(
    0,
    s.rings -
      dt *
        s.config.drain *
        { easy: 0.65, normal: 1, hard: 1.3 }[s.config.difficulty],
  );
  if (!s.rings) {
    stage(s, "defeat");
    return;
  }
  const oldFrame=previousFlightFrame,chasing=w.open<=0 && ["missiles"].includes(w.mode) && !s.strike;
  const gap=distance(p,W_HEAD);
  w.routeSpeed=gap>1350 ? 0 : s.phase===2 ? 108 : 96;
  w.routeDistance=(w.routeDistance || 0)+w.routeSpeed*dt;
  const newFrame=wyvernFlightFrame(s);
  if(chasing)advectWyvernAvatar(p,oldFrame,newFrame);
  for(const m of w.missiles) {
    for(const key of ["from","target"]) {const point={...m[key],vx:0,vz:0};advectWyvernAvatar(point,oldFrame,newFrame);m[key]={x:point.x,y:point.y,z:point.z};}
    if(m.reflected)m.from=wyvernPoint(s,{x:0,y:0,z:0});
  }
  fly(s, input, dt);
  if (s.stage === "combat") enemy(s, input, dt);
}
export function restoreWyvernSession(raw) {
  if (
    !raw ||
    raw.schema !== 1 ||
    raw.titan !== "wyvern" ||
    typeof raw.id !== "string" ||
    raw.id.length > 150
  )
    return null;
  const legal = [
    "intro",
    "traversal",
    "transform",
    "combat",
    "phase",
    "wyvern-volley",
    "wyvern-slam",
    "wyvern-dive",
    "wyvern-mouth",
    "wyvern-hold",
    "wyvern-launch",
    "wyvern-barrage",
    "wyvern-missile",
    "wyvern-counter",
    "finale",
    "victory",
    "defeat",
  ];
  if (!legal.includes(raw.stage)) return null;
  const s = wyvernSession(raw.config, raw.id),
    w = s.wyvern,
    r = raw.wyvern || {},
    number = (v, d, a, b) => (Number.isFinite(v) ? clamp(v, a, b) : d);
  for (const key of ["time", "stageTime", "eventSerial", "sequence", "attempt"])
    s[key] = number(raw[key], 0, 0, 1e8);
  for (const key of [
    "iframes",
    "dodge",
    "stagger",
    "counter",
    "actionTime",
    "pulseCooldown",
    "phantomRest",
    "staggerRest",
  ])
    s[key] = number(raw[key], 0, 0, 20);
  for (const key of Object.keys(s.cooldowns))
    s.cooldowns[key] = number(raw.cooldowns?.[key], 0, 0, 15);
  s.combo = Math.floor(number(raw.combo, 0, 0, 1000));
  s.comboStep = Math.floor(number(raw.comboStep, 0, 0, 3));
  s.stage = raw.stage;
  s.phase = raw.phase === 2 ? 2 : 1;
  const savedMax = Number.isFinite(raw.maxHp) && raw.maxHp > 0 ? raw.maxHp : s.maxHp;
  s.hp = number(raw.hp, savedMax, 0, savedMax) / savedMax * s.maxHp;
  s.rings = number(raw.rings, 80, 0, s.config.rings);
  s.original = raw.original;
  s.emerald = raw.emerald === true;
  s.won = raw.won === true && raw.stage === "victory";
  if (raw.stage === "victory" && !s.won) return null;
  s.checkpoint = ["traversal", "combat", "phase2"].includes(raw.checkpoint)
    ? raw.checkpoint
    : "traversal";
  s.preparedRings = number(raw.preparedRings, 80, 0, s.config.rings);
  s.lock = raw.lock !== false;
  restoreTitanCombo(s, raw);
  s.grassCyloop = restoreGrassCyloop(raw.grassCyloop);
  if (Number.isFinite(raw.preludeMusic?.offset) &&
      raw.preludeMusic.offset >= 0 && raw.preludeMusic.offset <= 900)
    s.preludeMusic = { offset: raw.preludeMusic.offset };
  const music = raw.battleMusic;
  if (music && ["phaseOne", "phaseTwo", "transition", "finale"].includes(music.section) &&
      Number.isFinite(music.offset) && music.offset >= 0 && music.offset <= 900)
    s.battleMusic = { section: music.section, offset: music.offset,
      ...(typeof music.track === "string" && /^(supplied|titan:[\w-]{1,80})$/.test(music.track)
        ? { track: music.track } : {}) };
  for (const key of ["x", "y", "z", "vx", "vy", "vz", "yaw", "pitch"])
    s.avatar[key] = number(
      raw.avatar?.[key],
      s.avatar[key],
      key === "y" ? -600 : -6000,
      key === "y" ? 800 : 6000,
    );
  s.avatar.onGround = raw.avatar?.onGround === true;
  for (const key of [
    "tower",
    "rail",
    "lane",
    "gate",
    "air",
    "slow",
    "open",
    "cycle",
    "timer",
    "slash",
    "yaw",
    "laserClock",
    "finaleCues",
    "musicTime",
    "flightTime",
    "routeDistance",
    "railSpeed",
    "laneSpeed",
    "cinemaLift",
    "pursuit",
    "counterCues",
  ])
    w[key] = number(
      r[key],
      w[key],
      ["railSpeed","laneSpeed"].includes(key) ? -100 : ["lane", "yaw"].includes(key) ? -4 : 0,
      key === "rail"
        ? WYVERN_RAIL_LENGTH
        : key === "tower"
          ? WYVERN_TOWER.length-1
          : key === "open"
            ? 13
            : 1e6,
    );
  if (r.trackVersion !== 2 && ["runway", "emerald"].includes(r.section)) {
    w.rail = clamp((w.rail * WYVERN_RAIL_LENGTH) / 480, 0, WYVERN_RAIL_LENGTH);
    if (r.section === "runway")
      Object.assign(s.avatar, runwayPoint(w.rail, w.lane));
  }
  w.cinemaLift=clamp(w.cinemaLift,0,420);
  const dawn=Math.max(240,s.config.arenaDayLength*0.5),oldSky=Number.isFinite(r.flightTime)?r.flightTime:0;
  w.skyClock=Number.isFinite(r.skyClock)?clamp(r.skyClock,0,1e9):oldSky<=12?oldSky:12+(oldSky-12)*dawn/72;
  if(s.emerald && s.stage!=="transform")w.yaw=Math.PI;
  w.routeVersion=4;
  if (r.routeVersion!==4&&r.routeVersion!==3) w.routeDistance=w.flightTime*96;
  if(s.emerald && s.stage!=="transform")w.flightTime=Math.max(6,w.flightTime);
  if(r.towerVersion!==3&&!s.emerald&&['tower','boarding'].includes(r.section)){
    const dx=s.avatar.x+68,dz=s.avatar.z-42,oldRadius=r.towerVersion===2?42:17,oldHeight=r.towerVersion===2?200:80;
    if(Math.hypot(dx,dz)<oldRadius+15&&(s.avatar.y>0.3||w.tower>0)){
      s.avatar.x=TOWER.x+dx*TOWER.radius/oldRadius;s.avatar.z=TOWER.z+dz*TOWER.radius/oldRadius;s.avatar.y*=TOWER.height/oldHeight;
      if(r.towerVersion!==2)w.tower*=2;
    }
  }
  w.towerVersion=3;
  if(r.ribbonVersion!==4&&r.ribbonVersion!==3&&r.trackVersion===2&&r.section==='runway'&&!s.emerald){
    const u=w.rail/WYVERN_RAIL_LENGTH,lead=1-ease(u/0.2),out=1-ease((u-0.86)/0.14);
    s.avatar.x+=(TOWER.x+TOWER.radius+14)*lead*out;s.avatar.z+=(TOWER.z-42)*lead*out;
    if(r.ribbonVersion!==2)s.avatar.y+=(TOWER.height-80)*out;
  }
  if(r.ribbonVersion!==4&&r.trackVersion===2&&['runway','emerald'].includes(r.section)&&!s.emerald)s.avatar.y+=WYVERN_REST_LIFT*ease((w.rail/WYVERN_RAIL_LENGTH-0.86)/0.14);
  w.ribbonVersion=4;
  w.tower = Math.floor(w.tower);
  w.cycle = Math.floor(w.cycle);
  w.pursuit = clamp(w.pursuit, 0, 1);
  w.lane = clamp(w.lane, -1, 1);
  w.section = ["tower", "boarding", "runway", "emerald"].includes(r.section)
    ? r.section
    : "tower";
  for (const k of ["loopExtended", "finaleStarted", "slamDone", "counterUsed"])
    w[k] = r[k] === true;
  w.skyFreeze = Number.isFinite(r.skyFreeze) ? r.skyFreeze : null;
  w.boardAge = clamp(Number(r.boardAge) || 0, 0, 1.15);
  if (
    r.boardFrom &&
    ["x", "y", "z"].every(
      (k) => Number.isFinite(r.boardFrom[k]) && Math.abs(r.boardFrom[k]) < 1000,
    )
  )
    w.boardFrom = { ...r.boardFrom };
  w.ringIds = [
    ...new Set(
      (Array.isArray(r.ringIds) ? r.ringIds : []).filter(
        (id) =>
          typeof id === "string" &&
          /^(field|tower|rail|battle):\d{1,8}$/.test(id),
      ),
    ),
  ].slice(-512);
  w.hitHazards = [
    ...new Set(
      (Array.isArray(r.hitHazards) ? r.hitHazards : []).filter(
        (n) => Number.isInteger(n) && n >= 0 && n < 16,
      ),
    ),
  ];
  if (
    r.cinematicFrom &&
    ["x", "y", "z"].every((k) => Number.isFinite(r.cinematicFrom[k]))
  )
    w.cinematicFrom = {
      x: clamp(r.cinematicFrom.x, -340, 340),
      y: clamp(r.cinematicFrom.y, 0, 220),
      z: clamp(r.cinematicFrom.z, -340, 340),
    };
  if (r.aim && ["x", "y", "z"].every((k) => Number.isFinite(r.aim[k])))
    w.aim = {
      x: clamp(r.aim.x, -340, 340),
      y: clamp(r.aim.y, 0, 220),
      z: clamp(r.aim.z, -340, 340),
    };
  w.mode = ["missiles", "reflected", "claws", "bite", "open"].includes(r.mode)
    ? r.mode
    : "missiles";
  if (w.mode === "reflected") {
    w.mode = "missiles";
    w.timer = 1;
  }
  if (w.mode === "claws") {
    w.timer = 1.45;
    w.aim = { ...s.avatar };
    s.attack = "swing";
  }
  // Reload clears in-flight attacks, re-telegraphs the next strike, and retains
  // health, ring pickups and progress. Projectiles can never hit twice on reload.
  if (raw.qte && WYVERN_QTE_STAGES[s.stage]) {
    qte(s, WYVERN_QTE_STAGES[s.stage]);
    s.qte.hits = Math.floor(number(raw.qte.hits, 0, 0, s.qte.need - 1));
  } else if (WYVERN_QTE_STAGES[s.stage]) qte(s, WYVERN_QTE_STAGES[s.stage]);
  if (s.stage === "transform" && raw.cinematicFrom)
    s.cinematicFrom = { ...s.avatar };
  if (s.won) openTitanReturn(s, raw.returnPortal);
  restoreSonicMovement(s,raw);restoreSonicTraversal(s,raw);
  return s;
}
