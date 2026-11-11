import * as T from "three";
import { TITAN_POWER_SCALE } from "./titan-balance.js";
// Bounded contact sparks. One draw, event-clock animation, no full-screen flash.
export class TitanImpactFX {
  constructor(scene) {
    this.mesh = new T.InstancedMesh(
      new T.BoxGeometry(1, 0.035, 0.035),
      new T.MeshBasicMaterial({
        color: "#fff2bd",
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
        depthTest: false,
        toneMapped: false,
        blending: T.AdditiveBlending,
      }),
      64,
    );
    this.mesh.renderOrder = 10;
    this.mesh.count = 0;
    this.mesh.visible = false;
    this.mesh.frustumCulled = false;
    this.mesh.userData.titanAO = false;
    this.mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
    scene.add(this.mesh);
    this.attempt = undefined;
    this.particles = [];
    this.seen = new Set();
    this.dummy = new T.Object3D();
  }
  event(e, s) {
    if (this.attempt !== s.attempt) {
      this.attempt = s.attempt;
      this.particles = [];
    }
    if (
      !s.config.particles ||
      s.config.impactEffects === false ||
      !["hit", "parry", "impact", "counter"].includes(e.type) ||
      !e.point ||
      (e.age || 0) > 0.18
    )
      return;
    if (e.eventId && this.seen.has(e.eventId)) return;
    if (e.eventId) {
      this.seen.add(e.eventId);
      if (this.seen.size > 96)
        this.seen.delete(this.seen.values().next().value);
    }
    const n = new T.Vector3(
        e.normal?.x || 0,
        e.normal?.y || 0,
        e.normal?.z ?? 1,
      ).normalize(),
      q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 0, 1), n),
      strength = Math.min(
        2,
        (0.6 +
          (e.amount || 80 * TITAN_POWER_SCALE) / (220 * TITAN_POWER_SCALE)) *
          (e.strength || 1),
      );
    for (let i = 0; i < Math.round(8 + strength * 5); i++) {
      const a = i * 2.399963,
        cone = 0.3 + (i % 5) * 0.16,
        v = new T.Vector3(
          Math.sin(a) * cone,
          Math.cos(a) * cone,
          0.4 + (i % 3) * 0.3,
        )
          .normalize()
          .applyQuaternion(q)
          .multiplyScalar(9 + strength * 8 + (i % 4) * 3);
      this.particles.push({
        p: new T.Vector3(e.point.x, e.point.y, e.point.z),
        v,
        born: s.time - (e.age || 0),
        life: 0.22 + (i % 4) * 0.07,
        color: new T.Color(
          e.type === "parry" ? "#8bebff" : i % 3 ? "#ffe5a0" : "#e9fbff",
        ),
        length: 0.4 + strength * 0.5,
      });
    }
    this.particles = this.particles.slice(-64);
  }
  update(s) {
    if (this.attempt !== s.attempt) {
      this.attempt = s.attempt;
      this.particles = [];
    }
    this.particles = this.particles.filter(
      (p) =>
        s.time >= p.born &&
        s.time - p.born < p.life &&
        ["combat", "finale"].includes(s.stage),
    );
    this.mesh.visible =
      s.config.particles &&
      s.config.impactEffects !== false &&
      this.particles.length > 0;
    this.mesh.count = this.mesh.visible ? this.particles.length : 0;
    for (let i = 0; i < this.mesh.count; i++) {
      const p = this.particles[i],
        age = s.time - p.born,
        fade = 1 - age / p.life;
      this.dummy.position.copy(p.p).addScaledVector(p.v, age);
      this.dummy.position.y -= age * age * 8;
      this.dummy.quaternion.setFromUnitVectors(
        new T.Vector3(1, 0, 0),
        p.v.clone().normalize(),
      );
      this.dummy.scale.set(p.length * fade, fade, fade);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(i, this.dummy.matrix);
      this.mesh.setColorAt(i, p.color);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
