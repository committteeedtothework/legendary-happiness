import test from "node:test";
import assert from "node:assert/strict";
import {
  titanSession,
  stepTitan,
  restoreTitanSession,
  titanInput,
} from "../src/giganto-simulation.js";
import {
  openTitanReturn,
  crossesTitanReturn,
  titanReturnReady,
  resetTitanReturn,
  TITAN_RETURN,
} from "../src/titan-return.js";
import { sonicLength } from "../src/titan-metrics.js";
const win = (scale = true) => {
  const s = titanSession({ drain: 3, colossalScale: scale });
  Object.assign(s, {
    stage: "victory",
    stageTime: 0,
    won: true,
    original: {},
    rings: 0,
  });
  Object.assign(s.avatar, { x: -8, y: 83, z: -110, vx: 0, vy: 0, vz: 0 });
  return s;
};
test("victory opens one persistent reachable gate without moving Sonic or consuming rings", () => {
  const s = win(),
    before = { ...s.avatar };
  const q = openTitanReturn(s);
  assert.equal(s.avatar.x, before.x);
  assert.equal(s.avatar.y, before.y);
  assert.equal(s.avatar.z, before.z);
  assert.ok(!s.lock);
  assert.equal(q, openTitanReturn(s));
  assert.ok(
    Math.abs(Math.hypot(q.x - before.x, q.z - before.z) - sonicLength(s, 18)) <
      1e-8,
  );
  for (let i = 0; i < 3600; i++) stepTitan(s, {}, 1 / 60);
  assert.equal(s.stage, "victory");
  assert.equal(s.rings, 0);
  assert.equal(s.avatar.x, before.x);
  assert.equal(s.avatar.z, before.z);
  assert.equal(s.projectiles.length, 0);
  assert.equal(titanInput(s, "hit"), false);
  assert.equal(titanInput(s, "homing"), false);
  const old = titanSession();
  assert.equal(openTitanReturn(old), null);
});
test("post-battle flight crosses the visible gate and fades only after entering, at 30/60/144 Hz", () => {
  for (const hz of [30, 60, 144])
    for (const scale of [true, false]) {
      const s = win(scale),
        q = openTitanReturn(s);
      let n = 0;
      while (!q.crossed && n++ < hz * 5)
        stepTitan(s, { forward: true }, 1 / hz);
      assert.ok(q.crossed, `${hz}/${scale}`);
      assert.ok(q.age >= TITAN_RETURN.open);
      assert.ok(!titanReturnReady(s));
      const at = { ...s.avatar };
      while (!titanReturnReady(s) && n++ < hz * 6)
        stepTitan(s, { forward: true, boost: true }, 1 / hz);
      assert.ok(titanReturnReady(s));
      assert.equal(s.avatar.x, at.x);
      assert.equal(s.avatar.z, at.z);
      assert.equal(s.avatar.y, at.y);
      assert.equal(s.rings, 0);
    }
});
test("swept opening rejects side/height misses and catches fast crossings from either side", () => {
  const s = win(),
    q = openTitanReturn(s);
  q.age = 2;
  const r = sonicLength(s, 1.9),
    feet = q.y - sonicLength(s, 1.8),
    point = (d, side = 0, y = feet) => ({
      x: q.x + q.nx * d + q.nz * side,
      y,
      z: q.z + q.nz * d - q.nx * side,
    });
  assert.ok(crossesTitanReturn(s, point(20), point(-20)));
  assert.ok(crossesTitanReturn(s, point(-20), point(20)));
  assert.ok(!crossesTitanReturn(s, point(2, r + 1), point(-2, r + 1)));
  assert.ok(
    !crossesTitanReturn(
      s,
      point(2, 0, feet + r + 1),
      point(-2, 0, feet + r + 1),
    ),
  );
  assert.ok(!crossesTitanReturn(s, point(3), point(1)));
  q.age = 0.2;
  assert.ok(!crossesTitanReturn(s, point(2), point(-2)));
});
test("gate, flight position and in-progress fade survive reload; legacy victories receive a gate", () => {
  const s = win(),
    q = openTitanReturn(s);
  q.age = 2;
  stepTitan(s, { right: true, up: true }, 1 / 60);
  const saved = restoreTitanSession(JSON.parse(JSON.stringify(s)));
  assert.equal(saved.returnPortal.x, q.x);
  assert.equal(saved.avatar.x, s.avatar.x);
  assert.equal(saved.avatar.y, s.avatar.y);
  assert.equal(saved.returnPortal.age, q.age);
  q.crossed = true;
  q.fade = 0.2;
  q.entry = { x: q.x + q.nx, y: q.y - 1, z: q.z + q.nz };
  const mid = restoreTitanSession(JSON.parse(JSON.stringify(s)));
  assert.ok(mid.returnPortal.crossed);
  assert.equal(mid.returnPortal.fade, 0.2);
  for (let i = 0; i < 20; i++) stepTitan(mid, {}, 1 / 60);
  assert.ok(titanReturnReady(mid));
  delete s.returnPortal;
  const legacy = restoreTitanSession(JSON.parse(JSON.stringify(s)));
  assert.ok(legacy.returnPortal);
  assert.equal(legacy.avatar.x, s.avatar.x);
});
test("failed return clears the fade and cannot loop without another crossing", () => {
  const s = win(),
    q = openTitanReturn(s);
  q.age = 2;
  q.crossed = true;
  q.fade = 0.45;
  q.entry = {
    x: q.x + q.nx * 2,
    y: q.y - sonicLength(s, 1.8),
    z: q.z + q.nz * 2,
  };
  resetTitanReturn(s);
  assert.ok(!titanReturnReady(s));
  assert.equal(q.fade, 0);
  assert.ok(!q.crossed);
  for (let i = 0; i < 120; i++) stepTitan(s, {}, 1 / 60);
  assert.ok(!q.crossed);
  assert.ok(!titanReturnReady(s));
});

test("invalid saved gate data is replaced and invalid rollback positions are discarded", () => {
  const s = win();
  const q = openTitanReturn(s);
  const raw = JSON.parse(JSON.stringify(s));
  raw.returnPortal.nx = NaN;
  const repaired = restoreTitanSession(raw);
  assert.ok(Number.isFinite(repaired.returnPortal.nx));
  assert.ok(!repaired.returnPortal.crossed);
  raw.returnPortal = {
    ...q,
    entry: { x: 1e9, y: 30, z: 0 },
    crossed: true,
    fade: 0.2,
  };
  const safe = restoreTitanSession(raw);
  assert.equal(safe.returnPortal.entry, undefined);
  resetTitanReturn(safe);
  assert.ok(Math.hypot(safe.avatar.x, safe.avatar.z) < 230);
});
