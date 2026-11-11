import * as T from "three";
// Instanced dust/stone, six temporary craters and two light slots, all sim-clocked.
export class TitanGroundFX {
  constructor(scene, floor, particleTexture) {
    this.events = [];
    this.seen = new Set();
    this.scene = scene;
    this.floor = floor;
    this.dummy = new T.Object3D();
    this.craters = Array.from({ length: 6 }, () => new T.Vector4(0, 0, 0, 0));
    const previous = floor.material.onBeforeCompile;
    floor.material.onBeforeCompile = (shader) => {
      previous?.(shader);
      shader.uniforms.titanCrater = { value: this.craters };
      shader.vertexShader =
        "uniform vec4 titanCrater[6];\n" + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
    for(int i=0;i<6;i++){vec4 c=titanCrater[i];float d=length(position.xz-c.xy)/max(.1,c.z);transformed.y-=exp(-d*d*5.)*c.w;}`,
      );
    };
    this.rings = new T.InstancedMesh(
      new T.RingGeometry(0.7, 1, 40).rotateX(-Math.PI / 2),
      new T.MeshBasicMaterial({
        color: "#302d29",
        transparent: true,
        opacity: 0.4,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
      }),
      6,
    );
    this.rings.frustumCulled = false;
    this.rings.userData.titanAO = false;
    scene.add(this.rings);
    this.stones = new T.InstancedMesh(
      new T.IcosahedronGeometry(0.18, 0),
      new T.MeshStandardMaterial({ color: "#73766c", roughness: 1 }),
      72,
    );
    this.stones.frustumCulled = false;
    scene.add(this.stones);
    this.dust = new T.InstancedMesh(
      new T.PlaneGeometry(1, 1),
      new T.MeshBasicMaterial({
        map: particleTexture,
        color: "#b9af91",
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
      }),
      72,
    );
    this.dust.frustumCulled = false;
    this.dust.userData.titanAO = false;
    scene.add(this.dust);
    this.lights = Array.from({ length: 2 }, () => {
      const l = new T.PointLight("#ffba73", 0, 26, 2);
      scene.add(l);
      return l;
    });
  }
  event(e, s) {
    if (this.attempt !== s.attempt) {
      this.attempt = s.attempt;
      this.events = [];
    }
    if (e.eventId && this.seen.has(e.eventId)) return;
    if (e.eventId) {
      this.seen.add(e.eventId);
      if (this.seen.size > 96)
        this.seen.delete(this.seen.values().next().value);
    }
    if (
      ![
        "footstep",
        "stomp",
        "impact",
        "parry",
        "counter",
        "hit",
        "boss-release",
        "transformation-cue",
      ].includes(e.type)
    )
      return;
    const p = e.point || { x: s.avatar.x, y: s.avatar.y + 1.8, z: s.avatar.z };
    if (
      e.type === "footstep" ||
      e.type === "stomp" ||
      (e.type === "impact" && p.y < 8)
    )
      this.events.push({
        p: { ...p, y: 0.05 },
        born: s.time,
        ground: true,
        strength: e.type === "stomp" ? 1.8 : Math.min(1.8, e.strength || 1),
      });
    if (
      [
        "hit",
        "impact",
        "parry",
        "counter",
        "transformation-cue",
        "stomp",
        "boss-release",
      ].includes(e.type)
    )
      this.events.push({
        p: { ...p },
        born: s.time,
        ground: false,
        strength: e.type === "parry" ? 1.5 : Math.min(1.8, e.strength || 1),
        color: e.type === "parry" ? "#71d7ff" : "#ffbc65",
      });
    this.events = this.events.slice(-12);
  }
  update(s, camera) {
    if (this.attempt !== s.attempt) {
      this.attempt = s.attempt;
      this.events = [];
    }
    this.events = this.events.filter(
      (e) => s.time - e.born >= 0 && s.time - e.born < 10,
    );
    const ground = this.events.filter((e) => e.ground).slice(-6);
    let count = 0;
    for (let i = 0; i < 6; i++) {
      const e = ground[i],
        age = e ? s.time - e.born : 10,
        fade = Math.max(0, 1 - age / 10);
      this.craters[i].set(
        e?.p.x || 0,
        e?.p.z || 0,
        e ? 5 * e.strength : 0,
        s.config.groundEffects === false ? 0 : fade * 0.22,
      );
      this.dummy.position.set(e?.p.x || 0, 0.045, e?.p.z || 0);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.setScalar(
        e && s.config.groundEffects !== false ? 5 * e.strength * fade : 0,
      );
      this.dummy.updateMatrix();
      this.rings.setMatrixAt(i, this.dummy.matrix);
      if (
        !e ||
        age > 1.8 ||
        !s.config.particles ||
        s.config.groundEffects === false
      )
        continue;
      for (let n = 0; n < 12; n++) {
        const a = n * 2.399963 + i,
          r = age * (4 + (n % 4)),
          y = Math.max(0.05, (3 + (n % 3)) * age - age * age * 4);
        this.dummy.position.set(
          e.p.x + Math.sin(a) * r,
          y,
          e.p.z + Math.cos(a) * r,
        );
        this.dummy.rotation.set(a + age * 2, a, age);
        this.dummy.scale.setScalar((1 - age / 1.8) * ((n % 3) + 0.5));
        this.dummy.updateMatrix();
        this.stones.setMatrixAt(count, this.dummy.matrix);
        this.dummy.position.y += 0.4 + age;
        this.dummy.quaternion.copy(camera.quaternion);
        this.dummy.scale.setScalar((1 + age * 4) * (1 - age / 1.8));
        this.dummy.updateMatrix();
        this.dust.setMatrixAt(count, this.dummy.matrix);
        count++;
      }
    }
    this.rings.visible = s.config.groundEffects !== false;
    this.rings.instanceMatrix.needsUpdate = true;
    this.stones.count = this.dust.count = count;
    this.stones.instanceMatrix.needsUpdate =
      this.dust.instanceMatrix.needsUpdate = true;
    const flashes = this.events
      .filter((e) => !e.ground && s.time - e.born < 0.25)
      .slice(-2);
    this.lights.forEach((l, i) => {
      const e = flashes[i],
        age = e ? s.time - e.born : 1;
      l.intensity =
        e && s.config.lighting
          ? e.strength * 18 * Math.max(0, 1 - age / 0.25)
          : 0;
      if (e) {
        l.position.set(e.p.x, e.p.y, e.p.z);
        l.color.set(e.color);
      }
    });
  }
}
