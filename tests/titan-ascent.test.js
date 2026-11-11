import test from "node:test";
import assert from "node:assert/strict";
import * as T from "three";
import { climbFixture } from "./helpers/titan-climb-fixture.js";
import {
  titanSession,
  stepTitan,
  titanInput,
  restoreTitanSession,
} from "../src/giganto-simulation.js";
import {
  armorFocus,
  armorAttached,
  clearArmorCamera,
  makeArmorGuide,
  armorUp,
} from "../src/titan-climb.js";
import { nearestArmorPoint, raycastArmor } from "../src/titan-climb-surface.js";
import {
  titanWorldPoint,
  titanLocalPoint,
  titanWorldVector,
} from "../src/titan-space.js";
import {
  importedRig,
  updateImportedGiganto,
  disposeImportedRig,
} from "../src/titan-imports.js";
const start = () => {
  const s = titanSession({ cinematics: true, drain: 0 });
  s.stage = "traversal";
  Object.assign(s.avatar, { x: 4.8, y: 0.05, z: -1.9, yaw: 0 });
  s.original = {};
  return s;
};
const tick = (s, n, input = { forward: true }, hz = 60) => {
  const e = [];
  for (let i = 0; i < n; i++) {
    stepTitan(s, input, 1 / hz);
    e.push(...s.events);
  }
  return e;
};
test("real imported armor provides an indexed, continuous foot-to-crown ascent and every guide point is a mesh contact", async () => {
  const { surface } = await climbFixture();
  assert.ok(surface.triangles > 40000 && surface.triangles < 43000);
  assert.ok(surface.cells.size < 2000);
  assert.equal(surface.guide.length, 13);
  assert.ok(surface.guide[12].point.y > 85);
  for (const q of surface.guide) {
    const n = nearestArmorPoint(q.point, 0.01, {}, surface);
    assert.ok(n && n.distance < 0.001);
    assert.ok(
      Math.abs(Math.hypot(q.normal.x, q.normal.y, q.normal.z) - 1) < 0.0001,
    );
  }
});
test("W climbs actual moving armor at 30/60/144 Hz, collects twelve milestones once and unlocks the Emerald without platform collisions", async () => {
  await climbFixture();
  const times = [];
  for (const hz of [30, 60, 144]) {
    const s = start(),
      events = [];
    let maxGap = 0;
    for (let i = 0; i < hz * 30 && s.stage === "traversal"; i++) {
      stepTitan(s, { forward: true }, 1 / hz);
      events.push(...s.events);
      if (armorAttached(s) && s.climb.mount >= 1) {
        const p = titanLocalPoint(s, s.avatar),
          q = nearestArmorPoint(p, 0.5);
        assert.ok(q);
        maxGap = Math.max(maxGap, q.distance);
      }
    }
    assert.equal(s.stage, "transform", JSON.stringify(s.avatar));
    assert.equal(s.route, 12);
    assert.deepEqual(
      s.collected,
      Array.from({ length: 12 }, (_, i) => i + 1),
    );
    assert.equal(s.rings, 140);
    assert.equal(events.filter((e) => e.type === "emerald").length, 1);
    assert.ok(maxGap < 0.15);
    assert.ok(Math.hypot(s.boss.x, s.boss.z) > 0.1);
    times.push(s.time);
  }
  assert.ok(Math.max(...times) - Math.min(...times) < 2, JSON.stringify(times));
});
test("idle attachment follows the moving root without sliding; jump/release work and reject a remote grip", async () => {
  await climbFixture();
  const s = start();
  tick(s, 100);
  const anchor = {
    triangle: s.climb.triangle,
    barycentric: { ...s.climb.barycentric },
  };
  tick(s, 180, {});
  assert.equal(s.climb.triangle, anchor.triangle);
  assert.deepEqual(s.climb.barycentric, anchor.barycentric);
  assert.ok(
    nearestArmorPoint(titanLocalPoint(s, s.avatar), 0.5)?.distance < 0.15,
  );
  assert.ok(titanInput(s, "jump"));
  assert.equal(s.climb.attached, false);
  const y = s.avatar.y;
  tick(s, 5, {});
  assert.ok(s.avatar.y > y);
  assert.equal(titanInput(s, "climb"), false);
  const far = start();
  Object.assign(far.avatar, { x: 120, y: 0.05, z: 100 });
  assert.equal(titanInput(far, "climb"), false);
  assert.equal(far.energy, undefined);
});
test("save/reload keeps a surface anchor, rejects invalid normals and preserves legacy in-progress ruins", async () => {
  await climbFixture();
  const s = start();
  tick(s, 180);
  const saved = JSON.parse(JSON.stringify(s)),
    r = restoreTitanSession(saved);
  assert.ok(r.climb.attached);
  tick(r, 1, {});
  assert.ok(
    nearestArmorPoint(titanLocalPoint(r, r.avatar), 0.5)?.distance < 0.15,
  );
  const bad = JSON.parse(JSON.stringify(saved));
  bad.climb.normal = { x: 0, y: 0, z: 0 };
  assert.equal(restoreTitanSession(bad).climb.attached, false);
  const old = JSON.parse(JSON.stringify(saved));
  delete old.config.climbMode;
  delete old.climb;
  old.route = 6;
  assert.equal(restoreTitanSession(old).config.climbMode, "ruins");
});
test("fall recovery returns to a real earned armor checkpoint without replaying ring rewards", async () => {
  await climbFixture();
  const s = start();
  tick(s, 170);
  assert.ok(s.climb.checkpoint);
  const rings = s.rings,
    route = s.route;
  titanInput(s, "climb");
  Object.assign(s.avatar, { y: -2, vx: 0, vy: 0, vz: 0 });
  tick(s, 1, {});
  assert.ok(s.climb.attached);
  assert.equal(s.rings, rings);
  assert.equal(s.route, route);
  assert.ok(s.events.some((e) => e.type === "return-pad"));
});
test("dorsal pulses respect their warning/cooldown; boost resists and a jumping actor is free of wall adhesion", async () => {
  await climbFixture();
  for (const boost of [false, true]) {
    const s = start(),
      q = nearestArmorPoint({ x: 0, y: 50, z: -18 }, 8);
    assert.ok(q);
    Object.assign(s.climb, q, { attached: true, mount: 1 });
    Object.assign(s.avatar, titanWorldPoint(s, q.point));
    s.time = 4.05;
    stepTitan(s, { forward: true, boost }, 1 / 60);
    assert.ok(s.events.some((e) => e.type === "pulse"));
    assert.equal(s.climb.attached, boost);
    assert.ok(s.pulseCooldown > 1);
    assert.equal(s.energy, undefined);
  }
});
test("exact mesh camera traces find an occluding leg and choose a clear outside view", async () => {
  await climbFixture();
  const s = start();
  tick(s, 90);
  const focus = armorFocus(s),
    n = titanWorldVector(s, s.climb.normal),
    wanted = {
      x: s.avatar.x + n.x * 15,
      y: s.avatar.y + n.y * 15 + 5,
      z: s.avatar.z + n.z * 15,
    },
    safe = clearArmorCamera(s, focus, wanted);
  assert.ok(!raycastArmor(titanLocalPoint(s, focus), titanLocalPoint(s, safe)));
  assert.ok(Object.values(safe).every(Number.isFinite));
  assert.ok(raycastArmor({ x: 4.8, y: 20, z: 15 }, { x: 4.8, y: 20, z: -25 }));
});
test("the independently sampled moving armor matches the visible skinned rig at four joint phases", async () => {
  const { asset, surface } = await climbFixture(),
    r = importedRig(asset),
    s = start();
  s.boss = { x: 1, z: -0.5, yaw: 0.2, walk: null };
  let checked = 0;
  for (const clock of [0, 3, 6, 9]) {
    s.time = clock;
    surface.update(clock);
    updateImportedGiganto(r, s, 1 / 60);
    assert.equal(r.userData.currentClip, "climb_motion");
    r.updateMatrixWorld(true);
    r.traverse((m) => {
      if (!m.isSkinnedMesh) return;
      m.skeleton.update();
      const a = m.geometry.attributes.position;
      for (let i = 0; i < a.count; i += Math.max(1, Math.floor(a.count / 30))) {
        const p = new T.Vector3().fromBufferAttribute(a, i);
        m.applyBoneTransform(i, p);
        p.applyMatrix4(m.matrixWorld);
        const q = nearestArmorPoint(titanLocalPoint(s, p), 0.05, {}, surface);
        assert.ok(q && q.distance < 0.01);
        checked++;
      }
    });
  }
  assert.ok(checked > 120);
  disposeImportedRig(r);
});

