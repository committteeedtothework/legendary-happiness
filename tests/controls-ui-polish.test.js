import test from "node:test";
import assert from "node:assert/strict";
import {
  achievementEnvelope,
  playAchievementCue,
} from "../src/achievement-feedback.js";
import { titanSession } from "../src/giganto-simulation.js";
import { wyvernSession } from "../src/wyvern-simulation.js";
import {
  acquireTitanTarget,
  tickTitanTarget,
  toggleTitanTarget,
  titanTargetContact,
} from "../src/titan-targeting.js";
import { clearTitanCamera, titanCameraBlocked } from "../src/titan-camera.js";
import { constrainBoxes } from "../src/titan-collision.js";
import { sonicCollider } from "../src/sonic-collider.js";
import { sonicHandling, tickSonicMovement } from "../src/sonic-movement.js";
import { arenaUnitScale } from "../src/titan-metrics.js";
import {
  advectWyvernAvatar,
  wyvernWorldPoint,
  clearWyvernTerrainCamera,
} from "../src/wyvern-world.js";
import { resolveWyvernPlatforms } from "../src/wyvern-platforms.js";
import { runwayPoint } from "../src/wyvern-space.js";
const fight = (make) => {
  const s = make({ drain: 0, bossMobility: false });
  s.stage = "combat";
  s.emerald = true;
  Object.assign(s.avatar, { x: 0, y: 60, z: 80, yaw: 0, pitch: 0 });
  return s;
};
test("notice fades both ends, holds at full opacity and is bounded", () => {
  assert.equal(achievementEnvelope(0), 0);
  assert.equal(achievementEnvelope(4), 0);
  assert.equal(achievementEnvelope(1), 1);
  assert.ok(achievementEnvelope(0.1) > 0 && achievementEnvelope(0.1) < 1);
  assert.ok(achievementEnvelope(3.8) > 0 && achievementEnvelope(3.8) < 1);
  for (const a of [-5, 5, Infinity]) assert.equal(achievementEnvelope(a), 0);
});
test("original achievement cue schedules bounded nodes once and disconnects all on completion", () => {
  let count = 0,
    closed = 0;
  const sources = [];
  const param = {
    setValueAtTime() {},
    linearRampToValueAtTime() {},
    exponentialRampToValueAtTime() {},
  };
  const ctx = {
    state: "running",
    currentTime: 5,
    createOscillator() {
      count++;
      const o = {
        frequency: param,
        connect() {},
        disconnect() {
          closed++;
        },
        start(t) {
          assert.ok(t >= 5);
        },
        stop(t) {
          assert.ok(t < 6);
        },
      };
      sources.push(o);
      return o;
    },
    createGain() {
      return {
        gain: param,
        connect() {},
        disconnect() {
          closed++;
        },
      };
    },
  };
  assert.equal(playAchievementCue(ctx, {}, {}), true);
  assert.equal(count, 4);
  sources.forEach((o) => o.onended());
  assert.equal(closed, 8);
  assert.equal(playAchievementCue({ ...ctx, state: "suspended" }, {}), false);
  assert.equal(playAchievementCue(ctx, {}, { volume: 0 }), false);
  assert.equal(count, 4);
});
for (const make of [titanSession, wyvernSession]) {
  test(
    make.name +
      " lock retains a reachable body region, respects manual camera and releases without moving Sonic",
    () => {
      const s = fight(make),
        p = { ...s.avatar };
      const hit = acquireTitanTarget(s);
      assert.ok(hit?.id);
      const id = hit.id;
      for (let i = 0; i < 180; i++) tickTitanTarget(s, 1 / 60);
      assert.equal(titanTargetContact(s).id, id);
      s.avatar.yaw += 0.4;
      const yaw = s.avatar.yaw;
      tickTitanTarget(s, 1 / 60);
      assert.equal(s.avatar.yaw, yaw);
      assert.equal(s.avatar.x, p.x);
      assert.equal(s.avatar.y, p.y);
      assert.equal(s.avatar.z, p.z);
      toggleTitanTarget(s);
      assert.equal(s.lock, false);
      assert.equal(s.targetLock, null);
    },
  );
  test(
    make.name +
      " obstruction correction preserves boom direction and never jumps around boss",
    () => {
      const s = fight(make),
        p = s.avatar;
      const desired = { x: p.x, y: p.y + 4, z: p.z - 120 },
        q = clearTitanCamera(s, desired, 25);
      assert.ok(Object.values(q).every(Number.isFinite));
      assert.ok(q.z <= p.z && q.z >= desired.z);
      assert.ok(Math.abs(q.x - p.x) < 0.001);
      if (!titanCameraBlocked(s, { x: p.x, y: p.y + 2, z: p.z + 5 }))
        assert.ok(!titanCameraBlocked(s, q));
    },
  );
}
test("floor-aware boulder projection cannot push a curled actor under the arena", () => {
  for (const y of [0, 0.01, 0.1]) {
    const p = { x: 0, y, z: 0, vx: 4, vy: -80, vz: 0 };
    constrainBoxes(p, [{ x: 0, y: 4, z: 0, w: 6, h: 8, d: 6 }], 1, 2.2, 0);
    assert.ok(p.y >= 0);
    assert.ok(Math.hypot(p.x, p.z) > 3);
  }
});
test("ball and upright colliders share feet and the ball lands on swept ribbon triangles at 30/60/144Hz", () => {
  for (const fps of [30, 60, 144]) {
    const s = wyvernSession(),
      q = runwayPoint(900);
    s.stage = "traversal";
    Object.assign(s.avatar, q, {
      y: q.y + 12,
      vy: -170,
      vx: 0,
      vz: 0,
      onGround: false,
    });
    const c = sonicCollider(s);
    assert.equal(c.height, 2.2);
    for (let i = 0; i < fps; i++) {
      const old = { ...s.avatar };
      s.avatar.y += s.avatar.vy / fps;
      resolveWyvernPlatforms(s.avatar, old, c);
      if (s.avatar.onGround) break;
    }
    assert.ok(s.avatar.onGround);
    assert.ok(s.avatar.y >= q.y);
  }
});
test("both arenas share physical running, boost, jump and free flight rates", () => {
  const a = titanSession(),
    b = wyvernSession(),
    aa = sonicHandling(a),
    bb = sonicHandling(b);
  for (const key of [
    "run",
    "boost",
    "flight",
    "flightBoost",
    "jump",
    "gravity",
  ])
    assert.ok(Math.abs(aa[key] * arenaUnitScale(a) - bb[key]) < 1e-9, key);
});
test("releasing movement and rotating camera does not snap Sonic facing", () => {
  for (const make of [titanSession, wyvernSession]) {
    const s = make();
    s.avatar.facingYaw = 0.42;
    s.avatar.yaw = 1;
    s.avatar.lastLookYaw = 0.2;
    tickSonicMovement(s, {}, 1 / 60);
    assert.equal(s.avatar.facingYaw, 0.42);
  }
});
test("moving Wyvern route frames preserve world heading as well as position and velocity", () => {
  const p = {
      x: 12,
      y: 7,
      z: 90,
      vx: 3,
      vy: 0,
      vz: 8,
      yaw: 0.8,
      facingYaw: 1,
      lastLookYaw: 0.8,
    },
    old = { x: 10, y: 5, z: 20, yaw: 0.2 },
    next = { x: 12, y: 6, z: 24, yaw: 0.7 };
  const heading = p.yaw + old.yaw;
  advectWyvernAvatar(p, old, next);
  assert.ok(Math.abs(p.yaw + next.yaw - heading) < 1e-9);
  assert.equal(p.yaw, p.lastLookYaw);
  assert.ok(Math.abs(p.facingYaw - 0.5) < 1e-9);
});
