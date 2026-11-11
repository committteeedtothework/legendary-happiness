import { createWeaponModel } from "./weapon-models.js";
import { B } from "./data.js";
import * as THREE from "three";
import { relicSite } from "./relic.js";

// One reusable draw call for runes, orbiting motes and combat sparks.
export class ArcaneEffects {
  constructor(scene) {
    this.scene = scene;
    this.relicDisplay = null;
    this.capacity = 256;
    this.cursor = 0;
    this.particles = [];
    this.positions = new Float32Array(this.capacity * 3).fill(-10000);
    this.colors = new Float32Array(this.capacity * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(this.positions, 3).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    geometry.setAttribute(
      "color",
      new THREE.BufferAttribute(this.colors, 3).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 16;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "white";
    ctx.fillRect(7, 1, 2, 14);
    ctx.fillRect(1, 7, 14, 2);
    ctx.fillRect(5, 5, 6, 6);
    const map = new THREE.CanvasTexture(canvas);
    map.magFilter = map.minFilter = THREE.NearestFilter;
    this.points = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        map,
        size: 0.13,
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        alphaTest: 0.1,
      }),
    );
    this.points.frustumCulled = false;
    scene.add(this.points);
  }
  clear() {
    if (this.relicDisplay) this.relicDisplay.visible = false;
    this.particles = [];
    this.positions.fill(-10000);
    this.points.geometry.attributes.position.needsUpdate = true;
  }
  emit(x, y, z, vx, vy, vz, life = 0.8, tint = [0.35, 0.95, 1]) {
    const i = this.cursor++ % this.capacity;
    this.particles[i] = { x, y, z, vx, vy, vz, life, max: life, tint };
  }
  burst(p, count = 28) {
    for (let i = 0; i < count; i++) {
      const a = i * 2.399,
        r = 1 + Math.random() * 2;
      this.emit(
        p.x,
        p.y + 1,
        p.z,
        Math.cos(a) * r,
        (Math.random() - 0.2) * 3,
        Math.sin(a) * r,
        0.5 + Math.random() * 0.5,
        i % 4 === 0 ? [0.9, 0.65, 1] : [0.3, 0.9, 1],
      );
    }
  }
  update(world, p, held, time, dt, playing, particles) {
    const site = playing && !world.relicClaimed ? relicSite(world) : null;
    const near = site && Math.hypot(p.x - site.x, p.z - site.z) < 48;
    const planted =
      near &&
      world.chunks.has(
        `${Math.floor(site.x / 16)},${Math.floor(site.z / 16)}`,
      ) &&
      world.get(site.x, site.y, site.z) === B.devin_relic_base &&
      world.get(site.x, site.y + 1, site.z) === B.devin_relic_blade;
    if (planted && !this.relicDisplay) {
      this.relicDisplay = createWeaponModel("devin_sword");
      this.relicDisplay.rotation.z = Math.PI;
      this.relicDisplay.scale.setScalar(0.75);
      this.scene.add(this.relicDisplay);
    }
    if (this.relicDisplay) {
      this.relicDisplay.visible = !!planted;
      if (planted) {
        this.relicDisplay.position.set(
          site.x + 0.5,
          site.y + 1.65,
          site.z + 0.5,
        );
        animateMagic(this.relicDisplay, time, particles !== "minimal");
      }
    }
    this.points.visible = playing && particles !== "minimal";
    if (dt > 0 && this.points.visible && time >= (this.nextMote || 0)) {
      this.nextMote = time + 0.07;
      if (
        site &&
        !world.relicClaimed &&
        Math.hypot(p.x - site.x, p.z - site.z) < 35
      ) {
        const a = time * 1.8;
        this.emit(
          site.x + 0.5 + Math.cos(a) * 0.75,
          site.y + 0.6 + Math.sin(a * 0.6) * 0.3,
          site.z + 0.5 + Math.sin(a) * 0.75,
          0,
          0.6,
          0,
          1.2,
        );
      }
      // Held sparkle lives on the blade itself; avoid motes crossing the
      // player's aim. The planted relic retains its world-space beacon.
    }
    for (let i = 0; i < this.capacity; i++) {
      const q = this.particles[i];
      if (!q || q.life <= 0) {
        this.positions[i * 3 + 1] = -10000;
        continue;
      }
      q.life -= dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.z += q.vz * dt;
      this.positions.set([q.x, q.y, q.z], i * 3);
      this.colors.set(
        q.tint.map((v) => v * Math.max(0, q.life / q.max)),
        i * 3,
      );
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}
export function animateMagic(root, time, effects = true) {
  root?.traverse((o) => {
    if (o.userData.bladeSheen) {
      o.visible = effects;
      o.material.opacity = 0.1 + Math.sin(time * 1.2) ** 8 * 0.16;
    }
    if (o.userData.magicGlint !== undefined) {
      const phase = time * 1.6 + o.userData.magicGlint * 2.1;
      o.visible = effects;
      const pulse = Math.max(0, Math.sin(phase)) ** 7;
      o.material.opacity = 0.08 + pulse * 0.65;
      o.scale.setScalar(0.55 + pulse * 0.7);
      o.rotation.z = time * 0.24 + o.userData.magicGlint;
    }
    // Older planted/third-party meshes can retain their original orbit tag.
    if (o.userData.magicOrbit !== undefined) {
      o.visible = effects;
      const a = time * 1.4 + o.userData.magicOrbit;
      o.position.x = Math.cos(a) * 0.105;
      o.position.z = Math.sin(a) * 0.105;
      o.rotation.y = a;
    }
  });
}
