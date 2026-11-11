import test from "node:test";
import assert from "node:assert/strict";
import {
  titanSession,
  titanInput,
  stepTitan,
  restoreTitanSession,
} from "../src/giganto-simulation.js";
import {
  TITAN_COUNTER,
  TITAN_FINALE,
  tickTitanFinaleCues,
  titanCinematicShot,
  titanCounterPosition,
} from "../src/titan-cinematics.js";
import { titanWorldPoint } from "../src/titan-space.js";
const fight = () => {
  const s = titanSession({ cinematicPace: 1, cinematics: true, drain: 0 });
  Object.assign(s, {
    stage: "combat",
    emerald: true,
    phase: 2,
    idle: 999,
    rings: 400,
  });
  Object.assign(s.avatar, { x: 0, y: 57, z: 5 });
  s.original = {};
  return s;
};
const step = (s, n, hz = 60) => {
  const e = [];
  for (let i = 0; i < n; i++) {
    stepTitan(s, {}, 1 / hz);
    e.push(...s.events);
  }
  return e;
};
function winQte(s, kind = "beam") {
  s.qte = { kind, left: 2, need: 8, hits: 8 };
  step(s, 1);
  assert.ok(s.counterScene);
  return s;
}
test("successful beam and grab counters wait for contact, protect resources and restore controls once", () => {
  for (const kind of ["beam", "crunch"])
    for (const hz of [30, 60, 144]) {
      const s = winQte(fight(), kind),
        hp = s.hp,
        ring = s.rings,
        from = { ...s.avatar };
      assert.equal(s.hp, hp);
      assert.equal(s.action, "cinematic_counter");
      for (const a of ["hit", "jump", "dodge", "loop", "target"])
        assert.equal(titanInput(s, a), false);
      const before = step(
        s,
        Math.floor((TITAN_COUNTER.impact - 0.06) * hz),
        hz,
      );
      assert.equal(s.hp, hp);
      assert.ok(!before.some((q) => q.type === "hit"));
      assert.ok(
        Math.hypot(
          s.avatar.x - from.x,
          s.avatar.y - from.y,
          s.avatar.z - from.z,
        ) > 1,
      );
      const e = step(s, Math.ceil((TITAN_COUNTER.duration + 0.2) * hz), hz);
      assert.equal(hp - s.hp, 2300);
      assert.equal(e.filter((q) => q.type === "hit").length, 1);
      assert.equal(s.rings, ring);
      assert.equal(s.counterScene, null);
      assert.equal(s.action, "idle");
      assert.ok(s.iframes > 0);
      assert.ok(titanInput(s, "dodge"));
    }
});
test("skipping a counter before or after its hit awards only its earned strike and leaves no pending sequence", () => {
  for (const t of [0, 0.95]) {
    const s = winQte(fight());
    step(s, Math.round(t * 60));
    titanInput(s, "skip");
    titanInput(s, "skip");
    step(s, 120);
    assert.equal(s.maxHp - s.hp, 2300);
    assert.equal(s.counterScene, null);
    assert.equal(s.qte, null);
    assert.ok(titanInput(s, "hit"));
  }
});
test("an interrupted counter resumes without duplicating damage or replaying its launch", () => {
  for (const t of [0.4, 1.05]) {
    const s = winQte(fight());
    step(s, Math.round(t * 60));
    const saved = JSON.parse(JSON.stringify(s)),
      r = restoreTitanSession(saved);
    assert.ok(r.counterScene);
    const e = step(r, 150);
    assert.equal(r.maxHp - r.hp, 2300);
    assert.equal(e.filter((q) => q.type === "hit").length, t < 0.85 ? 1 : 0);
    assert.ok(!e.some((q) => q.type === "cinematic-cue" && q.cue === "launch"));
    assert.equal(r.counterScene, null);
  }
});
test("counter contact can trigger the half-health phase and finale without stale locks or later duplicate hits", () => {
  for (const hp of [6150, 150]) {
    const s = fight();
    s.phase = hp > 6000 ? 1 : 2;
    s.hp = hp;
    winQte(s);
    const e = step(s, 55);
    assert.equal(s.stage, hp > 6000 ? "phase" : "finale");
    assert.equal(s.counterScene, null);
    assert.equal(e.filter((q) => q.type === "hit").length, 1);
    assert.equal(s.qte, null);
  }
});
test("finale cues fire once at authored beats and catch-up marks late events instead of scheduling delayed audio", () => {
  const s = fight();
  s.stage = "finale";
  s.cinematicFrom = { ...s.avatar };
  const e = step(s, 421);
  assert.deepEqual(
    e.filter((q) => q.type === "cinematic-cue").map((q) => q.cue),
    ["charge", "launch", "contact", "rupture", "detonate"],
  );
  assert.equal(s.stage, "victory");
  assert.equal(s.finaleCues, 31);
  for (const q of e.filter((q) => q.type === "cinematic-cue"))
    assert.ok(q.age < 1 / 60 + 0.0001);
  const h = fight();
  h.stage = "finale";
  h.stageTime = 5;
  const crossed = [];
  tickTitanFinaleCues(h, (_s, type, data) => crossed.push({ type, ...data }));
  tickTitanFinaleCues(h, () => assert.fail("duplicate cue"));
  assert.equal(crossed.length, 4);
  assert.ok(crossed.find((q) => q.cue === "charge").age > 4);
  assert.ok(
    Math.abs(
      TITAN_FINALE.contact / 0.3 - Math.round(TITAN_FINALE.contact / 0.3),
    ) < 0.0001,
  );
});
test("finale saves and skips preserve the authoritative flight endpoint, suppress old cues and never replay victory", () => {
  const s = fight();
  s.stage = "finale";
  s.cinematicFrom = { ...s.avatar };
  step(s, 240);
  const r = restoreTitanSession(JSON.parse(JSON.stringify(s)));
  assert.equal(r.finaleCues, 7);
  const e = step(r, 200);
  assert.equal(r.stage, "victory");
  assert.deepEqual(
    e.filter((q) => q.type === "cinematic-cue").map((q) => q.cue),
    ["rupture", "detonate"],
  );
  const p = { x: r.avatar.x, y: r.avatar.y, z: r.avatar.z };
  step(r, 30);
  assert.deepEqual({ x: r.avatar.x, y: r.avatar.y, z: r.avatar.z }, p);
  const skip = fight();
  skip.stage = "finale";
  skip.cinematicFrom = { ...skip.avatar };
  titanInput(skip, "skip");
  assert.equal(skip.stage, "victory");
  assert.equal(skip.finaleCues, 31);
  assert.ok(skip.avatar.z < -100);
  assert.equal(skip.counterScene, null);
});
test("counter and finale camera compositions follow a moved boss; corrupt scene saves fail closed", () => {
  const s = fight();
  Object.assign(s.boss, { x: 20, z: -12, yaw: 1 });
  Object.assign(s.avatar, titanWorldPoint(s, { x: 0, y: 57, z: 5 }));
  winQte(s, "crunch");
  for (const t of [0, 0.4, 0.85, 1.65]) {
    const p = titanCounterPosition(s, s.counterScene, t),
      shot = titanCinematicShot(s, p);
    assert.ok(Object.values(p).every(Number.isFinite));
    assert.ok(shot.position.y >= p.y);
  }
  const bad = JSON.parse(JSON.stringify(s));
  bad.counterScene.aim.normal.x = NaN;
  assert.equal(restoreTitanSession(bad).counterScene, null);
});

test("ground-level beam counters remain above the arena floor throughout approach and separation", () => {
  for (const z of [15, 25, 80, 130]) {
    const s = fight();
    Object.assign(s.avatar, { x: 0, y: 0.05, z });
    winQte(s);
    for (let i = 0; i < 102; i++) {
      stepTitan(s, {}, 1 / 60);
      assert.ok(s.avatar.y >= 0.05, JSON.stringify(s.avatar));
    }
  }
});

test("only progression and paid cinematic milestones request extra atomic saves", async () => {
  const { titanCheckpointEvent } = await import("../src/titan-cinematics.js");
  for (const type of [
    "stage",
    "checkpoint",
    "qte-win",
    "counter-end",
    "cinematic-skip",
  ])
    assert.ok(titanCheckpointEvent({ type }));
  assert.ok(titanCheckpointEvent({ type: "hit", kind: "struggle" }));
  for (const type of [
    "hit",
    "telegraph",
    "footstep",
    "cinematic-cue",
    "struggle",
    "ring",
  ])
    assert.equal(titanCheckpointEvent({ type, kind: "basic" }), false);
});
