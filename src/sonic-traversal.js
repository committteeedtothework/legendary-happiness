import {sonicJump} from './sonic-movement.js';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
const state=s=>s.traversalKit ||= {dash:[],roll:0,slide:0,stomp:false,drop:false,dodge:0,combo:0,lastHit:-10};
const heading=p=>Number.isFinite(p.facingYaw)?p.facingYaw:p.yaw+Math.PI;
function cancel(q){q.dash=[];q.roll=q.slide=q.dodge=0;q.stomp=q.drop=q.dropKey=false;}
export function sonicTraversalInput(s,action,targets=[],emit=()=>{}){
 if(s.stage!=='traversal'||s.emerald||s.climb?.attached)return false;
 const p=s.avatar,q=state(s),say=(name,duration)=>{s.action=name;s.actionTime=duration;q.actionDuration=duration;};
 if(action==='jump')return sonicJump(s,s.titan==='wyvern'?15:24);
 if(action==='target'){s.lock=!s.lock;return true;}
 if(action==='dodge'&&q.dodge<=0){
  cancel(q);q.dodge=0.22;const side=Math.sign(p.moveX)||1;q.dodgeX=Math.cos(p.yaw)*side;q.dodgeZ=-Math.sin(p.yaw)*side;
  s.dodge=0.22;s.iframes=Math.max(s.iframes,0.22);say('dodge',0.3);return true;
 }
 if(action==='stomp'&&!p.onGround){cancel(q);q.stomp=true;p.vy=-55;say('stomp',0.8);return true;}
 if(action==='spin'){cancel(q);q.dropKey=true;q.drop=!p.onGround;q.roll=p.onGround?0.9:0;q.moveHeading=heading(p);say('spin',0.9);return true;}
 if(action==='shot'&&p.onGround){cancel(q);q.slide=0.7;q.moveHeading=heading(p);say('slide',0.7);return true;}
 if(action==='hit'&&s.time-q.lastHit>0.18){q.combo=(q.combo+1)%3;q.lastHit=s.time;say('hit',0.32);return true;}
 if(action==='homing'||action==='boom'){
  if(q.dash.length)return false;
  const list=targets.map((t,i)=>{const d=distance(t,p),dot=-(t.x-p.x)*Math.sin(p.yaw)-(t.z-p.z)*Math.cos(p.yaw);return{t,i,d,dot,score:d*(1.5-0.5*dot/Math.max(0.001,d))};}).filter(v=>v.d>1.5&&v.d<65&&v.dot/Math.max(0.001,v.d)>-0.15).sort((a,b)=>a.score-b.score);
  let path;
  if(!list.length){if(action==='boom'||(!p.onGround&&q.airDashUsed))return false;path=[{x:p.x-Math.sin(p.yaw)*14,y:p.y+1,z:p.z-Math.cos(p.yaw)*14}];q.airDashUsed=true;}
  else {
   const first=list[0];path=[{...first.t}];
   if(action==='boom')for(let i=first.i+1;i<targets.length&&path.length<14;i++){const t=targets[i],last=path.at(-1);if(distance(last,t)>28||distance(p,t)>85)break;path.push({...t});}
  }
  cancel(q);q.dash=path;q.age=q.totalAge=q.blockedAge=0;q.lastDistance=Infinity;p.onGround=false;say('homing',1);s.jumpAge=0;emit('homing');return true;
 }
 return false;
}
export function applySonicTraversal(s,input,dt,emit=()=>{}){
 if(s.stage!=='traversal'||s.emerald)return 1;
 const p=s.avatar,q=state(s);
 if(p.onGround){
  q.airDashUsed=false;
  if(q.drop){q.drop=q.dropKey=false;q.roll=0.9;q.moveHeading=heading(p);emit('impact',{point:{...p},strength:0.25});}
  if(q.stomp){q.stomp=false;emit('impact',{point:{...p},strength:0.65});}
 }else if(!q.dropKey)q.drop=s.airJumps===1&&input.up&&s.jumpAge>0.18;
 q.dodge=Math.max(0,q.dodge-dt);
 if(q.dash.length){
  q.totalAge=(q.totalAge||0)+dt;q.age=(q.age||0)+dt;
  while(q.dash.length&&(distance(p,q.dash[0])<2.0||q.age>0.45)){q.dash.shift();q.age=0;q.lastDistance=Infinity;}
  if(q.totalAge>1.1)q.dash=[];
  if(q.dash.length){const target=q.dash[0],d=distance(p,target);
   q.blockedAge=d>q.lastDistance-0.03?(q.blockedAge||0)+dt:0;q.lastDistance=d;
   if(q.blockedAge>0.12){q.dash=[];p.vx*=0.2;p.vz*=0.2;}
   else {const speed=Math.min(95,d/dt);p.vx=(target.x-p.x)/d*speed;p.vy=(target.y-p.y)/d*speed;p.vz=(target.z-p.z)/d*speed;
    if(Math.hypot(p.vx,p.vz)>0.01)p.facingYaw=Math.atan2(p.vx,p.vz);
    s.action='homing';s.actionTime=0.15;p.onGround=false;return 0;
   }
  }
 }
 if(input.boost&&q.stomp){q.stomp=false;p.vy=Math.max(0,p.vy);}
 if(q.stomp){p.vy=-55;s.action='stomp';s.actionTime=0.2;}
 for(const k of ['roll','slide']){
  q[k]=Math.max(0,q[k]-dt);if(!q[k])continue;
  const target=heading(p),old=q.moveHeading??target;q.moveHeading=old+Math.atan2(Math.sin(target-old),Math.cos(target-old))*(1-Math.exp(-dt*8));
  const speed=(k==='roll'?52:34)*Math.min(1,q[k]/0.12),a=1-Math.exp(-dt*22);
  p.vx+=(Math.sin(q.moveHeading)*speed-p.vx)*a;p.vz+=(Math.cos(q.moveHeading)*speed-p.vz)*a;
  s.action=k==='roll'?'spin':'slide';s.actionTime=0.15;
 }
 if(q.dodge>0){const speed=28*Math.min(1,q.dodge/0.055);p.vx=(q.dodgeX??Math.cos(p.yaw))*speed;p.vz=(q.dodgeZ??-Math.sin(p.yaw))*speed;}
 if(input.parry){s.action='parry';s.actionTime=0.15;}
 if(input.hit)sonicTraversalInput(s,'hit',[],emit);
 return q.stomp?0:1;
}
export function restoreSonicTraversal(s,raw){
 const q=state(s),old=raw.traversalKit;if(!old)return;
 for(const k of ['roll','slide','dodge'])q[k]=Number.isFinite(old[k])?Math.max(0,Math.min(1,old[k])):0;
 q.drop=old.drop===true;q.dropKey=old.dropKey===true;q.stomp=old.stomp===true;q.airDashUsed=old.airDashUsed===true;
 q.dash=(Array.isArray(old.dash)?old.dash:[]).filter(p=>p&&['x','y','z'].every(k=>Number.isFinite(p[k])&&Math.abs(p[k])<4000)).slice(0,14).map(p=>({x:p.x,y:p.y,z:p.z}));
 for(const k of ['age','totalAge','blockedAge'])q[k]=Number.isFinite(old[k])?Math.max(0,Math.min(1.1,old[k])):0;
 for(const k of ['dodgeX','dodgeZ','moveHeading'])if(Number.isFinite(old[k]))q[k]=k==='moveHeading'?Math.atan2(Math.sin(old[k]),Math.cos(old[k])):Math.max(-1,Math.min(1,old[k]));
}

export function startSonicTraversalDash(s,path){
 const q=state(s);cancel(q);q.dash=path.map(p=>({...p}));q.age=q.totalAge=q.blockedAge=0;q.lastDistance=Infinity;
 q.actionDuration=0.65;s.action='homing';s.actionTime=0.65;s.jumpAge=0;s.avatar.onGround=false;
}
