import test from "node:test";
import assert from "node:assert/strict";
import {
  titanSession,
  stepTitan,
  titanInput,
  TITAN_MOVES,
} from "../src/giganto-simulation.js";
import {
  titanSweepHand,
  TITAN_SWEEP,
  titanSweepPrompt,
} from "../src/titan-sweep.js";
import {
  titanArmPath,
  titanSweepTouches,
  titanBodyRegions,
} from "../src/titan-contact.js";
const fight = () => {
  const s = titanSession({ drain: 0, cinematics: false });
  s.stage = "combat";
  s.emerald = true;
  s.rings = 400;
  s.idle = 999;
  s.attack = "sweep";
  s.attackTime = 0;
  s.iframes = 0;
  s.swatSide = "L";
  Object.assign(s.avatar, {
    x: 120,
    y: 57,
    z: 40,
    vx: 0,
    vy: 0,
    vz: 0,
    onGround: false,
  });
  return s;
};
const ticks = (s, n, hz = 60, input = {}) => {
  const events = [];
  for (let i = 0; i < n; i++) {
    stepTitan(s, input, 1 / hz);
    events.push(...s.events);
  }
  return events;
};
test("double sweep has distinct releases and a real dodge-recharge gap at every difficulty and 30/60/144 Hz", () => {
  for (const difficulty of ["easy", "normal", "hard"])
    for (const hz of [30, 60, 144]) {
      const s = fight();
      s.config.difficulty = difficulty;
      const e = ticks(s, hz * 5, hz),
        first = e.filter((e) => e.type === "boss-release"),
        second = e.filter((e) => e.type === "boss-followup");
      assert.equal(first.length, 1);
      assert.equal(second.length, 1);
      assert.ok(Math.abs(second[0].at - first[0].at - 0.9) <= 1 / hz + 0.00001);
      assert.equal(s.attack, "idle");
      // Adaptive recovery is shorter; the deliberate gap between hands remains.
      assert.ok(s.idle > 0);
      assert.ok(TITAN_SWEEP.offset > 0.85);
      assert.equal(TITAN_MOVES.sweep.strike, 1.55);
    }
});
test("waiting hands and the finished first arm are harmless; each active window follows the moving forearm", () => {
  const s = fight();
  for (const side of ["L", "R"]) {
    const w = titanSweepHand(s, side),
      t = w.start + 0.3;
    s.attackTime = t;
    const arm = titanBodyRegions(s, t).find((x) => x.id === side + " forearm"),
      p = { x: arm.b.x, y: arm.b.y - 1.8, z: arm.b.z };
    assert.ok(titanSweepTouches(s, side, p, p, t - 0.01));
    s.attackTime = w.start - 0.02;
    const waiting = titanArmPath(s, side),
      q = { x: waiting.x, y: waiting.y - 1.8, z: waiting.z };
    assert.equal(titanSweepTouches(s, side, q, q, s.attackTime - 0.01), false);
    s.attackTime = w.end + 0.1;
    assert.equal(titanSweepTouches(s, side, p, p, s.attackTime - 0.01), false);
  }
});
test("crossed windows catch a fast player sweep without enlarging its radius", () => {
  const s = fight(),
    w = titanSweepHand(s, "R");
  s.attackTime = w.start + 0.32;
  const a = titanArmPath(s, "R", s.attackTime),
    from = { x: a.x - 20, y: a.y - 1.8, z: a.z },
    to = { x: a.x + 20, y: a.y - 1.8, z: a.z };
  assert.ok(titanSweepTouches(s, "R", from, to, s.attackTime - 1 / 30));
  assert.equal(
    titanSweepTouches(
      s,
      "R",
      { ...from, y: 130 },
      { ...to, y: 130 },
      s.attackTime - 1 / 30,
    ),
    false,
  );
});
test("a protected first contact can be followed by a right hit; one actual hit prevents a second damage chain", () => {
  for (const protectedFirst of [false, true]) {
    const s = fight(),
      events = [];
    for (let i = 0; i < 60 * 4 && s.attack === "sweep"; i++) {
      const side = s.attackTime < 2.4 ? "L" : "R",
        hand = titanArmPath(s, side, s.attackTime + 1 / 60);
      Object.assign(s.avatar, {
        x: hand.x,
        y: hand.y - 1.8,
        z: hand.z,
        vx: 0,
        vy: 0,
        vz: 0,
      });
      if (protectedFirst && side === "L") s.iframes = 0.1;
      stepTitan(s, {}, 1 / 60);
      events.push(...s.events);
    }
    assert.equal(events.filter((e) => e.type === "impact").length, 1);
    assert.equal(s.rings, 370);
    assert.ok(s.sweepDamaged);
    if (protectedFirst) assert.equal(s.sweepConsumed, 3);
  }
});
test("parrying either hand cancels the remaining combo and awards the ordinary counter window", () => {
  for (const side of ["L", "R"]) {
    const s = fight(),
      w = titanSweepHand(s, side);
    s.attackTime = w.start + 0.3;
    s.released = true;
    const h = titanArmPath(s, side, s.attackTime + 1 / 60);
    Object.assign(s.avatar, {
      x: h.x,
      y: h.y - 1.8,
      z: h.z,
      vx: 0,
      vy: 0,
      vz: 0,
    });
    stepTitan(s, { parry: true }, 1 / 60);
    assert.equal(s.attack, "idle");
    assert.ok(s.counter > 2);
    assert.equal(s.rings, 400);
    const e = ticks(s, 45);
    assert.equal(e.filter((e) => e.type === "boss-followup").length, 0);
  }
});
test("prompts describe the actual hand phase and dodge remains available during the second warning", () => {
  const s = fight();
  assert.match(titanSweepPrompt(s), /LEFT THEN RIGHT/);
  s.attackTime = 2;
  assert.match(titanSweepPrompt(s), /RIGHT FOLLOWS/);
  s.attackTime = 2.8;
  assert.match(titanSweepPrompt(s), /RIGHT SWEEP/);
  assert.ok(titanInput(s, "dodge"));
});

test("two actual dodge inputs can protect both forced contact windows with the ordinary cooldown", () => {
  for (const hz of [30, 60, 144]) {
    const s = fight(),
      pressed = new Set(),
      events = [];
    for (let i = 0; i < hz * 4 && s.attack === "sweep"; i++) {
      const side = s.attackTime < 2.4 ? "L" : "R",
        w = titanSweepHand(s, side),
        hand = titanArmPath(s, side, s.attackTime + 1 / hz);
      Object.assign(s.avatar, {
        x: hand.x,
        y: hand.y - 1.8,
        z: hand.z,
        vx: 0,
        vy: 0,
        vz: 0,
      });
      if (!pressed.has(side) && s.attackTime >= w.start + 0.01) {
        assert.ok(titanInput(s, "dodge"), hz + " " + side);
        pressed.add(side);
      }
      stepTitan(s, {}, 1 / hz);
      events.push(...s.events);
    }
    assert.equal(pressed.size, 2);
    assert.equal(s.sweepConsumed, 3);
    assert.equal(s.rings, 400);
    assert.equal(events.filter((e) => e.type === "impact").length, 0);
  }
});
