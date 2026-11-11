import { endingState } from "./titan-ending.js";
import * as T from "three";
import {
  titanDefeatPose,
  titanPiercePosition,
  TITAN_CHEST_BREACH as CHEST,
  cinemaEase,
} from "./titan-finale.js";
import { titanWorldPoint } from "./titan-space.js";
export function installTitanBreach(root, uniforms) {
  uniforms.rupture ||= { value: 0 };
  const patch = (material) => {
    const previous = material.onBeforeCompile,
      key = material.customProgramCacheKey.bind(material);
    material.onBeforeCompile = (shader) => {
      previous?.(shader);
      shader.uniforms.titanBreachInverse = uniforms.inverse;
      shader.uniforms.titanBreachRadius = uniforms.radius;
      shader.uniforms.titanRupture = uniforms.rupture;
      shader.vertexShader =
        "uniform mat4 titanBreachInverse;varying vec3 titanBreachP;\n" +
        shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace(
        "#include <worldpos_vertex>",
        "#include <worldpos_vertex>\n titanBreachP=(titanBreachInverse*modelMatrix*vec4(transformed,1.)).xyz;",
      );
      shader.fragmentShader =
        "uniform float titanBreachRadius;uniform float titanRupture;varying vec3 titanBreachP;\n" +
        shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <clipping_planes_fragment>",
        `#include <clipping_planes_fragment>
    if(titanBreachRadius>0.01&&abs(titanBreachP.z+7.5)<22.0&&length(titanBreachP.xy-vec2(0.,64.))<titanBreachRadius)discard;
    float shard=fract(sin(dot(floor(titanBreachP*1.3),vec3(127.1,311.7,74.7)))*43758.5453);
    float shell=clamp(length((titanBreachP-vec3(0.,70.,-15.))/vec3(32.,45.,24.)),0.,1.);
    if(titanRupture>0.0&&shell*.7+shard*.3<titanRupture)discard;`,
      );
    };
    material.onBeforeCompile = ((compile) => (shader) => {
      compile(shader);
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\n float fractureEdge=1.-smoothstep(0.,.065,abs(shell*.7+shard*.3-titanRupture));totalEmissiveRadiance+=vec3(3.6,.7,.08)*fractureEdge*titanRupture*(1.-titanRupture)*1.2;",
      );
    })(material.onBeforeCompile);
    material.customProgramCacheKey = () => key() + ":titan-chest-breach-v2";
    material.needsUpdate = true;
  };
  const materials = new Set();
  root.traverse((o) => {
    if (o.isMesh) {
      for (const m of Array.isArray(o.material) ? o.material : [o.material])
        if (!materials.has(m)) {
          patch(m);
          materials.add(m);
        }
      o.customDepthMaterial = new T.MeshDepthMaterial({
        depthPacking: T.RGBADepthPacking,
      });
      patch(o.customDepthMaterial);
      o.userData.titanBreach = uniforms;
      o.userData.titanBreachNormal = new T.MeshNormalMaterial();
      patch(o.userData.titanBreachNormal);
      const before = o.onBeforeRender,
        shadow = o.onBeforeShadow;
      o.onBeforeRender = function (...args) {
        uniforms.inverse.value.copy(root.matrixWorld).invert();
        before?.apply(this, args);
      };
      o.onBeforeShadow = function (...args) {
        uniforms.inverse.value.copy(root.matrixWorld).invert();
        shadow?.apply(this, args);
      };
    }
  });
  return materials.size;
}
export class TitanFinaleView {
  constructor(scene) {
    this.scene = scene;
    this.uniforms = {
      inverse: { value: new T.Matrix4() },
      radius: { value: 0 },
    };
    this.dummy = new T.Object3D();
    this.hole = new T.Group();
    this.hole.name = "Open chest breach";
    const dark = new T.MeshStandardMaterial({
      color: "#070a0d",
      metalness: 0.65,
      roughness: 0.56,
      side: T.DoubleSide,
      emissive: "#a83708",
      emissiveIntensity: 0.025,
    });
    this.wall = new T.Mesh(
      new T.CylinderGeometry(1, 1, 15, 48, 1, true).rotateX(Math.PI / 2),
      dark,
    );
    this.wall.position.set(0, 64, -7.5);
    this.hole.add(this.wall);
    this.rims = [-0.6, -14.6].map((z) => {
      const m = new T.Mesh(new T.TorusGeometry(1, 0.09, 8, 48), dark);
      m.position.set(0, 64, z);
      this.hole.add(m);
      return m;
    });
    this.tears = new T.InstancedMesh(new T.ConeGeometry(0.6, 2.3, 3), dark, 24);
    this.hole.add(this.tears);
    this.fragments = new T.InstancedMesh(
      new T.BoxGeometry(1, 1, 1),
      new T.MeshStandardMaterial({
        color: "#242b33",
        metalness: 0.7,
        roughness: 0.42,
        emissive: "#b6221a",
        emissiveIntensity: 0.25,
      }),
      96,
    );
    this.fragments.frustumCulled = false;
    scene.add(this.fragments);
    this.trail = new T.InstancedMesh(
      new T.CylinderGeometry(0.07, 0.16, 1, 6),
      new T.MeshBasicMaterial({
        color: "#fff1ac",
        transparent: true,
        opacity: 0.48,
        blending: T.AdditiveBlending,
        depthWrite: false,
      }),
      48,
    );
    this.trail.frustumCulled = false;
    this.trail.userData.titanAO = false;
    scene.add(this.trail);
    this.shock = new T.Mesh(
      new T.TorusGeometry(1, 0.008, 4, 80),
      new T.MeshBasicMaterial({
        color: "#ffdc99",
        transparent: true,
        opacity: 0,
        blending: T.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.shock.userData.titanAO = false;
    scene.add(this.shock);
    this.light = new T.PointLight("#ffcf8d", 0, 80, 2);
    scene.add(this.light);
  }
  dispose() {
    this.bound?.traverse((o) => {
      o.customDepthMaterial?.dispose();
      o.userData.titanBreachNormal?.dispose();
    });
  }
  update(s, boss) {
    if (this.bound !== boss) {
      this.dispose();
      this.bound = boss;
      installTitanBreach(boss, this.uniforms);
      boss.add(this.hole);
    }
    const active = ["finale", "victory"].includes(s.stage),
      t = s.stage === "victory" ? 7 : s.stageTime,
      a = titanDefeatPose(t),
      r = active ? a.radius : 0;
    this.uniforms.radius.value = r;
    this.uniforms.rupture.value = endingState(s).rupture;
    this.hole.visible = r > 0.02 && endingState(s).rupture < 0.06;
    // Cylinder was rotated into Z; use a local-axis scale without closing either end.
    this.wall.scale.set(r, r, 1);
    for (const rim of this.rims) rim.scale.set(r, r, 1);
    this.tears.count = r > 0.02 ? 24 : 0;
    for (let i = 0; i < this.tears.count; i++) {
      const angle = (i * Math.PI) / 12,
        rad = r * (1.03 + 0.06 * Math.sin(i * 9));
      this.dummy.position.set(
        Math.sin(angle) * rad,
        64 + Math.cos(angle) * rad,
        i % 2 ? -0.5 : -14.5,
      );
      this.dummy.rotation.set(0.7 * Math.sin(i), 0, -angle);
      this.dummy.scale.setScalar(0.6 + 0.4 * Math.sin(i * 3) ** 2);
      this.dummy.updateMatrix();
      this.tears.setMatrixAt(i, this.dummy.matrix);
    }
    this.tears.instanceMatrix.needsUpdate = true;
    this.fragments.count =
      active && t > 3.6 && t < 6.4 && s.config.particles ? 96 : 0;
    for (let i = 0; i < this.fragments.count; i++) {
      const age = Math.max(0, t - 3.6 - (i % 8) * 0.025),
        angle = i * 2.399963,
        side = i % 2 ? 1 : -1,
        rad = 3 + age * (8 + (i % 7)),
        p = titanWorldPoint(s, {
          x: Math.sin(angle) * rad,
          y: 64 + Math.cos(angle) * rad + age * 8 - age * age * 6,
          z: -7.5 + side * age * (22 + (i % 13)),
        });
      this.dummy.position.set(p.x, Math.max(0.3, p.y), p.z);
      this.dummy.rotation.set(angle + age * 3, age * 4, angle * 0.7);
      this.dummy.scale.set(
        0.3 + (i % 4) * 0.18,
        0.3 + (i % 3) * 0.4,
        0.25 + (i % 5) * 0.18,
      );
      this.dummy.updateMatrix();
      this.fragments.setMatrixAt(i, this.dummy.matrix);
    }
    this.fragments.instanceMatrix.needsUpdate = true;
    this.trail.count =
      active && t > 1.9 && t < 5.5 && s.config.particles ? 48 : 0;
    for (let i = 0; i < this.trail.count; i++) {
      const now = Math.max(0, t - i * 0.009),
        from = s.cinematicFrom || s.avatar,
        p = titanPiercePosition(from, now, s),
        q = titanPiercePosition(from, Math.max(0, now - 0.012), s),
        d = new T.Vector3(p.x - q.x, p.y - q.y, p.z - q.z);
      this.dummy.position.set(
        (p.x + q.x) / 2,
        (p.y + q.y) / 2 + 1.1,
        (p.z + q.z) / 2,
      );
      this.dummy.quaternion.setFromUnitVectors(
        new T.Vector3(0, 1, 0),
        d.normalize(),
      );
      this.dummy.scale.setScalar(1 - i / 55);
      this.dummy.scale.y = Math.max(
        0.1,
        Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z),
      );
      this.dummy.updateMatrix();
      this.trail.setMatrixAt(i, this.dummy.matrix);
    }
    this.trail.instanceMatrix.needsUpdate = true;
    const p = titanWorldPoint(s, CHEST),
      age = t - 3.6;
    this.shock.visible = active && age >= 0 && age < 0.5 && s.config.particles;
    this.shock.position.set(p.x, p.y, p.z);
    this.shock.rotation.set(0, s.boss?.yaw || 0, 0);
    this.shock.scale.setScalar(2 + Math.max(0, age) * 48);
    this.shock.material.opacity = Math.max(0, 0.3 * (1 - age / 0.5));
    this.light.position.copy(this.shock.position);
    this.light.intensity =
      active && s.config.lighting
        ? 120 * Math.exp(-Math.max(0, age) * 8) * (age >= 0 ? 1 : 0)
        : 0;
  }
}
