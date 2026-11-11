import { TitanAudio } from "../src/giganto-audio.js";
import {
  makeTitanLandscape,
  updateTitanLandscape,
  disposeTitanLandscape,
} from "../src/titan-landscape.js";
import { TITAN_ROUTE } from "../src/giganto-simulation.js";
import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {
  titanSession,
  stepTitan,
  restoreTitanSession,
} from "../src/giganto-simulation.js";
import { titanAtmosphere } from "../src/titan-atmosphere.js";
import {
  freezeTitanSky,
  endingState,
  finishingMusicGain,
  TITAN_DETONATION,
} from "../src/titan-ending.js";
import { TitanDetonation } from "../src/titan-detonation.js";
import { installTitanBreach } from "../src/titan-finale-view.js";
import { titanFoleySamples } from "../src/titan-foley.js";
import { titanConfig } from "../src/giganto-simulation.js";
const session = () => {
  const s = titanSession({ cinematicPace: 1, drain: 0 });
  s.original = {};
  return s;
};
test("defeat preserves the exact day/night/weather/light state while rain, movement and encounter time continue", () => {
  for (const time of [2, 70, 140, 210])
    for (const weather of ["auto", "clear", "storm"]) {
      const s = session();
      Object.assign(s, {
        stage: "finale",
        stageTime: 7,
        time,
        phase: 2,
        phaseStartedAt: Math.max(0, time - 16),
      });
      Object.assign(s.config, { arenaDayLength: 240, arenaWeather: weather });
      const before = titanAtmosphere(s);
      freezeTitanSky(s);
      s.stage = "victory";
      s.won = true;
      s.stageTime = 0;
      stepTitan(s, { right: true }, 1 / 60);
      s.time += 500;
      assert.deepEqual(titanAtmosphere(s), before);
      assert.ok(s.avatar.vx !== 0);
      const restored = restoreTitanSession(JSON.parse(JSON.stringify(s)));
      assert.deepEqual(titanAtmosphere(restored), before);
      restored.time += 400;
      assert.deepEqual(titanAtmosphere(restored), before);
    }
});
test("the natural victory transition records the sky before resetting the cinematic clock and rejects malformed snapshots", () => {
  for (const hz of [30, 60, 144]) {
    const s = session();
    Object.assign(s, {
      stage: "finale",
      stageTime: 7 - 1 / hz,
      time: 139,
      phase: 2,
      won: false,
      cinematicFrom: { ...s.avatar },
    });
    stepTitan(s, {}, 1 / hz);
    assert.equal(s.stage, "victory");
    assert.equal(s.defeatSky.time, s.time);
    const before = titanAtmosphere(s);
    for (let i = 0; i < hz * 2; i++) stepTitan(s, {}, 1 / hz);
    assert.deepEqual(titanAtmosphere(s), before);
  }
  const s = session();
  s.stage = "victory";
  s.won = true;
  s.defeatSky = { time: NaN, phase: 99 };
  const restored = restoreTitanSession(JSON.parse(JSON.stringify(s)));
  assert.ok(Number.isFinite(restored.defeatSky.time));
  assert.ok([1, 2].includes(restored.defeatSky.phase));
});
test("detonation follows penetration; aftermath continues once, with bounded, pause-stable effects at every quality", () => {
  const scene = new T.Scene(),
    fx = new TitanDetonation(scene),
    s = session();
  Object.assign(s, { stage: "finale", stageTime: 4.8 });
  fx.update(s);
  assert.equal(fx.plates.count, 0);
  assert.equal(endingState(s).rupture, 0);
  s.stageTime = 5.7;
  fx.update(s, null, 3);
  assert.equal(fx.plates.count, 256);
  assert.equal(fx.smoke.count, 40);
  const a = Array.from(fx.plates.instanceMatrix.array);
  fx.update(s, null, 3);
  assert.deepEqual(Array.from(fx.plates.instanceMatrix.array), a);
  assert.ok(a.every(Number.isFinite));
  fx.update(s, null, 1);
  assert.equal(fx.plates.count, 96);
  assert.equal(fx.smoke.count, 16);
  s.config.particles = false;
  fx.update(s);
  assert.equal(fx.smoke.count, 0);
  assert.equal(fx.plates.count, 0);
  s.config.particles = true;
  s.stage = "victory";
  s.stageTime = 20;
  fx.update(s);
  assert.equal(fx.plates.count, 0);
  assert.equal(fx.smoke.count, 0);
  assert.equal(fx.light.intensity, 0);
  assert.equal(endingState(s).rupture, 1);
});
test("color, normal and shadow surfaces share the same rupture discard instead of fading an intact mesh", () => {
  const root = new T.Group(),
    mesh = new T.Mesh(new T.BoxGeometry(), new T.MeshStandardMaterial());
  root.add(mesh);
  const uniforms = {
    inverse: { value: new T.Matrix4() },
    radius: { value: 7 },
  };
  installTitanBreach(root, uniforms);
  for (const material of [
    mesh.material,
    mesh.customDepthMaterial,
    mesh.userData.titanBreachNormal,
  ]) {
    const sh = {
      uniforms: {},
      vertexShader: "#include <worldpos_vertex>",
      fragmentShader:
        "#include <clipping_planes_fragment>\n#include <emissivemap_fragment>",
    };
    material.onBeforeCompile(sh);
    assert.equal(sh.uniforms.titanRupture, uniforms.rupture);
    assert.ok(sh.fragmentShader.includes("shell*.7+shard*.3<titanRupture"));
  }
  assert.equal(mesh.material.opacity, 1);
});
test("music release is bounded, monotonic, smooth at its ends and finishes by the last cinematic frame", () => {
  assert.equal(finishingMusicGain(0), 1);
  assert.equal(finishingMusicGain(5.2), 1);
  assert.equal(finishingMusicGain(7), 0);
  let old = 1;
  for (let t = 5.2; t <= 7; t += 0.001) {
    const a = finishingMusicGain(t);
    assert.ok(a <= old + 1e-10 && a >= 0);
    old = a;
  }
  assert.ok(finishingMusicGain(6.1) > 0.49 && finishingMusicGain(6.1) < 0.51);
  assert.ok(TITAN_DETONATION.burst > 4.8);
});
test("original detonation Foley has a long, bounded low-frequency tail and silent edges; spatial AA survives settings reload", () => {
  const pcm = titanFoleySamples("detonation", 24000);
  assert.equal(pcm.length, 67200);
  assert.equal(pcm[0], 0);
  assert.equal(pcm.at(-1), 0);
  assert.ok(pcm.every((x) => Number.isFinite(x) && Math.abs(x) <= 0.75));
  assert.ok(pcm.slice(30000, 45000).some((x) => Math.abs(x) > 0.01));
  assert.equal(titanConfig({ antialiasing: false }).antialiasing, false);
  assert.equal(titanConfig({ antialiasing: true }).antialiasing, true);
});

