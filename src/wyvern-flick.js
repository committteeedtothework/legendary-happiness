import * as T from "three";
import { solveTitanArm } from "./titan-kinematics.js";
import { ease } from "./wyvern-space.js";
// The supplied Sonic mesh has wrist joints but no finger joints. This small
// original two-joint glove digit supplies the flick without deforming that mesh.
export function wyvernFlick(root,s) {
  const u=root.userData,b=u.bones;
  let digit=u.wyvernFlick;
  if(!digit) {
    digit=new T.Group();digit.name='Wyvern parry finger';
    const mat=new T.MeshStandardMaterial({color:'#fff7e9',roughness:0.62});
    const proximal=new T.Mesh(new T.CapsuleGeometry(0.065,0.15,4,8),mat);proximal.position.y=0.12;
    digit.add(proximal);const joint=new T.Group();joint.position.y=0.24;digit.add(joint);
    const tip=new T.Mesh(new T.CapsuleGeometry(0.06,0.1,4,8),mat);tip.position.y=0.075;joint.add(tip);
    digit.userData.joint=joint;root.add(digit);u.wyvernFlick=digit;
  }
  const age=s.wyvern.flickAge??1,active=s.stage==='combat'&&!s.strike&&age<0.52;
  digit.visible=active;if(!active)return;
  const weight=ease(age/0.055)*(1-ease((age-0.33)/0.19));
  solveTitanArm(root,b.armR,b.elbowR,b.handR,
    root.localToWorld(new T.Vector3(-0.48,2.25,0.85)),
    root.localToWorld(new T.Vector3(-1.15,1.8,0.2)),weight);
  solveTitanArm(root,b.armL,b.elbowL,b.handL,
    root.localToWorld(new T.Vector3(0.65,1.55,0.1)),
    root.localToWorld(new T.Vector3(1.1,1.5,-0.2)),weight);
  root.updateMatrixWorld(true);
  const hand=root.worldToLocal(b.handR.getWorldPosition(new T.Vector3()));
  digit.position.copy(hand).add(new T.Vector3(0.02,0.03,0.12));
  const flick=ease((age-0.1)/0.08);
  digit.rotation.set(-0.85+flick*1.6,0,-0.1);digit.userData.joint.rotation.x=0.9*(1-flick);
  digit.scale.setScalar(weight);
}

export function disposeWyvernFlick(root) {
 const digit=root?.userData.wyvernFlick;if(!digit)return;
 const materials=new Set();digit.traverse(o=>{o.geometry?.dispose();if(o.material)materials.add(o.material);});
 for(const m of materials)m.dispose();digit.removeFromParent();delete root.userData.wyvernFlick;
}
