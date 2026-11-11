import * as T from "three";
export class GrassCyloopView {
  constructor(scene) {
    this.path = new T.InstancedMesh(
      new T.PlaneGeometry(1, 1),
      new T.MeshBasicMaterial({
        color: "#37baff",
        transparent: true,
        opacity: 0.8,
        depthWrite: false,
        side: T.DoubleSide,
        toneMapped: false,
        blending: T.AdditiveBlending,
      }),
      128,
    );
    this.rings = new T.InstancedMesh(
      new T.TorusGeometry(0.48, 0.09, 6, 16),
      new T.MeshStandardMaterial({
        color: "#ffd449",
        metalness: 0.5,
        roughness: 0.25,
        emissive: "#c17504",
        emissiveIntensity: 0.35,
      }),
      64,
    );
    for (const mesh of [this.path, this.rings]) {
      mesh.frustumCulled = false;
      mesh.count = 0;
      mesh.userData.titanAO = false;
      mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
      scene.add(mesh);
    }
    this.dummy = new T.Object3D();
  }
  update(s) {
    const q = s.grassCyloop,
      active = s.stage === "traversal" && !s.emerald;
    this.path.visible = this.rings.visible = active;
    if (!active || !q) return;
    const points = q.finish?.points || q.points,
      closed = !!q.finish;
    this.path.count = Math.max(0, points.length - (closed ? 0 : 1));
    this.path.material.color.set(closed ? "#ff76e6" : "#35bdff");
    this.path.material.opacity = closed
      ? 0.8 * Math.max(0, 1 - (s.time - q.finish.at) / 1.1)
      : 0.8;
    for (let i = 0; i < this.path.count; i++) {
      const a = points[i],
        b = points[(i + 1) % points.length],
        d = this.dummy;
      d.position.set((a.x + b.x) / 2, 0.08, (a.z + b.z) / 2);
      d.rotation.set(-Math.PI / 2, 0, Math.atan2(-(b.z - a.z), b.x - a.x));
      d.scale.set(Math.hypot(b.x - a.x, b.z - a.z) + 0.1, 0.23, 1);
      d.updateMatrix();
      this.path.setMatrixAt(i, d.matrix);
    }
    this.path.instanceMatrix.needsUpdate = true;
    this.rings.count = q.drops.length;
    for (let i = 0; i < q.drops.length; i++) {
      const n = q.drops[i],
        d = this.dummy,
        t = Math.min(1, n.age / 0.5);
      d.position.set(
        n.x,
        1 + Math.sin(t * Math.PI) * 1.8 + Math.sin(s.time * 3 + i) * 0.08,
        n.z,
      );
      d.rotation.set(0, s.time * 2 + i, 0);
      d.scale.setScalar(1);
      d.updateMatrix();
      this.rings.setMatrixAt(i, d.matrix);
    }
    this.rings.instanceMatrix.needsUpdate = true;
  }
}
