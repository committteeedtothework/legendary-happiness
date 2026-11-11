import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { B, BLOCKS } from "./data.js";
import { invasionState, invasionPlan } from "./invasion.js";
import { createPistolModel } from "./pistol-model.js";
const smooth = (t) => {
  t = Math.max(0, Math.min(1, t));
  return t * t * (3 - 2 * t);
};
export class IncursionRenderer {
  constructor(scene) {
    this.scene = scene;
    this.root = new THREE.Group();
    scene.add(this.root);
    this.tracePositions = new Float32Array(24 * 6);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.BufferAttribute(this.tracePositions, 3).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    geo.setDrawRange(0, 0);
    this.traces = new THREE.LineSegments(
      geo,
      new THREE.LineBasicMaterial({
        color: "#ffe3ac",
        transparent: true,
        opacity: 0.9,
      }),
    );
    this.traces.frustumCulled = false;
    scene.add(this.traces);
  }
  clear() {
    this.root.traverse((o) => {
      o.geometry?.dispose();
      if (o.material)
        for (const m of Array.isArray(o.material) ? o.material : [o.material])
          m.dispose();
    });
    this.root.clear();
    this.signature = null;
    this.traces.geometry.setDrawRange(0, 0);
  }
  create(s) {
    this.root.position.set(s.x + 0.5, s.y, s.z + 0.5);
    const parts = [];
    for (const [x, y, z, id] of invasionPlan({ x: 0, y: 0, z: 0 })) {
      if (id === B.air) continue;
      const geo = new THREE.BoxGeometry(1, 1, 1);
      geo.translate(x, y + 0.5, z);
      const c = new THREE.Color(BLOCKS[id].color),
        colors = new Float32Array(geo.attributes.position.count * 3);
      for (let i = 0; i < colors.length; i += 3) colors.set([c.r, c.g, c.b], i);
      geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      parts.push(geo);
    }
    this.shrine = new THREE.Mesh(
      mergeGeometries(parts),
      new THREE.MeshLambertMaterial({ vertexColors: true }),
    );
    parts.forEach((g) => g.dispose());
    this.root.add(this.shrine);
    this.arms = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshLambertMaterial({ color: "#4b223d", emissive: "#220d19" }),
      48,
    );
    this.arms.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.arms.frustumCulled = false;
    this.root.add(this.arms);
    this.suckers = new THREE.InstancedMesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshLambertMaterial({ color: "#d78b9e", emissive: "#3c1824" }),
      48,
    );
    this.suckers.frustumCulled = false;
    this.root.add(this.suckers);
    this.reward = new THREE.Group();
    this.reward.position.y = 2.7;
    for (const [i, dark] of [false, true].entries()) {
      const m = createPistolModel(dark);
      m.position.x = (i - 0.5) * 0.55;
      m.rotation.set(-0.3, 0, (i - 0.5) * -0.7);
      m.scale.setScalar(2.1);
      this.reward.add(m);
    }
    this.root.add(this.reward);
    this.lock = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.85, 1),
      new THREE.MeshBasicMaterial({
        color: "#d96d9e",
        wireframe: true,
        transparent: true,
        opacity: 0.45,
      }),
    );
    this.lock.position.y = 2.8;
    this.root.add(this.lock);
  }
  update(g, time) {
    const s = invasionState(g.world),
      signature =
        s?.x === undefined ? null : `${g.dimension}:${s.x},${s.y},${s.z}`;
    if (signature !== this.signature) {
      this.clear();
      this.signature = signature;
      if (signature) this.create(s);
    }
    this.root.visible = !!(signature && g.active);
    if (signature) {
      const emerging = s.phase === "emerging",
        rise = smooth((s.age - 45) / 135);
      this.shrine.visible = emerging;
      this.shrine.position.y = -8 * (1 - rise);
      const activeArms = emerging || s.phase === "battle";
      this.arms.visible = this.suckers.visible = activeArms;
      const height = emerging ? smooth(s.age / 35) : 0.48,
        temp = new THREE.Object3D();
      if (activeArms)
        for (let a = 0; a < 6; a++)
          for (let j = 0; j < 8; j++) {
            const angle = (a * Math.PI) / 3,
              timeBend = Math.sin(time * 1.8 + a) * 0.18,
              t = j / 8,
              point = (u) => {
                if (s.grab?.arm === a) {
                  const reach = smooth(s.grab.age / 40);
                  return new THREE.Vector3(
                    Math.cos(angle) * 5.8 * (1 - u) +
                      (g.player.x - s.x - 0.5) * u * reach,
                    Math.sin(u * Math.PI) * 2 + (g.player.y - s.y + 1) * u,
                    Math.sin(angle) * 5.8 * (1 - u) +
                      (g.player.z - s.z - 0.5) * u * reach,
                  );
                }
                return new THREE.Vector3(
                  Math.cos(angle) * (5.8 - u * u * (2.2 + timeBend)),
                  Math.sin(u * Math.PI * 0.7) * 7 * height - 1,
                  Math.sin(angle) * (5.8 - u * u * (2.2 + timeBend)),
                );
              },
              from = point(t),
              to = point((j + 1) / 8),
              delta = to.clone().sub(from);
            // Each segment bridges adjacent curve joints, rather than leaving
            // disconnected floating cubes as the tentacle bends or retracts.
            temp.position.copy(from).add(to).multiplyScalar(0.5);
            temp.quaternion.setFromUnitVectors(
              new THREE.Vector3(0, 1, 0),
              delta.clone().normalize(),
            );
            const width = 0.65 * (1 - t * 0.7);
            temp.scale.set(width, Math.max(0.02, delta.length() + 0.04), width);
            temp.updateMatrix();
            this.arms.setMatrixAt(a * 8 + j, temp.matrix);
            temp.position.x -= Math.cos(angle) * 0.27;
            temp.position.z -= Math.sin(angle) * 0.27;
            temp.scale.multiply(new THREE.Vector3(0.5, 0.32, 0.5));
            temp.updateMatrix();
            this.suckers.setMatrixAt(a * 8 + j, temp.matrix);
          }
      this.arms.instanceMatrix.needsUpdate =
        this.suckers.instanceMatrix.needsUpdate = activeArms;
      this.reward.visible = s.phase !== "claimed" && (!emerging || rise > 0.6);
      this.reward.position.y =
        2.7 + Math.sin(time * 1.4) * 0.09 + (emerging ? -8 * (1 - rise) : 0);
      this.reward.rotation.y = time * 0.4;
      this.lock.visible = s.phase === "battle";
      this.lock.rotation.y = time * 0.3;
      const flash = g.tickCount - (s.orbLastShot ?? -100) < 3;
      this.lock.material.color.set(flash ? "#ffb343" : "#8bc7e3");
      this.lock.scale.setScalar(flash ? 1.15 : 1);
      this.reward.rotation.z = flash ? 0.1 : 0;
      this.root.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = !!g.settings.shadows;
          o.receiveShadow = true;
        }
      });
    }
    const traces = (g.pistolTraces || []).slice(-24);
    for (let i = 0; i < traces.length; i++) {
      const q = traces[i];
      this.tracePositions.set(
        [q.from.x, q.from.y, q.from.z, q.to.x, q.to.y, q.to.z],
        i * 6,
      );
    }
    this.traces.geometry.setDrawRange(0, traces.length * 2);
    this.traces.geometry.attributes.position.needsUpdate = true;
    this.traces.visible = g.active;
  }
}
