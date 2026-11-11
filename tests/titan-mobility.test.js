import test from "node:test";
import assert from "node:assert/strict";
import {
  titanSession,
  titanInput,
  stepTitan,
  restoreTitanSession,
} from "../src/giganto-simulation.js";
import {
  beginTitanStep,
  titanWalkingFoot,
  titanStepProgress,
} from "../src/titan-mobility.js";
import {
  titanWorldPoint,
  titanLocalPoint,
  titanWorldVector,
} from "../src/titan-space.js";
import {
  nearestTitanSurface,
  sweptTitanContact,
  titanBodyRegions,
  titanArmPath,
  titanCanGrab,
  titanGrabTouches,
  titanFinalePosition,
  constrainTitanBody,
} from "../src/titan-contact.js";
import { titanDorsalRay } from "../src/titan-dorsal.js";
import { titanCameraBlocked, clearTitanCamera } from "../src/titan-camera.js";
const fight = () => {
  const s = titanSession({ cinematics: false, drain: 0 });
  s.stage = "combat";
  s.emerald = true;
  s.rings = 400;
  s.idle = 999;
  Object.assign(s.avatar, { x: 0, y: 57, z: 5 });
  return s;
};
const near = (a, b, e = 0.0001) =>
  assert.ok(
    Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < e,
    JSON.stringify({ a, b }),
  );
