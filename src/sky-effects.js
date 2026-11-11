import * as THREE from "three";
import { hash } from "./random.js";

export function celestialMaterial(material) {
  // Sky bodies are infinitely far away: even the distant cloud cells must
  // occlude them. Keep apparent size without writing into terrain's depth.
  material.depthWrite = false;
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader.replace(
      "#include <project_vertex>",
      "#include <project_vertex>\ngl_Position.z=gl_Position.w*0.999999;",
    );
  };
  material.customProgramCacheKey = () => "dcsm-infinite-sky-v1";
  return material;
}

// The sky has no translation parallax. Update only after the final eye/F5 camera
// is placed; orbital positions depend on world time, never player coordinates.
export function positionCelestials(root, sun, moon, camera, phase) {
  root.position.copy(camera.position);
  sun.position.set(Math.cos(phase) * 160, Math.sin(phase) * 160, -100);
  moon.position.copy(sun.position).multiplyScalar(-1);
  sun.lookAt(camera.position);
  moon.lookAt(camera.position);
}

const DAY = new THREE.Color("#fffdf7"),
  NIGHT = new THREE.Color("#647397"),
  STORM = new THREE.Color("#77889e"),
  STORM_NIGHT = new THREE.Color("#37445f"),
  WARM = new THREE.Color("#ffd1a7"),
  TRIAL = new THREE.Color("#482634");

// Fixed world cells are streamed beyond the visible haze. The group moves only
// with its own wind clock, so crossing a player chunk boundary never drags clouds.
export class CloudField extends THREE.Group {
  constructor(settings) {
    super();
    this.settings = settings;
    this.clock = 0;
    this.cover = 0;
    this.transform = new THREE.Object3D();
    this.tint = new THREE.Color();
    this.stormTint = new THREE.Color();
    this.haze = { value: new THREE.Color() };
    this.eye = { value: new THREE.Vector3() };
    const geometry = new THREE.BoxGeometry(1, 1, 1),
      normal = geometry.attributes.normal,
      colors = [];
    for (let i = 0; i < normal.count; i++) {
      const c = new THREE.Color(
        normal.getY(i) > 0.5
          ? "#ffffff"
          : normal.getY(i) < -0.5
            ? "#b9cce5"
            : "#e6effa",
      );
      colors.push(c.r, c.g, c.b);
    }
    geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    const material = new THREE.MeshBasicMaterial({
      vertexColors: true,
      fog: false,
      toneMapped: false,
    });
    material.onBeforeCompile = (shader) => {
      shader.uniforms.cloudHaze = this.haze;
      shader.uniforms.cloudEye = this.eye;
      shader.vertexShader =
        "uniform vec3 cloudEye;varying float cloudDistance;\n" +
        shader.vertexShader.replace(
          "#include <project_vertex>",
          `#include <project_vertex>
vec4 cloudWorld=vec4(transformed,1.);
#ifdef USE_INSTANCING
cloudWorld=instanceMatrix*cloudWorld;
#endif
cloudWorld=modelMatrix*cloudWorld;
cloudDistance=length(cloudWorld.xz-cloudEye.xz);`,
        );
      shader.fragmentShader =
        "uniform vec3 cloudHaze;varying float cloudDistance;\n" +
        shader.fragmentShader.replace(
          "#include <opaque_fragment>",
          "outgoingLight=mix(outgoingLight,cloudHaze,smoothstep(220.,380.,cloudDistance));\n#include <opaque_fragment>",
        );
    };
    material.customProgramCacheKey = () => "dcsm-cloud-haze-v1";
    this.mesh = new THREE.InstancedMesh(geometry, material, 81 * 7);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.add(this.mesh);
    this.cells = [];
    this.rebuilds = 0;
  }
  update(
    world,
    camera,
    dt,
    weather,
    lighting,
    skyColor,
    trial = 0,
    animate = true,
  ) {
    if (animate) this.clock += dt;
    this.position.set(
      this.clock * 0.28,
      (this.settings.cloudHeight ?? 160) - 160,
      this.clock * 0.06,
    );
    this.eye.value.copy(camera.position);
    this.haze.value.copy(skyColor);
    const severe = ["thunder", "hail", "tornado"].includes(weather.kind),
      target = weather.intensity * (severe ? 1 : 0.5);
    this.cover += (target - this.cover) * (1 - Math.exp(-2 * dt));
    this.tint
      .copy(NIGHT)
      .lerp(DAY, lighting.daylight)
      .lerp(WARM, lighting.warmth * lighting.daylight * 0.2);
    this.stormTint.copy(STORM_NIGHT).lerp(STORM, lighting.daylight);
    this.mesh.material.color
      .copy(this.tint)
      .lerp(this.stormTint, this.cover)
      .lerp(TRIAL, trial * 0.7);
    if (!this.visible) return;
    const cx = Math.floor((camera.position.x - this.position.x) / 112),
      cz = Math.floor((camera.position.z - this.position.z) / 112),
      fancy = this.settings.fancyGraphics !== false,
      key = `${world.seedInt}:${cx},${cz}:${fancy}`;
    if (
      key === this.layoutKey &&
      Math.abs(this.cover - (this.layoutCover ?? 0)) < 0.004
    )
      return;
    this.layoutKey = key;
    this.layoutCover = this.cover;
    this.rebuilds++;
    this.cells.length = 0;
    let index = 0;
    for (let z = cz - 4; z <= cz + 4; z++)
      for (let x = cx - 4; x <= cx + 4; x++) {
        const n = hash(x, 4, z, world.seedInt),
          base = n < 0.53,
          growth = base
            ? 1
            : Math.max(0, Math.min(1, (this.cover - (n - 0.53) * 0.7) * 1.5));
        if (growth < 0.01) continue;
        const px = (x + 0.5) * 112 + (hash(x, 1, z, world.seedInt) - 0.5) * 32,
          pz = (z + 0.5) * 112 + (hash(x, 2, z, world.seedInt) - 0.5) * 32,
          py = 160 + hash(x, 3, z, world.seedInt) * 12,
          width = 34 + hash(x, 5, z, world.seedInt) * 20;
        this.cells.push({ key: `${x},${z}`, x: px, y: py, z: pz, growth });
        for (let part = 0; part < (fancy ? 7 : 2); part++) {
          const detail = part > 1,
            dx = detail
              ? (hash(x, part + 11, z, world.seedInt) - 0.5) * width * 0.85
              : part * 6,
            dz = detail
              ? (hash(x, part + 21, z, world.seedInt) - 0.5) * 20
              : part * 4,
            sy =
              (detail ? 4 + hash(x, part + 31, z, world.seedInt) * 7 : 3) *
              (1 + this.cover * 0.9) *
              growth;
          this.transform.position.set(
            px + dx,
            py + (detail ? 2 + part * 0.65 : part * 2) * growth,
            pz + dz,
          );
          this.transform.scale.set(
            (detail ? width * 0.45 : width) * growth,
            sy,
            (detail ? 13 : 24) * growth,
          );
          this.transform.updateMatrix();
          this.mesh.setMatrixAt(index++, this.transform.matrix);
        }
      }
    this.mesh.count = index;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}
