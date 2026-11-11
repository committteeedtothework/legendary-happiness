import * as T from 'three';
import {solveTitanArm} from './titan-kinematics.js';
export function wyvernQtePose(sonic,boss,s){
 if(!s.qte||s.qte.kind!=='mash')return;
 const b=sonic.userData.bones,model=boss.userData.model;
 const jointNames=['Jaw_up4_014','Jaw_under4_074'];
 sonic.updateMatrixWorld(true);boss.updateMatrixWorld(true);
 const center=sonic.localToWorld(new T.Vector3(0,1.9,0));
 for(const [i,side] of ['L','R'].entries()){
  const joint=model.getObjectByName(jointNames[i]);if(!joint)continue;
  const aim=joint.getWorldPosition(new T.Vector3()).sub(center).normalize().multiplyScalar(1.25).add(center);
  const pole=sonic.localToWorld(new T.Vector3(side==='L'?1.1:-1.1,1.8,0.2));
  solveTitanArm(sonic,b['arm'+side],b['elbow'+side],b['hand'+side],aim,pole,0.92);
 }
}
export function wyvernShotOffset(s,x,y,z){const a=s.wyvern.yaw||0;return new T.Vector3(x*Math.cos(a)+z*Math.sin(a),y,z*Math.cos(a)-x*Math.sin(a));}