const ticks = (s, n, input = {}) => {
  const e = [];
  for (let i = 0; i < n; i++) {
    stepTitan(s, input, 1 / 60);
    e.push(...s.events);
  }
  return e;
};
test("rotated/translated body surfaces, arms, feet and rays stay in the Titan's frame", () => {
  const a = fight(),
    b = fight();
  Object.assign(b.boss, { x: 19, z: -12, yaw: 1.1 });
  for (const p of [
    { x: 0, y: 57, z: 5 },
    { x: 18, y: 35, z: 0 },
    { x: 0, y: 85, z: 23 },
  ]) {
    const x = nearestTitanSurface(a, p),
      y = nearestTitanSurface(b, titanWorldPoint(b, p));
    assert.ok(Math.abs(x.distance - y.distance) < 0.001);
    near(titanWorldPoint(b, x.point), y.point);
    near(titanWorldVector(b, x.normal), y.normal);
  }
  a.attack = b.attack = "swat";
  a.attackAim = { x: 3, y: 63, z: 8 };
  b.attackAim = titanWorldPoint(b, a.attackAim);
  a.swatSide = b.swatSide = "L";
  for (const t of [0, 0.8, 1.4, 1.7])
    near(titanWorldPoint(b, titanArmPath(a, "L", t)), titanArmPath(b, "L", t));
  const x = titanDorsalRay(3),
    y = titanDorsalRay(3, b);
  near(titanWorldPoint(b, x.from), y.from);
  near(titanWorldPoint(b, x.to), y.to);
});
test("deliberate walking has a warning, bounded translation/turn, alternating planted feet and no overlapping attacks", () => {
  const s = fight();
  assert.ok(beginTitanStep(s));
  const start = { ...s.boss },
    left = titanWalkingFoot(s, "L"),
    right = titanWalkingFoot(s, "R");
  ticks(s, 20);
  near({ x: s.boss.x, y: 0, z: s.boss.z }, { x: start.x, y: 0, z: start.z });
  near(titanWalkingFoot(s, "L"), left);
  near(titanWalkingFoot(s, "R"), right);
  const e = ticks(s, 160);
  assert.equal(s.boss.walk, null);
  assert.ok(Math.hypot(s.boss.x - start.x, s.boss.z - start.z) > 7.9);
  assert.deepEqual(
    e.filter((e) => e.type === "footstep").map((e) => e.side),
    ["L", "R"],
  );
  for (const step of e.filter((e) => e.type === "footstep")) {
    assert.equal(step.point.y, 0.18);
    assert.deepEqual(step.normal, { x: 0, y: 1, z: 0 });
  }
  assert.ok(!e.some((e) => e.type === "telegraph"));
  assert.ok(s.idle > 0);
  assert.ok(Math.hypot(s.boss.x, s.boss.z) <= 32);
});
test("walking attacks register against the moving limbs and a swept body crossing cannot tunnel", () => {
  const s = fight();
  Object.assign(s.boss, { x: 25, z: -8, yaw: 0.8 });
  Object.assign(s.avatar, titanWorldPoint(s, { x: 0, y: 57, z: 5 }));
  const hp = s.hp;
  titanInput(s, "hit");
  ticks(s, 30);
  assert.equal(hp - s.hp, 180);
  s.boss.previous = { x: -25, z: 0, yaw: 0 };
  Object.assign(s.boss, { x: 25, z: 0, yaw: 0 });
  assert.ok(
    sweptTitanContact(s, { x: 0, y: 63, z: -7.5 }, { x: 0, y: 63, z: -7.5 }, 1),
  );
});
test("leg collision capsules follow the bent knee and planted foot during a step", () => {
  const s = fight();
  beginTitanStep(s);
  ticks(s, 55);
  const foot = titanWalkingFoot(s, "L"),
    regions = titanBodyRegions(s),
    shin = regions.find((r) => r.id === "L shin"),
    thigh = regions.find((r) => r.id === "L thigh");
  near(shin.b, foot);
  near(thigh.b, shin.a);
  assert.ok(shin.a.z > thigh.a.z + 2);
  assert.ok(titanStepProgress(s) > 0);
});
test("Cyloop freezes the current step, orbits the moved Titan once and resumes without a boss teleport", () => {
  const s = fight();
  Object.assign(s.boss, { x: 20, z: -12, yaw: 0.4 });
  Object.assign(s.avatar, titanWorldPoint(s, { x: 0, y: 57, z: 5 }));
  beginTitanStep(s);
  ticks(s, 35);
  const before = { x: s.boss.x, y: 0, z: s.boss.z };
  assert.ok(titanInput(s, "loop"));
  ticks(s, 160);
  near({ x: s.boss.x, y: 0, z: s.boss.z }, before);
  const e = ticks(s, 40);
  assert.equal(e.filter((e) => e.type === "hit").length, 1);
  assert.ok(e.some((e) => e.kind === "loop"));
  ticks(s, 420);
  assert.equal(s.boss.walk, null);
});
test("mobility toggles, cinematics, QTE and stagger pause movement, and interrupted saves retain a safe standing boss pose", () => {
  const off = fight();
  off.config.bossMobility = false;
  assert.equal(beginTitanStep(off), false);
  for (const kind of ["phase", "qte", "stagger"]) {
    const s = fight();
    beginTitanStep(s);
    ticks(s, 50);
    const p = { x: s.boss.x, y: 0, z: s.boss.z };
    if (kind === "phase") s.stage = "phase";
    else if (kind === "qte")
      s.qte = { left: 4, hits: 0, need: 12, kind: "beam" };
    else s.stagger = 1;
    ticks(s, 15);
    near({ x: s.boss.x, y: 0, z: s.boss.z }, p);
    s.original = {};
    const r = restoreTitanSession(JSON.parse(JSON.stringify(s)));
    near({ x: r.boss.x, y: 0, z: r.boss.z }, p);
    assert.equal(r.boss.walk, null);
  }
  const legacy = fight();
  legacy.original = {};
  delete legacy.boss;
  const r = restoreTitanSession(JSON.parse(JSON.stringify(legacy)));
  assert.equal(r.boss.x, 0);
});
test("grabs require a reachable hand; high/ground or distant targets cannot be caught through empty space", () => {
  const s = fight();
  assert.equal(titanCanGrab(s), true);
  for (const p of [
    { x: 0, y: 0.05, z: 5 },
    { x: 0, y: 130, z: 60 },
    { x: 100, y: 57, z: 100 },
  ])
    assert.equal(titanCanGrab(s, p), false);
  s.attack = "crunch";
  s.attackAim = { ...s.avatar };
  s.attackTime = 1.8;
  assert.ok(titanGrabTouches(s, s.avatar));
  assert.equal(titanGrabTouches(s, { x: 0, y: 0.05, z: 5 }), false);
  for (const side of ["L", "R"]) {
    const q = titanLocalPoint(s, titanArmPath(s, side)),
      a = { x: (side === "L" ? 1 : -1) * 17.74, y: 74.23, z: -8.565 };
    assert.ok(Math.hypot(q.x - a.x, q.y - a.y, q.z - a.z) < 48.901);
  }
});
test("camera clearance, body constraints and finale composition track a moved and turned boss", () => {
  const s = fight();
  Object.assign(s.boss, { x: 22, z: -14, yaw: 1.2 });
  Object.assign(s.avatar, titanWorldPoint(s, { x: 0, y: 57, z: 5 }));
  const blocked = titanWorldPoint(s, { x: 0, y: 62, z: -30 }),
    safe = clearTitanCamera(s, blocked, 38);
  assert.equal(titanCameraBlocked(s, safe), false);
  const from = { x: 30, y: 57, z: 30 },
    world = titanWorldPoint(s, from);
  for (const t of [0, 1, 2, 3.8])
    near(
      titanWorldPoint(s, titanFinalePosition(from, t, { config: s.config })),
      titanFinalePosition(world, t, s),
    );
  const p = titanWorldPoint(s, { x: 0, y: 63, z: -7.5 });
  constrainTitanBody(p, s);
  assert.ok(nearestTitanSurface(s, { ...p, y: p.y + 1.8 }).distance >= 1);
});

