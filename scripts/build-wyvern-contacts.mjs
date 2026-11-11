import * as T from 'three';
import {wyvernRigFixture} from '../tests/helpers/wyvern-rig-fixture.js';
import {makeWyvernRig} from '../src/wyvern-model.js';
import {writeFileSync} from 'node:fs';
const root=makeWyvernRig(await wyvernRigFixture()),u=root.userData;
const names=['UpperArm_L1_094','ForeArm_L1_02','ForeArm_L2_03','HandA_L_095','FingerA_L_end_0101','FingerB_L_end_0107','FingerC_L_end_0113','UpperArm_R1_0114','ForeArm_R1_0115','ForeArm_R2_0117','HandA_R_0118','FingerA_R_end_0124','FingerB_R_end_0130','FingerC_R_end_0136'];
for(const name of names)if(!u.model.getObjectByName(name))throw Error(name);
const anchor=u.model.getObjectByName('Tail2_092'),tails=[u.model.getObjectByName('Tail1_089'),anchor];
const rest=tails.map(n=>({position:n.position.toArray(),quaternion:u.tailRest.get(n).toArray(),scale:n.scale.toArray()}));
const clips={};let low=0;
for(const [name,a] of u.actions){
 for(const other of u.actions.values())other.stop();a.reset().setEffectiveWeight(1).play();const duration=a.getClip().duration,steps=Math.ceil(duration*24),frames=[];
 for(let i=0;i<=steps;i++){
  a.time=duration*i/steps;u.mixer.update(0);root.updateMatrixWorld(true);
  const pm=new T.Matrix4().copy(root.matrixWorld).invert().multiply(tails[0].parent.matrixWorld),pos=new T.Vector3(),quat=new T.Quaternion(),scale=new T.Vector3();pm.decompose(pos,quat,scale);
  frames.push([...names.flatMap(name=>anchor.worldToLocal(u.model.getObjectByName(name).getWorldPosition(new T.Vector3())).toArray()),...pos.toArray(),...quat.toArray(),...scale.toArray()].map(v=>Math.round(v*100000)/100000));
  if(name==='flight'&&i%4===0){const box=new T.Box3();u.model.traverse(o=>{if(o.isMesh&&o.visible)box.union(new T.Box3().setFromObject(o));});low=Math.min(low,box.min.y);}
 }
 clips[name]={duration,frames};
}
writeFileSync(new URL('../src/wyvern-wing-data.js',import.meta.url),'// Sampled from the supplied rig in normalized model coordinates; no textures or external requests.\nexport const WYVERN_WING_DATA='+JSON.stringify({names,rest,clips})+';\n');
console.log(JSON.stringify({clips:Object.keys(clips),lowestFlightVertex:low,bytes:JSON.stringify(clips).length}));
