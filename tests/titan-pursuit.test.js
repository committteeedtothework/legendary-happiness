import test from 'node:test';
import assert from 'node:assert/strict';
import {wyvernSession,stepWyvern,restoreWyvernSession} from '../src/wyvern-simulation.js';
import {titanSession,titanInput,stepTitan,restoreTitanSession} from '../src/giganto-simulation.js';
import {wyvernWorldPoint} from '../src/wyvern-world.js';
import {wyvernFlightFrame} from '../src/wyvern-choreography.js';
import {wyvernRoutePoint,WYVERN_ROUTE_LENGTH,wyvernRouteDistance} from '../src/wyvern-route.js';
import {wyvernGround} from '../src/wyvern-space.js';
import {sonicJump,tickSonicMovement} from '../src/sonic-movement.js';
import {TitanBoostAudio} from '../src/titan-boost.js';
function flight(){const s=wyvernSession({drain:0});Object.assign(s,{stage:'combat',emerald:true,rings:400});Object.assign(s.wyvern,{flightTime:6,routeDistance:1500,timer:100});Object.assign(s.avatar,{x:0,y:65,z:300,vx:0,vy:0,vz:0,yaw:0,onGround:false});return s;}
test('idle Sonic stays in world space while Wyvern pulls away; boost catches the independently moving Titan',()=>{
 const s=flight(),start=wyvernWorldPoint(s,s.avatar),initial=Math.hypot(s.avatar.x,s.avatar.z);
 for(let i=0;i<120;i++)stepWyvern(s,{});
 const end=wyvernWorldPoint(s,s.avatar),far=Math.hypot(s.avatar.x,s.avatar.z);
 assert.ok(Math.hypot(start.x-end.x,start.y-end.y,start.z-end.z)<0.01);assert.ok(far>initial+80);
 for(let i=0;i<180;i++)stepWyvern(s,{boost:true});
 assert.ok(Math.hypot(s.avatar.x,s.avatar.z)<far-70);assert.equal(s.wyvern.open,0);
});
test('the route is continuous through its seam and travels through substantial terrain relief',()=>{
 const before=wyvernRoutePoint(WYVERN_ROUTE_LENGTH-0.01),after=wyvernRoutePoint(0.01);
 assert.ok(Math.hypot(before.x-after.x,before.z-after.z)<0.025);assert.ok(Math.abs(Math.atan2(Math.sin(before.yaw-after.yaw),Math.cos(before.yaw-after.yaw)))<0.01);
 let tallest=0;
 for(let d=1000;d<WYVERN_ROUTE_LENGTH;d+=500){const p=wyvernRoutePoint(d),n={x:Math.cos(p.yaw),z:-Math.sin(p.yaw)};const floor=wyvernGround(p.x,p.z);const side=wyvernGround(p.x+n.x*550,p.z+n.z*550);tallest=Math.max(tallest,side-floor);assert.ok(wyvernRouteDistance(p.x,p.z)<3);}
 assert.ok(tallest>160);assert.ok(WYVERN_ROUTE_LENGTH>10000);
});
test('Super Sonic removes move timers in both encounters, including loaded timers; no energy resource remains and animation contacts stay bounded',()=>{
 for(const which of ['giganto','wyvern']){
  const s=which==='giganto'?titanSession({colossalScale:false}):wyvernSession();Object.assign(s,{stage:'combat',emerald:true,original:{x:0,y:80,z:0}});Object.assign(s.avatar,{x:0,y:60,z:43,onGround:false});
  if(s.wyvern){s.wyvern.open=100;s.wyvern.flightTime=6;}
  for(const k of Object.keys(s.cooldowns))s.cooldowns[k]=9;
  assert.equal(titanInput(s,'boom'),true);assert.ok(Object.values(s.cooldowns).every(v=>v===0));const before=s.energy;assert.equal(before,undefined);
  const raw=JSON.parse(JSON.stringify(s));raw.cooldowns.boom=8;
  const restored=which==='giganto'?restoreTitanSession(raw):restoreWyvernSession(raw);assert.ok(Object.values(restored.cooldowns).every(v=>v===0));
 }
});
test('normal Sonic jumps, can steer in air, double jump once and cannot regain that jump by reloading',()=>{
 const s=wyvernSession({drain:0});s.stage='traversal';s.avatar.onGround=true;
 assert.equal(sonicJump(s,15),true);for(let i=0;i<10;i++)stepWyvern(s,{right:true,up:true});
 assert.ok(s.avatar.y>0.5);assert.ok(s.avatar.vx>0);assert.equal(sonicJump(s,15),true);assert.equal(s.airJumps,1);
 const r=restoreWyvernSession(JSON.parse(JSON.stringify(s)));r.jumpAge=0.2;assert.equal(sonicJump(r,15),false);assert.equal(r.airJumps,1);
 for(let i=0;i<240;i++)stepWyvern(s,{});assert.equal(s.avatar.onGround,true);assert.equal(s.airJumps,0);
});
test('boost starts at the audible attack with no scheduled delay and does not duplicate on repeated updates',()=>{
 const starts=[],node=()=>({connect(){},disconnect(){}}),p={value:0,setValueAtTime(){},linearRampToValueAtTime(){},cancelScheduledValues(){}};
 const ctx={currentTime:42,createGain:()=>({...node(),gain:{...p}}),createBufferSource:()=>({...node(),start(...a){starts.push(a);},stop(){}})};
 const boost=new TitanBoostAudio(ctx,node());boost.buffer={duration:9};
 const s={stage:'traversal',boosting:true,config:{audio:true}};boost.update(s,true,{volume:1});boost.update(s,true,{volume:1});
 assert.deepEqual(starts,[[42,0.425]]);assert.equal(boost.starts,1);boost.dispose();
});

test('no-cooldown dodge cannot restart an in-progress animation or repeatedly extend its contact protection',()=>{
 const s=titanSession();Object.assign(s,{stage:'combat',emerald:true});assert.equal(titanInput(s,'dodge'),true);
 const duration=s.dodge;assert.equal(s.cooldowns.dodge,0);assert.equal(titanInput(s,'dodge'),false);assert.equal(s.dodge,duration);
});

test('enlarged cinematic throws gain clearance above the surrounding cliffs and preserve that altitude on pause/reload',()=>{
 const s=flight();s.stage='wyvern-counter';s.stageTime=0;s.wyvern.cinematicFrom={...s.avatar};
 for(let i=0;i<180;i++)stepWyvern(s,{});
 assert.ok(s.wyvern.cinemaLift>400);const f=wyvernFlightFrame(s),p=wyvernWorldPoint(s,{x:0,y:66,z:0});
 assert.ok(p.y>500);const r=restoreWyvernSession(JSON.parse(JSON.stringify(s)));assert.equal(r.wyvern.cinemaLift,s.wyvern.cinemaLift);assert.deepEqual(wyvernFlightFrame(r),f);
});
