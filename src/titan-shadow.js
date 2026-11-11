import * as T from 'three';
const direction=new T.Vector3(),right=new T.Vector3(),up=new T.Vector3(),target=new T.Vector3(),worldUp=new T.Vector3(0,1,0);
export function stabilizeTitanShadow(light,focus,offset,resolution){
 direction.copy(offset).normalize();right.crossVectors(worldUp,direction).normalize();up.crossVectors(direction,right).normalize();
 const camera=light.shadow.camera,step=(camera.right-camera.left)/Math.max(1,resolution);
 target.copy(focus);const x=target.dot(right),y=target.dot(up);
 target.addScaledVector(right,Math.round(x/step)*step-x).addScaledVector(up,Math.round(y/step)*step-y);
 light.target.position.copy(target);light.position.copy(target).add(offset);
}
