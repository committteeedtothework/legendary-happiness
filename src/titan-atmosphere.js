import * as T from "three";
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const mix = (a, b, t) => a + (b - a) * t;
const blend = (a, b, t) => a.map((v, i) => mix(v, b[i], t));
// All motion uses the persisted encounter clock. Pausing and reload preserve sky.
export function titanAtmosphere(s) {
  if (s.stage === "victory" && s.defeatSky) {
    const q = s.defeatSky;
    s = {
      ...s,
      time: q.time,
      skyClock: q.skyClock ?? q.time,
      phase: q.phase,
      phaseStartedAt: q.phaseStartedAt,
      config: {
        ...s.config,
        dynamicSky: q.dynamicSky,
        arenaDayLength: q.arenaDayLength,
        arenaWeather: q.arenaWeather,
      },
    };
  }
  const cycle = Math.max(600, Math.min(3600, s.config.arenaDayLength || 900));
  const phase =
    (((0.16 + (s.config.dynamicSky === false ? 0 : (s.skyClock ?? s.time) / cycle)) % 1) + 1) %
    1;
  const angle = phase * Math.PI * 2,
    sun = Math.sin(angle),
    day = smooth(-0.16, 0.28, sun);
  const sunset = Math.exp(-Math.pow(sun / 0.24, 2));
  const phasePressure =
    s.phase === 2
      ? smooth(
          0,
          8,
          s.time - (s.phaseStartedAt ?? Math.max(0, s.time - s.stageTime)),
        )
      : 0;
  const auto =
    smooth(0.18, 0.78, Math.sin(s.time / 73 + 0.6) * 0.5 + 0.5) *
    (0.4 + phasePressure * 0.45);
  const weather =
    s.config.arenaWeather === "clear"
      ? 0
      : s.config.arenaWeather === "storm"
        ? 1
        : auto;
  const top = blend([0.016, 0.031, 0.09], [0.07, 0.35, 0.75], day);
  const horizon = blend(
    blend([0.045, 0.075, 0.15], [0.58, 0.78, 0.94], day),
    [0.86, 0.36, 0.18],
    sunset * 0.68,
  );
  const fog = blend(horizon, [0.2, 0.29, 0.39], weather * 0.55);
  const keyAngle = angle + smooth(-0.1, 0.1, -sun) * Math.PI;
  const dir = {
    x: Math.cos(keyAngle) * 0.65,
    y: Math.abs(sun) * 0.7 + 0.3,
    z: Math.cos(keyAngle + 0.6) * 0.45,
  };
  return {
    clock: s.time,
    phase,
    day,
    sunset,
    weather,
    top,
    horizon,
    fog,
    dir,
    key: mix(1.15, 4.1, day) * (1 - weather * 0.34),
    hemi: mix(0.52, 1.05, day),
    keyColor: blend(
      blend([0.44, 0.63, 1], [1, 0.94, 0.82], day),
      [1, 0.5, 0.25],
      sunset * 0.5,
    ),
    environment: mix(0.25, 0.7, day) * (1 - weather * 0.3),
    wind: 0.4 + weather * 0.9,
    label:
      day < 0.1
        ? "NIGHT"
        : sunset > 0.35
          ? sun > 0
            ? "SUNSET"
            : "DAWN"
          : "DAY",
  };
}
export class TitanAtmosphereView {
  constructor(scene, light, hemi, sky) {
    this.scene = scene;
    this.light = light;
    this.hemi = hemi;
    this.sky = sky;
    this.sun = new T.Mesh(
      new T.SphereGeometry(9, 16, 10),
      new T.MeshBasicMaterial({
        color: "#ffe9a6",
        fog: false,
        toneMapped: false,
      }),
    );
    this.moon = new T.Mesh(
      new T.SphereGeometry(6, 16, 10),
      new T.MeshBasicMaterial({ color: "#b7d4ef", fog: false }),
    );
    scene.add(this.sun, this.moon);
    const data = new Float32Array(240 * 3);
    for (let i = 0; i < 240; i++) {
      const a = i * 2.399963,
        y = 0.12 + (i % 29) / 33,
        r = Math.sqrt(1 - y * y) * 1100;
      data.set([Math.cos(a) * r, y * 1100, Math.sin(a) * r], i * 3);
    }
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.BufferAttribute(data, 3));
    this.stars = new T.Points(
      g,
      new T.PointsMaterial({
        color: "#d2e6ff",
        size: 1.6,
        transparent: true,
        depthWrite: false,
        fog: false,
      }),
    );
    scene.add(this.stars);
    this.rain = new T.InstancedMesh(
      new T.BoxGeometry(0.025, 2.1, 0.025),
      new T.MeshBasicMaterial({
        color: "#bdd6e4",
        transparent: true,
        opacity: 0.28,
        depthWrite: false,
      }),
      512,
    );
    this.rain.frustumCulled = false;
    this.rain.userData.titanAO = false;
    scene.add(this.rain);
    this.dummy = new T.Object3D();
  }
  update(s, quality, camera) {
    const a = titanAtmosphere(s);
    this.state = a;
    this.light.intensity = s.config.lighting ? a.key : 1.5;
    this.hemi.intensity = a.hemi;
    this.light.color.setRGB(...a.keyColor);
    this.light.position.set(a.dir.x * 180, a.dir.y * 210, a.dir.z * 180);
    this.scene.fog.color.setRGB(...a.fog);
    this.scene.background.setRGB(...a.horizon);
    this.scene.fog.density =
      s.config.atmosphere === false
        ? 0.00065
        : 0.0011 + a.weather * 0.0007 + (1 - a.day) * 0.0002;
    this.scene.environmentIntensity = a.environment;
    if (this.scene.environmentRotation)
      this.scene.environmentRotation.y = a.phase * Math.PI * 2;
    const u = this.sky.material.uniforms;
    u.skyTop?.value.setRGB(...a.top);
    u.skyHorizon?.value.setRGB(...a.horizon);
    if (u.daylight) u.daylight.value = a.day;
    if (u.storm) u.storm.value = a.weather;
    if (u.sunDirection)
      u.sunDirection.value
        .set(
          Math.cos(a.phase * Math.PI * 2) * 0.65,
          Math.sin(a.phase * Math.PI * 2) * 0.86,
          Math.cos(a.phase * Math.PI * 2 + 0.6) * 0.45,
        )
        .normalize();
    this.sun.position.set(
      u.sunDirection.value.x * 1000,
      u.sunDirection.value.y * 1000,
      u.sunDirection.value.z * 1000,
    );
    this.moon.position.copy(this.sun.position).multiplyScalar(-1);
    this.sun.visible =
      s.config.atmosphere !== false && this.sun.position.y > -25;
    this.moon.visible =
      s.config.atmosphere !== false && this.moon.position.y > -25;
    if (camera) {
      this.sun.position.add(camera.position);
      this.moon.position.add(camera.position);
      this.sky.position.copy(camera.position);
      this.stars.position.copy(camera.position);
    }
    this.stars.visible = s.config.atmosphere !== false;
    this.stars.material.opacity = (1 - a.day) * (1 - a.weather * 0.8) * 0.85;
    this.rain.visible =
      s.config.weatherEffects !== false &&
      s.config.particles &&
      a.weather > 0.55;
    this.rain.count = this.rain.visible ? (quality === 1 ? 160 : 512) : 0;
    for (let i = 0; i < this.rain.count; i++) {
      const radius = Math.sqrt(((i * 319 + 17) % 991) / 991) * 190,
        angle = i * 2.399963;
      this.dummy.position.set(
        Math.sin(angle) * radius,
        2 + ((((i * 7.3 - s.time * 27) % 150) + 150) % 150),
        Math.cos(angle) * radius,
      );
      this.dummy.rotation.z = -0.1 - a.weather * 0.08;
      this.dummy.updateMatrix();
      this.rain.setMatrixAt(i, this.dummy.matrix);
    }
    this.rain.instanceMatrix.needsUpdate = true;
  }
}
