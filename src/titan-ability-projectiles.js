import * as T from "three";
import {makeTitanEnergyCrescent, makeTitanEnergyMaterial} from "./titan-combat-flare.js";
import {titanShotOrigin} from "./titan-shot.js";
import {sonicLength} from "./titan-metrics.js";
function crossGeometry() {
  const vertices=[];
  for (const angle of [Math.PI/4,-Math.PI/4]) {
    const points=[[-2,-0.12],[2,-0.12],[2,0.12],[-2,0.12]];
    for (const i of [0,1,2,0,2,3]) {
      const [x,y]=points[i];vertices.push(x*Math.cos(angle)-y*Math.sin(angle),x*Math.sin(angle)+y*Math.cos(angle),0);
    }
  }
  const g=new T.BufferGeometry();g.setAttribute("position",new T.Float32BufferAttribute(vertices,3));g.computeVertexNormals();return g;
}
export class TitanAbilityProjectiles {
  constructor(scene) {
    const material=new T.MeshBasicMaterial({color:"#fff0ba",toneMapped:false,transparent:true,opacity:0.9,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending});
    this.pools={boom:new T.InstancedMesh(makeTitanEnergyCrescent(),makeTitanEnergyMaterial(),16),
      cross:new T.InstancedMesh(crossGeometry(),material,16),
      shot:new T.InstancedMesh(new T.SphereGeometry(0.5,10,8),material.clone(),16)};
    for (const mesh of Object.values(this.pools)) {
      mesh.count=0;mesh.frustumCulled=false;mesh.userData.titanAO=false;
      mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);scene.add(mesh);
    }
    this.dummy=new T.Object3D();this.axis=new T.Vector3(0,0,1);this.direction=new T.Vector3();
  }
  update(s) {
    const entries=(s.projectiles||[]).map(q=>({...q,charge:1}));
    if (s.config.particles && s.stage === "combat" && s.strike?.move === "shot") {
      const charge=Math.min(1,s.strike.elapsed/0.3);
      for (let i=s.strike.next;i<6;i++) entries.push({...titanShotOrigin(s,i,charge),kind:"shot",charge});
    }
    const counts={boom:0,cross:0,shot:0};
    // Launched attacks remain visible at every quality setting. Only their
    // optional charge ornament is disabled with particles.
      for (const q of entries) {
        const mesh=this.pools[q.kind];if (!mesh || counts[q.kind]>=16) continue;
        const d=this.dummy;d.position.set(q.x,q.y,q.z);d.quaternion.identity();
        this.direction.set(q.vx||0,q.vy||0,q.vz||1).normalize();
        d.quaternion.setFromUnitVectors(this.axis,this.direction);
        const size=sonicLength(s,q.kind === "shot" ? Math.max(0.12,q.charge) : q.kind === "cross" ? 1.3 : 1.7);
        d.scale.setScalar(size);d.updateMatrix();mesh.setMatrixAt(counts[q.kind]++,d.matrix);
      }
    for (const [kind,mesh] of Object.entries(this.pools)) {
      mesh.count=counts[kind];mesh.visible=!!counts[kind];mesh.instanceMatrix.needsUpdate=true;
    }
  }
}
