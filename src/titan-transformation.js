import * as T from "three";
import { titanWorldPoint } from "./titan-space.js";
import { sonicLength } from "./titan-metrics.js";
export const TRANSFORM_EVENTS = Object.freeze([
  ["collect", 0.72],
  ["orbit", 1.15],
  ["spiral", 2.5],
  ["absorb", 3.85],
  ["super", 4.3],
  ["launch", 4.65],
]);
export const EMERALD_COLORS = Object.freeze([
  "#e43a55",
  "#21d992",
  "#287bff",
  "#efcc31",
  "#a963ef",
  "#54e7ee",
  "#e9edf4",
]);
const ease = (t) => {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
};
export function titanTransformation(t) {
  return {
    reach: ease(t / 0.55) * (1 - ease((t - 0.75) / 0.4)),
    collect: ease((t - 0.5) / 0.35),
    orbit: ease((t - 0.95) / 0.45),
    spiral: ease((t - 2.4) / 1.35),
    absorb: ease((t - 3.6) / 0.65),
    gold: ease((t - 4.12) / 0.3),
    launch: ease((t - 4.45) / 1.55),
  };
}
export function sonicSuper(s) {
  return (
    !!s.emerald &&
    (s.stage !== "transform" || titanTransformation(s.stageTime).gold >= 0.5)
  );
}
export function tickTransformation(s, emit) {
  for (let i = 0; i < TRANSFORM_EVENTS.length; i++) {
    const [cue, time] = TRANSFORM_EVENTS[i];
    if (s.stageTime + 1e-8 >= time && !((s.transformCues || 0) & (1 << i))) {
      s.transformCues = (s.transformCues || 0) | (1 << i);
      emit(s, "transformation-cue", { cue, age: s.stageTime - time });
    }
  }
}
export function emeraldGeometry() {
  const vertices = [],
    index = [],
    rings = [
      [0.38, 0.38],
      [0.78, 0.08],
      [0.66, -0.18],
    ];
  for (const [r, y] of rings)
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      vertices.push(Math.sin(a) * r, y, Math.cos(a) * r);
    }
  vertices.push(0, -0.95, 0);
  for (let i = 1; i < 7; i++) index.push(0, i, i + 1);
  for (let r = 0; r < 2; r++)
    for (let i = 0; i < 8; i++) {
      const a = r * 8 + i,
        b = r * 8 + ((i + 1) % 8),
        c = a + 8,
        d = b + 8;
      index.push(a, c, b, b, c, d);
    }
  for (let i = 0; i < 8; i++) index.push(16 + i, 24, 16 + ((i + 1) % 8));
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(vertices, 3));
  g.setIndex(index);
  const flat = g.toNonIndexed();
  flat.computeVertexNormals();
  g.dispose();
  return flat;
}
export function makeChaosEmerald(color = "#21d992") {
  const root = new T.Group(),
    geometry = emeraldGeometry();
  const mat = new T.MeshPhysicalMaterial({
    color,
    roughness: 0.085,
    metalness: 0.05,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    envMapIntensity: 1.45,
    flatShading: true,
    emissive: color,
    emissiveIntensity: 0.12,
  });
  const gem = new T.Mesh(geometry, mat);
  gem.castShadow = true;
  root.add(gem);
  root.userData.gem = gem;
  return root;
}
export class TitanTransformationView {
  constructor(scene) {
    this.group = new T.Group();
    this.gems = EMERALD_COLORS.map((color, i) => {
      const g = makeChaosEmerald(color);
      g.name = "Chaos Emerald " + i;
      this.group.add(g);
      return g;
    });
    scene.add(this.group);
    this.light = new T.PointLight("#89f7dc", 0, 32, 2);
    scene.add(this.light);
    this.rays = new T.InstancedMesh(
      new T.CylinderGeometry(0.018, 0.045, 1, 5),
      new T.MeshBasicMaterial({
        color: "#caffd8",
        transparent: true,
        opacity: 0.5,
        blending: T.AdditiveBlending,
        depthWrite: false,
      }),
      48,
    );
    this.rays.frustumCulled = false;
    this.rays.userData.titanAO = false;
    scene.add(this.rays);
    this.dummy = new T.Object3D();
  }
  update(s, sonic) {
    const active = s.stage === "transform",
      a = titanTransformation(s.stageTime),
      k = sonicLength(s, 1);
    this.group.visible = active && s.stageTime >= 1.05 && a.absorb < 1;
    this.rays.visible = active && s.config.particles;
    this.rays.count = this.rays.visible ? 48 : 0;
    if (!active) {
      this.light.intensity = 0;
      return;
    }
    const center = sonic.position.clone().add(new T.Vector3(0, 1.7 * k, 0));
    for (let i = 0; i < 7; i++) {
      const angle = (i * Math.PI * 2) / 7 + s.stageTime * (1.2 + a.spiral * 5),
        r = (3.7 + a.spiral * 0.9) * (1 - a.absorb) * k * a.orbit;
      const g = this.gems[i];
      g.position.set(
        center.x + Math.sin(angle) * r,
        center.y +
          Math.sin(angle * 1.4) * 1.1 * k * (1 - a.absorb) +
          (i - 3) * a.spiral * 0.12 * k,
        center.z + Math.cos(angle) * r,
      );
      g.rotation.set(s.stageTime * 0.4, angle, 0.12);
      g.scale.setScalar(0.53 * k * (1 - a.absorb * 0.7));
      if (i === 1 && a.orbit < 1 && sonic.userData.bones?.handR) {
        const hand = sonic.userData.bones.handR.getWorldPosition(
          new T.Vector3(),
        );
        g.position.lerp(hand, 1 - a.orbit);
      }
      g.userData.gem.material.emissiveIntensity = 0.1 + a.spiral * 0.4;
    }
    this.light.position.copy(center);
    this.light.color.set(a.gold > 0.1 ? "#ffe386" : "#8ff4cb");
    this.light.intensity =
      active && s.config.lighting
        ? 2 + a.spiral * 9 + Math.sin(a.gold * Math.PI) * 20
        : 0;
    for (let i = 0; i < this.rays.count; i++) {
      const angle = i * 2.399963 + s.stageTime * 1.4,
        rad = (1 - a.absorb) * 3.9 * k;
      this.dummy.position
        .copy(center)
        .add(
          new T.Vector3(
            Math.sin(angle) * rad,
            Math.cos(angle * 2) * rad * 0.6,
            Math.cos(angle) * rad,
          ),
        );
      this.dummy.rotation.set(angle, 0.3, angle * 1.4);
      this.dummy.scale.set(k, (0.3 + a.spiral * 1.6) * k, k);
      this.dummy.updateMatrix();
      this.rays.setMatrixAt(i, this.dummy.matrix);
    }
    this.rays.instanceMatrix.needsUpdate = true;
  }
}
