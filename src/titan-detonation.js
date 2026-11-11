import { titanDefeatPose } from "./titan-finale.js";
import * as T from "three";
import { endingState } from "./titan-ending.js";
import { titanWorldPoint } from "./titan-space.js";
const random = (i) => {
  const n = Math.sin(i * 127.1 + 41.7) * 43758.5453;
  return n - Math.floor(n);
};
export class TitanDetonation {
  constructor(scene, boss) {
    this.dummy = new T.Object3D();
    this.base = new T.Vector3();
    this.burstPose = titanDefeatPose(5.45);
    this.burstEuler = new T.Euler(this.burstPose.tilt, 0, 0);
    this.state = null;
    const plate = new T.IcosahedronGeometry(1, 0);
    plate.scale(1, 0.22, 1.7);
    this.plates = new T.InstancedMesh(
      plate,
      new T.MeshStandardMaterial({
        color: "#202631",
        metalness: 0.72,
        roughness: 0.38,
        emissive: "#80170d",
        emissiveIntensity: 0.12,
      }),
      256,
    );
    const armor = boss?.userData.materials?.find((m) => m.map)?.map;
    if (armor) {
      this.plates.material.map = armor;
      this.plates.material.color.set("#d4dae3");
      this.plates.material.emissiveMap = armor;
      this.plates.material.emissive.set("#df4a16");
      this.plates.material.emissiveIntensity = 0.35;
    }
    this.plates.frustumCulled = false;
    this.plates.castShadow = true;
    scene.add(this.plates);
    this.embers = new T.InstancedMesh(
      new T.SphereGeometry(0.11, 5, 4),
      new T.MeshBasicMaterial({
        color: new T.Color(4, 1.2, 0.15),
        toneMapped: false,
      }),
      256,
    );
    this.embers.frustumCulled = false;
    this.embers.userData.titanAO = false;
    scene.add(this.embers);
    this.core = new T.Mesh(
      new T.SphereGeometry(1, 32, 20),
      new T.MeshBasicMaterial({
        color: new T.Color(5, 2.3, 0.7),
        transparent: true,
        opacity: 0,
        blending: T.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      }),
    );
    this.core.userData.titanAO = false;
    scene.add(this.core);
    this.rings = [0, 1].map((i) => {
      const m = new T.Mesh(
        new T.TorusGeometry(1, 0.0015, 4, 96),
        new T.MeshBasicMaterial({
          color: i ? "#ffd196" : "#ffefca",
          transparent: true,
          opacity: 0,
          blending: T.AdditiveBlending,
          depthWrite: false,
        }),
      );
      m.userData.titanAO = false;
      scene.add(m);
      return m;
    });
    this.light = new T.PointLight("#ffbe77", 0, 150, 2);
    scene.add(this.light);
    this.smoke = new T.InstancedMesh(
      new T.PlaneGeometry(2, 2),
      new T.ShaderMaterial({
        uniforms: {
          age: { value: 0 },
          opacity: { value: 0 },
          lightColor: { value: new T.Color("#b3bdc4") },
        },
        transparent: true,
        depthWrite: false,
        vertexShader: `varying vec2 vUv;varying float seed;void main(){vUv=uv;mat4 m=modelViewMatrix*instanceMatrix;vec4 centre=m*vec4(0.,0.,0.,1.);float scale=length(m[0].xyz);centre.xy+=position.xy*scale;seed=instanceMatrix[3].x*.17;gl_Position=projectionMatrix*centre;}`,
        fragmentShader: `uniform float age;uniform float opacity;uniform vec3 lightColor;varying vec2 vUv;varying float seed;
   float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+1.),f.x),f.y);}
   void main(){vec2 p=vUv*2.-1.;float f=n(vUv*4.+vec2(seed,-age*.23))*.6+n(vUv*9.+seed+age*.1)*.3+n(vUv*18.-seed)*.1;float a=(1.-smoothstep(.1,1.,length(p)+(f-.5)*.55))*opacity*.32;vec3 c=mix(vec3(.055,.065,.085),lightColor*.48,f*.65+vUv.y*.35);gl_FragColor=vec4(c,a);}`,
      }),
      40,
    );
    this.smoke.frustumCulled = false;
    this.smoke.userData.titanAO = false;
    scene.add(this.smoke);
  }
  update(s, sky, quality = 3) {
    const a = endingState(s);
    this.state = a;
    const visible = a.age >= 0 && a.age < 9,
      particles = s.config.particles !== false;
    const origin = titanWorldPoint(s, { x: 0, y: 77, z: -18 });
    this.core.position.set(origin.x, origin.y, origin.z);
    this.core.visible = visible && a.age < 0.65;
    this.core.scale.setScalar(18 + Math.max(0, a.age) * 30);
    this.core.material.opacity = a.flash * 0.6;
    this.light.position.copy(this.core.position);
    this.light.intensity =
      s.config.lighting && visible ? 320 * Math.exp(-a.age * 5) : 0;
    this.plates.count =
      visible && particles ? (quality >= 3 ? 256 : quality >= 2 ? 192 : 96) : 0;
    this.embers.count =
      visible && particles && a.age < 4 ? this.plates.count : 0;
    for (let i = 0; i < this.plates.count; i++) {
      const angle = i * 2.399963,
        u = random(i + 7),
        born = Math.max(0, a.age - (i % 9) * 0.018),
        part = i % 6,
        base = this.base.set(
          part < 2
            ? part
              ? 6
              : -6
            : part < 4
              ? part === 2
                ? 22
                : -22
              : Math.sin(angle) * 17,
          part < 2
            ? 6 + random(i + 3) * 46
            : part < 4
              ? 25 + random(i + 3) * 50
              : 52 + random(i + 3) * 35,
          -8 + Math.cos(angle) * (part < 4 ? 5 : 12),
        ),
        pose = this.burstPose;
      base.applyEuler(this.burstEuler);
      base.y += pose.lift;
      const p = titanWorldPoint(s, {
        x: base.x + Math.sin(angle) * born * (12 + u * 32),
        y: base.y + born * (8 + random(i + 1) * 20) - born * born * 5,
        z: base.z + Math.cos(angle) * born * (15 + random(i + 2) * 28),
      });
      this.dummy.position.set(p.x, Math.max(0.5, p.y), p.z);
      this.dummy.rotation.set(
        angle + born * (1 + u * 3),
        angle * 0.3 + born * 2,
        angle * 0.8 - born * 1.3,
      );
      this.dummy.scale.setScalar(
        (0.6 + u * 1.9) * Math.max(0, 1 - Math.max(0, a.age - 5) / 3),
      );
      this.dummy.updateMatrix();
      this.plates.setMatrixAt(i, this.dummy.matrix);
      if (i < this.embers.count) {
        this.dummy.scale.setScalar(
          (1 + random(i + 90) * 2) * Math.max(0, 1 - a.age / 4),
        );
        this.dummy.updateMatrix();
        this.embers.setMatrixAt(i, this.dummy.matrix);
      }
    }
    this.plates.instanceMatrix.needsUpdate = true;
    this.embers.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < 2; i++) {
      const ring = this.rings[i];
      ring.visible = visible && a.age < 0.85;
      ring.position.copy(this.core.position);
      ring.rotation.set(i ? 1.15 : 0.18, s.boss?.yaw || 0, i * 0.3);
      ring.scale.setScalar(5 + Math.max(0, a.age) * (i ? 62 : 90));
      ring.material.opacity = Math.max(0, 0.55 * (1 - a.age / 0.85));
    }
    this.smoke.count =
      visible && particles ? (quality >= 3 ? 40 : quality >= 2 ? 28 : 16) : 0;
    this.smoke.material.uniforms.age.value = Math.max(0, a.age);
    this.smoke.material.uniforms.opacity.value = a.smoke;
    if (sky)
      this.smoke.material.uniforms.lightColor.value.setRGB(...sky.horizon);
    for (let i = 0; i < this.smoke.count; i++) {
      const angle = i * 2.399963,
        r = 6 + random(i + 6) * 22 + Math.max(0, a.age) * 3,
        p = titanWorldPoint(s, {
          x: Math.sin(angle) * r + Math.max(0, a.age) * 3,
          y: 47 + random(i) * 40 + Math.max(0, a.age) * 6,
          z: -18 + Math.cos(angle) * r,
        });
      this.dummy.position.set(p.x, p.y, p.z);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.setScalar(
        (6 + random(i + 5) * 8) * (1 + Math.max(0, a.age) * 0.25),
      );
      this.dummy.updateMatrix();
      this.smoke.setMatrixAt(i, this.dummy.matrix);
    }
    this.smoke.instanceMatrix.needsUpdate = true;
  }
}
