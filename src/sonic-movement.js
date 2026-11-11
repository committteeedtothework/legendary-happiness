// Arena-only jump state shared by both Titans; no sandbox movement is changed.
export function sonicJump(s,speed=24) {
 const p=s.avatar;
 if(s.stage!=='traversal'||s.climb?.attached||s.wyvern?.section==='boarding')return false;
 if((s.jumpAge??99)<0.055)return false;
 const grounded=p.onGround||(s.coyote||0)>0;
 if(!grounded&&(s.airJumps||0)>=1)return false;
 if(s.traversalKit){s.traversalKit.dash=[];s.traversalKit.stomp=s.traversalKit.drop=s.traversalKit.dropKey=false;s.traversalKit.roll=s.traversalKit.slide=0;}
 if(s.wyvern)s.wyvern.wallJump=0.2;
 s.airJumps=grounded?0:1;s.coyote=0;s.jumpAge=0;s.landingAge=1;
 p.vy=grounded?speed:speed*0.85;p.onGround=false;s.action='jump';s.actionTime=0.3;
 return true;
}
export function tickSonicMovement(s,input,dt) {
 const p=s.avatar;
 const look=p.yaw,old=Number.isFinite(p.lastLookYaw)?p.lastLookYaw:look;
 const turn=Math.atan2(Math.sin(look-old),Math.cos(look-old));
 const x=input.moveX ?? +!!input.right-+!!input.left,z=input.moveY ?? +!!input.forward-+!!input.back;
 if(Math.hypot(x,z)>0.0001)p.facingYaw=Math.atan2(x*Math.cos(look)-z*Math.sin(look),-x*Math.sin(look)-z*Math.cos(look));
 else p.facingYaw=(Number.isFinite(p.facingYaw)?p.facingYaw:look+Math.PI)+turn;
 p.lastLookYaw=look;p.moveX=x;p.moveY=z;
 if(s.wyvern)s.wyvern.wallJump=Math.max(0,(s.wyvern.wallJump||0)-dt);
 s.jumpAge=Math.min(99,(s.jumpAge??99)+dt);s.landingAge=Math.min(1,(s.landingAge??1)+dt);
 if(p.onGround){s.coyote=0.1;s.airJumps=0;if(s.wasAirborne)s.landingAge=0;}
 else s.coyote=Math.max(0,(s.coyote||0)-dt);
 const held=!!input.up;
 if(held&&!s.jumpHeld)sonicJump(s,s.titan==='wyvern'?15:24);
 if(!held&&s.jumpHeld&&s.stage==='traversal'&&p.vy>8)p.vy=8;
 s.jumpHeld=held;s.wasAirborne=!p.onGround;
}
export const superMoveReady=s=>s.stage==='combat'&&s.emerald===true;
export function clearSuperCooldowns(s) {
 if(superMoveReady(s))for(const k of Object.keys(s.cooldowns))s.cooldowns[k]=0;
}
export function restoreSonicMovement(s,raw) {
 const n=(v,d,hi)=>Number.isFinite(v)?Math.max(0,Math.min(hi,v)):d;
 s.jumpAge=n(raw.jumpAge,99,99);s.landingAge=n(raw.landingAge,1,1);
 s.airJumps=raw.airJumps===1?1:0;s.coyote=s.avatar.onGround?n(raw.coyote,0,0.1):0;
 for(const k of ['facingYaw','lastLookYaw'])if(Number.isFinite(raw.avatar?.[k]))s.avatar[k]=Math.atan2(Math.sin(raw.avatar[k]),Math.cos(raw.avatar[k]));
 s.jumpHeld=false;s.wasAirborne=!s.avatar.onGround;clearSuperCooldowns(s);
}
