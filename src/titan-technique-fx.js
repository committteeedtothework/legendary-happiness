import * as T from "three";
import { sonicLength } from "./titan-metrics.js";
export class TitanTechniqueFX {
  constructor(scene) {
    this.mesh = new T.InstancedMesh(
      new T.TorusGeometry(1, 0.025, 4, 48),
      new T.MeshBasicMaterial({
        color: "#fff0b8",
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
        blending: T.AdditiveBlending,
        toneMapped: false,
      }),
      8,
    );
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.userData.titanAO = false;
    scene.add(this.mesh);
    this.dummy = new T.Object3D();
  }
  update(s) {
    const a = s.strike,
      enabled =
        s.config.particles &&
        s.config.impactEffects !== false &&
        s.stage === "combat" &&
        a &&
        ["spin", "cyclone", "stomp"].includes(a.move);
    this.mesh.visible = !!enabled;
    this.mesh.count = enabled
      ? s.config.graphicsQuality === "low"
        ? 3
        : 6
      : 0;
    if (!enabled) return;
    const u = a.elapsed / a.duration,
      k = sonicLength(s, 1),
      fade = Math.sin(Math.PI * Math.min(1, u));
    this.mesh.material.opacity = 0.6 * fade;
    for (let i = 0; i < this.mesh.count; i++) {
      const d = this.dummy;
      d.position.set(
        s.avatar.x,
        s.avatar.y + (a.move === "stomp" ? -i * 0.25 : 1.5 + i * 0.25) * k,
        s.avatar.z,
      );
      d.rotation.set(
        Math.PI / 2 + (a.move === "spin" ? Math.sin(i + u * 8) * 0.3 : 0),
        0,
        u * 8 + i,
      );
      const r =
        (a.move === "stomp" ? 0.5 + i * 0.27 : 1.8 + i * 0.32) * k * fade;
      d.scale.set(r, r, 1);
      d.updateMatrix();
      this.mesh.setMatrixAt(i, d.matrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
