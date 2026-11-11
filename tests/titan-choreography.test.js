import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import {
  titanCameraTrack,
  flowTitanShot,
  titanShotKey,
  titanCameraLens,
} from "../src/titan-shot-flow.js";
import {
  TitanCombatFlare,
  makeTitanEnergyCrescent,
  makeTitanEnergyMaterial,
} from "../src/titan-combat-flare.js";
import { titanSession } from "../src/giganto-simulation.js";
import { titanCinematicShot } from "../src/titan-cinematics.js";
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
test("camera curves share velocity/acceleration at every key, remain monotone per segment and are bounded at the endpoints", () => {
  const keys = [
      [0, 0, 70],
      [1, 3, 55],
      [2.5, 12, 63],
      [4, 14, 67],
    ],
    h = 0.00001;
  for (const t of [1, 2.5])
    for (let k = 0; k < 2; k++) {
      const f = (x) => titanCameraTrack(keys, x)[k],
        a = (f(t) - f(t - h)) / h,
        b = (f(t + h) - f(t)) / h;
      assert.ok(Math.abs(a - b) < 0.002);
      const aa = (f(t) - 2 * f(t - h) + f(t - 2 * h)) / h ** 2,
        bb = (f(t + 2 * h) - 2 * f(t + h) + f(t)) / h ** 2;
      assert.ok(Math.abs(aa - bb) < 0.05, `${k}: ${aa} / ${bb}`);
    }
  assert.deepEqual(titanCameraTrack(keys, -5), [0, 70]);
  assert.deepEqual(titanCameraTrack(keys, 100), [14, 67]);
  for (let i = 0; i < keys.length - 1; i++)
    for (let j = 0; j <= 100; j++)
      for (let k = 0; k < 2; k++) {
        const v = titanCameraTrack(
          keys,
          keys[i][0] + ((keys[i + 1][0] - keys[i][0]) * j) / 100,
        )[k];
        assert.ok(
          v >= Math.min(keys[i][k + 1], keys[i + 1][k + 1]) - 1e-8 &&
            v <= Math.max(keys[i][k + 1], keys[i + 1][k + 1]) + 1e-8,
        );
      }
});
test("shot handoffs begin at the currently displayed camera, freeze on pause, tolerate interruption and return control without altering the avatar", () => {
  const history = {},
    current = {
      position: { x: 10, y: 20, z: 80 },
      target: { x: 0, y: 50, z: 0 },
      fov: 65,
    },
    planned = {
      position: { x: 50, y: 70, z: 90 },
      target: { x: 0, y: 68, z: 0 },
      fov: 54,
    };
  flowTitanShot(history, "gameplay", 10, current, current);
  const first = flowTitanShot(history, "phase", 11, current, planned);
  assert.deepEqual(first, current);
  const midpoint = flowTitanShot(history, "phase", 11.2, current, planned);
  assert.ok(distance(midpoint.position, current.position) > 0);
  assert.ok(distance(midpoint.position, planned.position) > 0);
  assert.deepEqual(
    flowTitanShot(history, "phase", 11.2, current, planned),
    midpoint,
  );
  assert.deepEqual(
    flowTitanShot(history, "counter:beam:7", 11.21, midpoint, planned),
    midpoint,
  );
  assert.deepEqual(
    flowTitanShot(history, "counter:beam:7", 11.5, midpoint, planned),
    planned,
  );
  flowTitanShot(history, "finale", 12, planned, planned);
  const exit = flowTitanShot(history, "gameplay", 19, planned, current);
  assert.deepEqual(exit, planned);
  assert.deepEqual(
    flowTitanShot(history, "gameplay", 20.4, planned, current),
    current,
  );
  assert.deepEqual(
    flowTitanShot(history, "phase", 0, current, planned),
    planned,
  );
});
test("camera phase/transform/finale tracks remain finite around a translated Titan and the intro resolves to the playable shoulder", () => {
  const s = titanSession();
  Object.assign(s.boss, { x: 17, z: -11, yaw: 0.6 });
  s.stage = "intro";
  s.stageTime = 4.5;
  const q = titanCinematicShot(s);
  assert.ok(q.fov >= 65);
  assert.ok(q.position.y < 4);
  assert.ok(q.target.y < 2);
  for (const stage of ["intro", "transform", "phase", "finale"])
    for (let i = 0; i < 401; i++) {
      s.stage = stage;
      s.stageTime = i / 60;
      const p = titanCinematicShot(s);
      assert.ok(
        [...Object.values(p.position), ...Object.values(p.target), p.fov].every(
          Number.isFinite,
        ),
      );
    }
  assert.equal(titanShotKey(s, null), "gameplay");
  s.counterScene = { kind: "beam", serial: 8 };
  assert.equal(titanShotKey(s, {}), "counter:beam:8");
});
test("contact flares are bounded, deduplicated, quality-scaled, deterministic while paused and expired without character copies", () => {
  const scene = new T.Scene(),
    fx = new TitanCombatFlare(scene),
    s = titanSession();
  s.stage = "combat";
  s.emerald = true;
  s.time = 10;
  const e = {
    type: "hit",
    kind: "finisher",
    point: { x: 2, y: 58, z: 10 },
    normal: { x: 0, y: 0, z: 1 },
    amount: 760,
    eventId: "contact1",
  };
  fx.event(e, s);
  fx.event(e, s);
  assert.equal(fx.events.length, 1);
  s.time += 0.05;
  fx.update(s, 3);
  assert.equal(scene.children.length, 2);
  assert.equal(fx.stars.count, 8);
  assert.equal(fx.rings.count, 1);
  assert.ok([...fx.stars.instanceMatrix.array].every(Number.isFinite));
  const matrices = [...fx.stars.instanceMatrix.array];
  fx.update(s, 3);
  assert.deepEqual([...fx.stars.instanceMatrix.array], matrices);
  fx.update(s, 1);
  assert.equal(fx.stars.count, 4);
  for (let i = 0; i < 100; i++) fx.event({ ...e, eventId: "hit" + i }, s);
  fx.update(s, 3);
  assert.equal(fx.events.length, 12);
  assert.ok(fx.stars.count <= 128);
  assert.ok(fx.rings.count <= 12);
  s.config.impactEffects = false;
  fx.update(s, 3);
  assert.equal(fx.stars.visible, false);
  assert.equal(fx.rings.visible, false);
  s.config.impactEffects = true;
  s.time += 1;
  fx.update(s, 3);
  assert.equal(fx.stars.count, 0);
  fx.event({ ...e, age: 1, eventId: "late" }, s);
  assert.equal(fx.events.length, 0);
  scene.traverse((o) => {
    o.geometry?.dispose();
    o.material?.dispose();
  });
});
test("new projectile crescents are original bounded geometry, with tapered shader edges and no additional collision or mesh copies", () => {
  const g = makeTitanEnergyCrescent(),
    m = makeTitanEnergyMaterial();
  assert.equal(g.index.count, 240);
  assert.ok([...g.attributes.position.array].every(Number.isFinite));
  const shader = {
    vertexShader: "#include <begin_vertex>",
    fragmentShader: "#include <color_fragment>",
  };
  m.onBeforeCompile(shader);
  assert.ok(shader.fragmentShader.includes("sin(energyUV.x"));
  assert.ok(shader.fragmentShader.includes("diffuseColor.a*=edge"));
  g.dispose();
  m.dispose();
});

test("contact lens pulses are independent of frame count and frozen across paused redraws", () => {
  for (const fps of [30, 60, 144]) {
    let base = 67,
      q;
    for (let i = 0; i < fps; i++) {
      q = titanCameraLens(base, 67, 1 / fps, 0.11);
      base = q.base;
    }
    assert.equal(q.base, 67);
    assert.equal(q.fov, 66.35);
    for (let i = 0; i < 100; i++)
      assert.deepEqual(titanCameraLens(base, 67, 0, 0.11), q);
  }
});
