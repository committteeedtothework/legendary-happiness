import * as T from "three";
import { wyvernDaylight } from "./wyvern-choreography.js";
import { ease } from "./wyvern-space.js";
// Arena-only coastal scenery; no sandbox material or texture is modified.
export function wyvernCoast(x, z) {
  const r = Math.hypot(x * 0.9, z * 1.1),
    edge = ease((r - 2450) / 650);
  return -34 * edge;
}
export class WyvernEnvironment {
  constructor(scene) {
    this.sky = new T.Mesh(
      new T.SphereGeometry(6100, 32, 20),
      new T.ShaderMaterial({
        side: T.BackSide,
        depthWrite: false,
        uniforms: { day: { value: 0 } },
        vertexShader:
          "varying vec3 vSky; void main(){vSky=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",
        fragmentShader:
          "uniform float day; varying vec3 vSky; void main(){float h=clamp(normalize(vSky).y*.9+.1,0.,1.);vec3 horizon=mix(vec3(.16,.22,.37),vec3(.60,.75,.83),day);vec3 zenith=mix(vec3(.012,.023,.085),vec3(.12,.37,.66),day);gl_FragColor=vec4(mix(horizon,zenith,pow(h,.55)),1.);}",
        toneMapped: false,
      }),
    );
    this.sky.renderOrder = -20;
    this.water = new T.Mesh(
      new T.PlaneGeometry(14000, 14000, 96, 96).rotateX(-Math.PI / 2),
      new T.MeshStandardMaterial({
        color: "#143a59",
        roughness: 0.62,
        metalness: 0.04,
        envMapIntensity: 0.18,
      }),
    );
    this.water.position.y = -15;
    this.clock = { value: 0 };
    this.water.material.onBeforeCompile = (shader) => {
      shader.uniforms.wyvernTime = this.clock;
      shader.vertexShader =
        "uniform float wyvernTime;\n" +
        shader.vertexShader.replace(
          "#include <begin_vertex>",
          "#include <begin_vertex>\ntransformed.y += sin(position.x*.012+wyvernTime*.65)*.65+cos(position.z*.017-wyvernTime*.4)*.4;",
        );
      shader.fragmentShader =
        "uniform float wyvernTime;\n" +
        shader.fragmentShader.replace(
          "#include <normal_fragment_maps>",
          "#include <normal_fragment_maps>\nnormal = normalize(normal + vec3(sin(vViewPosition.x*.035+wyvernTime*.5)*.065,0.,cos(vViewPosition.z*.03-wyvernTime*.4)*.065));",
        );
    };
    this.water.material.customProgramCacheKey = () => "wyvern-coast-water-v1";
    this.moon = new T.Mesh(
      new T.SphereGeometry(14, 20, 12),
      new T.MeshBasicMaterial({ color: "#d7e4ff", toneMapped: false }),
    );
    this.moon.position.set(-900, 700, -1100);
    this.sun = new T.Mesh(
      new T.SphereGeometry(20, 20, 12),
      new T.MeshBasicMaterial({ color: "#ffe2b0", toneMapped: false }),
    );
    this.sun.position.set(1000, 350, -1500);
    this.objects = [this.sky, this.water, this.moon, this.sun];
    for (const o of this.objects) {
      o.userData.wyvernEnvironment = true;
      scene.add(o);
    }
    this.night = new T.Color("#182846");
    this.day = new T.Color("#94bed7");
  }
  update(s, view) {
    const day = wyvernDaylight(s),
      clock = s.time;
    this.clock.value = clock;
    this.sky.material.uniforms.day.value = day;
    this.moon.visible = day < 0.75;
    this.sun.visible = day > 0.12;
    view.scene.background.copy(this.night).lerp(this.day, day);
    view.scene.fog.color.copy(view.scene.background);
    view.scene.fog.density = s.config.atmosphere === false ? 0.00012 : 0.00052;
    view.hemi.intensity = 0.52 + day * 0.95;
    view.scene.environmentIntensity = 0.18 + day * 0.65;
    view.hemi.color.set(day > 0.45 ? "#d0e7ff" : "#7898d9");
    view.light.intensity = 0.9 + day * 2.9;
    view.light.color.set(day > 0.5 ? "#ffe8c1" : "#aac3ff");
    this.water.material.color.set(day > 0.4 ? "#144d70" : "#0b1d37");
    for (const m of view.clouds) {
      m.material.color.set(day > 0.35 ? "#f4e8d2" : "#7285ae");
    }
  }
  placeSky(cameraPosition) {
    this.sky.position.copy(cameraPosition);
    this.moon.position
      .copy(cameraPosition)
      .add(new T.Vector3(-900, 700, -1100));
    this.sun.position.copy(cameraPosition).add(new T.Vector3(1000, 350, -1500));
  }
}
