import test from 'node:test';
import assert from 'node:assert/strict';
import {titanSession,titanInput,stepTitan,restoreTitanSession} from '../src/giganto-simulation.js';
import {wyvernSession,wyvernInput,stepWyvern,restoreWyvernSession} from '../src/wyvern-simulation.js';
import {TOWER,WYVERN_TOWER,runwayPoint,wyvernGround,wyvernRegions} from '../src/wyvern-space.js';
import {wyvernRoutePoint,WYVERN_ROUTE_LENGTH} from '../src/wyvern-route.js';
import {wyvernFlightFrame} from '../src/wyvern-choreography.js';
import {wyvernPassages} from '../src/wyvern-passages.js';
import {wyvernWorldPoint} from '../src/wyvern-world.js';
import {sweepTitanMotion,constrainBoxes,clearBoxCamera} from '../src/titan-collision.js';
import {constrainTitanBody,titanBodyRegions,regionContact} from '../src/titan-contact.js';
import {sonicLength} from '../src/titan-metrics.js';
import {sonicTraversalInput,applySonicTraversal} from '../src/sonic-traversal.js';
const variants=[['giganto',titanSession,titanInput,stepTitan,restoreTitanSession],['wyvern',wyvernSession,wyvernInput,stepWyvern,restoreWyvernSession]];
const wrap=x=>Math.atan2(Math.sin(x),Math.cos(x));
for(const [name,make,input,step,restore] of variants){
 test(name+' retains body heading while the idle camera turns and preserves it on save',()=>{
  const s=make({drain:0});s.stage='traversal';s.original={};Object.assign(s.avatar,{x:0,y:0,z:150,yaw:0,onGround:true});
  for(let i=0;i<20;i++)step(s,{right:true});const facing=s.avatar.facingYaw;
  for(let i=0;i<90;i++)step(s,{});assert.ok(Math.abs(wrap(s.avatar.facingYaw-facing))<1e-8);
  s.avatar.yaw+=0.7;step(s,{});assert.ok(Math.abs(wrap(s.avatar.facingYaw-facing))<1e-8);
  const r=restore(JSON.parse(JSON.stringify(s)));assert.ok(r);assert.ok(Math.abs(wrap(r.avatar.facingYaw-s.avatar.facingYaw))<1e-8);
 });
 test(name+' exposes jump, double jump, air dash, stomp, slide, roll, parry and attack before combat without boss damage',()=>{
  const s=make({drain:0});s.stage='traversal';Object.assign(s.avatar,{x:0,y:0,z:150,onGround:true});const hp=s.hp;
  assert.equal(input(s,'jump'),true);for(let i=0;i<10;i++)step(s,{});assert.equal(input(s,'jump'),true);
  assert.equal(s.airJumps,1);assert.equal(input(s,'homing'),true);assert.equal(input(s,'stomp'),true);
  for(let i=0;i<120;i++)step(s,{});assert.equal(s.avatar.onGround,true);
  assert.equal(input(s,'shot'),true);for(let i=0;i<20;i++)step(s,{});assert.ok(Math.hypot(s.avatar.vx,s.avatar.vz)>10);
  assert.equal(input(s,'spin'),true);assert.equal(input(s,'hit'),true);step(s,{parry:true});assert.equal(s.action,'parry');assert.equal(s.hp,hp);
 });
 test(name+' sweeps fast movement past visible body parts rather than passing straight through them',()=>{
  const s=make();s.stage='combat';s.emerald=true;const r=titanBodyRegions(s).find(r=>r.id==='head'),from={x:r.center.x-70,y:r.center.y-sonicLength(s,1.8),z:r.center.z};
  Object.assign(s.avatar,from,{vx:200,vy:0,vz:0});s.avatar.x+=140;const samples=[];
  sweepTitanMotion(s,from,p=>{constrainTitanBody(p,s);samples.push({...p});});
  assert.ok(samples.length>100);assert.ok(samples.every(p=>!regionContact(r,{...p,y:p.y+sonicLength(s,1.8)}).inside));
  assert.ok(s.avatar.x<r.center.x+50 || Math.abs(s.avatar.y-from.y)>5);
 });
}
test('the 200m tower has a playable expanded ramp and boostable wall, not a taller visual shell',()=>{
 assert.equal(TOWER.height,200);assert.equal(TOWER.radius,42);assert.equal(WYVERN_TOWER.at(-1).y,200);
 const s=wyvernSession({drain:0});s.stage='traversal';Object.assign(s.avatar,{x:TOWER.x+37,y:0.05,z:TOWER.z,yaw:Math.PI/2,vx:0,vy:0,vz:0,onGround:true});
 for(let i=0;i<90;i++)stepWyvern(s,{forward:true,boost:true});assert.ok(s.avatar.y>35);assert.ok(s.avatar.x>TOWER.x+20);
 const legacy=JSON.parse(JSON.stringify(s));delete legacy.wyvern.towerVersion;legacy.wyvern.tower=96;legacy.avatar.y=40;legacy.avatar.x=-68+17;legacy.avatar.z=42;
 const r=restoreWyvernSession(legacy);assert.equal(r.avatar.y,100);assert.equal(r.avatar.x,TOWER.x+42);const twice=restoreWyvernSession(JSON.parse(JSON.stringify(r)));assert.equal(twice.avatar.y,100);
});
test('ribbon steering changes physical position freely and never assigns it from a lane value',()=>{
 const s=wyvernSession({drain:0});s.stage='traversal';s.lock=false;s.wyvern.section='runway';s.wyvern.rail=600;Object.assign(s.avatar,runwayPoint(600),{onGround:true,vx:0,vy:0,vz:0,yaw:0});
 const x=s.avatar.x;for(let i=0;i<75;i++)stepWyvern(s,{right:true,boost:true});assert.ok(s.avatar.x>x+40);assert.ok(s.avatar.y<runwayPoint(600).y-5);
 const saved=restoreWyvernSession(JSON.parse(JSON.stringify(s)));assert.ok(Math.abs(saved.avatar.x-s.avatar.x)<1e-8);assert.ok(Math.abs(saved.avatar.y-s.avatar.y)<1e-8);
});
test('Light Dash travels through a ring chain continuously and can be interrupted by a real solid barrier',()=>{
 const s=wyvernSession();s.stage='traversal';Object.assign(s.avatar,{x:0,y:1,z:30,yaw:0,onGround:false});
 const targets=Array.from({length:14},(_,i)=>({x:0,y:1,z:26-i*2}));assert.equal(sonicTraversalInput(s,'boom',targets),true);
 const box={x:0,y:3,z:16,w:10,h:10,d:1};let old={...s.avatar};
 for(let i=0;i<20;i++){applySonicTraversal(s,{},1/60);old={...s.avatar};for(const [k,v]of[['x','vx'],['y','vy'],['z','vz']])s.avatar[k]+=s.avatar[v]/60;sweepTitanMotion(s,old,p=>constrainBoxes(p,[box]));}
 assert.ok(s.avatar.z>16);assert.ok(s.avatar.z<30);
});
test('thin roofs and piers block high-speed flight and camera booms in either direction',()=>{
 const box={x:0,y:20,z:0,w:2,h:40,d:50,yaw:0.2};
 for(const sign of [-1,1]){const s=wyvernSession(),from={x:-sign*50,y:20,z:0};Object.assign(s.avatar,{...from,vx:sign*300,vy:0,vz:0});s.avatar.x=sign*50;sweepTitanMotion(s,from,p=>constrainBoxes(p,[box]));assert.ok(sign*(s.avatar.x*Math.cos(box.yaw)-s.avatar.z*Math.sin(box.yaw))<0);
  const c=clearBoxCamera({x:sign*50,y:22,z:0},{x:-sign*50,y:22,z:0},[box]);assert.ok(sign*c.x<0);
 }
 const s=wyvernSession();Object.assign(s.avatar,{x:500,y:-40,z:500});constrainTitanBody(s.avatar,s);assert.equal(s.avatar.y,-40);
});
test('the canyon route changes direction and altitude and has four real overhead passages with shared collision',()=>{
 const turns=[];let min=Infinity,max=-Infinity;
 for(let d=0;d<WYVERN_ROUTE_LENGTH;d+=120){const q=wyvernRoutePoint(d);turns.push(q.bend);min=Math.min(min,q.rise);max=Math.max(max,q.rise);}
 assert.ok(turns.some(t=>t>0.04)&&turns.some(t=>t<-0.04));assert.ok(max-min>60);assert.equal(wyvernPassages().arches.length,4);
 const s=wyvernSession();Object.assign(s,{stage:'combat',emerald:true});Object.assign(s.wyvern,{yaw:Math.PI,flightTime:6});
 for(const arch of wyvernPassages().arches){s.wyvern.routeDistance=arch.distance;const center=wyvernWorldPoint(s,{x:0,y:66,z:0});assert.ok(center.y<arch.y-45);assert.ok(center.y>wyvernGround(center.x,center.z)+100);
  const camera=clearBoxCamera({x:arch.x,y:arch.y+100,z:arch.z},{x:arch.x,y:arch.y-100,z:arch.z},wyvernPassages().boxes);assert.ok(camera.y<arch.y);
 }
});
