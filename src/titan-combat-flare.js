import * as T from "three";
import { TITAN_POWER_SCALE } from "./titan-balance.js";
// One impact-star batch and one shock-ring batch. Event ages, not render dt,
// control expansion/fade. Never duplicates a character or changes hit detection.
export class TitanCombatFlare {
  constructor(scene) {
    this.stars = new T.InstancedMesh(
      new T.PlaneGeometry(1, 1),
      new T.ShaderMaterial({
        transparent: true,
        depthWrite: false,
        side: T.DoubleSide,
        blending: T.AdditiveBlending,
        toneMapped: false,
        vertexShader:
          "varying vec2 fUV;varying vec3 fColor;void main(){fUV=uv;fColor=instanceColor;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}",
        fragmentShader:
          "varying vec2 fUV;varying vec3 fColor;void main(){vec2 q=abs(fUV-.5)*2.;float a=pow(max(0.,1.-q.x),.6)*pow(max(0.,1.-q.y),2.);gl_FragColor=vec4(fColor,a);}",
      }),
      128,
    );
    this.rings = new T.InstancedMesh(
      new T.TorusGeometry(1, 0.018, 4, 48),
      new T.MeshBasicMaterial({
        color: "#ffffff",
        transparent: true,
        opacity: 0.65,
        depthWrite: false,
        side: T.DoubleSide,
        blending: T.AdditiveBlending,
        toneMapped: false,
      }),
      12,
    );
    for (const mesh of [this.stars, this.rings]) {
      mesh.count = 0;
      mesh.visible = false;
      mesh.frustumCulled = false;
      mesh.userData.titanAO = false;
      mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
      scene.add(mesh);
    }
    // Material programs must see the instanced-color attribute on first compile.
    for (let i = 0; i < 128; i++)
      this.stars.setColorAt(i, new T.Color(2.6, 2.2, 1.4));
    for (let i = 0; i < 12; i++) this.rings.setColorAt(i, new T.Color(1, 1, 1));
    this.events = [];
    this.seen = new Set();
    this.dummy = new T.Object3D();
    this.orientation = new T.Quaternion();
    this.axis = new T.Vector3(0, 0, 1);
    this.normal = new T.Vector3();
    this.color = new T.Color();
  }
  event(e, s) {
    if (this.attempt !== (s.attempt || 0)) {
      this.attempt = s.attempt || 0;
      this.events = [];
      this.seen.clear();
    }
    if (
      !["hit", "parry", "counter", "boom", "cross", "shot"].includes(e.type) ||
      !e.point ||
      ![e.point.x, e.point.y, e.point.z].every(Number.isFinite) ||
      (e.age || 0) > 0.18
    )
      return;
    if (e.eventId && this.seen.has(e.eventId)) return;
    if (e.eventId) {
      this.seen.add(e.eventId);
      if (this.seen.size > 128)
        this.seen.delete(this.seen.values().next().value);
    }
    const strength = Math.min(
      2.4,
      0.7 + (e.amount || 200 * TITAN_POWER_SCALE) / (400 * TITAN_POWER_SCALE),
    );
    this.events.push({
      point: { ...e.point },
      normal: { x: e.normal?.x || 0, y: e.normal?.y || 0, z: e.normal?.z ?? 1 },
      born: s.time - (e.age || 0),
      life: e.type === "parry" ? 0.38 : 0.24,
      type: e.type,
      strength,
      ring:
        ["parry", "counter"].includes(e.type) ||
        ["finisher", "perfectCounter", "struggle", "loop"].includes(e.kind),
    });
    this.events = this.events.slice(-12);
  }
  update(s, quality = 2) {
    if (this.attempt !== (s.attempt || 0)) {
      this.attempt = s.attempt || 0;
      this.events = [];
      this.seen.clear();
    }
    this.events = this.events.filter(
      (e) =>
        s.time >= e.born &&
        s.time - e.born < e.life &&
        ["combat", "phase", "finale"].includes(s.stage),
    );
    const enabled = s.config.particles && s.config.impactEffects !== false;
    let n = 0,
      r = 0;
    if (enabled)
      for (const e of this.events) {
        const age = s.time - e.born,
          u = age / e.life,
          fade = (1 - u) ** 2,
          c = quality === 1 ? 4 : 8;
        this.normal.set(e.normal.x, e.normal.y, e.normal.z);
        if (this.normal.lengthSq() < 0.001) this.normal.set(0, 0, 1);
        this.normal.normalize();
        this.orientation.setFromUnitVectors(this.axis, this.normal);
        for (let i = 0; i < c && n < 128; i++) {
          const d = this.dummy,
            a = (i / c) * Math.PI * 2 + 0.2;
          d.position
            .set(e.point.x, e.point.y, e.point.z)
            .addScaledVector(this.normal, 0.16);
          d.quaternion.copy(this.orientation);
          d.rotateZ(a);
          d.scale.set((1 + e.strength) * (1 + u * 3) * fade, 0.13 * fade, 1);
          d.updateMatrix();
          this.stars.setMatrixAt(n, d.matrix);
          this.color
            .setRGB(
              e.type === "parry" ? 1.4 : 2.8,
              e.type === "parry" ? 2.5 : 2.2,
              e.type === "parry" ? 3 : 1.4,
            )
            .multiplyScalar(0.3 + 0.7 * fade);
          this.stars.setColorAt(n++, this.color);
        }
        if (e.ring && r < 12) {
          const d = this.dummy;
          d.position
            .set(e.point.x, e.point.y, e.point.z)
            .addScaledVector(this.normal, 0.14);
          d.quaternion.copy(this.orientation);
          const size = 0.5 + u * (5 + e.strength);
          d.scale.set(size, size, fade);
          d.updateMatrix();
          this.rings.setMatrixAt(r, d.matrix);
          this.rings.setColorAt(
            r++,
            this.color.setRGB(1.8, 1.6, 1.1).multiplyScalar(fade),
          );
        }
      }
    this.stars.count = n;
    this.rings.count = r;
    this.stars.visible = n > 0;
    this.rings.visible = r > 0;
    this.stars.instanceMatrix.needsUpdate = true;
    this.stars.instanceColor.needsUpdate = true;
    this.rings.instanceMatrix.needsUpdate = true;
    this.rings.instanceColor.needsUpdate = true;
  }
}
export function makeTitanEnergyCrescent() {
  const p = [],
    uv = [],
    ids = [],
    steps = 40;
  for (let i = 0; i <= steps; i++) {
    const u = i / steps,
      a = (u - 0.5) * Math.PI * 1.3,
      width = 0.04 + Math.sin(u * Math.PI) ** 0.7 * 0.2;
    for (let side = 0; side < 2; side++) {
      const r = 1 + (side - 0.5) * width;
      p.push(Math.cos(a) * r, Math.sin(a) * r, 0);
      uv.push(u, side);
    }
    if (i < steps) {
      const j = i * 2;
      ids.push(j, j + 1, j + 2, j + 1, j + 3, j + 2);
    }
  }
  const g = new T.BufferGeometry();
  g.setAttribute("position", new T.Float32BufferAttribute(p, 3));
  g.setAttribute("uv", new T.Float32BufferAttribute(uv, 2));
  g.setIndex(ids);
  g.computeVertexNormals();
  return g;
}
export function makeTitanEnergyMaterial() {
  const m = new T.MeshBasicMaterial({
    color: "#9aedff",
    transparent: true,
    opacity: 0.9,
    side: T.DoubleSide,
    depthWrite: false,
    toneMapped: false,
    blending: T.AdditiveBlending,
  });
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = "varying vec2 energyUV;\n" + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      "#include <begin_vertex>\n energyUV=uv;",
    );
    shader.fragmentShader = "varying vec2 energyUV;\n" + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      "#include <color_fragment>\n float edge=1.-abs(energyUV.y*2.-1.);diffuseColor.rgb=mix(vec3(.25,1.3,2.3),vec3(2.8,2.9,3.),pow(edge,3.));diffuseColor.a*=edge*pow(max(0.,sin(energyUV.x*3.141593)),.35);",
    );
  };
  return m;
}
