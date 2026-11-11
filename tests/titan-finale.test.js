import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {
  titanSession,
  titanInput,
  stepTitan,
  restoreTitanSession,
} from "../src/giganto-simulation.js";
import {
  titanPiercePosition,
  titanDefeatPose,
  lockTitanCinematics,
} from "../src/titan-finale.js";
import { titanLocalPoint, titanWorldPoint } from "../src/titan-space.js";
import { titanCinematicShot } from "../src/titan-cinematics.js";
import {
  TitanFinaleView,
  installTitanBreach,
} from "../src/titan-finale-view.js";
const session = () => {
  const s = lockTitanCinematics(titanSession({ cinematicPace: 1, drain: 0 }));
  s.original = {};
  return s;
};
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
test("locked cinematics reject skip and legacy disable flags; all stages end naturally", () => {
  for (const stage of ["intro", "transform", "phase", "finale"]) {
    const s = session();
    Object.assign(s, {
      stage,
      stageTime: 0,
      emerald: stage !== "intro",
      cinematicFrom: { x: 0, y: 65, z: 30 },
    });
    const before = JSON.stringify(s);
    assert.equal(titanInput(s, "skip"), false);
    assert.equal(JSON.stringify(s), before);
    const saved = restoreTitanSession(JSON.parse(JSON.stringify(s)));
    assert.ok(saved.config.mandatoryCinematics);
    assert.equal(titanInput(saved, "skip"), false);
    const duration = { intro: 4.5, transform: 6, phase: 4, finale: 7 }[stage];
    for (let i = 0; i < (duration + 0.2) * 60; i++) stepTitan(s, {}, 1 / 60);
    assert.equal(
      s.stage,
      {
        intro: "traversal",
        transform: "combat",
        phase: "combat",
        finale: "victory",
      }[stage],
    );
  }
  const forced = titanSession({ cinematicPace: 1, cinematics: false, mandatoryCinematics: true });
  assert.equal(forced.config.cinematics, true);
  assert.equal(forced.stage, "intro");
});
test("finisher begins at the actual actor, pulls back, passes through the torso and holds its exit endpoint", () => {
  const s = session();
  s.boss = { ...s.boss, x: 22, z: -14, yaw: 0.9 };
  const from = titanWorldPoint(s, { x: -12, y: 64, z: 45 });
  assert.ok(distance(titanPiercePosition(from, 0, s), from) < 1e-8);
  const pull = titanLocalPoint(s, titanPiercePosition(from, 1.9, s)),
    entry = titanLocalPoint(s, titanPiercePosition(from, 3.6, s)),
    inside = titanLocalPoint(s, titanPiercePosition(from, 4, s)),
    exit = titanLocalPoint(s, titanPiercePosition(from, 4.8, s));
  assert.ok(pull.z > 90);
  assert.ok(Math.abs(entry.z - 1) < 1e-8);
  assert.ok(inside.z < 0 && inside.z > -15);
  assert.ok(exit.z <= -70 + 1e-8);
  assert.ok(
    distance(
      titanPiercePosition(from, 7, s),
      titanPiercePosition(from, 50, s),
    ) < 1e-8,
  );
  for (const t of [1.9, 3.6, 4.35, 4.8]) {
    const dt = 0.00001,
      a = titanPiercePosition(from, t - dt, s),
      b = titanPiercePosition(from, t, s),
      c = titanPiercePosition(from, t + dt, s),
      v1 = { x: (b.x - a.x) / dt, y: (b.y - a.y) / dt, z: (b.z - a.z) / dt },
      v2 = { x: (c.x - b.x) / dt, y: (c.y - b.y) / dt, z: (c.z - b.z) / dt };
    assert.ok(distance(v1, v2) < 0.1, `${t}: ${distance(v1, v2)}`);
  }
});
test("the authored chest transit is frame-rate stable and victory/reload cannot replay its cues", () => {
  for (const rate of [30, 60, 144]) {
    const s = session();
    Object.assign(s, {
      stage: "finale",
      emerald: true,
      cinematicFrom: { x: -12, y: 64, z: 45 },
    });
    const cues = [];
    for (let i = 0; i < rate * 7 + 0.1 * rate; i++) {
      stepTitan(s, {}, 1 / rate);
      cues.push(
        ...s.events.filter((e) => e.type === "cinematic-cue").map((e) => e.cue),
      );
    }
    assert.equal(s.stage, "victory");
    assert.equal(s.won, true);
    assert.deepEqual(cues, [
      "charge",
      "launch",
      "contact",
      "rupture",
      "detonate",
    ]);
    const r = restoreTitanSession(JSON.parse(JSON.stringify(s)));
    assert.equal(r.stage, "victory");
    assert.equal(titanInput(r, "skip"), false);
  }
});
test("chest rupture cuts lit and shadow material surfaces, with bounded solid debris and no boss opacity fade", () => {
  const root = new T.Group(),
    mesh = new T.Mesh(
      new T.BoxGeometry(30, 80, 20),
      new T.MeshStandardMaterial(),
    );
  root.add(mesh);
  const uniforms = {
    inverse: { value: new T.Matrix4() },
    radius: { value: 7 },
  };
  assert.equal(installTitanBreach(root, uniforms), 1);
  for (const material of [
    mesh.material,
    mesh.customDepthMaterial,
    mesh.userData.titanBreachNormal,
  ]) {
    const shader = {
      uniforms: {},
      vertexShader: "#include <worldpos_vertex>",
      fragmentShader: "#include <clipping_planes_fragment>",
    };
    material.onBeforeCompile(shader);
    assert.ok(shader.fragmentShader.includes("discard"));
    assert.equal(shader.uniforms.titanBreachRadius, uniforms.radius);
    assert.ok(shader.vertexShader.includes("titanBreachInverse*modelMatrix"));
  }
  const scene = new T.Scene(),
    boss = new T.Group(),
    body = new T.Mesh(new T.BoxGeometry(), new T.MeshStandardMaterial());
  boss.add(body);
  scene.add(boss);
  const view = new TitanFinaleView(scene),
    s = session();
  Object.assign(s, {
    stage: "finale",
    stageTime: 4.8,
    cinematicFrom: { x: 0, y: 64, z: 45 },
  });
  view.update(s, boss);
  assert.ok(view.uniforms.radius.value > 7);
  assert.ok(view.hole.visible);
  assert.equal(view.wall.geometry.parameters.openEnded, true);
  assert.equal(body.material.opacity, 1);
  assert.equal(view.fragments.count, 96);
  assert.ok(view.trail.count <= 48);
  const frozen = Array.from(view.fragments.instanceMatrix.array);
  view.update(s, boss);
  assert.deepEqual(Array.from(view.fragments.instanceMatrix.array), frozen);
  s.config.particles = false;
  view.update(s, boss);
  assert.equal(view.fragments.count, 0);
  assert.equal(view.trail.count, 0);
  assert.ok(view.hole.visible);
  s.stage = "combat";
  view.update(s, boss);
  assert.equal(view.uniforms.radius.value, 0);
  assert.equal(view.hole.visible, false);
  assert.equal(view.light.intensity, 0);
  view.dispose();
});
test("defeat stays airborne and every authored camera segment remains outside the shoulders", () => {
  const s = session();
  s.stage = "finale";
  s.cinematicFrom = { x: -12, y: 64, z: 45 };
  let prev;
  for (let t = 0; t <= 7; t += 1 / 144) {
    s.stageTime = t;
    Object.assign(s.avatar, titanPiercePosition(s.cinematicFrom, t, s));
    const q = titanCinematicShot(s);
    assert.ok(
      [q.position.x, q.position.y, q.position.z, q.fov].every(Number.isFinite),
    );
    if (t > 2.5) assert.ok(Math.hypot(q.position.x, q.position.z) > 60);
    if (prev) assert.ok(distance(q.position, prev) < 3.5);
    prev = q.position;
  }
  const a = titanDefeatPose(7);
  assert.ok(a.tilt < -0.6 && a.lift > 20 && a.radius > 7);
});
