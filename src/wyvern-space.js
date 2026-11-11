import {wyvernWingPoints} from "./wyvern-wing-pose.js";
import { wyvernRouteDistance } from "./wyvern-route.js";
import {wyvernSpinePoints,wyvernThrowPose} from "./wyvern-posture.js";
// Canonical boss-space contacts shared by the rendered head and combat engine.
export const WYVERN_SCALE = 1.65;
export const WYVERN_REST_LIFT=32;
export const wyvernRestLift=s=>!s.emerald?WYVERN_REST_LIFT:s.stage==='transform'?WYVERN_REST_LIFT*(1-ease(s.stageTime/12)):0;
export const W_HEAD = { x: 0, y: 66, z: 0 };
export const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
export const ease = (n) => {
  n = clamp(n, 0, 1);
  return n * n * (3 - 2 * n);
};
function bodyPose(s) {
  const thrown=["wyvern-slam","wyvern-counter","wyvern-hold","wyvern-launch"].includes(s.stage)
    ? wyvernThrowPose(s.stageTime) : {yaw:0,roll:0,drop:0};
  return {yaw:(s.wyvern?.yaw || 0)+thrown.yaw,roll:thrown.roll,drop:thrown.drop};
}
export function wyvernPoint(s,p) {
  p={x:p.x*WYVERN_SCALE,y:p.y*WYVERN_SCALE,z:p.z*WYVERN_SCALE};
  const pose=bodyPose(s),c=Math.cos(pose.yaw),a=Math.sin(pose.yaw);
  const x=p.x*Math.cos(pose.roll)-p.y*Math.sin(pose.roll),
    y=p.x*Math.sin(pose.roll)+p.y*Math.cos(pose.roll);
  return {x:(s.boss?.x || 0)+x*c+p.z*a,
    y:W_HEAD.y+wyvernRestLift(s)+Math.sin((s.time || 0)*0.9)*0.35-pose.drop+y,
    z:(s.boss?.z || 0)+p.z*c-x*a};
}
export function wyvernRegions(s) {
  const regions = [
    {
      id: "head",
      center: wyvernPoint(s, { x: 0, y: 0, z: 0 }),
      axes: { x: 8*WYVERN_SCALE, y: 7*WYVERN_SCALE, z: 22*WYVERN_SCALE },
      yaw: bodyPose(s).yaw,
    },
    {
      id: "neck",
      a: wyvernPoint(s, { x: 0, y: -1, z: -7 }),
      b: wyvernPoint(s, { x: 0, y: -2, z: -40 }),
      r: 5*WYVERN_SCALE,
    },
  ];
  const wings=wyvernWingPoints(s);
  for(const side of [0,1]){
    const offset=side*7,label=side?'right':'left';
    const p=i=>{const v=wings[offset+i];return wyvernPoint(s,{x:v.x/WYVERN_SCALE,y:v.y/WYVERN_SCALE,z:v.z/WYVERN_SCALE});};
    for(let i=0;i<3;i++)regions.push({id:label+' wing '+i,a:p(i),b:p(i+1),r:6});
    for(let i=4;i<7;i++){
      const a=p(3),b=p(i),d=Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z)||1;
      regions.push({id:label+' claw '+i,a,b:{x:b.x+(b.x-a.x)*20/d,y:b.y+(b.y-a.y)*20/d,z:b.z+(b.z-a.z)*20/d},r:5.5});
    }
  }
  // The visible spine continues behind the neck; it also obstructs flight and
  // camera booms. They share the same parry-gated damage window.
  const spine=wyvernSpinePoints(s);
  for (let i=0;i<spine.length-1;i+=4) regions.push({id:"spine "+i,
    a:wyvernPoint(s,spine[i]),b:wyvernPoint(s,spine[Math.min(spine.length-1,i+4)]),
    r:Math.max(1.4,4-i*0.09)*WYVERN_SCALE});
  return regions;
}
export function wyvernDamageGate(s, emit) {
  if (s.wyvern.open <= 0 || s.qte) {
    emit(s, "block", { point: { ...s.avatar }, amount: 0 });
    return false;
  }
  return true;
}
export function wyvernDamageTransition(s, emit) {
  if (s.phase === 1 && s.hp <= s.maxHp * 0.5) {
    s.hp = s.maxHp * 0.5;
    s.phase = 2;
    s.checkpoint = "phase2";
    s.stage = "phase";
    s.stageTime = 0;
    s.strike = null;
    s.projectiles = [];
    s.wyvern.open = 0;
    s.queuedMove = null;
    emit(s, "stage", { stage: "phase" });
  } else if (
    s.phase === 2 &&
    s.hp <= s.maxHp * 0.12 &&
    !s.wyvern.finaleStarted
  ) {
    s.hp = s.maxHp * 0.12;
    s.wyvern.finaleStarted = true;
    s.stage = "wyvern-volley";
    s.stageTime = 0;
    s.strike = null;
    s.queuedMove = null;
    s.projectiles = [];
    s.wyvern.open = 0;
    s.qte = {
      kind: "timing",
      hits: 0,
      need: 1,
      left: 6,
      age: 0,
      lastTap: -10,
      success: false,
    };
    emit(s, "stage", { stage: s.stage });
  }
  if (s.wyvern.slamDone && s.hp <= s.maxHp * 0.04 && s.stage === "combat") {
    s.hp = s.maxHp * 0.04;
    s.stage = "wyvern-dive";
    s.stageTime = 0;
    s.strike = null;
    s.queuedMove = null;
    s.projectiles = [];
    s.qte = { kind: "timing", hits: 0, need: 1, left: 6, age: 0, lastTap: -10 };
    emit(s, "stage", { stage: s.stage });
  }
  return true;
}
export const TOWER = {
  x: -300,
  z: 180,
  radius: 42,
  height: 200,
  turns: 3,
  width: 5.5,
};
export const WYVERN_TOWER = Array.from({ length: 385 }, (_, i) => {
  const u = i / 384,
    a = -u * Math.PI * 2 * TOWER.turns;
  return {
    x: TOWER.x + Math.cos(a) * TOWER.radius,
    y: u * TOWER.height,
    z: TOWER.z + Math.sin(a) * TOWER.radius,
  };
});
export const WYVERN_APPROACH=Array.from({length:14},(_,i)=>({x:(TOWER.x+TOWER.radius)*i/13,y:0.8,z:150+(TOWER.z-150)*i/13}));
export const WYVERN_RAIL_LENGTH = 2400;
export const WYVERN_GAPS=[112,255,398].map(t=>t*WYVERN_RAIL_LENGTH/480);
export const WYVERN_RING_SPACING = (WYVERN_RAIL_LENGTH * 34) / 480;
export function runwayPoint(t, lane = 0) {
  const u = clamp(t / WYVERN_RAIL_LENGTH, 0, 1),
    a = u * Math.PI * 6;
  const q = {
    x: Math.sin(a) * 135 + lane * 6 * Math.cos(a),
    y: TOWER.height + Math.sin(u * Math.PI * 4) * 22 + u * 15,
    z: 42 - u * 760 + Math.sin(u * Math.PI * 2) * 120 + lane * 6 * Math.sin(a),
  };
  const lead=1-ease(u/0.2);q.x+=(TOWER.x+TOWER.radius+14)*lead;q.z+=(TOWER.z-42)*lead;
  const f = ease((u - 0.86) / 0.14);
  const result={x:q.x*(1-f),y:q.y*(1-f)+(66+WYVERN_REST_LIFT+7*WYVERN_SCALE)*f,z:q.z*(1-f)+9*WYVERN_SCALE*f};
  const cx=q.x*(1-f)-lane*6*Math.cos(a)*(1-f),cz=(q.z-lane*6*Math.sin(a))*(1-f)+9*WYVERN_SCALE*f;
  const terrain=Math.max(wyvernGround(cx,cz),wyvernGround(cx+12,cz),wyvernGround(cx-12,cz),wyvernGround(cx,cz+12),wyvernGround(cx,cz-12));
  result.y=Math.max(result.y,terrain+24);return result;

}
const groundCache=new Map();
function groundVertex(x,z) {
  const key=x+":"+z;if(groundCache.has(key))return groundCache.get(key);
  const radius=Math.hypot(x,z),opening=ease((radius-550)/380),d=wyvernRouteDistance(x,z);
  const wall=ease((d-240)/230),strata=170+Math.sin(x*0.004+z*0.003)*45;
  const mountains=Math.max(0,Math.sin(x*0.0032)*Math.cos(z*0.0026))*130;
  const valley=35+(Math.sin(x*0.0025)+Math.cos(z*0.003))*18;
  const coast=ease((radius-2900)/300),y=(1-coast)*opening*(valley+wall*(strata+mountains))-34*coast;
  if(groundCache.size>16384)groundCache.delete(groundCache.keys().next().value);groundCache.set(key,y);return y;
}
export function wyvernGround(x,z) {
  // Piecewise planar interpolation matches both nested terrain LOD grids.
  const grid=100,x0=Math.floor(x/grid)*grid,z0=Math.floor(z/grid)*grid;
  const u=(x-x0)/grid,v=(z-z0)/grid;
  const a=groundVertex(x0,z0),b=groundVertex(x0+grid,z0),c=groundVertex(x0,z0+grid),d=groundVertex(x0+grid,z0+grid);
  return u+v<=1 ? a+(b-a)*u+(c-a)*v : d+(c-d)*(1-u)+(b-d)*(1-v);
}

export function wyvernBattleRing(s,index) {
  const p=wyvernPoint({...s,stage:"combat"},{x:(index-1)*24/WYVERN_SCALE,y:(index%2)*2/WYVERN_SCALE,z:(44+Math.sin(s.wyvern.cycle+index)*2)/WYVERN_SCALE});
  return {...p,id:"battle:"+(s.wyvern.cycle*3+index)};
}
