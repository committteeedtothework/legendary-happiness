import * as T from "three";
export class EndVisuals {
  constructor(scene) {
    this.group = new T.Group();
    this.group.name = "End effects";
    scene.add(this.group);
    this.dummy = new T.Object3D();
    this.orbs = new T.InstancedMesh(
      new T.SphereGeometry(0.2, 10, 8),
      new T.MeshBasicMaterial({ color: "white", toneMapped: false }),
      32,
    );
    this.orbs.frustumCulled = false;
    this.group.add(this.orbs);
    this.clouds = new T.InstancedMesh(
      new T.SphereGeometry(1, 24, 8),
      new T.MeshBasicMaterial({
        color: "#c154e7",
        transparent: true,
        opacity: 0.23,
        depthWrite: false,
        toneMapped: false,
      }),
      16,
    );
    this.clouds.frustumCulled = false;
    this.group.add(this.clouds);
    const geometry = new T.BufferGeometry().setFromPoints([
      new T.Vector3(),
      new T.Vector3(),
    ]);
    this.beam = new T.Line(
      geometry,
      new T.LineBasicMaterial({
        color: "#ef94f6",
        transparent: true,
        opacity: 0.8,
        toneMapped: false,
      }),
    );
    this.beam.frustumCulled = false;
    this.group.add(this.beam);
    this.gateway = new T.Mesh(
      new T.CylinderGeometry(0.1, 0.1, 110, 6),
      new T.MeshBasicMaterial({
        color: "#d39bea",
        transparent: true,
        opacity: 0.35,
        depthWrite: false,
      }),
    );
    this.group.add(this.gateway);
    this.gateway.visible = false;
    this.color = new T.Color();
    this.orbs.count = this.clouds.count = 0;
  }
  update(game, time) {
    const active = game?.active && !game.giganto?.active,
      s = game?.world?.endgame;
    this.group.visible = !!(active && s);
    if (!this.group.visible) return;
    const list = (s.orbs || []).slice(0, 32);
    this.orbs.count = list.length;
    list.forEach((o, i) => {
      this.dummy.position.set(o.x, o.y, o.z);
      const size = o.kind === "breath" ? 1.4 : o.kind === "eye" ? 1.1 : 0.8;
      this.dummy.scale.setScalar(size);
      this.dummy.rotation.set(0, time * 2, 0);
      this.dummy.updateMatrix();
      this.orbs.setMatrixAt(i, this.dummy.matrix);
      this.orbs.setColorAt(
        i,
        this.color.set(
          o.kind === "breath"
            ? "#d360ef"
            : o.kind === "eye"
              ? "#a8e578"
              : "#2ca9a0",
        ),
      );
    });
    this.orbs.instanceMatrix.needsUpdate = true;
    if (this.orbs.instanceColor) this.orbs.instanceColor.needsUpdate = true;
    const clouds = (s.clouds || []).slice(0, 16);
    this.clouds.count = clouds.length;
    clouds.forEach((o, i) => {
      this.dummy.position.set(o.x, o.y + 0.2, o.z);
      this.dummy.scale.set(
        o.radius,
        0.3 + Math.sin(time * 3 + i) * 0.08,
        o.radius,
      );
      this.dummy.updateMatrix();
      this.clouds.setMatrixAt(i, this.dummy.matrix);
    });
    this.clouds.instanceMatrix.needsUpdate = true;
    this.gateway.visible = game.dimension === "end" && s.defeated;
    if (this.gateway.visible) {
      const outer = Math.hypot(game.player.x, game.player.z) > 700;
      this.gateway.position.set(
        outer ? 900.5 : 75.5,
        (outer ? (s.outerGateY ?? 65) : 65) + 55,
        0.5,
      );
    }
    const crystal = game.entities.find((e) => e.id === s.healing && e.hp > 0),
      dragon = game.entities.find((e) => e.type === "dragoon" && e.hp > 0);
    this.beam.visible = !!(crystal && dragon && game.dimension === "end");
    if (this.beam.visible) {
      const a = this.beam.geometry.attributes.position;
      a.setXYZ(0, crystal.x, crystal.y + 1, crystal.z);
      a.setXYZ(1, dragon.x, dragon.y + 3, dragon.z);
      a.needsUpdate = true;
    }
  }
}
