import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {wyvernSession,stepWyvern,wyvernInput,restoreWyvernSession} from "../src/wyvern-simulation.js";
import {titanSession,titanInput,stepTitan,restoreTitanSession} from "../src/giganto-simulation.js";
import {registerTitanHit,tickTitanCombo,breakTitanCombo,TITAN_COMBO} from "../src/titan-combo.js";
import {constrainTitanBody,titanBodyRegions,regionContact} from "../src/titan-contact.js";
import {titanCameraBlocked,clearTitanCamera} from "../src/titan-camera.js";
import {makeWyvernRig,animateWyvern} from "../src/wyvern-model.js";
import {wyvernRigFixture} from "./helpers/wyvern-rig-fixture.js";
import {wyvernThrowPose,wyvernSpinePoints} from "../src/wyvern-posture.js";
import {wyvernPoint,WYVERN_SCALE} from "../src/wyvern-space.js";
import {titanCyloopPosition} from "../src/titan-cyloop.js";
import {titanWorldPoint} from "../src/titan-space.js";
import {TitanAbilityProjectiles} from "../src/titan-ability-projectiles.js";
import {makeTitanCyloopGeometry} from "../src/giganto-view.js";
import {updateTitanCyloopMesh} from "../src/titan-cyloop-view.js";
import {techniquePosition} from "../src/titan-advanced.js";
import {addAdvancedTitanClips} from "../src/titan-advanced-clips.js";
const fight=(wyvern=false)=>{
  const s=wyvern?wyvernSession({drain:0}):titanSession({drain:0,bossMobility:false,adaptiveBoss:false});
  Object.assign(s,{stage:"combat",emerald:true,rings:400,idle:999,original:{}});
  Object.assign(s.avatar,{x:0,y:wyvern?65:57,z:wyvern?26*WYVERN_SCALE:5,onGround:false});
  if(wyvern)s.wyvern.open=10;
  return s;
};
test("Stomp reaches its impact position and Sonic Boom alternates its kick at each actual wave release",()=>{
  const s=fight();
  const a={move:"stomp",duration:1.05,motionFrom:{x:0,y:50,z:10},motionTarget:{x:0,y:60,z:2}};
  assert.equal(techniquePosition(s,a,0.58).y,a.motionTarget.y);
  let pose;
  addAdvancedTitanClips((name,duration,p)=>{if(name==="sonic_boom")pose=p;},"sonic");
  for(const [i,t] of [0.22,0.44,0.66,0.88].entries()) {
    const l=pose.legL(t/1.1)[0],r=pose.legR(t/1.1)[0];
    assert.ok(i%2===0?l<-1.3&&r===0:r<-1.3&&l===0);
  }
});
test("combo count, Phantom Rush drain and two-stock Cyloop recharge remain independent through skills, pauses, damage and saves",()=>{
  const s=fight(),events=[];const emit=(s,type)=>events.push(type);
  for(let i=0;i<TITAN_COMBO.phantomHits;i++)registerTitanHit(s,emit);
  assert.equal(s.combo,20);assert.equal(s.phantom,8);assert.equal(s.cyloopCharge,2);
  assert.deepEqual(events,["phantom"]);
  tickTitanCombo(s,1);assert.equal(s.phantom,7);
  s.strike={};const left=s.comboTime;tickTitanCombo(s,1);assert.equal(s.comboTime,left);
  s.stage="phase";tickTitanCombo(s,10);assert.equal(s.phantom,6);
  s.stage="combat";s.strike=null;
  const restored=restoreTitanSession(JSON.parse(JSON.stringify(s)));
  assert.equal(restored.combo,20);assert.equal(restored.cyloopCharge,2);
  breakTitanCombo(s);assert.equal(s.combo,0);assert.equal(s.phantomCharge,0);assert.equal(s.cyloopCharge,2);
  s.cyloopCharge=1;
  for(let i=0;i<12;i++)registerTitanHit(s,emit);
  assert.equal(s.cyloopCharge,2);
});
test("Wyvern Quick Cyloop draws a physical closed vertical orbit outside its head and cannot bypass missile/claw openings",()=>{
  const s=fight(true);s.cyloopCharge=0;
  assert.equal(wyvernInput(s,"loop"),false);s.cyloopCharge=1;s.wyvern.open=0;
  assert.equal(wyvernInput(s,"loop"),false);assert.equal(s.cyloopCharge,1);
  s.wyvern.open=10;assert.ok(wyvernInput(s,"loop"));
  const orbit=s.strike.orbit;assert.equal(orbit.plane,"xy");assert.equal(s.cyloopCharge,0);
  const points=[];let damage=0;
  for(let i=0;i<190;i++) {
    stepWyvern(s,{},1/60);damage+=s.events.filter(e=>e.type==="hit"&&e.kind==="loop").length;
    if(s.strike?.elapsed>=0.36&&s.strike.elapsed<2.75) {
      points.push({...s.avatar});
      const center={...s.avatar,y:s.avatar.y+1.8};
      assert.ok(titanBodyRegions(s).filter(r=>!r.id.includes("claw")).every(r=>!regionContact(r,center).inside));
    }
  }
  assert.ok(points.length>100);assert.equal(damage,1);
  assert.ok(Math.max(...points.map(p=>p.y))-Math.min(...points.map(p=>p.y))>34);
  assert.ok(Math.max(...points.map(p=>Math.abs(p.z)))<0.1);
  const before=titanCyloopPosition(orbit,0.35),after=titanCyloopPosition(orbit,2.75);
  assert.ok(Math.hypot(before.x-after.x,before.y-after.y,before.z-after.z)<1e-5);
  const restored=restoreWyvernSession(JSON.parse(JSON.stringify(s)));assert.equal(restored.cyloopCharge,s.cyloopCharge);
});
test("Giganto Cyloop lift uses the same vertical transform for the model and contacts and recovers without repeat stun",()=>{
  const s=fight();assert.ok(titanInput(s,"loop"));
  for(let i=0;i<176;i++)stepTitan(s,{},1/60);
  assert.ok(s.cyloopHold>0);const lifted=titanWorldPoint(s,{x:0,y:63,z:-7.5});
  const torso=titanBodyRegions(s).find(r=>r.id==="torso");assert.equal(torso.center.y,lifted.y);
  assert.ok(lifted.y>63);
  for(let i=0;i<300;i++)stepTitan(s,{},1/60);
  assert.equal(s.cyloopHold,0);assert.equal(titanWorldPoint(s,{x:0,y:63,z:-7.5}).y,63);
});
test("interior head, spine and mantle starts resolve outside solids; a Wyvern camera boom cannot traverse the body",()=>{
  for(const w of [false,true]) {
    const s=fight(w);
    for(const p of w?[{x:0,y:64.2,z:0},{x:0,y:62.2,z:-80}]:[{x:0,y:61,z:-7.5},{x:0,y:83,z:7}]) {
      constrainTitanBody(p,s);
      const body={...p,y:p.y+(w?1.8:1.8/2.8)};
      assert.ok(titanBodyRegions(s).filter(r=>!r.id.includes("claw")&&!r.id.includes("forearm")).every(r=>!regionContact(r,body).inside),JSON.stringify({w,p}));
    }
  }
  const s=fight(true),blocked={x:0,y:66,z:-40};assert.ok(titanCameraBlocked(s,blocked));
  const clear=clearTitanCamera(s,blocked,15);assert.equal(titanCameraBlocked(s,clear),false);
});
test("real Wyvern rig has no accumulated spine twist at frozen time or different render rates, and thrown turns never reverse",async()=>{
  const gltf=await wyvernRigFixture(),s=fight(true);s.time=6;
  for(const hz of [30,60,144]) {
    const root=makeWyvernRig(gltf);animateWyvern(root,s,1/hz);
    const initial=root.userData.tail.map(n=>n.quaternion.clone());
    for(let i=0;i<100;i++)animateWyvern(root,s,0);
    root.userData.tail.forEach((n,i)=>assert.ok(n.quaternion.angleTo(initial[i])<1e-6));
    for(let i=0;i<140;i++){s.time=i/hz;animateWyvern(root,s,1/hz);}
    root.userData.tail.forEach(n=>assert.ok(Math.abs(n.quaternion.length()-1)<1e-6));
    root.updateMatrixWorld(true);
    const spine=wyvernSpinePoints(s);
    root.userData.tail.forEach((bone,i)=>{
      const expected=wyvernPoint(s,spine[i]);
      assert.ok(bone.getWorldPosition(new T.Vector3()).distanceTo(new T.Vector3(expected.x,expected.y,expected.z))<0.8);
    });
  }
  let prev=0;
  for(let i=0;i<=120;i++){const p=wyvernThrowPose(i/20);assert.ok(p.yaw>=prev);prev=p.yaw;assert.ok(Math.abs(p.roll)<=0.25);}
  assert.ok(Math.abs(prev-Math.PI*2)<1e-7);
});
test("shared ability pools show distinct crescents, X slashes and charged/homing spheres; the Wyvern Cyloop arc closes pink",()=>{
  const scene=new T.Scene(),fx=new TitanAbilityProjectiles(scene),s=fight(true);
  s.projectiles=[{kind:"boom",x:0,y:70,z:30,vz:-150},{kind:"cross",x:2,y:70,z:30,vz:-150},{kind:"shot",x:-2,y:70,z:30,vz:-78}];
  fx.update(s);for(const m of Object.values(fx.pools))assert.equal(m.count,1);
  s.projectiles=[];s.strike={move:"shot",elapsed:0.3,next:0};fx.update(s);assert.equal(fx.pools.shot.count,6);
  s.cyloopCharge=1;s.strike=null;wyvernInput(s,"loop");s.strike.elapsed=2.75;
  const mesh=new T.Mesh(makeTitanCyloopGeometry(),new T.MeshBasicMaterial()),history={};
  updateTitanCyloopMesh(mesh,history,s);assert.ok(mesh.visible);assert.equal(mesh.material.color.getHexString(),"ff83dc");
  s.config.particles=false;fx.update(s);updateTitanCyloopMesh(mesh,history,s);
  assert.equal(mesh.visible,false);assert.equal(fx.pools.shot.count,0);
  s.projectiles=[{kind:"shot",x:0,y:70,z:30,vz:-78}];fx.update(s);
  assert.equal(fx.pools.shot.count,1);
});