test("an active encounter locks route selection while pre-encounter configuration keeps it available", async () => {
  const { titanSettingsPanel } = await import("../src/titan-menu.js");
  const c = titanSession().config,
    info = { sigils: 0, creative: true };
  assert.match(
    titanSettingsPanel(c, true, info),
    /data-titan-config="climbMode" disabled/,
  );
  assert.doesNotMatch(
    titanSettingsPanel(c, false, info),
    /data-titan-config="climbMode" disabled/,
  );
});

test("ground approaches after ring gathering clear armor lips across simulation rates and different root phases", async () => {
  const { surface } = await climbFixture();
  for (const hz of [30, 60, 144])
    for (const offset of [0, 7, 19]) {
      const s = titanSession({ cinematics: false, drain: 0 });
      s.stage = "traversal";
      s.time = offset;
      let input = {},
        next = 0;
      for (let i = 0; i < hz * 100 && s.stage === "traversal"; i++) {
        const p = s.avatar;
        if (s.time >= next) {
          next = s.time + 0.07;
          const gathering = s.route === 0 && s.rings < 360;
          const candidates = Array.from({ length: 36 }, (_, i) => {
            const row = Math.floor(i / 12),
              a = ((i % 12) / 12) * Math.PI * 2 + row * 0.12,
              r = 35 + row * 28;
            return { id: i, x: Math.sin(a) * r, z: Math.cos(a) * r };
          }).filter((r) => !s.ringPickups.includes(r.id));
          const ring = gathering
            ? candidates.sort(
                (a, b) =>
                  Math.hypot(a.x - p.x, a.z - p.z) -
                  Math.hypot(b.x - p.x, b.z - p.z),
              )[0]
            : null;
          if (s.climb.attached) input = { forward: true, boost: true };
          else {
            const q = surface.guide[0],
              w =
                ring ||
                titanWorldPoint(s, {
                  x: q.point.x + q.normal.x * 1.5,
                  y: 0.05,
                  z: q.point.z + q.normal.z * 1.5,
                }),
              dx = w.x - p.x,
              dz = w.z - p.z;
            p.yaw = Math.atan2(-dx, -dz);
            input = { forward: true, boost: Math.hypot(dx, dz) > 6 };
          }
        }
        stepTitan(s, input, 1 / hz);
      }
      assert.equal(
        s.stage,
        "combat",
        JSON.stringify({ hz, offset, climb: s.climb }),
      );
      assert.equal(s.route, 12);
      assert.equal(s.collected.length, 12);
      assert.equal(s.rings, 400);
    }
});

