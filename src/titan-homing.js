import {titanTargetContact} from "./titan-targeting.js";
import {nearestTitanSurface,regionContact,titanBodyRegions} from './titan-contact.js';
import {sonicContact,sonicLength} from './titan-metrics.js';
// A target acquisition, curled approach and contact recovery, never a position warp.
export const TITAN_HOMING=Object.freeze({range:70,parryRange:1400,windup:0.15,parryWindup:0.22,minFlight:0.16,recovery:0.22,blocked:0.22});
export function homingTarget(s,id){
 const p=sonicContact(s),r=id&&titanBodyRegions(s).find(r=>r.id===id);
 return r?regionContact(r,p):titanTargetContact(s,p);
}
export function makeTitanHoming(s,parry=false){
 const target=homingTarget(s),range=parry?TITAN_HOMING.parryRange:TITAN_HOMING.range;
 if(!target||target.distance>range)return null;
 return {phase:'windup',age:0,flightAge:0,recoveryAge:0,blockedAge:0,parry,targetId:target.id,
  speed:Math.max(90,Math.min(900,target.distance/0.7)),limit:Math.max(1.2,Math.min(2.2,target.distance/600+0.9)),
  lastDistance:target.distance,from:{x:s.avatar.x,y:s.avatar.y,z:s.avatar.z}};
}
export function steerTitanHoming(s,dt,emit=()=>{}){
 const a=s.strike,h=a?.homing,p=s.avatar;if(!h)return;
 h.age+=dt;
 if(h.phase==='windup'){
  p.vx=p.vy=p.vz=0;
  if(h.age>=(h.parry?TITAN_HOMING.parryWindup:TITAN_HOMING.windup)){h.phase='flight';emit(s,'homing',{point:{...p}});}
  else return;
 }
 if(h.phase==='recovery'){
  h.recoveryAge+=dt;const fade=Math.max(0,1-h.recoveryAge/TITAN_HOMING.recovery);
  p.vx=(h.rebound?.x||0)*fade;p.vy=(h.rebound?.y||0)*fade;p.vz=(h.rebound?.z||0)*fade;return;
 }
 h.flightAge+=dt;
 const target=homingTarget(s,h.targetId),k=sonicLength(s,1),eye=sonicContact(s);
 // Aim at the visible surface plus body clearance; the ordinary swept body and
 // scenery solver still resolves every step before contact can cause damage.
 const to={x:target.point.x+target.normal.x*2*k,y:target.point.y+target.normal.y*2*k,z:target.point.z+target.normal.z*2*k};
 const dx=to.x-eye.x,dy=to.y-eye.y,dz=to.z-eye.z,d=Math.hypot(dx,dy,dz)||1;
 const speed=Math.min(h.speed,d/dt);
 p.vx=dx/d*speed;p.vy=dy/d*speed;p.vz=dz/d*speed;p.onGround=false;
 if(Math.hypot(dx,dz)>0.001)p.facingYaw=Math.atan2(dx,dz);
 if(h.parry)s.iframes=Math.max(s.iframes,0.08);
}
export function finishTitanHoming(s,contact,emit){
 const a=s.strike,h=a?.homing;if(!h||h.phase==='recovery')return;
 h.phase='recovery';h.recoveryAge=0;h.hit=!!contact;a.next=1;a.duration=a.elapsed+TITAN_HOMING.recovery;
 const n=contact?.normal||{x:0,y:0,z:0},k=sonicLength(s,1);
 h.rebound={x:n.x*7*k,y:(n.y*5+1.5)*k,z:n.z*7*k};
 if(!contact)emit(s,'miss',{kind:'homing'});
}
export function homingBlocked(s,dt){
 const h=s.strike?.homing;if(!h||h.phase!=='flight')return false;
 const d=homingTarget(s,h.targetId).distance;
 h.blockedAge=d>=h.lastDistance-0.015?h.blockedAge+dt:0;h.lastDistance=d;
 return h.flightAge>h.limit||h.blockedAge>TITAN_HOMING.blocked;
}
