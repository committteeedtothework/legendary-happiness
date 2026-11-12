import * as T from 'three';
import {sonicLength} from './titan-metrics.js';
const smooth=x=>{x=Math.max(0,Math.min(1,x));return x*x*(3-2*x);};
// A compact spinning form with original quill facets and a bounded blue aura.
// This replaces the visible silhouette only while the rig remains curled inside.
export class SonicJumpBall {
 constructor(scene){
  this.group=new T.Group();this.group.name='Sonic curled jump';scene.add(this.group);
  const blue=new T.MeshStandardMaterial({color:'#047ee9',emissive:'#0359bc',emissiveIntensity:0.65,roughness:0.32,metalness:0.12});
  this.core=new T.Mesh(new T.IcosahedronGeometry(1.02,3),blue);this.core.castShadow=true;this.group.add(this.core);
  for(let i=0;i<10;i++){
   const q=new T.Mesh(new T.ConeGeometry(0.22,0.55,6),blue),a=i*Math.PI*2/10;
   q.position.set(Math.sin(a)*0.82,Math.cos(a)*0.82,-0.25);q.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),new T.Vector3(Math.sin(a)*0.4,Math.cos(a)*0.4,-0.9).normalize());this.core.add(q);
  }
  this.halo=new T.Mesh(new T.SphereGeometry(1.2,24,16),new T.MeshBasicMaterial({color:'#2caaff',transparent:true,opacity:0.14,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));this.group.add(this.halo);
  this.rings=[];for(let i=0;i<3;i++){const m=new T.Mesh(new T.TorusGeometry(1.08+i*0.035,0.025,5,48,Math.PI*1.55),new T.MeshBasicMaterial({color:'#8addff',transparent:true,opacity:0.55,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}));this.group.add(m);this.rings.push(m);}
  this.group.visible=false;this.weight=0;
 }
 update(s,root,dt){
  const homing=s.stage==='combat'&&s.strike?.homing;
  const curled=homing&&homing.phase!=='recovery';
  const rolling=s.traversalKit?.roll>0;
  const active=curled||s.stage==='traversal'&&!s.emerald&&!['wall_run','stomp'].includes(s.action)&&(!s.avatar.onGround||rolling)&&!s.climb?.attached&&
    (rolling || (s.jumpAge ?? 99)<10 || (s.titan==='wyvern'&&s.wyvern.air>0));
  const target=curled?smooth((homing.age-0.02)/0.1):active?(rolling?1:smooth(((s.jumpAge ?? 0)-0.035)/0.11)):0;
  this.weight+=(target-this.weight)*(1-Math.exp(-Math.max(0,dt)*28));
  if(s.emerald&&!homing)this.weight=0;
  this.group.visible=this.weight>0.015;
  if(root?.userData.model){
   if(this.weight>0.85){root.userData.model.visible=false;this.hidden=root;}
   else if(this.hidden){this.hidden.userData.model.visible=true;this.hidden=null;}
  }
  if(!this.group.visible)return;
  const gold=!!s.emerald;this.core.material.color.set(gold?'#ffd331':'#047ee9');this.core.material.emissive.set(gold?'#b88b05':'#0359bc');this.halo.material.color.set(gold?'#ffe690':'#2caaff');
  const k=sonicLength(s,1);this.group.position.set(s.avatar.x,s.avatar.y+1.08*k,s.avatar.z);this.group.scale.setScalar(k*(0.7+0.3*this.weight));
  this.core.rotation.set(s.time*17,s.time*2.5,s.time*1.3);
  this.halo.visible=s.config.particles!==false;this.halo.material.opacity=0.14*this.weight;
  this.rings.forEach((m,i)=>{m.material.color.set(s.emerald?'#fff1b6':'#8addff');m.visible=s.config.particles!==false;m.rotation.set(s.time*(4+i),i*0.9,s.time*(i%2?-6:6));m.material.opacity=0.5*this.weight;});
 }
 dispose(){if(this.hidden?.userData.model)this.hidden.userData.model.visible=true;const geometries=new Set(),materials=new Set();this.group.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material);});for(const g of geometries)g.dispose();for(const m of materials)m.dispose();this.group.removeFromParent();}
}
