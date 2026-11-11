import { WYVERN_ROUTE } from '../src/wyvern-route.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {wyvernSession,stepWyvern,restoreWyvernSession} from '../src/wyvern-simulation.js';
import {wyvernGround,wyvernRegions,WYVERN_SCALE} from '../src/wyvern-space.js';
import {wyvernFloor,clearWyvernTerrainCamera,wyvernScenerySafe,WYVERN_LIMITS} from '../src/wyvern-world.js';
import {wyvernMissilePoint} from '../src/wyvern-choreography.js';
import {WyvernMissiles} from '../src/wyvern-missiles.js';
import {constrainTitanBody,regionContact} from '../src/titan-contact.js';
function fight(){const s=wyvernSession({drain:0});Object.assign(s,{stage:'combat',emerald:true,rings:400});Object.assign(s.avatar,{x:0,y:65,z:43,onGround:false,yaw:0});s.wyvern.timer=100;s.wyvern.flightTime=6;return s;}
function incoming(s){s.wyvern.missiles=[{id:1,age:0.99,eta:1,from:{x:0,y:66,z:0},target:{x:s.avatar.x,y:s.avatar.y+1.8,z:s.avatar.z},reflected:false}];}
test('Wyvern gains a larger health pool and old saves retain their remaining health fraction',()=>{
 const s=fight();assert.equal(s.maxHp,220000);
 const raw=JSON.parse(JSON.stringify(s));raw.maxHp=80000;raw.hp=32000;
 const restored=restoreWyvernSession(raw);assert.equal(restored.hp,88000);assert.equal(restored.maxHp,220000);
 assert.equal(restoreWyvernSession(JSON.parse(JSON.stringify(restored))).hp,88000);
});
test('a held guard expires; a fresh timed parry reflects once with real-time slow motion and continuous music clock',()=>{
 const stale=fight();for(let i=0;i<35;i++)stepWyvern(stale,{parry:true});incoming(stale);for(let i=0;i<12;i++)stepWyvern(stale,{parry:true});
 assert.equal(stale.wyvern.missiles.length,0);assert.ok(stale.rings<400);
 const s=fight();incoming(s);stepWyvern(s,{parry:true});assert.equal(s.events.filter(e=>e.type==='parry').length,1);assert.equal(s.events.find(e=>e.type==='parry').style,'flick');
 assert.ok(s.wyvern.missiles[0].reflected);const time=s.time,music=s.wyvern.musicTime;
 stepWyvern(s,{parry:true});assert.ok(Math.abs(s.time-time-(1/60)*0.22)<1e-8);assert.ok(Math.abs(s.wyvern.musicTime-music-1/60)<1e-8);
 assert.equal(s.events.filter(e=>e.type==='parry').length,0);
 for(let i=0;i<32;i++)stepWyvern(s,{});assert.equal(s.wyvern.timeScale,1);assert.equal(s.wyvern.parrySlow,0);
 const reload=restoreWyvernSession(JSON.parse(JSON.stringify(s)));assert.equal(reload.wyvern.parrySlow,0);assert.equal(reload.parryHeld,false);
});
test('slow motion duration remains bounded at 30, 60 and 144 updates per second',()=>{
 const durations=[];
 for(const fps of [30,60,144]) {const s=fight();s.wyvern.parrySlow=0.46;let frames=0;while(s.wyvern.parrySlow>0&&frames<fps){stepWyvern(s,{},1/fps);frames++;}durations.push(frames/fps);}
 for(const t of durations)assert.ok(Math.abs(t-0.46)<0.035);
});
test('expanded flight supports movement beyond the old 140 metre boundary and respects the new limit',()=>{
 const s=fight();s.avatar.x=145;s.avatar.y=100;s.wyvern.timer=100;
 for(let i=0;i<300;i++)stepWyvern(s,{right:true,boost:true});
 assert.ok(s.avatar.x>200);assert.ok(Math.hypot(s.avatar.x,s.avatar.z)<=WYVERN_LIMITS.flightRadius+0.01);assert.ok(s.avatar.y>=wyvernFloor(s,s.avatar));
});
test('terrain floor agrees with both actual rendered triangle grids throughout the enlarged map',()=>{
 for(const segments of [64,128]) {
  const geo=new T.PlaneGeometry(6400,6400,segments,segments).rotateX(-Math.PI/2),pos=geo.attributes.position;
  for(let i=0;i<pos.count;i++)pos.setY(i,wyvernGround(pos.getX(i),pos.getZ(i)));
  const index=geo.index;
  for(let i=0;i<index.count;i+=Math.max(3,Math.floor(index.count/200/3)*3)) {
   const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)],w=[0.2,0.3,0.5];
   const q={x:0,y:0,z:0};for(let j=0;j<3;j++)for(const k of ['x','y','z'])q[k]+=pos['get'+k.toUpperCase()](ids[j])*w[j];
   assert.ok(Math.abs(q.y-wyvernGround(q.x,q.z))<1e-4,JSON.stringify({segments,q,floor:wyvernGround(q.x,q.z)}));
  }
  geo.dispose();
 }
});
test('camera boom clears world terrain in the moving flight frame and scenery avoids flight corridors',()=>{
 const s=fight();for(const t of [0,25,60,120,240]) {
  s.wyvern.flightTime=t;const focus={x:20,y:80,z:35},camera=clearWyvernTerrainCamera(s,{x:-60,y:-100,z:90},focus);
  for(let i=1;i<=24;i++){const u=i/24,q={x:focus.x+(camera.x-focus.x)*u,y:focus.y+(camera.y-focus.y)*u,z:focus.z+(camera.z-focus.z)*u};assert.ok(q.y>=wyvernFloor(s,q)+1.29);}
 }
 for(const p of WYVERN_ROUTE)assert.equal(wyvernScenerySafe(p.x,p.z),false);
});
test('body contacts eject flight points from the posed spine instead of leaving Sonic inside it',()=>{
 const s=fight();for(const time of [0,1,5,13]){s.time=time;for(const r of wyvernRegions(s).filter(r=>r.id.startsWith('spine'))) {
  const p={x:r.a.x,y:r.a.y-1.8,z:r.a.z};constrainTitanBody(p,s);
  assert.ok(wyvernRegions(s).filter(r=>!r.id.includes('claw')).every(r=>!regionContact(r,{...p,y:p.y+1.8}).inside));
 }}
});
test('all missile parts share forward orientation, six metre silhouettes and bounded instanced pools',()=>{
 const parent=new T.Group(),pool=new WyvernMissiles(parent);
 pool.update([{x:2,y:3,z:4,dir:new T.Vector3(1,0,0)}],1);assert.equal(pool.meshes.length,4);
 for(const m of pool.meshes){assert.equal(m.count,1);const matrix=new T.Matrix4();m.getMatrixAt(0,matrix);const forward=new T.Vector3(0,0,1).transformDirection(matrix);assert.ok(forward.distanceTo(new T.Vector3(1,0,0))<1e-6);m.geometry.dispose();m.material.dispose();}
});

test('live missiles launch outside Wyvern and their lofted incoming/reflected paths clear its body',()=>{
 const s=fight();s.wyvern.timer=0;stepWyvern(s,{});const m=s.wyvern.missiles[0];assert.ok(m);assert.ok(m.from.y>80);assert.ok(Math.abs(m.from.x)>20);
 for(const reflected of [false,true])for(let i=0;i<=40;i++) {
  const q=wyvernMissilePoint({...m,reflected,age:m.eta*i/40});
  for(const r of wyvernRegions(s).filter(r=>!r.id.includes('claw')))assert.ok(!regionContact(r,q).inside,JSON.stringify({reflected,i,q,region:r.id}));
 }
});
