import * as T from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
const axis=new T.Vector3(0,0,1);
// Original six-metre Titan missile: casing, nose, four fins and exhaust nozzle.
export class WyvernMissiles {
  constructor(parent) {
    const body=new T.CylinderGeometry(0.7,0.7,4.4,12).rotateX(Math.PI/2);
    const nose=new T.ConeGeometry(0.7,1.6,12).rotateX(Math.PI/2).translate(0,0,3);
    const fins=[];
    for(let i=0;i<4;i++)fins.push(new T.BoxGeometry(0.12,1.1,1.7).translate(0,0.8,-1.6).rotateZ(i*Math.PI/2));
    const tail=new T.CylinderGeometry(0.78,0.6,0.48,12).rotateX(Math.PI/2).translate(0,0,-2.35);
    const parts=[mergeGeometries([body,...fins,tail]),nose,
      new T.TorusGeometry(0.71,0.075,5,12).translate(0,0,1.65),
      new T.ConeGeometry(0.44,2.1,8).rotateX(-Math.PI/2).translate(0,0,-3.5)];
    const materials=[new T.MeshStandardMaterial({color:'#8796a6',metalness:0.72,roughness:0.36}),
      new T.MeshStandardMaterial({color:'#1c2434',metalness:0.65,roughness:0.3}),
      new T.MeshBasicMaterial({color:'#ff315c',toneMapped:false}),
      new T.MeshBasicMaterial({color:'#ffbc6c',toneMapped:false,transparent:true,opacity:0.9})];
    this.meshes=parts.map((geometry,i)=>{
      const m=new T.InstancedMesh(geometry,materials[i],32);m.name=['Missile casing and fins','Missile nose','Missile seeker band','Missile exhaust'][i];
      m.frustumCulled=false;m.count=0;parent.add(m);return m;
    });
    this.dummy=new T.Object3D();
  }
  update(missiles,time) {
    const count=Math.min(32,missiles.length),d=this.dummy;
    for(const mesh of this.meshes)mesh.count=count;
    for(let i=0;i<count;i++) {
      const m=missiles[i],dir=m.dir.lengthSq()>1e-8?m.dir:axis;
      d.position.set(m.x,m.y,m.z);d.quaternion.setFromUnitVectors(axis,dir);d.scale.setScalar(1);d.updateMatrix();
      for(const mesh of this.meshes)mesh.setMatrixAt(i,d.matrix);
    }
    this.meshes[3].material.opacity=0.72+Math.sin(time*43)*0.15;
    for(const mesh of this.meshes)mesh.instanceMatrix.needsUpdate=true;
  }
}
