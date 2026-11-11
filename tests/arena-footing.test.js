import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {wyvernSession,stepWyvern,wyvernInput} from '../src/wyvern-simulation.js';
import {titanSession,stepTitan,titanInput} from '../src/giganto-simulation.js';
import {wyvernPlatforms,ribbonMeshData,resolveWyvernPlatforms,platformHeight,platformCandidates} from '../src/wyvern-platforms.js';
import {WYVERN_TOWER,TOWER,runwayPoint,WYVERN_RAIL_LENGTH,WYVERN_GAPS} from '../src/wyvern-space.js';
import {SonicJumpBall} from '../src/sonic-jump-ball.js';
import {sonicTraversalInput,applySonicTraversal,startSonicTraversalDash} from '../src/sonic-traversal.js';
import {controllerConfig,readController,smoothControllerLook} from '../src/controller-data.js';
import {controlName} from '../src/input-prompts.js';
import {controllerPanel} from '../src/controller-ui.js';
const centroid=t=>({x:(t.a.x+t.b.x+t.c.x)/3,y:(t.a.y+t.b.y+t.c.y)/3,z:(t.a.z+t.b.z+t.c.z)/3});
for(const kind of ['tower','road']){
 test(kind+' floors catch fast falls at 30, 60 and 144 Hz and agree with the rendered triangles',()=>{
  const surfaces=wyvernPlatforms().triangles.filter(t=>t.kind===kind&&t.depth===0.28);
  for(const index of [37,Math.floor(surfaces.length/2),surfaces.length-19]){
   const t=surfaces[index],q=centroid(t),old={...q,y:q.y+12,onGround:false};
   const expected=platformCandidates(q.x,q.z).map(t=>platformHeight(t,q.x,q.z)).filter(h=>h&&h.y<=old.y).sort((a,b)=>b.y-a.y)[0];
   for(const fps of [30,60,144]){const p={...old,vx:0,vz:0,vy:-170};let hit;for(let i=0;i<fps;i++){const from={...p};p.y+=p.vy/fps;hit=resolveWyvernPlatforms(p,from);if(hit)break;}assert.ok(hit);assert.ok(Math.abs(p.y-expected.y-0.05)<1e-4,{kind,index,p,expected});assert.equal(p.vy,0);}
  }
 });
 test(kind+' undersides stop the whole upward displacement, including a high-speed dash',()=>{
  const t=wyvernPlatforms().triangles.find(t=>t.kind===kind&&t.depth===0.28&&(t.a.t||0)>100),q=centroid(t),from={...q,y:q.y-t.depth-3.7-1,onGround:false};
  const p={...from,vy:160,vx:0,vz:0};p.y+=8;resolveWyvernPlatforms(p,from);assert.ok(p.y+3.7<=q.y-t.depth+0.001);assert.equal(p.vy,0);
 });
}
test('the drawn ribbon has solid top, underside and edges from the same height field',()=>{
 const points=Array.from({length:201},(_,i)=>({...runwayPoint(1900+i*2),t:1900+i*2}));
 const data=ribbonMeshData(points,18,[]),geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(data.positions,3));geo.computeVertexNormals();const mesh=new T.Mesh(geo,new T.MeshBasicMaterial({side:T.DoubleSide}));mesh.updateMatrixWorld(true);
 for(const n of [2,50,175]){const q=centroid(data.surfaces[n]),ray=new T.Raycaster(new T.Vector3(q.x,q.y+3,q.z),new T.Vector3(0,-1,0));const hits=ray.intersectObject(mesh);assert.ok(hits.length>=2);assert.ok(Math.abs(hits[0].point.y-q.y)<0.001);assert.ok(hits.some(h=>Math.abs(h.point.y-(q.y-0.28))<0.001));}
 geo.dispose();mesh.material.dispose();
});
test('standing on a steep descending section retains support instead of falling through its last bend',()=>{
 const s=wyvernSession({drain:0});s.stage='traversal';s.wyvern.section='runway';s.wyvern.rail=2150;Object.assign(s.avatar,runwayPoint(2150),{onGround:true,vx:0,vy:0,vz:0});let lowest=999;
 for(let i=0;i<1800&&s.wyvern.section==='runway';i++){stepWyvern(s,{boost:true});lowest=Math.min(lowest,s.avatar.y);}
 assert.equal(s.wyvern.section,'emerald');assert.ok(lowest>100);
});
test('trail collision works when arriving from the tower state rather than relying on the section flag',()=>{
 const s=wyvernSession({drain:0});s.stage='traversal';const p=runwayPoint(900);Object.assign(s.avatar,p,{y:p.y+0.3,vy:-100,vx:0,vz:0,onGround:false});stepWyvern(s,{});assert.equal(s.wyvern.section,'runway');assert.equal(s.avatar.onGround,true);assert.ok(s.avatar.y>=p.y);
});
test('a boosted jump retains one curled silhouette until landing and is stable while paused',()=>{
 for(const make of [wyvernSession,titanSession]){const s=make();s.stage='traversal';s.boosting=true;s.jumpAge=0.4;s.avatar.onGround=false;const scene=new T.Scene(),ball=new SonicJumpBall(scene),root=new T.Group();root.userData.model=new T.Group();
  for(let i=0;i<15;i++)ball.update(s,root,1/60);assert.equal(ball.group.visible,true);assert.equal(root.userData.model.visible,false);
  const rotation=ball.core.quaternion.clone();ball.update(s,root,0);assert.ok(rotation.angleTo(ball.core.quaternion)<1e-7);
  s.avatar.onGround=true;for(let i=0;i<30;i++)ball.update(s,root,1/60);assert.equal(root.userData.model.visible,true);assert.equal(ball.group.visible,false);ball.dispose();
 }
});
test('pre-fight dodges stay bounded, roll turns blend, and a ring chain has no zero-speed handoff frame',()=>{
 const s=wyvernSession({drain:0});s.stage='traversal';Object.assign(s.avatar,{x:0,y:0.05,z:150,onGround:true,vx:0,vy:0,vz:0,yaw:0});assert.equal(wyvernInput(s,'dodge'),true);
 for(let i=0;i<30;i++){stepWyvern(s,{});assert.ok(Math.hypot(s.avatar.vx,s.avatar.vz)<=28.001);}
 s.avatar.facingYaw=Math.PI;sonicTraversalInput(s,'spin');applySonicTraversal(s,{},1/60);const before=s.traversalKit.moveHeading;s.avatar.facingYaw=0;applySonicTraversal(s,{},1/60);assert.ok(Math.abs(s.traversalKit.moveHeading-before)<0.5);
 startSonicTraversalDash(s,[{x:0,y:1,z:147},{x:0,y:1,z:140},{x:0,y:1,z:133}]);Object.assign(s.avatar,{x:0,y:1,z:148.5,vx:0,vy:0,vz:0});applySonicTraversal(s,{},1/60);assert.ok(s.avatar.vz<-80);assert.equal(s.traversalKit.dash.length,2);
});
const pad=(axes,trigger=0)=>({axes,buttons:Array.from({length:18},(_,i)=>({value:i===7?trigger:0,pressed:i===7&&trigger>0.5})),mapping:'standard'});
test('controller settings validate, persist and change movement, look, sensitivity and trigger behavior',()=>{
 const c=controllerConfig({deadzone:0.12,lookDeadzone:0.3,outerDeadzone:0.1,moveCurve:'precise',lookCurve:'linear',lookSmoothing:0.1,verticalLookScale:1.4,sprintMode:'hold',triggerThreshold:0.9,invertX:true});assert.deepEqual(controllerConfig(c),c);
 const a=readController(pad([0.5,0.5,0.2,0],0.7),c);assert.deepEqual(a.look,{x:0,y:0});assert.equal(a.buttons.mine,false);
 assert.equal(readController(pad([0,0,0,0],0.95),c).buttons.mine,true);
 const linear=readController(pad([0.6,0,0.6,0]),{moveCurve:'linear',lookCurve:'linear'}),precise=readController(pad([0.6,0,0.6,0]),{moveCurve:'precise',lookCurve:'precision'});assert.ok(precise.move.x<linear.move.x);assert.ok(precise.look.x<linear.look.x);
 const diagonal=readController(pad([0.7,0.4,0.7,0.4]),c);assert.ok(Math.abs(diagonal.move.x/diagonal.move.y-0.7/0.4)<1e-9);assert.ok(diagonal.look.x<0);
 const g={settings:{controller:c},controller:{lastDevice:'controller',family:'xbox'},giganto:{session:{stage:'traversal'}}};assert.equal(controlName(g,'stomp','arena'),'↓');assert.equal(controlName(g,'spin','arena'),'→');assert.equal(controlName(g,'shot','arena'),'LB + ↑');g.giganto.session.stage='combat';assert.equal(controlName(g,'stomp','arena'),'LB + ↓');
 const html=controllerPanel(c);for(const key of ['lookDeadzone','outerDeadzone','moveCurve','lookCurve','verticalLookScale','lookSmoothing','sprintMode','triggerThreshold','invertX'])assert.ok(html.includes('data-pad-setting="'+key+'"'));
});
test('look smoothing is frame-rate independent and stopping the stick releases it immediately',()=>{
 const values=[];for(const fps of [30,60,144]){let v={x:0,y:0};for(let i=0;i<fps;i++)v=smoothControllerLook(v,{x:1,y:0.5},0.1,1/fps);values.push(v);assert.deepEqual(smoothControllerLook(v,{x:0,y:0},0.1,1/fps),{x:0,y:0});}assert.ok(Math.abs(values[0].x-values[2].x)<1e-9);
});
