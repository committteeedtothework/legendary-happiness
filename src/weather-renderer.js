import * as THREE from "three";
import { hash } from "./random.js";
import { weatherAt } from "./weather.js";
import {
  weatherChunkKey,
  weatherColumnLoaded,
  weatherRoof,
} from "./weather-spatial.js";

export function stormVisualBudget(settings, distance = 0) {
  const range = Math.max(
    128,
    Math.max(2, Math.min(16, settings.renderDistance || 4)) * 16 + 52,
  );
  if (settings.weatherEffects === false || distance > range)
    return { points: 0, debris: 0 };
  const quality =
    settings.particles === "minimal"
      ? 0
      : settings.particles === "decreased"
        ? 1
        : 2;
  const far = distance > 80,
    plain = settings.fancyGraphics === false;
  return {
    points: Math.floor(
      [96, 256, 512][quality] * (far ? 0.5 : 1) * (plain ? 0.5 : 1),
    ),
    debris: Math.floor(
      [8, 20, 48][quality] * (far ? 0.5 : 1) * (plain ? 0.5 : 1),
    ),
  };
}
const stormSphere = () => new THREE.Sphere(new THREE.Vector3(0, 29, 0), 39);
// Recycle only at the outside of the local volume. Interior particles keep
// their world position when the observer moves, including across negative cells.
export function wrapWeatherCoordinate(value, observer, period) {
  return value + Math.floor((observer - value + period / 2) / period) * period;
}
const PRECIP_TYPES = ["rain", "snow", "hail"];
const clamp01 = (value) => Math.max(0, Math.min(1, value));
function weatherFadeMaterial(material) {
  material.onBeforeCompile = (shader) => {
    shader.vertexShader =
      "attribute float weatherFade;varying float weatherAlpha;\n" +
      shader.vertexShader.replace(
        "#include <begin_vertex>",
        "#include <begin_vertex>\nweatherAlpha=weatherFade;",
      );
    shader.fragmentShader =
      "varying float weatherAlpha;\n" +
      shader.fragmentShader.replace(
        "#include <opaque_fragment>",
        "diffuseColor.a*=weatherAlpha;\n#include <opaque_fragment>",
      );
  };
  material.customProgramCacheKey = () => "dcsm-weather-fade-v1";
}
export class WeatherRenderer {
  constructor(scene, settings) {
    this.scene = scene;
    this.settings = settings;
    this.clock = 0;
    this.count = 640;
    this.rainPositions = new Float32Array(this.count * 6);
    this.snowPositions = new Float32Array(this.count * 3);
    this.hailPositions = new Float32Array(this.count * 3);
    this.rainFade = new Float32Array(this.count * 2);
    this.snowFade = new Float32Array(this.count);
    this.hailFade = new Float32Array(this.count);
    this.weights = { rain: 0, snow: 0, hail: 0 };
    this.weatherSeeds = Array.from({ length: this.count }, (_, i) => ({
      x: (hash(i, 1, 99) - 0.5) * 36,
      z: (hash(i, 2, 99) - 0.5) * 36,
      speed: hash(i, 3, 99),
      phase: hash(i, 4, 99) * 24,
    }));
    const rainGeo = new THREE.BufferGeometry(),
      snowGeo = new THREE.BufferGeometry(),
      hailGeo = new THREE.BufferGeometry();
    rainGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(this.rainPositions, 3).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    snowGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(this.snowPositions, 3).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    hailGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(this.hailPositions, 3).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    for (const [geometry, values] of [
      [rainGeo, this.rainFade],
      [snowGeo, this.snowFade],
      [hailGeo, this.hailFade],
    ])
      geometry.setAttribute(
        "weatherFade",
        new THREE.BufferAttribute(values, 1).setUsage(THREE.DynamicDrawUsage),
      );
    this.rain = new THREE.LineSegments(
      rainGeo,
      new THREE.LineBasicMaterial({
        color: "#91b3ce",
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      }),
    );
    this.snow = new THREE.Points(
      snowGeo,
      new THREE.PointsMaterial({
        color: "#eff6f6",
        size: 0.12,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      }),
    );
    this.hail = new THREE.Points(
      hailGeo,
      new THREE.PointsMaterial({
        color: "#c6e3eb",
        size: 0.2,
        transparent: true,
        depthWrite: false,
      }),
    );
    for (const object of [this.rain, this.snow, this.hail])
      weatherFadeMaterial(object.material);
    this.funnelCount = 512;
    this.funnelPositions = new Float32Array(this.funnelCount * 3);
    // Static seeds cover the whole height at every LOD. Wind rotation runs on the
    // GPU; point size has a pixel cap so entering the funnel cannot explode fill cost.
    for (let i = 0; i < this.funnelCount; i++)
      this.funnelPositions.set([i * 2.399, hash(i, 17, 99), 0], i * 3);
    const funnelGeo = new THREE.BufferGeometry();
    funnelGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(this.funnelPositions, 3),
    );
    funnelGeo.boundingSphere = stormSphere();
    this.funnel = new THREE.Points(
      funnelGeo,
      new THREE.ShaderMaterial({
        uniforms: {
          stormTime: { value: 0 },
          alpha: { value: 0.6 },
          maxPointPixels: { value: 8 },
          color: { value: new THREE.Color("#5d6269") },
        },
        vertexShader: `uniform float stormTime;uniform float maxPointPixels;void main(){float level=position.y;float angle=position.x+stormTime*(3.-level*1.5);float radius=2.+level*level*18.;vec3 p=vec3(cos(angle)*radius,level*58.,sin(angle)*radius);vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=min(maxPointPixels,220./max(4.,-mv.z));}`,
        fragmentShader: `uniform vec3 color;uniform float alpha;void main(){float d=length(gl_PointCoord-vec2(.5));if(d>.5)discard;gl_FragColor=vec4(color,alpha*(1.-smoothstep(.25,.5,d)));
#include <colorspace_fragment>
}`,
        transparent: true,
        depthWrite: false,
        fog: false,
        toneMapped: false,
      }),
    );
    // A single transparent pass supplies the silhouette; a small instanced pool
    // supplies debris. Neither creates a render object per particle.
    const shell = new THREE.CylinderGeometry(20, 1.5, 58, 16, 8, true),
      positions = shell.attributes.position;
    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i),
        level = (y + 29) / 58,
        a = Math.atan2(positions.getZ(i), positions.getX(i)),
        r = 1.5 + level * level * 18;
      positions.setXYZ(
        i,
        Math.cos(a) * r + Math.sin(level * 4) * 2,
        y,
        Math.sin(a) * r,
      );
    }
    shell.computeVertexNormals();
    shell.computeBoundingSphere();
    this.shell = new THREE.Mesh(
      shell,
      new THREE.MeshLambertMaterial({
        color: "#626a72",
        side: THREE.DoubleSide,
        forceSinglePass: true,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
        fog: false,
      }),
    );
    this.debris = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.45, 0.28, 0.6),
      new THREE.MeshLambertMaterial({ color: "#81725b" }),
      48,
    );
    this.debris.boundingSphere = stormSphere();
    this.debris.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.debrisTransform = new THREE.Object3D();
    this.debris.count = 0;
    for (const object of [
      this.rain,
      this.snow,
      this.hail,
      this.funnel,
      this.shell,
      this.debris,
    ]) {
      object.visible = false;
      scene.add(object);
    }
    this.rain.frustumCulled =
      this.snow.frustumCulled =
      this.hail.frustumCulled =
        false;
    this.roofs = new Map();
    this.stats = {
      roofQueries: 0,
      funnelParticles: 0,
      debrisInstances: 0,
      debrisUpdates: 0,
    };
    this.boltPositions = new Float32Array(72);
    const boltGeo = new THREE.BufferGeometry();
    boltGeo.setAttribute(
      "position",
      new THREE.BufferAttribute(this.boltPositions, 3).setUsage(
        THREE.DynamicDrawUsage,
      ),
    );
    this.bolt = new THREE.LineSegments(
      boltGeo,
      new THREE.LineBasicMaterial({
        color: "#d6e6ff",
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      }),
    );
    this.bolt.visible = false;
    this.bolt.frustumCulled = false;
    scene.add(this.bolt);
  }
  sample(world, p, elapsed) {
    const changed = this.world !== world;
    const column = weatherChunkKey(p.x, p.z),
      revision = world.revisions?.get(column) || 0;
    if (
      changed ||
      elapsed >= (this.nextSample || 0) ||
      Math.hypot(p.x - (this.lastX ?? p.x), p.z - (this.lastZ ?? p.z)) > 4 ||
      revision !== this.sampleRevision ||
      column !== this.sampleChunk
    ) {
      if (changed) {
        this.roofs.clear();
        this.strikeTick = null;
        this.funnelSeed = null;
        this.lastDebrisClock = -Infinity;
        this.weights = { rain: 0, snow: 0, hail: 0 };
      }
      this.world = world;
      this.view = weatherAt(world, p);
      this.nextSample = elapsed + 0.4;
      this.lastX = p.x;
      this.lastZ = p.z;
      this.sampleRevision = revision;
      this.sampleChunk = column;
    }
    const w = world.weather,
      cinder = world.dimension === "cinderwild";
    return {
      ...this.view,
      intensity: cinder ? 0 : w?.intensity || 0,
      kind: cinder ? "clear" : w?.kind || "clear",
      flash:
        !cinder && w?.strike
          ? Math.max(0, 1 - (world.tick - w.strike.tick) / 5)
          : 0,
      strike: cinder ? null : w?.strike,
      funnel: cinder ? null : w?.funnel,
    };
  }
  roof(world, x, z) {
    x = Math.floor(x);
    z = Math.floor(z);
    if (!weatherColumnLoaded(world, x, z)) return null;
    const key = `${x},${z}`,
      chunk = weatherChunkKey(x, z),
      revision = world.revisions?.get(chunk) || 0,
      entry = this.roofs.get(key);
    if (entry && entry.revision === revision) return entry.height;
    // A moving camera or a new storm cannot request hundreds of sky scans in
    // one frame. Unresolved drops stay hidden until their column is sampled.
    if (this.stats.roofQueries >= 32) return null;
    const height = weatherRoof(world, x, z);
    this.stats.roofQueries++;
    if (height === null) return null;
    if (this.roofs.size >= 1024)
      this.roofs.delete(this.roofs.keys().next().value);
    this.roofs.set(key, { height, revision });
    return height;
  }
  update(world, p, dt, elapsed, playing) {
    const view = this.sample(world, p, elapsed);
    this.clock += dt;
    this.stats.roofQueries = 0;
    this.stats.debrisUpdates = 0;
    this.stats.funnelParticles = 0;
    this.stats.debrisInstances = 0;
    const budget =
        this.settings.particles === "minimal"
          ? 180
          : this.settings.particles === "decreased"
            ? 360
            : this.count,
      allowed = playing && this.settings.weatherEffects !== false,
      targetType =
        view.type === "none" ? null : view.kind === "hail" ? "hail" : view.type,
      blend = 1 - Math.exp(-9 * dt);
    let active = false;
    for (const type of PRECIP_TYPES) {
      const target = type === targetType ? view.intensity : 0;
      this.weights[type] += (target - this.weights[type]) * blend;
      this[type].visible = allowed && this.weights[type] > 0.003;
      this[type].material.opacity =
        this.weights[type] * (type === "rain" ? 0.5 : 0.85);
      active ||= this[type].visible;
    }
    if (active) {
      for (let i = 0; i < budget; i++) {
        const seed = this.weatherSeeds[i],
          x = wrapWeatherCoordinate(seed.x, p.x, 36),
          z = wrapWeatherCoordinate(seed.z, p.z, 36),
          roof = this.roof(world, x, z),
          edge = clamp01(
            (18 - Math.max(Math.abs(x - p.x), Math.abs(z - p.z))) / 3,
          );
        for (const type of PRECIP_TYPES) {
          if (!this[type].visible) continue;
          const speed =
              type === "hail"
                ? 18
                : type === "rain"
                  ? 15 + seed.speed * 6
                  : 0.65 + seed.speed * 0.8,
            y = wrapWeatherCoordinate(
              seed.phase - this.clock * speed,
              p.y + 3,
              24,
            ),
            fade =
              edge *
              clamp01((12 - Math.abs(y - (p.y + 3))) / 2) *
              (roof === null ? 0 : clamp01((y - roof - 0.2) / 1.5));
          if (type === "rain") {
            const j = i * 6;
            this.rainPositions[j] = x;
            this.rainPositions[j + 1] = y;
            this.rainPositions[j + 2] = z;
            this.rainPositions[j + 3] = x + 0.08;
            this.rainPositions[j + 4] = y + 0.65;
            this.rainPositions[j + 5] = z + 0.02;
            this.rainFade[i * 2] = this.rainFade[i * 2 + 1] = fade;
          } else {
            const values =
                type === "hail" ? this.hailPositions : this.snowPositions,
              fades = type === "hail" ? this.hailFade : this.snowFade,
              j = i * 3;
            values[j] =
              x + (type === "snow" ? Math.sin(this.clock * 0.6 + i) * 0.4 : 0);
            values[j + 1] = y;
            values[j + 2] = z;
            fades[i] = fade;
          }
        }
      }
      for (const type of PRECIP_TYPES)
        if (this[type].visible) {
          const geometry = this[type].geometry;
          geometry.setDrawRange(0, budget * (type === "rain" ? 2 : 1));
          geometry.attributes.position.needsUpdate = true;
          geometry.attributes.weatherFade.needsUpdate = true;
        }
    }
    const f = view.funnel,
      distance = f ? Math.hypot(f.x - p.x, f.z - p.z) : Infinity,
      storm = stormVisualBudget(this.settings, distance);
    const visible = playing && !!f && view.intensity > 0.1 && storm.points > 0;
    this.funnel.visible = this.shell.visible = this.debris.visible = visible;
    this.debris.count = 0;
    this.funnel.geometry.setDrawRange(0, visible ? storm.points : 0);
    if (visible) {
      const ground =
        Math.max(62, world.terrain(Math.floor(f.x), Math.floor(f.z)).h) + 1;
      this.shell.position.set(f.x, ground + 29, f.z);
      this.shell.rotation.y = this.clock * 0.55;
      this.shell.material.opacity = view.intensity * 0.48;
      this.funnel.position.set(f.x, ground, f.z);
      this.funnel.material.uniforms.stormTime.value = this.clock;
      this.funnel.material.uniforms.alpha.value = Math.min(
        0.8,
        view.intensity * 0.8,
      );
      this.funnel.material.uniforms.maxPointPixels.value =
        this.settings.particles === "minimal"
          ? 4
          : this.settings.particles === "decreased"
            ? 6
            : 8;
      this.debris.position.set(f.x, ground, f.z);
      if (
        this.funnelSeed !== f.seed ||
        this.lastDebrisCount !== storm.debris ||
        this.clock - this.lastDebrisClock >= 1 / 30
      ) {
        if (this.funnelSeed !== f.seed) {
          this.funnelSeed = f.seed;
          this.debrisSeeds = Array.from({ length: 48 }, (_, i) => ({
            level: hash(i, 8, f.seed),
            scale: 0.4 + hash(i, 9, f.seed),
          }));
        }
        for (let i = 0; i < storm.debris; i++) {
          const seed = this.debrisSeeds[i],
            level = (seed.level + this.clock * 0.07) % 1,
            angle = i * 2.399 + this.clock * (3 - level),
            radius = 3 + level * level * 17;
          this.debrisTransform.position.set(
            Math.cos(angle) * radius,
            level * 45,
            Math.sin(angle) * radius,
          );
          this.debrisTransform.rotation.set(angle * 2, angle, level * 8);
          this.debrisTransform.scale.setScalar(seed.scale);
          this.debrisTransform.updateMatrix();
          this.debris.setMatrixAt(i, this.debrisTransform.matrix);
        }
        this.debris.instanceMatrix.needsUpdate = true;
        this.lastDebrisClock = this.clock;
        this.lastDebrisCount = storm.debris;
        this.stats.debrisUpdates = 1;
      }
      this.debris.count = storm.debris;
      this.stats.funnelParticles = storm.points;
      this.stats.debrisInstances = storm.debris;
    }
    const strike = view.strike,
      boltVisible =
        playing &&
        this.settings.weatherEffects !== false &&
        this.settings.lightningFlashes !== false &&
        !!strike &&
        world.tick - strike.tick >= 0 &&
        world.tick - strike.tick < 4;
    const strikeKey = strike
      ? `${strike.tick}:${strike.x},${strike.y},${strike.z}:${strike.seed || 0}`
      : null;
    if (boltVisible && strikeKey !== this.strikeTick) {
      this.strikeTick = strikeKey;
      let x = strike.x,
        y = strike.y + 72,
        z = strike.z;
      for (let i = 1; i <= 12; i++) {
        const nx =
            strike.x + (hash(i, strike.seed || 0, 7) - 0.5) * 6 * (1 - i / 12),
          ny = strike.y + 72 * (1 - i / 12),
          nz =
            strike.z + (hash(i, 3, strike.seed || 0) - 0.5) * 5 * (1 - i / 12),
          j = (i - 1) * 6;
        this.boltPositions[j] = x;
        this.boltPositions[j + 1] = y;
        this.boltPositions[j + 2] = z;
        this.boltPositions[j + 3] = nx;
        this.boltPositions[j + 4] = ny;
        this.boltPositions[j + 5] = nz;
        x = nx;
        y = ny;
        z = nz;
      }
      this.bolt.geometry.attributes.position.needsUpdate = true;
    }
    this.bolt.visible = boltVisible;
    return view;
  }
}
