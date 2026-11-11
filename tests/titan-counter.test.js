import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {wyvernSession,stepWyvern,wyvernInput,restoreWyvernSession} from '../src/wyvern-simulation.js';
import {titanSession,stepTitan,restoreTitanSession} from '../src/giganto-simulation.js';
import {runwayPoint,wyvernGround,WYVERN_RAIL_LENGTH,wyvernRegions} from '../src/wyvern-space.js';
import {wyvernLocalPoint,wyvernWorldPoint,wyvernSceneryData,constrainWyvernScenery,clearWyvernSceneryCamera} from '../src/wyvern-world.js';
import {wyvernFlightFrame,wyvernDaylight} from '../src/wyvern-choreography.js';
import {regionContact} from '../src/titan-contact.js';
import {SonicJumpBall} from '../src/sonic-jump-ball.js';
import {stabilizeTitanShadow} from '../src/titan-shadow.js';
const fight=()=>{const s=wyvernSession({drain:0});Object.assign(s,{stage:'combat',emerald:true,rings:400});Object.assign(s.wyvern,{yaw:Math.PI,flightTime:6,timer:100});Object.assign(s.avatar,{x:0,y:100,z:600,yaw:0,onGround:false});return s;};
const missile=s=>{s.wyvern.missiles=[{id:1,age:0.99,eta:1,reflected:false,from:{x:40,y:110,z:0},target:{x:s.avatar.x,y:s.avatar.y+1.8,z:s.avatar.z}}];};
test('a single missile flick starts a physical homing approach, opens both phases and permits real damage without claw parries',()=>{
 for(const phase of [1,2]){const s=fight();s.phase=phase;missile(s);const start={...s.avatar};stepWyvern(s,{parry:true});
  assert.equal(s.wyvern.mode,'open');assert.ok(s.wyvern.open>11);assert.ok(Math.hypot(s.avatar.x-start.x,s.avatar.y-start.y,s.avatar.z-start.z)<5);assert.equal(s.strike.move,'homing');assert.equal(s.stage,'combat');assert.equal(s.counter,0);
  assert.equal(s.events.filter(e=>e.type==='wyvern-blink').length,0);assert.equal(s.events.filter(e=>e.type==='parry').length,1);
  for(const r of wyvernRegions(s))assert.ok(!regionContact(r,{...s.avatar,y:s.avatar.y+1.8}).inside,r.id);
  const hp=s.hp;let contacts=0,launches=0,followups=0;assert.equal(wyvernInput(s,'hit'),true);for(let i=0;i<180;i++){stepWyvern(s,{});contacts+=s.events.filter(e=>e.type==='hit'&&e.kind==='homing').length;followups+=s.events.filter(e=>e.type==='hit'&&e.kind!=='homing').length;launches+=s.events.filter(e=>e.type==='homing').length;}assert.equal(contacts,1);assert.equal(launches,1);assert.ok(followups>0);assert.ok(s.hp<hp);
  assert.equal(s.wyvern.mode,"open");
 }
});
test('generous early and late missile timing remains press based rather than an indefinite guard',()=>{
 const early=fight();for(let i=0;i<28;i++)stepWyvern(early,{parry:true});missile(early);stepWyvern(early,{parry:true});assert.equal(early.wyvern.mode,'open');
 const late=fight();missile(late);stepWyvern(late,{});for(let i=0;i<5;i++)stepWyvern(late,{});stepWyvern(late,{parry:true});assert.equal(late.wyvern.mode,'open');
 const held=fight();for(let i=0;i<50;i++)stepWyvern(held,{parry:true});missile(held);for(let i=0;i<12;i++)stepWyvern(held,{parry:true});assert.equal(held.wyvern.open,0);assert.ok(held.rings<400);
});
test('ribbon supports idle, smooth boost, braking, reversing, steering and collision-aligned terrain clearance',()=>{
 const s=wyvernSession({drain:0});s.stage='traversal';Object.assign(s.wyvern,{section:'runway',rail:10});Object.assign(s.avatar,runwayPoint(10),{onGround:true,vx:0,vy:0,vz:0});
 for(let i=0;i<30;i++)stepWyvern(s,{});assert.ok(Math.abs(s.wyvern.rail-10)<0.01);
 for(let i=0;i<30;i++)stepWyvern(s,{boost:true,moveY:0,moveX:0.6});assert.ok(s.avatar.x>runwayPoint(10).x+12);
 const speed=s.wyvern.railSpeed;stepWyvern(s,{});assert.ok(s.wyvern.railSpeed>0&&s.wyvern.railSpeed<speed);
 for(let i=0;i<45;i++)stepWyvern(s,{moveY:-1});assert.ok(s.avatar.vz>0);
 for(let t=0;t<=WYVERN_RAIL_LENGTH;t+=4)for(const lane of [-1,0,1]){const p=runwayPoint(t,lane);assert.ok(p.y-wyvernGround(p.x,p.z)>=20,JSON.stringify({t,lane,p}));}
});
test('retry and reload preserve away-facing Wyvern and original daylight without relocating the saved avatar',()=>{
 const s=fight();s.stage='defeat';s.checkpoint='phase2';wyvernInput(s,'retry');assert.equal(s.wyvern.yaw,Math.PI);assert.ok(s.avatar.z>500);
 s.wyvern.skyClock=81;s.wyvern.flightTime=130;s.avatar.x=33;const r=restoreWyvernSession(JSON.parse(JSON.stringify(s)));assert.equal(r.wyvern.skyClock,81);assert.equal(r.wyvern.yaw,Math.PI);assert.equal(r.avatar.x,33);
 const legacy=JSON.parse(JSON.stringify(s));delete legacy.wyvern.skyClock;legacy.config.arenaDayLength=240;const restored=restoreWyvernSession(legacy);assert.ok(Math.abs(wyvernDaylight(restored)-1)<1e-9);
});
test('rendered rocks share player and camera collision placements, even at low quality',()=>{
 const s=fight(),o=wyvernSceneryData().active.find(o=>o.kind==='rock');assert.ok(o);
 const q={x:o.x,y:o.y,z:o.z},p=wyvernLocalPoint(wyvernFlightFrame(s),q);constrainWyvernScenery(s,p);const out=wyvernWorldPoint(s,p);assert.ok(Math.hypot(out.x-q.x,out.z-q.z)>20);
 const focus=wyvernLocalPoint(wyvernFlightFrame(s),{x:o.x+200,y:o.y,z:o.z}),cam=clearWyvernSceneryCamera(s,wyvernLocalPoint(wyvernFlightFrame(s),q),focus);const world=wyvernWorldPoint(s,cam);assert.ok(Math.hypot(world.x-o.x,world.z-o.z)>20);
});
test('curled jump is a single uniform blue form, pauses without motion, and restores the skin rig on landing or transformation',()=>{
 const scene=new T.Scene(),ball=new SonicJumpBall(scene),root=new T.Group();root.userData.model=new T.Group();
 for(const which of ['giganto','wyvern']){const s=which==='wyvern'?wyvernSession():titanSession();s.stage='traversal';s.jumpAge=0.3;s.avatar.onGround=false;
  for(let i=0;i<20;i++)ball.update(s,root,1/60);assert.equal(ball.group.visible,true);assert.equal(root.userData.model.visible,false);assert.equal(ball.group.scale.x,ball.group.scale.y);
  const before=ball.core.quaternion.clone();ball.update(s,root,0);assert.ok(before.angleTo(ball.core.quaternion)<1e-7);
  s.config.particles=false;ball.update(s,root,1/60);assert.equal(ball.halo.visible,false);assert.equal(ball.core.visible,true);
  s.avatar.onGround=true;for(let i=0;i<30;i++)ball.update(s,root,1/60);assert.equal(root.userData.model.visible,true);assert.equal(ball.group.visible,false);
  s.avatar.onGround=false;s.jumpAge=0.3;for(let i=0;i<20;i++)ball.update(s,root,1/60);s.emerald=true;ball.update(s,root,1/60);assert.equal(ball.group.visible,false);assert.equal(root.userData.model.visible,true);
 }ball.dispose();assert.equal(scene.children.length,0);
});
test('shadow camera snaps movement in light space to texels, preserving the light direction',()=>{
 const light=new T.DirectionalLight(),focus=new T.Vector3(20,30,40),offset=new T.Vector3(-140,230,100);Object.assign(light.shadow.camera,{left:-200,right:200});
 stabilizeTitanShadow(light,focus,offset,2048);const a=light.target.position.clone();stabilizeTitanShadow(light,focus.clone().add(new T.Vector3(0.00001,0,0)),offset,2048);
 const direction=offset.clone().normalize(),shift=light.target.position.clone().sub(a);assert.ok(shift.clone().addScaledVector(direction,-shift.dot(direction)).length()<1e-7);assert.ok(light.position.clone().sub(light.target.position).distanceTo(offset)<1e-7);
});
test('both arenas use a slow persisted sky clock and preserve its position through reload',()=>{
 const g=titanSession({drain:0});g.stage='traversal';g.original={};assert.equal(g.config.arenaDayLength,900);for(let i=0;i<120;i++)stepTitan(g,{});assert.ok(Math.abs(g.skyClock-2)<1e-8);assert.equal(restoreTitanSession(JSON.parse(JSON.stringify(g))).skyClock,g.skyClock);
 const w=fight();const before=wyvernDaylight(w);for(let i=0;i<120;i++)stepWyvern(w,{});assert.ok(wyvernDaylight(w)-before<0.01);const re=restoreWyvernSession(JSON.parse(JSON.stringify(w)));assert.equal(wyvernDaylight(re),wyvernDaylight(w));
});

test('missing a nearby missile retains the optional claw threat without making its parry mandatory',()=>{
 const s=fight();Object.assign(s.avatar,{x:0,y:65,z:-43});missile(s);for(let i=0;i<12;i++)stepWyvern(s,{});assert.ok(['claws','bite'].includes(s.wyvern.mode));
 s.avatar.x=160;for(let i=0;i<150;i++)stepWyvern(s,{});assert.equal(s.wyvern.mode,'missiles');
 missile(s);stepWyvern(s,{parry:true});assert.equal(s.wyvern.mode,'open');assert.ok(s.wyvern.open>11);
});
