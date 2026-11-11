import test from "node:test";
import assert from "node:assert/strict";
import {
  titanSession,
  titanInput,
  stepTitan,
  restoreTitanSession,
  TITAN_MOVES,
} from "../src/giganto-simulation.js";
import { arenaUnitScale, sonicLength } from "../src/titan-metrics.js";
import {
  titanScorePlan,
  TITAN_SCORE_CUES,
} from "../src/giganto-score-timeline.js";
import { alignTitanCinematic } from "../src/titan-timing.js";
import { TITAN_ACTIONS } from "../src/titan-combat.js";
import { spinAngle } from "../src/titan-advanced.js";
import { upgradeTitanCombat } from "../src/titan-balance.js";
const ticks = (s, n, dt = 1 / 60, input = {}) => {
  const events = [];
  for (let i = 0; i < n; i++) {
    stepTitan(s, input, dt);
    events.push(...s.events);
  }
  return events;
};
function fight() {
  const s = titanSession({ cinematics: false, drain: 0 });
  s.emerald = true;
  s.stage = "transform";
  titanInput(s, "skip");
  s.idle = 999;
  Object.assign(s.avatar, { x: 0, y: 57, z: 5, onGround: false });
  return s;
}
test("larger Titan preserves physical Sonic proportions and independently configurable scale", () => {
  const s = titanSession();
  assert.equal(arenaUnitScale(s), 2.8);
  assert.equal(sonicLength(s, 3.8) * arenaUnitScale(s), 3.8);
  assert.equal(arenaUnitScale(titanSession({ titanScale: 3.2 })), 3.2);
  assert.equal(arenaUnitScale(titanSession({ colossalScale: false })), 1);
});
test("slower protected scenes follow actual audio time and fire contacts exactly once at 30/60/144 Hz", () => {
  for (const fps of [30, 60, 144]) {
    const s = titanSession({ drain: 0 });
    s.original = {};
    s.stage = "finale";
    s.emerald = true;
    const score = {
      cues: TITAN_SCORE_CUES,
      context: { state: "running", currentTime: 0 },
      current: { section: "finale", offset: 237, when: 0 },
    };
    const events = [];
    let pending = 0;
    for (let i = 1; i <= Math.ceil(fps * 10.6); i++) {
      score.context.currentTime = i / fps;
      pending += 1 / fps;
      const n = Math.floor((pending + 1e-9) * 60);
      if (!n) continue;
      alignTitanCinematic(s, score, n / 60);
      for (let j = 0; j < n; j++) {
        events.push(...ticks(s, 1));
        pending -= 1 / 60;
      }
    }
    assert.equal(s.stage, "finale");
    assert.ok(Math.abs(s.stageTime - 10.6 * 0.65) < 0.03);
    const cues = events.filter((e) => e.type === "cinematic-cue");
    assert.deepEqual(
      cues.map((e) => e.cue),
      ["charge", "launch", "contact", "rupture", "detonate"],
    );
    assert.equal(new Set(cues.map((e) => e.eventId)).size, 5);
    ticks(s, 20);
    assert.equal(s.stage, "victory");
  }
  const s = titanSession();
  s.stage = "phase";
  s.stageTime = 2;
  assert.ok(Math.abs(titanScorePlan(s).offset - (121 + 2 / 0.65)) < 1e-8);
  s.original = {};
  const r = restoreTitanSession(JSON.parse(JSON.stringify(s)));
  assert.equal(r.cinemaRate, 0.65);
  const old = JSON.parse(JSON.stringify(s));
  delete old.cinemaRate;
  assert.equal(restoreTitanSession(old).cinemaRate, 1);
});
test("new techniques have bounded timed damage, free abilities and no Super cooldowns; ranged kicks emit four contacts", () => {
  for (const [move, max] of [
    ["boom", 1200],
    ["stomp", 1300],
    ["spin", 1200],
    ["cyclone", 1260],
  ]) {
    const s = fight(),
      hp = s.hp;
    assert.ok(titanInput(s, move), move);
    assert.equal(s.hp, hp);
    assert.equal(s.energy, undefined);
    assert.equal(titanInput(s, move), false);
    const events = ticks(s, 110),
      hits = events.filter((e) => e.type === "hit");
    assert.ok(hits.length > 0, move + " contacts");
    assert.ok(hp - s.hp <= max, move + " bounded");
    assert.equal(new Set(hits.map((e) => e.serial)).size, 1);
    assert.equal(s.cooldowns[move],0);
    assert.equal(s.strike, null);
    for (const value of Object.values(s.avatar))
      if (typeof value === "number") assert.ok(Number.isFinite(value));
    const far = fight();
    far.avatar.z = 120;
    assert.equal(titanInput(far, move), move === "boom");
    if (move === "boom") {
      ticks(far, 110);
      assert.equal(far.hp, far.maxHp);
    }
  }
});
test("revision-four custom balance migrates once and new attacks receive independent defaults", () => {
  const c = upgradeTitanCombat({
    combatRevision: 4,
    damage: { basic: 360, boom: 1640 },
  });
  assert.equal(c.damage.basic, 360);
  assert.equal(c.damage.boom, 600);
  assert.equal(c.damage.stomp, 1300);
  assert.deepEqual(upgradeTitanCombat(c), c);
});
test("new boss spin traverses two complete turns and has a long readable tell; uppercut is independently scheduled", () => {
  const s = fight();
  s.attack = "spin";
  s.attackTime = 2;
  assert.equal(spinAngle(s), 0);
  s.attackTime = 4.5;
  assert.ok(Math.abs(spinAngle(s) - Math.PI * 4) < 1e-9);
  assert.ok(TITAN_MOVES.spin.tell >= 2);
  assert.ok(TITAN_MOVES.uppercut.tell >= 1.8);
  assert.equal(TITAN_ACTIONS.boom.contacts.length, 4);
  assert.equal(TITAN_ACTIONS.cyclone.contacts.length, 3);
});
