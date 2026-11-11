import * as T from "three";
export class WyvernSpeedFX {
  constructor(camera) {
    this.mesh=new T.InstancedMesh(new T.BoxGeometry(0.018,0.018,1),new T.MeshBasicMaterial({color:'#fff0c9',transparent:true,opacity:0.28,depthWrite:false,toneMapped:false}),48);
    this.mesh.name='Peripheral flight streaks';this.mesh.frustumCulled=false;this.mesh.renderOrder=3;camera.add(this.mesh);this.dummy=new T.Object3D();
  }
  update(s,quality) {
    const flight=s.stage==='combat'||(s.stage==='traversal'&&s.wyvern.section==='runway');
    this.mesh.visible=flight&&s.config.speedTrails!==false&&s.config.particles!==false&&s.wyvern.timeScale!==0.22;
    this.mesh.count=quality<2?20:48;
    const t=s.wyvern.musicTime||0;
    for(let i=0;i<this.mesh.count;i++) {
      const a=i*2.399963,r=4+(i%5)*0.7,z=-4-((i*0.73-t*(s.boosting?38:23))%23+23)%23;
      this.dummy.position.set(Math.cos(a)*r,Math.sin(a)*r*0.65,z);
      this.dummy.scale.set(1,1,s.boosting?4:2.2);this.dummy.updateMatrix();this.mesh.setMatrixAt(i,this.dummy.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate=true;
  }
}