test("Wild Rush physically zigzags at 30/60/144 Hz with bounded contacts, speed and recovery", () => {
  const final = [];
  for (const hz of [30, 60, 144]) {
    const s = fight();
    s.avatar.z = 9;
    const start = { ...s.avatar };
    assert.ok(titanInput(s, "rush"));
    near(s.avatar, start);
    assert.equal(s.energy, undefined);
    let hits = 0,
      positive = 0,
      negative = 0,
      maxSpeed = 0;
    for (let i = 0; i < hz; i++) {
      const previous = { ...s.avatar };
      stepTitan(s, {}, 1 / hz);
      hits += s.events.filter((e) => e.type === "hit").length;
      if (i / hz < 0.64) {
        positive = Math.max(positive, s.avatar.x);
        negative = Math.min(negative, s.avatar.x);
      }
      maxSpeed = Math.max(
        maxSpeed,
        Math.hypot(
          s.avatar.x - previous.x,
          s.avatar.y - previous.y,
          s.avatar.z - previous.z,
        ) * hz,
      );
    }
    assert.ok(positive > .5 && negative < -.5);
    assert.ok(maxSpeed < 75);
    assert.equal(hits, 3);
    assert.equal(s.maxHp - s.hp, 1620);
    assert.equal(s.strike, null);
    final.push({ ...s.avatar });
  }
  near(final[0], final[1], 0.1);
  near(final[1], final[2], 0.1);
});

test("enabling tactical steps late in combat never queues skipped movement cycles", () => {
  const s = fight();
  s.idle = 0;
  s.sequence = 12;
  const events = ticks(s, 270);
  assert.equal(events.filter((e) => e.type === "reposition").length, 1);
  assert.ok(events.some((e) => e.type === "telegraph"));
  assert.equal(s.boss.steps, 4);
});

test("Wild Rush follows a moved body without remote homing, and dodge cancels its path and pending hits", () => {
  const s = fight();
  Object.assign(s.boss, { x: 20, z: -10, yaw: 1 });
  Object.assign(s.avatar, titanWorldPoint(s, { x: 0, y: 57, z: 9 }));
  titanInput(s, "rush");
  ticks(s, 5);
  const before = { ...s.avatar };
  assert.ok(titanInput(s, "dodge"));
  assert.equal(s.strike, null);
  const e = ticks(s, 60);
  assert.ok(!e.some((e) => e.type === "hit"));
  assert.ok(Math.hypot(s.avatar.x - before.x, s.avatar.z - before.z) > 1);
  for (const locked of [true, false]) {
    const a = fight();
    Object.assign(a.avatar, { x: 100, y: 57, z: 100, yaw: Math.PI / 2 });
    a.lock = locked;
    titanInput(a, "rush");
    assert.equal(a.strike.rushPath.locked, false);
    ticks(a, 60);
    assert.equal(a.hp, a.maxHp);
    assert.ok(Math.hypot(a.avatar.x - 100, a.avatar.z - 100) < 35);
  }
});