test("High detail promotes texture storage and foliage geometry once, while lowering quality restores the smaller GPU inputs", () => {
  const root = makeTitanLandscape(TITAN_ROUTE, 1),
    s = session(),
    u = root.userData;
  const tex = u.textures.find((t) => t.userData.titanSurface === "rock");
  const low = u.crowns.geometry.attributes.position.count;
  let disposed = 0;
  tex.addEventListener("dispose", () => disposed++);
  s.config.graphicsQuality = "high";
  updateTitanLandscape(root, s, 0);
  assert.equal(tex.image.width, 1024);
  assert.ok(u.crowns.geometry.attributes.position.count > low);
  const image = tex.image;
  updateTitanLandscape(root, s, 0);
  assert.equal(disposed, 1);
  s.config.graphicsQuality = "low";
  updateTitanLandscape(root, s, 0);
  assert.equal(tex.image.width, 512);
  assert.equal(u.crowns.geometry.attributes.position.count, low);
  s.config.graphicsQuality = "high";
  updateTitanLandscape(root, s, 0);
  assert.equal(tex.image, image);
  assert.equal(disposed, 3);
  disposeTitanLandscape(root);
});

test("victory keeps the detonation tail and adds no generic stage sting; retry and combat transitions still clear voices", () => {
  const s = session();
  s.stage = "victory";
  s.won = true;
  const game = {
      settings: { volume: 1 },
      audio: {},
      giganto: { session: s, record: { config: s.config } },
    },
    audio = new TitanAudio(game);
  let stopped = 0,
    frames = 0;
  audio.foley = { stop: () => stopped++ };
  audio.frame = () => frames++;
  audio.playing = true;
  audio.event({ type: "stage", stage: "victory", eventId: "victory-tail" });
  assert.equal(stopped, 0);
  assert.equal(frames, 1);
  assert.equal(audio.lastEffects.size, 0);
  s.stage = "combat";
  audio.event({ type: "stage", stage: "combat", eventId: "new-fight" });
  assert.equal(stopped, 1);
  assert.equal(frames, 2);
});
