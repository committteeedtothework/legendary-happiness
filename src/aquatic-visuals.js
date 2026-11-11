import * as THREE from "three";
import { bubbleColumn } from "./aquatic.js";
import { createWeaponModel } from "./weapon-models.js";
export class AquaticVisuals {
  constructor(scene) {
    this.root = new THREE.Group();
    scene.add(this.root);
    this.weapons = new Map();
    this.line = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineBasicMaterial({
        color: "#c2d4c6",
        transparent: true,
        opacity: 0.65,
      }),
    );
    this.root.add(this.line);
    this.bobber = new THREE.Mesh(
      new THREE.BoxGeometry(0.13, 0.13, 0.13),
      new THREE.MeshBasicMaterial({ color: "#eea181" }),
    );
    this.root.add(this.bobber);
    this.bubbles = new THREE.Points(
      new THREE.BufferGeometry(),
      new THREE.PointsMaterial({
        color: "#c8ebe9",
        size: 0.07,
        transparent: true,
        opacity: 0.6,
        sizeAttenuation: true,
      }),
    );
    this.bubbles.geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(192 * 3), 3),
    );
    this.root.add(this.bubbles);
    this.bubbles.frustumCulled = false;
    this.line.frustumCulled = false;
  }
  update(g, time) {
    this.root.visible = !!g?.active;
    if (!g?.active) return;
    const list = g.world.aquatic?.projectiles || [],
      ids = new Set(list.map((q) => q.uid));
    for (const [id, m] of this.weapons)
      if (!ids.has(id)) {
        this.root.remove(m);
        m.traverse((o) => {
          o.geometry?.dispose();
          if (o.material) o.material.dispose();
        });
        this.weapons.delete(id);
      }
    for (const q of list) {
      let m = this.weapons.get(q.uid);
      if (!m) {
        m = createWeaponModel("trident");
        if (!m) continue;
        this.weapons.set(q.uid, m);
        this.root.add(m);
      }
      m.position.set(q.x, q.y, q.z);
      m.rotation.set(0, 0, 0);
      if (!q.hit || q.returning) {
        m.quaternion.setFromUnitVectors(
          new THREE.Vector3(0, 1, 0),
          new THREE.Vector3(q.vx, q.vy, q.vz).normalize(),
        );
      }
    }
    const f = g.player.fishing;
    this.bobber.visible = this.line.visible = !!f;
    if (f) {
      const y =
        f.y +
        (g.tickCount >= f.bite && g.tickCount < f.bite + 40
          ? -0.25
          : Math.sin(time * 3) * 0.025);
      this.bobber.position.set(f.x, y, f.z);
      const p = g.player;
      this.line.geometry.setFromPoints([
        new THREE.Vector3(p.x + 0.25, p.y + 1.2, p.z),
        new THREE.Vector3(
          (p.x + f.x) / 2,
          (p.y + f.y) / 2 - 0.4,
          (p.z + f.z) / 2,
        ),
        new THREE.Vector3(f.x, y, f.z),
      ]);
    }
    this.bubbles.visible =
      g.player.inWater && g.settings.particles !== "minimal";
    if (this.bubbles.visible) {
      const a = this.bubbles.geometry.attributes.position.array,
        p = g.player;
      for (let i = 0; i < 192; i++) {
        const x = p.x + Math.sin(i * 43) * 9,
          z = p.z + Math.cos(i * 17) * 9,
          column = i % 16 === 0 ? bubbleColumn(g.world, x, p.y, z) : 0;
        a[i * 3] = x;
        a[i * 3 + 1] = p.y - 6 + ((time * (column ? 2 : 0.2) + i * 0.17) % 12);
        a[i * 3 + 2] = z;
      }
      this.bubbles.geometry.attributes.position.needsUpdate = true;
    }
  }
}
