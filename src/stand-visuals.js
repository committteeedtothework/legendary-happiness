import * as THREE from "three";
import {
  createStandModel,
  createDinosaurModel,
  animateStandModel,
} from "./stand-models.js";
import { STANDS } from "./stands-data.js";
import { palmContains } from "./palm-terrain.js";
export class StandVisuals {
  constructor(renderer) {
    this.r = renderer;
    this.entries = new Map();
    this.remoteSounds = new Map();
    this.dinos = new Map();
    this.trialFade = 0;
    this.lastSound = null;
    const positions = new Float32Array(192 * 3).fill(-10000),
      colors = new Float32Array(192 * 3),
      g = new THREE.BufferGeometry();
    g.setAttribute(
      "position",
      new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage),
    );
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    this.positions = positions;
    this.colors = colors;
    this.points = new THREE.Points(
      g,
      new THREE.PointsMaterial({
        size: 0.105,
        vertexColors: true,
        transparent: true,
        opacity: 0.65,
        depthWrite: false,
      }),
    );
    this.points.frustumCulled = false;
    renderer.scene.add(this.points);
    this.ropePositions = new Float32Array(32 * 3);
    const line = new THREE.BufferGeometry();
    line.setAttribute(
      "position",
      new THREE.BufferAttribute(this.ropePositions, 3).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    this.rope = new THREE.Line(
      line,
      new THREE.LineBasicMaterial({
        color: "#e1c68c",
        transparent: true,
        opacity: 0.8,
      }),
    );
    this.rope.visible = false;
    renderer.scene.add(this.rope);
    this.instance = new THREE.Object3D();
    this.nails = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.05, 0.05, 0.3),
      new THREE.MeshLambertMaterial({ color: "#eadfc3" }),
      128,
    );
    this.nails.count = 0;
    this.nails.frustumCulled = false;
    renderer.scene.add(this.nails);
    this.rifts = new THREE.InstancedMesh(
      new THREE.TorusGeometry(0.5, 0.05, 4, 16),
      new THREE.MeshBasicMaterial({
        color: "#b981d4",
        transparent: true,
        opacity: 0.7,
        depthWrite: false,
      }),
      16,
    );
    this.rifts.count = 0;
    this.rifts.frustumCulled = false;
    renderer.scene.add(this.rifts);
    this.ropeHands = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.14, 0.14, 0.13),
      new THREE.MeshLambertMaterial({ color: "#e6d6ad" }),
      4,
    );
    this.ropeHands.count = 0;
    this.ropeHands.frustumCulled = false;
    renderer.scene.add(this.ropeHands);
    this.ghosts = [];
    for (let i = 0; i < 3; i++) {
      const m = createStandModel("lonesome");
      m.visible = false;
      m.traverse((o) => {
        if (o.material) {
          o.material.opacity = 0.16;
          o.material.color.set("#171221");
          o.material.depthWrite = false;
        }
      });
      renderer.scene.add(m);
      this.ghosts.push(m);
    }
  }
  clear() {
    for (const entry of [...this.entries.values(), ...this.dinos.values()])
      this.r.disposeObject(entry.model);
    this.entries.clear();
    this.remoteSounds.clear();
    this.dinos.clear();
    this.points.visible = false;
    this.rope.visible = false;
    this.ghosts.forEach((m) => (m.visible = false));
    this.lastSound = null;
    this.nails.count = 0;
    this.rifts.count = 0;
    this.ropeHands.count = 0;
    this.trialFade = 0;
  }
  sync(g, dt) {
    if (!g.active) {
      this.clear();
      this.trial = null;
      return;
    }
    const now = g.tickCount || 0,
      time = g.visualTime || g.elapsed || 0,
      actors = [
        { id: "local", p: g.player, local: true },
        ...(g.multiplayer?.remotePoses || [])
          .filter((p) => p.id !== g.multiplayer.id)
          .map((p) => ({ id: p.id, p, local: false })),
      ];
    const seen = new Set(),
      dinoSeen = new Set();
    let n = 0,
      riftCount = 0;
    const particle = (x, y, z, c) => {
      if (n >= 192) return;
      this.positions.set([x, y, z], n * 3);
      this.colors.set(c, n * 3);
      n++;
    };
    for (const actor of actors) {
      const p = actor.p,
        s = p.standData || p.stand;
      if (!s) continue;
      const age = (now - (s.effect?.tick ?? -1000)) / 20,
        kick = age >= 0 && age < 0.6 ? Math.sin((age / 0.6) * Math.PI) : 0;
      if (s.id && s.summoned && STANDS[s.id]) {
        seen.add(actor.id);
        let entry = this.entries.get(actor.id);
        if (!entry || entry.id !== s.id) {
          if (entry) this.r.disposeObject(entry.model);
          const model = createStandModel(s.id);
          this.r.scene.add(model);
          entry = { model, id: s.id };
          this.entries.set(actor.id, entry);
        }
        const m = entry.model,
          a = p.yaw,
          awaken = (s.awakeningUntil || 0) > now,
          side = awaken ? 0.9 : 0.85,
          back = awaken ? -1.3 : 0.65;
        const target = new THREE.Vector3(
          p.x + Math.cos(a) * side + Math.sin(a) * back,
          p.y + 0.12 + Math.sin(time * 2) * 0.06,
          p.z - Math.sin(a) * side + Math.cos(a) * back,
        );
        if (!entry.placed) {
          m.position.copy(target);
          entry.placed = true;
        } else m.position.lerp(target, 1 - Math.exp(-12 * dt));
        m.rotation.y = a;
        m.visible = p.health === undefined || p.health > 0;
        animateStandModel(m, time, kick);
        if (g.settings.particles !== "minimal") {
          const color = new THREE.Color(STANDS[s.id].color);
          for (let j = 0; j < (awaken ? 28 : 8); j++) {
            const angle = time * 2 + j * 2.399,
              r = awaken ? 0.7 : 0.4;
            particle(
              p.x + Math.cos(angle) * r,
              p.y + (j % 9) * 0.19,
              p.z + Math.sin(angle) * r,
              [color.r, color.g, color.b],
            );
          }
        }
      }
      if (s.transformed) {
        dinoSeen.add(actor.id);
        let entry = this.dinos.get(actor.id);
        if (!entry) {
          entry = { model: createDinosaurModel() };
          this.r.scene.add(entry.model);
          this.dinos.set(actor.id, entry);
        }
        entry.model.position.set(p.x, p.y, p.z);
        entry.model.rotation.y = p.yaw;
        entry.model.visible = !actor.local || g.cameraMode !== 0;
        animateStandModel(
          entry.model,
          time,
          Math.min(1, Math.hypot(p.vx || 0, p.vz || 0) / 4),
        );
      }
      if (
        !actor.local &&
        s.effect &&
        age < 1 &&
        Math.hypot(p.x - g.player.x, p.z - g.player.z) < 20
      ) {
        const key = s.effect.tick + ":" + s.effect.kind;
        if (this.remoteSounds.get(actor.id) !== key) {
          this.remoteSounds.set(actor.id, key);
          g.audio?.standSound?.(s.effect.kind);
        }
      }
      if (
        actor.local &&
        s.effect &&
        this.lastSound !== s.effect.tick + ":" + s.effect.kind
      ) {
        this.lastSound = s.effect.tick + ":" + s.effect.kind;
        if (age < 1 && g.multiplayer?.isGuest)
          g.audio?.standSound?.(s.effect.kind);
      }
    }
    for (const actor of actors) {
      const s = actor.p.standData || actor.p.stand;
      if (s?.rift?.until > now)
        for (const point of [s.rift, actor.p]) {
          if (riftCount >= 16) break;
          this.instance.position.set(point.x, point.y + 1, point.z);
          this.instance.rotation.set(0, actor.p.yaw || 0, time * 0.5);
          this.instance.scale.setScalar(1);
          this.instance.updateMatrix();
          this.rifts.setMatrixAt(riftCount++, this.instance.matrix);
        }
    }
    this.rifts.count = riftCount;
    this.rifts.instanceMatrix.needsUpdate = true;
    for (const [key, e] of this.entries)
      if (!seen.has(key)) {
        this.r.disposeObject(e.model);
        this.entries.delete(key);
      }
    for (const [key, e] of this.dinos)
      if (!dinoSeen.has(key)) {
        this.r.disposeObject(e.model);
        this.dinos.delete(key);
      }
    const s = g.player.standData,
      t = s?.trial,
      site =
        g.dimension === "overworld"
          ? (g.world.palm?.sites || []).find((o) =>
              palmContains(o, g.player, 20),
            )
          : null;
    const target =
      g.active && site
        ? 0.3 + (t?.phase === "trial" ? t.intensity || 0 : 0) * 0.7
        : 0;
    this.trialFade += (target - this.trialFade) * (1 - Math.exp(-2 * dt));
    this.trial = t;
    if (site && g.settings.particles !== "minimal")
      for (let j = 0; j < 40; j++) {
        const angle = j * 2.399 + time * 0.1,
          r = 4 + (j % 7) * 1.4;
        particle(
          g.player.x + Math.sin(angle) * r,
          g.player.y + (j % 5) * 0.6 + 0.2,
          g.player.z + Math.cos(angle) * r,
          [0.65, 0.32, 0.15],
        );
      }
    for (const [i, m] of this.ghosts.entries()) {
      const visible =
        t?.phase === "trial" &&
        t.phenomenon === 2 &&
        t.elapsed - (t.signalTick || 0) < 25;
      m.visible = !!visible;
      if (visible) {
        const angle = g.player.yaw + 1.2 + i * 1.9;
        m.position.set(
          g.player.x + Math.sin(angle) * 9,
          g.player.y,
          g.player.z + Math.cos(angle) * 9,
        );
        m.rotation.y = angle + Math.PI;
      }
    }
    this.rope.visible = !!(
      s?.effect?.kind === "rope" && now - s.effect.tick < 16
    );
    if (this.rope.visible) {
      const end = s.effect;
      for (let i = 0; i < 32; i++) {
        const t = i / 31;
        this.ropePositions.set(
          [
            g.player.x + (end.x - g.player.x) * t,
            g.player.y +
              1.2 +
              (end.y - g.player.y - 1.2) * t -
              Math.sin(t * Math.PI) * 0.3,
            g.player.z + (end.z - g.player.z) * t,
          ],
          i * 3,
        );
      }
      for (let j = 0; j < 4; j++) {
        const t = 0.65 + j * 0.115;
        this.instance.position.set(
          g.player.x + (end.x - g.player.x) * t,
          g.player.y + 1.2 + (end.y - g.player.y - 1.2) * t,
          g.player.z + (end.z - g.player.z) * t,
        );
        this.instance.rotation.set(0, time * 0.5, 0);
        this.instance.updateMatrix();
        this.ropeHands.setMatrixAt(j, this.instance.matrix);
      }
      this.rope.geometry.attributes.position.needsUpdate = true;
    }
    this.ropeHands.count = this.rope.visible ? 4 : 0;
    this.ropeHands.instanceMatrix.needsUpdate = true;
    let nailCount = 0;
    for (const q of (g.multiplayer?.isGuest
      ? g.sharedStandProjectiles
      : g.standProjectiles) || []) {
      particle(q.x, q.y, q.z, [1, 0.8, 0.35]);
      if (nailCount < 128) {
        this.instance.position.set(q.x, q.y, q.z);
        this.instance.rotation.set(0, 0, 0);
        this.instance.lookAt(q.x + q.vx, q.y + q.vy, q.z + q.vz);
        this.instance.rotateZ(q.spin || time * 20);
        this.instance.updateMatrix();
        this.nails.setMatrixAt(nailCount++, this.instance.matrix);
      }
      particle(
        q.x - q.vx * 0.25,
        q.y - q.vy * 0.25,
        q.z - q.vz * 0.25,
        [0.8, 0.4, 0.8],
      );
    }
    this.nails.count = nailCount;
    this.nails.instanceMatrix.needsUpdate = true;
    for (let i = n; i < 192; i++)
      this.positions.set([-10000, -10000, -10000], i * 3);
    for (const key of this.remoteSounds.keys())
      if (!actors.some((a) => a.id === key)) this.remoteSounds.delete(key);
    this.points.visible = g.active && g.settings.particles !== "minimal";
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
  atmosphere(sky, player, elapsed) {
    const f = this.trialFade;
    if (f <= 0.001) return;
    const pulse =
      this.trial?.phase === "trial" &&
      this.trial.elapsed - (this.trial.signalTick || 0) < 22
        ? Math.sin(elapsed * 8) ** 2 * 0.15
        : 0;
    sky.lerp(new THREE.Color("#ae4930"), Math.min(0.75, f * 0.78 + pulse));
    this.r.hemi.intensity *= 1 - f * 0.3;
    this.r.sun.intensity *= 1 - f * 0.4;
    this.r.hemi.groundColor.lerp(new THREE.Color("#6d2440"), f * 0.4);
  }
}
