import * as T from 'three';
import {sonicLength} from './titan-metrics.js';
export class SonicTraversalFX{
 constructor(scene){this.pool=Array.from({length:16},()=>{const m=new T.Mesh(new T.CylinderGeometry(0.07,0.12,1,5,1,true),new T.MeshBasicMaterial({color:'#63d6ff',transparent:true,opacity:0,depthWrite:false,toneMapped:false,blending:T.AdditiveBlending}));m.visible=false;scene.add(m);return m;});this.cursor=0;this.lastTime=-1;this.up=new T.Vector3(0,1,0);}
 update(s){
  const p=new T.Vector3(s.avatar.x,s.avatar.y+sonicLength(s,1.4),s.avatar.z),active=s.stage==='traversal'&&!s.emerald&&s.config.particles!==false&&['homing','slide','spin','dodge'].includes(s.action)&&s.actionTime>0;
  if(s.time!==this.lastTime&&active&&this.last&&this.last.distanceTo(p)>0.15&&this.last.distanceTo(p)<20){const m=this.pool[this.cursor++%this.pool.length],d=p.clone().sub(this.last);m.position.copy(p).add(this.last).multiplyScalar(0.5);m.quaternion.setFromUnitVectors(this.up,d.clone().normalize());m.scale.set(1,d.length(),1);m.userData.at=s.time;}
  for(const m of this.pool){const age=s.time-(m.userData.at??-100);m.visible=active&&age>=0&&age<0.25;m.material.opacity=Math.max(0,0.4*(1-age/0.25));}
  this.last=p;this.lastTime=s.time;
 }
 dispose(){for(const m of this.pool){m.geometry.dispose();m.material.dispose();m.removeFromParent();}}
}
