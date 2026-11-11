import * as T from 'three';
// Smoothly rotate the rear quill mass around one pivot. Reassigning the six
// artificial row joints to Head removes the cell boundaries in the old skin.
export function raisedQuillPosition(x,y,z,weight=1) {
 const pivotY=1.34,pivotZ=-0.10,a=0.98,dy=y-pivotY,dz=z-pivotZ;
 return {x,y:y+(pivotY+dy*Math.cos(a)-dz*Math.sin(a)-y)*weight,
  z:z+(pivotZ+dy*Math.sin(a)+dz*Math.cos(a)-z)*weight};
}
export function prepareSonicQuills(root) {
 const u=root.userData,ids=new Set(u.metadata.quills||[]);u.quillMorphs=[];
 u.model.traverse(mesh=>{
  if(!mesh.isSkinnedMesh)return;
  const si=mesh.geometry.attributes.skinIndex,sw=mesh.geometry.attributes.skinWeight;
  const head=mesh.skeleton.bones.findIndex(b=>b.name===u.bones.head.name),quills=new Set(mesh.skeleton.bones.flatMap((b,i)=>ids.has(b.name)?[i]:[]));
  if(head<0||!quills.size)return;
  const weights=Array.from({length:si.count},(_,i)=>{
   let sum=0;for(let j=0;j<4;j++)if(quills.has(si.getComponent(i,j)))sum+=sw.getComponent(i,j);return sum;
  });
  if(!weights.some(w=>w>0))return;
  const g=mesh.geometry.clone();g.userData={...g.userData,dcsmShared:false,sonicQuillOwned:true};
  const indices=g.attributes.skinIndex;
  for(let i=0;i<indices.count;i++)for(let j=0;j<4;j++)if(quills.has(indices.getComponent(i,j)))indices.setComponent(i,j,head);
  const target=g.attributes.position.clone();
  for(let i=0;i<target.count;i++){
   const p=raisedQuillPosition(target.getX(i),target.getY(i),target.getZ(i),weights[i]);target.setXYZ(i,p.x,p.y,p.z);
  }
  const normalGeometry=g.clone();normalGeometry.setAttribute('position',target);normalGeometry.computeVertexNormals();
  g.morphAttributes.position=[target];g.morphAttributes.normal=[normalGeometry.attributes.normal.clone()];g.morphTargetsRelative=false;
  normalGeometry.dispose();mesh.geometry=g;mesh.updateMorphTargets();u.quillMorphs.push(mesh);
 });
}
export function updateSonicQuills(root,weight) {
 for(const mesh of root.userData.quillMorphs||[])mesh.morphTargetInfluences[0]=Math.max(0,Math.min(1,weight));
}
export function disposeSonicQuills(root) {
 for(const mesh of root?.userData.quillMorphs||[])mesh.geometry.dispose();
}
