import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {wyvernRigFixture} from './helpers/wyvern-rig-fixture.js';
import {makeWyvernRig,animateWyvern} from '../src/wyvern-model.js';
import {wyvernSession} from '../src/wyvern-simulation.js';
import {wyvernWingPoints} from '../src/wyvern-wing-pose.js';
import {wyvernPoint,WYVERN_SCALE,TOWER} from '../src/wyvern-space.js';
import {wyvernFlightFrame} from '../src/wyvern-choreography.js';
import {constrainTitanBody,regionContact,titanBodyRegions} from '../src/titan-contact.js';
test('sampled wing contacts follow the actual supplied joints on the same simulation clock',async()=>{
 const root=makeWyvernRig(await wyvernRigFixture()),s=wyvernSession();s.stage='combat';s.emerald=true;s.wyvern.yaw=Math.PI;
 for(const time of [0,0.347,1.713,4.02]){s.time=time;animateWyvern(root,s,0);root.updateMatrixWorld(true);
  for(const q of wyvernWingPoints(s)){const actual=root.userData.model.getObjectByName(q.name).getWorldPosition(new T.Vector3()),expected=wyvernPoint(s,{x:q.x/WYVERN_SCALE,y:q.y/WYVERN_SCALE,z:q.z/WYVERN_SCALE});assert.ok(actual.distanceTo(new T.Vector3(expected.x,expected.y,expected.z))<0.15,q.name);}
 }
});
test('the resting model clears the terrain, and the enlarged tower stands beyond its full mesh bounds',async()=>{
 const root=makeWyvernRig(await wyvernRigFixture()),s=wyvernSession();s.stage='traversal';
 for(const time of [0,0.4,1.5,3]){s.time=time;animateWyvern(root,s,0);root.updateMatrixWorld(true);const box=new T.Box3();root.traverse(o=>{if(o.isMesh&&o.visible)box.union(new T.Box3().setFromObject(o));});assert.ok(box.min.y>5);assert.ok(TOWER.x+49<box.min.x-30);}
 const before=wyvernFlightFrame(s);s.stage='transform';s.emerald=true;s.stageTime=0;assert.equal(wyvernFlightFrame(s).y,before.y);s.stageTime=12;const end=wyvernFlightFrame(s);s.stage='combat';s.wyvern.flightTime=6;assert.equal(wyvernFlightFrame(s).y,end.y);
});
test('wing fingers are solid contacts instead of allowing the player through the model',()=>{
 const s=wyvernSession();s.stage='combat';s.emerald=true;
 for(const r of titanBodyRegions(s).filter(r=>r.id.includes('wing')||r.id.includes('claw'))){const p={x:(r.a.x+r.b.x)/2,y:(r.a.y+r.b.y)/2-1.8,z:(r.a.z+r.b.z)/2,vx:0,vy:0,vz:0};constrainTitanBody(p,s);assert.ok(!regionContact(r,{...p,y:p.y+1.8}).inside,r.id);}
});
