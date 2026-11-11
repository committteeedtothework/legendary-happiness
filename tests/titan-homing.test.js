import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {titanSession,titanInput,stepTitan,restoreTitanSession,beginParryHoming,advanceStrike} from '../src/giganto-simulation.js';
import {wyvernSession,wyvernInput,stepWyvern,restoreWyvernSession} from '../src/wyvern-simulation.js';
import {nearestTitanSurface} from '../src/titan-contact.js';
import {sonicContact} from '../src/titan-metrics.js';
import {TITAN_ACTIONS} from '../src/titan-combat.js';
import {SonicJumpBall} from '../src/sonic-jump-ball.js';
import {titanHudTemplate} from '../src/titan-hud.js';
import {steerTitanHoming} from '../src/titan-homing.js';
function fight(which){const s=which==='wyvern'?wyvernSession({drain:0}):titanSession({drain:0,colossalScale:false,adaptiveBoss:false,bossMobility:false,cinematicPace:1});Object.assign(s,{stage:'combat',emerald:true,rings:400,idle:999});Object.assign(s.avatar,{x:0,y:57,z:45,vx:0,vy:0,vz:0,onGround:false});if(s.wyvern){Object.assign(s.wyvern,{yaw:Math.PI,flightTime:6,open:100,mode:'open',timer:100});Object.assign(s.avatar,{x:0,y:65,z:-90});}return s;}
const step=(s,input={},dt=1/60)=>(s.wyvern?stepWyvern:stepTitan)(s,input,dt);
for(const which of ['giganto','wyvern']){
 test(which+' has no energy resource, ability costs, boost drain or legacy save gate',()=>{
  for(const move of ['hit','boom','rush','loop','homing','cross','shot','stomp','spin','cyclone']){
   const s=fight(which);Object.assign(s.avatar,{x:0,y:57,z:5});if(s.wyvern)Object.assign(s.avatar,{x:0,y:65,z:-43});
   assert.equal(Object.hasOwn(s,'energy'),false);assert.equal(Object.values(TITAN_ACTIONS).some(v=>'cost'in v),false);
   s.energy=0;assert.equal((s.wyvern?wyvernInput:titanInput)(s,move),true,move+' is not gated by a legacy zero value');
  }
  const s=fight(which);s.original={};s.energy=0;for(let i=0;i<120;i++)step(s,{boost:true,up:true});assert.ok(s.boosting);assert.equal(s.energy,0);
  const restored=(s.wyvern?restoreWyvernSession:restoreTitanSession)(JSON.parse(JSON.stringify(s)));assert.equal(Object.hasOwn(restored,'energy'),false);
 });
 test(which+' homing travels continuously and registers exactly one physical hit at 30/60/144 Hz',()=>{
  for(const fps of [30,60,144]){
   const s=fight(which),from={...s.avatar},hp=s.hp;assert.ok(titanInput(s,'homing'));assert.deepEqual(s.avatar,from);let hits=0,launches=0,travel=0;
   for(let i=0;i<fps*3;i++){const p={...s.avatar};step(s,{},1/fps);const d=Math.hypot(s.avatar.x-p.x,s.avatar.y-p.y,s.avatar.z-p.z);travel+=d;assert.ok(d<10,'no warp');hits+=s.events.filter(e=>e.type==='hit'&&e.kind==='homing').length;launches+=s.events.filter(e=>e.type==='homing').length;}
   assert.equal(hits,1);assert.equal(launches,1);assert.ok(travel>8);assert.equal(hp-s.hp,s.config.damage.homing);assert.equal(s.strike,null);
  }
 });
 test(which+' post-parry approach can be cancelled, paused or safely abandoned on reload without a remote hit',()=>{
  const s=fight(which);assert.ok(beginParryHoming(s));const original={...s.avatar};step(s,{},0);assert.deepEqual(s.avatar,original);assert.ok(titanInput(s,'dodge'));for(let i=0;i<180;i++)step(s);assert.equal(s.hp,s.maxHp);
  const other=fight(which);other.original={};beginParryHoming(other);step(other);const r=(other.wyvern?restoreWyvernSession:restoreTitanSession)(JSON.parse(JSON.stringify(other)));assert.equal(r.strike,null);for(let i=0;i<60;i++)step(r);assert.equal(r.hp,r.maxHp);
 });
}
test('an obstructed homing approach times out with no damage rather than passing through the obstacle',()=>{
 const s=fight('giganto');titanInput(s,'homing');let missed=0;
 for(let i=0;i<180;i++){const from={...s.avatar};steerTitanHoming(s,1/60);s.avatar.vx=s.avatar.vy=s.avatar.vz=0;advanceStrike(s,from,1/60,s.attackTime);missed+=s.events.filter(e=>e.type==='miss').length;s.events=[];}
 assert.equal(s.hp,s.maxHp);assert.equal(s.strike,null);assert.equal(missed,1);
});
test('Super Sonic homing uses one golden curled silhouette and restores the existing rig after recovery',()=>{
 const scene=new T.Scene(),ball=new SonicJumpBall(scene),root=new T.Group();root.userData.model=new T.Group();const s=fight('giganto');titanInput(s,'homing');s.strike.homing.age=0.4;s.strike.homing.phase='flight';
 for(let i=0;i<20;i++)ball.update(s,root,1/60);assert.ok(ball.group.visible);assert.equal(root.userData.model.visible,false);assert.equal(ball.core.material.color.getHexString(),'ffd331');const before=ball.core.quaternion.clone();ball.update(s,root,0);assert.ok(before.angleTo(ball.core.quaternion)<1e-7);
 s.strike=null;ball.update(s,root,1/60);assert.equal(root.userData.model.visible,true);assert.equal(ball.group.visible,false);ball.dispose();assert.equal(scene.children.length,0);
});
test('arena HUD has no boost-energy meter or energy value while keeping rings and the speed gauge',()=>{
 const html=titanHudTemplate();assert.ok(!/titan-energy|Boost energy|titan-boost-fill|id="titan-boost"/.test(html));assert.ok(html.includes('id="titan-rings"'));assert.ok(html.includes('id="titan-speed"'));
});