test("saved barycentric anchors ride a deforming forearm without sliding or replaying rewards", async () => {
  const { surface } = await climbFixture();
  surface.update(0);
  const s = start(),
    q = nearestArmorPoint({ x: 18, y: 32, z: -10 }, 10, {}, surface);
  assert.ok(q);
  Object.assign(s.climb, q, { attached: true, mount: 1 });
  Object.assign(s.avatar, titanWorldPoint(s, q.point));
  const anchor = { triangle: q.triangle, barycentric: { ...q.barycentric } },
    initial = { ...q.point };
  stepTitan(s, {}, 1 / 60);
  const rings = s.rings;
  for (let i = 0; i < 179; i++) stepTitan(s, {}, 1 / 60);
  assert.equal(s.climb.triangle, anchor.triangle);
  assert.deepEqual(s.climb.barycentric, anchor.barycentric);
  assert.ok(
    Math.hypot(
      s.climb.point.x - initial.x,
      s.climb.point.y - initial.y,
      s.climb.point.z - initial.z,
    ) > 0.5,
  );
  assert.ok(
    nearestArmorPoint(titanLocalPoint(s, s.avatar), 0.5)?.distance < 0.15,
  );
  const saved = restoreTitanSession(JSON.parse(JSON.stringify(s)));
  assert.ok(saved?.climb.attached);
  stepTitan(saved, {}, 1 / 144);
  assert.equal(saved.climb.triangle, anchor.triangle);
  assert.deepEqual(saved.climb.barycentric, anchor.barycentric);
  assert.equal(s.rings, rings);
  assert.equal(saved.rings, rings);
});

test("voluntary descent and safe ground landings do not teleport Sonic back to an old high checkpoint", async () => {
  await climbFixture();
  const s = start();
  tick(s, 160);
  assert.ok(s.climb.checkpoint.point.y > 20);
  titanInput(s, "climb");
  Object.assign(s.avatar, {
    x: 90,
    y: 0,
    z: 60,
    vx: 0,
    vy: 0,
    vz: 0,
    onGround: true,
  });
  const p = { ...s.avatar };
  tick(s, 120, {});
  assert.equal(s.climb.attached, false);
  assert.ok(
    Math.hypot(s.avatar.x - p.x, s.avatar.y - p.y, s.avatar.z - p.z) < 0.01,
  );
  assert.ok(!s.events.some((e) => e.type === "return-pad"));
});
