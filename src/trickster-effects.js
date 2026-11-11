import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
const cyan = new THREE.Color("#75efff"),
  violet = new THREE.Color("#ac85ff");
const up = new THREE.Vector3(0, 0, 1);
// Three pooled draw calls: expanding sigils, additive body echoes and streaks.
// No game state, damage, invulnerability or movement is simulated here.
export class TricksterEffects {
  constructor(scene) {
    this.root = new THREE.Group();
    scene.add(this.root);
    this.rings = [];
    this.ghosts = [];
    this.streaks = [];
    this.boost = 0;
    this.dummy = new THREE.Object3D();
    this.color = new THREE.Color();
    const material = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    this.sigils = new THREE.InstancedMesh(
      new THREE.TorusGeometry(0.48, 0.024, 4, 36),
      material,
      12,
    );
    const parts = [
      [
        [0.42, 0.67, 0.24],
        [0, 0.96, 0],
      ],
      [
        [0.4, 0.4, 0.4],
        [0, 1.61, 0],
      ],
      [
        [0.18, 0.57, 0.22],
        [-0.32, 1.01, 0],
      ],
      [
        [0.18, 0.57, 0.22],
        [0.32, 1.01, 0],
      ],
      [
        [0.2, 0.6, 0.23],
        [-0.115, 0.3, 0],
      ],
      [
        [0.2, 0.6, 0.23],
        [0.115, 0.3, 0],
      ],
    ].map(([size, p]) =>
      new THREE.BoxGeometry(...size).toNonIndexed().translate(...p),
    );
    const body = mergeGeometries(parts, false);
    parts.forEach((g) => g.dispose());
    this.echoes = new THREE.InstancedMesh(
      body,
      new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.2,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
      12,
    );
    const geometry = new THREE.BufferGeometry();
    this.positions = new Float32Array(96 * 6);
    this.colors = new Float32Array(96 * 6);
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
    this.lines = new THREE.LineSegments(
      geometry,
      new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    for (const mesh of [this.sigils, this.echoes, this.lines]) {
      mesh.frustumCulled = false;
      this.root.add(mesh);
    }
    this.sigils.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.echoes.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.clear();
  }
  clear() {
    this.rings = [];
    this.ghosts = [];
    this.streaks = [];
    this.lastTrail = null;
    this.boost = 0;
    this.sigils.count = this.echoes.count = 0;
    this.lines.geometry.setDrawRange(0, 0);
    this.root.visible = false;
  }
  ring(p, axis, life = 0.4) {
    this.rings.push({
      p: { x: p.x, y: p.y + 0.85, z: p.z },
      axis: { ...axis },
      life,
      max: life,
    });
    if (this.rings.length > 12) this.rings.shift();
  }
  ghost(p) {
    this.ghosts.push({
      p: { x: p.x, y: p.y, z: p.z, yaw: p.yaw || 0 },
      life: 0.34,
      max: 0.34,
    });
    if (this.ghosts.length > 12) this.ghosts.shift();
  }
  streak(from, to, life = 0.3) {
    this.streaks.push({ from: { ...from }, to: { ...to }, life, max: life });
    if (this.streaks.length > 96) this.streaks.shift();
  }
  start(kind, from, to, direction, settings = {}) {
    if (settings.particles === "minimal") return;
    this.boost = 1;
    this.lastTrail = null;
    const delta = new THREE.Vector3(
      to.x - from.x,
      to.y - from.y,
      to.z - from.z,
    );
    const axis =
      kind === "wall-hike"
        ? { x: 0, y: 1, z: 0 }
        : delta.length() > 0.01
          ? delta.normalize()
          : {
              x: direction?.x ?? -Math.sin(from.yaw || 0),
              y: 0,
              z: direction?.z ?? -Math.cos(from.yaw || 0),
            };
    this.ring(from, axis);
    this.ring(from, axis, 0.25);
    if (kind === "air-trick") {
      this.ring(to, axis, 0.48);
      this.ring(to, axis, 0.3);
      const distance = Math.hypot(to.x - from.x, to.y - from.y, to.z - from.z),
        n = Math.min(10, Math.ceil(distance / 1.5));
      for (let i = 0; i <= n; i++) {
        const t = i / Math.max(1, n),
          p = {
            x: from.x + (to.x - from.x) * t,
            y: from.y + (to.y - from.y) * t,
            z: from.z + (to.z - from.z) * t,
            yaw: from.yaw,
          };
        if (
          settings.fancyGraphics !== false &&
          settings.particles !== "decreased"
        )
          this.ghost(p);
      }
      this.trail(from, to, settings, true);
    } else if (kind === "wall-hike")
      this.trail(from, { ...from, y: from.y + 2.4 }, settings, true);
    // A forward ring also reads clearly from the first-person camera.
    const center = kind === "air-trick" ? to : from;
    this.ring(
      {
        x: center.x + axis.x,
        y: center.y + 0.65 + axis.y,
        z: center.z + axis.z,
      },
      axis,
      0.24,
    );
    this.root.visible = true;
  }
  trail(from, to, settings = {}, force = false) {
    if (settings.particles === "minimal") return;
    const last = this.lastTrail || from;
    const d = Math.hypot(to.x - last.x, to.y - last.y, to.z - last.z);
    if (d < (settings.particles === "decreased" ? 0.8 : 0.4) && !force) {
      this.lastTrail ||= { ...from };
      return;
    }
    if (d < 0.01) return;
    const yaw = to.yaw || 0,
      side = { x: Math.cos(yaw), z: -Math.sin(yaw) };
    for (const [offset, y] of [
      [-0.42, 0.9],
      [0.42, 0.9],
      [0, 1.65],
    ]) {
      this.streak(
        {
          x: last.x + side.x * offset,
          y: last.y + y,
          z: last.z + side.z * offset,
        },
        { x: to.x + side.x * offset, y: to.y + y, z: to.z + side.z * offset },
      );
    }
    // The wake is behind a first-person camera, so also draw short peripheral
    // speed lines ahead of the eyes. They use the same bounded line batch.
    const dx = (to.x - last.x) / d,
      dy = (to.y - last.y) / d,
      dz = (to.z - last.z) / d;
    const rays = settings.particles === "decreased" ? 3 : 6;
    for (let i = 0; i < rays; i++) {
      const a = (i * Math.PI * 2) / rays,
        ox = Math.cos(a) * 0.7,
        oy = 1.55 + Math.sin(a) * 0.55;
      this.streak(
        {
          x: to.x + dx * 0.55 + side.x * ox,
          y: to.y + dy * 0.55 + oy,
          z: to.z + dz * 0.55 + side.z * ox,
        },
        {
          x: to.x + dx * 1.8 + side.x * ox * 0.7,
          y: to.y + dy * 1.8 + 1.55 + (oy - 1.55) * 0.7,
          z: to.z + dz * 1.8 + side.z * ox * 0.7,
        },
        0.14,
      );
    }
    if (settings.fancyGraphics !== false && settings.particles !== "decreased")
      this.ghost(last);
    this.lastTrail = { x: to.x, y: to.y, z: to.z, yaw: to.yaw };
    this.root.visible = true;
  }
  update(dt, playing, settings = {}) {
    if (!playing || settings.particles === "minimal") {
      if (
        this.root.visible ||
        this.boost ||
        this.lastTrail ||
        this.rings.length ||
        this.ghosts.length ||
        this.streaks.length
      )
        this.clear();
      return;
    }
    this.boost = Math.max(0, this.boost - dt / 0.35);
    for (const key of ["rings", "ghosts", "streaks"])
      this[key] = this[key].filter((q) => (q.life -= dt) > 0);
    this.root.visible = !!(
      this.rings.length +
      this.ghosts.length +
      this.streaks.length
    );
    const dummy = this.dummy;
    this.sigils.count = this.rings.length;
    this.rings.forEach((q, i) => {
      const f = q.life / q.max;
      dummy.position.set(q.p.x, q.p.y, q.p.z);
      dummy.quaternion.setFromUnitVectors(
        up,
        new THREE.Vector3(q.axis.x, q.axis.y, q.axis.z).normalize(),
      );
      dummy.scale.setScalar(0.7 + (1 - f) * 2.3);
      dummy.updateMatrix();
      this.sigils.setMatrixAt(i, dummy.matrix);
      this.color.copy(i % 2 ? cyan : violet).multiplyScalar(f);
      this.sigils.setColorAt(i, this.color);
    });
    this.echoes.count =
      settings.fancyGraphics === false || settings.particles === "decreased"
        ? 0
        : this.ghosts.length;
    this.ghosts.slice(0, this.echoes.count).forEach((q, i) => {
      dummy.position.set(q.p.x, q.p.y, q.p.z);
      dummy.rotation.set(0, q.p.yaw, 0);
      dummy.scale.setScalar(1);
      dummy.updateMatrix();
      this.echoes.setMatrixAt(i, dummy.matrix);
      this.color.copy(i % 2 ? cyan : violet).multiplyScalar(q.life / q.max);
      this.echoes.setColorAt(i, this.color);
    });
    this.streaks.forEach((q, i) => {
      this.positions.set(
        [q.from.x, q.from.y, q.from.z, q.to.x, q.to.y, q.to.z],
        i * 6,
      );
      const f = q.life / q.max;
      this.color.copy(i % 2 ? cyan : violet).multiplyScalar(f);
      this.colors.set(
        [
          this.color.r,
          this.color.g,
          this.color.b,
          this.color.r * 0.25,
          this.color.g * 0.25,
          this.color.b * 0.25,
        ],
        i * 6,
      );
    });
    this.sigils.instanceMatrix.needsUpdate = true;
    this.echoes.instanceMatrix.needsUpdate = true;
    if (this.sigils.instanceColor) this.sigils.instanceColor.needsUpdate = true;
    if (this.echoes.instanceColor) this.echoes.instanceColor.needsUpdate = true;
    this.lines.geometry.setDrawRange(0, this.streaks.length * 2);
    this.lines.geometry.attributes.position.needsUpdate = true;
    this.lines.geometry.attributes.color.needsUpdate = true;
  }
}
