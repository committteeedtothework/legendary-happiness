import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { titanSession, TITAN_ROUTE } from "../src/giganto-simulation.js";
import {
  makeTitanLandscape,
  updateTitanLandscape,
  titanSceneryHeight,
} from "../src/titan-landscape.js";
import { titanCinematicShot } from "../src/titan-cinematics.js";
import { TitanImpactFX } from "../src/titan-impact-fx.js";
import { arenaConfig } from "../src/titan-settings.js";
import { titanSettingsPanel } from "../src/titan-menu.js";

test("scenic relief is deterministic, varies by direction and leaves the entire playable floor flat", () => {
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    for (const r of [0, 40, 145, 175, 186])
      assert.equal(titanSceneryHeight(Math.sin(a) * r, Math.cos(a) * r), 0);
  }
  const heights = Array.from({ length: 48 }, (_, i) =>
    titanSceneryHeight(Math.sin(i) * 340, Math.cos(i) * 340),
  );
  assert.ok(Math.max(...heights) - Math.min(...heights) > 35);
  assert.deepEqual(
    heights,
    Array.from({ length: 48 }, (_, i) =>
      titanSceneryHeight(Math.sin(i) * 340, Math.cos(i) * 340),
    ),
  );
});
test("arena scenery is batched, quality controls change actual instance budgets, and wind follows the frozen encounter clock", () => {
  const root = makeTitanLandscape(TITAN_ROUTE, 3),
    s = titanSession();
  s.stage = "traversal";
  s.time = 42;
  updateTitanLandscape(root, s, 1 / 60);
  const u = root.userData;
  assert.equal(u.blades.count, 14000);
  assert.equal(u.crowns.material.alphaToCoverage, false);
  assert.ok(u.cliffs.geometry.attributes.position.count > 5000);
  let draws = 0;
  root.traverse((o) => {
    if (o.isMesh) draws++;
  });
  assert.ok(draws < 35);
  const uniform = { value: 0 };
  u.anim.push(uniform);
  updateTitanLandscape(root, s, 0);
  assert.equal(uniform.value, 42);
  for (const material of [u.crowns.material, u.blades.material]) {
    const shader = {
      uniforms: {},
      vertexShader: "#include <begin_vertex>",
      fragmentShader: "#include <opaque_fragment>",
    };
    material.onBeforeCompile(shader);
    assert.equal(shader.uniforms.titanWind.value, 42);
    updateTitanLandscape(root, s, 0);
    assert.equal(shader.uniforms.titanWind.value, 42);
  }
  s.config.sceneryDetail = "low";
  updateTitanLandscape(root, s, 0);
  assert.equal(u.blades.count, 3200);
  assert.equal(u.trunks.count, 150);
  assert.equal(u.crowns.count, 600);
  s.config.graphicsQuality = "low";
  s.config.sceneryDetail = "high";
  updateTitanLandscape(root, s, 0);
  assert.equal(u.blades.count, 14000);
  assert.equal(u.crowns.count, 1040);
  s.config.sceneryDetail = "off";
  updateTitanLandscape(root, s, 0);
  assert.equal(u.blades.visible, false);
  assert.equal(u.crowns.visible, false);
  assert.equal(u.trunks.visible, false);
  for (const tex of u.textures) tex.dispose();
  root.traverse((o) => {
    o.geometry?.dispose();
  });
  for (const m of u.materials) m.dispose();
});
test("contact sparks are bounded, deduplicated, frozen by pause and absent when disabled or stale", () => {
  const scene = new T.Scene(),
    fx = new TitanImpactFX(scene),
    s = titanSession();
  s.stage = "combat";
  s.time = 10;
  s.attempt = 0;
  const event = {
    type: "hit",
    point: { x: 2, y: 50, z: 3 },
    normal: { x: 1, y: 0, z: 0 },
    amount: 120,
    eventId: "a",
  };
  const before = JSON.stringify(s);
  fx.event(event, s);
  assert.equal(JSON.stringify(s), before);
  const n = fx.particles.length;
  assert.ok(n > 8);
  fx.event(event, s);
  assert.equal(fx.particles.length, n);
  for (let i = 0; i < 12; i++) fx.event({ ...event, eventId: "b" + i }, s);
  assert.equal(fx.particles.length, 64);
  s.time += 0.1;
  fx.update(s);
  const matrix = [...fx.mesh.instanceMatrix.array];
  fx.update(s);
  assert.deepEqual([...fx.mesh.instanceMatrix.array], matrix);
  s.config.impactEffects = false;
  fx.update(s);
  assert.equal(fx.mesh.count, 0);
  fx.event({ ...event, eventId: "off" }, s);
  assert.equal(fx.particles.length, 64);
  s.config.impactEffects = true;
  fx.event({ ...event, age: 1, eventId: "late" }, s);
  assert.equal(fx.particles.length, 64);
  s.time += 1;
  fx.update(s);
  assert.equal(fx.mesh.count, 0);
  fx.event({ ...event, eventId: "new" }, s);
  s.attempt++;
  fx.update(s);
  assert.equal(fx.particles.length, 0);
  fx.mesh.geometry.dispose();
  fx.mesh.material.dispose();
});
test("cinematic camera tracks are finite, continuous at authored beats and never mutate encounter state", () => {
  for (const [stage, end, knots] of [
    ["intro", 4.5, [1.8]],
    ["transform", 6, [1.8, 3.7]],
    ["phase", 4, [1.5]],
    ["finale", 7, [1.8, 3.6, 4.8]],
  ]) {
    const s = titanSession();
    s.stage = stage;
    Object.assign(s.avatar, { x: -12, y: 68, z: 45 });
    for (let i = 0; i <= end * 60; i++) {
      s.stageTime = i / 60;
      const before = JSON.stringify(s),
        q = titanCinematicShot(s);
      assert.equal(JSON.stringify(s), before);
      assert.ok(
        [...Object.values(q.position), ...Object.values(q.target), q.fov].every(
          Number.isFinite,
        ),
      );
      assert.ok(q.fov >= 45 && q.fov <= 75);
    }
    for (const t of knots) {
      s.stageTime = t - 0.001;
      const a = titanCinematicShot(s);
      s.stageTime = t + 0.001;
      const b = titanCinematicShot(s);
      assert.ok(
        Math.hypot(
          a.position.x - b.position.x,
          a.position.y - b.position.y,
          a.position.z - b.position.z,
        ) < (stage === "finale" ? 0.5 : 0.05),
      );
    }
  }
});
test("arena presentation preferences are bounded, independently persisted and exposed as usable controls", () => {
  const c = arenaConfig({
    renderScale: 0.1,
    bloomIntensity: 99,
    exposure: 99,
    atmosphere: false,
    impactEffects: false,
    cinematicCamera: false,
    cinematicBars: false,
    sceneryDetail: "low",
  });
  assert.equal(c.renderScale, 0.65);
  assert.equal(c.bloomIntensity, 0.65);
  assert.equal(c.exposure, 1.4);
  assert.equal(c.atmosphere, false);
  assert.equal(c.cinematicCamera, false);
  assert.equal(c.sceneryDetail, "low");
  const s = titanSession({ ...c });
  const html = titanSettingsPanel(s.config, true, {});
  for (const key of [
    "renderScale",
    "bloomIntensity",
    "exposure",
    "atmosphere",
    "impactEffects",
    "cinematicBars",
    "sceneryDetail",
  ])
    assert.ok(html.includes('data-titan-config="' + key + '"'));
  assert.equal(arenaConfig({}).renderScale, 1);
  assert.ok(!html.includes('data-titan-config="cinematics"'));
  assert.ok(!html.includes("Skip cinematic"));
});
